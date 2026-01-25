#!/bin/bash
set -euo pipefail
set -x

echo "=== Honeypot EC2 Bootstrap Started at $(date) ==="
echo "Instance ID: $(curl -s http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null || echo 'unknown')"

export CW_LOG_GROUP="${cw_log_group}"
export CW_BOOTSTRAP_LOG_GROUP="${cw_bootstrap_log_group}"
export LOG_FILE="/var/log/honeypot-bootstrap.log"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Start logging everything to the bootstrap log
exec > >(tee -a "$LOG_FILE") 2>&1

echo "Environment variables:"
echo "CW_LOG_GROUP=$CW_LOG_GROUP"
echo "CW_BOOTSTRAP_LOG_GROUP=$CW_BOOTSTRAP_LOG_GROUP"
echo "LOG_FILE=$LOG_FILE"

# Create the script files inline
echo "=== Creating setup scripts ==="
cat <<'CLOUDWATCH' > /tmp/honeypot_cloudwatch_agent.sh
${cloudwatch_script}
CLOUDWATCH

cat <<'SURICATA' > /tmp/honeypot_suricata_setup.sh
${suricata_script}
SURICATA

# Make executable
chmod +x /tmp/honeypot_cloudwatch_agent.sh
chmod +x /tmp/honeypot_suricata_setup.sh

# Run CloudWatch agent setup first
echo "=== Running CloudWatch agent setup ==="
if /tmp/honeypot_cloudwatch_agent.sh; then
  echo "✅ CloudWatch agent setup completed"
else
  echo "⚠️  CloudWatch agent setup failed"
fi

# Wait for CloudWatch to initialize
sleep 10

# Run Suricata setup
echo "=== Running Suricata setup ==="
if /tmp/honeypot_suricata_setup.sh; then
  echo "✅ Suricata setup completed"
else
  echo "❌ Suricata setup failed"
fi

echo "=== Honeypot Bootstrap Completed at $(date) ==="