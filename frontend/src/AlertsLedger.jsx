import React, { useState, useEffect, useMemo } from 'react';
import './components/AlertsLedger.css';

const API_URL = import.meta.env.VITE_SURICATA_API_URL;

const AlertsLedger = ({ language = 'en' }) => {
  const isVietnamese = language === 'vi';
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
  const [responseBusy, setResponseBusy] = useState(false);
  const [socQueueItems, setSocQueueItems] = useState([]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadSocQueue();
  }, []);

  const fetchAlerts = async () => {
    setIsRefreshing(true);
    if (!API_URL) {
      const now = new Date();
      const mockAlerts = [
        { id: 'al-001', type: 'ET SCAN Potential SSH Scan OUTBOUND', source: '203.0.113.42', country: 'China', flag: '🇨🇳', category: 'Attempted Information Leak', action: 'blocked', severity: 'critical', time: '3m ago', raw_timestamp: new Date(now - 180000).toISOString(), dest_ip: '192.0.2.10', dest_port: 22, proto: 'TCP', honeypot_name: 'honeypot-ssh-east', honeypot_os: 'linux' },
        { id: 'al-002', type: 'ET EXPLOIT Possible SQL Injection Attempt', source: '203.0.113.88', country: 'Brazil', flag: '🇧🇷', category: 'Web Application Attack', action: 'blocked', severity: 'critical', time: '7m ago', raw_timestamp: new Date(now - 420000).toISOString(), dest_ip: '192.0.2.11', dest_port: 80, proto: 'TCP', honeypot_name: 'honeypot-http-east', honeypot_os: 'linux' },
        { id: 'al-003', type: 'ET WEB_SERVER Cross-Site Scripting Attempt', source: '192.0.2.155', country: 'China', flag: '🇨🇳', category: 'Web Application Attack', action: 'blocked', severity: 'critical', time: '12m ago', raw_timestamp: new Date(now - 720000).toISOString(), dest_ip: '192.0.2.10', dest_port: 8080, proto: 'TCP', honeypot_name: 'honeypot-http-east', honeypot_os: 'linux' },
        { id: 'al-004', type: 'ET POLICY SSH Connection to Non-Standard Port', source: '198.51.100.17', country: 'Russia', flag: '🇷🇺', category: 'Potentially Bad Traffic', action: 'alerted', severity: 'high', time: '18m ago', raw_timestamp: new Date(now - 1080000).toISOString(), dest_ip: '192.0.2.12', dest_port: 2222, proto: 'TCP', honeypot_name: 'honeypot-ssh-west', honeypot_os: 'linux' },
        { id: 'al-005', type: 'ET SCAN Nmap Scripting Engine User-Agent', source: '192.0.2.201', country: 'Vietnam', flag: '🇻🇳', category: 'Detection of a Network Scan', action: 'alerted', severity: 'high', time: '24m ago', raw_timestamp: new Date(now - 1440000).toISOString(), dest_ip: '192.0.2.10', dest_port: 80, proto: 'TCP', honeypot_name: 'honeypot-http-east', honeypot_os: 'linux' },
        { id: 'al-006', type: 'ET EXPLOIT Apache Struts Remote Code Execution', source: '203.0.113.119', country: 'China', flag: '🇨🇳', category: 'Web Application Attack', action: 'blocked', severity: 'critical', time: '31m ago', raw_timestamp: new Date(now - 1860000).toISOString(), dest_ip: '192.0.2.10', dest_port: 8080, proto: 'TCP', honeypot_name: 'honeypot-http-east', honeypot_os: 'linux' },
        { id: 'al-007', type: 'ET SCAN Telnet BruteForce Login Attempt', source: '198.51.100.55', country: 'India', flag: '🇮🇳', category: 'Attempted Information Leak', action: 'alerted', severity: 'high', time: '38m ago', raw_timestamp: new Date(now - 2280000).toISOString(), dest_ip: '192.0.2.12', dest_port: 23, proto: 'TCP', honeypot_name: 'honeypot-telnet-east', honeypot_os: 'linux' },
        { id: 'al-008', type: 'ET POLICY DNS Query to .onion Proxy Domain', source: '203.0.113.200', country: 'Russia', flag: '🇷🇺', category: 'Potentially Bad Traffic', action: 'alerted', severity: 'medium', time: '45m ago', raw_timestamp: new Date(now - 2700000).toISOString(), dest_ip: '192.0.2.10', dest_port: 53, proto: 'UDP', honeypot_name: 'honeypot-dns-east', honeypot_os: 'linux' },
        { id: 'al-009', type: 'ET SCAN Potential VNC Scan 5900-5920', source: '198.51.100.78', country: 'Brazil', flag: '🇧🇷', category: 'Detection of a Network Scan', action: 'alerted', severity: 'medium', time: '52m ago', raw_timestamp: new Date(now - 3120000).toISOString(), dest_ip: '192.0.2.11', dest_port: 5900, proto: 'TCP', honeypot_name: 'honeypot-rdp-west', honeypot_os: 'windows' },
        { id: 'al-010', type: 'ET EXPLOIT Possible EternalBlue MS17-010', source: '192.0.2.88', country: 'China', flag: '🇨🇳', category: 'Misc Attack', action: 'blocked', severity: 'critical', time: '1h ago', raw_timestamp: new Date(now - 3600000).toISOString(), dest_ip: '192.0.2.10', dest_port: 445, proto: 'TCP', honeypot_name: 'honeypot-smb-east', honeypot_os: 'windows' },
        { id: 'al-011', type: 'ET SCAN MySQL Login Brute Force Attempt', source: '198.51.100.222', country: 'Germany', flag: '🇩🇪', category: 'Attempted Information Leak', action: 'alerted', severity: 'high', time: '1h ago', raw_timestamp: new Date(now - 4200000).toISOString(), dest_ip: '192.0.2.11', dest_port: 3306, proto: 'TCP', honeypot_name: 'honeypot-db-west', honeypot_os: 'linux' },
        { id: 'al-012', type: 'ET POLICY DNS Query to Suspicious TLD (.xyz)', source: '203.0.113.67', country: 'Vietnam', flag: '🇻🇳', category: 'Potentially Bad Traffic', action: 'alerted', severity: 'low', time: '1h ago', raw_timestamp: new Date(now - 4800000).toISOString(), dest_ip: '192.0.2.10', dest_port: 53, proto: 'UDP', honeypot_name: 'honeypot-dns-east', honeypot_os: 'linux' },
        { id: 'al-013', type: 'ET WEB_SERVER PHP Remote File Inclusion', source: '203.0.113.150', country: 'Russia', flag: '🇷🇺', category: 'Web Application Attack', action: 'blocked', severity: 'high', time: '1h ago', raw_timestamp: new Date(now - 5400000).toISOString(), dest_ip: '192.0.2.10', dest_port: 80, proto: 'TCP', honeypot_name: 'honeypot-http-east', honeypot_os: 'linux' },
        { id: 'al-014', type: 'ET POLICY SSH Banner Grab Attempt', source: '192.0.2.30', country: 'USA', flag: '🇺🇸', category: 'Not Suspicious Traffic', action: 'alerted', severity: 'low', time: '2h ago', raw_timestamp: new Date(now - 6000000).toISOString(), dest_ip: '192.0.2.12', dest_port: 22, proto: 'TCP', honeypot_name: 'honeypot-ssh-west', honeypot_os: 'linux' },
        { id: 'al-015', type: 'ET SCAN ICMP Destination Unreachable Flood', source: '192.0.2.99', country: 'Vietnam', flag: '🇻🇳', category: 'Detection of a Denial of Service Attack', action: 'alerted', severity: 'medium', time: '2h ago', raw_timestamp: new Date(now - 6600000).toISOString(), dest_ip: '192.0.2.10', dest_port: 0, proto: 'ICMP', honeypot_name: 'honeypot-ssh-east', honeypot_os: 'linux' },
        { id: 'al-016', type: 'ET POLICY Incoming Basic Auth Base64 HTTP', source: '198.51.100.91', country: 'USA', flag: '🇺🇸', category: 'Attempted Information Leak', action: 'alerted', severity: 'medium', time: '2h ago', raw_timestamp: new Date(now - 7200000).toISOString(), dest_ip: '192.0.2.10', dest_port: 8080, proto: 'TCP', honeypot_name: 'honeypot-http-east', honeypot_os: 'linux' },
        { id: 'al-017', type: 'ET DNS DNS Tunneling Attempt Detected', source: '203.0.113.33', country: 'India', flag: '🇮🇳', category: 'Potentially Bad Traffic', action: 'blocked', severity: 'high', time: '2h ago', raw_timestamp: new Date(now - 7800000).toISOString(), dest_ip: '192.0.2.12', dest_port: 53, proto: 'UDP', honeypot_name: 'honeypot-dns-east', honeypot_os: 'linux' },
        { id: 'al-018', type: 'ET SCAN LibSSH Based Frequent SSH Connections', source: '192.0.2.44', country: 'Germany', flag: '🇩🇪', category: 'Detection of a Network Scan', action: 'alerted', severity: 'low', time: '2h ago', raw_timestamp: new Date(now - 8400000).toISOString(), dest_ip: '192.0.2.11', dest_port: 22, proto: 'TCP', honeypot_name: 'honeypot-ssh-east', honeypot_os: 'linux' },
      ];
      setAlerts(mockAlerts);
      setError(null);
      setLastUpdated(new Date());
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
        honeypot_name: item.honeypot_name || item.honeypot_id || '—',
        honeypot_os: item.honeypot_os || '',
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

  const loadSocQueue = () => {
    try {
      const items = JSON.parse(localStorage.getItem('soc_queue_alerts') || '[]');
      setSocQueueItems(Array.isArray(items) ? items : []);
    } catch {
      setSocQueueItems([]);
    }
  };

  const postJson = async (path, payload) => {
    if (!API_URL) throw new Error('VITE_SURICATA_API_URL is not configured.');
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    let data = null;
    try { data = await response.json(); } catch { /* noop */ }
    if (!response.ok) {
      const errMsg = data?.error || data?.message || `Request failed (${response.status})`;
      throw new Error(errMsg);
    }
    return data || {};
  };

  const addLocalRecord = (key, record, max = 100) => {
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.unshift(record);
    localStorage.setItem(key, JSON.stringify(existing.slice(0, max)));
  };

  const runResponseAction = async (action) => {
    if (!responseTarget) return;
    setResponseBusy(true);
    setResponseStatus(null);
    try {
      if (action === 'Block IP in WAF') {
        const data = await postJson('/waf/block-ip', { ip: responseTarget.source });
        setResponseStatus(`Blocked ${responseTarget.source} in WAF - ${data.message || 'done'}`);
        return;
      }

      if (action === 'Escalate to SOC Queue') {
        const queueItem = {
          queue_id: `SOC-${Date.now().toString(36).toUpperCase()}`,
          created_at: new Date().toISOString(),
          status: 'queued',
          source: 'alerts-ledger',
          source_ip: responseTarget.source,
          threat: responseTarget.type,
          severity: responseTarget.severity,
          category: responseTarget.category,
          country: responseTarget.country,
          protocol: responseTarget.proto,
          destination: `${responseTarget.dest_ip || ''}${responseTarget.dest_port ? `:${responseTarget.dest_port}` : ''}`
        };
        addLocalRecord('soc_queue_alerts', queueItem);
        loadSocQueue();
        setResponseStatus(`Escalated to SOC queue: ${queueItem.queue_id} for ${responseTarget.source}`);
        return;
      }

      if (action === 'Create Incident Ticket') {
        const incident = {
          incident_id: `INC-${Date.now().toString(36).toUpperCase()}`,
          created_at: new Date().toISOString(),
          status: 'open',
          source: 'alerts-ledger',
          summary: 'Security alert escalated from Alerts Ledger',
          event: {
            src_ip: responseTarget.source,
            dest_ip: responseTarget.dest_ip,
            dest_port: responseTarget.dest_port,
            protocol: responseTarget.proto,
            threat_type: responseTarget.type,
            severity: responseTarget.severity,
            category: responseTarget.category,
            country: responseTarget.country,
            action: responseTarget.action,
            honeypot_name: responseTarget.honeypot_name || ''
          }
        };
        addLocalRecord('traffic_incidents', incident);
        setResponseStatus(`Incident ${incident.incident_id} created and stored locally for ${responseTarget.source}`);
        return;
      }

      setResponseStatus(`Unknown action: ${action}`);
    } catch (err) {
      setResponseStatus(`Failed: ${action} for ${responseTarget.source} - ${err.message}`);
    } finally {
      setResponseBusy(false);
    }
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

  const panelStyle = {
    background: 'rgba(15, 23, 42, 0.55)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(100, 116, 139, 0.2)',
    borderRadius: '1rem',
    padding: '1.25rem',
    position: 'relative',
    overflow: 'hidden'
  };

  if (loading) {
    return (
      <div className="ledger">
        <div className="ledger__shell">
          <div style={{ ...panelStyle, textAlign: 'center', padding: '3rem 1.25rem' }}>
            <div style={{ marginBottom: '0.75rem', color: '#22d3ee' }}>Loading security alerts...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ledger">
        <div className="ledger__shell">
          <div style={{ ...panelStyle, textAlign: 'center', padding: '3rem 1.25rem', border: '1px solid rgba(248, 113, 113, 0.3)' }}>
            <div style={{ color: '#f87171', fontWeight: 700, marginBottom: '0.5rem' }}>Failed to load alerts</div>
            <div style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ledger">
      <div className="ledger__shell">

        {/* ── Hero ──────────────────────────────────────────── */}
        <section className="ledger__hero">
          <div className="ledger__hero-text">
            <p className="ledger__eyebrow">{isVietnamese ? '🔔 Su kien bao mat' : '🔔 Security Events'}</p>
            <h2>{isVietnamese ? '📋 Nhat ky canh bao' : '📋 Alerts Ledger'}</h2>
            <p className="ledger__hero-sub">
              {isVietnamese
                ? 'Canh bao bao mat theo thoi gian thuc tu fleet honeypot — loc, tim kiem va phan ung voi de doa ngay khi xuat hien.'
                : 'Real-time security alerts from your honeypot fleet — filter, search, and respond to threats as they emerge.'}
            </p>
          </div>
          <div className="ledger__hero-actions">
            <span style={{ fontSize: '0.85rem', color: isRefreshing ? '#22d3ee' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isRefreshing ? '#22d3ee' : '#10b981', boxShadow: isRefreshing ? '0 0 8px rgba(34, 211, 238, 0.6)' : '0 0 8px rgba(16, 185, 129, 0.6)' }} />
              {isRefreshing ? (isVietnamese ? 'Dang dong bo...' : 'Syncing...') : (isVietnamese ? 'Truc tiep' : 'Live')}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              {lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}
            </span>
          </div>
        </section>

        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <div className="ledger__stat-grid">
            {[
              { label: isVietnamese ? 'Tong canh bao' : 'Total Alerts', value: totalAlerts },
              { label: isVietnamese ? 'Muc do cao' : 'High Severity', value: highSeverity },
              { label: isVietnamese ? 'Tac nhan de doa duy nhat' : 'Unique Threat Actors', value: uniqueActors }
            ].map((s) => (
              <div key={s.label} className="ledger__panel" style={{ padding: '1rem' }}>
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

          <div className="ledger__panel" style={{ padding: '1rem' }}>
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
                <option value="timestamp:desc">{isVietnamese ? 'Moi nhat truoc' : 'Newest first'}</option>
                <option value="timestamp:asc">{isVietnamese ? 'Cu nhat truoc' : 'Oldest first'}</option>
                <option value="severity:desc">{isVietnamese ? 'Muc do (Cao den Thap)' : 'Severity (High to Low)'}</option>
                <option value="severity:asc">{isVietnamese ? 'Muc do (Thap den Cao)' : 'Severity (Low to High)'}</option>
                <option value="sourceIp:asc">{isVietnamese ? 'IP nguon (A den Z)' : 'Source IP (A to Z)'}</option>
                <option value="sourceIp:desc">{isVietnamese ? 'IP nguon (Z den A)' : 'Source IP (Z to A)'}</option>
              </select>
            </div>
          </div>

          <div className="ledger__main-grid">
            <div className="ledger__panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', minHeight: 'calc(100dvh - 17rem)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 10px rgba(34, 211, 238, 0.8)' }} />
                  {isVietnamese ? 'So cai canh bao bao mat' : 'Security Alert Ledger'}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <input
                    id="global-alert-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={isVietnamese ? 'Tim kiem toan cuc (IP, de doa, quoc gia)' : 'Global search (IP, threat, country)'}
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
                    {isVietnamese ? 'Xuat CSV' : 'Export CSV'}
                  </button>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{filteredAlerts.length} {isVietnamese ? 'canh bao' : 'alerts'}</span>
                  <span style={{ fontSize: '0.75rem', color: isRefreshing ? '#22d3ee' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isRefreshing ? '#22d3ee' : '#10b981', boxShadow: isRefreshing ? '0 0 8px rgba(34, 211, 238, 0.6)' : '0 0 8px rgba(16, 185, 129, 0.6)' }} />
                    {isRefreshing ? (isVietnamese ? 'Dang dong bo...' : 'Syncing...') : (isVietnamese ? 'Truc tiep' : 'Live')}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    {isVietnamese ? 'Cap nhat luc:' : 'Last updated:'}{' '}
                    <span style={{ fontFamily: '"JetBrains Mono", "Consolas", monospace', fontVariantNumeric: 'tabular-nums' }}>
                      {lastUpdated ? lastUpdated.toLocaleTimeString() : (isVietnamese ? 'Chua co' : 'Never')}
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
                    {isVietnamese ? 'Lam moi' : 'Refresh'}
                  </button>
                </div>
              </div>

              {filteredAlerts.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2.5rem 0.5rem' }}>
                  <p style={{ margin: 0 }}>{isVietnamese ? 'Khong co canh bao nao khop voi bo loc.' : 'No alerts match your filters.'}</p>
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
                        <th style={{ textAlign: 'left', padding: '0 0.85rem', position: 'sticky', top: 0, zIndex: 6, background: 'rgba(15, 23, 42, 0.97)', backdropFilter: 'blur(8px)' }}>Honeypot</th>
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

                            <td style={cellStyle}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                <span style={{
                                  color: '#c4b5fd',
                                  fontSize: '0.8rem',
                                  fontWeight: 600
                                }}>
                                  {alert.honeypot_name}
                                </span>
                                {alert.honeypot_os && alert.honeypot_os !== '' && alert.honeypot_os !== '—' && (
                                  <span style={{
                                    color: '#94a3b8',
                                    fontSize: '0.68rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em'
                                  }}>
                                    {alert.honeypot_os}
                                  </span>
                                )}
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

            <div className="ledger__panel" style={{ padding: '1rem' }}>
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

              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(100, 116, 139, 0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '1rem' }}>SOC Queue (Local)</h3>
                  <button
                    onClick={loadSocQueue}
                    style={{
                      background: 'rgba(34, 211, 238, 0.12)',
                      border: '1px solid rgba(34, 211, 238, 0.35)',
                      borderRadius: '0.45rem',
                      color: '#67e8f9',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.25rem 0.5rem',
                      cursor: 'pointer'
                    }}
                  >
                    Refresh
                  </button>
                </div>

                {socQueueItems.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: '0.82rem', textAlign: 'center', padding: '0.75rem 0' }}>
                    No queued escalations yet.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '0.45rem', maxHeight: '220px', overflowY: 'auto' }}>
                    {socQueueItems.slice(0, 8).map((item) => (
                      <div
                        key={item.queue_id}
                        style={{
                          background: 'rgba(15, 23, 42, 0.58)',
                          border: '1px solid rgba(100, 116, 139, 0.32)',
                          borderRadius: '0.55rem',
                          padding: '0.55rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.45rem' }}>
                          <span style={{ color: '#fcd34d', fontWeight: 700, fontSize: '0.74rem' }}>{item.queue_id}</span>
                          <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                            {item.created_at ? new Date(item.created_at).toLocaleTimeString() : '—'}
                          </span>
                        </div>
                        <div style={{ color: '#e2e8f0', fontSize: '0.78rem', marginTop: '0.25rem' }}>
                          {item.source_ip} • {item.threat || 'Unknown threat'}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: '0.18rem', textTransform: 'uppercase' }}>
                          {item.severity || 'unknown'} • {item.status || 'queued'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
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
            <h3 style={{ margin: 0, color: '#fff', fontSize: '1.05rem' }}>Incident Response Actions</h3>
            <p style={{ margin: '0.55rem 0', color: '#94a3b8', fontSize: '0.86rem' }}>
              Target IP: <span style={{ color: '#a5f3fc', fontFamily: '"JetBrains Mono", "Consolas", monospace' }}>{responseTarget.source}</span>
            </p>
            <p style={{ margin: '0 0 0.8rem', color: '#94a3b8', fontSize: '0.82rem' }}>
              Threat: {responseTarget.type}
            </p>

            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <button
                disabled={responseBusy}
                onClick={() => runResponseAction('Block IP in WAF')}
                style={{
                  border: '1px solid rgba(248, 113, 113, 0.4)',
                  background: 'rgba(248, 113, 113, 0.12)',
                  color: '#fca5a5',
                  borderRadius: '0.5rem',
                  padding: '0.55rem 0.7rem',
                  textAlign: 'left',
                  cursor: responseBusy ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  opacity: responseBusy ? 0.75 : 1
                }}
              >
                Block IP in WAF
              </button>
              <button
                disabled={responseBusy}
                onClick={() => runResponseAction('Escalate to SOC Queue')}
                style={{
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  background: 'rgba(245, 158, 11, 0.12)',
                  color: '#fcd34d',
                  borderRadius: '0.5rem',
                  padding: '0.55rem 0.7rem',
                  textAlign: 'left',
                  cursor: responseBusy ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  opacity: responseBusy ? 0.75 : 1
                }}
              >
                Escalate to SOC Queue
              </button>
              <button
                disabled={responseBusy}
                onClick={() => runResponseAction('Create Incident Ticket')}
                style={{
                  border: '1px solid rgba(34, 211, 238, 0.4)',
                  background: 'rgba(34, 211, 238, 0.12)',
                  color: '#67e8f9',
                  borderRadius: '0.5rem',
                  padding: '0.55rem 0.7rem',
                  textAlign: 'left',
                  cursor: responseBusy ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  opacity: responseBusy ? 0.75 : 1
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
