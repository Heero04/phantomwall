import base64
import datetime
import gzip
import json
import os
import uuid

import boto3

_dynamodb = boto3.resource("dynamodb")
_table = _dynamodb.Table(os.environ["TABLE_NAME"])

# S3 client for raw log storage
_s3 = boto3.client("s3")
_s3_bucket = os.environ.get("S3_BUCKET_NAME")
_s3_enabled = os.environ.get("ENABLE_S3_BACKUP", "false").lower() == "true"


def _decode_logs(event):
    data = event.get("awslogs", {}).get("data")
    if not data:
        return []
    payload = gzip.decompress(base64.b64decode(data)).decode("utf-8")
    return json.loads(payload).get("logEvents", [])


def _normalize_timestamp(ts_str, fallback_ms):
    if not ts_str:
        return datetime.datetime.utcfromtimestamp(fallback_ms / 1000), fallback_ms

    def _format_offset(value: str) -> str:
        if len(value) > 5 and value[-5] in "+-" and value[-3] != ":":
            return value[:-5] + value[-5:-2] + ":" + value[-2:]
        return value

    try:
        dt = datetime.datetime.fromisoformat(_format_offset(ts_str))
    except ValueError:
        for pattern in ("%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%dT%H:%M:%S%z"):
            try:
                dt = datetime.datetime.strptime(ts_str, pattern)
                break
            except ValueError:
                dt = None
        if dt is None:
            try:
                dt = datetime.datetime.strptime(ts_str, "%Y-%m-%dT%H:%M:%S.%f")
            except ValueError:
                return datetime.datetime.utcfromtimestamp(fallback_ms / 1000), fallback_ms
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    dt_utc = dt.astimezone(datetime.timezone.utc)
    return dt_utc, int(dt_utc.timestamp() * 1000)


def _safe_int(value):
    try:
        if value is None:
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def _build_summary(event_type, src_ip, src_port, dest_ip, dest_port, proto, signature):
    pieces = []
    if event_type:
        pieces.append(event_type.upper())
    if src_ip or dest_ip:
        src = f"{src_ip or 'unknown'}" + (f":{src_port}" if src_port is not None else "")
        dst = f"{dest_ip or 'unknown'}" + (f":{dest_port}" if dest_port is not None else "")
        pieces.append(f"{src} ? {dst}")
    if proto:
        pieces.append(proto)
    if signature:
        pieces.append(signature)
    return " | ".join(pieces) if pieces else "suricata event"


def _normalize_event(raw_event, fallback_ms):
    event_dt, event_ms = _normalize_timestamp(raw_event.get("timestamp"), fallback_ms)
    src_ip = raw_event.get("src_ip")
    dest_ip = raw_event.get("dest_ip")
    src_port = _safe_int(raw_event.get("src_port"))
    dest_port = _safe_int(raw_event.get("dest_port"))
    proto = raw_event.get("proto") or raw_event.get("proto_origin")
    flow_id = _safe_int(raw_event.get("flow_id"))
    event_type = raw_event.get("event_type")

    alert = raw_event.get("alert") or {}
    signature = alert.get("signature") or alert.get("signature_id")
    severity = _safe_int(alert.get("severity"))
    category = alert.get("category")

    normalized = {
        "event_time": event_dt.isoformat().replace("+00:00", "Z"),
        "timestamp": event_ms,
        "event_type": event_type,
        "src_ip": src_ip,
        "src_port": src_port,
        "dest_ip": dest_ip,
        "dest_port": dest_port,
        "proto": proto,
        "flow_id": flow_id,
        "severity": severity,
        "category": category,
        "signature": signature if isinstance(signature, str) else None,
        "signature_id": _safe_int(alert.get("signature_id")) if not isinstance(signature, str) else None,
    }

    flow_info = raw_event.get("flow") or {}
    if flow_info:
        normalized["flow_alerted"] = flow_info.get("alerted")
        normalized["flow_state"] = flow_info.get("state")
        normalized["flow_reason"] = flow_info.get("reason")
        normalized["flow_pkts_toserver"] = _safe_int(flow_info.get("pkts_toserver"))
        normalized["flow_pkts_toclient"] = _safe_int(flow_info.get("pkts_toclient"))
        normalized["flow_bytes_toserver"] = _safe_int(flow_info.get("bytes_toserver"))
        normalized["flow_bytes_toclient"] = _safe_int(flow_info.get("bytes_toclient"))

    tcp_info = raw_event.get("tcp") or {}
    if tcp_info:
        normalized["tcp_syn"] = tcp_info.get("syn")
        normalized["tcp_ack"] = tcp_info.get("ack")
        normalized["tcp_rst"] = tcp_info.get("rst")
        normalized["tcp_state"] = tcp_info.get("state")
        normalized["tcp_flags"] = tcp_info.get("tcp_flags")
        normalized["tcp_flags_ts"] = tcp_info.get("tcp_flags_ts")
        normalized["tcp_flags_tc"] = tcp_info.get("tcp_flags_tc")

    normalized["summary"] = _build_summary(
        normalized["event_type"],
        normalized["src_ip"],
        normalized["src_port"],
        normalized["dest_ip"],
        normalized["dest_port"],
        normalized["proto"],
        normalized["signature"],
    )
    return normalized, event_dt.strftime("%Y-%m-%d"), event_ms


def _write_to_s3(suricata_event, event_dt):
    """
    Write raw Suricata event to S3 for long-term storage.
    Partitioned by date for efficient Athena queries.
    Path: s3://bucket/year=2026/month=01/day=29/hour=14/event_uuid.json
    """
    if not _s3_enabled or not _s3_bucket:
        return False
    
    try:
        # Partition by date/hour for efficient queries
        s3_key = (
            f"year={event_dt.year}/"
            f"month={event_dt.month:02d}/"
            f"day={event_dt.day:02d}/"
            f"hour={event_dt.hour:02d}/"
            f"{uuid.uuid4().hex}.json"
        )
        
        _s3.put_object(
            Bucket=_s3_bucket,
            Key=s3_key,
            Body=json.dumps(suricata_event),
            ContentType="application/json",
            StorageClass="STANDARD"  # Will transition to GLACIER_IR after 30 days
        )
        return True
    except Exception as e:
        # Don't fail the whole Lambda if S3 write fails
        print(f"S3 write error: {e}")
        return False


def handler(event, context):
    log_events = _decode_logs(event)
    if not log_events:
        return {"statusCode": 200, "records": 0}

    now_ms = int(datetime.datetime.utcnow().timestamp() * 1000)
    items = []
    s3_writes = 0
    s3_total = 0

    # -------------------------------------------------------
    # Cost Optimization: Only alerts go to DynamoDB
    # -------------------------------------------------------
    # DynamoDB charges per write + per GB stored.
    # Suricata generates thousands of flow/stats/dns events
    # but only a fraction are actual alerts (threats).
    #
    # Strategy:
    #   ALL events  → S3 (cheap: ~$0.023/GB/month)
    #   ALERTS ONLY → DynamoDB (fast queries for dashboard)
    #
    # To review all logs, query S3 directly or use Athena.
    # -------------------------------------------------------

    # Event types we consider alerts (written to DynamoDB)
    ALERT_EVENT_TYPES = {"alert", "anomaly", "drop"}

    for log_event in log_events:
        raw_message = log_event.get("message", "")
        cw_timestamp_ms = log_event.get("timestamp", now_ms)

        try:
            suricata_event = json.loads(raw_message)
        except json.JSONDecodeError:
            suricata_event = {"raw_message": raw_message}

        normalized, event_date, event_ms = _normalize_event(suricata_event, cw_timestamp_ms)
        event_time_for_id = datetime.datetime.utcfromtimestamp(event_ms / 1000)
        event_id = f"{event_time_for_id.strftime('%Y%m%dT%H%M%S.%f')}_{uuid.uuid4().hex[:8]}"

        # Write ALL events to S3 (cheap long-term storage)
        s3_total += 1
        if _write_to_s3(suricata_event, event_time_for_id):
            s3_writes += 1

        # Only write ALERTS to DynamoDB (cost optimization)
        event_type = suricata_event.get("event_type", "")
        has_alert_data = suricata_event.get("alert") is not None

        if event_type in ALERT_EVENT_TYPES or has_alert_data:
            item = {
                "event_date": event_date,
                "event_id": event_id,
                "ingest_time": now_ms,
                "suricata": suricata_event,
            }

            for key, value in normalized.items():
                if value is not None:
                    item[key] = value

            items.append(item)

    # Write alerts to DynamoDB
    if items:
        with _table.batch_writer(overwrite_by_pkeys=["event_date", "event_id"]) as batch:
            for item in items:
                batch.put_item(Item=item)

    return {
        "statusCode": 200, 
        "dynamodb_alerts": len(items),
        "s3_total": s3_total,
        "s3_writes": s3_writes,
        "s3_enabled": _s3_enabled
    }

