import React from 'react';
import AlertsTable from './components/AlertsTable';

function AlertsPage() {
  return (
    <div className="page">
      <header className="page__header">
        <h2>Security Alerts</h2>
        <p>Real-time Suricata IDS events from your honeypot.</p>
      </header>
      <AlertsTable />
    </div>
  );
}

export default AlertsPage;
