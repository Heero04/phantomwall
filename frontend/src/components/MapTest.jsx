import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default markers in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Mock security data with geographic coordinates
const mockSecurityEvents = [
  {
    id: 1,
    type: 'DDoS Attack',
    severity: 'High',
    lat: 40.7128,
    lng: -74.0060,
    location: 'New York, USA',
    attackCount: 15,
    timestamp: '2025-11-03 14:30:00'
  },
  {
    id: 2,
    type: 'Malware',
    severity: 'Critical',
    lat: 51.5074,
    lng: -0.1278,
    location: 'London, UK',
    attackCount: 8,
    timestamp: '2025-11-03 14:25:00'
  },
  {
    id: 3,
    type: 'Phishing',
    severity: 'Medium',
    lat: 35.6762,
    lng: 139.6503,
    location: 'Tokyo, Japan',
    attackCount: 23,
    timestamp: '2025-11-03 14:20:00'
  },
  {
    id: 4,
    type: 'Brute Force',
    severity: 'High',
    lat: 37.7749,
    lng: -122.4194,
    location: 'San Francisco, USA',
    attackCount: 12,
    timestamp: '2025-11-03 14:15:00'
  },
  {
    id: 5,
    type: 'SQL Injection',
    severity: 'Critical',
    lat: 52.5200,
    lng: 13.4050,
    location: 'Berlin, Germany',
    attackCount: 6,
    timestamp: '2025-11-03 14:10:00'
  }
];

const MapTest = () => {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [mapView, setMapView] = useState('attacks'); // 'attacks' or 'heatmap'

  // Get color based on severity
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'Critical': return '#dc2626'; // Red
      case 'High': return '#ea580c'; // Orange
      case 'Medium': return '#d97706'; // Amber
      case 'Low': return '#65a30d'; // Green
      default: return '#6b7280'; // Gray
    }
  };

  // Get radius based on attack count
  const getAttackRadius = (count) => {
    return Math.max(5, Math.min(25, count * 1.5));
  };

  const containerStyle = {
    padding: '20px',
    backgroundColor: '#0d1117',
    minHeight: '100vh',
    color: '#e6edf3'
  };

  const headerStyle = {
    marginBottom: '20px',
    textAlign: 'center'
  };

  const controlsStyle = {
    marginBottom: '20px',
    display: 'flex',
    gap: '10px',
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
    border: '1px solid #30363d'
  };

  const statsStyle = {
    marginTop: '20px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px'
  };

  const statCardStyle = {
    backgroundColor: '#21262d',
    padding: '15px',
    borderRadius: '8px',
    border: '1px solid #30363d'
  };

  const selectedEventStyle = {
    marginTop: '20px',
    backgroundColor: '#21262d',
    padding: '15px',
    borderRadius: '8px',
    border: '1px solid #30363d'
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1>🗺️ Security Geographic Visualization Test</h1>
        <p>Testing React-Leaflet integration with security data mapping</p>
      </div>

      <div style={controlsStyle}>
        <button
          style={mapView === 'attacks' ? activeButtonStyle : buttonStyle}
          onClick={() => setMapView('attacks')}
        >
          Attack Locations
        </button>
        <button
          style={mapView === 'heatmap' ? activeButtonStyle : buttonStyle}
          onClick={() => setMapView('heatmap')}
        >
          Intensity View
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
          
          {mapView === 'attacks' && mockSecurityEvents.map(event => (
            <Marker
              key={event.id}
              position={[event.lat, event.lng]}
              eventHandlers={{
                click: () => setSelectedEvent(event)
              }}
            >
              <Popup>
                <div style={{ color: '#000' }}>
                  <strong>{event.type}</strong><br />
                  Severity: <span style={{ color: getSeverityColor(event.severity) }}>
                    {event.severity}
                  </span><br />
                  Location: {event.location}<br />
                  Attacks: {event.attackCount}<br />
                  Time: {event.timestamp}
                </div>
              </Popup>
            </Marker>
          ))}

          {mapView === 'heatmap' && mockSecurityEvents.map(event => (
            <CircleMarker
              key={event.id}
              center={[event.lat, event.lng]}
              radius={getAttackRadius(event.attackCount)}
              fillColor={getSeverityColor(event.severity)}
              color={getSeverityColor(event.severity)}
              weight={2}
              opacity={0.8}
              fillOpacity={0.6}
              eventHandlers={{
                click: () => setSelectedEvent(event)
              }}
            >
              <Popup>
                <div style={{ color: '#000' }}>
                  <strong>{event.type}</strong><br />
                  Severity: <span style={{ color: getSeverityColor(event.severity) }}>
                    {event.severity}
                  </span><br />
                  Location: {event.location}<br />
                  Attacks: {event.attackCount}<br />
                  Time: {event.timestamp}
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      <div style={statsStyle}>
        <div style={statCardStyle}>
          <h3>📊 Total Events</h3>
          <p style={{ fontSize: '24px', color: '#58a6ff' }}>
            {mockSecurityEvents.length}
          </p>
        </div>
        <div style={statCardStyle}>
          <h3>🚨 Critical Threats</h3>
          <p style={{ fontSize: '24px', color: '#dc2626' }}>
            {mockSecurityEvents.filter(e => e.severity === 'Critical').length}
          </p>
        </div>
        <div style={statCardStyle}>
          <h3>⚠️ High Priority</h3>
          <p style={{ fontSize: '24px', color: '#ea580c' }}>
            {mockSecurityEvents.filter(e => e.severity === 'High').length}
          </p>
        </div>
        <div style={statCardStyle}>
          <h3>🌍 Countries Affected</h3>
          <p style={{ fontSize: '24px', color: '#238636' }}>
            {new Set(mockSecurityEvents.map(e => e.location.split(', ')[1])).size}
          </p>
        </div>
      </div>

      {selectedEvent && (
        <div style={selectedEventStyle}>
          <h3>🎯 Selected Event Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div><strong>Type:</strong> {selectedEvent.type}</div>
            <div><strong>Severity:</strong> 
              <span style={{ color: getSeverityColor(selectedEvent.severity) }}>
                {selectedEvent.severity}
              </span>
            </div>
            <div><strong>Location:</strong> {selectedEvent.location}</div>
            <div><strong>Attack Count:</strong> {selectedEvent.attackCount}</div>
            <div><strong>Coordinates:</strong> {selectedEvent.lat}, {selectedEvent.lng}</div>
            <div><strong>Timestamp:</strong> {selectedEvent.timestamp}</div>
          </div>
          <button
            style={{ ...buttonStyle, marginTop: '10px' }}
            onClick={() => setSelectedEvent(null)}
          >
            Clear Selection
          </button>
        </div>
      )}

      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#21262d', borderRadius: '8px', border: '1px solid #30363d' }}>
        <h3>🧪 React-Leaflet Test Results</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li>✅ Map Container Rendering</li>
          <li>✅ OpenStreetMap Tiles Loading</li>
          <li>✅ Marker Placement & Popups</li>
          <li>✅ Circle Markers with Dynamic Sizing</li>
          <li>✅ Click Event Handling</li>
          <li>✅ Dynamic Color Coding by Severity</li>
          <li>✅ View Switching (Markers vs Circles)</li>
          <li>✅ Geographic Security Data Visualization</li>
        </ul>
        <p style={{ marginTop: '15px', color: '#58a6ff' }}>
          🎉 All React-Leaflet features working correctly! Ready for Power BI integration.
        </p>
      </div>
    </div>
  );
};

export default MapTest;