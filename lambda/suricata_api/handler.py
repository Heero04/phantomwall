import datetime
import json
import os
from collections import Counter
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Attr, Key

_dynamodb = boto3.resource("dynamodb")
_table = _dynamodb.Table(os.environ["TABLE_NAME"])


def _response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body),
    }


def _decimal_to_native(value):
    if isinstance(value, list):
        return [_decimal_to_native(v) for v in value]
    if isinstance(value, dict):
        return {k: _decimal_to_native(v) for k, v in value.items()}
    if isinstance(value, Decimal):
        return float(value)
    return value


def _safe_int(value):
    if isinstance(value, Decimal):
        return int(value)
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _partition_dates(start_ms: int, end_ms: int):
    start_dt = datetime.datetime.utcfromtimestamp(start_ms / 1000)
    end_dt = datetime.datetime.utcfromtimestamp(end_ms / 1000)
    current = start_dt.date()
    while current <= end_dt.date():
        yield current
        current += datetime.timedelta(days=1)


def _iter_events(start_ms: int, end_ms: int):
    projection = "#ts, src_ip, dest_port, severity"
    expression_names = {"#ts": "timestamp"}

    for current_date in _partition_dates(start_ms, end_ms):
        partition_key = current_date.strftime("%Y-%m-%d")
        day_start = datetime.datetime.combine(current_date, datetime.time.min, tzinfo=datetime.timezone.utc)
        day_end = datetime.datetime.combine(current_date, datetime.time.max, tzinfo=datetime.timezone.utc)
        partition_start = max(start_ms, int(day_start.timestamp() * 1000))
        partition_end = min(end_ms, int(day_end.timestamp() * 1000))
        if partition_start > partition_end:
            continue

        kwargs = {
            "KeyConditionExpression": Key("event_date").eq(partition_key),
            "FilterExpression": Attr("timestamp").between(partition_start, partition_end),
            "ProjectionExpression": projection,
            "ExpressionAttributeNames": expression_names,
        }

        last_evaluated = None
        while True:
            if last_evaluated:
                kwargs["ExclusiveStartKey"] = last_evaluated
            response = _table.query(**kwargs)
            for item in response.get("Items", []):
                yield item
            last_evaluated = response.get("LastEvaluatedKey")
            if not last_evaluated:
                break


def _calculate_metrics():
    now = datetime.datetime.utcnow().replace(tzinfo=datetime.timezone.utc)
    now_ms = int(now.timestamp() * 1000)
    window_24h_start = now - datetime.timedelta(hours=24)
    window_1h_start = now - datetime.timedelta(hours=1)
    window_5m_start = now - datetime.timedelta(minutes=5)

    start_24h_ms = int(window_24h_start.timestamp() * 1000)
    start_1h_ms = int(window_1h_start.timestamp() * 1000)
    start_5m_ms = int(window_5m_start.timestamp() * 1000)

    events_24h = 0
    unique_ips_24h = set()
    high_severity = 0
    new_ips_1h = set()
    events_last_5m = 0
    port_counter = Counter()

    for item in _iter_events(start_24h_ms, now_ms):
        event_ts = _safe_int(item.get("timestamp"))
        if event_ts is None:
            continue

        src_ip = item.get("src_ip")
        dest_port = _safe_int(item.get("dest_port"))
        severity = _safe_int(item.get("severity"))

        events_24h += 1
        if src_ip:
            unique_ips_24h.add(src_ip)
        if severity is not None and severity == 1:
            high_severity += 1
        if dest_port is not None:
            port_counter[str(dest_port)] += 1

        if event_ts >= start_1h_ms and src_ip:
            new_ips_1h.add(src_ip)
        if event_ts >= start_5m_ms:
            events_last_5m += 1

    interval_minutes = max((now_ms - start_5m_ms) / 60000, 1)
    events_per_minute = events_last_5m / interval_minutes

    top_port = None
    if port_counter:
        port, count = port_counter.most_common(1)[0]
        top_port = {"port": port, "count": count}

    return {
        "generated_at": now.isoformat().replace("+00:00", "Z"),
        "windows": {
            "events_24h": window_24h_start.isoformat().replace("+00:00", "Z"),
            "new_ips_1h": window_1h_start.isoformat().replace("+00:00", "Z"),
            "events_per_minute": window_5m_start.isoformat().replace("+00:00", "Z"),
        },
        "metrics": {
            "events_24h": events_24h,
            "unique_ips_24h": len(unique_ips_24h),
            "high_severity_24h": high_severity,
            "events_per_minute": round(events_per_minute, 2),
            "new_ips_1h": len(new_ips_1h),
            "top_port": top_port,
        },
    }


def _handle_list_events(event):
    params = (event or {}).get("queryStringParameters") or {}
    event_date = params.get("event_date")
    limit_param = params.get("limit", "100")
    try:
        limit = max(1, min(int(limit_param), 500))
    except ValueError:
        limit = 100

    if not event_date:
        event_date = datetime.datetime.utcnow().strftime("%Y-%m-%d")

    query_kwargs = {
        "KeyConditionExpression": Key("event_date").eq(event_date),
        "ScanIndexForward": False,
        "Limit": limit,
    }

    response = _table.query(**query_kwargs)
    items = [_decimal_to_native(item) for item in response.get("Items", [])]

    body = {
        "event_date": event_date,
        "count": len(items),
        "items": items,
    }

    return _response(200, body)


def handler(event, context):
    request_context = (event or {}).get("requestContext") or {}
    route_key = request_context.get("routeKey") or ""
    raw_path = (event or {}).get("rawPath") or ""

    if route_key == "GET /metrics" or raw_path.endswith("/metrics"):
        metrics = _calculate_metrics()
        return _response(200, metrics)

    return _handle_list_events(event)

