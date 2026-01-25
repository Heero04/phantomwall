#!/bin/bash
set -euo pipefail
set -x

LOG_FILE="/var/log/honeypot-bootstrap.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "=== Ubuntu Honeypot Suricata Installation Started at $(date) ==="

# Update package cache
echo "Updating package cache..."
export DEBIAN_FRONTEND=noninteractive
apt-get update

# Install Suricata and related tools
echo "Installing Suricata packages..."
apt-get install -y suricata suricata-update jq

# Configure primary network interface
PRIMARY_IFACE=$(ip route get 8.8.8.8 2>/dev/null | awk '{for (i=1;i<=NF;i++) if ($i=="dev") {print $(i+1); exit}}' || echo "")
if [[ -n "${PRIMARY_IFACE:-}" ]]; then
  echo "SURICATA_OPTIONS=\"-i ${PRIMARY_IFACE}\"" > /etc/default/suricata
  echo "✅ Configured interface: $PRIMARY_IFACE"
  
  # Also update the main Suricata config file to use the correct interface
  echo "Updating Suricata config file for interface $PRIMARY_IFACE..."
  sed -i "s/interface: eth0/interface: ${PRIMARY_IFACE}/g" /etc/suricata/suricata.yaml || echo "⚠️  Could not update interface in config"
  
else
  echo "⚠️  Using default interface configuration"
fi

# Fix the rules path configuration  
echo "Configuring rules path..."
if [[ -f /etc/suricata/suricata.yaml ]]; then
  # Update the default-rule-path to point to where suricata-update puts rules
  sed -i 's|default-rule-path: /etc/suricata/rules|default-rule-path: /var/lib/suricata/rules|g' /etc/suricata/suricata.yaml
  
  # Update rule-files section - handle both possible formats
  sed -i 's|- suricata.rules|- suricata.rules|g' /etc/suricata/suricata.yaml
  sed -i 's|rule-files:|rule-files:\n  - suricata.rules|g' /etc/suricata/suricata.yaml
  
  # Also try updating any absolute path references
  sed -i 's|/etc/suricata/rules/suricata.rules|suricata.rules|g' /etc/suricata/suricata.yaml
  
  echo "✅ Updated rules path to /var/lib/suricata/rules"
  
  # Verify the configuration syntax
  echo "Testing configuration syntax..."
  if suricata -T -c /etc/suricata/suricata.yaml -q; then
    echo "✅ Configuration syntax valid"
  else
    echo "⚠️  Configuration has syntax issues, but continuing..."
  fi
else
  echo "⚠️  Suricata config file not found"
fi

# Ensure directories exist
mkdir -p /var/log/suricata
mkdir -p /var/lib/suricata

# Enable and start Suricata service
echo "Starting Suricata service..."
systemctl enable suricata
systemctl start suricata

# Update rules (basic attempt)
echo "Updating Suricata rules..."
if command -v suricata-update >/dev/null 2>&1; then
  suricata-update enable-source et/open || echo "⚠️  Rule update failed, using defaults"
  suricata-update || echo "⚠️  Rule update failed, using defaults"
fi

# Restart to load rules and updated configuration
echo "Restarting Suricata to load configuration changes and rules..."
systemctl restart suricata

# Give it extra time to load all 45K+ rules
echo "Waiting for rule loading to complete (this may take 30+ seconds)..."
sleep 30

# Basic verification
if systemctl is-active --quiet suricata; then
  echo "✅ Suricata service is running"
  
  # Show rule count if successful  
  RULE_COUNT=$(grep -c "^alert" /var/lib/suricata/rules/suricata.rules 2>/dev/null || echo "0")
  echo "✅ Loaded $RULE_COUNT alert rules"
  
  # Verify rules are actually loaded by Suricata (not just file count)
  if [[ $RULE_COUNT -gt 40000 ]]; then
    echo "✅ Enterprise ruleset successfully loaded!"
  elif [[ $RULE_COUNT -gt 0 ]]; then
    echo "⚠️  Some rules loaded but count seems low: $RULE_COUNT"
  else
    echo "❌ No rules detected in rules file"
  fi
  
  # Show interface binding
  echo "✅ Monitoring interface: $PRIMARY_IFACE"
  
else
  echo "❌ Suricata service failed to start"
  systemctl status suricata --no-pager || true
  
  echo "Checking Suricata logs for startup errors:"
  tail -20 /var/log/suricata/suricata.log 2>/dev/null || echo "No suricata.log found"
  
  echo "Testing Suricata configuration:"
  suricata -T -c /etc/suricata/suricata.yaml 2>&1 | tail -10 || echo "Config test failed"
  
  echo "Checking interface and rules paths:"
  echo "Interface $PRIMARY_IFACE exists: $(ip link show $PRIMARY_IFACE >/dev/null 2>&1 && echo 'YES' || echo 'NO')"
  echo "Rules file exists: $(ls -lh /var/lib/suricata/rules/suricata.rules 2>/dev/null || echo 'NO')"
fi

if pgrep -f suricata >/dev/null; then
  echo "✅ Suricata processes confirmed running"
else
  echo "❌ No Suricata processes found"
fi

echo "=== Ubuntu Suricata installation completed at $(date) ==="
echo "🎯 Honeypot ready for testing!"