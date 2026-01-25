import React, { useCallback, useEffect, useMemo, useState } from 'react'

const API_URL = import.meta.env.VITE_SURICATA_API_URL

// Import component tester
let ComponentTester, ComponentImportTest, enhancedComponents = {}
let componentLoadResults = []

// Test enhanced component imports individually
const testComponents = [
  'ThreatMap',
  'AttackTimeline', 
  'ThreatScoreEngine',
  'VirtualizedEventList',
  'AdvancedFilterPanel',
  'TestComponent'
]

testComponents.forEach(componentName => {
  try {
    enhancedComponents[componentName] = require(`./components/${componentName}`).default
    componentLoadResults.push(`✅ ${componentName}: Loaded successfully`)
  } catch (error) {
    componentLoadResults.push(`❌ ${componentName}: ${error.message}`)
  }
})

// Test CSS import
try {
  require('./components/dashboard-enhancements.css')
  componentLoadResults.push('✅ dashboard-enhancements.css: Loaded successfully')
} catch (error) {
  componentLoadResults.push(`❌ dashboard-enhancements.css: ${error.message}`)
}

try {
  ComponentTester = require('./ComponentTester').default
  ComponentImportTest = require('./ComponentImportTest').default
} catch (error) {
  console.error('Component imports failed to load:', error)
}

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

export default function DashboardSafe() {
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [limit, setLimit] = useState(100)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [events, setEvents] = useState([])
  const [typeFilter, setTypeFilter] = useState('all')
  const [sourceQuery, setSourceQuery] = useState('')

  const [metrics, setMetrics] = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [metricsError, setMetricsError] = useState('')

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

  const filteredEvents = useMemo(() => {
    const normalizedQuery = sourceQuery.trim().toLowerCase()
    return events.filter(evt => {
      const typeMatch = typeFilter === 'all' || (evt.event_type || 'unknown') === typeFilter
      if (!typeMatch) {
        return false
      }
      if (!normalizedQuery) {
        return true
      }
      const fields = [evt.src_ip, evt.dest_ip]
      return fields.some(value => (value || '').toLowerCase().includes(normalizedQuery))
    })
  }, [events, sourceQuery, typeFilter])

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '32px 24px',
        borderRadius: '12px',
        marginBottom: '24px'
      }}>
        <p style={{ margin: '0 0 8px 0', opacity: 0.9 }}>PhantomWall Telemetry Dashboard</p>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '32px' }}>Dashboard Loaded Successfully ✅</h1>
        <p style={{ margin: 0, opacity: 0.8 }}>
          Your dashboard is working! This is a safe version to ensure functionality.
        </p>
      </div>

      <div style={{ 
        background: 'white', 
        padding: '20px', 
        borderRadius: '8px', 
        border: '1px solid #e5e7eb',
        marginBottom: '20px'
      }}>
        <h2>🎯 Status Check</h2>
        <ul>
          <li>✅ Dashboard component loaded</li>
          <li>✅ React hooks working</li>
          <li>✅ API URL configured: {API_URL ? '✅ Set' : '❌ Missing'}</li>
          <li>✅ Events loaded: {events.length} events</li>
          <li>✅ Filtered events: {filteredEvents.length} events</li>
        </ul>
      </div>

      {metricsError && (
        <div style={{ 
          background: '#fee', 
          border: '1px solid #fcc', 
          padding: '16px', 
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <strong>Metrics Error:</strong> {metricsError}
        </div>
      )}

      <div style={{ 
        background: 'white', 
        padding: '20px', 
        borderRadius: '8px', 
        border: '1px solid #e5e7eb'
      }}>
        <h3>Recent Events ({filteredEvents.length})</h3>
        {loading && <p>Loading events...</p>}
        {error && <p style={{ color: 'red' }}>Error: {error}</p>}
        
        {filteredEvents.slice(0, 10).map((evt, index) => (
          <div key={index} style={{ 
            padding: '12px', 
            border: '1px solid #f3f4f6', 
            marginBottom: '8px',
            borderRadius: '6px',
            background: '#f9fafb'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{evt.summary || 'Suricata event'}</strong>
              <span style={{ fontSize: '12px', color: '#666' }}>
                {formatTime(evt.event_time || evt.timestamp)}
              </span>
            </div>
            <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
              {evt.src_ip || '?'} → {evt.dest_ip || '?'} 
              {evt.severity && ` | Severity: ${evt.severity}`}
            </div>
          </div>
        ))}
        
        {filteredEvents.length === 0 && !loading && (
          <p>No events found. Check your API configuration and honeypot setup.</p>
        )}
      </div>
      
      {/* Component Tester */}
      {ComponentTester && <ComponentTester />}
      {ComponentImportTest && <ComponentImportTest />}
      
      {/* Enhanced Component Import Test Results */}
      <div style={{ 
        padding: '20px', 
        background: '#f5f5f5', 
        borderRadius: '8px',
        margin: '20px',
        fontFamily: 'monospace'
      }}>
        <h3>🔧 Enhanced Component Load Test</h3>
        {componentLoadResults.map((result, index) => (
          <div key={index} style={{ 
            padding: '8px', 
            margin: '4px 0', 
            background: result.includes('✅') ? '#d4edda' : '#f8d7da',
            borderRadius: '4px'
          }}>
            {result}
          </div>
        ))}
      </div>
    </div>
  )
}