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

export default function TrafficView() {
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
    if (!API_URL) return;
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
    connected:  { color: '#10b981', label: 'Live Stream' },
    connecting: { color: '#f59e0b', label: 'Connecting...' },
    error:      { color: '#ef4444', label: 'Reconnecting...' },
    polling:    { color: '#06b6d4', label: 'Polling (15s)' },
  };
  const wsInfo = statusConfig[wsStatus] || statusConfig.connecting;

  return (
    <div className="traffic">
      <div className="traffic__shell">
        <section className="traffic__hero">
          <div className="traffic__hero-text">
            <p className="traffic__eyebrow">Network Telemetry</p>
            <h2>Traffic Ledger</h2>
            <p className="traffic__hero-sub">Real-time Suricata alert stream from your honeypot fleet &mdash; inspect packets, filter by protocol, and trigger response actions.</p>
          </div>
          <div className="traffic__hero-actions">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.6rem', borderRadius: '0.5rem', border: '1px solid ' + wsInfo.color + '33', background: wsInfo.color + '11', fontSize: '0.72rem', color: wsInfo.color, fontWeight: 600 }}>
              {wsInfo.label}
            </div>
            <button onClick={() => setLive((v) => !v)} className={'traffic__live-btn ' + (live ? 'traffic__live-btn--active' : 'traffic__live-btn--paused')}>
              {live ? 'Live' : 'Paused'}
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
            <input type="search" placeholder="Filter by IP, protocol, action, signature, country..." value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: '1 1 320px', background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(100, 116, 139, 0.5)', borderRadius: '0.5rem', color: '#e2e8f0', padding: '0.55rem 0.7rem' }} />
            {['TCP', 'UDP', 'HTTP', 'TLS', 'ICMP'].map((p) => {
              const active = activeProtocols.has(p);
              return (<button key={p} onClick={() => toggleProtocol(p)} style={{ border: active ? '1px solid rgba(34, 211, 238, 0.45)' : '1px solid rgba(100, 116, 139, 0.35)', background: active ? 'rgba(34, 211, 238, 0.12)' : 'rgba(15, 23, 42, 0.45)', color: active ? '#67e8f9' : '#cbd5e1', borderRadius: '0.45rem', padding: '0.42rem 0.55rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>{p}</button>);
            })}
          </div>

          <div ref={containerRef} style={{ maxHeight: 'calc(100dvh - 20rem)', overflowY: 'auto', overflowX: 'auto', borderRadius: '0.6rem' }}>
            {filteredEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>&#128225;</div>
                <div style={{ fontSize: '0.9rem' }}>{entries.length === 0 ? 'Waiting for live traffic - events will appear as your honeypots detect activity.' : 'No events match your current filter.'}</div>
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
