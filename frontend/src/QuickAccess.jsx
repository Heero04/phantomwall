import React, { useState, useEffect } from 'react';
import './components/QuickAccess.css';

const API_URL = import.meta.env.VITE_SURICATA_API_URL;

const QuickAccess = ({ onNavigate }) => {
  const [honeypotStatus, setHoneypotStatus] = useState('unknown');
  const [isStarting, setIsStarting] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fleetInstances, setFleetInstances] = useState([]);
  const [lockdownActive, setLockdownActive] = useState(false);

  // Fetch real data from API
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      if (!API_URL) {
        console.warn('API URL not configured');
        return;
      }

      // Fetch alerts, metrics, and fleet in parallel
      const [alertsRes, metricsRes, fleetRes] = await Promise.all([
        fetch(`${API_URL}/events`),
        fetch(`${API_URL}/metrics`),
        fetch(`${API_URL}/fleet/instances`)
      ]);

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData.items || []);
      }

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setMetrics(metricsData);
      }

      if (fleetRes.ok) {
        const fleetData = await fleetRes.json();
        const items = Array.isArray(fleetData?.items) ? fleetData.items : [];
        setFleetInstances(items);
        // Derive overall status: if any instance is running, show 'running'
        const hasRunning = items.some(i => i.status === 'running');
        const allStopped = items.length > 0 && items.every(i => i.status === 'stopped');
        setHoneypotStatus(hasRunning ? 'running' : allStopped ? 'stopped' : 'unknown');
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats from real data
  const stats = {
    todayAttacks: alerts.length || 0,
    uniqueIPs: new Set(alerts.map(a => a.src_ip)).size || 0,
    topThreat: alerts[0]?.signature || 'No threats detected'
  };

  // Get recent alerts (top 3)
  const recentAlerts = alerts.slice(0, 3).map(alert => ({
    id: alert.event_id,
    type: alert.signature || alert.category || 'Unknown',
    sourceIp: alert.src_ip || 'Unknown',
    severity: alert.severity === 1 ? 'critical' : alert.severity === 2 ? 'warning' : 'info',
    timestamp: formatTimestamp(alert.event_time)
  }));

  // Calculate top origins from real data
  const topOrigins = calculateTopOrigins(alerts);

  // Fleet Status – derived from real API data
  const fleetData = (() => {
    const running = fleetInstances.filter(i => i.status === 'running').length;
    const total = fleetInstances.length;
    const sentiment = total === 0 ? 'unknown' : running === total ? 'operational' : running === 0 ? 'suspended' : 'degraded';
    return { active: running, total, sentiment };
  })();

  const getFleetStatusText = () => {
    if (fleetData.total === 0) return 'Loading fleet...';
    if (fleetData.sentiment === 'suspended') return 'All traps offline';
    if (fleetData.active === fleetData.total) return 'All systems operational';
    if (fleetData.active === 0) return 'Critical: All traps offline';
    return `Degraded: ${fleetData.total - fleetData.active} trap(s) offline`;
  };

  const getFleetStatusColor = () => {
    if (fleetData.total === 0) return '#64748b';
    if (fleetData.sentiment === 'suspended') return '#ef4444';
    if (fleetData.active === fleetData.total) return '#10b981';
    if (fleetData.active === 0) return '#ef4444';
    return '#f59e0b';
  };

  // Calculate uptime from the earliest running instance's LaunchTime
  const getUptime = () => {
    const runningInstances = fleetInstances.filter(i => i.status === 'running');
    if (runningInstances.length === 0) return '00h 00m';
    // Find the earliest launch (longest running)
    const launchTimes = runningInstances.map(i => new Date(i.last_seen).getTime()).filter(t => !isNaN(t));
    if (launchTimes.length === 0) return '—';
    const earliest = Math.min(...launchTimes);
    const diff = Date.now() - earliest;
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${String(mins).padStart(2, '0')}m`;
  };

  const handleToggleHoneypot = async () => {
    if (!API_URL || fleetInstances.length === 0) return;
    setIsStarting(true);
    const newAction = honeypotStatus === 'running' ? 'stop' : 'start';
    try {
      // Send action to all fleet instances
      await Promise.all(
        fleetInstances.map(inst =>
          fetch(`${API_URL}/fleet/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instance_id: inst.instance_id,
              action: newAction,
              mode: 'ec2',
              region: inst.region,
            }),
          })
        )
      );
      // Wait a moment then refresh fleet data
      await new Promise(resolve => setTimeout(resolve, 2000));
      await fetchData();
    } catch (err) {
      console.error('Toggle error:', err);
    } finally {
      setIsStarting(false);
    }
  };

  function formatTimestamp(timestamp) {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }

  function calculateTopOrigins(alerts) {
    // Group by country (with IP fallback for missing data)
    const countryCounts = {};
    
    alerts.forEach(alert => {
      // Prefer country_name from enriched data, fallback to IP
      const country = alert.country_name || alert.src_ip || 'Unknown';
      const flag = alert.flag || '🌐';
      
      if (!countryCounts[country]) {
        countryCounts[country] = { count: 0, flag };
      }
      countryCounts[country].count += 1;
    });

    // Convert to array and sort by count
    const sorted = Object.entries(countryCounts)
      .map(([country, data]) => ({ country, count: data.count, flag: data.flag }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate percentages
    const maxCount = sorted[0]?.count || 1;
    return sorted.map(({ country, count, flag }) => ({
      country,
      flag,
      attacks: count,
      percentage: Math.round((count / maxCount) * 100)
    }));
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      case 'info':
        return '#3b82f6';
      default:
        return '#64748b';
    }
  };

  return (
    <div className="qa">
      <div className="qa__shell">

        {/* ── Hero ──────────────────────────────────────────── */}
        <section className="qa__hero">
          <div className="qa__hero-text">
            <p className="qa__eyebrow">⚡ Command Center</p>
            <h2>🛡️ Quick Access</h2>
            <p className="qa__hero-sub">
              Real-time fleet status, threat metrics, and quick actions — your operational nerve center for PhantomWall.
            </p>
          </div>
          <div className="qa__hero-actions">
            <button
              className={`qa__lockdown-btn ${lockdownActive ? 'qa__lockdown-btn--active' : ''}`}
              onClick={() => {
                setLockdownActive(prev => !prev);
                // Navigate to Fleet Manager so user can see WAF details
                if (!lockdownActive) {
                  setTimeout(() => onNavigate?.('fleet'), 600);
                }
              }}
            >
              {lockdownActive ? '🔒 Lockdown' : '🔓 Lockdown'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: getFleetStatusColor(),
              }}>
                {fleetData.active}/{fleetData.total} Active
              </span>
              <button
                onClick={handleToggleHoneypot}
                disabled={isStarting}
                style={{
                  position: 'relative',
                  width: '44px',
                  height: '24px',
                  borderRadius: '12px',
                  background: honeypotStatus === 'running' ? '#10b981' : '#64748b',
                  border: 'none',
                  cursor: isStarting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s',
                  opacity: isStarting ? 0.5 : 1,
                  boxShadow: honeypotStatus === 'running' ? '0 0 15px rgba(16, 185, 129, 0.4)' : 'none'
                }}
              >
                <span style={{
                  position: 'absolute',
                  top: '2px',
                  left: honeypotStatus === 'running' ? '22px' : '2px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: 'white',
                  transition: 'all 0.3s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}></span>
              </button>
            </div>
          </div>
        </section>
        
        {/* Honeypot Status Card */}
        <div className="qa__fleet-card">
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)'
          }}></div>
          
          <div style={{ position: 'relative', zIndex: 10 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              marginBottom: '1.25rem'
            }}>
              <div style={{
                width: '2.5rem',
                height: '2.5rem',
                background: honeypotStatus === 'running' 
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                boxShadow: honeypotStatus === 'running' ? '0 0 20px rgba(16, 185, 129, 0.4)' : 'none'
              }}>
                🛡️
              </div>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>Fleet Status</span>
              <span style={{ fontSize: '0.85rem', color: getFleetStatusColor(), fontWeight: 500 }}>
                {getFleetStatusText()}
              </span>
              {/* Status Pips */}
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', marginLeft: '0.5rem' }}>
                {[...Array(fleetData.total)].map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: i < fleetData.active ? '#10b981' : '#64748b',
                        boxShadow: i < fleetData.active ? '0 0 8px rgba(16, 185, 129, 0.6)' : 'none',
                        transition: 'all 0.3s'
                      }}
                    ></div>
                  ))}
                </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '1.25rem'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: '#94a3b8', 
                  marginBottom: '0.75rem',
                  fontWeight: 500,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase'
                }}>
                  Global Uptime
                </div>
                <div style={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(100, 116, 139, 0.3)',
                  borderRadius: '0.75rem',
                  padding: '1.25rem',
                  boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(16, 185, 129, 0.1)'
                }}>
                  <div style={{
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    color: honeypotStatus === 'running' ? '#10b981' : '#64748b',
                    textShadow: honeypotStatus === 'running' ? '0 0 20px rgba(16, 185, 129, 0.4)' : 'none'
                  }}>
                    {honeypotStatus === 'running' ? getUptime() : '00h 00m'}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: '#94a3b8', 
                  marginBottom: '0.75rem',
                  fontWeight: 500,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase'
                }}>
                  Active Traps
                </div>
                <div style={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(100, 116, 139, 0.3)',
                  borderRadius: '0.75rem',
                  padding: '1.25rem',
                  boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(6, 182, 212, 0.1)'
                }}>
                  <div style={{
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    color: honeypotStatus === 'running' ? '#06b6d4' : '#64748b',
                    textShadow: honeypotStatus === 'running' ? '0 0 20px rgba(6, 182, 212, 0.4)' : 'none'
                  }}>
                    {honeypotStatus === 'running' ? fleetData.active : '0'}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: '#94a3b8', 
                  marginBottom: '0.75rem',
                  fontWeight: 500,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase'
                }}>
                  Interactions Today
                </div>
                <div style={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(100, 116, 139, 0.3)',
                  borderRadius: '0.75rem',
                  padding: '1.25rem',
                  boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(139, 92, 246, 0.1)'
                }}>
                  <div style={{
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    color: honeypotStatus === 'running' ? '#8b5cf6' : '#64748b',
                    textShadow: honeypotStatus === 'running' ? '0 0 20px rgba(139, 92, 246, 0.4)' : 'none'
                  }}>
                    {honeypotStatus === 'running' ? (metrics?.metrics?.events_24h ?? '0') : '0'}
                  </div>
                </div>
              </div>
            </div>

            {honeypotStatus === 'running' && (
              <div style={{
                marginTop: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                color: '#10b981'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#10b981',
                  animation: 'pulse 1.5s infinite'
                }}></div>
                <span style={{ fontSize: '0.875rem' }}>Monitoring active threats</span>
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area - Dims when system is paused */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* System Paused Overlay */}
          {honeypotStatus === 'stopped' && (
            <div className="qa__paused-overlay">
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '3rem',
                  marginBottom: '1rem'
                }}>⏸️</div>
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: '#f59e0b',
                  marginBottom: '0.5rem'
                }}>
                  System Paused
                </div>
                <div style={{
                  fontSize: '0.95rem',
                  color: '#94a3b8'
                }}>
                  Enable the master switch to resume monitoring
                </div>
              </div>
            </div>
          )}

        {/* Threat Stats Grid */}
        <div className="qa__stat-grid">
          {/* Attacks Today */}
          <div className="qa__stat-card qa__stat-card--red">
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.05) 100%)'
            }}></div>
            <div style={{ position: 'relative', zIndex: 10 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem'
              }}>
                <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#ef4444',
                  animation: 'pulse 2s infinite'
                }}></div>
              </div>
              <h3 style={{
                fontSize: '0.8rem',
                color: '#94a3b8',
                marginBottom: '0.75rem',
                fontWeight: 500,
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}>
                Attacks Today
              </h3>
              {/* Number Card */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.5)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(100, 116, 139, 0.3)',
                borderRadius: '0.75rem',
                padding: '1.25rem',
                boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(239, 68, 68, 0.08)'
              }}>
                <div style={{
                  fontSize: '2.25rem',
                  fontWeight: 'bold',
                  color: '#f1f5f9',
                  textAlign: 'center',
                  textShadow: '0 0 20px rgba(239, 68, 68, 0.3)'
                }}>
                  {stats.todayAttacks}
                </div>
              </div>
            </div>
          </div>

          {/* Unique IPs */}
          <div className="qa__stat-card qa__stat-card--cyan">
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(8, 145, 178, 0.05) 100%)'
            }}></div>
            <div style={{ position: 'relative', zIndex: 10 }}>
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🌐</span>
              </div>
              <h3 style={{
                fontSize: '0.8rem',
                color: '#94a3b8',
                marginBottom: '0.75rem',
                fontWeight: 500,
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}>
                Unique IPs
              </h3>
              {/* Number Card */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.5)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(100, 116, 139, 0.3)',
                borderRadius: '0.75rem',
                padding: '1.25rem',
                boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(6, 182, 212, 0.08)'
              }}>
                <div style={{
                  fontSize: '2.25rem',
                  fontWeight: 'bold',
                  color: '#f1f5f9',
                  textAlign: 'center',
                  textShadow: '0 0 20px rgba(6, 182, 212, 0.3)'
                }}>
                  {stats.uniqueIPs}
                </div>
              </div>
            </div>
          </div>

          {/* Top Threat Type */}
          <div className="qa__stat-card qa__stat-card--purple">
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(124, 58, 237, 0.05) 100%)'
            }}></div>
            <div style={{ position: 'relative', zIndex: 10 }}>
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🎯</span>
              </div>
              <h3 style={{
                fontSize: '0.8rem',
                color: '#94a3b8',
                marginBottom: '0.75rem',
                fontWeight: 500,
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}>
                Top Threat Type
              </h3>
              {/* Text Card */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.5)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(100, 116, 139, 0.3)',
                borderRadius: '0.75rem',
                padding: '1.25rem 1rem',
                boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(139, 92, 246, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '3.75rem'
              }}>
                <div style={{
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  color: '#f1f5f9',
                  textAlign: 'center',
                  lineHeight: 1.3,
                  textShadow: '0 0 20px rgba(139, 92, 246, 0.3)'
                }}>
                  {stats.topThreat}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Grid: Alerts Feed + Top Attack Origins */}
        <div className="qa__bottom-grid">
          {/* Live Alert Feed */}
          <div className="qa__panel">
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, rgba(100, 116, 139, 0.05) 0%, rgba(71, 85, 105, 0.05) 100%)'
            }}></div>
            
            <div style={{ position: 'relative', zIndex: 10 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '1.25rem'
              }}>
                <span style={{ fontSize: '1.25rem' }}>📡</span>
                <h2 style={{
                  fontSize: '1.125rem',
                  fontWeight: 'bold',
                  color: 'white'
                }}>
                  Live Alert Feed
                </h2>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#10b981',
                  animation: 'pulse 2s infinite'
                }}></div>
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                maxHeight: '400px',
                overflowY: 'auto'
              }}>
                {recentAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    style={{
                      background: alert.severity === 'critical' 
                        ? 'rgba(15, 23, 42, 0.5)' 
                        : 'rgba(15, 23, 42, 0.5)',
                      border: `1px solid ${alert.severity === 'critical' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(100, 116, 139, 0.3)'}`,
                      borderRadius: '0.5rem',
                      padding: '1rem 1.25rem',
                      transition: 'all 0.3s',
                      animation: alert.severity === 'critical' ? 'criticalPulse 3s infinite' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.5)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.3)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.5rem'
                    }}>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.375rem',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        background: `${getSeverityColor(alert.severity)}20`,
                        color: getSeverityColor(alert.severity),
                        border: `1px solid ${getSeverityColor(alert.severity)}30`
                      }}>
                        {alert.severity.toUpperCase()}
                      </span>
                      <span style={{
                        fontSize: '0.7rem',
                        color: '#94a3b8'
                      }}>
                        🕐 {alert.timestamp}
                      </span>
                    </div>
                    <div style={{
                      color: 'white',
                      fontWeight: 500,
                      marginBottom: '0.25rem',
                      fontSize: '0.95rem'
                    }}>
                      {alert.type}
                    </div>
                    <div style={{
                      fontSize: '0.8rem',
                      color: '#94a3b8',
                      fontFamily: 'monospace'
                    }}>
                      Source: {alert.sourceIp}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Attack Origins */}
          <div className="qa__panel">
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, rgba(100, 116, 139, 0.05) 0%, rgba(71, 85, 105, 0.05) 100%)'
            }}></div>
            
            <div style={{ position: 'relative', zIndex: 10 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '1.25rem'
              }}>
                <span style={{ fontSize: '1.25rem' }}>🌐</span>
                <h2 style={{
                  fontSize: '1.125rem',
                  fontWeight: 'bold',
                  color: 'white'
                }}>
                  Top Attack Origins
                </h2>
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                {topOrigins.map((origin, index) => (
                  <div
                    key={origin.country}
                    style={{
                      background: 'rgba(15, 23, 42, 0.5)',
                      border: '1px solid rgba(100, 116, 139, 0.3)',
                      borderRadius: '0.5rem',
                      padding: '1rem 1.25rem',
                      transition: 'all 0.3s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.5)';
                      e.currentTarget.style.transform = 'translateX(4px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.3)';
                      e.currentTarget.style.transform = 'translateX(0)';
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.6rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#64748b',
                          minWidth: '1.2rem'
                        }}>
                          {index === 0 ? '1st' : index === 1 ? '2nd' : index === 2 ? '3rd' : `${index + 1}th`}
                        </span>
                        <span style={{
                          color: '#f1f5f9',
                          fontWeight: 600,
                          fontSize: '0.9rem'
                        }}>
                          {origin.country}
                        </span>
                      </div>
                      <span style={{
                        fontSize: '0.95rem',
                        fontWeight: 'bold',
                        color: 'white'
                      }}>
                        {origin.attacks}
                      </span>
                    </div>
                    
                    {/* Progress Bar */}
                    <div style={{
                      width: '100%',
                      height: '5px',
                      background: 'rgba(100, 116, 139, 0.3)',
                      borderRadius: '3px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${origin.percentage}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)',
                        borderRadius: '3px',
                        transition: 'width 1s ease-out'
                      }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="qa__actions-grid">
          <button className="qa__action-btn qa__action-btn--red" onClick={() => onNavigate?.('alerts-ledger')}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem'
            }}>
              <div style={{
                padding: '0.5rem',
                borderRadius: '0.5rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)'
              }}>
                <span style={{ fontSize: '1.25rem' }}>🔔</span>
              </div>
              <span style={{
                color: 'white',
                fontWeight: 600,
                fontSize: '0.9rem'
              }}>
                Alerts & Investigation
              </span>
            </div>
          </button>

          <button className="qa__action-btn qa__action-btn--cyan" onClick={() => onNavigate?.('fleet')}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem'
            }}>
              <div style={{
                padding: '0.5rem',
                borderRadius: '0.5rem',
                background: 'rgba(6, 182, 212, 0.1)',
                border: '1px solid rgba(6, 182, 212, 0.2)'
              }}>
                <span style={{ fontSize: '1.25rem' }}>🎛️</span>
              </div>
              <span style={{
                color: 'white',
                fontWeight: 600,
                fontSize: '0.9rem'
              }}>
                Fleet Manager
              </span>
            </div>
          </button>

          <button className="qa__action-btn qa__action-btn--purple" onClick={() => onNavigate?.('intel')}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem'
            }}>
              <div style={{
                padding: '0.5rem',
                borderRadius: '0.5rem',
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.2)'
              }}>
                <span style={{ fontSize: '1.25rem' }}>🌍</span>
              </div>
              <span style={{
                color: 'white',
                fontWeight: 600,
                fontSize: '0.9rem'
              }}>
                Intel & Analytics
              </span>
            </div>
          </button>
        </div>

        </div> {/* End of dimmed content wrapper */}

        {/* Footer */}
        <div className="qa__footer">
          <div className="qa__footer-grid">
            <div>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: 'white',
                marginBottom: '0.5rem'
              }}>
                PhantomWall
              </h3>
              <p style={{
                fontSize: '0.875rem',
                color: '#94a3b8',
                lineHeight: '1.5'
              }}>
                Advanced cybersecurity monitoring and threat detection platform.
              </p>
            </div>

            <div>
              <h4 style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'white',
                marginBottom: '0.75rem'
              }}>
                Legal
              </h4>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <a href="#" style={{ fontSize: '0.875rem', color: '#94a3b8', textDecoration: 'none' }}>Privacy Policy</a>
                <a href="#" style={{ fontSize: '0.875rem', color: '#94a3b8', textDecoration: 'none' }}>Terms of Service</a>
              </div>
            </div>

            <div>
              <h4 style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'white',
                marginBottom: '0.75rem'
              }}>
                Connect
              </h4>
              <div style={{
                display: 'flex',
                gap: '1rem'
              }}>
                <a
                  href="https://github.com/Heero04/phantomwall/tree/main"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '1.25rem' }}
                  aria-label="PhantomWall GitHub repository"
                  title="GitHub Repository"
                >
                  💻
                </a>
                <a href="#" style={{ fontSize: '1.25rem' }} aria-label="Website link placeholder" title="Website link coming soon">🔗</a>
                <a href="#" style={{ fontSize: '1.25rem' }} aria-label="Email link placeholder" title="Email link coming soon">📧</a>
              </div>
            </div>
          </div>

          <div className="qa__footer-copy">
            <p style={{
              fontSize: '0.875rem',
              color: '#64748b'
            }}>
              © 2026 PhantomWall. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickAccess;
