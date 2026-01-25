import React, { useState } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { SecurityTimeline, TopSourcesChart, SeverityPieChart, AttackTrendChart } from './SecurityCharts';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

const DashboardV2 = () => {
  const [layouts, setLayouts] = useState({
    lg: [
      { i: 'metrics', x: 0, y: 0, w: 12, h: 2 },
      { i: 'timeline', x: 0, y: 2, w: 8, h: 4 },
      { i: 'alerts', x: 8, y: 2, w: 4, h: 4 },
      { i: 'topips', x: 0, y: 6, w: 6, h: 3 },
      { i: 'geomap', x: 6, y: 6, w: 6, h: 3 }
    ]
  });

  const onLayoutChange = (layout, layouts) => {
    setLayouts(layouts);
    // TODO: Save to localStorage or backend
  };

  return (
    <div style={{ padding: '20px', background: '#0d1117', minHeight: '100vh' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ color: '#fff', margin: 0 }}>🚀 PhantomWall Dashboard v2</h1>
        <p style={{ color: '#888', margin: '5px 0 0 0' }}>
          Power BI-style Security Analytics • Drag & Drop Widgets
        </p>
      </div>

      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        onLayoutChange={onLayoutChange}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={60}
        isDraggable={true}
        isResizable={true}
        style={{ minHeight: 'calc(100vh - 100px)' }}
      >
        {/* KPI Metrics Row */}
        <div key="metrics" style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '15px' }}>
          <h3 style={{ color: '#fff', margin: '0 0 10px 0' }}>📊 Security Metrics</h3>
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#ff6b6b', fontSize: '24px', fontWeight: 'bold' }}>156</div>
              <div style={{ color: '#888', fontSize: '12px' }}>Critical Alerts</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#4ecdc4', fontSize: '24px', fontWeight: 'bold' }}>2.3K</div>
              <div style={{ color: '#888', fontSize: '12px' }}>Total Events</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#45b7d1', fontSize: '24px', fontWeight: 'bold' }}>89%</div>
              <div style={{ color: '#888', fontSize: '12px' }}>Blocked</div>
            </div>
          </div>
        </div>

        {/* Timeline Chart */}
        <div key="timeline" style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '15px' }}>
          <h3 style={{ color: '#fff', margin: '0 0 10px 0' }}>📈 Attack Timeline</h3>
          <div style={{ height: 'calc(100% - 40px)' }}>
            <SecurityTimeline />
          </div>
        </div>

        {/* Recent Alerts */}
        <div key="alerts" style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '15px', overflow: 'auto' }}>
          <h3 style={{ color: '#fff', margin: '0 0 10px 0' }}>🚨 Alert Severity</h3>
          <div style={{ height: 'calc(100% - 40px)' }}>
            <SeverityPieChart />
          </div>
        </div>

        {/* Top IPs */}
        <div key="topips" style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '15px' }}>
          <h3 style={{ color: '#fff', margin: '0 0 10px 0' }}>🎯 Top Attack Sources</h3>
          <div style={{ height: 'calc(100% - 40px)' }}>
            <TopSourcesChart />
          </div>
        </div>

        {/* Attack Trends */}
        <div key="geomap" style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '15px' }}>
          <h3 style={{ color: '#fff', margin: '0 0 10px 0' }}>📈 Attack Trends</h3>
          <div style={{ height: 'calc(100% - 40px)' }}>
            <AttackTrendChart />
          </div>
        </div>
      </ResponsiveGridLayout>
    </div>
  );
};

export default DashboardV2;