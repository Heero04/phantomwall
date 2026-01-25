#!/bin/bash
set -euo pipefail
set -x

echo "=== Honeypot EC2 Bootstrap Started at $(date) ==="
echo "Instance ID: $(curl -s http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null || echo 'unknown')"
echo "Instance Type: $(curl -s http://169.254.169.254/latest/meta-data/instance-type 2>/dev/null || echo 'unknown')"
echo "Availability Zone: $(curl -s http://169.254.169.254/latest/meta-data/placement/availability-zone 2>/dev/null || echo 'unknown')"

export CW_LOG_GROUP="${cw_log_group}"
export CW_BOOTSTRAP_LOG_GROUP="${cw_bootstrap_log_group}"
export LOG_FILE="/var/log/honeypot-bootstrap.log"
export S3_BUCKET="${s3_bucket}"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Start logging everything to the bootstrap log
exec > >(tee -a "$LOG_FILE") 2>&1

echo "Environment variables:"
echo "CW_LOG_GROUP=$CW_LOG_GROUP"
echo "CW_BOOTSTRAP_LOG_GROUP=$CW_BOOTSTRAP_LOG_GROUP"
echo "LOG_FILE=$LOG_FILE"
echo "S3_BUCKET=$S3_BUCKET"

# Get AWS region
AWS_REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region 2>/dev/null || echo 'us-east-1')
export AWS_DEFAULT_REGION=$AWS_REGION
echo "AWS_REGION=$AWS_REGION"

# Download installation scripts from S3
echo "=== Downloading installation scripts from S3 ==="

# Download CloudWatch agent script
echo "Downloading CloudWatch agent installation script..."
aws s3 cp "s3://$S3_BUCKET/honeypot_cloudwatch_agent.sh" /tmp/honeypot_cloudwatch_agent.sh
chmod +x /tmp/honeypot_cloudwatch_agent.sh
echo "✅ Downloaded CloudWatch agent script ($(wc -l < /tmp/honeypot_cloudwatch_agent.sh) lines)"

# Download Suricata installation script
echo "Downloading Suricata installation script..."
aws s3 cp "s3://$S3_BUCKET/honeypot_user_data.sh" /tmp/honeypot_suricata_setup.sh
chmod +x /tmp/honeypot_suricata_setup.sh
echo "✅ Downloaded Suricata installation script ($(wc -l < /tmp/honeypot_suricata_setup.sh) lines)"

# Run CloudWatch agent setup first (so we can see logs)
echo "=== Running CloudWatch agent setup ==="
if /tmp/honeypot_cloudwatch_agent.sh; then
  echo "✅ CloudWatch agent setup completed successfully"
else
  echo "⚠️  CloudWatch agent setup failed with exit code $?"
fi

# Wait a moment for CloudWatch agent to initialize
sleep 10

# Run Suricata setup
echo "=== Running Suricata setup ==="
if /tmp/honeypot_suricata_setup.sh; then
  echo "✅ Suricata setup completed successfully"
else
  echo "❌ Suricata setup failed with exit code $?"
fi

# Final system state summary
echo "=== Final System State Summary ==="
echo "Running processes containing 'suricata':"
pgrep -f suricata | xargs ps -p 2>/dev/null || echo "No Suricata processes found"

echo "Running processes containing 'cloudwatch':"
pgrep -f cloudwatch | xargs ps -p 2>/dev/null || echo "No CloudWatch processes found"

echo "Active systemd services containing 'suricata' or 'cloudwatch':"
systemctl list-units --state=active | grep -E "(suricata|cloudwatch)" || echo "No matching active services"

echo "Recent log files in /var/log:"
find /var/log -type f -mmin -30 -ls 2>/dev/null | head -10 || echo "Find failed"

echo "=== Honeypot EC2 Bootstrap Completed at $(date) ==="