"""
================================================================================
PhantomWall S3 Log Query Lambda
================================================================================
Purpose: Queries ALL Suricata logs stored in S3 via Athena.
         Separate from DynamoDB alerts - this is for full log exploration.

API Endpoint: GET /logs

Query Parameters:
  - date       (required)  Date to query: YYYY-MM-DD
  - event_type (optional)  Filter: alert, flow, dns, http, tls, etc.
  - src_ip     (optional)  Filter by source IP
  - dest_ip    (optional)  Filter by destination IP
  - proto      (optional)  Filter by protocol: TCP, UDP, ICMP
  - limit      (optional)  Max results (default: 100, max: 500)

Cost: Athena charges ~$5/TB scanned. Partition pruning keeps costs minimal.
================================================================================
"""

import datetime
import json
import os
import time

import boto3

_athena = boto3.client("athena")

DATABASE = os.environ["ATHENA_DATABASE"]
TABLE = os.environ["ATHENA_TABLE"]
WORKGROUP = os.environ["ATHENA_WORKGROUP"]
RESULTS_BUCKET = os.environ["RESULTS_BUCKET"]


def _response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body),
    }


def _build_query(params):
    """Build an Athena SQL query with partition pruning and optional filters."""
    date_str = params.get("date")
    if not date_str:
        date_str = datetime.datetime.utcnow().strftime("%Y-%m-%d")

    # Validate date format
    try:
        dt = datetime.datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return None, "Invalid date format. Use YYYY-MM-DD"

    limit = min(int(params.get("limit", "100")), 500)

    # Partition pruning - only scan the specific date partition
    where_clauses = [
        f"year = '{dt.year}'",
        f"month = '{dt.month:02d}'",
        f"day = '{dt.day:02d}'",
    ]

    # Optional hour filter
    hour = params.get("hour")
    if hour:
        where_clauses.append(f"hour = '{int(hour):02d}'")

    # Optional filters
    event_type = params.get("event_type")
    if event_type:
        where_clauses.append(f"event_type = '{_sanitize(event_type)}'")

    src_ip = params.get("src_ip")
    if src_ip:
        where_clauses.append(f"src_ip = '{_sanitize(src_ip)}'")

    dest_ip = params.get("dest_ip")
    if dest_ip:
        where_clauses.append(f"dest_ip = '{_sanitize(dest_ip)}'")

    proto = params.get("proto")
    if proto:
        where_clauses.append(f"proto = '{_sanitize(proto.upper())}'")

    dest_port = params.get("dest_port")
    if dest_port:
        where_clauses.append(f"dest_port = {int(dest_port)}")

    where_sql = " AND ".join(where_clauses)

    query = f"""
        SELECT timestamp, event_type, src_ip, src_port, dest_ip, dest_port,
               proto, flow_id, app_proto,
               alert.signature as alert_signature,
               alert.severity as alert_severity,
               alert.category as alert_category
        FROM "{DATABASE}"."{TABLE}"
        WHERE {where_sql}
        ORDER BY timestamp DESC
        LIMIT {limit}
    """

    return query, None


def _sanitize(value):
    """Basic SQL injection prevention for string values."""
    if not isinstance(value, str):
        return ""
    # Remove quotes, semicolons, and other dangerous characters
    return value.replace("'", "").replace('"', "").replace(";", "").replace("--", "").strip()


def _run_athena_query(query):
    """Execute Athena query and wait for results."""
    response = _athena.start_query_execution(
        QueryString=query,
        WorkGroup=WORKGROUP,
    )

    query_id = response["QueryExecutionId"]

    # Poll for query completion (max 30 seconds)
    for _ in range(30):
        status = _athena.get_query_execution(QueryExecutionId=query_id)
        state = status["QueryExecution"]["Status"]["State"]

        if state == "SUCCEEDED":
            break
        elif state in ("FAILED", "CANCELLED"):
            reason = status["QueryExecution"]["Status"].get("StateChangeReason", "Unknown error")
            return None, f"Query {state}: {reason}"

        time.sleep(1)
    else:
        # Timed out - cancel the query
        _athena.stop_query_execution(QueryExecutionId=query_id)
        return None, "Query timed out after 30 seconds"

    # Get results
    results = _athena.get_query_results(QueryExecutionId=query_id)
    rows = results["ResultSet"]["Rows"]

    if len(rows) < 2:
        return {"items": [], "count": 0, "data_scanned_bytes": 0, "data_scanned_mb": 0}, None

    # First row is headers
    headers = [col.get("VarCharValue", "") for col in rows[0]["Data"]]

    # Convert remaining rows to dicts
    items = []
    for row in rows[1:]:
        item = {}
        for i, col in enumerate(row["Data"]):
            value = col.get("VarCharValue")
            if value is not None and headers[i]:
                item[headers[i]] = value
        items.append(item)

    # Get data scanned for cost tracking
    data_scanned = status["QueryExecution"]["Statistics"].get("DataScannedInBytes", 0)

    return {
        "items": items,
        "count": len(items),
        "data_scanned_bytes": data_scanned,
        "data_scanned_mb": round(data_scanned / (1024 * 1024), 2),
    }, None


def _get_event_type_summary(params):
    """Get a summary of event types for a given date (for the filter dropdown)."""
    date_str = params.get("date")
    if not date_str:
        date_str = datetime.datetime.utcnow().strftime("%Y-%m-%d")

    try:
        dt = datetime.datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return None, "Invalid date format"

    query = f"""
        SELECT event_type, COUNT(*) as event_count
        FROM "{DATABASE}"."{TABLE}"
        WHERE year = '{dt.year}' AND month = '{dt.month:02d}' AND day = '{dt.day:02d}'
        GROUP BY event_type
        ORDER BY event_count DESC
    """

    return _run_athena_query(query)


def _repair_partitions():
    """Run MSCK REPAIR TABLE to discover new S3 partitions."""
    try:
        repair_query = f'MSCK REPAIR TABLE "{DATABASE}"."{TABLE}"'
        resp = _athena.start_query_execution(
            QueryString=repair_query,
            WorkGroup=WORKGROUP,
        )
        # Wait up to 10 seconds for repair
        qid = resp["QueryExecutionId"]
        for _ in range(10):
            status = _athena.get_query_execution(QueryExecutionId=qid)
            state = status["QueryExecution"]["Status"]["State"]
            if state in ("SUCCEEDED", "FAILED", "CANCELLED"):
                break
            time.sleep(1)
        print(f"Partition repair: {state}")
    except Exception as e:
        print(f"Partition repair warning: {e}")


def handler(event, context):
    params = (event or {}).get("queryStringParameters") or {}
    raw_path = (event or {}).get("rawPath") or ""

    try:
        # Always repair partitions so new data is discoverable
        _repair_partitions()

        # Route: GET /logs?action=summary → event type breakdown
        if params.get("action") == "summary":
            result, error = _get_event_type_summary(params)
            if error:
                return _response(400, {"error": error})
            return _response(200, result)

        # Route: GET /logs?date=2026-02-12 → query logs
        query, error = _build_query(params)
        if error:
            return _response(400, {"error": error})

        result, error = _run_athena_query(query)
        if error:
            return _response(500, {"error": error})

        return _response(200, {
            "date": params.get("date", datetime.datetime.utcnow().strftime("%Y-%m-%d")),
            "filters": {
                "event_type": params.get("event_type"),
                "src_ip": params.get("src_ip"),
                "dest_ip": params.get("dest_ip"),
                "proto": params.get("proto"),
            },
            **result,
        })

    except Exception as e:
        print(f"Error: {e}")
        return _response(500, {"error": str(e)})
