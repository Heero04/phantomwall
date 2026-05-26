import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './components/TrafficView.css';

const API_URL = import.meta.env.VITE_SURICATA_API_URL;
const WS_URL  = import.meta.env.VITE_WS_URL;

const relativeTime = (dateOrStr) => {
  const date = typeof dateOrStr === 'string' ? new Date(dateOrStr) : dateOrStr;
  if (isNaN(date.getTime())) return '\u2014';
  const diffMs = Date.now() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 5)  return 'just now';
  if (sec < 60) return sec + 's ago';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + 'm ago';
  const hrs = Math.floor(min / 60);
  return hrs + 'h ago';
};

const isPrivateIp = (ip) =>
  ip.startsWith('10.') || ip.startsWith('172.') || ip.startsWith('192.168.') || ip.startsWith('127.');

const normalizeRestEvent = (raw) => ({
  id:        raw.event_id || Date.now() + '-' + Math.random().toString(36).slice(2, 8),
  ip:        raw.src_ip || '0.0.0.0',
  dest_ip:   raw.dest_ip || '',
  port:      raw.dest_port || raw.src_port || 0,
  protocol:  (raw.proto || 'TCP').toUpperCase(),
  action:    raw.severity === 1 || raw.event_type === 'drop' ? 'BLOCKED' : 'ACCEPTED',
  timestamp: raw.event_time || '',
  severity:  raw.severity,
  category:  raw.category || '',
  signature: raw.signature || '',
  country:   raw.country_name || '',
  flag:      raw.flag || '',
  honeypot_name: raw.honeypot_name || raw.honeypot_id || '—',
  honeypot_os:   raw.honeypot_os || '',
  payload: [
    raw.signature    && ('Signature: ' + raw.signature),
    raw.category     && ('Category: ' + raw.category),
    raw.event_type   && ('Type: ' + raw.event_type),
    raw.country_name && ('Origin: ' + (raw.flag || '') + ' ' + raw.country_name),
    raw.summary      && ('\n' + raw.summary),
  ].filter(Boolean).join('\n') || 'No additional detail',
});

export default function TrafficView({ language = 'en' }) {
  const isVietnamese = language === 'vi';
  const [isMobile, setIsMobile]               = useState(() => window.innerWidth <= 900);
  const [entries, setEntries]                 = useState([]);
  const [live, setLive]                       = useState(true);
  const [query, setQuery]                     = useState('');
  const [expanded, setExpanded]               = useState({});
  const [copiedId, setCopiedId]               = useState(null);
  const [activeProtocols, setActiveProtocols] = useState(new Set());
  const [responseTarget, setResponseTarget]   = useState(null);
  const [responseStatus, setResponseStatus]   = useState(null);
  const [responseBusy, setResponseBusy]       = useState(false);
  const [actionLog, setActionLog]             = useState([]);
  const [wsStatus, setWsStatus]               = useState('connecting');
  const containerRef   = useRef(null);
  const wsRef          = useRef(null);
  const reconnectTimer = useRef(null);
  const pingTimer      = useRef(null);
  const liveRef        = useRef(live);
  useEffect(() => { liveRef.current = live; }, [live]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!API_URL) {
      const now = Date.now();
      const mockRaw = [
        { event_id: 'tv-001', src_ip: '203.0.113.42', dest_ip: '192.0.2.10', dest_port: 22, proto: 'TCP', severity: 1, event_time: new Date(now - 45000).toISOString(), signature: 'ET SCAN Potential SSH Scan OUTBOUND', category: 'Attempted Information Leak', country_name: 'China', flag: '🇨🇳', honeypot_name: 'honeypot-ssh-east', honeypot_os: 'linux' },
        { event_id: 'tv-002', src_ip: '198.51.100.17', dest_ip: '192.0.2.10', dest_port: 443, proto: 'TCP', severity: 3, event_time: new Date(now - 120000).toISOString(), signature: 'ET POLICY TLS Suspicious SNI', category: 'Potentially Bad Traffic', country_name: 'Russia', flag: '🇷🇺', honeypot_name: 'honeypot-http-east', honeypot_os: 'linux' },
        { event_id: 'tv-003', src_ip: '203.0.113.88', dest_ip: '192.0.2.11', dest_port: 3389, proto: 'TCP', severity: 1, event_time: new Date(now - 240000).toISOString(), signature: 'ET EXPLOIT MS RDP Brute Force Attempt', category: 'Web Application Attack', country_name: 'Brazil', flag: '🇧🇷', honeypot_name: 'honeypot-rdp-west', honeypot_os: 'windows' },
        { event_id: 'tv-004', src_ip: '192.0.2.201', dest_ip: '192.0.2.10', dest_port: 80, proto: 'TCP', severity: 2, event_time: new Date(now - 360000).toISOString(), signature: 'ET SCAN Nmap Scripting Engine User-Agent', category: 'Detection of a Network Scan', country_name: 'Vietnam', flag: '🇻🇳', honeypot_name: 'honeypot-http-east', honeypot_os: 'linux' },
        { event_id: 'tv-005', src_ip: '198.51.100.55', dest_ip: '192.0.2.12', dest_port: 23, proto: 'TCP', severity: 2, event_time: new Date(now - 600000).toISOString(), signature: 'ET SCAN Telnet BruteForce Login Attempt', category: 'Attempted Information Leak', country_name: 'India', flag: '🇮🇳', honeypot_name: 'honeypot-telnet-east', honeypot_os: 'linux' },
        { event_id: 'tv-006', src_ip: '203.0.113.119', dest_ip: '192.0.2.10', dest_port: 8080, proto: 'TCP', severity: 1, event_time: new Date(now - 900000).toISOString(), signature: 'ET EXPLOIT Apache Struts Remote Code Execution', category: 'Web Application Attack', country_name: 'China', flag: '🇨🇳', honeypot_name: 'honeypot-http-east', honeypot_os: 'linux' },
        { event_id: 'tv-007', src_ip: '192.0.2.44', dest_ip: '192.0.2.11', dest_port: 22, proto: 'TCP', severity: 2, event_time: new Date(now - 1200000).toISOString(), signature: 'ET POLICY SSH Connection Brute Force', category: 'Attempted Information Leak', country_name: 'Germany', flag: '🇩🇪', honeypot_name: 'honeypot-ssh-west', honeypot_os: 'linux' },
        { event_id: 'tv-008', src_ip: '203.0.113.200', dest_ip: '192.0.2.10', dest_port: 53, proto: 'UDP', severity: 3, event_time: new Date(now - 1500000).toISOString(), signature: 'ET POLICY DNS Query to .onion Proxy Domain', category: 'Potentially Bad Traffic', country_name: 'Russia', flag: '🇷🇺', honeypot_name: 'honeypot-dns-east', honeypot_os: 'linux' },
        { event_id: 'tv-009', src_ip: '198.51.100.78', dest_ip: '192.0.2.12', dest_port: 443, proto: 'TCP', severity: 3, event_time: new Date(now - 1800000).toISOString(), signature: 'ET POLICY Outbound TLS Connection to Known C2', category: 'A Network Trojan was Detected', country_name: 'Brazil', flag: '🇧🇷', honeypot_name: 'honeypot-http-west', honeypot_os: 'linux' },
        { event_id: 'tv-010', src_ip: '192.0.2.155', dest_ip: '192.0.2.10', dest_port: 80, proto: 'TCP', severity: 1, event_time: new Date(now - 2100000).toISOString(), signature: 'ET WEB_SERVER XSS Attempt via Cookie Header', category: 'Web Application Attack', country_name: 'China', flag: '🇨🇳', honeypot_name: 'honeypot-http-east', honeypot_os: 'linux' },
        { event_id: 'tv-011', src_ip: '203.0.113.33', dest_ip: '192.0.2.11', dest_port: 22, proto: 'TCP', severity: 2, event_time: new Date(now - 2400000).toISOString(), signature: 'ET SCAN LibSSH Based SSH Scan', category: 'Detection of a Network Scan', country_name: 'India', flag: '🇮🇳', honeypot_name: 'honeypot-ssh-east', honeypot_os: 'linux' },
        { event_id: 'tv-012', src_ip: '198.51.100.91', dest_ip: '192.0.2.10', dest_port: 8080, proto: 'TCP', severity: 2, event_time: new Date(now - 2700000).toISOString(), signature: 'ET POLICY Incoming Basic Auth Base64 HTTP', category: 'Attempted Information Leak', country_name: 'USA', flag: '🇺🇸', honeypot_name: 'honeypot-http-east', honeypot_os: 'linux' },
        { event_id: 'tv-013', src_ip: '203.0.113.67', dest_ip: '192.0.2.12', dest_port: 53, proto: 'UDP', severity: 3, event_time: new Date(now - 3300000).toISOString(), signature: 'ET POLICY DNS Query to Suspicious TLD (.xyz)', category: 'Potentially Bad Traffic', country_name: 'Vietnam', flag: '🇻🇳', honeypot_name: 'honeypot-dns-east', honeypot_os: 'linux' },
        { event_id: 'tv-014', src_ip: '192.0.2.88', dest_ip: '192.0.2.10', dest_port: 445, proto: 'TCP', severity: 1, event_time: new Date(now - 3900000).toISOString(), signature: 'ET EXPLOIT Possible EternalBlue MS17-010 Echo Response', category: 'Misc Attack', country_name: 'China', flag: '🇨🇳', honeypot_name: 'honeypot-smb-east', honeypot_os: 'windows' },
        { event_id: 'tv-015', src_ip: '198.51.100.222', dest_ip: '192.0.2.11', dest_port: 3306, proto: 'TCP', severity: 2, event_time: new Date(now - 4500000).toISOString(), signature: 'ET SCAN MySQL Login Brute Force Attempt', category: 'Attempted Information Leak', country_name: 'Germany', flag: '🇩🇪', honeypot_name: 'honeypot-db-west', honeypot_os: 'linux' },
        { event_id: 'tv-016', src_ip: '203.0.113.150', dest_ip: '192.0.2.10', dest_port: 80, proto: 'TCP', severity: 2, event_time: new Date(now - 5100000).toISOString(), signature: 'ET WEB_SERVER PHP Remote File Inclusion', category: 'Web Application Attack', country_name: 'Russia', flag: '🇷🇺', honeypot_name: 'honeypot-http-east', honeypot_os: 'linux' },
        { event_id: 'tv-017', src_ip: '192.0.2.30', dest_ip: '192.0.2.12', dest_port: 22, proto: 'TCP', severity: 3, event_time: new Date(now - 5700000).toISOString(), signature: 'ET POLICY SSH Banner Grab Attempt', category: 'Not Suspicious Traffic', country_name: 'USA', flag: '🇺🇸', honeypot_name: 'honeypot-ssh-west', honeypot_os: 'linux' },
        { event_id: 'tv-018', src_ip: '203.0.113.77', dest_ip: '192.0.2.10', dest_port: 80, proto: 'TCP', severity: 1, event_time: new Date(now - 6300000).toISOString(), signature: 'ET EXPLOIT Possible SQL Injection Attempt SELECT FROM', category: 'Web Application Attack', country_name: 'Brazil', flag: '🇧🇷', honeypot_name: 'honeypot-http-east', honeypot_os: 'linux' },
        { event_id: 'tv-019', src_ip: '198.51.100.133', dest_ip: '192.0.2.11', dest_port: 443, proto: 'TCP', severity: 3, event_time: new Date(now - 6600000).toISOString(), signature: 'ET POLICY Observed Let\'s Encrypt Certificate for Suspicious TLD', category: 'Potentially Bad Traffic', country_name: 'India', flag: '🇮🇳', honeypot_name: 'honeypot-http-west', honeypot_os: 'linux' },
        { event_id: 'tv-020', src_ip: '192.0.2.99', dest_ip: '192.0.2.10', dest_port: 0, proto: 'ICMP', severity: 3, event_time: new Date(now - 7200000).toISOString(), signature: 'ET SCAN ICMP Flood Outbound', category: 'Detection of a Denial of Service Attack', country_name: 'Vietnam', flag: '🇻🇳', honeypot_name: 'honeypot-ssh-east', honeypot_os: 'linux' },
      ];
      setEntries(mockRaw.map(normalizeRestEvent));
      setWsStatus('demo');
      return;
    }
    (async () => {
      try {
        const res = await fetch(API_URL + '/events');
        if (!res.ok) return;
        const data = await res.json();
        const items = (data.items || []).map(normalizeRestEvent);
        items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setEntries(items.slice(0, 200));
      } catch (err) { console.error('Initial events fetch failed:', err); }
    })();
  }, []);

  const connectWebSocket = useCallback(() => {
    if (!WS_URL) { setWsStatus('polling'); return; }
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    setWsStatus('connecting');
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => {
      setWsStatus('connected');
      if (pingTimer.current) clearInterval(pingTimer.current);
      pingTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ action: 'ping' }));
      }, 5 * 60 * 1000);
    };
    ws.onmessage = (event) => {
      if (!liveRef.current) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'traffic' && Array.isArray(msg.entries)) {
          setEntries((prev) => [...msg.entries, ...prev].slice(0, 200));
        }
      } catch (err) { console.error('[WS] parse error:', err); }
    };
    ws.onerror = () => setWsStatus('error');
    ws.onclose = () => {
      setWsStatus('error');
      wsRef.current = null;
      if (pingTimer.current) { clearInterval(pingTimer.current); pingTimer.current = null; }
      reconnectTimer.current = setTimeout(connectWebSocket, 5000);
    };
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (pingTimer.current) clearInterval(pingTimer.current);
    };
  }, [connectWebSocket]);

  useEffect(() => {
    if (WS_URL || !API_URL || !live) return;
    const poll = setInterval(async () => {
      try {
        const res = await fetch(API_URL + '/events');
        if (!res.ok) return;
        const data = await res.json();
        const items = (data.items || []).map(normalizeRestEvent);
        items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setEntries(items.slice(0, 200));
      } catch (err) { console.error('Poll failed:', err); }
    }, 15000);
    return () => clearInterval(poll);
  }, [live]);

  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceUpdate((n) => n + 1), 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (containerRef.current && live) containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
  }, [entries, live]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      const protoMatch = activeProtocols.size === 0 || activeProtocols.has(e.protocol);
      const qMatch = !q || e.ip.toLowerCase().includes(q) || (e.dest_ip || '').toLowerCase().includes(q) || e.protocol.toLowerCase().includes(q) || e.action.toLowerCase().includes(q) || (e.signature || '').toLowerCase().includes(q) || (e.category || '').toLowerCase().includes(q) || (e.country || '').toLowerCase().includes(q);
      return protoMatch && qMatch;
    });
  }, [entries, query, activeProtocols]);

  const stats = useMemo(() => {
    const unique  = new Set(filteredEntries.map((e) => e.ip)).size;
    const blocked = filteredEntries.filter((e) => e.action === 'BLOCKED').length;
    return { total: filteredEntries.length, unique, blocked };
  }, [filteredEntries]);

  const toggleProtocol = (protocol) => {
    setActiveProtocols((prev) => { const next = new Set(prev); if (next.has(protocol)) next.delete(protocol); else next.add(protocol); return next; });
  };
  const toggleExpand = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  const handleCopy = async (id, text) => {
    try { await navigator.clipboard.writeText(text); } catch { /* noop */ }
    setCopiedId(id);
    setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
  };
  const openResponseModal  = (entry) => { setResponseStatus(null); setResponseTarget(entry); };
  const closeResponseModal = ()      => { setResponseTarget(null); setResponseStatus(null); };

  const postJson = async (path, payload) => {
    if (!API_URL) throw new Error('VITE_SURICATA_API_URL is not configured.');
    const res = await fetch(API_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    let data = null;
    try { data = await res.json(); } catch { /* noop */ }
    if (!res.ok) {
      const errMsg = data?.error || data?.message || ('Request failed (' + res.status + ')');
      throw new Error(errMsg);
    }
    return data || {};
  };

  const pushActionLog = (status) => {
    setActionLog((prev) => [{ id: String(Date.now()) + Math.random().toString(36).slice(2, 7), status, at: new Date() }, ...prev].slice(0, 8));
  };

  const handleBlockIp = async (ip) => {
    try {
      const data = await postJson('/waf/block-ip', { ip });
      const status = 'Blocked ' + ip + ' via WAF - ' + (data.message || 'done');
      setResponseStatus(status);
      pushActionLog(status);
    } catch (err) { setResponseStatus('Failed to block ' + ip + ': ' + err.message); }
  };

  const handleThrottleSource = async (target) => {
    const ip = target.ip;
    const enableRateLimit = await postJson('/waf/toggle-rule', { rule_name: 'rate_limiting', enabled: true });
    const blockIpResult = await postJson('/waf/block-ip', { ip });
    return 'Throttle active for ' + ip + ' - ' + (enableRateLimit.message || 'rate limiting enabled') + '; ' + (blockIpResult.message || 'IP added to blocklist');
  };

  const createLocalIncident = (target) => {
    const incident = {
      incident_id: 'INC-' + Date.now().toString(36).toUpperCase(),
      created_at: new Date().toISOString(),
      status: 'open',
      source: 'traffic-ledger',
      summary: 'Security event escalated from Traffic Ledger',
      event: {
        src_ip: target.ip,
        dest_ip: target.dest_ip,
        port: target.port,
        protocol: target.protocol,
        action: target.action,
        signature: target.signature || '',
        category: target.category || '',
        country: target.country || '',
        honeypot_name: target.honeypot_name || '',
      },
    };
    const existing = JSON.parse(localStorage.getItem('traffic_incidents') || '[]');
    existing.unshift(incident);
    localStorage.setItem('traffic_incidents', JSON.stringify(existing.slice(0, 100)));
    return incident.incident_id;
  };

  const runResponseAction = async (label) => {
    if (!responseTarget) return;
    setResponseBusy(true);
    setResponseStatus(null);
    try {
      if (label === 'Block Source IP') {
        await handleBlockIp(responseTarget.ip);
        return;
      }
      if (label === 'Throttle Source') {
        const status = await handleThrottleSource(responseTarget);
        setResponseStatus(status);
        pushActionLog(status);
        return;
      }
      if (label === 'Create Incident Ticket') {
        const incidentId = createLocalIncident(responseTarget);
        const status = 'Incident ' + incidentId + ' created and stored locally for ' + responseTarget.ip;
        setResponseStatus(status);
        pushActionLog(status);
        return;
      }
      const status = 'Unknown response action: ' + label;
      setResponseStatus(status);
      pushActionLog(status);
    } catch (err) {
      const status = 'Failed: ' + label + ' for ' + responseTarget.ip + ' - ' + err.message;
      setResponseStatus(status);
      pushActionLog(status);
    } finally {
      setResponseBusy(false);
    }
  };

  const statusConfig = {
    connected:  { color: '#10b981', label: isVietnamese ? 'Luong truc tiep' : 'Live Stream' },
    connecting: { color: '#f59e0b', label: isVietnamese ? 'Dang ket noi...' : 'Connecting...' },
    error:      { color: '#ef4444', label: isVietnamese ? 'Dang ket noi lai...' : 'Reconnecting...' },
    polling:    { color: '#06b6d4', label: isVietnamese ? 'Polling (15s)' : 'Polling (15s)' },
    demo:       { color: '#8b5cf6', label: isVietnamese ? 'Che do Demo' : 'Demo Mode' },
  };
  const wsInfo = statusConfig[wsStatus] || statusConfig.connecting;

  return (
    <div className="traffic">
      <div className="traffic__shell">
        <section className="traffic__hero">
          <div className="traffic__hero-text">
            <p className="traffic__eyebrow">{isVietnamese ? 'Giam sat mang' : 'Network Telemetry'}</p>
            <h2>{isVietnamese ? 'Nhat ky luu luong' : 'Traffic Ledger'}</h2>
            <p className="traffic__hero-sub">
              {isVietnamese
                ? 'Luong canh bao Suricata theo thoi gian thuc tu fleet honeypot — kiem tra goi tin, loc theo giao thuc va kich hoat phan ung.'
                : 'Real-time Suricata alert stream from your honeypot fleet &mdash; inspect packets, filter by protocol, and trigger response actions.'}
            </p>
          </div>
          <div className="traffic__hero-actions">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.6rem', borderRadius: '0.5rem', border: '1px solid ' + wsInfo.color + '33', background: wsInfo.color + '11', fontSize: '0.72rem', color: wsInfo.color, fontWeight: 600 }}>
              {wsInfo.label}
            </div>
            <button onClick={() => setLive((v) => !v)} className={'traffic__live-btn ' + (live ? 'traffic__live-btn--active' : 'traffic__live-btn--paused')}>
              {live ? (isVietnamese ? 'Truc tiep' : 'Live') : (isVietnamese ? 'Tam dung' : 'Paused')}
            </button>
          </div>
        </section>

        <div className="traffic__stat-grid">
          {[{ label: 'Total Events', value: stats.total }, { label: 'Unique IPs', value: stats.unique }, { label: 'Blocked', value: stats.blocked }].map((s) => (
            <div key={s.label} className="traffic__stat-card">
              <div style={{ background: 'rgba(2, 6, 23, 0.6)', border: '1px solid rgba(100, 116, 139, 0.28)', borderRadius: '0.65rem', padding: '0.6rem 0.75rem', boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.45)' }}>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                <div style={{ marginTop: '0.45rem', color: '#fff', fontWeight: 700, fontSize: '1.8rem', lineHeight: 1 }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="traffic__panel">
          <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
            <input type="search" placeholder={isVietnamese ? 'Loc theo IP, giao thuc, hanh dong, chu ky, quoc gia...' : 'Filter by IP, protocol, action, signature, country...'} value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: '1 1 320px', background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(100, 116, 139, 0.5)', borderRadius: '0.5rem', color: '#e2e8f0', padding: '0.55rem 0.7rem' }} />
            {['TCP', 'UDP', 'HTTP', 'TLS', 'ICMP'].map((p) => {
              const active = activeProtocols.has(p);
              return (<button key={p} onClick={() => toggleProtocol(p)} style={{ border: active ? '1px solid rgba(34, 211, 238, 0.45)' : '1px solid rgba(100, 116, 139, 0.35)', background: active ? 'rgba(34, 211, 238, 0.12)' : 'rgba(15, 23, 42, 0.45)', color: active ? '#67e8f9' : '#cbd5e1', borderRadius: '0.45rem', padding: '0.42rem 0.55rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>{p}</button>);
            })}
          </div>

          <div ref={containerRef} style={{ maxHeight: 'calc(100dvh - 20rem)', overflowY: 'auto', overflowX: 'auto', borderRadius: '0.6rem' }}>
            {filteredEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>&#128225;</div>
                <div style={{ fontSize: '0.9rem' }}>{entries.length === 0 ? (isVietnamese ? 'Dang cho luu luong truc tiep - su kien se hien thi khi honeypot phat hien hoat dong.' : 'Waiting for live traffic - events will appear as your honeypots detect activity.') : (isVietnamese ? 'Khong co su kien nao khop voi bo loc hien tai.' : 'No events match your current filter.')}</div>
              </div>
            ) : (
              isMobile ? (
                <div className="traffic__mobile-list">
                  {filteredEntries.map((e) => {
                    const isExp = !!expanded[e.id];
                    return (
                      <article key={e.id} className="traffic__mobile-item">
                        <div className="traffic__mobile-row">
                          <span className="traffic__mobile-ip">{e.ip}</span>
                          <span className="traffic__mobile-time">{relativeTime(e.timestamp)}</span>
                        </div>
                        <div className="traffic__mobile-row">
                          <span className="traffic__mobile-pill">{e.protocol}</span>
                          <span className={e.action === 'BLOCKED' ? 'traffic__mobile-pill traffic__mobile-pill--blocked' : 'traffic__mobile-pill traffic__mobile-pill--accepted'}>
                            {e.action}
                          </span>
                        </div>
                        <div className="traffic__mobile-meta">
                          {isVietnamese ? 'Dich' : 'Target'}: {e.dest_ip || '—'}:{e.port || '—'} · {isVietnamese ? 'Bay' : 'Honeypot'}: {e.honeypot_name}
                        </div>
                        <div className="traffic__mobile-actions">
                          <button onClick={() => handleCopy(e.id, e.ip)}>
                            {copiedId === e.id ? (isVietnamese ? 'Da sao chep' : 'Copied') : (isVietnamese ? 'Sao chep IP' : 'Copy IP')}
                          </button>
                          <button onClick={() => openResponseModal(e)}>
                            {isVietnamese ? 'Phan ung' : 'Respond'}
                          </button>
                          <button onClick={() => toggleExpand(e.id)}>
                            {isExp ? (isVietnamese ? 'An chi tiet' : 'Hide') : (isVietnamese ? 'Xem chi tiet' : 'Inspect')}
                          </button>
                        </div>
                        {isExp && (
                          <pre className="traffic__mobile-payload">{e.payload}</pre>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 0.55rem', minWidth: '860px' }}>
                <thead>
                  <tr style={{ color: '#94a3b8', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {['Source IP', 'Port', 'Protocol', 'Action', 'Honeypot', 'Origin', 'Timestamp', 'Actions'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '0 0.75rem', position: 'sticky', top: 0, zIndex: 5, background: 'rgba(15, 23, 42, 0.97)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((e) => {
                    const isExp = !!expanded[e.id];
                    const cell = { background: 'rgba(15, 23, 42, 0.58)', borderTop: '1px solid rgba(100, 116, 139, 0.3)', borderBottom: '1px solid rgba(100, 116, 139, 0.3)', padding: '0.75rem' };
                    return (
                      <React.Fragment key={e.id}>
                        <tr>
                          <td style={{ ...cell, borderLeft: '1px solid rgba(100,116,139,0.3)', borderRadius: '10px 0 0 10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span style={{ color: '#a5f3fc', fontFamily: '"JetBrains Mono","Consolas",monospace', fontSize: '0.8rem', background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.25)', borderRadius: '0.35rem', padding: '0.2rem 0.45rem' }}>{e.ip}</span>
                              <button onClick={() => handleCopy(e.id, e.ip)} style={{ border: '1px solid rgba(100,116,139,0.4)', background: 'rgba(15,23,42,0.55)', color: '#cbd5e1', borderRadius: '0.35rem', padding: '0.2rem 0.4rem', cursor: 'pointer', fontSize: '0.72rem' }}>Copy</button>
                              {copiedId === e.id && <span style={{ color: '#67e8f9', fontSize: '0.72rem' }}>Copied</span>}
                            </div>
                          </td>
                          <td style={cell}><span style={{ color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{e.port}</span></td>
                          <td style={cell}><span style={{ color: '#cbd5e1' }}>{e.protocol}</span></td>
                          <td style={cell}><span style={{ color: e.action === 'BLOCKED' ? '#fca5a5' : '#86efac', border: e.action === 'BLOCKED' ? '1px solid rgba(248,113,113,0.4)' : '1px solid rgba(74,222,128,0.4)', background: e.action === 'BLOCKED' ? 'rgba(248,113,113,0.14)' : 'rgba(74,222,128,0.14)', borderRadius: '999px', padding: '0.2rem 0.45rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em' }}>{e.action}</span></td>
                          <td style={cell}><span style={{ color: '#c4b5fd', fontSize: '0.8rem', fontWeight: 600 }}>{e.honeypot_name}</span>{e.honeypot_os && e.honeypot_os !== '—' && <span style={{ color: '#94a3b8', fontSize: '0.65rem', marginLeft: '0.3rem', textTransform: 'uppercase' }}>{e.honeypot_os}</span>}</td>
                          <td style={cell}><span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>{e.flag && <span style={{ marginRight: '0.3rem' }}>{e.flag}</span>}{e.country || '\u2014'}</span></td>
                          <td style={cell}><span style={{ color: '#cbd5e1', fontFamily: '"JetBrains Mono","Consolas",monospace', fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>{relativeTime(e.timestamp)}</span></td>
                          <td style={{ ...cell, borderRight: '1px solid rgba(100,116,139,0.3)', borderRadius: '0 10px 10px 0', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                              <button onClick={() => openResponseModal(e)} style={{ border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.12)', color: '#fcd34d', borderRadius: '0.4rem', padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>Respond</button>
                              <button onClick={() => toggleExpand(e.id)} style={{ border: '1px solid rgba(100,116,139,0.35)', background: 'rgba(15,23,42,0.55)', color: '#cbd5e1', borderRadius: '0.4rem', padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem' }}>{isExp ? 'Hide' : 'Inspect'}</button>
                            </div>
                          </td>
                        </tr>
                        {isExp && (
                          <tr><td colSpan={8} style={{ padding: '0.25rem 0.75rem 0.6rem' }}><div style={{ background: '#071019', border: '1px solid rgba(148,163,184,0.3)', borderRadius: '0.5rem', padding: '0.65rem', color: '#e2e8f0', fontFamily: '"JetBrains Mono","Consolas",monospace', fontSize: '0.74rem', whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: '160px' }}>{e.payload}</div></td></tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
              )
            )}
          </div>
        </div>

        <div className="traffic__actions-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.55rem' }}>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '0.95rem' }}>Recent Response Actions</h3>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Block Source IP calls WAF API live</span>
          </div>
          {actionLog.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>No actions taken yet.</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.35rem' }}>
              {actionLog.map((log) => (
                <div key={log.id} style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>
                  {log.status}
                  <span style={{ color: '#94a3b8', marginLeft: '0.4rem', fontFamily: '"JetBrains Mono","Consolas",monospace' }}>{relativeTime(log.at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {responseTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.7)', backdropFilter: 'blur(4px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ width: 'min(520px, 100%)', background: 'rgba(15,23,42,0.98)', border: '1px solid rgba(100,116,139,0.35)', borderRadius: '0.9rem', padding: '1rem' }}>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '1.05rem' }}>Traffic Response Actions</h3>
            <p style={{ margin: '0.55rem 0', color: '#94a3b8', fontSize: '0.86rem' }}>
              Source IP: <span style={{ color: '#a5f3fc', fontFamily: '"JetBrains Mono","Consolas",monospace' }}>{responseTarget.ip}</span>
              {responseTarget.flag && <span style={{ marginLeft: '0.4rem' }}>{responseTarget.flag} {responseTarget.country}</span>}
            </p>
            <p style={{ margin: '0 0 0.8rem', color: '#94a3b8', fontSize: '0.82rem' }}>
              Protocol: {responseTarget.protocol} | Port: {responseTarget.port} | Action: {responseTarget.action}
              {responseTarget.signature && <><br />Signature: {responseTarget.signature}</>}
            </p>
            {isPrivateIp(responseTarget.ip) && (
              <p style={{ margin: '0 0 0.8rem', color: '#fcd34d', fontSize: '0.8rem' }}>Private source range detected. WAF block may not be effective for internal IPs.</p>
            )}
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <button disabled={responseBusy} onClick={() => runResponseAction('Block Source IP')} style={{ border: '1px solid rgba(248,113,113,0.4)', background: 'rgba(248,113,113,0.12)', color: '#fca5a5', borderRadius: '0.5rem', padding: '0.55rem 0.7rem', textAlign: 'left', cursor: responseBusy ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: responseBusy ? 0.75 : 1 }}>Block Source IP (WAF Blocklist)</button>
              <button disabled={responseBusy} onClick={() => runResponseAction('Throttle Source')} style={{ border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.12)', color: '#fcd34d', borderRadius: '0.5rem', padding: '0.55rem 0.7rem', textAlign: 'left', cursor: responseBusy ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: responseBusy ? 0.75 : 1 }}>Throttle Source</button>
              <button disabled={responseBusy} onClick={() => runResponseAction('Create Incident Ticket')} style={{ border: '1px solid rgba(34,211,238,0.4)', background: 'rgba(34,211,238,0.12)', color: '#67e8f9', borderRadius: '0.5rem', padding: '0.55rem 0.7rem', textAlign: 'left', cursor: responseBusy ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: responseBusy ? 0.75 : 1 }}>Create Incident Ticket</button>
            </div>
            {responseStatus && <div style={{ marginTop: '0.7rem', color: '#86efac', fontSize: '0.82rem' }}>{responseStatus}</div>}
            <div style={{ marginTop: '0.9rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={closeResponseModal} style={{ border: '1px solid rgba(100,116,139,0.4)', background: 'rgba(15,23,42,0.55)', color: '#cbd5e1', borderRadius: '0.45rem', padding: '0.45rem 0.7rem', cursor: 'pointer', fontWeight: 700 }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
