// Simple test to check if components can be imported
import React from 'react'

// Test each component individually
let ThreatMap, AttackTimeline, ThreatScoreEngine, VirtualizedEventList, AdvancedFilterPanel

const ComponentTester = () => {
  const testResults = []

  // Test ThreatMap
  try {
    ThreatMap = require('./ThreatMap').default
    testResults.push({ name: 'ThreatMap', status: 'OK', component: ThreatMap })
  } catch (error) {
    testResults.push({ name: 'ThreatMap', status: 'ERROR', error: error.message })
  }

  // Test AttackTimeline
  try {
    AttackTimeline = require('./AttackTimeline').default
    testResults.push({ name: 'AttackTimeline', status: 'OK', component: AttackTimeline })
  } catch (error) {
    testResults.push({ name: 'AttackTimeline', status: 'ERROR', error: error.message })
  }

  // Test ThreatScoreEngine
  try {
    ThreatScoreEngine = require('./ThreatScoreEngine').default
    testResults.push({ name: 'ThreatScoreEngine', status: 'OK', component: ThreatScoreEngine })
  } catch (error) {
    testResults.push({ name: 'ThreatScoreEngine', status: 'ERROR', error: error.message })
  }

  // Test VirtualizedEventList
  try {
    VirtualizedEventList = require('./VirtualizedEventList').default
    testResults.push({ name: 'VirtualizedEventList', status: 'OK', component: VirtualizedEventList })
  } catch (error) {
    testResults.push({ name: 'VirtualizedEventList', status: 'ERROR', error: error.message })
  }

  // Test AdvancedFilterPanel
  try {
    AdvancedFilterPanel = require('./AdvancedFilterPanel').default
    testResults.push({ name: 'AdvancedFilterPanel', status: 'OK', component: AdvancedFilterPanel })
  } catch (error) {
    testResults.push({ name: 'AdvancedFilterPanel', status: 'ERROR', error: error.message })
  }

  return (
    <div style={{ padding: '20px', background: '#f8f9fa', margin: '20px', borderRadius: '8px' }}>
      <h3>🧪 Component Test Results</h3>
      {testResults.map((result, index) => (
        <div key={index} style={{ 
          padding: '8px', 
          margin: '4px 0', 
          background: result.status === 'OK' ? '#d4edda' : '#f8d7da',
          border: `1px solid ${result.status === 'OK' ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '4px'
        }}>
          <strong>{result.name}</strong>: {result.status}
          {result.error && <div style={{ fontSize: '12px', color: '#721c24' }}>Error: {result.error}</div>}
          {result.component && <div style={{ fontSize: '12px', color: '#155724' }}>✅ Component loaded successfully</div>}
        </div>
      ))}
      
      {testResults.every(r => r.status === 'OK') && (
        <div style={{ 
          padding: '12px', 
          background: '#d1ecf1', 
          border: '1px solid #bee5eb',
          borderRadius: '6px',
          marginTop: '12px'
        }}>
          <strong>🎉 All components loaded successfully!</strong>
          <p>The enhanced dashboard should work now.</p>
        </div>
      )}
    </div>
  )
}

export default ComponentTester