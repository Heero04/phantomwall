"""
PhantomWall WAF API Lambda Handler
===================================
Endpoints:
  GET  /waf/status       → current WAF rule states + blocked IP count
  POST /waf/toggle-rule  → enable/disable a specific WAF rule
  POST /waf/lockdown     → toggle lockdown mode (block all except allowlist)
  GET  /waf/blocked-ips  → list IPs in the blocklist IP set
  POST /waf/block-ip     → manually add an IP to the blocklist
  POST /waf/unblock-ip   → remove an IP from the blocklist
"""

import json
import os
import logging

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

_wafv2 = boto3.client("wafv2")

WEB_ACL_NAME = os.environ.get("WAF_WEB_ACL_NAME", "")
WEB_ACL_ID = os.environ.get("WAF_WEB_ACL_ID", "")
BLOCKLIST_NAME = os.environ.get("WAF_BLOCKLIST_NAME", "")
BLOCKLIST_ID = os.environ.get("WAF_BLOCKLIST_ID", "")
ALLOWLIST_NAME = os.environ.get("WAF_ALLOWLIST_NAME", "")
ALLOWLIST_ID = os.environ.get("WAF_ALLOWLIST_ID", "")
SCOPE = "REGIONAL"


def _response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body),
    }


def _get_web_acl():
    """Fetch current Web ACL config including lock token."""
    resp = _wafv2.get_web_acl(Name=WEB_ACL_NAME, Scope=SCOPE, Id=WEB_ACL_ID)
    return resp["WebACL"], resp["LockToken"]


def _get_ip_set(name, ip_set_id):
    """Fetch an IP set and its lock token."""
    resp = _wafv2.get_ip_set(Name=name, Scope=SCOPE, Id=ip_set_id)
    return resp["IPSet"], resp["LockToken"]


def _rule_active(web_acl, rule_name):
    """Check if a rule with given name exists and is active (not count-only)."""
    for rule in web_acl.get("Rules", []):
        if rule["Name"] == rule_name:
            # Managed rules use override_action; custom rules use action
            override = rule.get("OverrideAction", {})
            action = rule.get("Action", {})
            # AWS returns "Count" (capital C) — check case-insensitively
            override_keys = {k.lower() for k in override}
            action_keys = {k.lower() for k in action}
            if "count" in override_keys or "count" in action_keys:
                return False
            return True
    return False


# ── GET /waf/status ─────────────────────────────────────────────

def _handle_status():
    """Return current WAF state: rule statuses + blocked IP count."""
    web_acl, _ = _get_web_acl()
    blocklist_set, _ = _get_ip_set(BLOCKLIST_NAME, BLOCKLIST_ID)

    blocked_count = len(blocklist_set.get("Addresses", []))

    # Check each rule
    rules = {
        "rate_limiting": _rule_active(web_acl, "RateLimiting"),
        "sql_injection": _rule_active(web_acl, "AWSManagedSQLi"),
        "xss_protection": _rule_active(web_acl, "AWSManagedCommonRules"),
        "known_bad_inputs": _rule_active(web_acl, "AWSManagedKnownBadInputs"),
        "geo_blocking": _rule_active(web_acl, "GeoBlocking"),
        "bot_detection": _rule_active(web_acl, "BotControl"),
        "blocklist": _rule_active(web_acl, "BlocklistedIPs"),
    }

    # Lockdown = check if default action is Block
    lockdown = "block" in web_acl.get("DefaultAction", {})

    return _response(200, {
        "waf_enabled": True,
        "lockdown_active": lockdown,
        "blocked_ips_count": blocked_count,
        "rules": rules,
        "web_acl_id": WEB_ACL_ID,
    })


# ── POST /waf/toggle-rule ──────────────────────────────────────

def _handle_toggle_rule(body):
    """Toggle a managed rule between active (none override) and count-only."""
    rule_name = body.get("rule_name")
    enabled = body.get("enabled", True)

    if not rule_name:
        return _response(400, {"error": "rule_name is required"})

    # Map frontend names to WAF rule names
    rule_map = {
        "rate_limiting": "RateLimiting",
        "sql_injection": "AWSManagedSQLi",
        "xss_protection": "AWSManagedCommonRules",
        "geo_blocking": "GeoBlocking",
        "bot_detection": "BotControl",
    }

    waf_rule_name = rule_map.get(rule_name, rule_name)
    web_acl, lock_token = _get_web_acl()

    rules = web_acl.get("Rules", [])
    found = False
    for rule in rules:
        if rule["Name"] == waf_rule_name:
            found = True
            # Managed rules (override_action) vs custom rules (action)
            if "OverrideAction" in rule:
                rule["OverrideAction"] = {} if enabled else {"Count": {}}
                if enabled:
                    rule["OverrideAction"]["None"] = {}
                else:
                    rule["OverrideAction"] = {"Count": {}}
            elif "Action" in rule:
                if enabled:
                    rule["Action"] = {"Block": {}}
                else:
                    rule["Action"] = {"Count": {}}
            break

    if not found:
        return _response(404, {"error": f"Rule '{waf_rule_name}' not found in Web ACL"})

    _wafv2.update_web_acl(
        Name=WEB_ACL_NAME,
        Scope=SCOPE,
        Id=WEB_ACL_ID,
        DefaultAction=web_acl["DefaultAction"],
        Rules=rules,
        VisibilityConfig=web_acl["VisibilityConfig"],
        LockToken=lock_token,
    )

    logger.info(f"Rule {waf_rule_name} set to {'ACTIVE' if enabled else 'COUNT'}")
    return _response(200, {
        "rule": waf_rule_name,
        "enabled": enabled,
        "message": f"Rule {'enabled' if enabled else 'disabled'} successfully",
    })


# ── POST /waf/lockdown ─────────────────────────────────────────

def _handle_lockdown(body):
    """Toggle lockdown mode: default action Block vs Allow."""
    activate = body.get("activate", True)
    web_acl, lock_token = _get_web_acl()

    new_default = {"Block": {}} if activate else {"Allow": {}}

    _wafv2.update_web_acl(
        Name=WEB_ACL_NAME,
        Scope=SCOPE,
        Id=WEB_ACL_ID,
        DefaultAction=new_default,
        Rules=web_acl["Rules"],
        VisibilityConfig=web_acl["VisibilityConfig"],
        LockToken=lock_token,
    )

    status = "ACTIVATED" if activate else "DEACTIVATED"
    logger.info(f"Lockdown mode {status}")
    return _response(200, {
        "lockdown_active": activate,
        "message": f"Lockdown mode {status.lower()}",
    })


# ── GET /waf/blocked-ips ───────────────────────────────────────

def _handle_blocked_ips():
    """Return all IPs in the blocklist."""
    ip_set, _ = _get_ip_set(BLOCKLIST_NAME, BLOCKLIST_ID)
    addresses = ip_set.get("Addresses", [])

    return _response(200, {
        "count": len(addresses),
        "addresses": addresses,
    })


# ── POST /waf/block-ip ─────────────────────────────────────────

def _handle_block_ip(body):
    """Add an IP (CIDR) to the blocklist."""
    ip = body.get("ip")
    if not ip:
        return _response(400, {"error": "ip is required (CIDR format, e.g. 1.2.3.4/32)"})

    # Ensure CIDR format
    if "/" not in ip:
        ip = f"{ip}/32"

    ip_set, lock_token = _get_ip_set(BLOCKLIST_NAME, BLOCKLIST_ID)
    addresses = ip_set.get("Addresses", [])

    if ip in addresses:
        return _response(200, {"message": f"{ip} already blocked", "count": len(addresses)})

    addresses.append(ip)
    _wafv2.update_ip_set(
        Name=BLOCKLIST_NAME,
        Scope=SCOPE,
        Id=BLOCKLIST_ID,
        Addresses=addresses,
        LockToken=lock_token,
    )

    logger.info(f"Blocked IP: {ip}")
    return _response(200, {
        "message": f"{ip} added to blocklist",
        "count": len(addresses),
    })


# ── POST /waf/unblock-ip ───────────────────────────────────────

def _handle_unblock_ip(body):
    """Remove an IP from the blocklist."""
    ip = body.get("ip")
    if not ip:
        return _response(400, {"error": "ip is required"})

    if "/" not in ip:
        ip = f"{ip}/32"

    ip_set, lock_token = _get_ip_set(BLOCKLIST_NAME, BLOCKLIST_ID)
    addresses = ip_set.get("Addresses", [])

    if ip not in addresses:
        return _response(404, {"message": f"{ip} not found in blocklist"})

    addresses.remove(ip)
    _wafv2.update_ip_set(
        Name=BLOCKLIST_NAME,
        Scope=SCOPE,
        Id=BLOCKLIST_ID,
        Addresses=addresses,
        LockToken=lock_token,
    )

    logger.info(f"Unblocked IP: {ip}")
    return _response(200, {
        "message": f"{ip} removed from blocklist",
        "count": len(addresses),
    })


# ── Router ──────────────────────────────────────────────────────

def handler(event, context):
    request_context = (event or {}).get("requestContext") or {}
    route_key = request_context.get("routeKey") or ""
    raw_path = (event or {}).get("rawPath") or ""

    logger.info(f"WAF handler invoked: route_key={route_key} raw_path={raw_path}")

    # Parse body for POST requests
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except (json.JSONDecodeError, TypeError):
            body = {}

    # Route
    if route_key == "GET /waf/status" or raw_path.endswith("/waf/status"):
        return _handle_status()

    if route_key == "POST /waf/toggle-rule" or raw_path.endswith("/waf/toggle-rule"):
        return _handle_toggle_rule(body)

    if route_key == "POST /waf/lockdown" or raw_path.endswith("/waf/lockdown"):
        return _handle_lockdown(body)

    if route_key == "GET /waf/blocked-ips" or raw_path.endswith("/waf/blocked-ips"):
        return _handle_blocked_ips()

    if route_key == "POST /waf/block-ip" or raw_path.endswith("/waf/block-ip"):
        return _handle_block_ip(body)

    if route_key == "POST /waf/unblock-ip" or raw_path.endswith("/waf/unblock-ip"):
        return _handle_unblock_ip(body)

    return _response(404, {"error": "Not found"})
