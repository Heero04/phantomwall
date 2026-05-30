"""
PhantomWall Fleet Manager Lambda
================================
GET  /fleet/instances   → list EC2 honeypot instances with SSM + CloudWatch metrics
POST /fleet/action      → start / stop / reboot an instance (EC2 API or SSM)

Environment variables:
    PROJECT_TAG   – Tag:Project value used to filter EC2 instances (default: phantomwall)
    AWS_REGION    – inherited from Lambda runtime
"""

import datetime
import json
import os
import traceback

import boto3

# ── Clients (created once per warm Lambda) ──────────────────────
_ec2 = boto3.client("ec2")
_ssm = boto3.client("ssm")
_cw = boto3.client("cloudwatch")
_logs = boto3.client("logs")
_dynamodb = boto3.client("dynamodb")

PROJECT_TAG = os.environ.get("PROJECT_TAG", "phantomwall")
CW_LOG_GROUP_PREFIX = os.environ.get("CW_LOG_GROUP_PREFIX", "/honeypot/suricata")
EVENTS_TABLE = os.environ.get("EVENTS_TABLE", "phantomwall-dynamodb-events-dev")
ALERTS_TABLE = os.environ.get("ALERTS_TABLE", "phantomwall-alerts-dev")


# ── Helpers ─────────────────────────────────────────────────────
def _response(status_code: int, body: dict | list) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body, default=str),
    }


def _infer_trap_type(instance: dict) -> str:
    """Infer the trap type from Name tag or security-group ports."""
    name = ""
    for tag in instance.get("Tags", []):
        if tag["Key"] == "Name":
            name = tag["Value"].lower()
            break

    # Check Name tag keywords
    if "ssh" in name:
        return "SSH"
    if "http" in name or "web" in name:
        return "HTTP"
    if "telnet" in name:
        return "Telnet"
    if "rdp" in name:
        return "RDP"
    if "dns" in name:
        return "DNS"
    if "ftp" in name:
        return "FTP"

    # Check TrapType tag explicitly
    for tag in instance.get("Tags", []):
        if tag["Key"].lower() == "traptype":
            return tag["Value"]

    return "SSH"  # sensible default for honeypots


def _ec2_state_to_status(state_name: str) -> str:
    """Normalise EC2 state to the fleet UI status vocabulary."""
    mapping = {
        "running": "running",
        "stopped": "stopped",
        "terminated": "terminated",
        "pending": "pending",
        "shutting-down": "stopping",
        "stopping": "stopping",
    }
    return mapping.get(state_name, state_name)


def _get_last_seen(instance: dict, status: str, now) -> str:
    """Return an ISO 8601 timestamp the frontend's ago() helper can parse."""
    if status == "running":
        lt = instance.get("LaunchTime")
        if lt:
            return lt.isoformat() if hasattr(lt, "isoformat") else str(lt)
        return now.isoformat() + "Z"

    # For stopped instances, try parsing the embedded date from StateTransitionReason
    # e.g. "User initiated (2026-02-22 14:00:00 GMT)"
    reason = instance.get("StateTransitionReason", "")
    if "(" in reason and ")" in reason:
        try:
            date_str = reason.split("(")[1].split(")")[0].replace(" GMT", "")
            parsed = datetime.datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
            return parsed.isoformat() + "Z"
        except Exception:
            pass

    return now.isoformat() + "Z"


# ── Data Flow Health Check ──────────────────────────────────────
def _check_data_flow(instance_id: str) -> dict:
    """Check the per-instance data pipeline: log group → streams → filters.

    Returns a dict with boolean/int checks the frontend renders as checkmarks.
    Pipeline: CW Agent → Log Group → Log Stream → Subscription Filters → Lambdas
    If streams have data AND subscription filters exist, data flows to DynamoDB + S3.
    Best-effort: any AWS error degrades gracefully rather than crashing.
    """
    result = {
        "log_group": False,
        "log_stream": False,
        "log_stream_age": None,       # human-readable age of last data
        "subscription_filters": 0,
        "events_pipeline": False,      # ingest Lambda subscription exists
        "alerts_pipeline": False,      # alert-indexer subscription exists
    }
    log_group_name = f"{CW_LOG_GROUP_PREFIX}/{instance_id}"

    # 1. Log group exists?
    try:
        resp = _logs.describe_log_groups(
            logGroupNamePrefix=log_group_name, limit=1
        )
        groups = resp.get("logGroups", [])
        result["log_group"] = any(
            g["logGroupName"] == log_group_name for g in groups
        )
    except Exception as exc:
        print(f"[data_flow] log_group check failed for {log_group_name}: {exc}")

    if not result["log_group"]:
        return result

    # 2. Log streams with recent data?
    try:
        resp = _logs.describe_log_streams(
            logGroupName=log_group_name,
            orderBy="LastEventTime",
            descending=True,
            limit=1,
        )
        streams = resp.get("logStreams", [])
        if streams:
            last_ts = streams[0].get("lastEventTimestamp", 0)
            now_ms = int(datetime.datetime.utcnow().timestamp() * 1000)
            age_sec = (now_ms - last_ts) / 1000
            result["log_stream"] = age_sec < 1800  # 30 min
            # Human-readable age
            if age_sec < 60:
                result["log_stream_age"] = f"{int(age_sec)}s ago"
            elif age_sec < 3600:
                result["log_stream_age"] = f"{int(age_sec / 60)}m ago"
            elif age_sec < 86400:
                result["log_stream_age"] = f"{int(age_sec / 3600)}h ago"
            else:
                result["log_stream_age"] = f"{int(age_sec / 86400)}d ago"
    except Exception as exc:
        print(f"[data_flow] log_stream check failed: {exc}")

    # 3. Subscription filters — check each one by name
    try:
        resp = _logs.describe_subscription_filters(
            logGroupName=log_group_name
        )
        filters = resp.get("subscriptionFilters", [])
        result["subscription_filters"] = len(filters)
        for f in filters:
            dest = f.get("destinationArn", "")
            if "ingest" in dest.lower():
                result["events_pipeline"] = True
            if "alert" in dest.lower():
                result["alerts_pipeline"] = True
    except Exception as exc:
        print(f"[data_flow] subscription_filters check failed: {exc}")

    return result


# ── GET /fleet/instances ────────────────────────────────────────
def _list_fleet(params: dict) -> dict:
    region = params.get("region", os.environ.get("AWS_REGION", "us-east-1"))
    trap_filter = params.get("trap_type", "").lower()

    # 1. Describe EC2 instances tagged with Project = phantomwall
    filters = [
        {"Name": "tag:Project", "Values": [PROJECT_TAG]},
        {
            "Name": "instance-state-name",
            "Values": ["running", "stopped", "pending", "stopping"],
        },
    ]

    paginator = _ec2.get_paginator("describe_instances")
    instances_raw = []
    for page in paginator.paginate(Filters=filters):
        for reservation in page["Reservations"]:
            instances_raw.extend(reservation["Instances"])

    # 2. Batch-lookup SSM agent status
    instance_ids = [i["InstanceId"] for i in instances_raw]
    ssm_status = {}
    if instance_ids:
        try:
            # SSM can only handle 50 at a time
            for i in range(0, len(instance_ids), 50):
                chunk = instance_ids[i : i + 50]
                ssm_resp = _ssm.describe_instance_information(
                    Filters=[{"Key": "InstanceIds", "Values": chunk}]
                )
                for info in ssm_resp.get("InstanceInformationList", []):
                    ssm_status[info["InstanceId"]] = info.get("PingStatus", "Inactive")
        except Exception:
            pass  # SSM permissions may not exist yet; degrade gracefully

    # 3. Batch-lookup CloudWatch CPU for running instances
    running_ids = [
        i["InstanceId"]
        for i in instances_raw
        if i["State"]["Name"] == "running"
    ]

    cpu_map: dict[str, float] = {}
    ram_map: dict[str, float] = {}
    now = datetime.datetime.utcnow()

    if running_ids:
        try:
            # Build metric queries for CPU
            cpu_queries = []
            for idx, iid in enumerate(running_ids[:25]):  # CW limit ≈ 500 metrics
                cpu_queries.append(
                    {
                        "Id": f"cpu{idx}",
                        "MetricStat": {
                            "Metric": {
                                "Namespace": "AWS/EC2",
                                "MetricName": "CPUUtilization",
                                "Dimensions": [
                                    {"Name": "InstanceId", "Value": iid}
                                ],
                            },
                            "Period": 300,
                            "Stat": "Average",
                        },
                        "ReturnData": True,
                    }
                )

            if cpu_queries:
                cw_resp = _cw.get_metric_data(
                    MetricDataQueries=cpu_queries,
                    StartTime=now - datetime.timedelta(minutes=10),
                    EndTime=now,
                )
                for result in cw_resp.get("MetricDataResults", []):
                    idx = int(result["Id"].replace("cpu", ""))
                    iid = running_ids[idx]
                    values = result.get("Values", [])
                    cpu_map[iid] = round(values[0], 1) if values else 0

            # Memory is only available with CW Agent (custom namespace)
            # Try fetching from CWAgent namespace
            mem_queries = []
            for idx, iid in enumerate(running_ids[:25]):
                mem_queries.append(
                    {
                        "Id": f"mem{idx}",
                        "MetricStat": {
                            "Metric": {
                                "Namespace": "CWAgent",
                                "MetricName": "mem_used_percent",
                                "Dimensions": [
                                    {"Name": "InstanceId", "Value": iid}
                                ],
                            },
                            "Period": 300,
                            "Stat": "Average",
                        },
                        "ReturnData": True,
                    }
                )

            if mem_queries:
                mem_resp = _cw.get_metric_data(
                    MetricDataQueries=mem_queries,
                    StartTime=now - datetime.timedelta(minutes=10),
                    EndTime=now,
                )
                for result in mem_resp.get("MetricDataResults", []):
                    idx = int(result["Id"].replace("mem", ""))
                    iid = running_ids[idx]
                    values = result.get("Values", [])
                    ram_map[iid] = round(values[0], 1) if values else 0

        except Exception:
            pass  # CloudWatch may lag or lack data for new instances

    # 4. Build EC2 status checks map
    health_map: dict[str, dict] = {}
    if running_ids:
        try:
            status_resp = _ec2.describe_instance_status(InstanceIds=running_ids)
            for s in status_resp.get("InstanceStatuses", []):
                iid = s["InstanceId"]
                sys_status = s.get("SystemStatus", {}).get("Status", "initializing")
                inst_status = s.get("InstanceStatus", {}).get("Status", "initializing")
                health_map[iid] = {
                    "system": "ok" if sys_status == "ok" else sys_status,
                    "instance": "ok" if inst_status == "ok" else inst_status,
                }
        except Exception:
            pass

    # 5. Map to UI model
    items = []
    for inst in instances_raw:
        iid = inst["InstanceId"]
        name = ""
        os_type = ""
        for tag in inst.get("Tags", []):
            if tag["Key"] == "Name":
                name = tag["Value"]
            elif tag["Key"] == "OS":
                os_type = tag["Value"]

        trap_type = _infer_trap_type(inst)

        # Apply trap_type filter if requested
        if trap_filter and trap_type.lower() != trap_filter:
            continue

        status = _ec2_state_to_status(inst["State"]["Name"])
        az = inst.get("Placement", {}).get("AvailabilityZone", "")

        ssm_ping = ssm_status.get(iid, "Inactive")
        is_ssm_online = ssm_ping == "Online"

        health = health_map.get(iid, {"system": "n/a", "instance": "n/a"})
        if status not in ("running",):
            health = {"system": "n/a", "instance": "n/a"}

        items.append(
            {
                "instance_id": iid,
                "name": name or iid,
                "trap_type": trap_type,
                "instance_type": inst.get("InstanceType", ""),
                "market_type": "spot" if inst.get("InstanceLifecycle") == "spot" else "on-demand",
                "os_type": os_type or "unknown",
                "az": az,
                "status": status,
                "region": region,
                "last_seen": _get_last_seen(inst, status, now),
                "public_ip": inst.get("PublicIpAddress"),
                "private_ip": inst.get("PrivateIpAddress"),
                "health_checks": health,
                "ssm_connected": is_ssm_online,
                "cpu": cpu_map.get(iid, 0),
                "ram": ram_map.get(iid, 0),
                "data_flow": _check_data_flow(iid) if status == "running" else None,
            }
        )

    return _response(
        200,
        {
            "region": region,
            "count": len(items),
            "items": items,
            "generated_at": now.isoformat() + "Z",
        },
    )


# ── POST /fleet/action ─────────────────────────────────────────
def _run_action(body: dict) -> dict:
    instance_id = body.get("instance_id")
    action = body.get("action", "").lower()
    mode = body.get("mode", "ec2").lower()  # 'ec2' or 'ssm'

    if not instance_id:
        return _response(400, {"error": "instance_id is required"})
    if action not in ("start", "stop", "reboot"):
        return _response(400, {"error": f"Invalid action: {action}"})

    try:
        if mode == "ssm" and action == "reboot":
            # Graceful reboot via SSM
            _ssm.send_command(
                InstanceIds=[instance_id],
                DocumentName="AWS-RunShellScript",
                Parameters={"commands": ["sudo reboot"]},
                Comment=f"PhantomWall fleet reboot via SSM",
            )
            message = f"SSM reboot command sent to {instance_id}"
        elif action == "start":
            _ec2.start_instances(InstanceIds=[instance_id])
            message = f"Start signal sent to {instance_id}"
        elif action == "stop":
            _ec2.stop_instances(InstanceIds=[instance_id])
            message = f"Stop signal sent to {instance_id}"
        elif action == "reboot":
            _ec2.reboot_instances(InstanceIds=[instance_id])
            message = f"Reboot signal sent to {instance_id}"
        else:
            return _response(400, {"error": "Unsupported action/mode combination"})

        return _response(200, {"message": message, "instance_id": instance_id, "action": action})

    except Exception as exc:
        return _response(500, {"error": str(exc)})


# ── Entrypoint ──────────────────────────────────────────────────
def handler(event, context):
    try:
        request_context = (event or {}).get("requestContext") or {}
        route_key = request_context.get("routeKey") or ""
        raw_path = (event or {}).get("rawPath") or ""
        method = request_context.get("http", {}).get("method", "GET")

        # POST /fleet/action
        if method == "POST" or route_key.startswith("POST"):
            body = event.get("body", "{}")
            if isinstance(body, str):
                body = json.loads(body)
            return _run_action(body)

        # GET /fleet/instances (default)
        params = (event or {}).get("queryStringParameters") or {}
        return _list_fleet(params)

    except Exception as exc:
        traceback.print_exc()
        return _response(500, {"error": str(exc)})
