import React, { useState, useEffect } from 'react';
import './styles.css';

const API_URL = import.meta.env.VITE_SURICATA_API_URL;

const QuickAccess = () => {
  const [honeypotStatus, setHoneypotStatus] = useState('running');
  const [isStarting, setIsStarting] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

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

      // Fetch alerts and metrics in parallel
      const [alertsRes, metricsRes] = await Promise.all([
        fetch(`${API_URL}/events`),
        fetch(`${API_URL}/metrics`)
      ]);

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData.items || []);
      }

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setMetrics(metricsData);
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

  // Fleet Status
  const fleetData = {
    active: honeypotStatus === 'running' ? 5 : 0,
    total: 5,
    sentiment: honeypotStatus === 'running' ? 'operational' : 'suspended'
  };

  const getFleetStatusText = () => {
    if (fleetData.sentiment === 'suspended') return 'System Suspended';
    if (fleetData.active === fleetData.total) return 'All systems operational';
    if (fleetData.active === 0) return 'Critical: All traps offline';
    return `Degraded: ${fleetData.total - fleetData.active} trap(s) offline`;
  };

  const getFleetStatusColor = () => {
    if (fleetData.sentiment === 'suspended') return '#f59e0b';
    if (fleetData.active === fleetData.total) return '#10b981';
    if (fleetData.active === 0) return '#ef4444';
    return '#f59e0b';
  };

  const handleToggleHoneypot = async () => {
    setIsStarting(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setHoneypotStatus(honeypotStatus === 'running' ? 'stopped' : 'running');
    setIsStarting(false);
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
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      padding: '3rem 4rem'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Honeypot Status Card */}
        <div style={{
          background: 'rgba(30, 41, 59, 0.6)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(100, 116, 139, 0.3)',
          borderRadius: '1rem',
          padding: '2.5rem',
          marginBottom: '2.5rem',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)'
          }}></div>
          
          <div style={{ position: 'relative', zIndex: 10 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '2.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: '3rem',
                  height: '3rem',
                  background: honeypotStatus === 'running' 
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  boxShadow: honeypotStatus === 'running' ? '0 0 20px rgba(16, 185, 129, 0.4)' : 'none'
                }}>
                  🛡️
                </div>
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: 'white',
                  marginBottom: '0.25rem'
                }}>
                  Fleet Status
                </h2>
                <div style={{
                  fontSize: '0.85rem',
                  color: getFleetStatusColor(),
                  fontWeight: 500
                }}>
                  {getFleetStatusText()}
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {/* Status Pips */}
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
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
                
                <span style={{
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: getFleetStatusColor(),
                  textShadow: honeypotStatus === 'running' ? '0 0 10px rgba(16, 185, 129, 0.3)' : 'none'
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

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '2rem'
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
                    background: honeypotStatus === 'running' 
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}>
                    {honeypotStatus === 'running' ? '24h 17m' : '00h 00m'}
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
                    background: honeypotStatus === 'running'
                      ? 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'
                      : 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}>
                    {honeypotStatus === 'running' ? '8' : '0'}
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
                    background: honeypotStatus === 'running'
                      ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
                      : 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}>
                    {honeypotStatus === 'running' ? '247' : '0'}
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
        <div style={{ position: 'relative' }}>
          {/* System Paused Overlay */}
          {honeypotStatus === 'stopped' && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(4px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '1rem',
              border: '2px dashed rgba(239, 68, 68, 0.3)'
            }}>
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
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '2rem',
          marginBottom: '2.5rem'
        }}>
          {/* Attacks Today */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(100, 116, 139, 0.3)',
            borderRadius: '1rem',
            padding: '2rem',
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.3s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.3)'}
          >
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
                  color: 'white',
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>
                  {stats.todayAttacks}
                </div>
              </div>
            </div>
          </div>

          {/* Unique IPs */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(100, 116, 139, 0.3)',
            borderRadius: '1rem',
            padding: '2rem',
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.3s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.5)'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.3)'}
          >
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
                  color: 'white',
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>
                  {stats.uniqueIPs}
                </div>
              </div>
            </div>
          </div>

          {/* Top Threat Type */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(100, 116, 139, 0.3)',
            borderRadius: '1rem',
            padding: '2rem',
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.3s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.3)'}
          >
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
                padding: '0.75rem 1rem',
                boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(139, 92, 246, 0.08)'
              }}>
                <div style={{
                  fontSize: '1.125rem',
                  fontWeight: 'bold',
                  color: 'white',
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>
                  {stats.topThreat}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Grid: Alerts Feed + Top Attack Origins */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '2rem',
          marginBottom: '2.5rem'
        }}>
          {/* Live Alert Feed */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(100, 116, 139, 0.3)',
            borderRadius: '1rem',
            padding: '2rem',
            position: 'relative',
            overflow: 'hidden'
          }}>
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
                marginBottom: '2rem'
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
          <div style={{
            background: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(100, 116, 139, 0.3)',
            borderRadius: '1rem',
            padding: '2rem',
            position: 'relative',
            overflow: 'hidden'
          }}>
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
                marginBottom: '2rem'
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
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1.5rem',
          marginBottom: '2.5rem'
        }}>
          <button
            style={{
              background: 'rgba(30, 41, 59, 0.6)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(100, 116, 139, 0.3)',
              borderRadius: '1rem',
              padding: '1.5rem',
              cursor: 'pointer',
              transition: 'all 0.3s',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.5)';
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(6, 182, 212, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.3)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
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
                <span style={{ fontSize: '1.25rem' }}>🎯</span>
              </div>
              <span style={{
                color: 'white',
                fontWeight: 600,
                fontSize: '0.9rem'
              }}>
                Threat Intelligence
              </span>
            </div>
          </button>

          <button
            style={{
              background: 'rgba(30, 41, 59, 0.6)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(100, 116, 139, 0.3)',
              borderRadius: '1rem',
              padding: '1.5rem',
              cursor: 'pointer',
              transition: 'all 0.3s',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(239, 68, 68, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.3)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
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
                <span style={{ fontSize: '1.25rem' }}>🗺️</span>
              </div>
              <span style={{
                color: 'white',
                fontWeight: 600,
                fontSize: '0.9rem'
              }}>
                Live Attack Map
              </span>
            </div>
          </button>

          <button
            style={{
              background: 'rgba(30, 41, 59, 0.6)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(100, 116, 139, 0.3)',
              borderRadius: '1rem',
              padding: '1.5rem',
              cursor: 'pointer',
              transition: 'all 0.3s',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(139, 92, 246, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.3)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
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
                <span style={{ fontSize: '1.25rem' }}>🛡️</span>
              </div>
              <span style={{
                color: 'white',
                fontWeight: 600,
                fontSize: '0.9rem'
              }}>
                Security Posture
              </span>
            </div>
          </button>
        </div>

        </div> {/* End of dimmed content wrapper */}

        {/* Footer */}
        <div style={{
          borderTop: '1px solid rgba(100, 116, 139, 0.2)',
          paddingTop: '2rem',
          marginTop: '2rem'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '2rem',
            marginBottom: '2rem'
          }}>
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
                <a href="#" style={{ fontSize: '1.25rem' }}>💻</a>
                <a href="#" style={{ fontSize: '1.25rem' }}>🔗</a>
                <a href="#" style={{ fontSize: '1.25rem' }}>📧</a>
              </div>
            </div>
          </div>

          <div style={{
            textAlign: 'center',
            paddingTop: '1.5rem',
            borderTop: '1px solid rgba(100, 116, 139, 0.2)'
          }}>
            <p style={{
              fontSize: '0.875rem',
              color: '#64748b'
            }}>
              © 2026 PhantomWall. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        
        @keyframes criticalPulse {
          0%, 100% {
            background: rgba(15, 23, 42, 0.5);
            box-shadow: 0 0 0 rgba(239, 68, 68, 0);
          }
          50% {
            background: rgba(239, 68, 68, 0.08);
            box-shadow: 0 0 20px rgba(239, 68, 68, 0.15);
          }
        }
      `}</style>
    </div>
  );
};

export default QuickAccess;
