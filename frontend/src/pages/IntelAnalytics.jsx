import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, Legend,
} from 'recharts'
import 'leaflet/dist/leaflet.css'
import '../components/IntelAnalytics.css'

const API_URL = import.meta.env.VITE_SURICATA_API_URL
const REFRESH_INTERVAL = 60 // seconds
const SETTINGS_STORAGE_KEY = 'phantomwall_settings'
const SETTINGS_SAVED_EVENT = 'phantomwall:settings-saved'

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */
const RANGE_OPTIONS = [
  { key: '24h', label: '24 Hours' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
]

const SEVERITY_COLORS = {
  Critical: '#ef4444',
  Major: '#f59e0b',
  Minor: '#3b82f6',
  Info: '#94a3b8',
}

const PROTOCOL_COLORS = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899']

const MAP_TILE_PROVIDERS = {
  voyager: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com">CARTO</a>',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com">CARTO</a>',
  },
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com">CARTO</a>',
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
}

const readUiSettings = () => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

const EVENT_PALETTE = {
  alert: '#ef4444', dns: '#3b82f6', http: '#10b981', tls: '#8b5cf6',
  flow: '#64748b', tcp: '#06b6d4', anomaly: '#f59e0b', drop: '#dc2626',
  fileinfo: '#ec4899', stats: '#9ca3af',
}

/* Threat-level color stops for map legend */
const MAP_LEGEND = [
  { label: 'Low', color: '#06b6d4' },
  { label: 'Medium', color: '#f59e0b' },
  { label: 'Critical', color: '#ef4444' },
]

/* Country → lat/lon lookup for map plotting */
const COUNTRY_COORDS = {
  US: [37.09, -95.71], CN: [35.86, 104.19], RU: [61.52, 105.32],
  DE: [51.17, 10.45], BR: [-14.24, -51.93], IN: [20.59, 78.96],
  FR: [46.23, 2.21], GB: [55.38, -3.44], JP: [36.2, 138.25],
  KR: [35.91, 127.77], NL: [52.13, 5.29], IR: [32.43, 53.69],
  VN: [14.06, 108.28], ID: [-0.79, 113.92], UA: [48.38, 31.17],
  PL: [51.92, 19.15], TR: [38.96, 35.24], CA: [56.13, -106.35],
  AU: [-25.27, 133.78], SG: [1.35, 103.82], TW: [23.7, 120.96],
  MX: [23.63, -102.55], AR: [-38.42, -63.62], ZA: [-30.56, 22.94],
  SE: [60.13, 18.64], IT: [41.87, 12.57], ES: [40.46, -3.75],
  TH: [15.87, 100.99], PH: [12.88, 121.77], RO: [45.94, 24.97],
  PK: [30.38, 69.35], NG: [9.08, 8.68], EG: [26.82, 30.8],
  Unknown: [0, 0],
}

/* Country code → flag emoji */
const flag = (cc) => {
  if (!cc || cc === 'Unknown' || cc.length !== 2) return '🏴'
  return String.fromCodePoint(...[...cc.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
}

/* Threat-level label for overall fleet */
const threatGrade = (alertPct) => {
  if (alertPct > 40) return { label: 'CRITICAL', color: '#ef4444' }
  if (alertPct > 20) return { label: 'ELEVATED', color: '#f59e0b' }
  if (alertPct > 5) return { label: 'GUARDED', color: '#3b82f6' }
  return { label: 'LOW', color: '#10b981' }
}

/* ═══════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════ */
const KpiCard = ({ icon, value, label, accent = '#06b6d4', trend }) => (
  <div className="intel__kpi" style={{ '--kpi-accent': accent }}>
    <span className="intel__kpi-icon">{icon}</span>
    <div className="intel__kpi-body">
      <span className="intel__kpi-value">{value}</span>
      <span className="intel__kpi-label">{label}</span>
    </div>
    {trend !== undefined && (
      <span className="intel__kpi-trend" style={{ color: trend >= 0 ? '#ef4444' : '#10b981' }}>
        {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
      </span>
    )}
  </div>
)

const RangeToggle = ({ range, setRange }) => (
  <div className="intel__range-toggle">
    {RANGE_OPTIONS.map(r => (
      <button
        key={r.key}
        className={`intel__range-btn${range === r.key ? ' intel__range-btn--active' : ''}`}
        onClick={() => setRange(r.key)}
      >
        {r.label}
      </button>
    ))}
  </div>
)

/* Custom recharts tooltip */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="intel__chart-tip">
      <p className="intel__chart-tip-label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */
export default function IntelAnalytics({ language = 'en' }) {
  const isVietnamese = language === 'vi'
  const [alerts, setAlerts] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [range, setRange] = useState('7d')
  const [uiSettings, setUiSettings] = useState(() => readUiSettings())
  const [mapReady, setMapReady] = useState(false)
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL)
  const [lastUpdated, setLastUpdated] = useState(null)
  const mapRef = useRef(null)

  const refreshInterval = useMemo(() => {
    const raw = Number(uiSettings?.data_autoRefreshSec)
    if (Number.isNaN(raw)) return REFRESH_INTERVAL
    return Math.min(300, Math.max(5, raw))
  }, [uiSettings])

  const mapProviderKey = useMemo(() => {
    const key = uiSettings?.mapTileProvider
    return MAP_TILE_PROVIDERS[key] ? key : 'voyager'
  }, [uiSettings])

  const mapTile = MAP_TILE_PROVIDERS[mapProviderKey]

  useEffect(() => {
    const sync = () => setUiSettings(readUiSettings())
    const onSaved = (event) => setUiSettings(event?.detail || readUiSettings())
    window.addEventListener('storage', sync)
    window.addEventListener(SETTINGS_SAVED_EVENT, onSaved)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(SETTINGS_SAVED_EVENT, onSaved)
    }
  }, [])

  /* ── Data Fetch ──────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    if (!API_URL) {
      const now = Date.now()
      const hours = (h) => now - h * 3600000
      const days = (d) => now - d * 86400000
      const mockAlerts = [
        { event_id: 'in-001', src_ip: '203.0.113.42', severity: 1, event_type: 'alert', event_time: new Date(hours(1)).toISOString(), proto: 'TCP', country_code: 'CN', country_name: 'China', flag: '🇨🇳', signature: 'ET SCAN SSH Scan', category: 'Attempted Information Leak' },
        { event_id: 'in-002', src_ip: '198.51.100.17', severity: 2, event_type: 'alert', event_time: new Date(hours(2)).toISOString(), proto: 'TCP', country_code: 'RU', country_name: 'Russia', flag: '🇷🇺', signature: 'ET POLICY SSH Non-Standard Port', category: 'Potentially Bad Traffic' },
        { event_id: 'in-003', src_ip: '203.0.113.88', severity: 1, event_type: 'alert', event_time: new Date(hours(3)).toISOString(), proto: 'TCP', country_code: 'BR', country_name: 'Brazil', flag: '🇧🇷', signature: 'ET EXPLOIT SQL Injection', category: 'Web Application Attack' },
        { event_id: 'in-004', src_ip: '192.0.2.201', severity: 3, event_type: 'alert', event_time: new Date(hours(4)).toISOString(), proto: 'TCP', country_code: 'VN', country_name: 'Vietnam', flag: '🇻🇳', signature: 'ET SCAN Nmap Scripting Engine', category: 'Detection of a Network Scan' },
        { event_id: 'in-005', src_ip: '198.51.100.55', severity: 2, event_type: 'alert', event_time: new Date(hours(5)).toISOString(), proto: 'TCP', country_code: 'IN', country_name: 'India', flag: '🇮🇳', signature: 'ET SCAN Telnet BruteForce', category: 'Attempted Information Leak' },
        { event_id: 'in-006', src_ip: '203.0.113.119', severity: 1, event_type: 'alert', event_time: new Date(hours(6)).toISOString(), proto: 'TCP', country_code: 'CN', country_name: 'China', flag: '🇨🇳', signature: 'ET EXPLOIT Apache Struts RCE', category: 'Web Application Attack' },
        { event_id: 'in-007', src_ip: '192.0.2.44', severity: 2, event_type: 'alert', event_time: new Date(hours(8)).toISOString(), proto: 'TCP', country_code: 'DE', country_name: 'Germany', flag: '🇩🇪', signature: 'ET SCAN LibSSH Scan', category: 'Detection of a Network Scan' },
        { event_id: 'in-008', src_ip: '203.0.113.200', severity: 3, event_type: 'dns', event_time: new Date(hours(9)).toISOString(), proto: 'UDP', country_code: 'RU', country_name: 'Russia', flag: '🇷🇺', signature: '', category: '' },
        { event_id: 'in-009', src_ip: '198.51.100.78', severity: 2, event_type: 'alert', event_time: new Date(hours(10)).toISOString(), proto: 'TCP', country_code: 'BR', country_name: 'Brazil', flag: '🇧🇷', signature: 'ET SCAN VNC Scan', category: 'Detection of a Network Scan' },
        { event_id: 'in-010', src_ip: '192.0.2.155', severity: 1, event_type: 'alert', event_time: new Date(hours(12)).toISOString(), proto: 'TCP', country_code: 'CN', country_name: 'China', flag: '🇨🇳', signature: 'ET WEB_SERVER XSS via Cookie', category: 'Web Application Attack' },
        { event_id: 'in-011', src_ip: '203.0.113.42', severity: 2, event_type: 'alert', event_time: new Date(hours(14)).toISOString(), proto: 'TCP', country_code: 'CN', country_name: 'China', flag: '🇨🇳', signature: 'ET EXPLOIT EternalBlue', category: 'Misc Attack' },
        { event_id: 'in-012', src_ip: '198.51.100.222', severity: 3, event_type: 'http', event_time: new Date(hours(16)).toISOString(), proto: 'TCP', country_code: 'DE', country_name: 'Germany', flag: '🇩🇪', signature: '', category: '' },
        { event_id: 'in-013', src_ip: '203.0.113.150', severity: 2, event_type: 'alert', event_time: new Date(hours(18)).toISOString(), proto: 'TCP', country_code: 'RU', country_name: 'Russia', flag: '🇷🇺', signature: 'ET WEB_SERVER PHP Remote File Include', category: 'Web Application Attack' },
        { event_id: 'in-014', src_ip: '192.0.2.30', severity: 4, event_type: 'flow', event_time: new Date(hours(20)).toISOString(), proto: 'TCP', country_code: 'US', country_name: 'United States', flag: '🇺🇸', signature: '', category: '' },
        { event_id: 'in-015', src_ip: '203.0.113.67', severity: 3, event_type: 'dns', event_time: new Date(hours(22)).toISOString(), proto: 'UDP', country_code: 'VN', country_name: 'Vietnam', flag: '🇻🇳', signature: '', category: '' },
        { event_id: 'in-016', src_ip: '192.0.2.88', severity: 1, event_type: 'alert', event_time: new Date(days(1)).toISOString(), proto: 'TCP', country_code: 'CN', country_name: 'China', flag: '🇨🇳', signature: 'ET SCAN Potential SSH Scan', category: 'Attempted Information Leak' },
        { event_id: 'in-017', src_ip: '198.51.100.133', severity: 2, event_type: 'alert', event_time: new Date(days(1.5)).toISOString(), proto: 'TCP', country_code: 'IN', country_name: 'India', flag: '🇮🇳', signature: 'ET POLICY Incoming Basic Auth', category: 'Attempted Information Leak' },
        { event_id: 'in-018', src_ip: '203.0.113.77', severity: 1, event_type: 'alert', event_time: new Date(days(2)).toISOString(), proto: 'TCP', country_code: 'BR', country_name: 'Brazil', flag: '🇧🇷', signature: 'ET EXPLOIT SQL Injection SELECT', category: 'Web Application Attack' },
        { event_id: 'in-019', src_ip: '192.0.2.99', severity: 3, event_type: 'alert', event_time: new Date(days(2.5)).toISOString(), proto: 'ICMP', country_code: 'VN', country_name: 'Vietnam', flag: '🇻🇳', signature: 'ET SCAN ICMP Flood', category: 'DoS Attack' },
        { event_id: 'in-020', src_ip: '198.51.100.91', severity: 2, event_type: 'alert', event_time: new Date(days(3)).toISOString(), proto: 'TCP', country_code: 'US', country_name: 'United States', flag: '🇺🇸', signature: 'ET POLICY HTTP Basic Auth', category: 'Attempted Information Leak' },
        { event_id: 'in-021', src_ip: '203.0.113.42', severity: 1, event_type: 'alert', event_time: new Date(days(3.5)).toISOString(), proto: 'TCP', country_code: 'CN', country_name: 'China', flag: '🇨🇳', signature: 'ET EXPLOIT Apache RCE', category: 'Web Application Attack' },
        { event_id: 'in-022', src_ip: '192.0.2.201', severity: 2, event_type: 'alert', event_time: new Date(days(4)).toISOString(), proto: 'TCP', country_code: 'VN', country_name: 'Vietnam', flag: '🇻🇳', signature: 'ET SCAN Aggressive Port Scan', category: 'Detection of a Network Scan' },
        { event_id: 'in-023', src_ip: '198.51.100.17', severity: 3, event_type: 'tls', event_time: new Date(days(4.5)).toISOString(), proto: 'TCP', country_code: 'RU', country_name: 'Russia', flag: '🇷🇺', signature: '', category: '' },
        { event_id: 'in-024', src_ip: '203.0.113.88', severity: 1, event_type: 'alert', event_time: new Date(days(5)).toISOString(), proto: 'TCP', country_code: 'BR', country_name: 'Brazil', flag: '🇧🇷', signature: 'ET WEB_SERVER Directory Traversal', category: 'Web Application Attack' },
        { event_id: 'in-025', src_ip: '192.0.2.44', severity: 2, event_type: 'alert', event_time: new Date(days(5.5)).toISOString(), proto: 'TCP', country_code: 'DE', country_name: 'Germany', flag: '🇩🇪', signature: 'ET SCAN MySQL Scan', category: 'Detection of a Network Scan' },
        { event_id: 'in-026', src_ip: '203.0.113.119', severity: 1, event_type: 'alert', event_time: new Date(days(6)).toISOString(), proto: 'TCP', country_code: 'CN', country_name: 'China', flag: '🇨🇳', signature: 'ET EXPLOIT Log4Shell JNDI', category: 'Web Application Attack' },
        { event_id: 'in-027', src_ip: '198.51.100.55', severity: 3, event_type: 'flow', event_time: new Date(days(6.5)).toISOString(), proto: 'TCP', country_code: 'IN', country_name: 'India', flag: '🇮🇳', signature: '', category: '' },
      ]
      setAlerts(mockAlerts)
      setMetrics({ metrics: { total_events: 14892, unique_ips_24h: 87, events_per_minute: 12, events_24h: 1247, top_port: { port: 22, count: 4231 } } })
      setLastUpdated(new Date())
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const [alertsRes, metricsRes] = await Promise.all([
        fetch(`${API_URL}/events`),
        fetch(`${API_URL}/metrics`),
      ])
      const responseErrors = []
      if (alertsRes.ok) {
        const d = await alertsRes.json()
        setAlerts(d.items || [])
      } else {
        responseErrors.push(`/events (${alertsRes.status})`)
      }
      if (metricsRes.ok) {
        const m = await metricsRes.json()
        setMetrics(m)
      } else {
        responseErrors.push(`/metrics (${metricsRes.status})`)
      }
      if (responseErrors.length === 2) {
        throw new Error(`Failed to load analytics endpoints: ${responseErrors.join(', ')}`)
      }
      if (responseErrors.length === 1) {
        setError(`Partial data loaded. Endpoint unavailable: ${responseErrors[0]}`)
      }
      setLastUpdated(new Date())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  /* ── Auto-refresh countdown ─────────────────────────────── */
  useEffect(() => {
    setCountdown(refreshInterval)
    const id = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          fetchData()
          return refreshInterval
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [fetchData, refreshInterval])

  /* ── Derived Analytics ───────────────────────────────────── */
  const analytics = useMemo(() => {
    if (!alerts.length) return null

    // Time filter
    const now = Date.now()
    const rangeMs = range === '24h' ? 86400e3 : range === '7d' ? 604800e3 : 2592000e3
    const filtered = alerts.filter(a => {
      const t = new Date(a.event_time || a.timestamp).getTime()
      return now - t <= rangeMs
    })

    // Top origins (country)
    const countryMap = {}
    filtered.forEach(a => {
      const cc = a.country_code || 'Unknown'
      const name = a.country_name || cc
      if (!countryMap[cc]) countryMap[cc] = { cc, name, flag: a.flag || flag(cc), count: 0 }
      countryMap[cc].count++
    })
    const topCountries = Object.values(countryMap).sort((a, b) => b.count - a.count).slice(0, 12)

    // Map markers (country → coord)
    const markers = topCountries
      .filter(c => COUNTRY_COORDS[c.cc])
      .map(c => ({
        ...c,
        lat: COUNTRY_COORDS[c.cc][0],
        lon: COUNTRY_COORDS[c.cc][1],
        radius: Math.max(6, Math.min(30, Math.sqrt(c.count) * 3)),
      }))

    // Top IPs
    const ipMap = {}
    filtered.forEach(a => {
      const ip = a.src_ip || 'unknown'
      if (!ipMap[ip]) ipMap[ip] = { ip, count: 0, cc: a.country_code || '??', flag: a.flag || '' }
      ipMap[ip].count++
    })
    const topIPs = Object.values(ipMap).sort((a, b) => b.count - a.count).slice(0, 10)

    // Event type breakdown
    const typeMap = {}
    filtered.forEach(a => {
      const t = (a.event_type || 'unknown').toLowerCase()
      typeMap[t] = (typeMap[t] || 0) + 1
    })
    const eventTypes = Object.entries(typeMap)
      .map(([name, value]) => ({ name, value, fill: EVENT_PALETTE[name] || '#64748b' }))
      .sort((a, b) => b.value - a.value)

    // Severity breakdown
    const sevMap = { Critical: 0, Major: 0, Minor: 0, Info: 0 }
    filtered.forEach(a => {
      const s = a.severity || a.alert?.severity || 4
      if (s === 1) sevMap.Critical++
      else if (s === 2) sevMap.Major++
      else if (s === 3) sevMap.Minor++
      else sevMap.Info++
    })
    const severityData = Object.entries(sevMap)
      .map(([name, value]) => ({ name, value, fill: SEVERITY_COLORS[name] }))
      .filter(d => d.value > 0)

    // Protocol breakdown
    const protoMap = {}
    filtered.forEach(a => {
      const p = (a.proto || a.protocol || 'unknown').toUpperCase()
      protoMap[p] = (protoMap[p] || 0) + 1
    })
    const protocols = Object.entries(protoMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)

    // Trend data (hourly for 24h, daily for 7d/30d)
    const bucketMs = range === '24h' ? 3600e3 : 86400e3
    const bucketCount = range === '24h' ? 24 : range === '7d' ? 7 : 30
    const trend = Array.from({ length: bucketCount }, (_, i) => {
      const bucketStart = now - (bucketCount - i) * bucketMs
      const bucketEnd = bucketStart + bucketMs
      const inBucket = filtered.filter(a => {
        const t = new Date(a.event_time || a.timestamp).getTime()
        return t >= bucketStart && t < bucketEnd
      })
      const alertCount = inBucket.filter(a => (a.event_type || '').toLowerCase() === 'alert').length
      const label = range === '24h'
        ? `${new Date(bucketStart).getHours()}:00`
        : new Date(bucketStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return { label, total: inBucket.length, alerts: alertCount }
    })

    // Calculate trend percentage vs previous period
    const halfIdx = Math.floor(filtered.length / 2)
    const recentHalf = filtered.slice(0, halfIdx).length
    const olderHalf = filtered.slice(halfIdx).length
    const trendPct = olderHalf > 0 ? Math.round(((recentHalf - olderHalf) / olderHalf) * 100) : 0

    return {
      total: filtered.length,
      uniqueIPs: Object.keys(ipMap).length,
      countries: Object.keys(countryMap).length,
      alertCount: filtered.filter(a => (a.event_type || '').toLowerCase() === 'alert').length,
      trendPct,
      topCountries,
      markers,
      topIPs,
      eventTypes,
      severityData,
      protocols,
      trend,
    }
  }, [alerts, range])

  /* ═══════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════ */
  const grade = analytics ? threatGrade((analytics.alertCount / (analytics.total || 1)) * 100) : null
  const liveMetrics = metrics?.metrics || null

  const handleExportAttackersCsv = () => {
    if (!analytics?.topIPs?.length) return
    const headers = ['rank', 'ip', 'country_code', 'events', 'percent_of_total']
    const rows = analytics.topIPs.map((ip, idx) => [
      idx + 1,
      ip.ip || '',
      ip.cc || '',
      ip.count || 0,
      ((ip.count / (analytics.total || 1)) * 100).toFixed(2),
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `intel-top-attackers-${range}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="intel">
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="intel__hero">
        <div className="intel__hero-text">
          <p className="intel__eyebrow">{isVietnamese ? 'PhantomWall / Tinh bao & Phan tich' : 'PhantomWall / Intel & Analytics'}</p>
          <h2>{isVietnamese ? '🌐 Tinh bao de doa' : '🌐 Threat Intelligence'}</h2>
          <p className="intel__hero-sub">
            {isVietnamese
              ? 'Goc nhin chien luoc ve mau tan cong, nguon goc dia ly va xu huong de doa dai han tren fleet honeypot cua ban.'
              : 'Strategic view of attack patterns, geographic origins, and long-term threat trends across your honeypot fleet.'}
          </p>
        </div>
        <div className="intel__hero-actions">
          {grade && (
            <div className="intel__threat-level" style={{ '--threat-color': grade.color }}>
              <span className="intel__threat-level-dot" />
              <span className="intel__threat-level-label">{grade.label}</span>
            </div>
          )}
          <RangeToggle range={range} setRange={setRange} />
          <div className="intel__refresh-row">
            <button className="intel__refresh-btn" onClick={() => { fetchData(); setCountdown(refreshInterval) }} title={isVietnamese ? 'Lam moi ngay' : 'Refresh now'}>
              ↻
            </button>
            <span className="intel__refresh-cd">{countdown}s</span>
            {lastUpdated && (
              <span className="intel__last-updated">
                {isVietnamese ? 'Cap nhat' : 'Updated'} {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ── KPI Strip ─────────────────────────────────────── */}
      {analytics && (
        <div className="intel__kpis">
          <KpiCard icon="📊" value={analytics.total.toLocaleString()} label={isVietnamese ? 'Tong su kien' : 'Total Events'} accent="#06b6d4" trend={analytics.trendPct} />
          <KpiCard icon="🚨" value={analytics.alertCount.toLocaleString()} label={isVietnamese ? 'Canh bao' : 'Alerts'} accent="#ef4444" />
          <KpiCard icon="🌍" value={analytics.countries} label={isVietnamese ? 'Quoc gia' : 'Countries'} accent="#8b5cf6" />
          <KpiCard icon="🎯" value={(liveMetrics?.unique_ips_24h ?? analytics.uniqueIPs).toLocaleString()} label={isVietnamese ? 'IP duy nhat (24h)' : 'Unique IPs (24h)'} accent="#f59e0b" />
          <KpiCard icon="📡" value={liveMetrics?.events_per_minute ?? '—'} label={isVietnamese ? 'Su kien / Phut (Live)' : 'Events / Min (Live)'} accent="#10b981" />
        </div>
      )}

      {/* ── Error / Loading ───────────────────────────────── */}
      {error && (
        <div className="intel__error">
          <span className="intel__error-icon">⚠️</span>
          <div><strong>{isVietnamese ? 'Loi ket noi' : 'Connection Error'}</strong><p>{error}</p></div>
        </div>
      )}

      {loading && (
        <div className="intel__loading">
          <div className="intel__loading-spinner" />
          <p>{isVietnamese ? 'Dang tong hop tinh bao de doa…' : 'Aggregating threat intelligence…'}</p>
          <p className="intel__loading-hint">{isVietnamese ? 'Dang truy van su kien va chi so' : 'Querying events & metrics'}</p>
        </div>
      )}

      {/* ── Main Grid ─────────────────────────────────────── */}
      {analytics && !loading && (
        <>
          {/* Row 1: Attack Map + Top Origins */}
          <div className="intel__grid intel__grid--map">
            {/* Attack Map */}
            <section className="intel__card intel__card--map">
              <div className="intel__card-header">
                <h3>{isVietnamese ? '🗺️ Ban do tan cong toan cau' : '🗺️ Global Attack Map'}</h3>
                <span className="intel__card-badge intel__card-badge--live">
                  <span className="intel__live-dot" /> {isVietnamese ? 'TRUC TIEP' : 'LIVE'} — {analytics.markers.length} {isVietnamese ? 'nguon' : 'origins'}
                </span>
              </div>
              <div className="intel__map-wrap">
                {/* Vignette + scanline overlays */}
                <div className="intel__map-vignette" />
                <div className="intel__map-scanlines" />

                <MapContainer
                  center={[20, 0]}
                  zoom={2}
                  minZoom={2}
                  maxZoom={6}
                  scrollWheelZoom={true}
                  className="intel__map"
                  ref={mapRef}
                  whenReady={() => setMapReady(true)}
                >
                  <TileLayer
                    attribution={mapTile.attribution}
                    url={mapTile.url}
                  />
                  {mapReady && analytics.markers.map(m => {
                    const mColor = m.count > 50 ? '#ef4444' : m.count > 20 ? '#f59e0b' : '#06b6d4'
                    return (
                      <React.Fragment key={m.cc}>
                        {/* Outer pulse ring */}
                        <CircleMarker
                          center={[m.lat, m.lon]}
                          radius={m.radius + 6}
                          pathOptions={{
                            fillColor: mColor,
                            fillOpacity: 0.12,
                            color: mColor,
                            weight: 1,
                            opacity: 0.3,
                            className: 'intel__marker-pulse',
                          }}
                        />
                        {/* Core marker */}
                        <CircleMarker
                          center={[m.lat, m.lon]}
                          radius={m.radius}
                          pathOptions={{
                            fillColor: mColor,
                            fillOpacity: 0.75,
                            color: '#ffffff',
                            weight: 1.5,
                          }}
                        >
                          <Tooltip direction="top" offset={[0, -10]} className="intel__map-tooltip">
                            <strong>{m.flag} {m.name}</strong><br />
                            {m.count.toLocaleString()} events
                          </Tooltip>
                        </CircleMarker>
                      </React.Fragment>
                    )
                  })}
                </MapContainer>

                {/* Map Legend */}
                <div className="intel__map-legend">
                  {MAP_LEGEND.map(l => (
                    <div key={l.label} className="intel__map-legend-item">
                      <span className="intel__map-legend-dot" style={{ background: l.color }} />
                      <span>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Top Origins Sidebar */}
            <section className="intel__card intel__card--origins">
              <div className="intel__card-header">
                <h3>{isVietnamese ? '🏴 Nguon tan cong hang dau' : '🏴 Top Attack Origins'}</h3>
              </div>
              <div className="intel__origins-list">
                {analytics.topCountries.map((c, i) => {
                  const pct = analytics.total > 0 ? ((c.count / analytics.total) * 100).toFixed(1) : 0
                  return (
                    <div key={c.cc} className="intel__origin">
                      <span className="intel__origin-rank">{i + 1}</span>
                      <span className="intel__origin-flag">{c.flag}</span>
                      <div className="intel__origin-info">
                        <span className="intel__origin-name">{c.name}</span>
                        <div className="intel__origin-bar-track">
                          <div
                            className="intel__origin-bar-fill"
                            style={{
                              width: `${pct}%`,
                              background: i === 0 ? '#ef4444' : i < 3 ? '#f59e0b' : '#06b6d4',
                            }}
                          />
                        </div>
                      </div>
                      <span className="intel__origin-count">{c.count.toLocaleString()}</span>
                      <span className="intel__origin-pct">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>

          {/* Row 2: Trend Chart */}
          <section className="intel__card">
            <div className="intel__card-header">
              <h3>{isVietnamese ? '📈 Xu huong de doa' : '📈 Threat Trend'} — {RANGE_OPTIONS.find(r => r.key === range)?.label}</h3>
              <span className="intel__card-badge">
                {analytics.trend.reduce((s, d) => s + d.total, 0).toLocaleString()} {isVietnamese ? 'su kien' : 'events'}
              </span>
            </div>
            <div className="intel__chart-wrap" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.trend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradAlerts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.2)" />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                  <RTooltip content={<ChartTooltip />} />
                  <Legend verticalAlign="top" height={30} iconType="circle" wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                  <Area type="monotone" dataKey="total" name="All Events" stroke="#06b6d4" fillOpacity={1} fill="url(#gradTotal)" strokeWidth={2} />
                  <Area type="monotone" dataKey="alerts" name="Alerts" stroke="#ef4444" fillOpacity={1} fill="url(#gradAlerts)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Row 3: Severity + Protocol + Event Types */}
          <div className="intel__grid intel__grid--three">
            {/* Severity Distribution */}
            <section className="intel__card">
              <div className="intel__card-header">
                <h3>🎚️ Severity Distribution</h3>
              </div>
              <div className="intel__chart-wrap" style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.severityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {analytics.severityData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <RTooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Protocol Mix */}
            <section className="intel__card">
              <div className="intel__card-header">
                <h3>📡 Protocol Mix</h3>
              </div>
              <div className="intel__chart-wrap" style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.protocols} layout="vertical" margin={{ left: 40, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.2)" />
                    <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} width={50} />
                    <RTooltip content={<ChartTooltip />} />
                    <Bar dataKey="value" name="Events" radius={[0, 6, 6, 0]}>
                      {analytics.protocols.map((_, i) => (
                        <Cell key={i} fill={PROTOCOL_COLORS[i % PROTOCOL_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Event Type Breakdown */}
            <section className="intel__card">
              <div className="intel__card-header">
                <h3>🧩 Event Types</h3>
              </div>
              <div className="intel__chart-wrap" style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.eventTypes}
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {analytics.eventTypes.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <RTooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          {/* Row 4: Top Attacker IPs */}
          <section className="intel__card">
            <div className="intel__card-header">
              <h3>🎯 Top Attacker IPs</h3>
              <div className="intel__card-header-right">
                {liveMetrics?.top_port && (
                  <span className="intel__card-badge">Top Port: {liveMetrics.top_port.port} ({liveMetrics.top_port.count})</span>
                )}
                <span className="intel__card-badge">{analytics.uniqueIPs} unique</span>
                <button className="intel__export-btn" onClick={handleExportAttackersCsv} title="Export top attacker IPs as CSV">
                  📥 Export CSV
                </button>
              </div>
            </div>
            <div className="intel__attackers-table-wrap">
              <table className="intel__attackers-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>IP Address</th>
                    <th>Origin</th>
                    <th>Events</th>
                    <th>% of Total</th>
                    <th>Threat Level</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topIPs.map((ip, i) => {
                    const pct = ((ip.count / analytics.total) * 100).toFixed(1)
                    const level = ip.count > 50 ? 'Critical' : ip.count > 20 ? 'High' : ip.count > 5 ? 'Medium' : 'Low'
                    const levelColor = ip.count > 50 ? '#ef4444' : ip.count > 20 ? '#f59e0b' : ip.count > 5 ? '#3b82f6' : '#10b981'
                    return (
                      <tr key={ip.ip} className="intel__attacker-row">
                        <td className="intel__attacker-rank">{i + 1}</td>
                        <td className="intel__attacker-ip">
                          <code>{ip.ip}</code>
                        </td>
                        <td className="intel__attacker-origin">
                          {ip.flag} {ip.cc}
                        </td>
                        <td className="intel__attacker-count">{ip.count.toLocaleString()}</td>
                        <td>
                          <div className="intel__attacker-bar-track">
                            <div className="intel__attacker-bar-fill" style={{ width: `${pct}%`, background: levelColor }} />
                          </div>
                          <span className="intel__attacker-pct">{pct}%</span>
                        </td>
                        <td>
                          <span className="intel__threat-badge" style={{ color: levelColor, borderColor: levelColor, background: `${levelColor}18` }}>
                            {level}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* ── Empty state ───────────────────────────────────── */}
      {!loading && !analytics && (
        <div className="intel__empty">
          <div className="intel__empty-icon">🛰️</div>
          <h3>No Intelligence Data</h3>
          <p>Deploy honeypots and wait for traffic to generate threat intelligence.</p>
          <p className="intel__empty-hint">Data appears automatically once events flow through your fleet.</p>
        </div>
      )}
    </div>
  )
}
