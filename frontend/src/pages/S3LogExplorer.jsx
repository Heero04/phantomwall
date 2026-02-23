import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '../components/S3LogExplorer.css'

const API_URL = import.meta.env.VITE_SURICATA_API_URL

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */
const EVENT_TYPE_COLORS = {
  alert: '#ef4444',
  anomaly: '#f59e0b',
  dns: '#3b82f6',
  flow: '#64748b',
  http: '#10b981',
  tls: '#8b5cf6',
  tcp: '#06b6d4',
  fileinfo: '#ec4899',
  drop: '#dc2626',
  stats: '#9ca3af',
}

const EVENT_TYPE_ICONS = {
  alert: '🚨', anomaly: '⚠️', dns: '🌍', flow: '🔀',
  http: '🌐', tls: '🔒', tcp: '📡', fileinfo: '📁',
  drop: '🚫', stats: '📊',
}

const SEVERITY_MAP = {
  1: { label: 'Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  2: { label: 'Major', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  3: { label: 'Minor', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  4: { label: 'Info', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
}

const PROTOCOLS = ['TCP', 'UDP', 'ICMP']
const LIMITS = [50, 100, 200, 500]

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */
const formatScanCost = (mb) => {
  const value = Number(mb)
  if (Number.isNaN(value)) return '--'
  return `$${((value / 1024) * 5).toFixed(4)}`
}

const formatBytes = (mb) => {
  const value = Number(mb)
  if (Number.isNaN(value)) return '--'
  if (value >= 1024) return `${(value / 1024).toFixed(2)} GB`
  return `${value.toFixed(1)} MB`
}

const copyToClipboard = (text) => {
  navigator.clipboard?.writeText(text)
}

const ago = (iso) => {
  const diff = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(diff) || diff < 0) return '-'
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/* ═══════════════════════════════════════════════════════════════
   KPI Pill Component
   ═══════════════════════════════════════════════════════════════ */
function KpiPill({ icon, label, value, accent = '#06b6d4' }) {
  return (
    <div className="s3x__kpi" style={{ '--kpi-accent': accent }}>
      <span className="s3x__kpi-icon">{icon}</span>
      <div className="s3x__kpi-body">
        <span className="s3x__kpi-value">{value}</span>
        <span className="s3x__kpi-label">{label}</span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */
export default function S3LogExplorer() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [eventType, setEventType] = useState('')
  const [srcIp, setSrcIp] = useState('')
  const [destIp, setDestIp] = useState('')
  const [proto, setProto] = useState('')
  const [limit, setLimit] = useState(100)
  const [logs, setLogs] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedRow, setExpandedRow] = useState(null)
  const [queryHistory, setQueryHistory] = useState([])
  const [queryTime, setQueryTime] = useState(null)
  const [copiedIp, setCopiedIp] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const formRef = useRef(null)

  /* ── Keyboard shortcut: Ctrl+Enter to search ─────────────── */
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        formRef.current?.requestSubmit()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  /* ── Build query params ──────────────────────────────────── */
  const buildParams = useCallback((forcedEventType = null) => {
    const params = new URLSearchParams({ date, limit: String(limit) })
    const selectedEvent = forcedEventType ?? eventType
    if (selectedEvent) params.set('event_type', selectedEvent)
    if (srcIp) params.set('src_ip', srcIp)
    if (destIp) params.set('dest_ip', destIp)
    if (proto) params.set('proto', proto)
    return params
  }, [date, limit, eventType, srcIp, destIp, proto])

  /* ── Fetch logs ──────────────────────────────────────────── */
  const fetchLogs = useCallback(async (forcedEventType = null) => {
    if (!API_URL) {
      setError('API URL is not configured. Set VITE_SURICATA_API_URL in .env')
      return
    }
    setLoading(true)
    setError('')
    const t0 = performance.now()

    try {
      const params = buildParams(forcedEventType)
      const response = await fetch(`${API_URL}/logs?${params}`)
      if (!response.ok) throw new Error(`Athena query failed (${response.status})`)
      const data = await response.json()
      setLogs(data)
      setQueryTime(((performance.now() - t0) / 1000).toFixed(2))

      // Add to history
      const historyEntry = {
        id: Date.now(),
        date,
        eventType: forcedEventType ?? (eventType || 'all'),
        srcIp: srcIp || '*',
        resultCount: data.count || 0,
        scannedMb: data.data_scanned_mb,
        timestamp: new Date().toISOString(),
      }
      setQueryHistory((prev) => [historyEntry, ...prev].slice(0, 10))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [buildParams, date, eventType, srcIp])

  /* ── Fetch summary ───────────────────────────────────────── */
  const fetchSummary = useCallback(async () => {
    if (!API_URL) return
    try {
      const response = await fetch(`${API_URL}/logs?action=summary&date=${date}`)
      if (!response.ok) return
      const data = await response.json()
      setSummary(data)
    } catch {
      // Summary is optional
    }
  }, [date])

  /* ── Handlers ────────────────────────────────────────────── */
  const handleSearch = async (e) => {
    e.preventDefault()
    setExpandedRow(null)
    await Promise.all([fetchLogs(), fetchSummary()])
  }

  const handleEventTypeClick = async (type) => {
    setEventType(type)
    await fetchLogs(type)
  }

  const handleCopyIp = (ip) => {
    copyToClipboard(ip)
    setCopiedIp(ip)
    setTimeout(() => setCopiedIp(null), 1500)
  }

  const handleExportCsv = () => {
    if (!logs?.items?.length) return
    const headers = ['timestamp', 'event_type', 'src_ip', 'src_port', 'dest_ip', 'dest_port', 'proto', 'alert_signature', 'alert_severity', 'country_name']
    const rows = logs.items.map((log) =>
      headers.map((h) => JSON.stringify(log[h] ?? '')).join(',')
    )
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `suricata-logs-${date}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleReplay = (entry) => {
    setDate(entry.date)
    setEventType(entry.eventType === 'all' ? '' : entry.eventType)
    setSrcIp(entry.srcIp === '*' ? '' : entry.srcIp)
  }

  /* ── Derived stats ───────────────────────────────────────── */
  const resultStats = useMemo(() => {
    if (!logs?.items?.length) return null
    const items = logs.items
    const alertCount = items.filter((i) => i.event_type === 'alert').length
    const uniqueIps = new Set(items.map((i) => i.src_ip).filter(Boolean)).size
    const protocols = {}
    items.forEach((i) => { if (i.proto) protocols[i.proto] = (protocols[i.proto] || 0) + 1 })
    const topProto = Object.entries(protocols).sort(([, a], [, b]) => b - a)[0]
    return { alertCount, uniqueIps, topProto }
  }, [logs])

  /* ═════════════════════════════════════════════════════════════
     Render
     ═════════════════════════════════════════════════════════════ */
  return (
    <section className="s3x">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <header className="s3x__hero">
        <div className="s3x__hero-text">
          <p className="s3x__eyebrow">Athena · S3 · Suricata</p>
          <h2>S3 Log Explorer</h2>
          <p className="s3x__hero-sub">
            Query full Suricata event logs stored in S3 via Athena.
            Separate from the DynamoDB alert stream — this is your deep-dive forensics layer.
          </p>
        </div>

        {/* KPI pills — show after first query */}
        {logs && (
          <div className="s3x__kpis">
            <KpiPill icon="📄" label="Results" value={logs.count?.toLocaleString() ?? '0'} accent="#06b6d4" />
            <KpiPill icon="💾" label="Scanned" value={formatBytes(logs.data_scanned_mb)} accent="#8b5cf6" />
            <KpiPill icon="💰" label="Query Cost" value={formatScanCost(logs.data_scanned_mb)} accent="#10b981" />
            <KpiPill icon="⏱️" label="Latency" value={queryTime ? `${queryTime}s` : '—'} accent="#f59e0b" />
          </div>
        )}
      </header>

      {/* ── Query History Toggle ──────────────────────────────── */}
      {queryHistory.length > 0 && (
        <div className="s3x__history-toggle-wrap">
          <button
            className="s3x__history-toggle"
            onClick={() => setShowHistory(!showHistory)}
          >
            🕘 Query History ({queryHistory.length})
            <span className="s3x__chevron">{showHistory ? '▲' : '▼'}</span>
          </button>

          {showHistory && (
            <div className="s3x__history-panel">
              {queryHistory.map((entry) => (
                <button
                  key={entry.id}
                  className="s3x__history-item"
                  onClick={() => handleReplay(entry)}
                  title="Click to replay this query"
                >
                  <span className="s3x__history-date">{entry.date}</span>
                  <span className="s3x__history-type" style={{ color: EVENT_TYPE_COLORS[entry.eventType] || '#94a3b8' }}>
                    {EVENT_TYPE_ICONS[entry.eventType] || '📋'} {entry.eventType}
                  </span>
                  <span className="s3x__history-src">{entry.srcIp}</span>
                  <span className="s3x__history-count">{entry.resultCount} rows</span>
                  <span className="s3x__history-ago">{ago(entry.timestamp)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Filters ───────────────────────────────────────────── */}
      <form className="s3x__filters" onSubmit={handleSearch} ref={formRef}>
        <div className="s3x__filter-row">
          <label>
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            <span>Event Type</span>
            <select value={eventType} onChange={(e) => setEventType(e.target.value)}>
              <option value="">All types</option>
              {Object.keys(EVENT_TYPE_COLORS).map((t) => (
                <option key={t} value={t}>{EVENT_TYPE_ICONS[t] || ''} {t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Protocol</span>
            <select value={proto} onChange={(e) => setProto(e.target.value)}>
              <option value="">All</option>
              {PROTOCOLS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label>
            <span>Limit</span>
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              {LIMITS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
        </div>

        <div className="s3x__filter-row s3x__filter-row--secondary">
          <label>
            <span>Source IP</span>
            <input type="text" placeholder="e.g. 192.168.1.100" value={srcIp} onChange={(e) => setSrcIp(e.target.value)} />
          </label>
          <label>
            <span>Destination IP</span>
            <input type="text" placeholder="e.g. 10.0.0.5" value={destIp} onChange={(e) => setDestIp(e.target.value)} />
          </label>
          <div className="s3x__filter-actions">
            <button type="submit" className="s3x__search-btn" disabled={loading}>
              {loading ? (
                <><span className="s3x__spinner" /> Querying Athena...</>
              ) : (
                <>🔍 Search S3 Logs</>
              )}
            </button>
            <kbd className="s3x__kbd">Ctrl + Enter</kbd>
          </div>
        </div>
      </form>

      {/* ── Event Breakdown Chips ─────────────────────────────── */}
      {summary?.items?.length > 0 && (
        <section className="s3x__summary">
          <div className="s3x__summary-header">
            <h3>Event Breakdown — {date}</h3>
            {summary.data_scanned_mb !== undefined && (
              <span className="s3x__scan-badge">
                💾 {summary.data_scanned_mb} MB scanned · {formatScanCost(summary.data_scanned_mb)}
              </span>
            )}
          </div>
          <div className="s3x__chips">
            {summary.items.map((item) => {
              const color = EVENT_TYPE_COLORS[item.event_type] || '#64748b'
              const icon = EVENT_TYPE_ICONS[item.event_type] || '📋'
              return (
                <button
                  key={item.event_type}
                  className={`s3x__chip ${eventType === item.event_type ? 's3x__chip--active' : ''}`}
                  style={{ '--chip-color': color }}
                  onClick={() => handleEventTypeClick(item.event_type)}
                >
                  <span className="s3x__chip-icon">{icon}</span>
                  <span className="s3x__chip-dot" style={{ background: color }} />
                  {item.event_type}
                  <strong>{Number(item.event_count).toLocaleString()}</strong>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Error ─────────────────────────────────────────────── */}
      {error && (
        <div className="s3x__error">
          <span className="s3x__error-icon">⚠️</span>
          <div>
            <strong>Query Error</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* ── Results Table ─────────────────────────────────────── */}
      {logs && (
        <section className="s3x__results">
          <header className="s3x__results-header">
            <div className="s3x__results-left">
              <span className="s3x__results-count">{logs.count || 0} logs returned</span>
              {resultStats && (
                <div className="s3x__results-mini-stats">
                  {resultStats.alertCount > 0 && (
                    <span className="s3x__mini-stat s3x__mini-stat--alert">
                      🚨 {resultStats.alertCount} alerts
                    </span>
                  )}
                  <span className="s3x__mini-stat">
                    🌐 {resultStats.uniqueIps} unique IPs
                  </span>
                  {resultStats.topProto && (
                    <span className="s3x__mini-stat">
                      📡 {resultStats.topProto[0]} ({resultStats.topProto[1]})
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="s3x__results-actions">
              {logs.data_scanned_mb !== undefined && (
                <span className="s3x__scan-badge">
                  {logs.data_scanned_mb} MB · {formatScanCost(logs.data_scanned_mb)}
                </span>
              )}
              <button
                className="s3x__export-btn"
                onClick={handleExportCsv}
                disabled={!logs?.items?.length}
                title="Export results as CSV"
              >
                📥 Export CSV
              </button>
            </div>
          </header>

          <div className="s3x__table-wrap">
            <table className="s3x__table">
              <thead>
                <tr>
                  <th className="s3x__th-num">#</th>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Origin</th>
                  <th>Source</th>
                  <th>Destination</th>
                  <th>Proto</th>
                  <th>Alert / Signature</th>
                  <th className="s3x__th-expand" />
                </tr>
              </thead>
              <tbody>
                {(logs.items || []).map((log, i) => {
                  const sevInfo = SEVERITY_MAP[log.alert_severity]
                  const isExpanded = expandedRow === i
                  const isAlert = log.event_type === 'alert'

                  return (
                    <React.Fragment key={`${log.timestamp || 'row'}-${i}`}>
                      <tr
                        className={`s3x__row ${isAlert ? 's3x__row--alert' : ''} ${isExpanded ? 's3x__row--expanded' : ''}`}
                        onClick={() => setExpandedRow(isExpanded ? null : i)}
                      >
                        <td className="s3x__cell-num">{i + 1}</td>
                        <td className="s3x__cell-time">
                          {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '-'}
                        </td>
                        <td>
                          <span className="s3x__type-badge" style={{ background: EVENT_TYPE_COLORS[log.event_type] || '#64748b' }}>
                            {EVENT_TYPE_ICONS[log.event_type] || ''} {log.event_type || 'unknown'}
                          </span>
                        </td>
                        <td className="s3x__cell-origin">
                          {log.flag && <span className="s3x__flag">{log.flag}</span>}
                          {log.country_name || '-'}
                        </td>
                        <td className="s3x__cell-ip">
                          <span
                            className="s3x__ip"
                            onClick={(e) => { e.stopPropagation(); handleCopyIp(log.src_ip) }}
                            title="Click to copy"
                          >
                            {log.src_ip || '-'}
                            {copiedIp === log.src_ip && <span className="s3x__copied">✓</span>}
                          </span>
                          {log.src_port && <span className="s3x__port">:{log.src_port}</span>}
                        </td>
                        <td className="s3x__cell-ip">
                          <span
                            className="s3x__ip"
                            onClick={(e) => { e.stopPropagation(); handleCopyIp(log.dest_ip) }}
                            title="Click to copy"
                          >
                            {log.dest_ip || '-'}
                            {copiedIp === log.dest_ip && <span className="s3x__copied">✓</span>}
                          </span>
                          {log.dest_port && <span className="s3x__port">:{log.dest_port}</span>}
                        </td>
                        <td>
                          <span className="s3x__proto-badge">{log.proto || '-'}</span>
                        </td>
                        <td className="s3x__cell-alert">
                          {log.alert_signature || log.alert_category || '-'}
                          {sevInfo && (
                            <span
                              className="s3x__sev-badge"
                              style={{ color: sevInfo.color, background: sevInfo.bg }}
                            >
                              {sevInfo.label}
                            </span>
                          )}
                        </td>
                        <td className="s3x__cell-expand">
                          <span className={`s3x__expand-icon ${isExpanded ? 's3x__expand-icon--open' : ''}`}>›</span>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="s3x__detail-row">
                          <td colSpan="9">
                            <div className="s3x__detail-content">
                              <div className="s3x__detail-toolbar">
                                <span className="s3x__detail-title">Raw Event JSON</span>
                                <button
                                  className="s3x__detail-copy"
                                  onClick={(e) => { e.stopPropagation(); copyToClipboard(JSON.stringify(log, null, 2)) }}
                                >
                                  📋 Copy JSON
                                </button>
                              </div>
                              <pre className="s3x__detail-json">{JSON.stringify(log, null, 2)}</pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {(logs.items || []).length === 0 && (
            <div className="s3x__empty">
              <span className="s3x__empty-icon">🔍</span>
              <p>No logs found for the selected filters.</p>
              <p className="s3x__empty-hint">Try broadening your date range or removing filters.</p>
            </div>
          )}
        </section>
      )}

      {/* ── Intro / Empty State ───────────────────────────────── */}
      {!logs && !loading && !error && (
        <section className="s3x__intro">
          <div className="s3x__intro-icon">🛰️</div>
          <h3>Query Your S3 Log Archive</h3>
          <p>Select a date and filters above, then hit <kbd>Search S3 Logs</kbd> or press <kbd>Ctrl+Enter</kbd> to query Athena.</p>
          <div className="s3x__intro-features">
            <div className="s3x__intro-feature">
              <span>⚡</span>
              <div>
                <strong>Athena-powered</strong>
                <p>Serverless SQL queries against your full S3 log archive</p>
              </div>
            </div>
            <div className="s3x__intro-feature">
              <span>💰</span>
              <div>
                <strong>Pay-per-query</strong>
                <p>~$5 per TB scanned — typically &lt;$0.01 per query</p>
              </div>
            </div>
            <div className="s3x__intro-feature">
              <span>📊</span>
              <div>
                <strong>Event breakdown</strong>
                <p>Clickable chips show event type distribution per day</p>
              </div>
            </div>
            <div className="s3x__intro-feature">
              <span>📥</span>
              <div>
                <strong>Export to CSV</strong>
                <p>Download results for offline analysis or SIEM import</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Loading overlay ───────────────────────────────────── */}
      {loading && (
        <div className="s3x__loading">
          <div className="s3x__loading-spinner" />
          <p>Querying Athena…</p>
          <p className="s3x__loading-hint">Scanning S3 partitions for {date}</p>
        </div>
      )}
    </section>
  )
}
