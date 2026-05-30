import os
from datetime import datetime, timedelta, timezone

import boto3

_ec2 = boto3.client("ec2")
_logs = boto3.client("logs")

PROJECT_TAG = os.environ.get("PROJECT_TAG", "phantomwall")
ENVIRONMENT = os.environ.get("ENVIRONMENT", "dev")
CW_LOG_GROUP_PREFIX = os.environ.get("CW_LOG_GROUP_PREFIX", "/honeypot/suricata")
SPOT_TTL_HOURS = int(os.environ.get("SPOT_TTL_HOURS", "24"))


def _utc_now():
    return datetime.now(timezone.utc)


def _log_group_for_instance(instance_id: str) -> str:
    return f"{CW_LOG_GROUP_PREFIX}/{instance_id}"


def _cleanup_log_group(instance_id: str) -> dict:
    log_group_name = _log_group_for_instance(instance_id)
    removed_filters = []
    deleted_group = False

    try:
        resp = _logs.describe_subscription_filters(logGroupName=log_group_name)
        for f in resp.get("subscriptionFilters", []):
            name = f.get("filterName")
            if not name:
                continue
            try:
                _logs.delete_subscription_filter(logGroupName=log_group_name, filterName=name)
                removed_filters.append(name)
            except _logs.exceptions.ResourceNotFoundException:
                pass
    except _logs.exceptions.ResourceNotFoundException:
        return {"log_group": log_group_name, "filters_deleted": removed_filters, "log_group_deleted": False}

    try:
        _logs.delete_log_group(logGroupName=log_group_name)
        deleted_group = True
    except _logs.exceptions.ResourceNotFoundException:
        pass

    return {"log_group": log_group_name, "filters_deleted": removed_filters, "log_group_deleted": deleted_group}


def _is_expired_spot(instance: dict, cutoff: datetime) -> bool:
    if instance.get("InstanceLifecycle") != "spot":
        return False

    launch_time = instance.get("LaunchTime")
    if not launch_time:
        return False

    if launch_time.tzinfo is None:
        launch_time = launch_time.replace(tzinfo=timezone.utc)

    return launch_time <= cutoff


def handler(event, context):
    cutoff = _utc_now() - timedelta(hours=SPOT_TTL_HOURS)
    filters = [
        {"Name": "tag:Project", "Values": [PROJECT_TAG]},
        {"Name": "tag:Env", "Values": [ENVIRONMENT]},
        {"Name": "tag:ManagedBy", "Values": ["phantomwall-provisioner"]},
        {"Name": "instance-state-name", "Values": ["pending", "running", "stopping", "stopped"]},
    ]

    terminated = []
    paginator = _ec2.get_paginator("describe_instances")
    for page in paginator.paginate(Filters=filters):
        for reservation in page.get("Reservations", []):
            for instance in reservation.get("Instances", []):
                if not _is_expired_spot(instance, cutoff):
                    continue

                instance_id = instance["InstanceId"]
                _ec2.terminate_instances(InstanceIds=[instance_id])
                cleanup = _cleanup_log_group(instance_id)
                terminated.append(
                    {
                        "instance_id": instance_id,
                        "launched_at": str(instance.get("LaunchTime")),
                        "terminated_at": _utc_now().isoformat(),
                        "cleanup": cleanup,
                    }
                )

    return {
        "statusCode": 200,
        "body": {
            "project": PROJECT_TAG,
            "environment": ENVIRONMENT,
            "ttl_hours": SPOT_TTL_HOURS,
            "terminated_count": len(terminated),
            "terminated_instances": terminated,
        },
    }
