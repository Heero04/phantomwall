import React, { useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';

// Register all Community features
ModuleRegistry.registerModules([AllCommunityModule]);

const SecurityDataTable = () => {
  // Security alert data
  const [rowData] = useState([
    { 
      timestamp: '2024-11-02 14:23:15', 
      sourceIP: '192.168.1.100', 
      alertType: 'SQL Injection', 
      severity: 'Critical', 
      target: '/api/users', 
      blocked: true 
    },
    { 
      timestamp: '2024-11-02 14:22:45', 
      sourceIP: '10.0.0.55', 
      alertType: 'Port Scan', 
      severity: 'Medium', 
      target: 'Port 22', 
      blocked: true 
    },
    { 
      timestamp: '2024-11-02 14:21:30', 
      sourceIP: '172.16.0.25', 
      alertType: 'Malware Detection', 
      severity: 'High', 
      target: '/uploads', 
      blocked: true 
    },
    { 
      timestamp: '2024-11-02 14:20:12', 
      sourceIP: '203.0.113.15', 
      alertType: 'Brute Force', 
      severity: 'High', 
      target: '/login', 
      blocked: false 
    },
    { 
      timestamp: '2024-11-02 14:19:05', 
      sourceIP: '198.51.100.42', 
      alertType: 'XSS Attempt', 
      severity: 'Medium', 
      target: '/search', 
      blocked: true 
    },
    { 
      timestamp: '2024-11-02 14:18:33', 
      sourceIP: '192.0.2.88', 
      alertType: 'Info Gathering', 
      severity: 'Low', 
      target: '/robots.txt', 
      blocked: false 
    }
  ]);

  // Column definitions
  const [colDefs] = useState([
    { field: 'timestamp', headerName: 'Time', sortable: true, filter: true, width: 150 },
    { field: 'sourceIP', headerName: 'Source IP', sortable: true, filter: true, width: 130 },
    { field: 'alertType', headerName: 'Alert Type', sortable: true, filter: true, width: 140 },
    { 
      field: 'severity', 
      headerName: 'Severity', 
      sortable: true, 
      filter: true, 
      width: 100,
      cellRenderer: (params) => {
        const severity = params.value;
        const colors = {
          'Critical': '#ff4757',
          'High': '#ff6b35',
          'Medium': '#ffa502',
          'Low': '#26de81'
        };
        const color = colors[severity] || '#888';
        return React.createElement('span', {
          style: { color: color, fontWeight: 'bold' }
        }, `● ${severity}`);
      }
    },
    { field: 'target', headerName: 'Target', sortable: true, filter: true, width: 120 },
    { 
      field: 'blocked', 
      headerName: 'Status', 
      sortable: true, 
      filter: true, 
      width: 100,
      cellRenderer: (params) => {
        const isBlocked = params.value;
        const color = isBlocked ? '#26de81' : '#ff4757';
        const text = isBlocked ? '✓ Blocked' : '✗ Allowed';
        return React.createElement('span', {
          style: { color: color }
        }, text);
      }
    }
  ]);

  return (
    <div style={{ height: '100vh', width: '100%', background: '#0d1117', padding: '20px' }}>
      <h2 style={{ color: '#fff', marginBottom: '20px' }}>🔍 Security Alert Data (AG Grid)</h2>
      
      {/* AG Grid container with fixed height */}
      <div style={{ height: 500, width: '100%' }}>
        <AgGridReact
          rowData={rowData}
          columnDefs={colDefs}
          pagination={true}
          paginationPageSize={10}
          animateRows={true}
        />
      </div>
    </div>
  );
};

export default SecurityDataTable;