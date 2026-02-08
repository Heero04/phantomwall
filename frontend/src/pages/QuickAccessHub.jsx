import React, { useState, useEffect, useCallback } from 'react'

const API_URL = import.meta.env.VITE_SURICATA_API_URL

// --- Utility Helpers ---
function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function severityLabel(sev) {
  if (sev === 1) return 'Critical'
  if (sev === 2) return 'High'
  if (sev === 3) return 'Medium'
  return 'Low'
}

function severityClass(sev) {
  if (sev === 1) return 'hub-sev--critical'
  if (sev === 2) return 'hub-sev--high'
  if (sev === 3) return 'hub-sev--medium'
  return 'hub-sev--low'
}

// --- Sub-components ---

function HoneypotStatusCard({ status, onToggle, isToggling }) {
  const isRunning = status === 'running'
  return (
    <div className={`hub-card hub-status ${isRunning ? 'hub-status--running' : 'hub-status--stopped'}`}>
      <div className="hub-status__header">
        <div className="hub-status__indicator-wrap">
          <span className={`hub-status__dot ${isRunning ? 'hub-status__dot--live' : ''}`} aria-hidden="true" />
          <span className="hub-status__label">{isRunning ? 'Running' : 'Stopped'}</span>
        </div>
        <span className="hub-card__eyebrow">Honeypot Instance</span>
      </div>

      <div className="hub-status__body">
        <div className="hub-status__info">
          <dl className="hub-status__meta">
            <div>
              <dt>Instance</dt>
              <dd>i-0a1b2c3d4e (t3.micro)</dd>
            </div>
            <div>
              <dt>Region</dt>
              <dd>us-east-1</dd>
            </div>
            <div>
              <dt>Uptime</dt>
              <dd>{isRunning ? '4h 32m' : '--'}</dd>
            </div>
            <div>
              <dt>Suricata</dt>
              <dd>{isRunning ? 'Active' : 'Inactive'}</dd>
            </div>
          </dl>
        </div>
        <button
          className={`hub-status__toggle ${isRunning ? 'hub-status__toggle--stop' : 'hub-status__toggle--start'}`}
          onClick={onToggle}
          disabled={isToggling}
          aria-label={isRunning ? 'Stop honeypot instance' : 'Start honeypot instance'}
        >
          {isToggling ? 'Processing...' : isRunning ? 'Stop Instance' : 'Start Instance'}
        </button>
      </div>
    </div>
  )
}

function StatCard({ label, value, hint, variant }) {
  return (
    <div className={`hub-card hub-stat ${variant ? `hub-stat--${variant}` : ''}`}>
      <span className="hub-stat__label">{label}</span>
      <span className="hub-stat__value">{value}</span>
      {hint && <span className="hub-stat__hint">{hint}</span>}
    </div>
  )
}

function CostCard({ running, hourlyRate }) {
  const saved = running ? 0 : (hourlyRate * 20).toFixed(2)
  const pctSaved = running ? 0 : 100

  return (
    <div className="hub-card hub-cost">
      <span className="hub-card__eyebrow">Estimated Savings</span>
      <div className="hub-cost__amount">${saved}<span className="hub-cost__period"> / month est.</span></div>
      <div className="hub-cost__bar-track">
        <div className="hub-cost__bar-fill" style={{ width: `${pctSaved}%` }} />
      </div>
      <span className="hub-cost__note">
        {running ? 'Instance running -- no savings accruing' : `Saving ~$${hourlyRate}/hr while stopped`}
      </span>
    </div>
  )
}

function RecentAlerts({ alerts, loading, onViewAll }) {
  return (
    <div className="hub-card hub-alerts">
      <div className="hub-alerts__header">
        <h3 className="hub-card__title">Recent Threats</h3>
        <button className="hub-link-btn" onClick={onViewAll}>View all</button>
      </div>

      {loading ? (
        <div className="hub-alerts__loading">Loading alerts...</div>
      ) : alerts.length === 0 ? (
        <div className="hub-alerts__empty">No recent alerts</div>
      ) : (
        <ul className="hub-alerts__list">
          {alerts.map((a, i) => (
            <li key={a.id || i} className="hub-alerts__item">
              <span className={`hub-alerts__sev ${severityClass(a.severity)}`}>
                {severityLabel(a.severity)}
              </span>
              <div className="hub-alerts__detail">
                <span className="hub-alerts__sig">{a.signature || a.alert?.signature || 'Unknown signature'}</span>
                <span className="hub-alerts__meta">{a.src_ip || a.sourceIP || '--'} &rarr; {a.dest_ip || a.destIP || '--'}</span>
              </div>
              <time className="hub-alerts__time">{timeAgo(a.timestamp)}</time>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function QuickActions({ onNavigate }) {
  const actions = [
    {
      key: 'alerts',
      label: 'View All Alerts',
      desc: 'Full Suricata event table',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
    },
    {
      key: 'terminal',
      label: 'Open Terminal',
      desc: 'SSH / SSM into instances',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
        </svg>
      ),
    },
    {
      key: 'chat',
      label: 'Chat with AI',
      desc: 'Threat analysis assistant',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        </svg>
      ),
    },
  ]

  return (
    <div className="hub-actions">
      {actions.map(a => (
        <button
          key={a.key}
          className="hub-card hub-action"
          onClick={() => {
            if (a.key === 'chat') {
              // Toggle the floating chat
              const btn = document.querySelector('.chat-assistant__toggle')
              if (btn) btn.click()
            } else {
              onNavigate(a.key)
            }
          }}
        >
          <span className="hub-action__icon" aria-hidden="true">{a.icon}</span>
          <span className="hub-action__label">{a.label}</span>
          <span className="hub-action__desc">{a.desc}</span>
        </button>
      ))}
    </div>
  )
}

// --- Main Page ---

export default function QuickAccessHub({ onNavigate }) {
  const [honeypotStatus, setHoneypotStatus] = useState('running')
  const [isToggling, setIsToggling] = useState(false)
  const [recentAlerts, setRecentAlerts] = useState([])
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [stats, setStats] = useState({
    totalToday: '--',
    uniqueIPs: '--',
    topAttack: '--',
    highSev: '--',
  })

  // Fetch recent alerts
  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true)
    try {
      if (API_URL) {
        const res = await fetch(`${API_URL}/events?limit=8`)
        if (res.ok) {
          const data = await res.json()
          const items = Array.isArray(data) ? data : data.events || []
          setRecentAlerts(items.slice(0, 8))

          // Compute quick stats from this batch
          const unique = new Set(items.map(e => e.src_ip || e.sourceIP)).size
          const high = items.filter(e => (e.severity || 4) <= 2).length
          const sigCounts = {}
          items.forEach(e => {
            const sig = e.alert?.category || e.category || 'unknown'
            sigCounts[sig] = (sigCounts[sig] || 0) + 1
          })
          const topSig = Object.entries(sigCounts).sort((a, b) => b[1] - a[1])[0]

          setStats({
            totalToday: items.length.toLocaleString(),
            uniqueIPs: unique.toLocaleString(),
            topAttack: topSig ? topSig[0] : '--',
            highSev: high.toLocaleString(),
          })
          setAlertsLoading(false)
          return
        }
      }
    } catch {
      // fall through to mock
    }

    // Mock fallback
    const mock = [
      { id: '1', timestamp: new Date(Date.now() - 120000).toISOString(), severity: 1, sourceIP: '203.0.113.45', destIP: '10.0.0.5', signature: 'ET TROJAN Suspicious Outbound Connection', category: 'trojan' },
      { id: '2', timestamp: new Date(Date.now() - 300000).toISOString(), severity: 2, sourceIP: '198.51.100.22', destIP: '10.0.0.5', signature: 'ET SCAN Nmap OS Detection', category: 'scan' },
      { id: '3', timestamp: new Date(Date.now() - 480000).toISOString(), severity: 3, sourceIP: '192.0.2.10', destIP: '10.0.0.8', signature: 'ET INFO HTTP Request to .ru Domain', category: 'info' },
      { id: '4', timestamp: new Date(Date.now() - 600000).toISOString(), severity: 2, sourceIP: '203.0.113.80', destIP: '10.0.0.5', signature: 'ET EXPLOIT Apache Struts RCE', category: 'exploit' },
      { id: '5', timestamp: new Date(Date.now() - 900000).toISOString(), severity: 1, sourceIP: '198.51.100.55', destIP: '10.0.0.5', signature: 'ET MALWARE Cobalt Strike Beacon', category: 'malware' },
    ]
    setRecentAlerts(mock)
    setStats({ totalToday: '247', uniqueIPs: '38', topAttack: 'Port Scan', highSev: '12' })
    setAlertsLoading(false)
  }, [])

  useEffect(() => {
    fetchAlerts()
    const interval = setInterval(fetchAlerts, 30000)
    return () => clearInterval(interval)
  }, [fetchAlerts])

  const handleToggleHoneypot = async () => {
    setIsToggling(true)
    // Simulate API call
    await new Promise(r => setTimeout(r, 1500))
    setHoneypotStatus(prev => (prev === 'running' ? 'stopped' : 'running'))
    setIsToggling(false)
  }

  const isRunning = honeypotStatus === 'running'

  return (
    <div className="hub">
      <header className="hub__header">
        <div>
          <h2 className="hub__title">Overview</h2>
          <p className="hub__subtitle">Monitor and manage your honeypot infrastructure.</p>
        </div>
      </header>

      {/* KPI Strip */}
      <div className="hub__kpis">
        <StatCard label="Attacks Today" value={stats.totalToday} variant="default" />
        <StatCard label="Unique Source IPs" value={stats.uniqueIPs} variant="default" />
        <StatCard label="High Severity" value={stats.highSev} variant="danger" />
        <StatCard label="Top Category" value={stats.topAttack} variant="default" />
      </div>

      {/* Two-column layout */}
      <div className="hub__grid">
        {/* Left column */}
        <div className="hub__col hub__col--primary">
          <HoneypotStatusCard
            status={honeypotStatus}
            onToggle={handleToggleHoneypot}
            isToggling={isToggling}
          />
          <RecentAlerts
            alerts={recentAlerts}
            loading={alertsLoading}
            onViewAll={() => onNavigate('alerts')}
          />
        </div>

        {/* Right column */}
        <div className="hub__col hub__col--secondary">
          <CostCard running={isRunning} hourlyRate={0.0116} />
          <div className="hub-card hub-quick-section">
            <h3 className="hub-card__title">Quick Actions</h3>
            <QuickActions onNavigate={onNavigate} />
          </div>
        </div>
      </div>
    </div>
  )
}
