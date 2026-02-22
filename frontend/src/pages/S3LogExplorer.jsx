import React, { useCallback, useState } from 'react'
import '../components/S3LogExplorer.css'

const API_URL = import.meta.env.VITE_SURICATA_API_URL

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

const formatScanCost = (mb) => {
  const value = Number(mb)
  if (Number.isNaN(value)) return '--'
  return `$${((value / 1024) * 5).toFixed(4)}`
}

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

  const buildParams = useCallback((forcedEventType = null) => {
    const params = new URLSearchParams({ date, limit: String(limit) })
    const selectedEvent = forcedEventType ?? eventType
    if (selectedEvent) params.set('event_type', selectedEvent)
    if (srcIp) params.set('src_ip', srcIp)
    if (destIp) params.set('dest_ip', destIp)
    if (proto) params.set('proto', proto)
    return params
  }, [date, limit, eventType, srcIp, destIp, proto])

  const fetchLogs = useCallback(async (forcedEventType = null) => {
    if (!API_URL) {
      setError('API URL is not configured. Set VITE_SURICATA_API_URL in .env')
      return
    }

    setLoading(true)
    setError('')

    try {
      const params = buildParams(forcedEventType)
      const response = await fetch(`${API_URL}/logs?${params}`)
      if (!response.ok) throw new Error(`Logs request failed (${response.status})`)
      const data = await response.json()
      setLogs(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  const fetchSummary = useCallback(async () => {
    if (!API_URL) return
    try {
      const response = await fetch(`${API_URL}/logs?action=summary&date=${date}`)
      if (!response.ok) return
      const data = await response.json()
      setSummary(data)
    } catch {
      // Summary is optional; avoid surfacing as primary error.
    }
  }, [date])

  const handleSearch = async (e) => {
    e.preventDefault()
    await Promise.all([fetchLogs(), fetchSummary()])
  }

  const handleEventTypeClick = async (type) => {
    setEventType(type)
    await fetchLogs(type)
  }

  return (
    <section className="s3-log-explorer">
      <header className="s3-log-explorer__header">
        <p className="s3-log-explorer__eyebrow">Athena + S3</p>
        <h2>S3 Log Explorer</h2>
        <p className="s3-log-explorer__subtitle">
          Query full Suricata logs in S3, separate from the DynamoDB alerts stream.
        </p>
      </header>

      <form className="s3-log-explorer__filters" onSubmit={handleSearch}>
        <div className="s3-log-explorer__filter-row">
          <label>
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            <span>Event Type</span>
            <select value={eventType} onChange={(e) => setEventType(e.target.value)}>
              <option value="">All types</option>
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

        <div className="s3-log-explorer__filter-row s3-log-explorer__filter-row--secondary">
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

          <button type="submit" className="s3-log-explorer__search-btn" disabled={loading}>
            {loading ? 'Querying Athena...' : 'Search S3 Logs'}
          </button>
        </div>
      </form>

      {summary?.items?.length > 0 && (
        <section className="s3-log-explorer__summary">
          <h3>Event Breakdown - {date}</h3>
          <div className="s3-log-explorer__chips">
            {summary.items.map((item) => (
              <button
                key={item.event_type}
                className={`s3-log-explorer__chip ${eventType === item.event_type ? 's3-log-explorer__chip--active' : ''}`}
                style={{ borderColor: EVENT_TYPE_COLORS[item.event_type] || '#64748b' }}
                onClick={() => handleEventTypeClick(item.event_type)}
              >
                <span
                  className="s3-log-explorer__chip-dot"
                  style={{ background: EVENT_TYPE_COLORS[item.event_type] || '#64748b' }}
                />
                {item.event_type}
                <strong>{Number(item.event_count).toLocaleString()}</strong>
              </button>
            ))}
          </div>

          {summary.data_scanned_mb !== undefined && (
            <span className="s3-log-explorer__scan-badge">
              Scanned: {summary.data_scanned_mb} MB (cost: {formatScanCost(summary.data_scanned_mb)})
            </span>
          )}
        </section>
      )}

      {error && <div className="s3-log-explorer__error">{error}</div>}

      {logs && (
        <section className="s3-log-explorer__results">
          <header className="s3-log-explorer__results-header">
            <span>{logs.count || 0} logs returned</span>
            {logs.data_scanned_mb !== undefined && (
              <span className="s3-log-explorer__scan-badge">
                Scanned: {logs.data_scanned_mb} MB (cost: {formatScanCost(logs.data_scanned_mb)})
              </span>
            )}
          </header>

          <div className="s3-log-explorer__table-wrap">
            <table className="s3-log-explorer__table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Origin</th>
                  <th>Source</th>
                  <th>Destination</th>
                  <th>Proto</th>
                  <th>Alert</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(logs.items || []).map((log, i) => (
                  <React.Fragment key={`${log.timestamp || 'row'}-${i}`}>
                    <tr
                      className={`s3-log-explorer__row ${log.event_type === 'alert' ? 's3-log-explorer__row--alert' : ''}`}
                      onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                    >
                      <td>{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '-'}</td>
                      <td>
                        <span
                          className="s3-log-explorer__type"
                          style={{ background: EVENT_TYPE_COLORS[log.event_type] || '#64748b' }}
                        >
                          {log.event_type || 'unknown'}
                        </span>
                      </td>
                      <td>{(log.flag || '') + (log.country_name ? ` ${log.country_name}` : '') || '-'}</td>
                      <td>{log.src_ip || '-'}{log.src_port ? `:${log.src_port}` : ''}</td>
                      <td>{log.dest_ip || '-'}{log.dest_port ? `:${log.dest_port}` : ''}</td>
                      <td>{log.proto || '-'}</td>
                      <td className="s3-log-explorer__alert-cell">
                        {log.alert_signature || log.alert_category || '-'}
                        {log.alert_severity && <em>Sev {log.alert_severity}</em>}
                      </td>
                      <td>{expandedRow === i ? 'v' : '>'}</td>
                    </tr>

                    {expandedRow === i && (
                      <tr className="s3-log-explorer__detail-row">
                        <td colSpan="8">
                          <pre>{JSON.stringify(log, null, 2)}</pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {(logs.items || []).length === 0 && (
            <div className="s3-log-explorer__empty">No logs found for the selected filters.</div>
          )}
        </section>
      )}

      {!logs && !loading && !error && (
        <section className="s3-log-explorer__intro">
          <h3>Query S3 Logs</h3>
          <p>Select a date and filters, then run Search S3 Logs to query Athena-backed data.</p>
          <p><strong>Tip:</strong> This page is for full S3 log history. Alerts dashboard stays DynamoDB-focused.</p>
        </section>
      )}
    </section>
  )
}
