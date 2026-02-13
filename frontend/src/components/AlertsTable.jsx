import React, { useState, useEffect } from 'react';
import './AlertsTable.css';

const API_URL = import.meta.env.VITE_SURICATA_API_URL;

const AlertsTable = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    severity: 'all',
    timeRange: '1h',
    sourceIP: '',
    alertType: 'all'
  });

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [filters]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      if (!API_URL) {
        setError('API URL not configured. Set VITE_SURICATA_API_URL in .env');
        return;
      }

      const response = await fetch(`${API_URL}/events`);
      const data = await response.json();

      // Flatten the API response — items may be nested under date groups
      let allItems = [];
      if (data.items) {
        allItems = data.items;
      } else if (Array.isArray(data)) {
        allItems = data;
      } else if (data.event_date) {
        // Single date group response
        allItems = data.items || [];
      }

      // Map API fields to AlertsTable expected shape
      const mapped = allItems.map(item => ({
        id: item.event_id || item.flow_id?.toString() || Math.random().toString(),
        timestamp: item.event_time || item.suricata?.timestamp || '',
        severity: item.severity || item.suricata?.alert?.severity || 3,
        sourceIP: item.src_ip || item.suricata?.src_ip || '',
        destIP: item.dest_ip || item.suricata?.dest_ip || '',
        signature: item.signature || item.suricata?.alert?.signature || 'Unknown',
        category: item.category || item.suricata?.alert?.category || 'unknown',
        action: item.suricata?.alert?.action || 'alerted',
        flow_id: item.flow_id || 0,
        proto: item.proto || item.suricata?.proto || '',
        src_port: item.src_port || item.suricata?.src_port || 0,
        dest_port: item.dest_port || item.suricata?.dest_port || 0,
      }));

      const filteredData = filterAlerts(mapped);
      setAlerts(filteredData);
      setError(null);
    } catch (err) {
      setError('Failed to fetch alerts: ' + err.message);
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterAlerts = (alertsData) => {
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
    return new Date(timestamp).toLocaleString();
  };

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  if (loading && alerts.length === 0) {
    return (
      <div className="alerts-table-container">
        <div className="loading">Loading alerts...</div>
      </div>
    );
  }

  return (
    <div className="alerts-table-container">
      <div className="alerts-header">
        <h3>🚨 Security Alerts</h3>
        <div className="alerts-meta">
          <span className="alert-count">{alerts.length} alerts</span>
          {loading && <span className="refreshing">Refreshing...</span>}
        </div>
      </div>

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

        <button className="refresh-btn" onClick={fetchAlerts} disabled={loading}>
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="error-message">
          ⚠️ {error}
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
                  No alerts found for the selected filters
                </td>
              </tr>
            ) : (
              alerts.map(alert => (
                <tr key={alert.id} className={`alert-row ${getSeverityColor(alert.severity)}`}>
                  <td className="timestamp">{formatTimestamp(alert.timestamp)}</td>
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
    </div>
  );
};

export default AlertsTable;