import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import '../components/ArchiveExplorer.css'

const API_URL = import.meta.env.VITE_SURICATA_API_URL

/* ── Storage-class visual tokens ─────────────────────────────────────────── */
const STORAGE_CLASSES = {
  STANDARD:      { label: 'Standard',      color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  STANDARD_IA:   { label: 'Standard-IA',   color: '#06b6d4', bg: 'rgba(6,182,212,0.15)' },
  GLACIER:       { label: 'Glacier',        color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
  DEEP_ARCHIVE:  { label: 'Deep Archive',  color: '#64748b', bg: 'rgba(100,116,139,0.20)' },
}

const EVENT_TYPE_COLORS = {
  alert:    '#ef4444', anomaly: '#f59e0b', dns:      '#3b82f6',
  flow:     '#64748b', http:    '#10b981', tls:      '#8b5cf6',
  tcp:      '#06b6d4', fileinfo:'#ec4899', drop:     '#dc2626',
  stats:    '#9ca3af',
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function inferStorageClass(timestamp) {
  if (!timestamp) return 'STANDARD'
  const age = (Date.now() - new Date(timestamp).getTime()) / 86_400_000
  if (age > 365) return 'DEEP_ARCHIVE'
  if (age > 90)  return 'GLACIER'
  if (age > 30)  return 'STANDARD_IA'
  return 'STANDARD'
}

function estimateSavings(recordCount) {
  // Rough math: ~1 KB per record, DynamoDB on-demand ~$1.25/M reads + storage
  const gbStored = (recordCount * 1) / 1_048_576
  const dynamoCost = gbStored * 0.25 + (recordCount / 1_000_000) * 1.25
  const s3Cost     = gbStored * 0.023
  return { dynamoCost, s3Cost, saved: Math.max(0, dynamoCost - s3Cost) }
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function ArchiveExplorer() {
  /* ── state ───────────────────────────────────────────────────────────── */
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 3)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate]       = useState(new Date().toISOString().split('T')[0])
  const [eventType, setEventType]   = useState('')
  const [srcIp, setSrcIp]           = useState('')
  const [destIp, setDestIp]         = useState('')
  const [proto, setProto]           = useState('')
  const [limit, setLimit]           = useState(100)
  const [logs, setLogs]             = useState(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [expandedRow, setExpandedRow] = useState(null)
  const [restoring, setRestoring]   = useState({})   // id → 'requested' | 'ready'

  /* command-palette */
  const [cmdOpen, setCmdOpen]       = useState(false)
  const [cmdQuery, setCmdQuery]     = useState('')
  const cmdRef                      = useRef(null)

  /* ── keyboard shortcut (Ctrl+K) ──────────────────────────────────────── */
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setCmdOpen(prev => !prev)
        setTimeout(() => cmdRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') setCmdOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  /* ── fetch ───────────────────────────────────────────────────────────── */
  const fetchArchive = useCallback(async () => {
    if (!API_URL) { setError('API URL not configured'); return }
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ date: startDate, limit: String(limit) })
      if (eventType) params.set('event_type', eventType)
      if (srcIp)     params.set('src_ip', srcIp)
      if (destIp)    params.set('dest_ip', destIp)
      if (proto)     params.set('proto', proto)
      const res = await fetch(`${API_URL}/logs?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setLogs(await res.json())
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [startDate, eventType, srcIp, destIp, proto, limit])

  const handleSearch = (e) => { e.preventDefault(); fetchArchive() }

  /* ── mock restore request ────────────────────────────────────────────── */
  const requestRestore = (idx) => {
    setRestoring(prev => ({ ...prev, [idx]: 'requested' }))
    setTimeout(() => {
      setRestoring(prev => ({ ...prev, [idx]: 'ready' }))
    }, 3000 + Math.random() * 4000)
  }

  /* ── command-palette filter ─────────────────────────────────────────── */
  const filteredLogs = useMemo(() => {
    if (!logs?.items) return []
    if (!cmdQuery.trim()) return logs.items
    const q = cmdQuery.toLowerCase()
    return logs.items.filter(l =>
      (l.src_ip    || '').includes(q) ||
      (l.dest_ip   || '').includes(q) ||
      (l.event_type|| '').includes(q) ||
      (l.alert_signature || '').toLowerCase().includes(q) ||
      (l.country_name || '').toLowerCase().includes(q)
    )
  }, [logs, cmdQuery])

  /* ── cost savings ───────────────────────────────────────────────────── */
  const savings = useMemo(() => estimateSavings(logs?.count || 0), [logs])

  /* ══════════════════════════════════════════════════════════════════════ */
  return (
    <section className="archive">
      {/* ── Command Palette Overlay ────────────────────────────────────── */}
      {cmdOpen && (
        <div className="archive__cmd-overlay" onClick={() => setCmdOpen(false)}>
          <div className="archive__cmd-palette" onClick={e => e.stopPropagation()}>
            <div className="archive__cmd-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                ref={cmdRef}
                className="archive__cmd-input"
                placeholder="Filter by IP, attack type, country…"
                value={cmdQuery}
                onChange={e => setCmdQuery(e.target.value)}
                autoFocus
              />
              <kbd className="archive__kbd">ESC</kbd>
            </div>
            {cmdQuery && (
              <div className="archive__cmd-results">
                <span className="archive__cmd-count">{filteredLogs.length} result{filteredLogs.length !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Header Card ───────────────────────────────────────────────── */}
      <header className="archive__header">
        <div className="archive__header-glow" />
        <div className="archive__header-content">
          <div className="archive__header-top">
            <div>
              <p className="archive__eyebrow">S3 Cold Storage</p>
              <h2 className="archive__title">Archive Explorer</h2>
              <p className="archive__subtitle">
                Browse archived Suricata logs across S3 storage tiers — Standard-IA, Glacier &amp; Deep Archive.
              </p>
            </div>
            <button className="archive__cmd-trigger" onClick={() => { setCmdOpen(true); setTimeout(() => cmdRef.current?.focus(), 50) }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Search logs…
              <kbd className="archive__kbd">⌘K</kbd>
            </button>
          </div>
        </div>
      </header>

      {/* ── Cost Savings + Stats Row ──────────────────────────────────── */}
      <div className="archive__stats-row">
        <div className="archive__stat-card archive__stat-card--savings">
          <div className="archive__stat-icon">💰</div>
          <div>
            <span className="archive__stat-label">Est. Monthly Savings</span>
            <span className="archive__stat-value archive__stat-value--green">
              ${savings.saved.toFixed(2)}
            </span>
            <span className="archive__stat-detail">
              S3 ${savings.s3Cost.toFixed(4)}/mo vs DynamoDB ${savings.dynamoCost.toFixed(4)}/mo
            </span>
          </div>
        </div>

        <div className="archive__stat-card">
          <div className="archive__stat-icon">📦</div>
          <div>
            <span className="archive__stat-label">Records Queried</span>
            <span className="archive__stat-value">{(logs?.count || 0).toLocaleString()}</span>
          </div>
        </div>

        <div className="archive__stat-card">
          <div className="archive__stat-icon">📊</div>
          <div>
            <span className="archive__stat-label">Data Scanned</span>
            <span className="archive__stat-value">{logs?.data_scanned_mb ?? '—'} MB</span>
            {logs?.data_scanned_mb != null && (
              <span className="archive__stat-detail">
                ~${((logs.data_scanned_mb / 1024) * 5).toFixed(4)} Athena cost
              </span>
            )}
          </div>
        </div>

        <div className="archive__stat-card">
          <div className="archive__stat-icon">🗓️</div>
          <div>
            <span className="archive__stat-label">Date Range</span>
            <span className="archive__stat-value archive__stat-value--sm">
              {startDate} → {endDate}
            </span>
          </div>
        </div>
      </div>

      {/* ── Date Range + Filters ──────────────────────────────────────── */}
      <form className="archive__filters" onSubmit={handleSearch}>
        <div className="archive__filter-grid">
          <label>
            <span>Start Date</span>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </label>
          <label>
            <span>End Date</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </label>
          <label>
            <span>Event Type</span>
            <select value={eventType} onChange={e => setEventType(e.target.value)}>
              <option value="">All types</option>
              <option value="alert">Alert</option>
              <option value="anomaly">Anomaly</option>
              <option value="dns">DNS</option>
              <option value="flow">Flow</option>
              <option value="http">HTTP</option>
              <option value="tls">TLS</option>
              <option value="tcp">TCP</option>
              <option value="fileinfo">File Info</option>
              <option value="drop">Drop</option>
            </select>
          </label>
          <label>
            <span>Protocol</span>
            <select value={proto} onChange={e => setProto(e.target.value)}>
              <option value="">All</option>
              <option value="TCP">TCP</option>
              <option value="UDP">UDP</option>
              <option value="ICMP">ICMP</option>
            </select>
          </label>
        </div>
        <div className="archive__filter-grid archive__filter-grid--secondary">
          <label>
            <span>Source IP</span>
            <input type="text" placeholder="e.g. 192.168.1.100" value={srcIp} onChange={e => setSrcIp(e.target.value)} />
          </label>
          <label>
            <span>Destination IP</span>
            <input type="text" placeholder="e.g. 10.0.0.5" value={destIp} onChange={e => setDestIp(e.target.value)} />
          </label>
          <label>
            <span>Limit</span>
            <select value={limit} onChange={e => setLimit(Number(e.target.value))}>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
              <option value={1000}>1 000</option>
            </select>
          </label>
          <button type="submit" className="archive__search-btn" disabled={loading}>
            {loading ? 'Querying Athena…' : '🔍  Search Archive'}
          </button>
        </div>
      </form>

      {/* ── Storage Class Legend ───────────────────────────────────────── */}
      <div className="archive__legend">
        <span className="archive__legend-label">Storage Tiers:</span>
        {Object.values(STORAGE_CLASSES).map(sc => (
          <span key={sc.label} className="archive__legend-chip" style={{ color: sc.color, borderColor: sc.color, background: sc.bg }}>
            {sc.label}
          </span>
        ))}
      </div>

      {/* ── Error ─────────────────────────────────────────────────────── */}
      {error && <div className="archive__error">⚠️ {error}</div>}

      {/* ── Results Table ─────────────────────────────────────────────── */}
      {filteredLogs.length > 0 && (
        <div className="archive__results">
          <div className="archive__results-header">
            <span>{filteredLogs.length} archived log{filteredLogs.length !== 1 ? 's' : ''}</span>
            {logs?.data_scanned_mb != null && (
              <span className="archive__scan-badge">📊 {logs.data_scanned_mb} MB scanned</span>
            )}
          </div>

          <div className="archive__table-wrap">
            <table className="archive__table">
              <thead>
                <tr>
                  <th>Storage</th>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Origin</th>
                  <th>Source</th>
                  <th>Destination</th>
                  <th>Alert / Signature</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, i) => {
                  const scKey  = inferStorageClass(log.timestamp)
                  const sc     = STORAGE_CLASSES[scKey]
                  const isCold = scKey === 'GLACIER' || scKey === 'DEEP_ARCHIVE'
                  const restoreState = restoring[i]

                  return (
                    <React.Fragment key={i}>
                      <tr
                        className={`archive__row ${log.event_type === 'alert' ? 'archive__row--alert' : ''}`}
                        onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                      >
                        {/* Storage class badge */}
                        <td>
                          <span className="archive__sc-badge" style={{ color: sc.color, background: sc.bg, borderColor: sc.color }}>
                            {sc.label}
                          </span>
                        </td>

                        <td className="archive__cell--mono">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                        </td>

                        <td>
                          <span className="archive__type" style={{ background: EVENT_TYPE_COLORS[log.event_type] || '#64748b' }}>
                            {log.event_type || '—'}
                          </span>
                        </td>

                        <td>{log.flag || ''} {log.country_name || '—'}</td>

                        <td className="archive__cell--mono archive__cell--cyan">
                          {log.src_ip || '—'}{log.src_port ? `:${log.src_port}` : ''}
                        </td>

                        <td className="archive__cell--mono">
                          {log.dest_ip || '—'}{log.dest_port ? `:${log.dest_port}` : ''}
                        </td>

                        <td className="archive__cell--alert">
                          {log.alert_signature || log.alert_category || '—'}
                          {log.alert_severity && (
                            <em className="archive__sev" data-sev={log.alert_severity}>Sev {log.alert_severity}</em>
                          )}
                        </td>

                        {/* Restore / View */}
                        <td>
                          {isCold && !restoreState && (
                            <button
                              className="archive__restore-btn"
                              onClick={e => { e.stopPropagation(); requestRestore(i) }}
                            >
                              ❄️ Request Retrieval
                            </button>
                          )}
                          {isCold && restoreState === 'requested' && (
                            <span className="archive__restoring">
                              <span className="archive__spinner" /> Restoring…
                            </span>
                          )}
                          {isCold && restoreState === 'ready' && (
                            <span className="archive__restored">✅ Ready</span>
                          )}
                          {!isCold && (
                            <span className="archive__viewable">● Available</span>
                          )}
                        </td>
                      </tr>

                      {expandedRow === i && (
                        <tr className="archive__detail-row">
                          <td colSpan="8">
                            <pre className="archive__json">{JSON.stringify(log, null, 2)}</pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Intro State ───────────────────────────────────────────────── */}
      {!logs && !loading && !error && (
        <div className="archive__intro">
          <div className="archive__intro-icon">🗄️</div>
          <h3>Query Archived Logs</h3>
          <p>
            Select a date range and filters, then hit <strong>Search Archive</strong> to query
            historical Suricata logs stored across S3 storage tiers via Athena.
          </p>
          <p className="archive__intro-note">
            <strong>💡 Tip:</strong> Logs older than 90 days are in Glacier. Use
            <strong> Request Retrieval</strong> to restore cold data before viewing.
            Press <kbd>Ctrl+K</kbd> to open the command palette for fast filtering.
          </p>
        </div>
      )}
    </section>
  )
}
