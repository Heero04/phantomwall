import React, { useState, useEffect, useMemo } from 'react';

const API_URL = import.meta.env.VITE_SURICATA_API_URL;

const AlertsLedger = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({
    critical: true,
    high: true,
    medium: true,
    low: true
  });
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortDir, setSortDir] = useState('desc');
  const [copiedIpId, setCopiedIpId] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [responseTarget, setResponseTarget] = useState(null);
  const [responseStatus, setResponseStatus] = useState(null);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAlerts = async () => {
    setIsRefreshing(true);
    if (!API_URL) {
      setError('API URL not configured');
      setLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/events?limit=50`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      const transformedAlerts = (data.items || []).map((item, idx) => ({
        id: item.alert_id || idx,
        type: item.signature || item.category || 'Unknown Threat',
        source: item.src_ip || 'Unknown',
        country: item.country_name || (item.src_ip?.startsWith('10.') || item.src_ip?.startsWith('172.') || item.src_ip?.startsWith('192.168.') ? 'Private Network' : 'Unknown'),
        flag: item.flag || '',
        category: item.category || 'unknown',
        action: item.action || item.alert_action || 'alerted',
        severity: mapSeverity(item.severity),
        time: formatTimestamp(item.timestamp),
        raw_timestamp: item.timestamp,
        dest_ip: item.dest_ip || 'Unknown',
        dest_port: item.dest_port || '',
        proto: item.proto || 'N/A',
      }));

      setAlerts(transformedAlerts);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const mapSeverity = (sev) => {
    if (!sev) return 'low';
    const level = parseInt(sev, 10);
    if (level === 1) return 'critical';
    if (level === 2) return 'high';
    if (level === 3) return 'medium';
    return 'low';
  };

  const severityRank = (s) => {
    if (s === 'critical') return 3;
    if (s === 'high') return 2;
    if (s === 'medium') return 1;
    return 0;
  };

  const formatTimestamp = (ts) => {
    if (!ts) return 'Unknown';
    try {
      const date = new Date(ts);
      const now = new Date();
      const diff = Math.floor((now - date) / 1000);

      if (diff < 60) return `${diff}s ago`;
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch {
      return ts;
    }
  };

  const getSeverityStyles = (sev) => {
    if (sev === 'critical') {
      return {
        color: '#f87171',
        border: '1px solid rgba(248, 113, 113, 0.35)',
        background: 'rgba(248, 113, 113, 0.12)'
      };
    }

    if (sev === 'high') {
      return {
        color: '#f59e0b',
        border: '1px solid rgba(245, 158, 11, 0.35)',
        background: 'rgba(245, 158, 11, 0.12)'
      };
    }

    if (sev === 'medium') {
      return {
        color: '#22d3ee',
        border: '1px solid rgba(34, 211, 238, 0.35)',
        background: 'rgba(34, 211, 238, 0.12)'
      };
    }

    return {
      color: '#4ade80',
      border: '1px solid rgba(74, 222, 128, 0.35)',
      background: 'rgba(74, 222, 128, 0.12)'
    };
  };

  const toggleFilter = (key) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const applyExclusiveSeverityFilter = (severity) => {
    setFilters({
      critical: severity === 'critical',
      high: severity === 'high',
      medium: severity === 'medium',
      low: severity === 'low'
    });
  };

  const handleCopy = async (id, ip) => {
    try {
      await navigator.clipboard.writeText(ip);
      setCopiedIpId(id);
      setTimeout(() => setCopiedIpId((cur) => (cur === id ? null : cur)), 1500);
    } catch {
      setCopiedIpId(id);
      setTimeout(() => setCopiedIpId((cur) => (cur === id ? null : cur)), 1500);
    }
  };

  const openResponseModal = (alert) => {
    setResponseStatus(null);
    setResponseTarget(alert);
  };

  const closeResponseModal = () => {
    setResponseTarget(null);
    setResponseStatus(null);
  };

  const runMockResponse = (action) => {
    if (!responseTarget) return;
    setResponseStatus(`Queued: ${action} for ${responseTarget.source}`);
  };

  const isPrivateIp = (ip) => {
    if (!ip || ip === 'Unknown') return true;
    return ip.startsWith('10.') || ip.startsWith('172.') || ip.startsWith('192.168.');
  };

  const openWhois = (ip) => {
    if (!ip || isPrivateIp(ip)) return;
    window.open(`https://who.is/whois-ip/ip-address/${encodeURIComponent(ip)}`, '_blank', 'noopener,noreferrer');
  };

  const openReputation = (ip) => {
    if (!ip || isPrivateIp(ip)) return;
    window.open(`https://www.abuseipdb.com/check/${encodeURIComponent(ip)}`, '_blank', 'noopener,noreferrer');
  };

  const exportCsv = () => {
    const headers = ['timestamp', 'severity', 'threat_type', 'category', 'origin', 'source_ip', 'destination', 'protocol', 'action'];
    const escapeCsv = (value) => {
      const raw = value ?? '';
      const str = String(raw);
      if (str.includes('"') || str.includes(',') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredAlerts.map((alert) => [
      alert.raw_timestamp || '',
      alert.severity || '',
      alert.type || '',
      alert.category || '',
      alert.country || '',
      alert.source || '',
      `${alert.dest_ip || ''}${alert.dest_port ? `:${alert.dest_port}` : ''}`,
      alert.proto || '',
      alert.action || ''
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.map(escapeCsv).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `phantomwall-alert-ledger-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    window.print();
  };

  const getActionBadgeStyles = (actionValue) => {
    const action = (actionValue || '').toLowerCase();

    if (action.includes('drop') || action.includes('block') || action.includes('reject') || action.includes('deny')) {
      return {
        label: 'Blocked',
        color: '#fca5a5',
        border: '1px solid rgba(248, 113, 113, 0.4)',
        background: 'rgba(248, 113, 113, 0.14)'
      };
    }

    if (action.includes('allow') || action.includes('pass') || action.includes('accept')) {
      return {
        label: 'Allowed',
        color: '#86efac',
        border: '1px solid rgba(74, 222, 128, 0.4)',
        background: 'rgba(74, 222, 128, 0.14)'
      };
    }

    return {
      label: actionValue || 'Unknown',
      color: '#cbd5e1',
      border: '1px solid rgba(148, 163, 184, 0.35)',
      background: 'rgba(148, 163, 184, 0.12)'
    };
  };

  const filteredAlerts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = alerts.filter((a) => filters[a.severity]);

    const searched = !q
      ? base
      : base.filter((a) =>
          a.source?.toLowerCase().includes(q) ||
          a.type?.toLowerCase().includes(q) ||
          a.country?.toLowerCase().includes(q) ||
          a.category?.toLowerCase().includes(q) ||
          a.proto?.toLowerCase().includes(q)
        );

    return [...searched].sort((a, b) => {
      if (sortBy === 'timestamp') {
        const aTime = new Date(a.raw_timestamp).getTime();
        const bTime = new Date(b.raw_timestamp).getTime();
        return sortDir === 'desc' ? bTime - aTime : aTime - bTime;
      }

      if (sortBy === 'severity') {
        const diff = severityRank(b.severity) - severityRank(a.severity);
        return sortDir === 'desc' ? diff : -diff;
      }

      if (sortBy === 'sourceIp') {
        const cmp = (a.source || '').localeCompare(b.source || '', undefined, { numeric: true });
        return sortDir === 'desc' ? -cmp : cmp;
      }

      return 0;
    });
  }, [query, filters, alerts, sortBy, sortDir]);

  const totalAlerts = alerts.length;
  const highSeverity = alerts.filter((a) => a.severity === 'critical' || a.severity === 'high').length;
  const uniqueActors = new Set(alerts.map((a) => a.source)).size;

  const topOrigins = useMemo(() => {
    const map = new Map();
    alerts.forEach((a) => {
      const country = a.country || 'Unknown';
      map.set(country, (map.get(country) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [alerts]);

  const severityDistribution = useMemo(() => {
    const counts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    alerts.forEach((alert) => {
      if (counts[alert.severity] !== undefined) {
        counts[alert.severity] += 1;
      }
    });

    const max = Math.max(1, ...Object.values(counts));
    return [
      { key: 'critical', label: 'Critical', count: counts.critical, color: '#f87171', width: (counts.critical / max) * 100 },
      { key: 'high', label: 'High', count: counts.high, color: '#f59e0b', width: (counts.high / max) * 100 },
      { key: 'medium', label: 'Medium', count: counts.medium, color: '#22d3ee', width: (counts.medium / max) * 100 },
      { key: 'low', label: 'Low', count: counts.low, color: '#4ade80', width: (counts.low / max) * 100 }
    ];
  }, [alerts]);

  const columnVisibility = useMemo(() => {
    const isUniform = (getter) => {
      if (filteredAlerts.length <= 1) return false;
      const first = getter(filteredAlerts[0]) ?? '';
      return filteredAlerts.every((item) => (getter(item) ?? '') === first);
    };

    return {
      category: !isUniform((a) => a.category),
      origin: !isUniform((a) => a.country),
      destination: !isUniform((a) => `${a.dest_ip || ''}:${a.dest_port || ''}`),
      protocol: !isUniform((a) => a.proto),
      action: !isUniform((a) => a.action),
    };
  }, [filteredAlerts]);

  const pageStyle = {
    minHeight: '100dvh',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
    padding: '2rem 2.5rem'
  };

  const shellStyle = {
    maxWidth: '1400px',
    margin: '0 auto',
    color: '#e2e8f0'
  };

  const panelStyle = {
    background: 'rgba(30, 41, 59, 0.6)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(100, 116, 139, 0.3)',
    borderRadius: '1rem',
    padding: '1.25rem',
    position: 'relative',
    overflow: 'hidden'
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={shellStyle}>
          <div style={{ ...panelStyle, textAlign: 'center', padding: '3rem 1.25rem' }}>
            <div style={{ marginBottom: '0.75rem', color: '#22d3ee' }}>Loading security alerts...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={shellStyle}>
          <div style={{ ...panelStyle, textAlign: 'center', padding: '3rem 1.25rem', border: '1px solid rgba(248, 113, 113, 0.3)' }}>
            <div style={{ color: '#f87171', fontWeight: 700, marginBottom: '0.5rem' }}>Failed to load alerts</div>
            <div style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={shellStyle}>
        <div className="alerts-ledger-grid" style={{ display: 'grid', gap: '2rem' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: '1rem',
              position: 'sticky',
              top: '1rem',
              zIndex: 40
            }}
            className="alerts-stat-grid"
          >
            {[
              { label: 'Total Alerts', value: totalAlerts },
              { label: 'High Severity', value: highSeverity },
              { label: 'Unique Threat Actors', value: uniqueActors }
            ].map((s) => (
              <div key={s.label} style={panelStyle}>
                <div style={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(100, 116, 139, 0.3)',
                  borderRadius: '0.75rem',
                  padding: '1rem'
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                  <div
                    style={{
                      marginTop: '0.6rem',
                      background: 'rgba(2, 6, 23, 0.6)',
                      border: '1px solid rgba(100, 116, 139, 0.28)',
                      borderRadius: '0.65rem',
                      padding: '0.55rem 0.75rem',
                      boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.45)'
                    }}
                  >
                    <div
                      style={{
                        color: '#fff',
                        fontSize: '2rem',
                        fontWeight: 700,
                        lineHeight: 1,
                        fontVariantNumeric: 'tabular-nums'
                      }}
                    >
                      {s.value}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ ...panelStyle, padding: '1rem' }}>
            <div className="alerts-filter-row" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {(['critical', 'high', 'medium', 'low']).map((k) => {
                const active = filters[k];
                const sev = getSeverityStyles(k);
                return (
                  <button
                    key={k}
                    onClick={() => toggleFilter(k)}
                    style={{
                      padding: '0.58rem 0.75rem',
                      borderRadius: '0.55rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      border: active ? sev.border : '1px solid rgba(100, 116, 139, 0.4)',
                      background: active ? sev.background : 'rgba(15, 23, 42, 0.45)',
                      color: active ? sev.color : '#94a3b8'
                    }}
                  >
                    {k}
                  </button>
                );
              })}

              <select
                value={`${sortBy}:${sortDir}`}
                onChange={(e) => {
                  const [k, d] = e.target.value.split(':');
                  setSortBy(k);
                  setSortDir(d);
                }}
                style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid rgba(100, 116, 139, 0.5)',
                  borderRadius: '0.6rem',
                  color: '#e2e8f0',
                  padding: '0.65rem 0.8rem',
                  outline: 'none'
                }}
              >
                <option value="timestamp:desc">Newest first</option>
                <option value="timestamp:asc">Oldest first</option>
                <option value="severity:desc">Severity (High to Low)</option>
                <option value="severity:asc">Severity (Low to High)</option>
                <option value="sourceIp:asc">Source IP (A to Z)</option>
                <option value="sourceIp:desc">Source IP (Z to A)</option>
              </select>
            </div>
          </div>

          <div className="alerts-main-grid" style={{ display: 'grid', gridTemplateColumns: '3fr 1.2fr', gap: '1.5rem', alignItems: 'start' }}>
            <div style={{ ...panelStyle, padding: '1.25rem', display: 'flex', flexDirection: 'column', minHeight: 'calc(100dvh - 17rem)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 10px rgba(34, 211, 238, 0.8)' }} />
                  Security Alert Ledger
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <input
                    id="global-alert-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Global search (IP, threat, country)"
                    style={{
                      width: '280px',
                      maxWidth: '100%',
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(100, 116, 139, 0.5)',
                      borderRadius: '0.6rem',
                      color: '#e2e8f0',
                      padding: '0.55rem 0.75rem',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={exportCsv}
                    style={{
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      borderRadius: '0.5rem',
                      color: '#6ee7b7',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      padding: '0.45rem 0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={exportPdf}
                    style={{
                      background: 'rgba(148, 163, 184, 0.12)',
                      border: '1px solid rgba(148, 163, 184, 0.35)',
                      borderRadius: '0.5rem',
                      color: '#cbd5e1',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      padding: '0.45rem 0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    Export PDF
                  </button>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{filteredAlerts.length} alerts</span>
                  <span style={{ fontSize: '0.75rem', color: isRefreshing ? '#22d3ee' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isRefreshing ? '#22d3ee' : '#10b981', boxShadow: isRefreshing ? '0 0 8px rgba(34, 211, 238, 0.6)' : '0 0 8px rgba(16, 185, 129, 0.6)' }} />
                    {isRefreshing ? 'Syncing...' : 'Live'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Last updated:{' '}
                    <span style={{ fontFamily: '"JetBrains Mono", "Consolas", monospace', fontVariantNumeric: 'tabular-nums' }}>
                      {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}
                    </span>
                  </span>
                  <button
                    onClick={fetchAlerts}
                    disabled={isRefreshing}
                    style={{
                      background: 'rgba(34, 211, 238, 0.12)',
                      border: '1px solid rgba(34, 211, 238, 0.35)',
                      borderRadius: '0.5rem',
                      color: '#67e8f9',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      padding: '0.45rem 0.75rem',
                      cursor: isRefreshing ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {filteredAlerts.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2.5rem 0.5rem' }}>
                  <p style={{ margin: 0 }}>No alerts match your filters.</p>
                </div>
              ) : (
                <div
                  style={{
                    overflowX: 'auto',
                    overflowY: 'auto',
                    flex: 1,
                    minHeight: 0,
                    maxHeight: 'calc(100dvh - 24rem)'
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 0.65rem', minWidth: '1080px' }}>
                    <thead>
                      <tr style={{ color: '#94a3b8', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        <th style={{ textAlign: 'left', padding: '0 0.85rem', position: 'sticky', top: 0, zIndex: 6, background: 'rgba(15, 23, 42, 0.97)', backdropFilter: 'blur(8px)' }}>Severity</th>
                        <th style={{ textAlign: 'left', padding: '0 0.85rem', position: 'sticky', top: 0, zIndex: 6, background: 'rgba(15, 23, 42, 0.97)', backdropFilter: 'blur(8px)' }}>Threat Type</th>
                        {columnVisibility.category && <th style={{ textAlign: 'left', padding: '0 0.85rem', position: 'sticky', top: 0, zIndex: 6, background: 'rgba(15, 23, 42, 0.97)', backdropFilter: 'blur(8px)' }}>Category</th>}
                        {columnVisibility.origin && <th style={{ textAlign: 'left', padding: '0 0.85rem', position: 'sticky', top: 0, zIndex: 6, background: 'rgba(15, 23, 42, 0.97)', backdropFilter: 'blur(8px)' }}>Origin</th>}
                        <th style={{ textAlign: 'left', padding: '0 0.85rem', position: 'sticky', top: 0, zIndex: 6, background: 'rgba(15, 23, 42, 0.97)', backdropFilter: 'blur(8px)' }}>Source IP</th>
                        {columnVisibility.destination && <th style={{ textAlign: 'left', padding: '0 0.85rem', position: 'sticky', top: 0, zIndex: 6, background: 'rgba(15, 23, 42, 0.97)', backdropFilter: 'blur(8px)' }}>Destination</th>}
                        {columnVisibility.protocol && <th style={{ textAlign: 'left', padding: '0 0.85rem', position: 'sticky', top: 0, zIndex: 6, background: 'rgba(15, 23, 42, 0.97)', backdropFilter: 'blur(8px)' }}>Protocol</th>}
                        {columnVisibility.action && <th style={{ textAlign: 'left', padding: '0 0.85rem', position: 'sticky', top: 0, zIndex: 6, background: 'rgba(15, 23, 42, 0.97)', backdropFilter: 'blur(8px)' }}>Action</th>}
                        <th style={{ textAlign: 'right', padding: '0 0.85rem', position: 'sticky', top: 0, zIndex: 6, background: 'rgba(15, 23, 42, 0.97)', backdropFilter: 'blur(8px)' }}>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAlerts.map((alert) => {
                        const isCopied = copiedIpId === alert.id;
                        const sev = getSeverityStyles(alert.severity);
                        const cellStyle = {
                          background: 'rgba(15, 23, 42, 0.58)',
                          borderTop: '1px solid rgba(100, 116, 139, 0.3)',
                          borderBottom: '1px solid rgba(100, 116, 139, 0.3)',
                          padding: '0.85rem'
                        };

                        return (
                          <tr key={alert.id}>
                            <td style={{ ...cellStyle, borderLeft: '1px solid rgba(100, 116, 139, 0.3)', borderRadius: '10px 0 0 10px' }}>
                              <span style={{ ...sev, borderRadius: '0.4rem', padding: '0.25rem 0.5rem', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase' }}>
                                {alert.severity}
                              </span>
                            </td>

                            <td style={cellStyle}>
                              <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.88rem' }}>{alert.type}</div>
                            </td>

                            {columnVisibility.category && (
                              <td style={cellStyle}>
                                <span style={{
                                  color: '#cbd5e1',
                                  fontSize: '0.78rem',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.04em'
                                }}>
                                  {alert.category}
                                </span>
                              </td>
                            )}

                            {columnVisibility.origin && (
                              <td style={cellStyle}>
                                <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{alert.flag} {alert.country}</span>
                              </td>
                            )}

                            <td style={cellStyle}>
                              <div className="source-ip-cell" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                <span style={{
                                  color: '#a5f3fc',
                                  fontFamily: 'monospace',
                                  fontSize: '0.8rem',
                                  background: 'rgba(34, 211, 238, 0.1)',
                                  border: '1px solid rgba(34, 211, 238, 0.25)',
                                  borderRadius: '0.35rem',
                                  padding: '0.2rem 0.45rem'
                                }}>
                                  {alert.source}
                                </span>
                                <button
                                  onClick={() => handleCopy(alert.id, alert.source)}
                                  className="ip-inline-action"
                                  style={{
                                    border: '1px solid rgba(100, 116, 139, 0.4)',
                                    background: 'rgba(15, 23, 42, 0.55)',
                                    color: '#cbd5e1',
                                    borderRadius: '0.35rem',
                                    padding: '0.2rem 0.4rem',
                                    cursor: 'pointer',
                                    fontSize: '0.72rem'
                                  }}
                                  title={isCopied ? 'Copied!' : 'Copy IP'}
                                >
                                  Copy
                                </button>
                                {!isPrivateIp(alert.source) && (
                                  <>
                                    <button
                                      onClick={() => openWhois(alert.source)}
                                      className="ip-inline-action ip-inline-action--hover-only"
                                      style={{
                                        border: '1px solid rgba(100, 116, 139, 0.4)',
                                        background: 'rgba(15, 23, 42, 0.55)',
                                        color: '#cbd5e1',
                                        borderRadius: '0.35rem',
                                        padding: '0.2rem 0.4rem',
                                        cursor: 'pointer',
                                        fontSize: '0.72rem'
                                      }}
                                      title="Open Whois lookup"
                                    >
                                      Whois
                                    </button>
                                    <button
                                      onClick={() => openReputation(alert.source)}
                                      className="ip-inline-action ip-inline-action--hover-only"
                                      style={{
                                        border: '1px solid rgba(100, 116, 139, 0.4)',
                                        background: 'rgba(15, 23, 42, 0.55)',
                                        color: '#cbd5e1',
                                        borderRadius: '0.35rem',
                                        padding: '0.2rem 0.4rem',
                                        cursor: 'pointer',
                                        fontSize: '0.72rem'
                                      }}
                                      title="Check IP reputation"
                                    >
                                      Reputation
                                    </button>
                                    <button
                                      onClick={() => openResponseModal(alert)}
                                      className="ip-inline-action ip-inline-action--hover-only"
                                      style={{
                                        border: '1px solid rgba(100, 116, 139, 0.4)',
                                        background: 'rgba(15, 23, 42, 0.55)',
                                        color: '#cbd5e1',
                                        borderRadius: '0.35rem',
                                        padding: '0.2rem 0.4rem',
                                        cursor: 'pointer',
                                        fontSize: '0.72rem'
                                      }}
                                      title="Open response actions"
                                    >
                                      Respond
                                    </button>
                                  </>
                                )}
                                {isCopied && <span style={{ color: '#67e8f9', fontSize: '0.72rem' }}>Copied</span>}
                              </div>
                            </td>

                            {columnVisibility.destination && (
                              <td style={cellStyle}>
                                <span style={{ color: '#cbd5e1', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                  {alert.dest_ip}{alert.dest_port ? `:${alert.dest_port}` : ''}
                                </span>
                              </td>
                            )}

                            {columnVisibility.protocol && (
                              <td style={cellStyle}>
                                <span style={{ color: '#e2e8f0', fontSize: '0.8rem' }}>{alert.proto}</span>
                              </td>
                            )}

                            {columnVisibility.action && (
                              <td style={cellStyle}>
                                {(() => {
                                  const actionBadge = getActionBadgeStyles(alert.action);
                                  return (
                                    <span
                                      style={{
                                        color: actionBadge.color,
                                        fontSize: '0.74rem',
                                        fontWeight: 700,
                                        letterSpacing: '0.04em',
                                        textTransform: 'uppercase',
                                        padding: '0.22rem 0.5rem',
                                        borderRadius: '999px',
                                        border: actionBadge.border,
                                        background: actionBadge.background
                                      }}
                                      title={`Raw action: ${alert.action}`}
                                    >
                                      {actionBadge.label}
                                    </span>
                                  );
                                })()}
                              </td>
                            )}

                            <td
                              style={{
                                ...cellStyle,
                                borderRight: '1px solid rgba(100, 116, 139, 0.3)',
                                borderRadius: '0 10px 10px 0',
                                textAlign: 'right',
                                color: '#cbd5e1',
                                fontSize: '0.82rem',
                                fontFamily: '"JetBrains Mono", "Consolas", monospace',
                                fontVariantNumeric: 'tabular-nums'
                              }}
                            >
                              {alert.time}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid rgba(100, 116, 139, 0.3)', color: '#94a3b8', fontSize: '0.75rem', textAlign: 'center' }}>
                Auto-refreshing every 30 seconds.
              </div>
            </div>

            <div style={{ ...panelStyle, padding: '1rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '1rem' }}>Severity Breakdown</h3>
                  <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>Click to filter</span>
                </div>
                <div style={{ display: 'grid', gap: '0.55rem' }}>
                  {severityDistribution.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => applyExclusiveSeverityFilter(item.key)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        background: 'rgba(15, 23, 42, 0.52)',
                        border: '1px solid rgba(100, 116, 139, 0.3)',
                        borderRadius: '0.55rem',
                        padding: '0.55rem',
                        cursor: 'pointer'
                      }}
                      title={`Show only ${item.label} alerts`}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <span style={{ color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 600 }}>{item.label}</span>
                        <span style={{ color: '#fff', fontSize: '0.78rem', fontWeight: 700 }}>{item.count}</span>
                      </div>
                      <div style={{ height: '5px', background: 'rgba(100, 116, 139, 0.28)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ width: `${item.width}%`, height: '100%', background: item.color }} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1rem' }}>Top Attack Origins</h3>
                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Last 24h</span>
              </div>

              {topOrigins.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '1.25rem 0' }}>No data yet</div>
              ) : (
                <div style={{ display: 'grid', gap: '0.7rem' }}>
                  {topOrigins.map((o, idx) => {
                    const max = Math.max(...topOrigins.map((x) => x.count));
                    const width = Math.min(100, (o.count / max) * 100);

                    return (
                      <div key={o.country} style={{
                        background: 'rgba(15, 23, 42, 0.58)',
                        border: '1px solid rgba(100, 116, 139, 0.32)',
                        borderRadius: '0.6rem',
                        padding: '0.7rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem', gap: '0.5rem' }}>
                          <span style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 600 }}>{idx + 1}. {o.country}</span>
                          <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>{o.count}</span>
                        </div>
                        <div style={{ height: '5px', background: 'rgba(100, 116, 139, 0.32)', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ width: `${width}%`, height: '100%', background: 'linear-gradient(90deg, #ef4444, #f87171)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1100px) {
          .alerts-main-grid {
            grid-template-columns: 1fr !important;
          }
        }

        .ip-inline-action--hover-only {
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
        }

        .source-ip-cell:hover .ip-inline-action--hover-only {
          opacity: 1;
          pointer-events: auto;
        }

        @media (max-width: 900px) {
          .alerts-stat-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 768px) {
          .alerts-ledger-grid {
            gap: 1.25rem !important;
          }
        }
      `}</style>

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
            <h3 style={{ margin: 0, color: '#fff', fontSize: '1.05rem' }}>Incident Response Actions</h3>
            <p style={{ margin: '0.55rem 0', color: '#94a3b8', fontSize: '0.86rem' }}>
              Target IP: <span style={{ color: '#a5f3fc', fontFamily: '"JetBrains Mono", "Consolas", monospace' }}>{responseTarget.source}</span>
            </p>
            <p style={{ margin: '0 0 0.8rem', color: '#94a3b8', fontSize: '0.82rem' }}>
              Threat: {responseTarget.type}
            </p>

            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <button
                onClick={() => runMockResponse('Block IP in WAF')}
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
                Block IP in WAF
              </button>
              <button
                onClick={() => runMockResponse('Escalate to SOC Queue')}
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
                Escalate to SOC Queue
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
};

export default AlertsLedger;
