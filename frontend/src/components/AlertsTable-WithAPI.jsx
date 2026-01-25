import React, { useState, useEffect } from 'react';
import './AlertsTable.css';

const AlertsTable = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    severity: 'all',
    timeRange: '1h',
    sourceIP: '',
    alertType: 'all'
  });

  // API configuration
  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
  const USE_MOCK_DATA = process.env.REACT_APP_USE_MOCK_DATA === 'true';

  // Mock data for development
  const mockAlerts = [
    {
      id: '1',
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      severity: 1,
      sourceIP: '192.168.1.100',
      destIP: '10.0.0.5',
      signature: 'ET TROJAN Suspicious Outbound Connection',
      category: 'trojan',
      action: 'blocked',
      flow_id: 12345
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      severity: 2,
      sourceIP: '203.0.113.45',
      destIP: '10.0.0.5',
      signature: 'ET SCAN Port Scan Detected',
      category: 'scan',
      action: 'alerted',
      flow_id: 12346
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      severity: 3,
      sourceIP: '198.51.100.22',
      destIP: '10.0.0.8',
      signature: 'ET INFO Generic HTTP Request',
      category: 'info',
      action: 'logged',
      flow_id: 12347
    }
  ];

  useEffect(() => {
    fetchAlerts();
    fetchStats();
    
    // Set up auto-refresh
    const interval = setInterval(() => {
      fetchAlerts();
      fetchStats();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, [filters]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      
      if (USE_MOCK_DATA) {
        // Use mock data during development
        const filteredData = filterMockAlerts(mockAlerts);
        setAlerts(filteredData);
        setError(null);
        return;
      }

      // Make API call to backend
      const queryParams = new URLSearchParams({
        ...filters,
        limit: '50'
      });

      const response = await fetch(`${API_BASE}/alerts?${queryParams}`);
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setAlerts(data.alerts);
        setError(null);
      } else {
        throw new Error(data.message || 'Failed to fetch alerts');
      }

    } catch (err) {
      console.error('Error fetching alerts:', err);
      setError(`Failed to fetch alerts: ${err.message}`);
      
      // Fallback to mock data on error
      if (!USE_MOCK_DATA) {
        console.log('Falling back to mock data');
        const filteredData = filterMockAlerts(mockAlerts);
        setAlerts(filteredData);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      if (USE_MOCK_DATA) {
        // Mock stats
        setStats({
          total: mockAlerts.length,
          critical: 1,
          high: 1,
          medium: 1,
          low: 0
        });
        return;
      }

      const response = await fetch(`${API_BASE}/alerts/stats?timeRange=${filters.timeRange}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const filterMockAlerts = (alertsData) => {
    return alertsData.filter(alert => {
      // Severity filter
      if (filters.severity !== 'all' && alert.severity !== parseInt(filters.severity)) {
        return false;
      }

      // Time range filter
      const alertTime = new Date(alert.timestamp);
      const now = new Date();
      const timeRangeMs = getTimeRangeMs(filters.timeRange);
      if (now - alertTime > timeRangeMs) {
        return false;
      }

      // Source IP filter
      if (filters.sourceIP && !alert.sourceIP.includes(filters.sourceIP)) {
        return false;
      }

      // Alert type filter
      if (filters.alertType !== 'all' && alert.category !== filters.alertType) {
        return false;
      }

      return true;
    });
  };

  const getTimeRangeMs = (range) => {
    switch (range) {
      case '15m': return 15 * 60 * 1000;
      case '1h': return 60 * 60 * 1000;
      case '6h': return 6 * 60 * 60 * 1000;
      case '24h': return 24 * 60 * 60 * 1000;
      case '7d': return 7 * 24 * 60 * 60 * 1000;
      default: return 60 * 60 * 1000;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 1: return 'severity-critical';
      case 2: return 'severity-high';
      case 3: return 'severity-medium';
      default: return 'severity-low';
    }
  };

  const getSeverityText = (severity) => {
    switch (severity) {
      case 1: return 'Critical';
      case 2: return 'High';
      case 3: return 'Medium';
      default: return 'Low';
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const getRelativeTime = (timestamp) => {
    const now = new Date();
    const alertTime = new Date(timestamp);
    const diffMs = now - alertTime;
    
    if (diffMs < 60 * 1000) return 'Just now';
    if (diffMs < 60 * 60 * 1000) return `${Math.floor(diffMs / (60 * 1000))}m ago`;
    if (diffMs < 24 * 60 * 60 * 1000) return `${Math.floor(diffMs / (60 * 60 * 1000))}h ago`;
    return `${Math.floor(diffMs / (24 * 60 * 60 * 1000))}d ago`;
  };

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  const handleRefresh = () => {
    fetchAlerts();
    fetchStats();
  };

  if (loading && alerts.length === 0) {
    return (
      <div className="alerts-table-container">
        <div className="loading">
          <div>🔄</div>
          <div>Loading alerts...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="alerts-table-container">
      <div className="alerts-header">
        <h3>🚨 Security Alerts</h3>
        <div className="alerts-meta">
          <span className="alert-count">{alerts.length} alerts</span>
          {USE_MOCK_DATA && <span className="mock-indicator">DEMO MODE</span>}
          {loading && <span className="refreshing">Refreshing...</span>}
        </div>
      </div>

      {/* Alert Statistics */}
      {stats && (
        <div className="alerts-stats">
          <div className="stat-item">
            <span className="stat-label">Total</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat-item severity-critical">
            <span className="stat-label">Critical</span>
            <span className="stat-value">{stats.critical}</span>
          </div>
          <div className="stat-item severity-high">
            <span className="stat-label">High</span>
            <span className="stat-value">{stats.high}</span>
          </div>
          <div className="stat-item severity-medium">
            <span className="stat-label">Medium</span>
            <span className="stat-value">{stats.medium}</span>
          </div>
          <div className="stat-item severity-low">
            <span className="stat-label">Low</span>
            <span className="stat-value">{stats.low}</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="alerts-filters">
        <div className="filter-group">
          <label>Severity:</label>
          <select 
            value={filters.severity} 
            onChange={(e) => handleFilterChange('severity', e.target.value)}
          >
            <option value="all">All</option>
            <option value="1">Critical</option>
            <option value="2">High</option>
            <option value="3">Medium</option>
            <option value="4">Low</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Time Range:</label>
          <select 
            value={filters.timeRange} 
            onChange={(e) => handleFilterChange('timeRange', e.target.value)}
          >
            <option value="15m">Last 15 minutes</option>
            <option value="1h">Last hour</option>
            <option value="6h">Last 6 hours</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Source IP:</label>
          <input 
            type="text" 
            placeholder="Filter by IP..."
            value={filters.sourceIP}
            onChange={(e) => handleFilterChange('sourceIP', e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>Category:</label>
          <select 
            value={filters.alertType} 
            onChange={(e) => handleFilterChange('alertType', e.target.value)}
          >
            <option value="all">All</option>
            <option value="trojan">Trojan</option>
            <option value="scan">Scan</option>
            <option value="exploit">Exploit</option>
            <option value="malware">Malware</option>
            <option value="info">Info</option>
          </select>
        </div>

        <button className="refresh-btn" onClick={handleRefresh} disabled={loading}>
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="error-message">
          ⚠️ {error}
          {!USE_MOCK_DATA && (
            <div style={{ fontSize: '0.8rem', marginTop: '5px' }}>
              Using fallback data. Check your backend connection.
            </div>
          )}
        </div>
      )}

      {/* Alerts Table */}
      <div className="alerts-table-wrapper">
        <table className="alerts-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Severity</th>
              <th>Source IP</th>
              <th>Dest IP</th>
              <th>Alert</th>
              <th>Category</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 ? (
              <tr>
                <td colSpan="7" className="no-alerts">
                  {loading ? 'Loading alerts...' : 'No alerts found for the selected filters'}
                </td>
              </tr>
            ) : (
              alerts.map(alert => (
                <tr key={alert.id} className={`alert-row ${getSeverityColor(alert.severity)}`}>
                  <td className="timestamp" title={formatTimestamp(alert.timestamp)}>
                    <div>{getRelativeTime(alert.timestamp)}</div>
                    <div className="timestamp-full">{formatTimestamp(alert.timestamp)}</div>
                  </td>
                  <td className={`severity ${getSeverityColor(alert.severity)}`}>
                    {getSeverityText(alert.severity)}
                  </td>
                  <td className="source-ip">{alert.sourceIP}</td>
                  <td className="dest-ip">{alert.destIP}</td>
                  <td className="signature" title={alert.signature}>
                    {alert.signature}
                  </td>
                  <td className="category">{alert.category}</td>
                  <td className="action">{alert.action}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {alerts.length > 0 && (
        <div className="alerts-footer">
          <span>Showing {alerts.length} alerts • Auto-refresh every 30s</span>
          {USE_MOCK_DATA && (
            <span className="mock-note">
              Demo mode - Set REACT_APP_USE_MOCK_DATA=false to use real data
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default AlertsTable;