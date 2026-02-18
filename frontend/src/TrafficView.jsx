import React, { useEffect, useMemo, useRef, useState } from 'react';

const randomIp = () =>
  `${Math.floor(Math.random() * 223) + 1}.${Math.floor(Math.random() * 255)}.${Math.floor(
    Math.random() * 255
  )}.${Math.floor(Math.random() * 255)}`;

const randomProtocol = () => {
  const items = ['TCP', 'UDP', 'ICMP', 'HTTP', 'TLS'];
  return items[Math.floor(Math.random() * items.length)];
};

const randomAction = () => (Math.random() > 0.6 ? 'BLOCKED' : 'ACCEPTED');

const samplePayload = (proto) =>
  proto === 'HTTP'
    ? 'GET /index.html HTTP/1.1\nHost: example.com\nUser-Agent: PhantomCapture/1.0\n'
    : `RAW_PKT { id: ${Math.floor(Math.random() * 99999)}, data: "0x${Math.floor(
        Math.random() * 1e16
      ).toString(16)}" }`;

const makeEntry = (idSuffix = '') => {
  const proto = randomProtocol();
  return {
    id: `${Date.now()}-${Math.floor(Math.random() * 10000)}${idSuffix}`,
    ip: randomIp(),
    port: Math.floor(Math.random() * 65535) + 1,
    protocol: proto,
    action: randomAction(),
    timestamp: new Date(),
    payload: samplePayload(proto),
  };
};

const relativeTime = (date) => {
  const diffMs = Date.now() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  return `${hrs}h ago`;
};

export default function TrafficView() {
  const [entries, setEntries] = useState(() => Array.from({ length: 8 }).map(() => makeEntry('-init')));
  const [live, setLive] = useState(true);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [activeProtocols, setActiveProtocols] = useState(new Set());
  const [responseTarget, setResponseTarget] = useState(null);
  const [responseStatus, setResponseStatus] = useState(null);
  const [actionLog, setActionLog] = useState([]);
  const streamRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!live) {
      if (streamRef.current) {
        clearInterval(streamRef.current);
        streamRef.current = null;
      }
      return;
    }

    streamRef.current = window.setInterval(() => {
      setEntries((prev) => [makeEntry(), ...prev].slice(0, 200));
    }, 1500);

    return () => {
      if (streamRef.current) {
        clearInterval(streamRef.current);
        streamRef.current = null;
      }
    };
  }, [live]);

  useEffect(() => {
    const t = window.setInterval(() => {
      setEntries((prev) => (prev.length > 150 ? prev.slice(0, 120) : prev));
    }, 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      const protoMatch = activeProtocols.size === 0 || activeProtocols.has(e.protocol);
      const qMatch =
        !q ||
        e.ip.toLowerCase().includes(q) ||
        e.protocol.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q);
      return protoMatch && qMatch;
    });
  }, [entries, query, activeProtocols]);

  const stats = useMemo(() => {
    const pps = Math.max(1, Math.round(filteredEntries.length / 3));
    const unique = new Set(filteredEntries.map((e) => e.ip)).size;
    const blocked = filteredEntries.filter((e) => e.action === 'BLOCKED').length;
    return { pps, unique, blocked };
  }, [filteredEntries]);

  const toggleProtocol = (protocol) => {
    setActiveProtocols((prev) => {
      const next = new Set(prev);
      if (next.has(protocol)) next.delete(protocol);
      else next.add(protocol);
      return next;
    });
  };

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = async (id, text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Ignore copy failures in preview mode.
    }
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
  };

  const isPrivateIp = (ip) =>
    ip.startsWith('10.') || ip.startsWith('172.') || ip.startsWith('192.168.');

  const openResponseModal = (entry) => {
    setResponseStatus(null);
    setResponseTarget(entry);
  };

  const closeResponseModal = () => {
    setResponseTarget(null);
    setResponseStatus(null);
  };

  const runMockResponse = (label) => {
    if (!responseTarget) return;
    const status = `Queued: ${label} for ${responseTarget.ip}`;
    setResponseStatus(status);
    setActionLog((prev) => [{ id: `${Date.now()}`, status, at: new Date() }, ...prev].slice(0, 8));
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        padding: '2rem 2.5rem',
        color: '#e2e8f0',
      }}
    >
      <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'grid', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ margin: 0, color: '#fff' }}>Traffic Ledger - Forensics Preview</h2>
            <p style={{ margin: '0.35rem 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>Live network telemetry stream simulation</p>
          </div>
          <button
            onClick={() => setLive((v) => !v)}
            style={{
              border: '1px solid rgba(100, 116, 139, 0.4)',
              background: live ? 'rgba(6, 182, 212, 0.15)' : 'rgba(15, 23, 42, 0.45)',
              color: live ? '#67e8f9' : '#cbd5e1',
              borderRadius: '0.5rem',
              padding: '0.5rem 0.75rem',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            {live ? 'Live' : 'Paused'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem' }}>
          {[
            { label: 'Packets/s', value: stats.pps },
            { label: 'Unique IPs', value: stats.unique },
            { label: 'Blocked', value: stats.blocked },
          ].map((s) => (
            <div key={s.label} style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(100, 116, 139, 0.3)', borderRadius: '0.8rem', padding: '0.75rem' }}>
              <div style={{ background: 'rgba(2, 6, 23, 0.6)', border: '1px solid rgba(100, 116, 139, 0.28)', borderRadius: '0.65rem', padding: '0.6rem 0.75rem', boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.45)' }}>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                <div style={{ marginTop: '0.45rem', color: '#fff', fontWeight: 700, fontSize: '1.8rem', lineHeight: 1 }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(100, 116, 139, 0.3)', borderRadius: '0.8rem', padding: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
            <input
              type="search"
              placeholder="Filter by IP, protocol, action"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                flex: '1 1 320px',
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(100, 116, 139, 0.5)',
                borderRadius: '0.5rem',
                color: '#e2e8f0',
                padding: '0.55rem 0.7rem',
              }}
            />
            {['TCP', 'UDP', 'HTTP', 'TLS', 'ICMP'].map((p) => {
              const active = activeProtocols.has(p);
              return (
                <button
                  key={p}
                  onClick={() => toggleProtocol(p)}
                  style={{
                    border: active ? '1px solid rgba(34, 211, 238, 0.45)' : '1px solid rgba(100, 116, 139, 0.35)',
                    background: active ? 'rgba(34, 211, 238, 0.12)' : 'rgba(15, 23, 42, 0.45)',
                    color: active ? '#67e8f9' : '#cbd5e1',
                    borderRadius: '0.45rem',
                    padding: '0.42rem 0.55rem',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>

          <div
            ref={containerRef}
            style={{
              maxHeight: 'calc(100dvh - 20rem)',
              overflowY: 'auto',
              overflowX: 'auto',
              borderRadius: '0.6rem',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 0.55rem', minWidth: '860px' }}>
              <thead>
                <tr style={{ color: '#94a3b8', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {['IP', 'Port', 'Protocol', 'Action', 'Timestamp', 'Actions'].map((h) => (
                    <th key={h} style={{ textAlign: h === 'Inspect' ? 'right' : 'left', padding: '0 0.75rem', position: 'sticky', top: 0, zIndex: 5, background: 'rgba(15, 23, 42, 0.97)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((e) => {
                  const isExpanded = !!expanded[e.id];
                  const cellStyle = {
                    background: 'rgba(15, 23, 42, 0.58)',
                    borderTop: '1px solid rgba(100, 116, 139, 0.3)',
                    borderBottom: '1px solid rgba(100, 116, 139, 0.3)',
                    padding: '0.75rem',
                  };
                  return (
                    <React.Fragment key={e.id}>
                      <tr>
                        <td style={{ ...cellStyle, borderLeft: '1px solid rgba(100, 116, 139, 0.3)', borderRadius: '10px 0 0 10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ color: '#a5f3fc', fontFamily: '"JetBrains Mono", "Consolas", monospace', fontSize: '0.8rem', background: 'rgba(34, 211, 238, 0.1)', border: '1px solid rgba(34, 211, 238, 0.25)', borderRadius: '0.35rem', padding: '0.2rem 0.45rem' }}>{e.ip}</span>
                            <button onClick={() => handleCopy(e.id, e.ip)} style={{ border: '1px solid rgba(100, 116, 139, 0.4)', background: 'rgba(15, 23, 42, 0.55)', color: '#cbd5e1', borderRadius: '0.35rem', padding: '0.2rem 0.4rem', cursor: 'pointer', fontSize: '0.72rem' }}>Copy</button>
                            {copiedId === e.id && <span style={{ color: '#67e8f9', fontSize: '0.72rem' }}>Copied</span>}
                          </div>
                        </td>
                        <td style={cellStyle}><span style={{ color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{e.port}</span></td>
                        <td style={cellStyle}><span style={{ color: '#cbd5e1' }}>{e.protocol}</span></td>
                        <td style={cellStyle}>
                          <span style={{ color: e.action === 'BLOCKED' ? '#fca5a5' : '#86efac', border: e.action === 'BLOCKED' ? '1px solid rgba(248, 113, 113, 0.4)' : '1px solid rgba(74, 222, 128, 0.4)', background: e.action === 'BLOCKED' ? 'rgba(248, 113, 113, 0.14)' : 'rgba(74, 222, 128, 0.14)', borderRadius: '999px', padding: '0.2rem 0.45rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em' }}>
                            {e.action}
                          </span>
                        </td>
                        <td style={cellStyle}>
                          <span style={{ color: '#cbd5e1', fontFamily: '"JetBrains Mono", "Consolas", monospace', fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>
                            {relativeTime(e.timestamp)}
                          </span>
                        </td>
                        <td style={{ ...cellStyle, borderRight: '1px solid rgba(100, 116, 139, 0.3)', borderRadius: '0 10px 10px 0', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                            <button onClick={() => openResponseModal(e)} style={{ border: '1px solid rgba(245, 158, 11, 0.35)', background: 'rgba(245, 158, 11, 0.12)', color: '#fcd34d', borderRadius: '0.4rem', padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>
                              Respond
                            </button>
                            <button onClick={() => toggleExpand(e.id)} style={{ border: '1px solid rgba(100, 116, 139, 0.35)', background: 'rgba(15, 23, 42, 0.55)', color: '#cbd5e1', borderRadius: '0.4rem', padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem' }}>
                              {isExpanded ? 'Hide' : 'Inspect'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} style={{ padding: '0.25rem 0.75rem 0.6rem' }}>
                            <div style={{ background: '#071019', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: '0.5rem', padding: '0.65rem', color: '#e2e8f0', fontFamily: '"JetBrains Mono", "Consolas", monospace', fontSize: '0.74rem', whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: '160px' }}>
                              {e.payload}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ background: 'rgba(30, 41, 59, 0.45)', border: '1px solid rgba(100, 116, 139, 0.3)', borderRadius: '0.8rem', padding: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.55rem' }}>
            <h3 style={{ margin: 0, color: '#fff', fontSize: '0.95rem' }}>Recent Response Actions</h3>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Mock workflow</span>
          </div>
          {actionLog.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>No actions taken yet.</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.35rem' }}>
              {actionLog.map((log) => (
                <div key={log.id} style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>
                  {log.status}
                  <span style={{ color: '#94a3b8', marginLeft: '0.4rem', fontFamily: '"JetBrains Mono", "Consolas", monospace' }}>
                    {relativeTime(log.at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {responseTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 1200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            style={{
              width: 'min(520px, 100%)',
              background: 'rgba(15, 23, 42, 0.98)',
              border: '1px solid rgba(100, 116, 139, 0.35)',
              borderRadius: '0.9rem',
              padding: '1rem'
            }}
          >
            <h3 style={{ margin: 0, color: '#fff', fontSize: '1.05rem' }}>Traffic Response Actions</h3>
            <p style={{ margin: '0.55rem 0', color: '#94a3b8', fontSize: '0.86rem' }}>
              Source IP: <span style={{ color: '#a5f3fc', fontFamily: '"JetBrains Mono", "Consolas", monospace' }}>{responseTarget.ip}</span>
            </p>
            <p style={{ margin: '0 0 0.8rem', color: '#94a3b8', fontSize: '0.82rem' }}>
              Protocol: {responseTarget.protocol} | Port: {responseTarget.port} | Action: {responseTarget.action}
            </p>
            {isPrivateIp(responseTarget.ip) && (
              <p style={{ margin: '0 0 0.8rem', color: '#fcd34d', fontSize: '0.8rem' }}>
                Private source range detected. Block action shown for workflow demo only.
              </p>
            )}

            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <button
                onClick={() => runMockResponse('Block Source IP')}
                style={{
                  border: '1px solid rgba(248, 113, 113, 0.4)',
                  background: 'rgba(248, 113, 113, 0.12)',
                  color: '#fca5a5',
                  borderRadius: '0.5rem',
                  padding: '0.55rem 0.7rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                Block Source IP
              </button>
              <button
                onClick={() => runMockResponse('Throttle Source')}
                style={{
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  background: 'rgba(245, 158, 11, 0.12)',
                  color: '#fcd34d',
                  borderRadius: '0.5rem',
                  padding: '0.55rem 0.7rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                Throttle Source
              </button>
              <button
                onClick={() => runMockResponse('Create Incident Ticket')}
                style={{
                  border: '1px solid rgba(34, 211, 238, 0.4)',
                  background: 'rgba(34, 211, 238, 0.12)',
                  color: '#67e8f9',
                  borderRadius: '0.5rem',
                  padding: '0.55rem 0.7rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                Create Incident Ticket
              </button>
            </div>

            {responseStatus && (
              <div style={{ marginTop: '0.7rem', color: '#86efac', fontSize: '0.82rem' }}>{responseStatus}</div>
            )}

            <div style={{ marginTop: '0.9rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={closeResponseModal}
                style={{
                  border: '1px solid rgba(100, 116, 139, 0.4)',
                  background: 'rgba(15, 23, 42, 0.55)',
                  color: '#cbd5e1',
                  borderRadius: '0.45rem',
                  padding: '0.45rem 0.7rem',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
