"""
PhantomWall – Amazon Linux 2023 Honeypot Module
=================================================
Isolated AMI lookup and bootstrap script for AL2023.
Imported by handler.py; a bug here cannot crash other OS modules.
"""

import boto3

_ec2 = boto3.client("ec2")


def get_latest_ami() -> str:
    """Get latest Amazon Linux 2023 AMI."""
    response = _ec2.describe_images(
        Owners=["137112412989"],  # Amazon
        Filters=[
            {"Name": "name", "Values": ["al2023-ami-2023*-x86_64"]},
            {"Name": "state", "Values": ["available"]},
            {"Name": "virtualization-type", "Values": ["hvm"]},
            {"Name": "architecture", "Values": ["x86_64"]},
        ],
    )
    images = sorted(response["Images"], key=lambda x: x["CreationDate"], reverse=True)
    if not images:
        raise RuntimeError("No Amazon Linux 2023 AMI found")
    return images[0]["ImageId"]


def build_user_data(trap_profile: str, cw_log_group_prefix: str = "/honeypot/suricata") -> str:
    """Build Amazon Linux 2023 bootstrap script.

    Uses dnf (AL2023 package manager), installs Suricata from EPEL,
    and CloudWatch Agent from the official Amazon RPM.

    Per-instance log group:
        The CW Agent config uses {instance_id} (a CW Agent variable
        resolved at runtime on the EC2 instance) to create a unique
        log group per honeypot: /honeypot/suricata/{instance_id}
    """
    return f"""#!/bin/bash
exec > >(tee /var/log/honeypot-bootstrap.log) 2>&1

echo "=== PhantomWall Honeypot Bootstrap (Amazon Linux 2023) ==="
echo "Trap Profile: {trap_profile}"
echo "CW Log Group Prefix: {cw_log_group_prefix}"
echo "Timestamp: $(date -u)"

# ── 1. System update (non-fatal) ────────────────────────────
dnf update -y || echo "WARN: dnf update had errors (non-fatal)"

# ── 2. Install EPEL + Suricata ──────────────────────────────
dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm || true
dnf install -y suricata jq curl unzip wget

# ── 3. Detect primary network interface ──────────────────────
PRIMARY_IFACE=$(ip route get 8.8.8.8 2>/dev/null | awk '{{for(i=1;i<=NF;i++) if($i=="dev") {{print $(i+1); exit}}}}' || echo "")
if [ -z "$PRIMARY_IFACE" ]; then
  PRIMARY_IFACE=$(ip -o link show | awk -F': ' '!/lo/{{print $2; exit}}')
fi
echo "Detected interface: $PRIMARY_IFACE"

# Write interface config so systemd unit picks it up
mkdir -p /etc/sysconfig
echo "SURICATA_OPTIONS=\\"-i $PRIMARY_IFACE\\"" > /etc/sysconfig/suricata
echo "Wrote /etc/sysconfig/suricata with interface $PRIMARY_IFACE"

# Patch suricata.yaml af-packet section — replace hardcoded eth0 with detected interface
if [ -f /etc/suricata/suricata.yaml ]; then
  sed -i "s/- interface: eth0/- interface: $PRIMARY_IFACE/g" /etc/suricata/suricata.yaml
  sed -i "s/interface: default/interface: $PRIMARY_IFACE/g" /etc/suricata/suricata.yaml
  echo "Patched suricata.yaml af-packet interface to $PRIMARY_IFACE"
fi

# ── 4. Suricata rules ───────────────────────────────────────
echo "=== Updating Suricata rules ==="
if command -v suricata-update >/dev/null 2>&1; then
  suricata-update enable-source et/open || echo "Failed to enable ET Open (non-fatal)"
  suricata-update || echo "suricata-update failed (non-fatal)"
fi

# Always ensure fallback rules exist
RULE_COUNT=$(find /var/lib/suricata/rules -name "*.rules" -exec cat {{}} \; 2>/dev/null | grep -c "^alert" || echo "0")
if [ "$RULE_COUNT" -eq 0 ]; then
  echo "No rules found — installing fallback honeypot rules"
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
fi
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
  echo "ERROR: Suricata failed to start"
  tail -20 /var/log/suricata/suricata.log 2>/dev/null || true
fi

# ── 7. Install CloudWatch Agent ─────────────────────────────
wget -q https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
rpm -U ./amazon-cloudwatch-agent.rpm

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

echo "=== Bootstrap Complete (Amazon Linux 2023) ==="
"""
