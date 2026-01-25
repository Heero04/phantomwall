import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useDndContext, useDraggable, useDroppable } from '@dnd-kit/core';

// Fix for default markers in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Mock geographic security data
const mockGeoSecurityData = [
  {
    id: 1,
    sourceIp: '45.129.14.23',
    latitude: 40.7128,
    longitude: -74.0060,
    country: 'United States',
    city: 'New York',
    attackType: 'DDoS Attack',
    severity: 'Critical',
    attackCount: 156,
    bytesTransferred: 2048576,
    protocol: 'TCP',
    timestamp: '2025-11-03T14:30:00Z'
  },
  {
    id: 2,
    sourceIp: '185.220.101.42',
    latitude: 51.5074,
    longitude: -0.1278,
    country: 'United Kingdom',
    city: 'London',
    attackType: 'Malware',
    severity: 'High',
    attackCount: 89,
    bytesTransferred: 1024000,
    protocol: 'HTTP',
    timestamp: '2025-11-03T14:25:00Z'
  },
  {
    id: 3,
    sourceIp: '202.12.27.33',
    latitude: 35.6762,
    longitude: 139.6503,
    country: 'Japan',
    city: 'Tokyo',
    attackType: 'Phishing',
    severity: 'Medium',
    attackCount: 234,
    bytesTransferred: 512000,
    protocol: 'HTTPS',
    timestamp: '2025-11-03T14:20:00Z'
  },
  {
    id: 4,
    sourceIp: '94.102.49.190',
    latitude: 37.7749,
    longitude: -122.4194,
    country: 'United States',
    city: 'San Francisco',
    attackType: 'Brute Force',
    severity: 'High',
    attackCount: 123,
    bytesTransferred: 768000,
    protocol: 'SSH',
    timestamp: '2025-11-03T14:15:00Z'
  },
  {
    id: 5,
    sourceIp: '188.166.217.2',
    latitude: 52.5200,
    longitude: 13.4050,
    country: 'Germany',
    city: 'Berlin',
    attackType: 'SQL Injection',
    severity: 'Critical',
    attackCount: 67,
    bytesTransferred: 1536000,
    protocol: 'HTTP',
    timestamp: '2025-11-03T14:10:00Z'
  },
  {
    id: 6,
    sourceIp: '121.46.124.85',
    latitude: 39.9042,
    longitude: 116.4074,
    country: 'China',
    city: 'Beijing',
    attackType: 'Port Scan',
    severity: 'Low',
    attackCount: 45,
    bytesTransferred: 256000,
    protocol: 'TCP',
    timestamp: '2025-11-03T14:05:00Z'
  }
];

// Drop zone component for map widget configuration
const MapDropZone = ({ id, label, acceptedField, onFieldDrop, currentField }) => {
  const { setNodeRef, isOver } = useDroppable({ 
    id,
    data: { accepts: acceptedField }
  });

  const dropZoneStyle = {
    minHeight: '50px',
    border: '2px dashed #30363d',
    borderRadius: '6px',
    padding: '12px',
    backgroundColor: isOver ? '#238636' : (currentField ? '#21262d' : '#0d1117'),
    borderColor: isOver ? '#238636' : (currentField ? '#58a6ff' : '#30363d'),
    color: '#e6edf3',
    textAlign: 'center',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column'
  };

  return (
    <div ref={setNodeRef} style={dropZoneStyle}>
      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{label}</div>
      {currentField ? (
        <div style={{ 
          backgroundColor: '#58a6ff', 
          color: '#fff', 
          padding: '4px 8px', 
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          {currentField}
        </div>
      ) : (
        <div style={{ color: '#8b949e', fontSize: '12px' }}>
          Drop {acceptedField} field here
        </div>
      )}
    </div>
  );
};

// Draggable field component
const DraggableField = ({ field, type }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `field-${field}`,
    data: { field, type }
  });

  const fieldStyle = {
    padding: '8px 12px',
    backgroundColor: '#21262d',
    border: '1px solid #30363d',
    borderRadius: '6px',
    color: '#e6edf3',
    cursor: 'grab',
    fontSize: '14px',
    userSelect: 'none',
    opacity: isDragging ? 0.5 : 1,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition: 'opacity 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  };

  const getFieldIcon = (type) => {
    switch(type) {
      case 'location': return '🌍';
      case 'severity': return '⚠️';
      case 'category': return '📂';
      case 'numeric': return '🔢';
      case 'date': return '📅';
      default: return '📄';
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={fieldStyle}
      {...listeners}
      {...attributes}
    >
      <span>{getFieldIcon(type)}</span>
      {field}
    </div>
  );
};

const GeographicSecurityWidget = () => {
  const [latitudeField, setLatitudeField] = useState('latitude');
  const [longitudeField, setLongitudeField] = useState('longitude');
  const [colorField, setColorField] = useState('severity');
  const [sizeField, setSizeField] = useState('attackCount');
  const [mapView, setMapView] = useState('markers'); // 'markers' or 'heatmap'
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Available fields for dragging
  const availableFields = [
    { field: 'latitude', type: 'location' },
    { field: 'longitude', type: 'location' },
    { field: 'country', type: 'category' },
    { field: 'city', type: 'category' },
    { field: 'attackType', type: 'category' },
    { field: 'severity', type: 'severity' },
    { field: 'attackCount', type: 'numeric' },
    { field: 'bytesTransferred', type: 'numeric' },
    { field: 'protocol', type: 'category' },
    { field: 'sourceIp', type: 'category' }
  ];

  // Get color based on field value
  const getFieldColor = (item, field) => {
    if (field === 'severity') {
      switch (item.severity) {
        case 'Critical': return '#dc2626';
        case 'High': return '#ea580c';
        case 'Medium': return '#d97706';
        case 'Low': return '#65a30d';
        default: return '#6b7280';
      }
    } else if (field === 'attackType') {
      const colors = {
        'DDoS Attack': '#dc2626',
        'Malware': '#7c3aed',
        'Phishing': '#db2777',
        'Brute Force': '#ea580c',
        'SQL Injection': '#dc2626',
        'Port Scan': '#65a30d'
      };
      return colors[item.attackType] || '#6b7280';
    }
    return '#58a6ff';
  };

  // Get size based on numeric field
  const getFieldSize = (item, field) => {
    const value = item[field] || 0;
    if (field === 'attackCount') {
      return Math.max(8, Math.min(30, value / 10));
    } else if (field === 'bytesTransferred') {
      return Math.max(8, Math.min(30, value / 100000));
    }
    return 15;
  };

  // Handle field drop
  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (over && active) {
      const fieldData = active.data.current;
      const dropZoneId = over.id;

      if (dropZoneId === 'latitude-drop') {
        setLatitudeField(fieldData.field);
      } else if (dropZoneId === 'longitude-drop') {
        setLongitudeField(fieldData.field);
      } else if (dropZoneId === 'color-drop') {
        setColorField(fieldData.field);
      } else if (dropZoneId === 'size-drop') {
        setSizeField(fieldData.field);
      }
    }
  };

  const containerStyle = {
    padding: '20px',
    backgroundColor: '#0d1117',
    minHeight: '100vh',
    color: '#e6edf3'
  };

  const configPanelStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
    marginBottom: '20px'
  };

  const fieldsListStyle = {
    backgroundColor: '#21262d',
    padding: '15px',
    borderRadius: '8px',
    border: '1px solid #30363d'
  };

  const configStyle = {
    backgroundColor: '#21262d',
    padding: '15px',
    borderRadius: '8px',
    border: '1px solid #30363d'
  };

  const fieldsGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '8px',
    marginTop: '10px'
  };

  const dropZonesStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    marginBottom: '15px'
  };

  const controlsStyle = {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
    justifyContent: 'center'
  };

  const buttonStyle = {
    padding: '8px 16px',
    backgroundColor: '#21262d',
    color: '#e6edf3',
    border: '1px solid #30363d',
    borderRadius: '6px',
    cursor: 'pointer'
  };

  const activeButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#238636',
    borderColor: '#238636'
  };

  const mapContainerStyle = {
    height: '500px',
    width: '100%',
    borderRadius: '8px',
    border: '1px solid #30363d',
    marginBottom: '20px'
  };

  return (
    <div style={containerStyle}>
      <h1 style={{ textAlign: 'center', marginBottom: '20px' }}>
        🗺️ Geographic Security Widget
      </h1>

      <div style={configPanelStyle}>
        <div style={fieldsListStyle}>
          <h3>📋 Available Fields</h3>
          <div style={fieldsGridStyle}>
            {availableFields.map(({ field, type }) => (
              <DraggableField key={field} field={field} type={type} />
            ))}
          </div>
        </div>

        <div style={configStyle}>
          <h3>⚙️ Map Configuration</h3>
          <div style={dropZonesStyle}>
            <MapDropZone
              id="latitude-drop"
              label="Latitude"
              acceptedField="location"
              currentField={latitudeField}
            />
            <MapDropZone
              id="longitude-drop"
              label="Longitude"
              acceptedField="location"
              currentField={longitudeField}
            />
            <MapDropZone
              id="color-drop"
              label="Color By"
              acceptedField="any"
              currentField={colorField}
            />
            <MapDropZone
              id="size-drop"
              label="Size By"
              acceptedField="numeric"
              currentField={sizeField}
            />
          </div>
        </div>
      </div>

      <div style={controlsStyle}>
        <button
          style={mapView === 'markers' ? activeButtonStyle : buttonStyle}
          onClick={() => setMapView('markers')}
        >
          📍 Marker View
        </button>
        <button
          style={mapView === 'heatmap' ? activeButtonStyle : buttonStyle}
          onClick={() => setMapView('heatmap')}
        >
          🔥 Heatmap View
        </button>
      </div>

      <div style={mapContainerStyle}>
        <MapContainer
          center={[40.0, 0.0]}
          zoom={2}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          {mockGeoSecurityData.map(item => {
            const lat = item[latitudeField] || item.latitude;
            const lng = item[longitudeField] || item.longitude;
            const color = getFieldColor(item, colorField);
            const size = getFieldSize(item, sizeField);

            if (mapView === 'markers') {
              return (
                <Marker
                  key={item.id}
                  position={[lat, lng]}
                  eventHandlers={{
                    click: () => setSelectedEvent(item)
                  }}
                >
                  <Popup>
                    <div style={{ color: '#000', fontSize: '12px' }}>
                      <strong>{item.attackType}</strong><br />
                      <strong>IP:</strong> {item.sourceIp}<br />
                      <strong>Location:</strong> {item.city}, {item.country}<br />
                      <strong>Severity:</strong> <span style={{ color }}>
                        {item.severity}
                      </span><br />
                      <strong>Attacks:</strong> {item.attackCount}<br />
                      <strong>Protocol:</strong> {item.protocol}
                    </div>
                  </Popup>
                </Marker>
              );
            } else {
              return (
                <CircleMarker
                  key={item.id}
                  center={[lat, lng]}
                  radius={size}
                  fillColor={color}
                  color={color}
                  weight={2}
                  opacity={0.8}
                  fillOpacity={0.6}
                  eventHandlers={{
                    click: () => setSelectedEvent(item)
                  }}
                >
                  <Popup>
                    <div style={{ color: '#000', fontSize: '12px' }}>
                      <strong>{item.attackType}</strong><br />
                      <strong>IP:</strong> {item.sourceIp}<br />
                      <strong>Location:</strong> {item.city}, {item.country}<br />
                      <strong>Severity:</strong> <span style={{ color }}>
                        {item.severity}
                      </span><br />
                      <strong>Attacks:</strong> {item.attackCount}<br />
                      <strong>Protocol:</strong> {item.protocol}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            }
          })}
        </MapContainer>
      </div>

      {selectedEvent && (
        <div style={{
          backgroundColor: '#21262d',
          padding: '15px',
          borderRadius: '8px',
          border: '1px solid #30363d',
          marginTop: '10px'
        }}>
          <h3>🎯 Selected Security Event</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
            <div><strong>Source IP:</strong> {selectedEvent.sourceIp}</div>
            <div><strong>Attack Type:</strong> {selectedEvent.attackType}</div>
            <div><strong>Severity:</strong> 
              <span style={{ color: getFieldColor(selectedEvent, 'severity') }}>
                {selectedEvent.severity}
              </span>
            </div>
            <div><strong>Location:</strong> {selectedEvent.city}, {selectedEvent.country}</div>
            <div><strong>Attack Count:</strong> {selectedEvent.attackCount}</div>
            <div><strong>Bytes:</strong> {selectedEvent.bytesTransferred.toLocaleString()}</div>
            <div><strong>Protocol:</strong> {selectedEvent.protocol}</div>
            <div><strong>Coordinates:</strong> {selectedEvent.latitude}, {selectedEvent.longitude}</div>
            <div><strong>Timestamp:</strong> {new Date(selectedEvent.timestamp).toLocaleString()}</div>
          </div>
          <button
            style={{ ...buttonStyle, marginTop: '10px' }}
            onClick={() => setSelectedEvent(null)}
          >
            Clear Selection
          </button>
        </div>
      )}

      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#21262d',
        borderRadius: '8px',
        border: '1px solid #30363d'
      }}>
        <h3>📊 Widget Statistics</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
          <div>Total Events: <span style={{ color: '#58a6ff' }}>{mockGeoSecurityData.length}</span></div>
          <div>Countries: <span style={{ color: '#238636' }}>
            {new Set(mockGeoSecurityData.map(e => e.country)).size}
          </span></div>
          <div>Critical: <span style={{ color: '#dc2626' }}>
            {mockGeoSecurityData.filter(e => e.severity === 'Critical').length}
          </span></div>
          <div>Total Attacks: <span style={{ color: '#ea580c' }}>
            {mockGeoSecurityData.reduce((sum, e) => sum + e.attackCount, 0)}
          </span></div>
        </div>
      </div>
    </div>
  );
};

export default GeographicSecurityWidget;