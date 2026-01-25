import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Available data fields for security dashboard
const DATA_FIELDS = [
  { id: 'timestamp', name: 'Timestamp', type: 'datetime', icon: '🕐' },
  { id: 'sourceIP', name: 'Source IP', type: 'string', icon: '🌐' },
  { id: 'alertType', name: 'Alert Type', type: 'string', icon: '⚠️' },
  { id: 'severity', name: 'Severity', type: 'string', icon: '🔥' },
  { id: 'target', name: 'Target', type: 'string', icon: '🎯' },
  { id: 'blocked', name: 'Blocked Status', type: 'boolean', icon: '🛡️' },
  { id: 'country', name: 'Country', type: 'string', icon: '🗺️' },
  { id: 'port', name: 'Port', type: 'number', icon: '🔌' },
  { id: 'protocol', name: 'Protocol', type: 'string', icon: '📡' },
  { id: 'bytes', name: 'Bytes', type: 'number', icon: '📊' }
];

// Mock security data
const MOCK_SECURITY_DATA = [
  { timestamp: '14:20', sourceIP: '192.168.1.100', alertType: 'SQL Injection', severity: 'Critical', target: '/api/users', blocked: true, country: 'USA', port: 80, protocol: 'HTTP', bytes: 1024 },
  { timestamp: '14:21', sourceIP: '10.0.0.55', alertType: 'Port Scan', severity: 'Medium', target: 'Port 22', blocked: true, country: 'Russia', port: 22, protocol: 'SSH', bytes: 512 },
  { timestamp: '14:22', sourceIP: '172.16.0.25', alertType: 'Malware', severity: 'High', target: '/uploads', blocked: true, country: 'China', port: 443, protocol: 'HTTPS', bytes: 2048 },
  { timestamp: '14:23', sourceIP: '203.0.113.15', alertType: 'Brute Force', severity: 'High', target: '/login', blocked: false, country: 'Brazil', port: 80, protocol: 'HTTP', bytes: 756 },
  { timestamp: '14:24', sourceIP: '198.51.100.42', alertType: 'XSS Attempt', severity: 'Medium', target: '/search', blocked: true, country: 'Germany', port: 443, protocol: 'HTTPS', bytes: 1536 },
  { timestamp: '14:25', sourceIP: '192.0.2.88', alertType: 'DDoS', severity: 'Critical', target: '/api', blocked: false, country: 'USA', port: 80, protocol: 'HTTP', bytes: 4096 }
];

// Draggable field component
const DraggableField = ({ field }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="draggable-field"
    >
      <span style={{ marginRight: '8px' }}>{field.icon}</span>
      <span>{field.name}</span>
      <span style={{ marginLeft: 'auto', color: '#888', fontSize: '12px' }}>
        {field.type}
      </span>
    </div>
  );
};

// Bar Chart specific drop zone
const BarChartDropZone = ({ title, icon, fields, onRemove, id, description }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: id,
  });

  const style = {
    background: isOver ? '#3d4852' : '#2a2a2a',
    border: isOver ? '2px solid #4a90e2' : '2px dashed #555',
  };

  return (
    <div ref={setNodeRef} className="bar-chart-drop-zone" style={style}>
      <div className="drop-zone-header">
        <span style={{ marginRight: '8px' }}>{icon}</span>
        <span style={{ fontWeight: 'bold' }}>{title}</span>
      </div>
      <div className="drop-zone-description">
        {description}
      </div>
      <div className="drop-zone-content">
        {fields.length === 0 ? (
          <div className="drop-zone-placeholder">
            Drop {title.toLowerCase()} field here
          </div>
        ) : (
          fields.map((field, index) => (
            <div key={`${field.id}-${index}`} className="dropped-field">
              <span style={{ marginRight: '8px' }}>{field.icon}</span>
              <span>{field.name}</span>
              <button 
                onClick={() => onRemove && onRemove(id, index)}
                className="remove-field-btn"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Bar Chart Widget Component
const BarChartWidget = ({ config, onConfigChange }) => {
  // Generate chart data based on configuration
  const generateChartData = () => {
    const xField = config.xAxis[0];
    const yField = config.yAxis[0];
    const legendField = config.legend[0];

    if (!xField || !yField) return [];

    console.log('Generating chart data:', { xField: xField.name, yField: yField.name, legendField: legendField?.name });

    // Group data by X-axis field
    const grouped = MOCK_SECURITY_DATA.reduce((acc, item) => {
      const xValue = item[xField.id];
      
      if (!acc[xValue]) {
        acc[xValue] = { [xField.id]: xValue };
      }

      if (yField.type === 'number') {
        // Handle numeric Y-axis with optional legend grouping
        if (legendField) {
          // Group by legend field for numeric data
          const legendValue = item[legendField.id];
          if (!acc[xValue][legendValue]) acc[xValue][legendValue] = 0;
          acc[xValue][legendValue] += item[yField.id];
        } else {
          // Simple sum without legend
          if (!acc[xValue][yField.id]) acc[xValue][yField.id] = 0;
          acc[xValue][yField.id] += item[yField.id];
        }
      } else {
        // Handle non-numeric Y-axis (count occurrences)
        if (legendField) {
          // Count by legend field
          const legendValue = item[legendField.id];
          if (!acc[xValue][legendValue]) acc[xValue][legendValue] = 0;
          acc[xValue][legendValue]++;
        } else {
          // Simple count
          if (!acc[xValue]['count']) acc[xValue]['count'] = 0;
          acc[xValue]['count']++;
        }
      }

      return acc;
    }, {});

    const result = Object.values(grouped);
    console.log('Generated chart data:', result);
    return result;
  };

  const chartData = generateChartData();
  const xField = config.xAxis[0];
  const yField = config.yAxis[0];
  const legendField = config.legend[0];

  // Get unique legend values for proper bar rendering
  const legendValues = legendField ? 
    [...new Set(MOCK_SECURITY_DATA.map(item => item[legendField.id]))] : 
    [yField?.type === 'number' ? yField.id : 'count'];

  console.log('Legend values:', legendValues);
  console.log('Chart data sample:', chartData[0]);

  const colors = ['#ff4757', '#ff6b35', '#ffa502', '#26de81', '#4ecdc4', '#45b7d1'];

  return (
    <div className="bar-chart-widget">
      <div className="widget-header">
        <h3>📊 Bar Chart Configuration</h3>
      </div>
      
      <div className="widget-body">
        {/* Configuration Panel */}
        <div className="config-panel">
          <div className="config-grid">
            <BarChartDropZone
              id="xAxis"
              title="X-Axis"
              icon="📈"
              description="Categories (what to group by)"
              fields={config.xAxis}
              onRemove={(zoneId, index) => onConfigChange(zoneId, index, 'remove')}
            />
            <BarChartDropZone
              id="yAxis"
              title="Y-Axis"
              icon="📊"
              description="Values (what to measure)"
              fields={config.yAxis}
              onRemove={(zoneId, index) => onConfigChange(zoneId, index, 'remove')}
            />
            <BarChartDropZone
              id="legend"
              title="Legend"
              icon="🎨"
              description="Series (optional grouping)"
              fields={config.legend}
              onRemove={(zoneId, index) => onConfigChange(zoneId, index, 'remove')}
            />
            <BarChartDropZone
              id="filter"
              title="Filter"
              icon="🔍"
              description="Data filtering (coming soon)"
              fields={config.filter}
              onRemove={(zoneId, index) => onConfigChange(zoneId, index, 'remove')}
            />
          </div>
        </div>

        {/* Chart Display */}
        <div className="chart-display">
          {!xField || !yField ? (
            <div className="chart-placeholder">
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>📊</div>
              <div style={{ fontSize: '18px', marginBottom: '10px' }}>Bar Chart</div>
              <div style={{ color: '#888', fontSize: '14px' }}>
                Drag fields to X-Axis and Y-Axis to create your chart
              </div>
            </div>
          ) : (
            <div className="live-chart">
              <h4 style={{ color: '#fff', marginBottom: '15px' }}>
                {xField.name} vs {yField.name}
                {legendField && ` (by ${legendField.name})`}
              </h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey={xField.id} stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip 
                    contentStyle={{ 
                      background: '#2d2d2d', 
                      border: '1px solid #444', 
                      borderRadius: '4px' 
                    }}
                    labelStyle={{ color: '#fff' }}
                  />
                  {legendField && <Legend />}
                  {legendValues.map((value, index) => (
                    <Bar 
                      key={value} 
                      dataKey={value} 
                      fill={colors[index % colors.length]}
                      name={value}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const BarChartTest = () => {
  const [availableFields] = useState(DATA_FIELDS);
  const [barChartConfig, setBarChartConfig] = useState({
    xAxis: [],
    yAxis: [],
    legend: [],
    filter: []
  });
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (over && active) {
      const draggedField = availableFields.find(f => f.id === active.id);
      const dropZoneId = over.id;
      
      if (dropZoneId && barChartConfig.hasOwnProperty(dropZoneId) && draggedField) {
        setBarChartConfig(prev => ({
          ...prev,
          [dropZoneId]: [...prev[dropZoneId], draggedField]
        }));
      }
    }
    
    setActiveId(null);
  };

  const handleConfigChange = (zoneId, index, action) => {
    if (action === 'remove') {
      setBarChartConfig(prev => ({
        ...prev,
        [zoneId]: prev[zoneId].filter((_, i) => i !== index)
      }));
    }
  };

  const activeField = activeId ? availableFields.find(f => f.id === activeId) : null;

  return (
    <div style={{ height: '100vh', background: '#0d1117', padding: '20px', color: '#fff' }}>
      <h2 style={{ color: '#fff', marginBottom: '20px' }}>📊 Bar Chart Widget Test</h2>
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div style={{ display: 'flex', gap: '20px', height: 'calc(100vh - 80px)' }}>
          
          {/* Data Fields Panel */}
          <div className="fields-panel">
            <h3>📋 Available Fields</h3>
            <SortableContext items={availableFields} strategy={verticalListSortingStrategy}>
              <div className="fields-list">
                {availableFields.map((field) => (
                  <DraggableField key={field.id} field={field} />
                ))}
              </div>
            </SortableContext>
          </div>

          {/* Bar Chart Widget */}
          <div style={{ flex: 1 }}>
            <BarChartWidget 
              config={barChartConfig}
              onConfigChange={handleConfigChange}
            />
          </div>
        </div>

        <DragOverlay>
          {activeField ? (
            <div className="dragging-overlay">
              <span style={{ marginRight: '8px' }}>{activeField.icon}</span>
              <span>{activeField.name}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <style jsx>{`
        .fields-panel {
          width: 280px;
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 20px;
        }
        
        .fields-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 15px;
        }
        
        .draggable-field {
          display: flex;
          align-items: center;
          padding: 10px;
          background: #2d2d2d;
          border: 1px solid #444;
          border-radius: 6px;
          cursor: grab;
          transition: all 0.2s;
        }
        
        .draggable-field:hover {
          background: #3d3d3d;
          border-color: #555;
        }
        
        .bar-chart-widget {
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 8px;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        
        .widget-header {
          padding: 20px;
          border-bottom: 1px solid #333;
        }
        
        .widget-body {
          flex: 1;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        .config-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }
        
        .bar-chart-drop-zone {
          padding: 15px;
          border-radius: 8px;
          min-height: 120px;
        }
        
        .drop-zone-header {
          display: flex;
          align-items: center;
          margin-bottom: 5px;
          color: #fff;
        }
        
        .drop-zone-description {
          font-size: 12px;
          color: #888;
          margin-bottom: 10px;
        }
        
        .drop-zone-placeholder {
          color: #666;
          font-style: italic;
          text-align: center;
          padding: 20px 10px;
        }
        
        .dropped-field {
          display: flex;
          align-items: center;
          padding: 8px;
          background: #4a5568;
          border-radius: 4px;
          margin-bottom: 5px;
          color: #fff;
        }
        
        .remove-field-btn {
          margin-left: auto;
          background: none;
          border: none;
          color: #ff6b6b;
          cursor: pointer;
          font-size: 12px;
          padding: 2px 6px;
          border-radius: 3px;
        }
        
        .remove-field-btn:hover {
          background: #ff6b6b;
          color: white;
        }
        
        .chart-display {
          flex: 1;
          background: #242424;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 20px;
        }
        
        .chart-placeholder {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #888;
          text-align: center;
        }
        
        .live-chart {
          height: 100%;
        }
        
        .dragging-overlay {
          display: flex;
          align-items: center;
          padding: 10px;
          background: #4a5568;
          border: 1px solid #666;
          border-radius: 6px;
          color: #fff;
          box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  );
};

export default BarChartTest;