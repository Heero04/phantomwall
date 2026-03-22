"""
PhantomWall – Ubuntu 22.04 LTS Honeypot Module
================================================
Isolated AMI lookup and bootstrap script for Ubuntu.
Imported by handler.py; a bug here cannot crash other OS modules.
"""

import boto3

_ec2 = boto3.client("ec2")


def get_latest_ami() -> str:
    """Get latest Ubuntu 22.04 LTS AMI (Canonical)."""
    response = _ec2.describe_images(
        Owners=["099720109477"],  # Canonical
        Filters=[
            {"Name": "name", "Values": ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]},
            {"Name": "state", "Values": ["available"]},
            {"Name": "virtualization-type", "Values": ["hvm"]},
        ],
    )
    images = sorted(response["Images"], key=lambda x: x["CreationDate"], reverse=True)
    if not images:
        raise RuntimeError("No Ubuntu 22.04 AMI found")
    return images[0]["ImageId"]


def build_user_data(trap_profile: str, cw_log_group_prefix: str = "/honeypot/suricata") -> str:
    """Build Ubuntu 22.04 bootstrap script.

    Installs Suricata (via PPA) + CloudWatch Agent (.deb) inline,
    matching the Terraform-managed honeypot pattern.

    Per-instance log group:
        The CW Agent config uses {instance_id} (a CW Agent variable
        resolved at runtime on the EC2 instance) to create a unique
        log group per honeypot: /honeypot/suricata/{instance_id}
    """
    return f"""#!/bin/bash
exec > >(tee /var/log/honeypot-bootstrap.log) 2>&1

echo "=== PhantomWall Honeypot Bootstrap (Ubuntu 22.04) ==="
echo "Trap Profile: {trap_profile}"
echo "CW Log Group Prefix: {cw_log_group_prefix}"
echo "Timestamp: $(date -u)"

# ── 1. System update (non-fatal — stale mirrors can 404) ────
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y || echo "WARN: apt-get upgrade had errors (non-fatal)"

# ── 2. Install Suricata (suricata-update is bundled in the suricata pkg)
add-apt-repository -y ppa:oisf/suricata-stable
apt-get update -y
apt-get install -y suricata jq curl unzip || {{
  echo "WARN: first install attempt failed, retrying with --fix-missing"
  apt-get update -y
  apt-get install -y --fix-missing suricata jq curl unzip
}}

# ── 3. Detect primary network interface ──────────────────────
PRIMARY_IFACE=$(ip route get 8.8.8.8 2>/dev/null | awk '{{for(i=1;i<=NF;i++) if($i=="dev") {{print $(i+1); exit}}}}' || echo "")
if [ -z "$PRIMARY_IFACE" ]; then
  PRIMARY_IFACE=$(ip -o link show | awk -F': ' '!/lo/{{print $2; exit}}')
fi
echo "Detected interface: $PRIMARY_IFACE"

# Write interface config so systemd unit picks it up
mkdir -p /etc/default
echo "SURICATA_OPTIONS=\\"-i $PRIMARY_IFACE\\"" > /etc/default/suricata
echo "Wrote /etc/default/suricata with interface $PRIMARY_IFACE"

# Patch suricata.yaml af-packet section — replace hardcoded eth0 with detected interface
if [ -f /etc/suricata/suricata.yaml ]; then
  sed -i "s/- interface: eth0/- interface: $PRIMARY_IFACE/g" /etc/suricata/suricata.yaml
  sed -i "s/interface: default/interface: $PRIMARY_IFACE/g" /etc/suricata/suricata.yaml
  echo "Patched suricata.yaml af-packet interface to $PRIMARY_IFACE"
fi

# ── 4. Suricata rules ───────────────────────────────────────
echo "=== Updating Suricata rules ==="
suricata-update enable-source et/open || echo "Failed to enable ET Open (non-fatal)"
suricata-update || {{
  echo "suricata-update failed — installing fallback honeypot rules"
  mkdir -p /var/lib/suricata/rules
  cat > /var/lib/suricata/rules/honeypot.rules << 'FALLBACK'
alert icmp any any -> $HOME_NET any (msg:"HONEYPOT: ICMP Ping Detected"; sid:1000001; rev:1;)
alert tcp any any -> $HOME_NET 22 (msg:"HONEYPOT: SSH Connection Attempt"; sid:1000002; rev:1;)
alert tcp any any -> $HOME_NET 80 (msg:"HONEYPOT: HTTP Connection"; sid:1000003; rev:1;)
alert tcp any any -> $HOME_NET 443 (msg:"HONEYPOT: HTTPS Connection"; sid:1000004; rev:1;)
alert tcp any any -> $HOME_NET 23 (msg:"HONEYPOT: Telnet Connection"; sid:1000006; rev:1;)
alert tcp any any -> $HOME_NET 2222 (msg:"HONEYPOT: Alt-SSH Connection"; sid:1000011; rev:1;)
alert tcp any any -> $HOME_NET 8080 (msg:"HONEYPOT: HTTP-Alt Connection"; sid:1000012; rev:1;)
FALLBACK
}}

# Count installed rules
RULE_COUNT=$(find /var/lib/suricata/rules -name "*.rules" -exec cat {{}} \; 2>/dev/null | grep -c "^alert" || echo "0")
echo "Loaded $RULE_COUNT detection rules"

# ── 5. Configure Suricata eve.json output ────────────────────
cat > /etc/suricata/suricata-override.yaml << 'SURICONF'
outputs:
  - eve-log:
      enabled: yes
      filetype: regular
      filename: /var/log/suricata/eve.json
      types:
        - alert
        - http
        - dns
        - tls
        - ssh
        - flow
SURICONF

# ── 6. Start Suricata ───────────────────────────────────────
systemctl enable suricata
systemctl restart suricata
sleep 3
if systemctl is-active --quiet suricata; then
  echo "Suricata is RUNNING on $PRIMARY_IFACE"
else
  echo "ERROR: Suricata failed to start, check /var/log/suricata/suricata.log"
  tail -20 /var/log/suricata/suricata.log 2>/dev/null || true
fi

# ── 7. Install CloudWatch Agent ─────────────────────────────
wget -q https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
dpkg -i amazon-cloudwatch-agent.deb

# ── 8. Configure CloudWatch Agent ───────────────────────────
# NOTE: {{{{instance_id}}}} is a CW Agent variable resolved at runtime on EC2
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'CWCONF'
{{
  "logs": {{
    "logs_collected": {{
      "files": {{
        "collect_list": [
          {{
            "file_path": "/var/log/suricata/eve.json",
            "log_group_name": "{cw_log_group_prefix}/{{instance_id}}",
            "log_stream_name": "{{instance_id}}/eve",
            "timezone": "UTC"
          }}
        ]
      }}
    }}
  }}
}}
CWCONF

/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s

echo "=== Bootstrap Complete (Ubuntu 22.04) ==="
"""
