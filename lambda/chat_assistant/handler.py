import json
import os
import time
from decimal import Decimal

import boto3

DDB_TABLE = os.environ["TABLE_NAME"]
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "anthropic.claude-3-haiku-20240307-v1:0")
MAX_ITEMS = int(os.environ.get("MAX_ITEMS", "25"))

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(DDB_TABLE)

bedrock = boto3.client("bedrock-runtime")

def _decimal_to_native(value):
    if isinstance(value, list):
        return [_decimal_to_native(v) for v in value]
    if isinstance(value, dict):
        return {k: _decimal_to_native(v) for k, v in value.items()}
    if isinstance(value, Decimal):
        return float(value)
    return value


def _query_events(event_date: str):
    # Most recent events first
    response = table.query(
        KeyConditionExpression=boto3.dynamodb.conditions.Key("event_date").eq(event_date),
        ScanIndexForward=False,
        Limit=MAX_ITEMS,
    )
    return [_decimal_to_native(item) for item in response.get("Items", [])]


def _build_prompt(user_prompt: str, events: list[dict]):
    if not events:
        return (
            "You are a SOC assistant. No events matched the query. "
            "Respond politely that no telemetry is available."
        )

    context_lines = []
    for evt in events:
        summary = evt.get("summary", "suricata event")
        event_time = evt.get("event_time") or time.strftime(
            "%Y-%m-%dT%H:%M:%SZ", time.gmtime(evt.get("timestamp", 0) / 1000)
        )
        context_lines.append(
            f"- time: {event_time}, type: {evt.get('event_type')}, src: {evt.get('src_ip')}:{evt.get('src_port')}, "
            f"dest: {evt.get('dest_ip')}:{evt.get('dest_port')}, severity: {evt.get('severity')}, summary: {summary}"
        )

    context_block = "\n".join(context_lines)

    return (
        "You are an expert security analyst. Summarise relevant honeypot activity for the user."
        " Focus on attacker IPs, ports, event types, and severity."
        "\nTelemetry:\n"
        f"{context_block}\n\n"
        f"User question: {user_prompt}\n"
        "If the question requests specific IPs or counts, reference the telemetry above."
    )


def handler(event, context):
    body = event.get("body")
    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode("utf-8")
    payload = json.loads(body or "{}")

    user_prompt = payload.get("prompt") or "What happened recently?"
    event_date = payload.get("event_date")
    if not event_date:
        event_date = time.strftime("%Y-%m-%d", time.gmtime())

    events = _query_events(event_date)
    prompt = _build_prompt(user_prompt, events)

    bedrock_response = bedrock.invoke_model(
        modelId=BEDROCK_MODEL_ID,
        body=json.dumps(
            {
                "anthropic_version": "bedrock-2023-05-31",
                "temperature": 0.2,
                "top_p": 0.9,
                "max_tokens": 600,
                "messages": [
                    {
                        "role": "user",
                        "content": [{"type": "text", "text": prompt}],
                    }
                ],
            }
        ),
        contentType="application/json",
        accept="application/json",
    )

    result_body = json.loads(bedrock_response["body"].read())
    text = ""
    if "content" in result_body:
        text = " ".join(
            part.get("text", "") for part in result_body["content"] if part.get("type") == "text"
        )
    elif "output_text" in result_body:
        text = result_body.get("output_text", "")

    response_body = {
        "answer": text.strip() or "No response generated.",
        "events": events,
    }

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(response_body),
    }
