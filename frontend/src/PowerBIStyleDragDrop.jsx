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
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

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

// Mock security data for charts
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

// Drop zone for chart areas
const DropZone = ({ title, icon, fields, onDrop, id }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: id,
  });

  const style = {
    background: isOver ? '#3d4852' : '#242424',
    border: isOver ? '2px solid #4a90e2' : '2px dashed #444',
  };

  return (
    <div ref={setNodeRef} className="drop-zone" style={style}>
      <div className="drop-zone-header">
        <span style={{ marginRight: '8px' }}>{icon}</span>
        <span>{title}</span>
      </div>
      <div className="drop-zone-content">
        {fields.length === 0 ? (
          <div className="drop-zone-placeholder">
            Drop fields here to build {title.toLowerCase()}
          </div>
        ) : (
          fields.map((field, index) => (
            <div key={`${field.id}-${index}`} className="dropped-field">
              <span style={{ marginRight: '8px' }}>{field.icon}</span>
              <span>{field.name}</span>
              <button 
                onClick={() => onDrop && onDrop(id, field.id, 'remove')}
                style={{ 
                  marginLeft: 'auto', 
                  background: 'none', 
                  border: 'none', 
                  color: '#ff6b6b', 
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
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

// Dynamic chart component based on configuration
const DynamicChart = ({ chartAreas }) => {
  const xField = chartAreas.xAxis[0];
  const yField = chartAreas.yAxis[0];
  const colorField = chartAreas.color[0];
  
  // If no X or Y axis, show placeholder
  if (!xField || !yField) {
    return (
      <div style={{ 
        height: '400px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#1a1a1a',
        border: '2px dashed #444',
        borderRadius: '8px',
        color: '#888'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>📊</div>
          <div>Drag fields to X-Axis and Y-Axis to generate a chart</div>
        </div>
      </div>
    );
  }

  // Prepare data for chart
  let chartData = [...MOCK_SECURITY_DATA];

  // Get unique values for color field
  const colorValues = colorField ? [...new Set(MOCK_SECURITY_DATA.map(item => item[colorField.id]))] : [];
  const colors = ['#ff4757', '#ff6b35', '#ffa502', '#26de81', '#4ecdc4', '#45b7d1'];

  return (
    <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '20px' }}>
      <h3 style={{ color: '#fff', marginBottom: '20px' }}>
        📊 {xField.name} vs {yField.name}
        {colorField && ` (Colored by ${colorField.name})`}
      </h3>
      
      <ResponsiveContainer width="100%" height={350}>
        {yField.type === 'number' ? (
          // Line chart for numeric Y-axis
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey={xField.id} stroke="#888" />
            <YAxis stroke="#888" />
            <Tooltip 
              contentStyle={{ background: '#2d2d2d', border: '1px solid #444', borderRadius: '4px' }}
              labelStyle={{ color: '#fff' }}
            />
            <Line 
              type="monotone" 
              dataKey={yField.id} 
              stroke="#4ecdc4" 
              strokeWidth={3}
              dot={{ fill: '#4ecdc4', strokeWidth: 2, r: 4 }}
            />
          </LineChart>
        ) : (
          // Bar chart for string Y-axis  
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey={xField.id} stroke="#888" />
            <YAxis stroke="#888" />
            <Tooltip 
              contentStyle={{ background: '#2d2d2d', border: '1px solid #444', borderRadius: '4px' }}
              labelStyle={{ color: '#fff' }}
            />
            <Legend />
            <Bar dataKey={yField.id} fill="#4ecdc4" />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};

const PowerBIStyleDragDrop = () => {
  const [availableFields] = useState(DATA_FIELDS);
  const [chartAreas, setChartAreas] = useState({
    xAxis: [],
    yAxis: [],
    color: [],
    size: [],
    filters: []
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
      
      console.log('Dragged field:', draggedField);
      console.log('Drop zone:', dropZoneId);
      
      if (dropZoneId && chartAreas.hasOwnProperty(dropZoneId) && draggedField) {
        setChartAreas(prev => ({
          ...prev,
          [dropZoneId]: [...prev[dropZoneId], draggedField]
        }));
        console.log('Field added to', dropZoneId);
      }
    }
    
    setActiveId(null);
  };

  const handleFieldRemove = (zoneId, fieldId) => {
    setChartAreas(prev => ({
      ...prev,
      [zoneId]: prev[zoneId].filter((_, index) => index !== fieldId)
    }));
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const activeField = activeId ? availableFields.find(f => f.id === activeId) : null;

  return (
    <div style={{ height: '100vh', background: '#0d1117', padding: '20px', color: '#fff' }}>
      <h2 style={{ color: '#fff', marginBottom: '20px' }}>🎨 Power BI Style Drag & Drop</h2>
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
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

          {/* Chart Configuration Area */}
          <div className="chart-config-area">
            <h3>📊 Chart Configuration</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <DropZone 
                id="xAxis"
                title="X-Axis" 
                icon="📈" 
                fields={chartAreas.xAxis}
                onDrop={handleFieldRemove}
              />
              <DropZone 
                id="yAxis"
                title="Y-Axis" 
                icon="📊" 
                fields={chartAreas.yAxis}
                onDrop={handleFieldRemove}
              />
              <DropZone 
                id="color"
                title="Color By" 
                icon="🎨" 
                fields={chartAreas.color}
                onDrop={handleFieldRemove}
              />
              <DropZone 
                id="size"
                title="Size By" 
                icon="⚫" 
                fields={chartAreas.size}
                onDrop={handleFieldRemove}
              />
            </div>
            
            <div style={{ marginTop: '15px' }}>
              <DropZone 
                id="filters"
                title="Filters" 
                icon="🔍" 
                fields={chartAreas.filters}
                onDrop={handleFieldRemove}
              />
            </div>
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

      {/* Live Chart Display */}
      <div style={{ marginTop: '30px' }}>
        <DynamicChart chartAreas={chartAreas} />
      </div>

      <style jsx>{`
        .fields-panel {
          width: 300px;
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
          padding: 12px;
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
        
        .chart-config-area {
          flex: 1;
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 20px;
        }
        
        .drop-zone {
          background: #242424;
          border: 2px dashed #444;
          border-radius: 8px;
          padding: 15px;
          min-height: 100px;
        }
        
        .drop-zone-header {
          display: flex;
          align-items: center;
          margin-bottom: 10px;
          font-weight: bold;
          color: #fff;
        }
        
        .drop-zone-content {
          min-height: 60px;
        }
        
        .drop-zone-placeholder {
          color: #888;
          font-style: italic;
          text-align: center;
          padding: 20px;
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
        
        .dragging-overlay {
          display: flex;
          align-items: center;
          padding: 12px;
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

export default PowerBIStyleDragDrop;