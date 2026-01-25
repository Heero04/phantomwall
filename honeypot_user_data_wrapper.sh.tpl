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

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Start logging everything to the bootstrap log
exec > >(tee -a "$LOG_FILE") 2>&1

echo "Environment variables:"
echo "CW_LOG_GROUP=$CW_LOG_GROUP"
echo "CW_BOOTSTRAP_LOG_GROUP=$CW_BOOTSTRAP_LOG_GROUP"
echo "LOG_FILE=$LOG_FILE"

# Create the script files
echo "=== Creating setup scripts ==="
cat <<'CLOUDWATCH' > /tmp/honeypot_cloudwatch_agent.sh
${cloudwatch_script}
CLOUDWATCH

cat <<'SURICATA' > /tmp/honeypot_suricata_setup.sh
${suricata_script}
SURICATA

# Clean up any Windows line endings and make executable
for script in /tmp/honeypot_cloudwatch_agent.sh /tmp/honeypot_suricata_setup.sh; do
  echo "Processing script: $script"
  sed -i 's/\r$//' "$script" || true
  chmod +x "$script"
  echo "Script size: $(wc -l < "$script") lines"
done

# Run CloudWatch agent setup first (so we can see logs)
echo "=== Running CloudWatch agent setup ==="
if /tmp/honeypot_cloudwatch_agent.sh; then
  echo "CloudWatch agent setup completed successfully"
else
  echo "WARNING: CloudWatch agent setup failed with exit code $?"
fi

# Wait a moment for CloudWatch agent to initialize
sleep 10

# Run Suricata setup
echo "=== Running Suricata setup ==="
if /tmp/honeypot_suricata_setup.sh; then
  echo "Suricata setup completed successfully"
else
  echo "ERROR: Suricata setup failed with exit code $?"
fi

# Final system state summary
echo "=== Final System State Summary ==="
echo "Running processes containing 'suricata':"
pgrep -f suricata | xargs ps -p || echo "No Suricata processes found"

echo "Running processes containing 'cloudwatch':"
pgrep -f cloudwatch | xargs ps -p || echo "No CloudWatch processes found"

echo "Active systemd services containing 'suricata' or 'cloudwatch':"
systemctl list-units --state=active | grep -E "(suricata|cloudwatch)" || echo "No matching active services"

echo "Recent log files in /var/log:"
find /var/log -type f -mmin -30 -ls 2>/dev/null | head -10 || echo "Find failed"

echo "=== Honeypot EC2 Bootstrap Completed at $(date) ==="
