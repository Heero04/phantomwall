"""
WebSocket Broadcaster
======================
Triggered by DynamoDB Streams on the suricata_events table.
Fans out new alert events to all connected WebSocket clients.
"""

import json
import os
import logging
from decimal import Decimal

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

_dynamodb = boto3.resource("dynamodb")
_connections_table = _dynamodb.Table(os.environ["CONNECTIONS_TABLE"])
_ws_endpoint = os.environ["WS_ENDPOINT"]

# Build the management API client from the WSS endpoint
# wss://abc123.execute-api.us-east-1.amazonaws.com/prod
# → https://abc123.execute-api.us-east-1.amazonaws.com/prod
_https_endpoint = _ws_endpoint.replace("wss://", "https://")
_apigw = boto3.client("apigatewaymanagementapi", endpoint_url=_https_endpoint)


def _decimal_default(obj):
    """JSON serializer for Decimal types from DynamoDB."""
    if isinstance(obj, Decimal):
        n = int(obj) if obj == int(obj) else float(obj)
        return n
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def _extract_event(record):
    """
    Extract a clean event dict from a DynamoDB Stream NEW_IMAGE record.
    Converts DynamoDB type descriptors (S, N, etc.) to plain values.
    """
    new_image = record.get("dynamodb", {}).get("NewImage", {})
    if not new_image:
        return None

    event = {}
    for key, type_val in new_image.items():
        if "S" in type_val:
            event[key] = type_val["S"]
        elif "N" in type_val:
            val = type_val["N"]
            event[key] = int(val) if "." not in val else float(val)
        elif "BOOL" in type_val:
            event[key] = type_val["BOOL"]
        elif "NULL" in type_val:
            event[key] = None
        elif "M" in type_val:
            # Nested map — keep as raw dict for payload inspection
            event[key] = _unmarshall_map(type_val["M"])
        elif "L" in type_val:
            event[key] = [_unmarshall_value(v) for v in type_val["L"]]

    return event


def _unmarshall_map(m):
    """Recursively unmarshall a DynamoDB map."""
    result = {}
    for k, v in m.items():
        result[k] = _unmarshall_value(v)
    return result


def _unmarshall_value(type_val):
    """Unmarshall a single DynamoDB typed value."""
    if "S" in type_val:
        return type_val["S"]
    elif "N" in type_val:
        val = type_val["N"]
        return int(val) if "." not in val else float(val)
    elif "BOOL" in type_val:
        return type_val["BOOL"]
    elif "NULL" in type_val:
        return None
    elif "M" in type_val:
        return _unmarshall_map(type_val["M"])
    elif "L" in type_val:
        return [_unmarshall_value(v) for v in type_val["L"]]
    return str(type_val)


def _build_traffic_entry(event):
    """
    Transform a DynamoDB event into the shape the Traffic Ledger expects.
    Maps Suricata fields to the UI's { id, ip, port, protocol, action, timestamp, payload } shape.
    """
    severity = event.get("severity")

    # Determine action based on severity or event_type
    if severity == 1:
        action = "BLOCKED"
    elif event.get("event_type") == "drop":
        action = "BLOCKED"
    else:
        action = "ACCEPTED"

    # Build a payload string for the "Inspect" panel
    payload_parts = []
    if event.get("signature"):
        payload_parts.append(f"Signature: {event['signature']}")
    if event.get("category"):
        payload_parts.append(f"Category: {event['category']}")
    if event.get("event_type"):
        payload_parts.append(f"Type: {event['event_type']}")
    if event.get("flow_id"):
        payload_parts.append(f"Flow ID: {event['flow_id']}")
    if event.get("country_name"):
        payload_parts.append(f"Origin: {event.get('flag', '')} {event['country_name']}")
    if event.get("summary"):
        payload_parts.append(f"\n{event['summary']}")

    # Include raw suricata data if present
    suricata_raw = event.get("suricata")
    if isinstance(suricata_raw, dict):
        # Add select raw fields
        alert_info = suricata_raw.get("alert", {})
        if alert_info:
            payload_parts.append(f"\nAlert Detail:")
            if alert_info.get("signature"):
                payload_parts.append(f"  Signature: {alert_info['signature']}")
            if alert_info.get("signature_id"):
                payload_parts.append(f"  SID: {alert_info['signature_id']}")
            if alert_info.get("rev"):
                payload_parts.append(f"  Rev: {alert_info['rev']}")

    return {
        "id": event.get("event_id", ""),
        "ip": event.get("src_ip", "0.0.0.0"),
        "dest_ip": event.get("dest_ip", ""),
        "port": event.get("dest_port") or event.get("src_port") or 0,
        "protocol": (event.get("proto") or "TCP").upper(),
        "action": action,
        "timestamp": event.get("event_time", ""),
        "severity": severity,
        "category": event.get("category", ""),
        "signature": event.get("signature", ""),
        "country": event.get("country_name", ""),
        "flag": event.get("flag", ""),
        "payload": "\n".join(payload_parts) if payload_parts else "No additional detail",
    }


def handler(event, context):
    """Process DynamoDB Stream records and broadcast to WebSocket clients."""
    records = event.get("Records", [])
    if not records:
        return {"statusCode": 200, "broadcast": 0}

    # Extract and transform events
    traffic_entries = []
    for record in records:
        if record.get("eventName") != "INSERT":
            continue
        raw_event = _extract_event(record)
        if raw_event:
            traffic_entries.append(_build_traffic_entry(raw_event))

    if not traffic_entries:
        return {"statusCode": 200, "broadcast": 0}

    # Get all connected clients
    try:
        scan_result = _connections_table.scan(
            ProjectionExpression="connectionId",
        )
        connections = scan_result.get("Items", [])
    except Exception as e:
        logger.error(f"Failed to scan connections: {e}")
        return {"statusCode": 500}

    if not connections:
        logger.info("No connected clients, skipping broadcast")
        return {"statusCode": 200, "broadcast": 0, "clients": 0}

    # Build the message payload
    message = json.dumps({
        "type": "traffic",
        "entries": traffic_entries,
    }, default=_decimal_default)

    message_bytes = message.encode("utf-8")

    # Fan out to all connected clients
    stale_connections = []
    sent = 0

    for conn in connections:
        conn_id = conn["connectionId"]
        try:
            _apigw.post_to_connection(
                ConnectionId=conn_id,
                Data=message_bytes,
            )
            sent += 1
        except _apigw.exceptions.GoneException:
            # Client disconnected without clean close — clean up
            stale_connections.append(conn_id)
        except Exception as e:
            logger.warning(f"Failed to send to {conn_id}: {e}")
            stale_connections.append(conn_id)

    # Clean up stale connections
    for conn_id in stale_connections:
        try:
            _connections_table.delete_item(Key={"connectionId": conn_id})
        except Exception:
            pass

    logger.info(f"Broadcast {len(traffic_entries)} events to {sent} clients, cleaned {len(stale_connections)} stale")
    return {
        "statusCode": 200,
        "broadcast": len(traffic_entries),
        "clients": sent,
        "stale_cleaned": len(stale_connections),
    }
