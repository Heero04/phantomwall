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


def build_user_data(trap_profile: str) -> str:
    """Build Ubuntu 22.04 bootstrap script.

    Installs Suricata (via PPA) + CloudWatch Agent (.deb) inline,
    matching the Terraform-managed honeypot pattern.
    """
    return f"""#!/bin/bash
set -euo pipefail
exec > >(tee /var/log/honeypot-bootstrap.log) 2>&1

echo "=== PhantomWall Honeypot Bootstrap (Ubuntu 22.04) ==="
echo "Trap Profile: {trap_profile}"
echo "Timestamp: $(date -u)"

# Update system
apt-get update -y && apt-get upgrade -y

# Install Suricata
add-apt-repository -y ppa:oisf/suricata-stable
apt-get update -y
apt-get install -y suricata jq curl unzip

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

# Enable and start Suricata
systemctl enable suricata
systemctl restart suricata

# Install CloudWatch Agent
wget -q https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
dpkg -i amazon-cloudwatch-agent.deb

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

echo "=== Bootstrap Complete (Ubuntu 22.04) ==="
"""
