import React from 'react';
import AlertsTable from './components/AlertsTable';

// Simple standalone alerts page for testing
function AlertsPage() {
  return (
    <div style={{ padding: '20px', background: '#0d1117', minHeight: '100vh' }}>
      <h1 style={{ color: '#fff', marginBottom: '20px' }}>🚨 Security Alerts</h1>
      <AlertsTable />
    </div>
  );
}

export default AlertsPage;