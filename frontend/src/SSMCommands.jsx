import React, { useState } from 'react'
import './components/SSMCommands.css'

/**
 * SSM Commands Page
 * -----------------
 * Quick-copy SSM session commands for Honeypot & Kali EC2 instances.
 * Instance IDs are entered manually (from terraform output) so this
 * page works without any backend calls.
 */
export default function SSMCommands() {
  // TODO: Remove hardcoded IDs after testing — fetch from API or terraform output
  const [honeypotId, setHoneypotId] = useState('i-00c7a2a4fec3c9835')  // Current dev honeypot
  const [kaliId, setKaliId] = useState('i-0467a8548853a59a0')  // Current dev kali
  const [region, setRegion] = useState('us-east-1')
  const [copied, setCopied] = useState(null)  // tracks which cmd was copied

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  // ── command builders ──────────────────────────────────────
  const ssmSession = (id) =>
    `aws ssm start-session --target ${id || '<INSTANCE_ID>'} --region ${region}`

  const ssmPortForward = (id, local, remote) =>
    `aws ssm start-session --target ${id || '<INSTANCE_ID>'} --region ${region} --document-name AWS-StartPortForwardingSession --parameters "portNumber=${remote},localPortNumber=${local}"`

  const ssmRunCommand = (id, cmd) =>
    `aws ssm send-command --instance-ids "${id || '<INSTANCE_ID>'}" --region ${region} --document-name "AWS-RunShellScript" --parameters "commands=['${cmd}']" --output text`

  // ── command groups ────────────────────────────────────────
  const honeypotCommands = [
    {
      label: 'SSM Session → Honeypot',
      desc: 'Start an interactive shell on the honeypot',
      cmd: ssmSession(honeypotId),
      icon: '🖥️',
    },
    {
      label: 'Check Suricata Status',
      desc: 'Verify Suricata IDS is running',
      cmd: ssmRunCommand(honeypotId, 'sudo systemctl status suricata --no-pager'),
      icon: '🔍',
    },
    {
      label: 'Tail Suricata Alerts (eve.json)',
      desc: 'Watch live Suricata alerts',
      cmd: ssmRunCommand(honeypotId, 'sudo tail -20 /var/log/suricata/eve.json'),
      icon: '📋',
    },
    {
      label: 'Check CloudWatch Agent',
      desc: 'Verify CW agent is shipping logs to AWS',
      cmd: ssmRunCommand(honeypotId, 'sudo systemctl status amazon-cloudwatch-agent --no-pager'),
      icon: '☁️',
    },
    {
      label: 'View Suricata Rules',
      desc: 'Check loaded Suricata rules',
      cmd: ssmRunCommand(honeypotId, 'sudo suricata --list-keywords | head -30'),
      icon: '📜',
    },
    {
      label: 'Port Forward → Honeypot SSH (2222→22)',
      desc: 'Forward local port 2222 to honeypot SSH',
      cmd: ssmPortForward(honeypotId, '2222', '22'),
      icon: '🔗',
    },
    {
      label: 'Check Listening Ports',
      desc: 'See what ports are open on the honeypot',
      cmd: ssmRunCommand(honeypotId, 'sudo ss -tlnp'),
      icon: '🌐',
    },
    {
      label: 'Check Disk Usage',
      desc: 'Monitor disk space on the honeypot',
      cmd: ssmRunCommand(honeypotId, 'df -h'),
      icon: '💾',
    },
  ]

  const kaliCommands = [
    {
      label: 'SSM Session → Kali',
      desc: 'Start an interactive shell on Kali Linux',
      cmd: ssmSession(kaliId),
      icon: '🐉',
    },
    {
      label: 'Nmap Scan Honeypot',
      desc: 'Run a quick port scan against the honeypot',
      cmd: honeypotId
        ? ssmRunCommand(kaliId, `nmap -sV -T4 ${honeypotId}`)
        : ssmRunCommand(kaliId, 'nmap -sV -T4 <HONEYPOT_IP>'),
      icon: '🎯',
    },
    {
      label: 'Test SSH Brute Force (Hydra)',
      desc: 'Simulate SSH attack to generate alerts',
      cmd: ssmRunCommand(kaliId, 'hydra -l admin -P /usr/share/wordlists/rockyou.txt ssh://<HONEYPOT_IP> -t 4 -V'),
      icon: '⚔️',
    },
    {
      label: 'Nikto Web Scan',
      desc: 'Run Nikto web vulnerability scanner against honeypot',
      cmd: ssmRunCommand(kaliId, 'nikto -h http://<HONEYPOT_IP>'),
      icon: '🕷️',
    },
    {
      label: 'Curl Honeypot HTTP',
      desc: 'Quick HTTP request to test connectivity',
      cmd: ssmRunCommand(kaliId, 'curl -v http://<HONEYPOT_IP>'),
      icon: '🌐',
    },
    {
      label: 'Port Forward → Kali SSH (2223→22)',
      desc: 'Forward local port 2223 to Kali SSH',
      cmd: ssmPortForward(kaliId, '2223', '22'),
      icon: '🔗',
    },
    {
      label: 'Check Metasploit',
      desc: 'Verify Metasploit is available',
      cmd: ssmRunCommand(kaliId, 'msfconsole --version'),
      icon: '🛡️',
    },
  ]

  const utilityCommands = [
    {
      label: 'List All SSM Instances',
      desc: 'Show all EC2 instances registered with SSM',
      cmd: `aws ssm describe-instance-information --region ${region} --output table`,
      icon: '📊',
    },
    {
      label: 'Get Honeypot Instance ID',
      desc: 'From Terraform output',
      cmd: 'terraform output honeypot_instance_id',
      icon: '🏷️',
    },
    {
      label: 'Get Kali Instance ID',
      desc: 'From Terraform output',
      cmd: 'terraform output kali_instance_id',
      icon: '🏷️',
    },
    {
      label: 'Get Honeypot Public IP',
      desc: 'From Terraform output',
      cmd: 'terraform output honeypot_public_ip',
      icon: '🌍',
    },
    {
      label: 'Get Kali Public IP',
      desc: 'From Terraform output',
      cmd: 'terraform output kali_public_ip',
      icon: '🌍',
    },
    {
      label: 'Check CloudWatch Suricata Logs',
      desc: 'View recent Suricata log events in CloudWatch',
      cmd: `aws logs tail /honeypot/suricata --region ${region} --since 1h --format short`,
      icon: '📝',
    },
  ]

  // ── render ────────────────────────────────────────────────
  const CommandCard = ({ item }) => (
    <div className="ssm__card">
      <div className="ssm__card-header">
        <span className="ssm__card-icon">{item.icon}</span>
        <div>
          <h4 className="ssm__card-title">{item.label}</h4>
          <p className="ssm__card-desc">{item.desc}</p>
        </div>
      </div>
      <div className="ssm__card-cmd-row">
        <code className="ssm__card-cmd">{item.cmd}</code>
        <button
          className={`ssm__copy-btn ${copied === item.label ? 'ssm__copy-btn--copied' : ''}`}
          onClick={() => copyToClipboard(item.cmd, item.label)}
          title="Copy to clipboard"
        >
          {copied === item.label ? '✓ Copied' : '📋 Copy'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="ssm">
      <header className="ssm__header">
        <h2>🔑 SSM Commands</h2>
        <p className="ssm__subtitle">
          Quick-copy AWS SSM commands for your Honeypot &amp; Kali EC2 instances
        </p>
      </header>

      {/* Instance ID inputs */}
      <div className="ssm__config">
        <h3>⚙️ Instance Configuration</h3>
        <p className="ssm__config-hint">
          Paste your instance IDs from <code>terraform output</code> — commands update automatically
        </p>
        <div className="ssm__config-row">
          <label>
            <span>🖥️ Honeypot Instance ID</span>
            <input
              type="text"
              value={honeypotId}
              onChange={e => setHoneypotId(e.target.value.trim())}
              placeholder="i-0abc123def456..."
              spellCheck={false}
            />
          </label>
          <label>
            <span>🐉 Kali Instance ID</span>
            <input
              type="text"
              value={kaliId}
              onChange={e => setKaliId(e.target.value.trim())}
              placeholder="i-0xyz789ghi012..."
              spellCheck={false}
            />
          </label>
          <label>
            <span>🌎 Region</span>
            <select value={region} onChange={e => setRegion(e.target.value)}>
              <option value="us-east-1">us-east-1</option>
              <option value="us-east-2">us-east-2</option>
              <option value="us-west-1">us-west-1</option>
              <option value="us-west-2">us-west-2</option>
              <option value="eu-west-1">eu-west-1</option>
              <option value="eu-central-1">eu-central-1</option>
              <option value="ap-southeast-1">ap-southeast-1</option>
            </select>
          </label>
        </div>
      </div>

      {/* Honeypot commands */}
      <section className="ssm__section">
        <h3 className="ssm__section-title">
          <span className="ssm__section-icon">🖥️</span> Honeypot Commands
        </h3>
        <div className="ssm__grid">
          {honeypotCommands.map(item => (
            <CommandCard key={item.label} item={item} />
          ))}
        </div>
      </section>

      {/* Kali commands */}
      <section className="ssm__section">
        <h3 className="ssm__section-title">
          <span className="ssm__section-icon">🐉</span> Kali Linux Commands
        </h3>
        <div className="ssm__grid">
          {kaliCommands.map(item => (
            <CommandCard key={item.label} item={item} />
          ))}
        </div>
      </section>

      {/* Utility commands */}
      <section className="ssm__section">
        <h3 className="ssm__section-title">
          <span className="ssm__section-icon">🛠️</span> Utility Commands
        </h3>
        <div className="ssm__grid">
          {utilityCommands.map(item => (
            <CommandCard key={item.label} item={item} />
          ))}
        </div>
      </section>
    </div>
  )
}
