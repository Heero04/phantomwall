import json
import subprocess
from datetime import datetime, timezone

INSTANCE_ID = "i-070e264d063ae0a2f"
LOG_GROUP = f"/honeypot/suricata/phantomwall-demo-staging/{INSTANCE_ID}"
START_MS = 1779868800000
END_MS = 1779869000000
REGION = "us-east-1"


def run(cmd):
    return subprocess.check_output(cmd, text=True)


def main():
    print("=== Attack Simulator Lambda (recent) ===")
    out = run([
        "aws", "logs", "filter-log-events",
        "--log-group-name", "/aws/lambda/phantomwall-demo-attack-simulator-staging",
        "--start-time", str(START_MS),
        "--limit", "50",
        "--region", REGION,
    ])
    events = json.loads(out).get("events", [])
    reports = [e for e in events if "REPORT RequestId" in e.get("message", "")]
    errors = [e for e in events if "ERROR" in e.get("message", "") or "Task timed out" in e.get("message", "")]
    print(f"invocations with REPORT: {len(reports)}")
    print(f"errors: {len(errors)}")
    for r in reports:
        ts = datetime.fromtimestamp(r["timestamp"] / 1000, tz=timezone.utc).isoformat()
        print(f"  {ts}  {r['message'].strip()}")

    print("\n=== Suricata logs during attack window ===")
    out = run([
        "aws", "logs", "filter-log-events",
        "--log-group-name", LOG_GROUP,
        "--start-time", str(START_MS),
        "--end-time", str(END_MS),
        "--limit", "200",
        "--region", REGION,
    ])
    raw_events = json.loads(out).get("events", [])
    parsed = []
    for e in raw_events:
        msg = e.get("message", "")
        if not msg.startswith("{"):
            continue
        try:
            parsed.append(json.loads(msg))
        except json.JSONDecodeError:
            pass

    alerts = [x for x in parsed if x.get("event_type") == "alert"]
    http = [x for x in parsed if x.get("event_type") == "http"]
    flows = [x for x in parsed if x.get("event_type") == "flow" and x.get("proto") == "TCP"]

    print(f"parsed events: {len(parsed)}")
    print(f"alerts: {len(alerts)}")
    print(f"http: {len(http)}")
    print(f"tcp flows: {len(flows)}")

    for x in alerts[:8]:
        sig = (x.get("alert") or {}).get("signature", "")
        print(f"  ALERT src={x.get('src_ip')} port={x.get('dest_port')} sig={sig[:90]}")

    for x in http[:8]:
        h = x.get("http") or {}
        print(f"  HTTP src={x.get('src_ip')} url={h.get('url','')} ua={h.get('http_user_agent','')[:50]}")

    external_flows = [
        x for x in flows
        if x.get("src_ip") and not str(x.get("src_ip", "")).startswith("172.31.")
    ]
    print(f"external tcp flows: {len(external_flows)}")
    for x in external_flows[:12]:
        print(f"  FLOW {x.get('src_ip')} -> {x.get('dest_ip')}:{x.get('dest_port')}")

    print("\n=== Alerts table for current instance ===")
    out = run([
        "aws", "dynamodb", "scan",
        "--table-name", "phantomwall-alerts-staging",
        "--filter-expression", "honeypot_id = :id",
        "--expression-attribute-values", json.dumps({":id": {"S": INSTANCE_ID}}),
        "--region", REGION,
    ])
    items = json.loads(out).get("Items", [])
    print(f"alerts indexed for {INSTANCE_ID}: {len(items)}")
    for i in items[:8]:
        print(
            f"  {i.get('timestamp', {}).get('S')} src={i.get('src_ip', {}).get('S')} "
            f"sig={(i.get('signature', {}).get('S') or '')[:80]}"
        )


if __name__ == "__main__":
    main()
