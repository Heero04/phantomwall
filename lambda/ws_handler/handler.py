"""
WebSocket Connection Handler
=============================
Manages $connect / $disconnect / $default routes for the
Traffic Ledger real-time WebSocket API.

Stores connection IDs in DynamoDB with a 24-hour TTL.
"""

import json
import os
import time
import logging

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

_dynamodb = boto3.resource("dynamodb")
_table = _dynamodb.Table(os.environ["CONNECTIONS_TABLE"])

TTL_HOURS = 24


def handler(event, context):
    route_key = event.get("requestContext", {}).get("routeKey")
    connection_id = event.get("requestContext", {}).get("connectionId")

    logger.info(f"WS route={route_key} conn={connection_id}")

    if route_key == "$connect":
        return _on_connect(connection_id)
    elif route_key == "$disconnect":
        return _on_disconnect(connection_id)
    elif route_key == "$default":
        return _on_default(connection_id, event)
    else:
        return {"statusCode": 400}


def _on_connect(connection_id):
    """Store new connection with TTL."""
    _table.put_item(Item={
        "connectionId": connection_id,
        "connectedAt": int(time.time()),
        "ttl": int(time.time()) + (TTL_HOURS * 3600),
    })
    logger.info(f"Connected: {connection_id}")
    return {"statusCode": 200}


def _on_disconnect(connection_id):
    """Remove connection on disconnect."""
    try:
        _table.delete_item(Key={"connectionId": connection_id})
    except Exception as e:
        logger.warning(f"Disconnect cleanup failed for {connection_id}: {e}")
    logger.info(f"Disconnected: {connection_id}")
    return {"statusCode": 200}


def _on_default(connection_id, event):
    """Handle any message from the client (ping/pong, etc.)."""
    body = event.get("body", "")
    try:
        msg = json.loads(body) if body else {}
    except (json.JSONDecodeError, TypeError):
        msg = {}

    action = msg.get("action", "")

    if action == "ping":
        # Client keepalive — respond with pong
        domain = event["requestContext"]["domainName"]
        stage = event["requestContext"]["stage"]
        apigw = boto3.client(
            "apigatewaymanagementapi",
            endpoint_url=f"https://{domain}/{stage}",
        )
        try:
            apigw.post_to_connection(
                ConnectionId=connection_id,
                Data=json.dumps({"type": "pong", "ts": int(time.time() * 1000)}).encode(),
            )
        except Exception:
            pass

    return {"statusCode": 200}
