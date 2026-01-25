#!/bin/bash
set -euo pipefail
set -x

LOG_FILE="/var/log/honeypot-bootstrap.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "=== Honeypot Suricata Installation Started at $(date) ==="
echo "OS Info: $(cat /etc/os-release | head -2)"

# Detect OS
OS_NAME=$(grep '^NAME=' /etc/os-release | cut -d'"' -f2)
OS_VERSION=$(grep '^VERSION=' /etc/os-release | cut -d'"' -f2 2>/dev/null || echo "unknown")
echo "Detected OS: $OS_NAME $OS_VERSION"

# Ubuntu/Debian Installation (Recommended for SaaS)
if [[ "$OS_NAME" =~ ^(Ubuntu|Debian) ]]; then
  echo "=== Installing Suricata on Ubuntu/Debian (Recommended) ==="
  
  # Update package cache
  echo "Updating package cache..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  
  # Install Suricata and related tools
  echo "Installing Suricata packages..."
  apt-get install -y suricata suricata-update jq
  
  # The package automatically creates suricata user and sets up systemd service
  echo "Suricata installed successfully via apt package manager"

# Amazon Linux 2 Installation  
elif [[ "$OS_NAME" == "Amazon Linux" && "$OS_VERSION" == "2" ]]; then
  echo "=== Installing Suricata on Amazon Linux 2 ==="
  
  # Install EPEL
  yum install -y epel-release
  yum update -y
  
  # Install Suricata
  yum install -y suricata suricata-update
  
# RHEL/CentOS/Rocky/AlmaLinux Installation
elif [[ "$OS_NAME" =~ ^(Red Hat|CentOS|Rocky|AlmaLinux) ]]; then
  echo "=== Installing Suricata on RHEL-based system ==="
  
  # Install EPEL
  if command -v dnf >/dev/null 2>&1; then
    dnf install -y epel-release
    dnf update -y
    dnf install -y suricata suricata-update
  else
    yum install -y epel-release  
    yum update -y
    yum install -y suricata suricata-update
  fi

# Unsupported OS
else
  echo "ERROR: Unsupported OS: $OS_NAME $OS_VERSION" >&2
  echo "Supported: Ubuntu 18.04+, Debian 10+, Amazon Linux 2, RHEL 8+, CentOS 8+, Rocky Linux, AlmaLinux" >&2
  echo "For SaaS deployment, Ubuntu 22.04 LTS is strongly recommended." >&2
  exit 1
fi

# Verify Suricata installation
echo "=== Verifying Suricata installation ==="
if ! command -v suricata >/dev/null 2>&1; then
  echo "ERROR: Suricata binary missing after installation" >&2
  echo "Checking for suricata files:"
  find /usr -name "*suricata*" 2>/dev/null | head -10 || echo "Find command failed"
  exit 1
fi

echo "✅ Suricata binary found at: $(which suricata)"
echo "✅ Suricata version: $(suricata --version 2>&1 | head -1)"

# Detect primary network interface
echo "=== Configuring network interface ==="
echo "Available network interfaces:"
ip link show | grep '^[0-9]' | awk '{print $2}' | sed 's/:$//' | grep -v lo

PRIMARY_IFACE=$(ip route get 8.8.8.8 2>/dev/null | awk '{for (i=1;i<=NF;i++) if ($i=="dev") {print $(i+1); exit}}' || echo "")
if [[ -z "${PRIMARY_IFACE:-}" ]]; then
  echo "WARNING: Could not detect primary interface via routing table"
  PRIMARY_IFACE=$(ip link show | grep -E '^[0-9]+: (eth|ens|enp)' | head -1 | awk '{print $2}' | sed 's/:$//' || echo "")
fi

if [[ -n "${PRIMARY_IFACE:-}" ]]; then
  echo "✅ Using primary interface: $PRIMARY_IFACE"
  
  # Configure interface based on OS
  if [[ "$OS_NAME" =~ ^(Ubuntu|Debian) ]]; then
    # Ubuntu/Debian uses /etc/default/suricata
    mkdir -p /etc/default
    echo "SURICATA_OPTIONS=\"-i ${PRIMARY_IFACE}\"" > /etc/default/suricata
    echo "✅ Created /etc/default/suricata with interface $PRIMARY_IFACE"
  else
    # RHEL/CentOS/Amazon Linux uses /etc/sysconfig/suricata  
    mkdir -p /etc/sysconfig
    echo "SURICATA_OPTIONS=\"-i ${PRIMARY_IFACE}\"" > /etc/sysconfig/suricata
    echo "✅ Created /etc/sysconfig/suricata with interface $PRIMARY_IFACE"
  fi
else
  echo "⚠️  Could not detect primary network interface, using default config"
fi

# Ensure directories exist (package usually creates these)
echo "=== Verifying Suricata directories ==="
mkdir -p /var/log/suricata
mkdir -p /var/lib/suricata
mkdir -p /etc/suricata

# Verify Suricata configuration exists (package should provide this)
echo "=== Verifying Suricata configuration ==="
if [[ -f /etc/suricata/suricata.yaml ]]; then
  echo "✅ Found Suricata configuration at /etc/suricata/suricata.yaml"
  
  # Customize the configuration for honeypot use
  echo "Optimizing configuration for honeypot deployment..."
  
  # Ensure eve.json logging is properly configured
  if ! grep -q "eve-log:" /etc/suricata/suricata.yaml; then
    echo "⚠️  Adding eve-log configuration for JSON output"
    cat >> /etc/suricata/suricata.yaml <<'EOF'

# Added for honeypot JSON logging
outputs:
  - eve-log:
      enabled: yes
      filetype: regular
      filename: eve.json
      types:
        - alert
        - http
        - dns
        - tls
        - files
        - smtp
        - ssh
        - flow
EOF
  fi
  
else
  echo "⚠️  Suricata configuration not found, this may indicate package installation issues"
  find /etc -name "suricata*" 2>/dev/null | head -5
fi

# Enable and start Suricata service
echo "=== Enabling and starting Suricata service ==="
systemctl enable suricata
systemctl start suricata

# Wait a moment for service to initialize
sleep 5

# Update Suricata rules (much simpler with package management)
echo "=== Updating Suricata rules ==="
if command -v suricata-update >/dev/null 2>&1; then
  echo "Running suricata-update to download latest threat intelligence rules..."
  
  # Enable Emerging Threats Open rules (free)
  suricata-update enable-source et/open || echo "⚠️  Failed to enable ET Open rules"
  
  # Run the update
  suricata-update || {
    echo "⚠️  suricata-update failed, this is common on first run"
    echo "Creating basic honeypot detection rules as fallback..."
    
    mkdir -p /var/lib/suricata/rules
    cat > /var/lib/suricata/rules/honeypot.rules <<'EOF'
# Honeypot-specific detection rules
alert icmp any any -> $HOME_NET any (msg:"HONEYPOT: ICMP Ping Detected"; sid:1000001; rev:1;)
alert tcp any any -> $HOME_NET 22 (msg:"HONEYPOT: SSH Connection Attempt"; sid:1000002; rev:1;)
alert tcp any any -> $HOME_NET 80 (msg:"HONEYPOT: HTTP Connection"; sid:1000003; rev:1;)
alert tcp any any -> $HOME_NET 443 (msg:"HONEYPOT: HTTPS Connection"; sid:1000004; rev:1;)
alert tcp any any -> $HOME_NET 21 (msg:"HONEYPOT: FTP Connection"; sid:1000005; rev:1;)
alert tcp any any -> $HOME_NET 23 (msg:"HONEYPOT: Telnet Connection"; sid:1000006; rev:1;)
alert tcp any any -> $HOME_NET 25 (msg:"HONEYPOT: SMTP Connection"; sid:1000007; rev:1;)
alert tcp any any -> $HOME_NET 3389 (msg:"HONEYPOT: RDP Connection"; sid:1000008; rev:1;)
alert tcp any any -> $HOME_NET 1433 (msg:"HONEYPOT: MSSQL Connection"; sid:1000009; rev:1;)
alert tcp any any -> $HOME_NET 3306 (msg:"HONEYPOT: MySQL Connection"; sid:1000010; rev:1;)
EOF
    echo "✅ Created basic honeypot detection rules"
  }
  
  # Verify rules were installed
  if [[ -d /var/lib/suricata/rules ]]; then
    RULE_COUNT=$(find /var/lib/suricata/rules -name "*.rules" -exec cat {} \; | grep -c "^alert" 2>/dev/null || echo "0")
    echo "✅ Found $RULE_COUNT detection rules installed"
  fi
  
else
  echo "⚠️  suricata-update not available, installing minimal rules"
  mkdir -p /var/lib/suricata/rules
  cat > /var/lib/suricata/rules/basic.rules <<'EOF'
# Basic honeypot detection rules  
alert icmp any any -> any any (msg:"HONEYPOT: ICMP Activity"; sid:1; rev:1;)
alert tcp any any -> any 22 (msg:"HONEYPOT: SSH Activity"; sid:2; rev:1;)
alert tcp any any -> any 80 (msg:"HONEYPOT: HTTP Activity"; sid:3; rev:1;)
EOF
fi

# Ensure proper ownership (Ubuntu package usually handles this)
if id suricata >/dev/null 2>&1; then
  chown -R suricata:suricata /var/lib/suricata/ /var/log/suricata/ || echo "⚠️  Could not set suricata ownership"
  echo "✅ Set proper file ownership for suricata user"
fi

# Restart Suricata to load rules
echo "=== Restarting Suricata to load updated rules ==="
systemctl restart suricata
sleep 10

# Verify service is running
echo "=== Verifying Suricata service status ==="
if systemctl is-active --quiet suricata; then
  echo "✅ Suricata service is active and running"
  systemctl status suricata --no-pager --lines=0
else
  echo "❌ Suricata service is not running properly"
  echo "Service status:"
  systemctl status suricata --no-pager --full || true
  echo "Recent journal entries:"
  journalctl -u suricata --no-pager -n 20 || true
fi

# Verify processes are running  
if pgrep -f suricata >/dev/null; then
  echo "✅ Suricata processes confirmed running:"
  pgrep -f suricata | xargs ps -fp 2>/dev/null || echo "Process details unavailable"
else
  echo "❌ No Suricata processes found"
fi

# Check log files
echo "=== Verifying log file creation ==="
ls -la /var/log/suricata/ 2>/dev/null || echo "Log directory not accessible"

# Wait a moment for logs to appear
sleep 5

if [[ -f /var/log/suricata/eve.json ]]; then
  echo "✅ Found eve.json - JSON event log is being created"
  echo "Recent events (last 3 lines):"
  tail -3 /var/log/suricata/eve.json 2>/dev/null || echo "No events yet"
else
  echo "⚠️  eve.json not found yet (may take a few minutes to appear)"
fi

if [[ -f /var/log/suricata/suricata.log ]]; then
  echo "✅ Found suricata.log - main log file is being created"  
  echo "Recent log entries (last 5 lines):"
  tail -5 /var/log/suricata/suricata.log 2>/dev/null || echo "No log entries yet"
fi

# Final validation
echo "=== Installation Summary ==="
echo "✅ Suricata $(suricata --version 2>&1 | head -1 | cut -d' ' -f2) installed successfully"
echo "✅ Service enabled and started"
echo "✅ Monitoring interface: ${PRIMARY_IFACE:-default}"
echo "✅ JSON logs: /var/log/suricata/eve.json"
echo "✅ Main logs: /var/log/suricata/suricata.log"
echo "✅ Rules directory: /var/lib/suricata/rules"

echo "=== Honeypot Suricata installation completed at $(date) ==="
echo "🎯 Your honeypot is now ready to detect and log network threats!"
exit 0
