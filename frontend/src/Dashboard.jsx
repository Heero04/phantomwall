import React, { useCallback, useEffect, useMemo, useState } from 'react'
import AlertsTable from './components/AlertsTable'

// Import enhanced components with error handling
let ThreatMap, AttackTimeline, ThreatScoreEngine, VirtualizedEventList, AdvancedFilterPanel
let enhancedComponentsLoaded = false

const loadEnhancedComponents = async () => {
  try {
    const [
      threatMapModule,
      attackTimelineModule,
      threatScoreEngineModule,
      virtualizedEventListModule,
      advancedFilterPanelModule
    ] = await Promise.all([
      import('./components/ThreatMap'),
      import('./components/AttackTimeline'),
      import('./components/ThreatScoreEngine'),
      import('./components/VirtualizedEventList'),
      import('./components/AdvancedFilterPanel')
    ])

    ThreatMap = threatMapModule.default
    AttackTimeline = attackTimelineModule.default
    ThreatScoreEngine = threatScoreEngineModule.default
    VirtualizedEventList = virtualizedEventListModule.default
    AdvancedFilterPanel = advancedFilterPanelModule.default
    
    // Import CSS
    await import('./components/dashboard-enhancements.css')
    
    enhancedComponentsLoaded = true
    console.log('✅ Enhanced components loaded successfully')
    return true
  } catch (error) {
    console.error('❌ Enhanced components failed to load:', error)
    console.error('Error details:', error.message)
    return false
  }
}

// Load components immediately
loadEnhancedComponents()

const API_URL = import.meta.env.VITE_SURICATA_API_URL

const formatTime = value => {
  if (!value) {
    return '?'
  }
  const date = typeof value === 'number' ? new Date(value) : new Date(String(value))
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const readableType = evtType => (evtType ? evtType.toUpperCase() : 'UNKNOWN')

const formatNumber = value => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '--'
  }
  return Number(value).toLocaleString()
}

const getEventDate = event => {
  if (!event) {
    return null
  }
  const raw = event.event_time ?? event.timestamp
  if (!raw) {
    return null
  }
  const date = typeof raw === 'number' ? new Date(raw) : new Date(String(raw))
  return Number.isNaN(date.getTime()) ? null : date
}

export default function Dashboard() {
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [limit, setLimit] = useState(100)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [events, setEvents] = useState([])
  const [typeFilter, setTypeFilter] = useState('all')
  const [sourceQuery, setSourceQuery] = useState('')
  const [enhancedComponentsReady, setEnhancedComponentsReady] = useState(false)

  const [metrics, setMetrics] = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [metricsError, setMetricsError] = useState('')
  
  // New state for enhanced features
  const [advancedFilters, setAdvancedFilters] = useState({})
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [dashboardView, setDashboardView] = useState('classic') // Start with classic, then allow manual switch

// Load enhanced components on mount
  useEffect(() => {
    loadEnhancedComponents().then(success => {
      setEnhancedComponentsReady(success)
      if (!success) {
        console.warn('⚠️ Enhanced components failed to load, falling back to classic view')
        setDashboardView('classic')
      }
    }).catch(error => {
      console.error('❌ Critical error loading enhanced components:', error)
      setEnhancedComponentsReady(false)
      setDashboardView('classic')
    })
  }, [])

  const fetchMetrics = useCallback(async () => {
    if (!API_URL) {
      setMetricsError('VITE_SURICATA_API_URL is not set')
      return
    }
    setMetricsLoading(true)
    setMetricsError('')
    try {
      const response = await fetch(`${API_URL}/metrics`)
      if (!response.ok) {
        throw new Error(`Metrics request failed with status ${response.status}`)
      }
      const payload = await response.json()
      setMetrics(payload)
    } catch (err) {
      setMetricsError(err.message)
    } finally {
      setMetricsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  useEffect(() => {
    if (!API_URL) {
      setError('VITE_SURICATA_API_URL is not set')
      return
    }
    const controller = new AbortController()
    async function fetchEvents() {
      setLoading(true)
      setError('')
      try {
        const url = new URL(`${API_URL}/events`)
        url.searchParams.set('event_date', eventDate)
        url.searchParams.set('limit', String(limit))
        const response = await fetch(url.toString(), { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }
        const payload = await response.json()
        setEvents(payload.items ?? [])
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchEvents()
    return () => controller.abort()
  }, [API_URL, eventDate, limit])

  const eventTypes = useMemo(() => {
    const set = new Set()
    events.forEach(evt => set.add(evt.event_type || 'unknown'))
    return Array.from(set).sort()
  }, [events])

  const filteredEvents = useMemo(() => {
    let filtered = events

    // Apply basic filters
    const normalizedQuery = sourceQuery.trim().toLowerCase()
    filtered = filtered.filter(evt => {
      const typeMatch = typeFilter === 'all' || (evt.event_type || 'unknown') === typeFilter
      if (!typeMatch) {
        return false
      }
      if (normalizedQuery) {
        const fields = [evt.src_ip, evt.dest_ip]
        if (!fields.some(value => (value || '').toLowerCase().includes(normalizedQuery))) {
          return false
        }
      }
      return true
    })

    // Apply advanced filters if any
    if (Object.keys(advancedFilters).length > 0) {
      filtered = filtered.filter(evt => {
        // Date range filter
        if (advancedFilters.dateRange?.start || advancedFilters.dateRange?.end) {
          const eventTime = new Date(evt.event_time || evt.timestamp)
          if (advancedFilters.dateRange.start && eventTime < new Date(advancedFilters.dateRange.start)) {
            return false
          }
          if (advancedFilters.dateRange.end && eventTime > new Date(advancedFilters.dateRange.end)) {
            return false
          }
        }

        // Severity filter
        if (advancedFilters.severity?.length > 0) {
          const severity = evt.alert?.severity || evt.severity || 3
          if (!advancedFilters.severity.includes(severity)) {
            return false
          }
        }

        // Source IP filter
        if (advancedFilters.sourceIPs?.length > 0) {
          const srcIp = evt.src_ip || evt.source_ip
          if (!srcIp || !advancedFilters.sourceIPs.includes(srcIp)) {
            return false
          }
        }

        // Signature filter
        if (advancedFilters.signature) {
          const signature = evt.alert?.signature || evt.signature || ''
          if (!signature.toLowerCase().includes(advancedFilters.signature.toLowerCase())) {
            return false
          }
        }

        // Ports filter
        if (advancedFilters.ports?.length > 0) {
          const port = String(evt.dest_port || evt.destination_port || '')
          if (!advancedFilters.ports.includes(port)) {
            return false
          }
        }

        return true
      })
    }

    return filtered
  }, [events, sourceQuery, typeFilter, advancedFilters])

  const downloadReport = useCallback(() => {
    const headers = [
      'Timestamp',
      'Event Type',
      'Summary',
      'Source IP',
      'Source Port',
      'Destination IP',
      'Destination Port',
      'Severity',
    ]

    const toCsvValue = value => {
      if (value === null || value === undefined) {
        return '""'
      }
      const stringValue = String(value).replace(/"/g, '""')
      return `"${stringValue}"`
    }

    const rows = filteredEvents.map(evt => {
      const timestamp = formatTime(evt.event_time || evt.timestamp)
      const values = [
        timestamp,
        readableType(evt.event_type || 'unknown'),
        evt.summary || 'Suricata event',
        evt.src_ip || '?',
        evt.src_port !== undefined && evt.src_port !== null ? evt.src_port : '-',
        evt.dest_ip || '?',
        evt.dest_port !== undefined && evt.dest_port !== null ? evt.dest_port : '-',
        evt.severity ?? '-',
      ]
      return values.map(toCsvValue).join(',')
    })

    const csvContent = [headers.join(','), ...rows].join('\r\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const dateStamp = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = `suricata-report-${dateStamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [filteredEvents])

  const metricsTiles = useMemo(() => {
    if (!metrics) {
      return []
    }
    const safeMetrics = metrics.metrics || {}
    return [
      {
        key: 'events24h',
        label: 'Events (24h)',
        value: formatNumber(safeMetrics.events_24h),
        hint: `Since ${formatTime(metrics.windows?.events_24h)}`,
      },
      {
        key: 'uniqueIps',
        label: 'Unique IPs (24h)',
        value: formatNumber(safeMetrics.unique_ips_24h),
        hint: 'Distinct source IPs in window',
      },
      {
        key: 'highSeverity',
        label: 'High Severity (24h)',
        value: formatNumber(safeMetrics.high_severity_24h),
        hint: 'Severity 1 alerts',
      },
      {
        key: 'eventsPerMinute',
        label: 'Events / Min',
        value:
          safeMetrics.events_per_minute === undefined
            ? '--'
            : Number(safeMetrics.events_per_minute).toFixed(2),
        hint: `Avg since ${formatTime(metrics.windows?.events_per_minute)}`,
      },
      {
        key: 'newIps',
        label: 'New IPs (1h)',
        value: formatNumber(safeMetrics.new_ips_1h),
        hint: `Since ${formatTime(metrics.windows?.new_ips_1h)}`,
      },
      {
        key: 'topPort',
        label: 'Top Targeted Port',
        value: safeMetrics.top_port ? `:${safeMetrics.top_port.port}` : '--',
        hint: safeMetrics.top_port ? `${safeMetrics.top_port.count} hits in 24h` : 'No traffic yet',
      },
    ]
  }, [metrics])

  const volumeSeries = useMemo(() => {
    const buckets = new Map()
    filteredEvents.forEach(evt => {
      const date = getEventDate(evt)
      if (!date) {
        return
      }
      const minute = Math.floor(date.getTime() / 60000) * 60000
      buckets.set(minute, (buckets.get(minute) || 0) + 1)
    })
    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([timestamp, count]) => ({ timestamp, count }))
  }, [filteredEvents])

  const volumeChart = useMemo(() => {
    const width = 660
    const height = 180
    if (volumeSeries.length === 0) {
      return {
        width,
        height,
        coordinates: [],
        points: '',
        maxCount: 0,
        ticks: [],
        startTime: null,
        endTime: null,
      }
    }
    const minTs = volumeSeries[0].timestamp
    const maxTs = volumeSeries[volumeSeries.length - 1].timestamp
    const maxCount = Math.max(...volumeSeries.map(point => point.count), 0)
    const safeMaxCount = maxCount === 0 ? 1 : maxCount
    const sameTimestamp = maxTs === minTs
    const denominator = Math.max(volumeSeries.length - 1, 1)
    const coordinates = volumeSeries.map((point, index) => {
      const ratio = sameTimestamp
        ? index / denominator
        : (point.timestamp - minTs) / (maxTs - minTs || 1)
      const x = ratio * width
      const y = height - (point.count / safeMaxCount) * height
      return {
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        value: point.count,
        timestamp: point.timestamp,
      }
    })
    const ticks =
      maxCount === 0
        ? [0]
        : Array.from({ length: 5 }, (_, index) => Math.round((maxCount / 4) * index))
    return {
      width,
      height,
      coordinates,
      points: coordinates.map(coord => `${coord.x},${coord.y}`).join(' '),
      maxCount: safeMaxCount,
      ticks,
      startTime: formatTime(minTs),
      endTime: formatTime(maxTs),
    }
  }, [volumeSeries])

  const latestEventTime = useMemo(() => {
    const date = getEventDate(filteredEvents[0] || events[0])
    return date ? formatTime(date) : null
  }, [events, filteredEvents])

  const recentEvents = useMemo(() => filteredEvents.slice(0, 5), [filteredEvents])

  const topSources = useMemo(() => {
    const counts = new Map()
    filteredEvents.forEach(evt => {
      const key = evt.src_ip || 'Unknown'
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [filteredEvents])

  const severityBreakdown = useMemo(() => {
    if (filteredEvents.length === 0) {
      return []
    }
    const counts = new Map()
    filteredEvents.forEach(evt => {
      const key =
        evt.severity === null || evt.severity === undefined ? 'Unknown' : String(evt.severity)
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    const total = filteredEvents.length
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({
        label,
        count,
        percent: Math.round((count / total) * 100),
      }))
  }, [filteredEvents])

  // Handle event selection for detailed view
  const handleEventSelect = useCallback((event, index) => {
    setSelectedEvent({ event, index })
  }, [])

  // Handle advanced filter changes
  const handleAdvancedFiltersChange = useCallback((newFilters) => {
    setAdvancedFilters(newFilters)
  }, [])

  return (
    <section className="dashboard">
      <div className="dashboard__topbar">
        <div className="dashboard__search">
          <span className="dashboard__search-icon" aria-hidden="true">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="16.65" y1="16.65" x2="21" y2="21" />
            </svg>
          </span>
          <input
            type="search"
            value={sourceQuery}
            onChange={e => setSourceQuery(e.target.value)}
            placeholder="Search source or destination IP"
          />
          {(typeFilter !== 'all' || sourceQuery) && (
            <button
              type="button"
              className="dashboard__search-clear"
              onClick={() => {
                setSourceQuery('')
                setTypeFilter('all')
              }}
            >
              Clear
            </button>
          )}
        </div>
        <div className="dashboard__topbar-actions">
          <button type="button" className="dashboard__icon-button" aria-label="Toggle theme">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          </button>
          <button type="button" className="dashboard__icon-button" aria-label="Notifications">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
          </button>
          <button type="button" className="dashboard__icon-button" aria-label="Account settings">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06A2 2 0 012.83 4.3l.06.06a1.65 1.65 0 001.82.33H5a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82 1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
          <button
            type="button"
            className="dashboard__secondary-action"
            onClick={downloadReport}
            disabled={filteredEvents.length === 0}
          >
            Download report
          </button>

          <button
            type="button"
            className="dashboard__primary-action"
            onClick={fetchMetrics}
            disabled={metricsLoading}
          >
            {metricsLoading ? 'Refreshing...' : 'Refresh metrics'}
          </button>
          
          <button
            type="button"
            className={`dashboard__view-toggle ${dashboardView === 'enhanced' ? 'active' : ''}`}
            onClick={() => {
              if (dashboardView === 'enhanced') {
                setDashboardView('classic')
              } else {
                if (enhancedComponentsReady) {
                  setDashboardView('enhanced')
                } else {
                  alert('Enhanced components are still loading. Please wait...')
                }
              }
            }}
            style={{ 
              padding: '8px 16px', 
              borderRadius: '6px', 
              border: '1px solid #e5e7eb',
              background: dashboardView === 'enhanced' ? '#2563eb' : 'white',
              color: dashboardView === 'enhanced' ? 'white' : '#374151',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {dashboardView === 'enhanced' ? '📊 Enhanced' : '📋 Classic'}
            {!enhancedComponentsReady && dashboardView === 'enhanced' && ' (⚠️)'}
          </button>
        </div>
      </div>

      <header className="dashboard__hero">
        <div>
          <p className="dashboard__eyebrow">PhantomWall Telemetry Dashboard</p>
          <h1>Enterprise Threat Intelligence</h1>
          <p className="dashboard__intro">
            Real-time monitoring and AI-powered analysis of your honeypot network security events.
          </p>
        </div>
      </header>

      {metricsError && <div className="dashboard__alert dashboard__alert--error">{metricsError}</div>}

      {/* Advanced Filter Panel */}
      {dashboardView === 'enhanced' && AdvancedFilterPanel && (
        <AdvancedFilterPanel
          events={events}
          onFiltersChange={handleAdvancedFiltersChange}
          initialFilters={advancedFilters}
        />
      )}

      <div className="dashboard__kpis" aria-busy={metricsLoading}>
        {metricsTiles.length === 0 && !metricsLoading ? (
          <div className="dashboard__kpi-placeholder">Metrics will appear once data is ingested.</div>
        ) : (
          metricsTiles.map(tile => (
            <article key={tile.key} className="dashboard__kpi">
              <span className="dashboard__kpi-label">{tile.label}</span>
              <strong className="dashboard__kpi-value">{tile.value}</strong>
              <span className="dashboard__kpi-hint">{tile.hint}</span>
            </article>
          ))
        )}
      </div>

      {/* Security Alerts Table */}
      <AlertsTable />

      {/* Enhanced Dashboard Layout */}
      {dashboardView === 'enhanced' && (
        <div>
          {!enhancedComponentsReady ? (
            <div style={{ 
              padding: '40px', 
              textAlign: 'center',
              background: '#f8f9fa',
              borderRadius: '8px',
              margin: '20px 0'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '16px' }}>🔄</div>
              <h3>Loading Enhanced Components...</h3>
              <p>Please wait while we load the enterprise dashboard features.</p>
            </div>
          ) : enhancedComponentsReady && ThreatScoreEngine && ThreatMap && AttackTimeline && VirtualizedEventList ? (
            <div style={{ position: 'relative' }}>
              {/* Enhanced Components with Error Boundary */}
              <div 
                onError={(e) => {
                  console.error('Enhanced component error:', e)
                  setDashboardView('classic')
                }}
                style={{ minHeight: '200px' }}
              >
                {/* AI Threat Intelligence Row */}
                <div className="dashboard__intelligence-grid">
                  <ThreatScoreEngine 
                    events={filteredEvents} 
                    className="dashboard__threat-score"
                  />
                  <ThreatMap 
                    events={filteredEvents} 
                    className="dashboard__threat-map"
                  />
              </div>
              
              {/* Timeline and Event Analysis */}
              <div className="dashboard__analysis-grid">
                <AttackTimeline 
                  events={filteredEvents} 
                  className="dashboard__timeline"
                />
                <VirtualizedEventList 
                  events={filteredEvents}
                  onEventSelect={handleEventSelect} 
                  className="dashboard__event-list"
                />
              </div>
            </div>
          ) : (
            <div className="dashboard__alert dashboard__alert--error" style={{ padding: '20px', margin: '20px 0', background: '#fee', border: '1px solid #fcc', borderRadius: '8px' }}>
              <h3>⚠️ Enhanced Components Not Available</h3>
              <p>The enhanced dashboard components could not be loaded. Check the browser console for detailed error information.</p>
              <p>Possible issues:</p>
              <ul>
                <li>Component files are missing or corrupted</li>
                <li>Import paths are incorrect</li>
                <li>Syntax errors in component files</li>
                <li>Dependencies are missing</li>
              </ul>
              <button 
                style={{ marginTop: '12px', padding: '8px 16px', background: '#007cba', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                onClick={() => setDashboardView('classic')}
              >
                Switch to Classic View
              </button>
            </div>
          )}
        </div>
      )}

      {/* Classic Dashboard Layout */}
      <div className={`dashboard__main-grid ${dashboardView === 'enhanced' ? 'dashboard__main-grid--hidden' : ''}`}>
        <div className="dashboard__column dashboard__column--primary">
          <section className="dashboard__panel dashboard__panel--volume">
            <header className="dashboard__panel-header">
              <div>
                <h2>Event Volume</h2>
                <p>Aggregated view across the current filters.</p>
              </div>
              <div className="dashboard__panel-stat">
                <span>Total events</span>
                <strong>{formatNumber(filteredEvents.length)}</strong>
              </div>
            </header>
            <div className="dashboard__chart">
              {volumeChart.points ? (
                <svg
                  className="dashboard__chart-svg"
                  viewBox={`0 0 ${volumeChart.width} ${volumeChart.height}`}
                  preserveAspectRatio="none"
                  role="img"
                  aria-label="Event volume over time"
                >
                  <defs>
                    <linearGradient id="eventVolumeStroke" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" />
                      <stop offset="100%" stopColor="#1d4ed8" />
                    </linearGradient>
                  </defs>
                  {volumeChart.ticks.map((tick, index) => {
                    const position =
                      volumeChart.height - (tick / volumeChart.maxCount) * volumeChart.height
                    return (
                      <g key={`${tick}-${index}`}>
                        <line
                          className="dashboard__chart-gridline"
                          x1="0"
                          x2={volumeChart.width}
                          y1={position}
                          y2={position}
                        />
                        <text className="dashboard__chart-tick" x="0" y={position - 4}>
                          {tick}
                        </text>
                      </g>
                    )
                  })}
                  <polyline
                    className="dashboard__chart-line"
                    points={volumeChart.points}
                    fill="none"
                    stroke="url(#eventVolumeStroke)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {volumeChart.coordinates.map(point => (
                    <circle
                      key={point.timestamp}
                      className="dashboard__chart-dot"
                      cx={point.x}
                      cy={point.y}
                      r="4"
                    />
                  ))}
                </svg>
              ) : (
                <div className="dashboard__chart-placeholder">
                  Not enough events yet to render the trend.
                </div>
              )}
            </div>
            <footer className="dashboard__chart-meta">
              <span>
                Window:{' '}
                {volumeChart.startTime && volumeChart.endTime
                  ? `${volumeChart.startTime} -> ${volumeChart.endTime}`
                  : 'Awaiting data'}
              </span>
              <span>Latest event: {latestEventTime || 'None'}</span>
            </footer>
          </section>

          <section className="dashboard__panel dashboard__panel--stream">
            <header className="dashboard__panel-header">
              <div>
                <h2>Event Stream</h2>
                <p>Adjust the controls to explore recent Suricata events.</p>
              </div>
              <div className="dashboard__panel-controls">
                <label>
                  Event date
                  <input
                    type="date"
                    value={eventDate}
                    onChange={e => setEventDate(e.target.value)}
                  />
                </label>
                <label>
                  Limit
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={limit}
                    onChange={e =>
                      setLimit(Math.max(1, Math.min(Number(e.target.value) || 1, 500)))
                    }
                  />
                </label>
              </div>
            </header>

            <div className="dashboard__filters">
              <label>
                Event type
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                  <option value="all">All types</option>
                  {eventTypes.map(type => (
                    <option key={type} value={type}>
                      {readableType(type)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error && <div className="dashboard__alert dashboard__alert--error">{error}</div>}
            {loading && <div className="dashboard__alert dashboard__alert--info">Loading events...</div>}

            <div className="dashboard__table-wrapper">
              {filteredEvents.length === 0 && !loading ? (
                <p className="dashboard__empty">No events match the current filters.</p>
              ) : (
                <div className="dashboard__table-scroll">
                  <table className="dashboard__table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Event</th>
                        <th>Source</th>
                        <th>Destination</th>
                        <th>Severity</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEvents.map((evt, index) => {
                        const badgeType = evt.event_type || 'unknown'
                        const key =
                          evt.event_id ??
                          `${evt.src_ip || 'src'}-${evt.dest_ip || 'dest'}-${evt.timestamp || index}`
                        return (
                          <tr key={key}>
                            <td>
                              <div className="dashboard__table-primary">
                                {formatTime(evt.event_time || evt.timestamp)}
                              </div>
                              <div className={`dashboard__badge dashboard__badge--${badgeType}`}>
                                {readableType(badgeType)}
                              </div>
                            </td>
                            <td>
                              <div className="dashboard__table-primary">
                                {evt.summary || 'Suricata event'}
                              </div>
                            </td>
                            <td>
                              <div className="dashboard__table-primary">{evt.src_ip || '?'}</div>
                              <div className="dashboard__table-subtle">
                                {evt.src_port !== undefined && evt.src_port !== null
                                  ? `:${evt.src_port}`
                                  : '-'}
                              </div>
                            </td>
                            <td>
                              <div className="dashboard__table-primary">{evt.dest_ip || '?'}</div>
                              <div className="dashboard__table-subtle">
                                {evt.dest_port !== undefined && evt.dest_port !== null
                                  ? `:${evt.dest_port}`
                                  : '-'}
                              </div>
                            </td>
                            <td>{evt.severity ?? '-'}</td>
                            <td>
                              <details className="dashboard__raw" data-inline>
                                <summary>Raw payload</summary>
                                <pre>{JSON.stringify(evt.suricata, null, 2)}</pre>
                              </details>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="dashboard__column dashboard__column--secondary">
          <section className="dashboard__panel">
            <header className="dashboard__panel-header">
              <div>
                <h3>Recent Events</h3>
                <p>Quick view of the latest Suricata activity.</p>
              </div>
            </header>
            <ul className="dashboard__recent-list">
              {recentEvents.length === 0 ? (
                <li className="dashboard__recent-placeholder">
                  Events will appear here once data arrives.
                </li>
              ) : (
                recentEvents.map((evt, index) => {
                  const dateObj = getEventDate(evt)
                  const isoTime = dateObj ? dateObj.toISOString() : undefined
                  return (
                    <li key={evt.event_id ?? index}>
                      <div className="dashboard__recent-main">
                        <span className="dashboard__recent-title">
                          {evt.summary || 'Suricata event'}
                        </span>
                        <span className="dashboard__recent-severity">
                          Severity {evt.severity ?? '-'}
                        </span>
                      </div>
                      <div className="dashboard__recent-meta">
                        <span>{`${evt.src_ip || '?'} -> ${evt.dest_ip || '?'}`}</span>
                        <time dateTime={isoTime}>{formatTime(dateObj)}</time>
                      </div>
                    </li>
                  )
                })
              )}
            </ul>
          </section>

          <section className="dashboard__panel">
            <header className="dashboard__panel-header">
              <div>
                <h3>Top Source IPs</h3>
                <p>Most active sources in the current window.</p>
              </div>
            </header>
            <ul className="dashboard__stat-list">
              {topSources.length === 0 ? (
                <li className="dashboard__stat-placeholder">No source data yet.</li>
              ) : (
                topSources.map(([ip, count]) => (
                  <li key={ip}>
                    <span>{ip}</span>
                    <span className="dashboard__stat-value">{formatNumber(count)}</span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="dashboard__panel">
            <header className="dashboard__panel-header">
              <div>
                <h3>Severity Mix</h3>
                <p>Distribution of alert severities.</p>
              </div>
            </header>
            <ul className="dashboard__stat-list">
              {severityBreakdown.length === 0 ? (
                <li className="dashboard__stat-placeholder">No severity data yet.</li>
              ) : (
                severityBreakdown.map(item => (
                  <li key={item.label}>
                    <span>Severity {item.label}</span>
                    <span className="dashboard__stat-value">
                      {formatNumber(item.count)}{' '}
                      <span className="dashboard__stat-percent">({item.percent}%)</span>
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </aside>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="event-detail-modal" onClick={() => setSelectedEvent(null)}>
          <div className="event-detail-content" onClick={(e) => e.stopPropagation()}>
            <div className="event-detail-header">
              <div>
                <h3>🔍 Event Details</h3>
                <p>Comprehensive analysis of selected security event</p>
              </div>
              <button 
                className="event-detail-close"
                onClick={() => setSelectedEvent(null)}
              >
                ×
              </button>
            </div>
            
            <div className="event-detail-body">
              <div className="event-detail-section">
                <h4>📋 Basic Information</h4>
                <div className="event-detail-field">
                  <span className="event-detail-label">Timestamp</span>
                  <span className="event-detail-value">
                    {formatTime(selectedEvent.event.event_time || selectedEvent.event.timestamp)}
                  </span>
                </div>
                <div className="event-detail-field">
                  <span className="event-detail-label">Event Type</span>
                  <span className="event-detail-value">
                    {readableType(selectedEvent.event.event_type || 'unknown')}
                  </span>
                </div>
                <div className="event-detail-field">
                  <span className="event-detail-label">Severity</span>
                  <span className="event-detail-value">
                    {selectedEvent.event.severity ?? 'Unknown'}
                  </span>
                </div>
                <div className="event-detail-field">
                  <span className="event-detail-label">Signature</span>
                  <span className="event-detail-value">
                    {selectedEvent.event.alert?.signature || selectedEvent.event.signature || 'N/A'}
                  </span>
                </div>
              </div>
              
              <div className="event-detail-section">
                <h4>🌐 Network Details</h4>
                <div className="event-detail-field">
                  <span className="event-detail-label">Source IP</span>
                  <span className="event-detail-value">
                    {selectedEvent.event.src_ip || selectedEvent.event.source_ip || '?'}
                  </span>
                </div>
                <div className="event-detail-field">
                  <span className="event-detail-label">Source Port</span>
                  <span className="event-detail-value">
                    {selectedEvent.event.src_port || selectedEvent.event.source_port || '-'}
                  </span>
                </div>
                <div className="event-detail-field">
                  <span className="event-detail-label">Destination IP</span>
                  <span className="event-detail-value">
                    {selectedEvent.event.dest_ip || selectedEvent.event.destination_ip || '?'}
                  </span>
                </div>
                <div className="event-detail-field">
                  <span className="event-detail-label">Destination Port</span>
                  <span className="event-detail-value">
                    {selectedEvent.event.dest_port || selectedEvent.event.destination_port || '-'}
                  </span>
                </div>
                <div className="event-detail-field">
                  <span className="event-detail-label">Protocol</span>
                  <span className="event-detail-value">
                    {selectedEvent.event.proto || selectedEvent.event.protocol || 'Unknown'}
                  </span>
                </div>
              </div>
              
              {selectedEvent.event.suricata && (
                <div className="event-detail-section" style={{ gridColumn: '1 / -1' }}>
                  <h4>🔬 Raw Suricata Data</h4>
                  <pre style={{ 
                    background: 'white', 
                    padding: '12px', 
                    borderRadius: '6px', 
                    fontSize: '11px',
                    overflow: 'auto',
                    maxHeight: '200px'
                  }}>
                    {JSON.stringify(selectedEvent.event.suricata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
