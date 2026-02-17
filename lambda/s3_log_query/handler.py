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
import re
import time
import urllib.request

import boto3

_athena = boto3.client("athena")
_glue = boto3.client("glue")
_s3 = boto3.client("s3")

DATABASE = os.environ["ATHENA_DATABASE"]
TABLE = os.environ["ATHENA_TABLE"]
WORKGROUP = os.environ["ATHENA_WORKGROUP"]
RESULTS_BUCKET = os.environ["RESULTS_BUCKET"]
S3_BUCKET = os.environ.get("S3_BUCKET", "")

# ── GeoIP Cache (in-memory, per Lambda container) ──
_geo_cache = {}


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
    """Register S3 partitions in Glue using the Glue API.

    Athena Engine v3 (Trino) does NOT support MSCK REPAIR TABLE.
    Instead, list S3 prefixes and call Glue batch_create_partition.
    """
    if not S3_BUCKET:
        print("Partition repair skipped: S3_BUCKET not set")
        return

    try:
        # Get existing partitions from Glue
        existing = set()
        paginator = _glue.get_paginator("get_partitions")
        for page in paginator.paginate(DatabaseName=DATABASE, TableName=TABLE):
            for p in page.get("Partitions", []):
                existing.add(tuple(p["Values"]))

        # Get table storage descriptor (needed for creating partitions)
        table_info = _glue.get_table(DatabaseName=DATABASE, Name=TABLE)
        sd = table_info["Table"]["StorageDescriptor"]

        # Discover S3 partition prefixes: year=YYYY/month=MM/day=DD/hour=HH/
        partition_pattern = re.compile(
            r"year=(\d{4})/month=(\d{2})/day=(\d{2})/hour=(\d{2})/"
        )

        new_partitions = []
        # List year prefixes
        years_resp = _s3.list_objects_v2(
            Bucket=S3_BUCKET, Prefix="year=", Delimiter="/"
        )
        for year_prefix in [p["Prefix"] for p in years_resp.get("CommonPrefixes", [])]:
            months_resp = _s3.list_objects_v2(
                Bucket=S3_BUCKET, Prefix=year_prefix, Delimiter="/"
            )
            for month_prefix in [p["Prefix"] for p in months_resp.get("CommonPrefixes", [])]:
                days_resp = _s3.list_objects_v2(
                    Bucket=S3_BUCKET, Prefix=month_prefix, Delimiter="/"
                )
                for day_prefix in [p["Prefix"] for p in days_resp.get("CommonPrefixes", [])]:
                    hours_resp = _s3.list_objects_v2(
                        Bucket=S3_BUCKET, Prefix=day_prefix, Delimiter="/"
                    )
                    for hour_prefix in [p["Prefix"] for p in hours_resp.get("CommonPrefixes", [])]:
                        m = partition_pattern.match(hour_prefix)
                        if not m:
                            continue
                        values = (m.group(1), m.group(2), m.group(3), m.group(4))
                        if values not in existing:
                            new_partitions.append({
                                "Values": list(values),
                                "StorageDescriptor": {
                                    **sd,
                                    "Location": f"s3://{S3_BUCKET}/{hour_prefix}",
                                },
                            })

        if not new_partitions:
            print(f"Partition repair: 0 new (already {len(existing)} registered)")
            return

        # Glue allows max 100 partitions per batch
        for i in range(0, len(new_partitions), 100):
            batch = new_partitions[i : i + 100]
            resp = _glue.batch_create_partition(
                DatabaseName=DATABASE,
                TableName=TABLE,
                PartitionInputList=batch,
            )
            errors = resp.get("Errors", [])
            if errors:
                print(f"Partition batch errors: {errors}")

        print(f"Partition repair: {len(new_partitions)} new partitions registered")

    except Exception as e:
        print(f"Partition repair warning: {e}")


# ── GeoIP Enrichment ──
def _is_private_ip(ip):
    """Check if an IP is private/reserved."""
    if not ip:
        return True
    parts = ip.split(".")
    if len(parts) != 4:
        return True
    try:
        first, second = int(parts[0]), int(parts[1])
    except ValueError:
        return True
    if first == 10:
        return True
    if first == 172 and 16 <= second <= 31:
        return True
    if first == 192 and second == 168:
        return True
    if first == 127:
        return True
    return False


def _enrich_geo(ip):
    """Look up country info for an IP using ip-api.com (free, no key).

    Returns dict with country_name, country_code, flag or empty dict.
    """
    if not ip or _is_private_ip(ip):
        return {}

    if ip in _geo_cache:
        return _geo_cache[ip]

    try:
        url = f"http://ip-api.com/json/{ip}?fields=status,country,countryCode"
        req = urllib.request.Request(url, headers={"User-Agent": "PhantomWall/1.0"})
        with urllib.request.urlopen(req, timeout=2) as resp:
            data = json.loads(resp.read().decode())

        if data.get("status") == "success":
            cc = data.get("countryCode", "")
            result = {
                "country_name": data.get("country", "Unknown"),
                "country_code": cc,
                "flag": _country_flag(cc),
            }
        else:
            result = {}
    except Exception:
        result = {}

    _geo_cache[ip] = result
    return result


def _country_flag(cc):
    """Convert 2-letter country code to flag emoji."""
    if not cc or len(cc) != 2:
        return ""
    return chr(0x1F1E6 + ord(cc[0].upper()) - ord("A")) + chr(
        0x1F1E6 + ord(cc[1].upper()) - ord("A")
    )


def _enrich_results_with_geo(items):
    """Add country info to each log item based on src_ip."""
    for item in items:
        src_ip = item.get("src_ip", "")
        geo = _enrich_geo(src_ip)
        if geo:
            item["country_name"] = geo.get("country_name", "")
            item["country_code"] = geo.get("country_code", "")
            item["flag"] = geo.get("flag", "")
        else:
            item["country_name"] = "Private" if _is_private_ip(src_ip) else "Unknown"
            item["country_code"] = ""
            item["flag"] = ""
    return items


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

        # Enrich results with GeoIP country data
        if result and result.get("items"):
            result["items"] = _enrich_results_with_geo(result["items"])

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
