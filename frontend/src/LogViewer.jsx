import React, { useState, useCallback } from 'react'
import './components/LogViewer.css'

const API_URL = import.meta.env.VITE_SURICATA_API_URL

/*
================================================================================
LogViewer - S3 Log Explorer
================================================================================
Purpose: Browse ALL Suricata logs stored in S3 via Athena.
         Separate from the DynamoDB alerts dashboard.

Data Flow: React → API Gateway /logs → Lambda → Athena → S3

Features:
- Date picker to select log date
- Filter by event type, source IP, dest IP, protocol
- Event type summary (counts per type)
- Expandable raw JSON view
- Data scanned cost indicator
================================================================================
*/

const EVENT_TYPE_COLORS = {
  alert: '#ef4444',
  anomaly: '#f59e0b',
  dns: '#3b82f6',
  flow: '#6b7280',
  http: '#10b981',
  tls: '#8b5cf6',
  tcp: '#06b6d4',
  fileinfo: '#ec4899',
  drop: '#dc2626',
  stats: '#9ca3af',
}

function LogViewer() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [eventType, setEventType] = useState('')
  const [srcIp, setSrcIp] = useState('')
  const [destIp, setDestIp] = useState('')
  const [proto, setProto] = useState('')
  const [limit, setLimit] = useState(100)
  const [logs, setLogs] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expandedRow, setExpandedRow] = useState(null)

  const fetchLogs = useCallback(async () => {
    if (!API_URL) {
      setError('API URL not configured. Set VITE_SURICATA_API_URL in .env')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ date, limit: String(limit) })
      if (eventType) params.set('event_type', eventType)
      if (srcIp) params.set('src_ip', srcIp)
      if (destIp) params.set('dest_ip', destIp)
      if (proto) params.set('proto', proto)

      const response = await fetch(`${API_URL}/logs?${params}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      setLogs(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [date, eventType, srcIp, destIp, proto, limit])

  const fetchSummary = useCallback(async () => {
    if (!API_URL) return
    setSummaryLoading(true)
    try {
      const response = await fetch(`${API_URL}/logs?action=summary&date=${date}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      setSummary(data)
    } catch (err) {
      console.error('Summary fetch error:', err)
    } finally {
      setSummaryLoading(false)
    }
  }, [date])

  const handleSearch = (e) => {
    e.preventDefault()
    fetchLogs()
    fetchSummary()
  }

  const handleEventTypeClick = (type) => {
    setEventType(type)
    // Auto-search when clicking a type from summary
    setTimeout(() => {
      const params = new URLSearchParams({ date, limit: String(limit), event_type: type })
      if (srcIp) params.set('src_ip', srcIp)
      if (destIp) params.set('dest_ip', destIp)
      if (proto) params.set('proto', proto)

      setLoading(true)
      fetch(`${API_URL}/logs?${params}`)
        .then(r => r.json())
        .then(data => { setLogs(data); setLoading(false) })
        .catch(err => { setError(err.message); setLoading(false) })
    }, 0)
  }

  return (
    <div className="log-viewer">
      <div className="log-viewer__header">
        <h2>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          S3 Log Explorer
        </h2>
        <span className="log-viewer__subtitle">
          Browse all Suricata logs stored in S3 • Powered by Athena
        </span>
      </div>

      {/* Search Filters */}
      <form className="log-viewer__filters" onSubmit={handleSearch}>
        <div className="log-viewer__filter-row">
          <label>
            <span>Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            <span>Event Type</span>
            <select value={eventType} onChange={(e) => setEventType(e.target.value)}>
              <option value="">All Types</option>
              <option value="alert">Alert</option>
              <option value="anomaly">Anomaly</option>
              <option value="dns">DNS</option>
              <option value="flow">Flow</option>
              <option value="http">HTTP</option>
              <option value="tls">TLS</option>
              <option value="tcp">TCP</option>
              <option value="fileinfo">File Info</option>
              <option value="stats">Stats</option>
              <option value="drop">Drop</option>
            </select>
          </label>
          <label>
            <span>Protocol</span>
            <select value={proto} onChange={(e) => setProto(e.target.value)}>
              <option value="">All</option>
              <option value="TCP">TCP</option>
              <option value="UDP">UDP</option>
              <option value="ICMP">ICMP</option>
            </select>
          </label>
          <label>
            <span>Limit</span>
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </label>
        </div>
        <div className="log-viewer__filter-row">
          <label>
            <span>Source IP</span>
            <input
              type="text"
              placeholder="e.g. 192.168.1.100"
              value={srcIp}
              onChange={(e) => setSrcIp(e.target.value)}
            />
          </label>
          <label>
            <span>Destination IP</span>
            <input
              type="text"
              placeholder="e.g. 10.0.0.5"
              value={destIp}
              onChange={(e) => setDestIp(e.target.value)}
            />
          </label>
          <button type="submit" className="log-viewer__search-btn" disabled={loading}>
            {loading ? (
              <>
                <span className="log-viewer__spinner" /> Querying Athena...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                Search S3 Logs
              </>
            )}
          </button>
        </div>
      </form>

      {/* Event Type Summary */}
      {summary && summary.items && (
        <div className="log-viewer__summary">
          <h3>Event Type Breakdown — {date}</h3>
          <div className="log-viewer__summary-chips">
            {summary.items.map((item) => (
              <button
                key={item.event_type}
                className={`log-viewer__chip ${eventType === item.event_type ? 'log-viewer__chip--active' : ''}`}
                style={{ borderColor: EVENT_TYPE_COLORS[item.event_type] || '#6b7280' }}
                onClick={() => handleEventTypeClick(item.event_type)}
              >
                <span
                  className="log-viewer__chip-dot"
                  style={{ background: EVENT_TYPE_COLORS[item.event_type] || '#6b7280' }}
                />
                {item.event_type}
                <span className="log-viewer__chip-count">{Number(item.event_count).toLocaleString()}</span>
              </button>
            ))}
          </div>
          {summary.data_scanned_mb !== undefined && (
            <span className="log-viewer__cost-badge">
              📊 {summary.data_scanned_mb} MB scanned
              {' '}(~${(summary.data_scanned_mb / 1024 * 5).toFixed(4)} cost)
            </span>
          )}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="log-viewer__error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Results */}
      {logs && (
        <div className="log-viewer__results">
          <div className="log-viewer__results-header">
            <span>{logs.count} logs returned</span>
            {logs.data_scanned_mb !== undefined && (
              <span className="log-viewer__cost-badge">
                📊 {logs.data_scanned_mb} MB scanned
              </span>
            )}
          </div>

          <div className="log-viewer__table-wrapper">
            <table className="log-viewer__table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Origin</th>
                  <th>Source</th>
                  <th>Destination</th>
                  <th>Proto</th>
                  <th>Alert</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {logs.items.map((log, i) => (
                  <React.Fragment key={i}>
                    <tr
                      className={`log-viewer__row ${log.event_type === 'alert' ? 'log-viewer__row--alert' : ''}`}
                      onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                    >
                      <td className="log-viewer__cell--time">
                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '-'}
                      </td>
                      <td>
                        <span
                          className="log-viewer__type-badge"
                          style={{ background: EVENT_TYPE_COLORS[log.event_type] || '#6b7280' }}
                        >
                          {log.event_type || 'unknown'}
                        </span>
                      </td>
                      <td className="log-viewer__cell--origin" title={log.country_name || ''}>
                        {log.flag || ''} {log.country_name || '-'}
                      </td>
                      <td className="log-viewer__cell--ip">
                        {log.src_ip || '-'}
                        {log.src_port ? `:${log.src_port}` : ''}
                      </td>
                      <td className="log-viewer__cell--ip">
                        {log.dest_ip || '-'}
                        {log.dest_port ? `:${log.dest_port}` : ''}
                      </td>
                      <td>{log.proto || '-'}</td>
                      <td className="log-viewer__cell--alert">
                        {log.alert_signature || log.alert_category || '-'}
                        {log.alert_severity && (
                          <span className={`log-viewer__severity log-viewer__severity--${log.alert_severity}`}>
                            Sev {log.alert_severity}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="log-viewer__expand">
                          {expandedRow === i ? '▼' : '▶'}
                        </span>
                      </td>
                    </tr>
                    {expandedRow === i && (
                      <tr className="log-viewer__detail-row">
                        <td colSpan="8">
                          <pre className="log-viewer__json">
                            {JSON.stringify(log, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {logs.items.length === 0 && (
            <div className="log-viewer__empty">
              No logs found for the selected filters. Try a different date or remove filters.
            </div>
          )}
        </div>
      )}

      {/* Initial State */}
      {!logs && !loading && !error && (
        <div className="log-viewer__intro">
          <div className="log-viewer__intro-icon">🗄️</div>
          <h3>Query S3 Logs</h3>
          <p>
            Search all Suricata logs stored in S3. Select a date and click
            <strong> Search S3 Logs</strong> to query via Athena.
          </p>
          <p className="log-viewer__intro-note">
            💡 <strong>Tip:</strong> The dashboard shows only <em>alerts</em> from DynamoDB.
            This page lets you explore <em>all</em> network events including flows, DNS, HTTP, and more.
          </p>
        </div>
      )}
    </div>
  )
}

export default LogViewer
