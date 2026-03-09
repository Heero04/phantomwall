import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '../components/HoneypotFleetManager.css'

const API_URL = import.meta.env.VITE_SURICATA_API_URL

/* ═══════════════════════════════════════════════════════════════
   Realistic 6-instance fleet across 3 AZs
   ═══════════════════════════════════════════════════════════════ */
const FALLBACK_FLEET = [
  {
    instance_id: 'i-00c7a2a4fec3c9835',
    name: 'honeypot-ssh-east',
    trap_type: 'SSH',
    instance_type: 't3.micro',
    az: 'us-east-1a',
    status: 'running',
    region: 'us-east-1',
    last_seen: '2026-02-22T15:10:00Z',
    public_ip: '34.224.10.81',
    health_checks: { system: 'ok', instance: 'ok' },
    ssm_connected: true,
    cpu: 34,
    ram: 52,
  },
  {
    instance_id: 'i-0467a8548853a59a0',
    name: 'honeypot-http-east',
    trap_type: 'HTTP',
    instance_type: 't3.small',
    az: 'us-east-1b',
    status: 'stopped',
    region: 'us-east-1',
    last_seen: '2026-02-22T14:48:00Z',
    public_ip: '44.197.56.102',
    health_checks: { system: 'n/a', instance: 'n/a' },
    ssm_connected: false,
    cpu: 0,
    ram: 0,
  },
  {
    instance_id: 'i-0f4fcbec341ab2499',
    name: 'honeypot-telnet-lab',
    trap_type: 'Telnet',
    instance_type: 't3.micro',
    az: 'us-east-1a',
    status: 'running',
    region: 'us-east-1',
    last_seen: '2026-02-22T15:12:00Z',
    public_ip: '18.215.220.17',
    health_checks: { system: 'ok', instance: 'ok' },
    ssm_connected: true,
    cpu: 78,
    ram: 61,
  },
  {
    instance_id: 'i-0a83d91fc2e74b102',
    name: 'honeypot-ssh-bravo',
    trap_type: 'SSH',
    instance_type: 't3.micro',
    az: 'us-east-1c',
    status: 'running',
    region: 'us-east-1',
    last_seen: '2026-02-22T15:11:30Z',
    public_ip: '54.89.112.44',
    health_checks: { system: 'ok', instance: 'ok' },
    ssm_connected: true,
    cpu: 12,
    ram: 38,
  },
  {
    instance_id: 'i-07bb6e4ad3c150f88',
    name: 'honeypot-rdp-canary',
    trap_type: 'RDP',
    instance_type: 't3.medium',
    az: 'us-east-1b',
    status: 'running',
    region: 'us-east-1',
    last_seen: '2026-02-22T15:13:10Z',
    public_ip: '3.95.22.178',
    health_checks: { system: 'ok', instance: 'initializing' },
    ssm_connected: true,
    cpu: 91,
    ram: 84,
  },
  {
    instance_id: 'i-0de0f37851a4c6e01',
    name: 'honeypot-dns-trap',
    trap_type: 'DNS',
    instance_type: 't3.nano',
    az: 'us-east-1c',
    status: 'pending',
    region: 'us-east-1',
    last_seen: '2026-02-22T15:14:00Z',
    public_ip: null,
    health_checks: { system: 'initializing', instance: 'initializing' },
    ssm_connected: false,
    cpu: 5,
    ram: 14,
  },
]

const ACTIONS = ['start', 'stop', 'reboot']

/* ── Helpers ──────────────────────────────────────────────────── */
const statusClass = (status) => {
  const n = String(status || '').toLowerCase()
  if (n === 'running') return 'fleet__status fleet__status--running'
  if (n === 'stopped') return 'fleet__status fleet__status--stopped'
  return 'fleet__status fleet__status--pending'
}

const asLocalTime = (iso) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

const ago = (iso) => {
  const diff = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(diff) || diff < 0) return '-'
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m ago`
  return `${Math.floor(h / 24)}d ago`
}

const healthCheckLabel = (hc) => {
  if (!hc) return { text: 'N/A', ok: false, count: 0, total: 2 }
  const sys = hc.system === 'ok' ? 1 : 0
  const inst = hc.instance === 'ok' ? 1 : 0
  const passed = sys + inst
  if (hc.system === 'n/a') return { text: 'N/A', ok: false, count: 0, total: 2 }
  return { text: `${passed}/2 Passed`, ok: passed === 2, count: passed, total: 2 }
}

const clampPct = (v) => Math.max(0, Math.min(100, Math.round(v || 0)))

const resourceLevel = (pct) => {
  if (pct >= 85) return 'critical'
  if (pct >= 60) return 'warn'
  return 'ok'
}

const TRAP_ICONS = {
  SSH: '🔑', HTTP: '🌐', Telnet: '📟', RDP: '🖥️', DNS: '🌍',
}

/* ── SVG Donut Ring ───────────────────────────────────────────── */
function FleetRing({ running, stopped, pending, total }) {
  const r = 54
  const C = 2 * Math.PI * r
  const pctRun = total ? running / total : 0
  const pctStop = total ? stopped / total : 0
  const pctPend = total ? pending / total : 0

  return (
    <svg className="fleet__ring" viewBox="0 0 128 128" aria-label="Fleet health ring">
      <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(100,116,139,0.15)" strokeWidth="12" />
      {/* Running – green */}
      <circle
        cx="64" cy="64" r={r} fill="none"
        stroke="#4ade80" strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${C * pctRun} ${C * (1 - pctRun)}`}
        strokeDashoffset={C * 0.25}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      {/* Stopped – red */}
      <circle
        cx="64" cy="64" r={r} fill="none"
        stroke="#f87171" strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${C * pctStop} ${C * (1 - pctStop)}`}
        strokeDashoffset={C * 0.25 - C * pctRun}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      {/* Pending – amber */}
      <circle
        cx="64" cy="64" r={r} fill="none"
        stroke="#fbbf24" strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${C * pctPend} ${C * (1 - pctPend)}`}
        strokeDashoffset={C * 0.25 - C * (pctRun + pctStop)}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x="64" y="58" textAnchor="middle" fill="#ffffff" fontSize="22" fontWeight="700">{total}</text>
      <text x="64" y="76" textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="600">INSTANCES</text>
    </svg>
  )
}

/* ── AZ Distribution Bar ──────────────────────────────────────── */
function AZBar({ fleet }) {
  const azCounts = {}
  fleet.forEach((item) => {
    const az = item.az || 'unknown'
    azCounts[az] = (azCounts[az] || 0) + 1
  })
  const azList = Object.entries(azCounts).sort(([a], [b]) => a.localeCompare(b))
  const total = fleet.length || 1
  const AZ_COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#ec4899', '#10b981']

  return (
    <div className="fleet__az-bar-wrap">
      <h4 className="fleet__az-bar-title">Availability Zone Distribution</h4>
      <div className="fleet__az-bar">
        {azList.map(([az, count], i) => (
          <div
            key={az}
            className="fleet__az-segment"
            style={{
              width: `${(count / total) * 100}%`,
              background: AZ_COLORS[i % AZ_COLORS.length],
            }}
            title={`${az}: ${count} instance${count > 1 ? 's' : ''}`}
          />
        ))}
      </div>
      <div className="fleet__az-legend">
        {azList.map(([az, count], i) => (
          <span key={az} className="fleet__az-legend-item">
            <span className="fleet__az-legend-dot" style={{ background: AZ_COLORS[i % AZ_COLORS.length] }} />
            {az} <strong>{count}</strong>
          </span>
        ))}
      </div>
    </div>
  )
}

/* ── Instance Card (for card view) ────────────────────────────── */
function InstanceCard({ item, busyAction, onAction, onDestroy }) {
  const hc = healthCheckLabel(item.health_checks)
  const cpu = clampPct(item.cpu)
  const ram = clampPct(item.ram)
  const isStopped = String(item.status).toLowerCase() === 'stopped'
  const icon = TRAP_ICONS[item.trap_type] || '🔲'

  return (
    <article className={`fleet__card ${isStopped ? 'fleet__card--stopped' : ''}`}>
      <div className="fleet__card-header">
        <span className="fleet__card-icon">{icon}</span>
        <div>
          <strong className="fleet__card-name">{item.name}</strong>
          <span className="fleet__card-id">{item.instance_id}</span>
        </div>
        <span className={statusClass(item.status)}>{item.status || 'unknown'}</span>
      </div>

      <div className="fleet__card-meta">
        <div className="fleet__card-meta-item">
          <span className="fleet__card-meta-label">Type</span>
          <span className="fleet__type-badge">{item.instance_type}</span>
        </div>
        <div className="fleet__card-meta-item">
          <span className="fleet__card-meta-label">AZ</span>
          <span className="fleet__az-badge">{item.az}</span>
        </div>
        <div className="fleet__card-meta-item">
          <span className="fleet__card-meta-label">IP</span>
          <span className="fleet__card-meta-value">{item.public_ip || '—'}</span>
        </div>
        <div className="fleet__card-meta-item">
          <span className="fleet__card-meta-label">Seen</span>
          <span className="fleet__card-meta-value">{ago(item.last_seen)}</span>
        </div>
      </div>

      <div className="fleet__card-health-row">
        <span className={`fleet__health-badge ${hc.ok ? 'fleet__health-badge--ok' : ''}`}>
          {hc.ok ? '✓' : '–'} {hc.text}
        </span>
        <span className={`fleet__ssm-indicator ${item.ssm_connected ? 'fleet__ssm-indicator--online' : ''}`}>
          <span className="fleet__ssm-dot" />
          SSM {item.ssm_connected ? 'Online' : 'Offline'}
        </span>
      </div>

      {!isStopped && (
        <div className="fleet__card-meters">
          <div className="fleet__meter">
            <span className="fleet__meter-label">CPU</span>
            <div className="fleet__meter-track">
              <div
                className={`fleet__meter-fill fleet__meter-fill--${resourceLevel(cpu)}`}
                style={{ width: `${cpu}%` }}
              />
            </div>
            <span className="fleet__meter-pct">{cpu}%</span>
          </div>
          <div className="fleet__meter">
            <span className="fleet__meter-label">RAM</span>
            <div className="fleet__meter-track">
              <div
                className={`fleet__meter-fill fleet__meter-fill--${resourceLevel(ram)}`}
                style={{ width: `${ram}%` }}
              />
            </div>
            <span className="fleet__meter-pct">{ram}%</span>
          </div>
        </div>
      )}

      <div className="fleet__card-actions">
        {ACTIONS.map((action) => {
          const key = `${item.instance_id}:${action}`
          const pending = busyAction === key
          return (
            <button
              key={action}
              type="button"
              className={`fleet__action-btn fleet__action-btn--${action}`}
              disabled={Boolean(busyAction)}
              onClick={() => onAction(item, action)}
            >
              {pending ? '...' : action.toUpperCase()}
            </button>
          )
        })}
        <button
          type="button"
          className="fleet__action-btn fleet__action-btn--destroy"
          disabled={Boolean(busyAction)}
          onClick={() => onDestroy(item)}
          title="Terminate this honeypot permanently"
        >
          {busyAction === `${item.instance_id}:destroy` ? '...' : '🗑️ DESTROY'}
        </button>
      </div>
    </article>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */
export default function HoneypotFleetManager() {
  const [fleet, setFleet] = useState([])
  const [trapType, setTrapType] = useState('all')
  const [region, setRegion] = useState('us-east-1')
  const [controlMode, setControlMode] = useState('ssm')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busyAction, setBusyAction] = useState('')
  const [viewMode, setViewMode] = useState('cards') // 'cards' | 'table'

  /* ── Deploy Modal State ─────────────────────────────────────── */
  const [showDeployModal, setShowDeployModal] = useState(false)
  const [deployConfig, setDeployConfig] = useState({
    name: '',
    instance_type: 't3a.small',
    trap_profile: 'default',
  })
  const [deploying, setDeploying] = useState(false)
  const [deployResult, setDeployResult] = useState(null)

  /* ── WAF / Edge Security State ──────────────────────────────── */
  const [wafRateLimiting, setWafRateLimiting] = useState(true)
  const [wafGeoBlocking, setWafGeoBlocking] = useState(false)
  const [wafSqlInjection, setWafSqlInjection] = useState(true)
  const [wafXssProtection, setWafXssProtection] = useState(true)
  const [wafBotDetection, setWafBotDetection] = useState(false)
  const [wafBlockedIPs, setWafBlockedIPs] = useState(0)
  const [wafLockdownActive, setWafLockdownActive] = useState(false)
  const [wafLoading, setWafLoading] = useState(false)

  /* ── Simulated real-time CPU/RAM jitter ──────────────────────── */
  const metricsTimer = useRef(null)

  const jitterMetrics = useCallback(() => {
    setFleet((prev) =>
      prev.map((item) => {
        if (String(item.status).toLowerCase() !== 'running' && String(item.status).toLowerCase() !== 'pending') return item
        const jitter = () => Math.round((Math.random() - 0.5) * 8)
        return {
          ...item,
          cpu: clampPct((item.cpu || 30) + jitter()),
          ram: clampPct((item.ram || 45) + jitter()),
        }
      })
    )
  }, [])

  useEffect(() => {
    metricsTimer.current = setInterval(jitterMetrics, 4000)
    return () => clearInterval(metricsTimer.current)
  }, [jitterMetrics])

  /* ── WAF: Fetch real status from API ─────────────────────────── */
  const fetchWafStatus = useCallback(async () => {
    if (!API_URL) return
    try {
      const res = await fetch(`${API_URL}/waf/status`)
      if (!res.ok) return
      const data = await res.json()
      const rules = data.rules || {}
      setWafRateLimiting(!!rules.rate_limiting)
      setWafSqlInjection(!!rules.sql_injection)
      setWafXssProtection(!!rules.xss_protection)
      setWafGeoBlocking(!!rules.geo_blocking)
      setWafBotDetection(!!rules.bot_detection)
      setWafBlockedIPs(data.blocked_ips_count || 0)
      setWafLockdownActive(!!data.lockdown_active)
    } catch (err) {
      console.error('WAF status fetch failed:', err)
    }
  }, [])

  useEffect(() => {
    fetchWafStatus()
    const wafPoll = setInterval(fetchWafStatus, 30000)
    return () => clearInterval(wafPoll)
  }, [fetchWafStatus])

  const handleToggleWafRule = async (ruleName, enabled) => {
    if (!API_URL) return
    setWafLoading(true)
    try {
      await fetch(`${API_URL}/waf/toggle-rule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule_name: ruleName, enabled }),
      })
      await fetchWafStatus()
    } catch (err) {
      console.error(`WAF toggle ${ruleName} failed:`, err)
      setError(`Failed to toggle ${ruleName}`)
    } finally {
      setWafLoading(false)
    }
  }

  const handleLockdown = async () => {
    if (!API_URL) return
    setWafLoading(true)
    const activate = !wafLockdownActive
    try {
      await fetch(`${API_URL}/waf/lockdown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activate }),
      })
      await fetchWafStatus()
      setMessage(activate
        ? '🔒 LOCKDOWN ACTIVATED — All traffic blocked except allowlist.'
        : '🔓 Lockdown released — returning to standard WAF posture.'
      )
    } catch (err) {
      console.error('WAF lockdown failed:', err)
      setError('Failed to toggle lockdown')
    } finally {
      setWafLoading(false)
    }
  }

  const filteredFleet = useMemo(() => {
    return fleet.filter((item) => {
      const typeMatch = trapType === 'all' || item.trap_type.toLowerCase() === trapType
      const regionMatch = !region || item.region === region
      return typeMatch && regionMatch
    })
  }, [fleet, trapType, region])

  const fleetSummary = useMemo(() => {
    const totals = { running: 0, stopped: 0, pending: 0, ssmOnline: 0, healthOk: 0 }
    filteredFleet.forEach((item) => {
      const state = String(item.status || '').toLowerCase()
      if (state === 'running') totals.running += 1
      else if (state === 'stopped') totals.stopped += 1
      else totals.pending += 1
      if (item.ssm_connected) totals.ssmOnline += 1
      const hc = healthCheckLabel(item.health_checks)
      if (hc.ok) totals.healthOk += 1
    })
    return totals
  }, [filteredFleet])

  const refreshFleet = async () => {
    if (!API_URL) {
      setFleet(FALLBACK_FLEET)
      setMessage('Using local fleet snapshot — set VITE_SURICATA_API_URL for live AWS data.')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    try {
      const params = new URLSearchParams()
      params.set('region', region)
      if (trapType !== 'all') params.set('trap_type', trapType)

      const response = await fetch(`${API_URL}/fleet/instances?${params}`)
      if (!response.ok) throw new Error(`Fleet request failed (${response.status})`)
      const payload = await response.json()
      const items = Array.isArray(payload?.items) ? payload.items : (Array.isArray(payload) ? payload : [])
      if (items.length === 0) {
        setFleet(FALLBACK_FLEET)
        setMessage('No tagged instances found in AWS — showing demo fleet. Tag instances with Project=phantomwall.')
      } else {
        setFleet(items)
        setMessage(`Fleet refreshed — ${items.length} instance${items.length > 1 ? 's' : ''} from AWS.`)
      }
    } catch (err) {
      setFleet(FALLBACK_FLEET)
      setError(`${err.message} — showing demo fleet as fallback.`)
    } finally {
      setLoading(false)
    }
  }

  const runAction = async (instance, action) => {
    const actionKey = `${instance.instance_id}:${action}`
    setBusyAction(actionKey)
    setError('')
    setMessage('')

    if (!API_URL) {
      setMessage(`Dry-run: ${action.toUpperCase()} queued for ${instance.name} via ${controlMode.toUpperCase()}.`)
      setBusyAction('')
      return
    }

    try {
      const response = await fetch(`${API_URL}/fleet/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instance_id: instance.instance_id,
          trap_type: instance.trap_type.toLowerCase(),
          action,
          mode: controlMode,
          region: instance.region,
        }),
      })

      if (!response.ok) throw new Error(`Action failed (${response.status})`)
      const payload = await response.json()
      setMessage(payload.message || `${action.toUpperCase()} sent for ${instance.name}.`)
      await refreshFleet()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyAction('')
    }
  }

  /* ── Deploy a new honeypot ──────────────────────────────────── */
  const handleDeploy = async () => {
    if (!API_URL) {
      setMessage(`Dry-run: Would deploy "${deployConfig.name || 'auto-named'}" (${deployConfig.trap_profile}) on ${deployConfig.instance_type}.`)
      setShowDeployModal(false)
      return
    }

    setDeploying(true)
    setError('')
    setMessage('')
    setDeployResult(null)

    try {
      const response = await fetch(`${API_URL}/fleet/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deployConfig),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || `Deploy failed (${response.status})`)
      }

      setDeployResult(payload)
      setMessage(`✅ Honeypot "${payload.name}" deployed — ${payload.instance_id} (${payload.current_count}/${payload.max_allowed} slots used)`)
      // Refresh fleet list after short delay for instance to register
      setTimeout(() => refreshFleet(), 3000)
    } catch (err) {
      setError(`Deploy failed: ${err.message}`)
    } finally {
      setDeploying(false)
    }
  }

  /* ── Destroy / terminate a honeypot ─────────────────────────── */
  const handleDestroy = async (instance) => {
    const confirmed = window.confirm(
      `⚠️ Terminate honeypot "${instance.name}" (${instance.instance_id})?\n\nThis will permanently destroy the instance.`
    )
    if (!confirmed) return

    if (!API_URL) {
      setMessage(`Dry-run: Would terminate ${instance.name} (${instance.instance_id}).`)
      return
    }

    setBusyAction(`${instance.instance_id}:destroy`)
    setError('')
    setMessage('')

    try {
      const response = await fetch(`${API_URL}/fleet/destroy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance_id: instance.instance_id }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || `Destroy failed (${response.status})`)
      }

      setMessage(`🗑️ Honeypot "${payload.name}" termination initiated.`)
      setTimeout(() => refreshFleet(), 2000)
    } catch (err) {
      setError(`Destroy failed: ${err.message}`)
    } finally {
      setBusyAction('')
    }
  }

  useEffect(() => {
    if (!API_URL) {
      setFleet(FALLBACK_FLEET)
      setMessage('Using local fleet snapshot — set VITE_SURICATA_API_URL for live AWS data.')
      return
    }
    refreshFleet()
  }, [API_URL, region, trapType])

  /* ═════════════════════════════════════════════════════════════ */
  return (
    <section className="fleet">

      {/* ── Hero with Ring + Stats ────────────────────────────── */}
      <header className="fleet__hero">
        <div className="fleet__hero-left">
          <p className="fleet__eyebrow">Fleet Operations Console</p>
          <h2>Honeypot Fleet Manager</h2>
          <p className="fleet__hero-sub">
            Real-time management of distributed honeypot traps across AWS regions.
            Monitor health checks, SSM agent status, and resource utilisation from a single pane.
          </p>
          <div className="fleet__hero-kpis">
            <div className="fleet__kpi fleet__kpi--green">
              <strong>{fleetSummary.running}</strong><span>Running</span>
            </div>
            <div className="fleet__kpi fleet__kpi--red">
              <strong>{fleetSummary.stopped}</strong><span>Stopped</span>
            </div>
            <div className="fleet__kpi fleet__kpi--amber">
              <strong>{fleetSummary.pending}</strong><span>Pending</span>
            </div>
            <div className="fleet__kpi fleet__kpi--cyan">
              <strong>{fleetSummary.ssmOnline}</strong><span>SSM Online</span>
            </div>
            <div className="fleet__kpi fleet__kpi--emerald">
              <strong>{fleetSummary.healthOk}</strong><span>Health OK</span>
            </div>
          </div>
        </div>
        <div className="fleet__hero-right">
          <FleetRing
            running={fleetSummary.running}
            stopped={fleetSummary.stopped}
            pending={fleetSummary.pending}
            total={filteredFleet.length}
          />
        </div>
      </header>

      {/* ── AZ Topology ──────────────────────────────────────── */}
      <AZBar fleet={filteredFleet} />

      {/* ── Edge Security (WAF) ──────────────────────────────── */}
      <section className={`fleet__waf ${wafLockdownActive ? 'fleet__waf--lockdown' : ''}`}>
        <div className="fleet__waf-header">
          <div className="fleet__waf-title-row">
            <span className="fleet__waf-icon">🛡️</span>
            <div>
              <h3 className="fleet__waf-title">Edge Security (WAF)</h3>
              <p className="fleet__waf-subtitle">Web Application Firewall — perimeter defence rules</p>
            </div>
          </div>
          <div className="fleet__waf-header-right">
            <div className="fleet__waf-blocked">
              <span className="fleet__waf-blocked-count">{wafBlockedIPs.toLocaleString()}</span>
              <span className="fleet__waf-blocked-label">Active Blocks</span>
            </div>
            <button
              type="button"
              className={`fleet__waf-lockdown-btn ${wafLockdownActive ? 'fleet__waf-lockdown-btn--active' : ''}`}
              onClick={handleLockdown}
            >
              {wafLockdownActive ? '🔒 Lockdown Active' : '🔓 Enable Lockdown'}
            </button>
          </div>
        </div>

        <div className="fleet__waf-rules">
          {/* Rate Limiting */}
          <div className="fleet__waf-rule">
            <div className="fleet__waf-rule-info">
              <span className="fleet__waf-rule-icon">⚡</span>
              <div>
                <strong>Rate Limiting</strong>
                <span>Block brute-force &amp; DDoS attempts</span>
              </div>
            </div>
            <label className="fleet__waf-toggle">
              <input
                type="checkbox"
                checked={wafRateLimiting}
                disabled={wafLoading}
                onChange={() => handleToggleWafRule('rate_limiting', !wafRateLimiting)}
              />
              <span className="fleet__waf-toggle-slider" />
            </label>
          </div>

          {/* SQL Injection */}
          <div className="fleet__waf-rule">
            <div className="fleet__waf-rule-info">
              <span className="fleet__waf-rule-icon">💉</span>
              <div>
                <strong>SQL Injection Protection</strong>
                <span>Block malicious SQL payloads</span>
              </div>
            </div>
            <label className="fleet__waf-toggle">
              <input
                type="checkbox"
                checked={wafSqlInjection}
                disabled={wafLoading}
                onChange={() => handleToggleWafRule('sql_injection', !wafSqlInjection)}
              />
              <span className="fleet__waf-toggle-slider" />
            </label>
          </div>

          {/* XSS Protection */}
          <div className="fleet__waf-rule">
            <div className="fleet__waf-rule-info">
              <span className="fleet__waf-rule-icon">🧬</span>
              <div>
                <strong>XSS Protection</strong>
                <span>Block cross-site scripting vectors</span>
              </div>
            </div>
            <label className="fleet__waf-toggle">
              <input
                type="checkbox"
                checked={wafXssProtection}
                disabled={wafLoading}
                onChange={() => handleToggleWafRule('xss_protection', !wafXssProtection)}
              />
              <span className="fleet__waf-toggle-slider" />
            </label>
          </div>

          {/* Geo-Blocking */}
          <div className="fleet__waf-rule">
            <div className="fleet__waf-rule-info">
              <span className="fleet__waf-rule-icon">🌍</span>
              <div>
                <strong>Geo-Blocking</strong>
                <span>Restrict traffic by geographic origin</span>
              </div>
            </div>
            <label className="fleet__waf-toggle">
              <input
                type="checkbox"
                checked={wafGeoBlocking}
                disabled={wafLoading}
                onChange={() => handleToggleWafRule('geo_blocking', !wafGeoBlocking)}
              />
              <span className="fleet__waf-toggle-slider" />
            </label>
          </div>

          {/* Bot Detection */}
          <div className="fleet__waf-rule">
            <div className="fleet__waf-rule-info">
              <span className="fleet__waf-rule-icon">🤖</span>
              <div>
                <strong>Bot Detection</strong>
                <span>AI-powered bot traffic filtering</span>
              </div>
            </div>
            <label className="fleet__waf-toggle">
              <input
                type="checkbox"
                checked={wafBotDetection}
                disabled={wafLoading}
                onChange={() => handleToggleWafRule('bot_detection', !wafBotDetection)}
              />
              <span className="fleet__waf-toggle-slider" />
            </label>
          </div>
        </div>

        <div className="fleet__waf-footer">
          <span className="fleet__waf-footer-status">
            <span className={`fleet__waf-footer-dot ${[wafRateLimiting, wafSqlInjection, wafXssProtection, wafGeoBlocking, wafBotDetection].filter(Boolean).length >= 3 ? 'fleet__waf-footer-dot--ok' : 'fleet__waf-footer-dot--warn'}`} />
            {[wafRateLimiting, wafSqlInjection, wafXssProtection, wafGeoBlocking, wafBotDetection].filter(Boolean).length}/5 Rules Active
          </span>
          <span className="fleet__waf-footer-ts">Last sync: {new Date().toLocaleTimeString()}</span>
        </div>
      </section>

      {/* ── Controls ─────────────────────────────────────────── */}
      <section className="fleet__controls">
        <div className="fleet__control-row">
          <label>
            <span>Trap Type</span>
            <select value={trapType} onChange={(e) => setTrapType(e.target.value)}>
              <option value="all">All traps</option>
              <option value="ssh">SSH</option>
              <option value="http">HTTP</option>
              <option value="telnet">Telnet</option>
              <option value="rdp">RDP</option>
              <option value="dns">DNS</option>
            </select>
          </label>

          <label>
            <span>Region</span>
            <select value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="us-east-1">us-east-1</option>
              <option value="us-east-2">us-east-2</option>
              <option value="us-west-2">us-west-2</option>
            </select>
          </label>

          <label>
            <span>AWS Control Mode</span>
            <select value={controlMode} onChange={(e) => setControlMode(e.target.value)}>
              <option value="ssm">SSM RunCommand</option>
              <option value="ec2">EC2 Instance API</option>
            </select>
          </label>

          <div className="fleet__control-buttons">
            <button
              type="button"
              onClick={() => { setDeployResult(null); setShowDeployModal(true) }}
              className="fleet__btn-deploy"
            >
              🚀 Deploy Honeypot
            </button>
            <button type="button" onClick={refreshFleet} disabled={loading} className="fleet__btn-refresh">
              {loading ? 'Refreshing…' : '⟳ Refresh'}
            </button>
            <div className="fleet__view-toggle">
              <button
                type="button"
                className={`fleet__view-btn ${viewMode === 'cards' ? 'fleet__view-btn--active' : ''}`}
                onClick={() => setViewMode('cards')}
                title="Card view"
              >
                ▦
              </button>
              <button
                type="button"
                className={`fleet__view-btn ${viewMode === 'table' ? 'fleet__view-btn--active' : ''}`}
                onClick={() => setViewMode('table')}
                title="Table view"
              >
                ☰
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Alerts ───────────────────────────────────────────── */}
      {error && <div className="fleet__alert fleet__alert--error">{error}</div>}
      {message && <div className="fleet__alert fleet__alert--info">{message}</div>}

      {/* ── Card View ────────────────────────────────────────── */}
      {viewMode === 'cards' && (
        <section className="fleet__card-grid">
          {filteredFleet.map((item) => (
            <InstanceCard
              key={item.instance_id}
              item={item}
              busyAction={busyAction}
              onAction={runAction}
              onDestroy={handleDestroy}
            />
          ))}
          {filteredFleet.length === 0 && (
            <p className="fleet__empty">No fleet instances found for current filters.</p>
          )}
        </section>
      )}

      {/* ── Table View ───────────────────────────────────────── */}
      {viewMode === 'table' && (
        <section className="fleet__table-wrap">
          <table className="fleet__table">
            <thead>
              <tr>
                <th>Trap</th>
                <th>Instance</th>
                <th>AZ / Type</th>
                <th>Status</th>
                <th>Health &amp; SSM</th>
                <th>Resources</th>
                <th>Last Seen</th>
                <th>AWS Controls</th>
              </tr>
            </thead>
            <tbody>
              {filteredFleet.map((item) => {
                const hc = healthCheckLabel(item.health_checks)
                const cpu = clampPct(item.cpu)
                const ram = clampPct(item.ram)
                const isStopped = String(item.status).toLowerCase() === 'stopped'

                return (
                  <tr key={item.instance_id}>
                    <td>
                      <div className="fleet__trap">
                        <strong>{TRAP_ICONS[item.trap_type] || '🔲'} {item.name}</strong>
                        <span>{item.trap_type}</span>
                      </div>
                    </td>
                    <td>
                      <div className="fleet__mono">{item.instance_id}</div>
                      <small>{item.public_ip || '—'}</small>
                    </td>
                    <td>
                      <div className="fleet__az-type">
                        <span className="fleet__az-badge">{item.az || '-'}</span>
                        <span className="fleet__type-badge">{item.instance_type || '-'}</span>
                      </div>
                    </td>
                    <td><span className={statusClass(item.status)}>{item.status || 'unknown'}</span></td>
                    <td>
                      <div className="fleet__health-col">
                        <span className={`fleet__health-badge ${hc.ok ? 'fleet__health-badge--ok' : ''}`}>
                          {hc.ok ? '✓' : '–'} {hc.text}
                        </span>
                        <span className={`fleet__ssm-indicator ${item.ssm_connected ? 'fleet__ssm-indicator--online' : ''}`}>
                          <span className="fleet__ssm-dot" />
                          SSM {item.ssm_connected ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </td>
                    <td>
                      {isStopped ? (
                        <span className="fleet__resource-na">Instance stopped</span>
                      ) : (
                        <div className="fleet__resource-col">
                          <div className="fleet__meter">
                            <span className="fleet__meter-label">CPU</span>
                            <div className="fleet__meter-track">
                              <div className={`fleet__meter-fill fleet__meter-fill--${resourceLevel(cpu)}`} style={{ width: `${cpu}%` }} />
                            </div>
                            <span className="fleet__meter-pct">{cpu}%</span>
                          </div>
                          <div className="fleet__meter">
                            <span className="fleet__meter-label">RAM</span>
                            <div className="fleet__meter-track">
                              <div className={`fleet__meter-fill fleet__meter-fill--${resourceLevel(ram)}`} style={{ width: `${ram}%` }} />
                            </div>
                            <span className="fleet__meter-pct">{ram}%</span>
                          </div>
                        </div>
                      )}
                    </td>
                    <td>{asLocalTime(item.last_seen)}</td>
                    <td>
                      <div className="fleet__actions">
                        {ACTIONS.map((action) => {
                          const key = `${item.instance_id}:${action}`
                          const pending = busyAction === key
                          return (
                            <button
                              key={action}
                              type="button"
                              className={`fleet__action-btn fleet__action-btn--${action}`}
                              disabled={Boolean(busyAction)}
                              onClick={() => runAction(item, action)}
                            >
                              {pending ? '...' : action.toUpperCase()}
                            </button>
                          )
                        })}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredFleet.length === 0 && (
                <tr><td colSpan="8">No fleet instances found for current filters.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* ── Collapsible Integration Contract ─────────────────── */}
      <details className="fleet__integration">
        <summary>AWS Integration Contract</summary>
        <p>
          Wired for backend routes calling <code>AWS SSM SendCommand</code> or
          <code> EC2 Start/Stop/RebootInstances</code>. Response includes AZ, instance type,
          health checks, SSM status, and CloudWatch metrics.
        </p>
        <pre>{`GET  ${API_URL || 'VITE_SURICATA_API_URL'}/fleet/instances?region=us-east-1&trap_type=ssh

Response schema:
{
  "instance_id": "i-abc123",
  "name": "honeypot-ssh-east",
  "trap_type": "ssh",
  "instance_type": "t3.micro",
  "az": "us-east-1a",
  "status": "running",
  "health_checks": { "system": "ok", "instance": "ok" },
  "ssm_connected": true,
  "cpu": 34, "ram": 52
}

POST ${API_URL || 'VITE_SURICATA_API_URL'}/fleet/action
{ "instance_id": "i-abc123", "action": "reboot", "mode": "ssm" }`}</pre>
      </details>

      {/* ── Deploy Honeypot Modal ────────────────────────────── */}
      {showDeployModal && (
        <div className="fleet__modal-overlay" onClick={() => !deploying && setShowDeployModal(false)}>
          <div className="fleet__modal" onClick={(e) => e.stopPropagation()}>
            <div className="fleet__modal-header">
              <h3>🚀 Deploy New Honeypot</h3>
              <button
                type="button"
                className="fleet__modal-close"
                onClick={() => !deploying && setShowDeployModal(false)}
              >
                ✕
              </button>
            </div>

            {deployResult ? (
              <div className="fleet__modal-body">
                <div className="fleet__deploy-success">
                  <span className="fleet__deploy-success-icon">✅</span>
                  <h4>Honeypot Deployed!</h4>
                  <div className="fleet__deploy-result">
                    <div className="fleet__deploy-result-row">
                      <span>Instance ID</span>
                      <code>{deployResult.instance_id}</code>
                    </div>
                    <div className="fleet__deploy-result-row">
                      <span>Name</span>
                      <strong>{deployResult.name}</strong>
                    </div>
                    <div className="fleet__deploy-result-row">
                      <span>Type</span>
                      <span>{deployResult.instance_type}</span>
                    </div>
                    <div className="fleet__deploy-result-row">
                      <span>Trap Profile</span>
                      <span>{deployResult.trap_profile}</span>
                    </div>
                    <div className="fleet__deploy-result-row">
                      <span>Fleet Capacity</span>
                      <span>{deployResult.current_count}/{deployResult.max_allowed}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="fleet__btn-deploy"
                    onClick={() => setShowDeployModal(false)}
                    style={{ marginTop: '1rem', width: '100%' }}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="fleet__modal-body">
                <label className="fleet__modal-field">
                  <span>Honeypot Name <small>(optional — auto-generated if blank)</small></span>
                  <input
                    type="text"
                    placeholder="e.g. honeypot-ssh-east"
                    value={deployConfig.name}
                    onChange={(e) => setDeployConfig(c => ({ ...c, name: e.target.value }))}
                    disabled={deploying}
                  />
                </label>

                <label className="fleet__modal-field">
                  <span>Trap Profile</span>
                  <select
                    value={deployConfig.trap_profile}
                    onChange={(e) => setDeployConfig(c => ({ ...c, trap_profile: e.target.value }))}
                    disabled={deploying}
                  >
                    <option value="default">🔲 Standard (22, 80, 443, 23, 2222, 8080)</option>
                    <option value="ssh">🔑 SSH (Port 22)</option>
                    <option value="http">🌐 HTTP (Ports 80, 443)</option>
                    <option value="telnet">📟 Telnet (Port 23)</option>
                    <option value="multi">🎯 Multi-Port (All trap ports)</option>
                  </select>
                </label>

                <label className="fleet__modal-field">
                  <span>Instance Type</span>
                  <select
                    value={deployConfig.instance_type}
                    onChange={(e) => setDeployConfig(c => ({ ...c, instance_type: e.target.value }))}
                    disabled={deploying}
                  >
                    <option value="t2.micro">t2.micro — Free tier eligible</option>
                    <option value="t3.micro">t3.micro — $0.0104/hr</option>
                    <option value="t3a.micro">t3a.micro — $0.0094/hr</option>
                    <option value="t3.small">t3.small — $0.0208/hr</option>
                    <option value="t3a.small">t3a.small — $0.0188/hr</option>
                  </select>
                </label>

                <div className="fleet__modal-info">
                  <p>⚡ Launches with Suricata IDS + CloudWatch Agent pre-installed.</p>
                  <p>🛡️ Uses existing honeypot security group &amp; IAM profile.</p>
                  <p>📊 Max 5 honeypots allowed (enforced server-side).</p>
                </div>

                <div className="fleet__modal-actions">
                  <button
                    type="button"
                    className="fleet__btn-refresh"
                    onClick={() => setShowDeployModal(false)}
                    disabled={deploying}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="fleet__btn-deploy"
                    onClick={handleDeploy}
                    disabled={deploying}
                  >
                    {deploying ? '⏳ Deploying…' : '🚀 Deploy'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
