#!/bin/bash
set -euo pipefail
set -x

LOG_FILE="${LOG_FILE:-/var/log/honeypot-bootstrap.log}"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "=== CloudWatch Agent Setup Started at $(date) ==="

CW_GROUP="${CW_LOG_GROUP:-/honeypot/suricata}"
CW_BOOTSTRAP_GROUP="${CW_BOOTSTRAP_LOG_GROUP:-/honeypot/bootstrap}"
AGENT_CTL="/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl"

install_cloudwatch_agent() {
  echo "=== Installing CloudWatch agent ==="
  
  # Detect OS to choose appropriate installation method
  OS_NAME=$(grep '^NAME=' /etc/os-release | cut -d'"' -f2)
  echo "Detected OS: $OS_NAME"
  
  if command -v apt-get >/dev/null 2>&1; then
    echo "Using apt-get to install CloudWatch agent on Ubuntu/Debian..."
    
    # Update package cache
    export DEBIAN_FRONTEND=noninteractive
    apt-get update
    
    # Try to install from repository first
    apt-get install -y amazon-cloudwatch-agent || {
      echo "WARNING: apt install failed, downloading directly from AWS..."
      
      # Download the .deb package directly
      wget -O /tmp/amazon-cloudwatch-agent.deb \
        https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
      
      if [[ -f /tmp/amazon-cloudwatch-agent.deb ]]; then
        dpkg -i /tmp/amazon-cloudwatch-agent.deb || {
          echo "Fixing dependencies..."
          apt-get install -f -y
          dpkg -i /tmp/amazon-cloudwatch-agent.deb || return 1
        }
      else
        echo "ERROR: Failed to download CloudWatch agent .deb package" >&2
        return 1
      fi
    }
    
  elif command -v dnf >/dev/null 2>&1; then
    echo "Using dnf to install CloudWatch agent on RHEL/Fedora..."
    dnf -y install amazon-cloudwatch-agent || {
      echo "WARNING: dnf install failed, trying direct download..."
      wget -O /tmp/amazon-cloudwatch-agent.rpm \
        https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
      rpm -U /tmp/amazon-cloudwatch-agent.rpm || return 1
    }
    
  elif command -v yum >/dev/null 2>&1; then
    echo "Using yum to install CloudWatch agent on Amazon Linux/CentOS..."
    yum -y install amazon-cloudwatch-agent || {
      echo "WARNING: yum install failed, trying direct download..."
      wget -O /tmp/amazon-cloudwatch-agent.rpm \
        https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
      rpm -U /tmp/amazon-cloudwatch-agent.rpm || return 1
    }
    
  else
    echo "ERROR: No supported package manager (apt-get/dnf/yum) found" >&2
    echo "Available package managers: $(which apt-get dnf yum 2>/dev/null | tr '\n' ' ')" >&2
    return 1
  fi
  
  echo "✅ CloudWatch agent installation completed"
}

install_cloudwatch_agent

# Verify CloudWatch agent installation
echo "=== Verifying CloudWatch agent installation ==="
if [ ! -x "$AGENT_CTL" ]; then
  echo "WARNING: amazon-cloudwatch-agent-ctl not found at expected location: $AGENT_CTL"
  echo "Searching for CloudWatch agent files..."
  find /opt -name "*cloudwatch*" 2>/dev/null | head -10 || echo "Find failed"
  echo "Continuing without CloudWatch agent configuration"
  exit 0
fi

echo "CloudWatch agent control found at: $AGENT_CTL"

# Ensure necessary directories exist
mkdir -p /opt/aws/amazon-cloudwatch-agent/etc
mkdir -p /var/log/suricata

# Create CloudWatch agent configuration
echo "=== Creating CloudWatch agent configuration ==="
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json <<EOF
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/suricata/eve.json",
            "log_group_name": "${CW_GROUP}",
            "log_stream_name": "{instance_id}",
            "multi_line_start_pattern": "^{\\"timestamp\\":"
          },
          {
            "file_path": "/var/log/suricata/suricata.log",
            "log_group_name": "${CW_GROUP}-logs",
            "log_stream_name": "{instance_id}"
          },
          {
            "file_path": "${LOG_FILE}",
            "log_group_name": "${CW_BOOTSTRAP_GROUP}",
            "log_stream_name": "{instance_id}"
          }
        ]
      }
    }
  }
}
EOF

echo "CloudWatch agent configuration created:"
cat /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json

# Configure and start CloudWatch agent
echo "=== Configuring CloudWatch agent ==="
"$AGENT_CTL" -a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s || {
  echo "WARNING: CloudWatch agent configuration failed"
  "$AGENT_CTL" -m ec2 -a query-config || echo "Query config failed"
}

echo "=== Starting CloudWatch agent service ==="
systemctl enable amazon-cloudwatch-agent || echo "WARNING: Failed to enable service"
systemctl start amazon-cloudwatch-agent || echo "WARNING: Failed to start service"

# Wait for service to initialize
sleep 5

# Check service status
echo "=== Verifying CloudWatch agent service ==="
if systemctl is-active --quiet amazon-cloudwatch-agent; then
  echo "✅ CloudWatch agent service is active and running"
  systemctl status amazon-cloudwatch-agent --no-pager --lines=0
else
  echo "❌ CloudWatch agent service is not running properly"
  echo "Service status:"
  systemctl status amazon-cloudwatch-agent --no-pager --full || true
  echo "Recent journal entries:"
  journalctl -u amazon-cloudwatch-agent --no-pager -n 10 || true
fi

# Check agent status via control script
echo "=== CloudWatch agent control status ==="
if "$AGENT_CTL" -m ec2 -a status 2>/dev/null; then
  echo "✅ Agent control status check successful"
else
  echo "⚠️  Agent control status check failed (may still be initializing)"
fi

# Verify agent is running
if pgrep -f amazon-cloudwatch-agent >/dev/null; then
  echo "✅ CloudWatch agent processes confirmed running:"
  pgrep -f amazon-cloudwatch-agent | xargs ps -fp 2>/dev/null || echo "Process details unavailable"
else
  echo "❌ No CloudWatch agent processes found"
fi

# Test log file access
echo "=== Testing log file access ==="
if [[ -r "${LOG_FILE}" ]]; then
  echo "✅ Bootstrap log file is readable: ${LOG_FILE}"
else
  echo "⚠️  Bootstrap log file not accessible: ${LOG_FILE}"
fi

if [[ -d /var/log/suricata ]]; then
  echo "✅ Suricata log directory exists: /var/log/suricata"
else
  echo "⚠️  Suricata log directory not found (will be created by Suricata)"
fi

echo "=== Summary ==="
echo "✅ CloudWatch agent installation: Complete"
echo "✅ Configuration file: /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json"
echo "✅ Log groups configured:"
echo "   - Bootstrap logs: ${CW_BOOTSTRAP_GROUP}"
echo "   - Suricata events: ${CW_GROUP}"  
echo "   - Suricata logs: ${CW_GROUP}-logs"

echo "=== CloudWatch agent setup completed at $(date) ==="
exit 0
