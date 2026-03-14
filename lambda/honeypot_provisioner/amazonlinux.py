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


def build_user_data(trap_profile: str) -> str:
    """Build Amazon Linux 2023 bootstrap script.

    Uses dnf (AL2023 package manager), installs Suricata from EPEL,
    and CloudWatch Agent from the official Amazon RPM.
    """
    return f"""#!/bin/bash
set -euo pipefail
exec > >(tee /var/log/honeypot-bootstrap.log) 2>&1

echo "=== PhantomWall Honeypot Bootstrap (Amazon Linux 2023) ==="
echo "Trap Profile: {trap_profile}"
echo "Timestamp: $(date -u)"

# Update system
dnf update -y

# Install EPEL for Suricata
dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm || true

# Install Suricata + dependencies
dnf install -y suricata jq curl unzip wget

# Configure Suricata for eve.json output
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

# Detect primary network interface for Suricata
IFACE=$(ip -o link show | awk -F': ' '!/lo/{{print $2; exit}}')
if [ -n "$IFACE" ]; then
    sed -i "s/af-packet:/af-packet:\\n  - interface: $IFACE/" /etc/suricata/suricata.yaml 2>/dev/null || true
fi

# Enable and start Suricata
systemctl enable suricata
systemctl restart suricata

# Install CloudWatch Agent (Amazon Linux RPM)
wget -q https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
rpm -U ./amazon-cloudwatch-agent.rpm

# Configure CloudWatch Agent to ship eve.json
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'CWCONF'
{{
  "logs": {{
    "logs_collected": {{
      "files": {{
        "collect_list": [
          {{
            "file_path": "/var/log/suricata/eve.json",
            "log_group_name": "/honeypot/suricata",
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
