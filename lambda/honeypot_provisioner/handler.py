"""
PhantomWall Honeypot Provisioner Lambda
=======================================
POST /fleet/deploy   → launch a new honeypot EC2 instance
POST /fleet/destroy  → terminate a honeypot EC2 instance

Supported OS types:
    ubuntu          – Ubuntu 22.04 LTS (default)
    amazon-linux    – Amazon Linux 2023

Architecture:
    Each OS has its own isolated module (ubuntu.py, amazonlinux.py).
    A bug in one OS module cannot crash deploys for other OS types.
    This file is the shared router: validation, guardrails, tagging,
    deploy/destroy logic.  OS-specific AMI lookup and bootstrap
    scripts live in their own files.

Environment variables:
    PROJECT_TAG         – Tag:Project value (default: phantomwall)
    ENVIRONMENT         – dev / staging / prod (default: dev)
    SECURITY_GROUP_ID   – SG to attach to new instances
    INSTANCE_PROFILE    – IAM instance profile name for honeypot role
    SUBNET_ID           – Public subnet to launch into
    SCRIPTS_BUCKET      – S3 bucket with honeypot bootstrap scripts
    MAX_INSTANCES       – Hard cap on total honeypots (default: 5)
    AWS_REGION          – inherited from Lambda runtime
"""

import json
import os
import traceback
from datetime import datetime, timezone

import boto3

# ── Clients ─────────────────────────────────────────────────────
_ec2 = boto3.client("ec2")
_s3 = boto3.client("s3")

# ── Config ──────────────────────────────────────────────────────
PROJECT_TAG = os.environ.get("PROJECT_TAG", "phantomwall")
ENVIRONMENT = os.environ.get("ENVIRONMENT", "dev")
SECURITY_GROUP_ID = os.environ.get("SECURITY_GROUP_ID", "")
INSTANCE_PROFILE = os.environ.get("INSTANCE_PROFILE", "")
SUBNET_ID = os.environ.get("SUBNET_ID", "")
SCRIPTS_BUCKET = os.environ.get("SCRIPTS_BUCKET", "")
MAX_INSTANCES = int(os.environ.get("MAX_INSTANCES", "5"))

# Per-profile security group IDs (set via Terraform env vars)
SG_MAP = {
    "ssh":     os.environ.get("SG_SSH", ""),
    "http":    os.environ.get("SG_HTTP", ""),
    "telnet":  os.environ.get("SG_TELNET", ""),
    "multi":   os.environ.get("SG_MULTI", ""),
    "default": os.environ.get("SG_MULTI", ""),
}

# Allowed instance types (cost guardrail)
ALLOWED_TYPES = {"t3.micro", "t3.small", "t3a.micro", "t3a.small", "t2.micro"}

# ── OS Module Registry ──────────────────────────────────────────
# Each OS module is imported lazily inside _get_os_module() so that
# a syntax / import error in one module does NOT prevent the Lambda
# from loading or other OS types from working.
ALLOWED_OS_TYPES = {"ubuntu", "amazon-linux"}

OS_LABELS = {
    "ubuntu":       "ubuntu",
    "amazon-linux": "al2023",
}

# Trap profiles define which ports the honeypot exposes
TRAP_PROFILES = {
    "ssh":     {"name": "SSH Honeypot",     "ports": "22"},
    "http":    {"name": "HTTP Honeypot",    "ports": "80,443"},
    "telnet":  {"name": "Telnet Honeypot",  "ports": "23"},
    "multi":   {"name": "Multi-Port Trap",  "ports": "22,80,443,23,2222,8080"},
    "default": {"name": "Standard Honeypot","ports": "22,80,443,23,2222,8080"},
}


# ── Helpers ─────────────────────────────────────────────────────
def _response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": json.dumps(body, default=str),
    }


def _count_active_honeypots() -> int:
    """Count running + pending + stopped honeypots tagged with our project."""
    filters = [
        {"Name": "tag:Project", "Values": [PROJECT_TAG]},
        {"Name": "tag:ManagedBy", "Values": ["phantomwall-provisioner", "terraform"]},
        {"Name": "instance-state-name", "Values": ["running", "pending", "stopped", "stopping"]},
    ]
    paginator = _ec2.get_paginator("describe_instances")
    count = 0
    for page in paginator.paginate(Filters=filters):
        for reservation in page["Reservations"]:
            count += len(reservation["Instances"])
    return count


def _get_os_module(os_type: str):
    """Lazily import the correct OS module.

    Each OS module exposes two functions:
        get_latest_ami() -> str
        build_user_data(trap_profile: str) -> str

    Importing inside this function means a broken OS module
    only raises an error for *that* OS — other OS types keep working.
    """
    if os_type == "amazon-linux":
        import amazonlinux as mod
        return mod
    # Default: ubuntu
    import ubuntu as mod
    return mod


# ── Deploy Handler ──────────────────────────────────────────────
def _deploy(body: dict) -> dict:
    """Launch a new honeypot EC2 instance."""

    # Parse request
    instance_type = body.get("instance_type", "t3a.small")
    trap_profile = body.get("trap_profile", "default").lower()
    honeypot_name = body.get("name", "").strip()
    os_type = body.get("os_type", "ubuntu").lower()

    # ── Validation ──────────────────────────────────────────────
    if os_type not in ALLOWED_OS_TYPES:
        return _response(400, {
            "error": f"Unsupported OS type '{os_type}'. Supported: {sorted(ALLOWED_OS_TYPES)}"
        })

    if instance_type not in ALLOWED_TYPES:
        return _response(400, {
            "error": f"Instance type '{instance_type}' not allowed. Allowed: {sorted(ALLOWED_TYPES)}"
        })

    if trap_profile not in TRAP_PROFILES:
        return _response(400, {
            "error": f"Unknown trap profile '{trap_profile}'. Available: {sorted(TRAP_PROFILES.keys())}"
        })

    # ── Guardrail: max instance cap ─────────────────────────────
    current_count = _count_active_honeypots()
    if current_count >= MAX_INSTANCES:
        return _response(429, {
            "error": f"Instance cap reached ({current_count}/{MAX_INSTANCES}). Terminate an existing honeypot first.",
            "current_count": current_count,
            "max_allowed": MAX_INSTANCES,
        })

    # ── Load OS module (isolated import) ────────────────────────
    try:
        os_mod = _get_os_module(os_type)
    except Exception as e:
        return _response(500, {
            "error": f"OS module '{os_type}' failed to load: {e}. Other OS types are unaffected."
        })

    # ── Resolve config ──────────────────────────────────────────
    ami_id = os_mod.get_latest_ami()
    profile_info = TRAP_PROFILES[trap_profile]
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    os_label = OS_LABELS.get(os_type, os_type)

    if not honeypot_name:
        honeypot_name = f"{PROJECT_TAG}-honeypot-{os_label}-{trap_profile}-{timestamp}"

    # ── Launch instance ─────────────────────────────────────────
    run_params = {
        "ImageId": ami_id,
        "InstanceType": instance_type,
        "MinCount": 1,
        "MaxCount": 1,
        "UserData": os_mod.build_user_data(trap_profile),
        "TagSpecifications": [
            {
                "ResourceType": "instance",
                "Tags": [
                    {"Key": "Name", "Value": honeypot_name},
                    {"Key": "Project", "Value": PROJECT_TAG},
                    {"Key": "Env", "Value": ENVIRONMENT},
                    {"Key": "ManagedBy", "Value": "phantomwall-provisioner"},
                    {"Key": "OS", "Value": os_type},
                    {"Key": "TrapType", "Value": trap_profile},
                    {"Key": "TrapPorts", "Value": profile_info["ports"]},
                    {"Key": "LaunchedAt", "Value": timestamp},
                ],
            }
        ],
    }

    # Add optional config (SG, subnet, instance profile)
    # Pick the profile-specific security group, fall back to default SG
    sg_id = SG_MAP.get(trap_profile, "") or SECURITY_GROUP_ID
    if sg_id:
        run_params["SecurityGroupIds"] = [sg_id]
    if SUBNET_ID:
        run_params["SubnetId"] = SUBNET_ID
    if INSTANCE_PROFILE:
        run_params["IamInstanceProfile"] = {"Name": INSTANCE_PROFILE}

    result = _ec2.run_instances(**run_params)
    instance = result["Instances"][0]

    return _response(201, {
        "message": "Honeypot deployed successfully",
        "instance_id": instance["InstanceId"],
        "name": honeypot_name,
        "instance_type": instance_type,
        "os_type": os_type,
        "trap_profile": trap_profile,
        "trap_ports": profile_info["ports"],
        "security_group": sg_id,
        "ami_id": ami_id,
        "state": instance["State"]["Name"],
        "current_count": current_count + 1,
        "max_allowed": MAX_INSTANCES,
    })


# ── Destroy Handler ─────────────────────────────────────────────
def _destroy(body: dict) -> dict:
    """Terminate a honeypot EC2 instance (safety-scoped to project tag)."""

    instance_id = body.get("instance_id", "").strip()
    if not instance_id:
        return _response(400, {"error": "instance_id is required"})

    # Verify instance belongs to our project before terminating
    try:
        desc = _ec2.describe_instances(InstanceIds=[instance_id])
        reservations = desc.get("Reservations", [])
        if not reservations or not reservations[0].get("Instances"):
            return _response(404, {"error": f"Instance {instance_id} not found"})

        instance = reservations[0]["Instances"][0]
        tags = {t["Key"]: t["Value"] for t in instance.get("Tags", [])}

        if tags.get("Project") != PROJECT_TAG:
            return _response(403, {
                "error": f"Instance {instance_id} does not belong to project '{PROJECT_TAG}'. Termination blocked."
            })

    except _ec2.exceptions.ClientError as e:
        if "InvalidInstanceID" in str(e):
            return _response(404, {"error": f"Instance {instance_id} not found"})
        raise

    # Terminate
    _ec2.terminate_instances(InstanceIds=[instance_id])

    return _response(200, {
        "message": "Honeypot termination initiated",
        "instance_id": instance_id,
        "name": tags.get("Name", "unknown"),
    })


# ── Router ──────────────────────────────────────────────────────
def handler(event, context):
    """API Gateway v2 (HTTP API) proxy handler."""
    try:
        method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
        path = event.get("requestContext", {}).get("http", {}).get("path", "")

        # OPTIONS preflight
        if method == "OPTIONS":
            return _response(200, {"message": "OK"})

        # Parse body
        body = {}
        if event.get("body"):
            try:
                body = json.loads(event["body"])
            except json.JSONDecodeError:
                return _response(400, {"error": "Invalid JSON body"})

        # Route
        if method == "POST" and "/fleet/deploy" in path:
            return _deploy(body)
        elif method == "POST" and "/fleet/destroy" in path:
            return _destroy(body)
        else:
            return _response(404, {"error": f"Unknown route: {method} {path}"})

    except Exception as e:
        traceback.print_exc()
        return _response(500, {"error": str(e)})
