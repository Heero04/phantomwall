"""
PhantomWall WAF Auto-Block Pipeline
====================================
Triggered by DynamoDB Stream on the suricata_events table.
When a high-severity alert (severity 1) arrives, automatically
adds the source IP to the WAF blocklist IP Set.

This is the "PhantomWall" in action: honeypot catches attacker →
their IP is automatically blocked from reaching real infrastructure.
"""

import json
import os
import logging

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

_wafv2 = boto3.client("wafv2")

BLOCKLIST_NAME = os.environ.get("WAF_BLOCKLIST_NAME", "")
BLOCKLIST_ID = os.environ.get("WAF_BLOCKLIST_ID", "")
SCOPE = "REGIONAL"

# Only auto-block IPs from alerts at or below this severity
# Suricata: 1 = highest severity
AUTO_BLOCK_MAX_SEVERITY = int(os.environ.get("AUTO_BLOCK_MAX_SEVERITY", "1"))


def handler(event, context):
    """Process DynamoDB Stream records and block malicious IPs."""
    records = event.get("Records", [])
    if not records:
        return {"processed": 0}

    ips_to_block = set()

    for record in records:
        # Only process INSERT events (new alerts)
        if record.get("eventName") != "INSERT":
            continue

        new_image = record.get("dynamodb", {}).get("NewImage", {})
        severity = new_image.get("severity", {}).get("N")
        src_ip = new_image.get("src_ip", {}).get("S")

        if not severity or not src_ip:
            continue

        try:
            sev = int(severity)
        except (TypeError, ValueError):
            continue

        if sev <= AUTO_BLOCK_MAX_SEVERITY:
            cidr = f"{src_ip}/32"
            ips_to_block.add(cidr)
            logger.info(f"Auto-blocking {src_ip} (severity {sev})")

    if not ips_to_block:
        logger.info("No IPs to block in this batch")
        return {"processed": len(records), "blocked": 0}

    # Fetch current blocklist
    try:
        resp = _wafv2.get_ip_set(
            Name=BLOCKLIST_NAME, Scope=SCOPE, Id=BLOCKLIST_ID
        )
        current_addresses = set(resp["IPSet"].get("Addresses", []))
        lock_token = resp["LockToken"]

        # Add new IPs (deduplicated)
        new_addresses = ips_to_block - current_addresses
        if not new_addresses:
            logger.info("All IPs already in blocklist")
            return {"processed": len(records), "blocked": 0, "already_blocked": len(ips_to_block)}

        updated = list(current_addresses | new_addresses)

        # WAF IP Sets have a 10,000 address limit
        if len(updated) > 10000:
            logger.warning(f"Blocklist approaching limit: {len(updated)} addresses")
            updated = updated[:10000]

        _wafv2.update_ip_set(
            Name=BLOCKLIST_NAME,
            Scope=SCOPE,
            Id=BLOCKLIST_ID,
            Addresses=updated,
            LockToken=lock_token,
        )

        logger.info(f"Blocked {len(new_addresses)} new IPs. Total: {len(updated)}")
        return {
            "processed": len(records),
            "blocked": len(new_addresses),
            "total_blocked": len(updated),
        }

    except Exception as e:
        logger.error(f"Failed to update WAF blocklist: {e}")
        raise
