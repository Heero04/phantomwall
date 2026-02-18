import React, { useState } from 'react';
import { DndContext, DragOverlay, closestCenter, useDraggable, useDroppable } from '@dnd-kit/core';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import L from 'leaflet';

// Fix for default markers in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const ResponsiveGridLayout = WidthProvider(Responsive);

// Mock data for all visualizations
const mockSecurityData = [
  { timestamp: '2025-11-03 14:00', sourceIp: '45.129.14.23', attackType: 'DDoS Attack', severity: 'Critical', attackCount: 156, bytesTransferred: 2048576, protocol: 'TCP', latitude: 40.7128, longitude: -74.0060, country: 'United States', city: 'New York' },
  { timestamp: '2025-11-03 14:05', sourceIp: '185.220.101.42', attackType: 'Malware', severity: 'High', attackCount: 89, bytesTransferred: 1024000, protocol: 'HTTP', latitude: 51.5074, longitude: -0.1278, country: 'United Kingdom', city: 'London' },
  { timestamp: '2025-11-03 14:10', sourceIp: '202.12.27.33', attackType: 'Phishing', severity: 'Medium', attackCount: 234, bytesTransferred: 512000, protocol: 'HTTPS', latitude: 35.6762, longitude: 139.6503, country: 'Japan', city: 'Tokyo' },
  { timestamp: '2025-11-03 14:15', sourceIp: '94.102.49.190', attackType: 'Brute Force', severity: 'High', attackCount: 123, bytesTransferred: 768000, protocol: 'SSH', latitude: 37.7749, longitude: -122.4194, country: 'United States', city: 'San Francisco' },
  { timestamp: '2025-11-03 14:20', sourceIp: '188.166.217.2', attackType: 'SQL Injection', severity: 'Critical', attackCount: 67, bytesTransferred: 1536000, protocol: 'HTTP', latitude: 52.5200, longitude: 13.4050, country: 'Germany', city: 'Berlin' },
  { timestamp: '2025-11-03 14:25', sourceIp: '121.46.124.85', attackType: 'Port Scan', severity: 'Low', attackCount: 45, bytesTransferred: 256000, protocol: 'TCP', latitude: 39.9042, longitude: 116.4074, country: 'China', city: 'Beijing' }
];

// Draggable Widget Item in Gallery
const DraggableWidgetItem = ({ widget }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `gallery-${widget.id}`,
    data: { widget }
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
    backgroundColor: '#21262d',
    border: '1px solid #30363d',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '12px',
    transition: 'all 0.2s ease'
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onMouseEnter={(e) => {
        if (!isDragging) {
          e.target.style.borderColor = '#58a6ff';
          e.target.style.backgroundColor = '#161b22';
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragging) {
          e.target.style.borderColor = '#30363d';
          e.target.style.backgroundColor = '#21262d';
        }
      }}
    >
      <div style={{ fontSize: '20px', marginBottom: '8px', textAlign: 'center' }}>
        {widget.icon}
      </div>
      <div style={{ color: '#e6edf3', fontWeight: 'bold', fontSize: '13px', textAlign: 'center', marginBottom: '4px' }}>
        {widget.name}
      </div>
      <div style={{ color: '#8b949e', fontSize: '11px', textAlign: 'center' }}>
        {widget.description}
      </div>
    </div>
  );
};

// Widget Gallery Component (Right Sidebar)
const WidgetGallery = () => {
  const widgets = [
    { 
      id: 'bar-chart', 
      name: 'Bar Chart', 
      icon: '📊', 
      description: 'Compare categories with bars',
      component: 'BarChartWidget'
    },
    { 
      id: 'line-chart', 
      name: 'Line Chart', 
      icon: '📈', 
      description: 'Show trends over time',
      component: 'LineChartWidget'
    },
    { 
      id: 'pie-chart', 
      name: 'Pie Chart', 
      icon: '🥧', 
      description: 'Show proportions and percentages',
      component: 'PieChartWidget'
    },
    { 
      id: 'map-chart', 
      name: 'Geographic Map', 
      icon: '🗺️', 
      description: 'Visualize data on world map',
      component: 'MapWidget'
    },
    { 
      id: 'data-table', 
      name: 'Data Table', 
      icon: '📋', 
      description: 'Display data in tabular format',
      component: 'DataTableWidget'
    },
    { 
      id: 'metric-card', 
      name: 'Metric Card', 
      icon: '📱', 
      description: 'Show key performance indicators',
      component: 'MetricCardWidget'
    }
  ];

  return (
    <div style={{
      backgroundColor: '#21262d',
      border: '1px solid #30363d',
      borderRadius: '8px',
      padding: '15px',
      height: '100%'
    }}>
      <h3 style={{ 
        color: '#e6edf3', 
        marginBottom: '15px', 
        fontSize: '16px',
        textAlign: 'center'
      }}>
        🧩 Widget Gallery
      </h3>
      <div style={{ color: '#8b949e', fontSize: '12px', textAlign: 'center', marginBottom: '20px' }}>
        Drag widgets to canvas
      </div>
      
      {widgets.map(widget => (
        <DraggableWidgetItem key={widget.id} widget={widget} />
      ))}
    </div>
  );
};

// Canvas Drop Zone
const CanvasDropZone = ({ children }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'dashboard-canvas'
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        minHeight: '600px',
        backgroundColor: isOver ? '#0d1a1a' : '#0d1117',
        border: isOver ? '2px dashed #58a6ff' : '2px dashed #30363d',
        borderRadius: '8px',
        padding: '20px',
        position: 'relative',
        transition: 'all 0.2s ease'
      }}
    >
      {children}
    </div>
  );
};

// Configuration Panel
const ConfigurationPanel = ({ selectedWidget, onUpdateWidget, onClose, onDeleteWidget }) => {
  if (!selectedWidget) return null;

  const [config, setConfig] = useState(selectedWidget.config || {
    title: selectedWidget.component.replace('Widget', ' Chart'),
    xAxis: 'attackType',
    yAxis: 'attackCount',
    colorBy: 'severity'
  });

  const availableFields = [
    'attackType', 'severity', 'attackCount', 'bytesTransferred', 
    'protocol', 'country', 'city', 'sourceIp', 'timestamp'
  ];

  const handleConfigChange = (key, value) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    onUpdateWidget(selectedWidget.i, newConfig);
  };

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '320px',
      width: '300px',
      backgroundColor: '#21262d',
      border: '1px solid #30363d',
      borderRadius: '8px',
      padding: '20px',
      zIndex: 1000,
      maxHeight: '80vh',
      overflowY: 'auto'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h3 style={{ color: '#e6edf3', margin: 0 }}>⚙️ Configure Widget</h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#8b949e',
            fontSize: '18px',
            cursor: 'pointer'
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ color: '#e6edf3', display: 'block', marginBottom: '5px' }}>
          Widget Title
        </label>
        <input
          type="text"
          value={config.title}
          onChange={(e) => handleConfigChange('title', e.target.value)}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: '#0d1117',
            border: '1px solid #30363d',
            borderRadius: '4px',
            color: '#e6edf3'
          }}
        />
      </div>

      {selectedWidget.component === 'BarChartWidget' && (
        <>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ color: '#e6edf3', display: 'block', marginBottom: '5px' }}>
              X-Axis Field
            </label>
            <select
              value={config.xAxis}
              onChange={(e) => handleConfigChange('xAxis', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: '#0d1117',
                border: '1px solid #30363d',
                borderRadius: '4px',
                color: '#e6edf3'
              }}
            >
              {availableFields.map(field => (
                <option key={field} value={field}>{field}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ color: '#e6edf3', display: 'block', marginBottom: '5px' }}>
              Y-Axis Field
            </label>
            <select
              value={config.yAxis}
              onChange={(e) => handleConfigChange('yAxis', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: '#0d1117',
                border: '1px solid #30363d',
                borderRadius: '4px',
                color: '#e6edf3'
              }}
            >
              {availableFields.filter(f => f === 'attackCount' || f === 'bytesTransferred').map(field => (
                <option key={field} value={field}>{field}</option>
              ))}
            </select>
          </div>
        </>
      )}

      <div style={{ marginBottom: '15px' }}>
        <label style={{ color: '#e6edf3', display: 'block', marginBottom: '5px' }}>
          Color By
        </label>
        <select
          value={config.colorBy}
          onChange={(e) => handleConfigChange('colorBy', e.target.value)}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: '#0d1117',
            border: '1px solid #30363d',
            borderRadius: '4px',
            color: '#e6edf3'
          }}
        >
          {availableFields.map(field => (
            <option key={field} value={field}>{field}</option>
          ))}
        </select>
      </div>

      <div style={{
        padding: '15px',
        backgroundColor: '#0d1117',
        borderRadius: '6px',
        marginTop: '20px'
      }}>
        <h4 style={{ color: '#e6edf3', marginBottom: '10px' }}>Widget Info</h4>
        <div style={{ color: '#8b949e', fontSize: '12px' }}>
          <div>Type: {selectedWidget.component}</div>
          <div>Position: {selectedWidget.x}, {selectedWidget.y}</div>
          <div>Size: {selectedWidget.w} x {selectedWidget.h}</div>
        </div>
      </div>

      <button
        onClick={() => onDeleteWidget(selectedWidget.i)}
        style={{
          width: '100%',
          marginTop: '20px',
          padding: '10px',
          backgroundColor: '#dc2626',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer'
        }}
      >
        🗑️ Delete Widget
      </button>
    </div>
  );
};

// Individual Widget Components with configuration support
const BarChartWidget = ({ data = mockSecurityData, config = {}, isSelected, onClick }) => {
  const xField = config.xAxis || 'attackType';
  const yField = config.yAxis || 'attackCount';
  const title = config.title || 'Bar Chart';

  const chartData = data.reduce((acc, item) => {
    const existing = acc.find(d => d[xField] === item[xField]);
    if (existing) {
      existing[yField] = (existing[yField] || 0) + (item[yField] || 0);
    } else {
      acc.push({ [xField]: item[xField], [yField]: item[yField] || 0 });
    }
    return acc;
  }, []);

  return (
    <div 
      style={{ 
        height: '100%', 
        padding: '10px',
        border: isSelected ? '2px solid #58a6ff' : 'none',
        borderRadius: '6px',
        cursor: 'pointer'
      }}
      onClick={onClick}
    >
      <h4 style={{ color: '#e6edf3', marginBottom: '10px' }}>{title}</h4>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
          <XAxis dataKey={xField} stroke="#8b949e" fontSize={12} />
          <YAxis stroke="#8b949e" fontSize={12} />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#21262d', 
              border: '1px solid #30363d',
              borderRadius: '6px',
              color: '#e6edf3'
            }} 
          />
          <Bar dataKey={yField} fill="#58a6ff" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const LineChartWidget = ({ data = mockSecurityData, config = {}, isSelected, onClick }) => {
  const title = config.title || 'Line Chart';
  
  const chartData = data.map(item => ({
    time: item.timestamp.split(' ')[1],
    attacks: item.attackCount
  }));

  return (
    <div 
      style={{ 
        height: '100%', 
        padding: '10px',
        border: isSelected ? '2px solid #58a6ff' : 'none',
        borderRadius: '6px',
        cursor: 'pointer'
      }}
      onClick={onClick}
    >
      <h4 style={{ color: '#e6edf3', marginBottom: '10px' }}>{title}</h4>
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
          <XAxis dataKey="time" stroke="#8b949e" fontSize={12} />
          <YAxis stroke="#8b949e" fontSize={12} />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#21262d', 
              border: '1px solid #30363d',
              borderRadius: '6px',
              color: '#e6edf3'
            }} 
          />
          <Line type="monotone" dataKey="attacks" stroke="#58a6ff" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const PieChartWidget = ({ data = mockSecurityData, config = {}, isSelected, onClick }) => {
  const title = config.title || 'Pie Chart';
  
  const severityData = data.reduce((acc, item) => {
    const existing = acc.find(d => d.name === item.severity);
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name: item.severity, value: 1 });
    }
    return acc;
  }, []);

  const COLORS = {
    'Critical': '#dc2626',
    'High': '#ea580c',
    'Medium': '#d97706',
    'Low': '#65a30d'
  };

  return (
    <div 
      style={{ 
        height: '100%', 
        padding: '10px',
        border: isSelected ? '2px solid #58a6ff' : 'none',
        borderRadius: '6px',
        cursor: 'pointer'
      }}
      onClick={onClick}
    >
      <h4 style={{ color: '#e6edf3', marginBottom: '10px' }}>{title}</h4>
      <ResponsiveContainer width="100%" height="85%">
        <PieChart>
          <Pie
            data={severityData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {severityData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[entry.name]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#21262d', 
              border: '1px solid #30363d',
              borderRadius: '6px',
              color: '#e6edf3'
            }} 
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

const MapWidget = ({ data = mockSecurityData, config = {}, isSelected, onClick }) => {
  const title = config.title || 'Geographic Map';
  
  return (
    <div 
      style={{ 
        height: '100%', 
        padding: '10px',
        border: isSelected ? '2px solid #58a6ff' : 'none',
        borderRadius: '6px',
        cursor: 'pointer'
      }}
      onClick={onClick}
    >
      <h4 style={{ color: '#e6edf3', marginBottom: '10px' }}>{title}</h4>
      <div style={{ height: '85%', borderRadius: '6px', overflow: 'hidden' }}>
        <MapContainer
          center={[40.0, 0.0]}
          zoom={2}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />
          {data.map(item => (
            <CircleMarker
              key={item.sourceIp}
              center={[item.latitude, item.longitude]}
              radius={Math.max(5, item.attackCount / 10)}
              fillColor={item.severity === 'Critical' ? '#dc2626' : item.severity === 'High' ? '#ea580c' : '#d97706'}
              color={item.severity === 'Critical' ? '#dc2626' : item.severity === 'High' ? '#ea580c' : '#d97706'}
              weight={2}
              opacity={0.8}
              fillOpacity={0.6}
            >
              <Popup>
                <div style={{ color: '#000', fontSize: '12px' }}>
                  <strong>{item.attackType}</strong><br />
                  IP: {item.sourceIp}<br />
                  Location: {item.city}, {item.country}<br />
                  Attacks: {item.attackCount}
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

const MetricCardWidget = ({ data = mockSecurityData, config = {}, isSelected, onClick }) => {
  const title = config.title || 'Key Metrics';
  
  const totalAttacks = data.reduce((sum, item) => sum + item.attackCount, 0);
  const criticalEvents = data.filter(item => item.severity === 'Critical').length;
  const uniqueCountries = new Set(data.map(item => item.country)).size;

  const cardStyle = {
    height: '100%',
    padding: '15px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-around',
    border: isSelected ? '2px solid #58a6ff' : 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  };

  const metricStyle = {
    textAlign: 'center',
    padding: '10px',
    backgroundColor: '#21262d',
    borderRadius: '6px',
    margin: '5px 0'
  };

  return (
    <div style={cardStyle} onClick={onClick}>
      <h4 style={{ color: '#e6edf3', textAlign: 'center', marginBottom: '10px' }}>{title}</h4>
      
      <div style={metricStyle}>
        <div style={{ fontSize: '24px', color: '#58a6ff', fontWeight: 'bold' }}>{totalAttacks}</div>
        <div style={{ color: '#e6edf3', fontSize: '12px' }}>Total Attacks</div>
      </div>

      <div style={metricStyle}>
        <div style={{ fontSize: '24px', color: '#dc2626', fontWeight: 'bold' }}>{criticalEvents}</div>
        <div style={{ color: '#e6edf3', fontSize: '12px' }}>Critical Events</div>
      </div>

      <div style={metricStyle}>
        <div style={{ fontSize: '24px', color: '#238636', fontWeight: 'bold' }}>{uniqueCountries}</div>
        <div style={{ color: '#e6edf3', fontSize: '12px' }}>Countries</div>
      </div>
    </div>
  );
};

const DataTableWidget = ({ data = mockSecurityData, config = {}, isSelected, onClick }) => {
  const title = config.title || 'Data Table';
  
  const tableStyle = {
    height: '100%',
    padding: '10px',
    overflow: 'auto',
    border: isSelected ? '2px solid #58a6ff' : 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  };

  const tableElementStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px'
  };

  const headerStyle = {
    backgroundColor: '#21262d',
    color: '#e6edf3',
    padding: '8px',
    borderBottom: '1px solid #30363d',
    textAlign: 'left'
  };

  const cellStyle = {
    padding: '6px 8px',
    borderBottom: '1px solid #30363d',
    color: '#e6edf3'
  };

  return (
    <div style={tableStyle} onClick={onClick}>
      <h4 style={{ color: '#e6edf3', marginBottom: '10px' }}>{title}</h4>
      <table style={tableElementStyle}>
        <thead>
          <tr>
            <th style={headerStyle}>Time</th>
            <th style={headerStyle}>IP</th>
            <th style={headerStyle}>Type</th>
            <th style={headerStyle}>Severity</th>
            <th style={headerStyle}>Attacks</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 10).map((item, index) => (
            <tr key={index}>
              <td style={cellStyle}>{item.timestamp.split(' ')[1]}</td>
              <td style={cellStyle}>{item.sourceIp}</td>
              <td style={cellStyle}>{item.attackType}</td>
              <td style={{
                ...cellStyle,
                color: item.severity === 'Critical' ? '#dc2626' : 
                       item.severity === 'High' ? '#ea580c' : '#d97706'
              }}>
                {item.severity}
              </td>
              <td style={cellStyle}>{item.attackCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Widget Renderer
const WidgetRenderer = ({ widget, isSelected, onClick }) => {
  const components = {
    'BarChartWidget': BarChartWidget,
    'LineChartWidget': LineChartWidget,
    'PieChartWidget': PieChartWidget,
    'MapWidget': MapWidget,
    'MetricCardWidget': MetricCardWidget,
    'DataTableWidget': DataTableWidget
  };

  const Component = components[widget.component];
  return Component ? (
    <Component 
      data={mockSecurityData} 
      config={widget.config}
      isSelected={isSelected}
      onClick={onClick}
    />
  ) : <div>Widget not found</div>;
};

// Main Power BI Style Dashboard
const PowerBIDashboard = () => {
  const [dashboardWidgets, setDashboardWidgets] = useState([]);
  const [selectedWidget, setSelectedWidget] = useState(null);
  const [draggedWidget, setDraggedWidget] = useState(null);

  const handleDragStart = (event) => {
    setDraggedWidget(event.active.data.current.widget);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (over && over.id === 'dashboard-canvas' && active.data.current.widget) {
      const widget = active.data.current.widget;
      const newWidget = {
        i: `widget-${Date.now()}`,
        x: 0,
        y: 0,
        w: 6,
        h: 4,
        component: widget.component,
        config: {
          title: widget.name
        }
      };
      setDashboardWidgets([...dashboardWidgets, newWidget]);
    }
    
    setDraggedWidget(null);
  };

  const handleLayoutChange = (layout) => {
    const updatedWidgets = dashboardWidgets.map(widget => {
      const layoutItem = layout.find(item => item.i === widget.i);
      return layoutItem ? { ...widget, ...layoutItem } : widget;
    });
    setDashboardWidgets(updatedWidgets);
  };

  const handleWidgetClick = (widgetId) => {
    const widget = dashboardWidgets.find(w => w.i === widgetId);
    setSelectedWidget(widget);
  };

  const handleUpdateWidget = (widgetId, newConfig) => {
    const updatedWidgets = dashboardWidgets.map(widget => 
      widget.i === widgetId ? { ...widget, config: newConfig } : widget
    );
    setDashboardWidgets(updatedWidgets);
    setSelectedWidget(prev => prev ? { ...prev, config: newConfig } : null);
  };

  const handleDeleteWidget = (widgetId) => {
    setDashboardWidgets(dashboardWidgets.filter(widget => widget.i !== widgetId));
    setSelectedWidget(null);
  };

  const dashboardStyle = {
    backgroundColor: '#0d1117',
    minHeight: '100vh',
    display: 'flex',
    color: '#e6edf3'
  };

  const mainContentStyle = {
    flex: 1,
    padding: '20px',
    paddingRight: '10px'
  };

  const sidebarStyle = {
    width: '280px',
    padding: '20px',
    paddingLeft: '10px'
  };

  const headerStyle = {
    marginBottom: '20px',
    color: '#e6edf3'
  };

  return (
    <DndContext 
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div style={dashboardStyle}>
        {/* Main Dashboard Canvas */}
        <div style={mainContentStyle}>
          <div style={headerStyle}>
            <h1>⚡ PhantomWall Security Dashboard</h1>
            <p style={{ color: '#8b949e' }}>Drag widgets from the gallery to build your custom dashboard</p>
          </div>

          <CanvasDropZone>
            {dashboardWidgets.length === 0 ? (
              <div style={{
                textAlign: 'center',
                color: '#8b949e',
                padding: '100px 20px',
                fontSize: '18px'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '20px' }}>📊</div>
                <div>Drag widgets from the gallery to get started</div>
                <div style={{ fontSize: '14px', marginTop: '10px' }}>
                  Build your custom security dashboard with drag & drop
                </div>
              </div>
            ) : (
              <ResponsiveGridLayout
                className="layout"
                layouts={{ lg: dashboardWidgets }}
                onLayoutChange={handleLayoutChange}
                cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                rowHeight={60}
                draggableCancel=".non-draggable"
              >
                {dashboardWidgets.map(widget => (
                  <div
                    key={widget.i}
                    style={{
                      backgroundColor: '#21262d',
                      border: '1px solid #30363d',
                      borderRadius: '8px',
                      overflow: 'hidden'
                    }}
                  >
                    <WidgetRenderer 
                      widget={widget}
                      isSelected={selectedWidget?.i === widget.i}
                      onClick={() => handleWidgetClick(widget.i)}
                    />
                  </div>
                ))}
              </ResponsiveGridLayout>
            )}
          </CanvasDropZone>
        </div>

        {/* Right Sidebar - Widget Gallery */}
        <div style={sidebarStyle}>
          <WidgetGallery />
        </div>

        {/* Configuration Panel */}
        <ConfigurationPanel
          selectedWidget={selectedWidget}
          onUpdateWidget={handleUpdateWidget}
          onDeleteWidget={handleDeleteWidget}
          onClose={() => setSelectedWidget(null)}
        />

        {/* Drag Overlay */}
        <DragOverlay>
          {draggedWidget ? (
            <div style={{
              backgroundColor: '#21262d',
              border: '2px solid #58a6ff',
              borderRadius: '8px',
              padding: '12px',
              opacity: 0.8,
              transform: 'rotate(5deg)'
            }}>
              <div style={{ fontSize: '20px', textAlign: 'center' }}>
                {draggedWidget.icon}
              </div>
              <div style={{ color: '#e6edf3', fontSize: '13px', textAlign: 'center' }}>
                {draggedWidget.name}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
};

export default PowerBIDashboard;