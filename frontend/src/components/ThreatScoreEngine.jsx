import React, { useMemo } from 'react'

const ThreatScoreEngine = ({ events, className = '' }) => {
  // Helper function to categorize attacks
  const categorizeAttack = (signature) => {
    const sig = signature.toLowerCase()
    if (sig.includes('brute') || sig.includes('login')) return 'Brute Force'
    if (sig.includes('scan') || sig.includes('probe')) return 'Reconnaissance'
    if (sig.includes('exploit') || sig.includes('vulnerability')) return 'Exploitation'
    if (sig.includes('malware') || sig.includes('trojan')) return 'Malware'
    if (sig.includes('dos') || sig.includes('flood')) return 'DoS Attack'
    if (sig.includes('web') || sig.includes('http')) return 'Web Attack'
    if (sig.includes('ssh') || sig.includes('telnet')) return 'Remote Access'
    return 'Other'
  }

  // Helper function to generate security recommendations
  const generateRecommendations = (score, attackTypes, ipScores) => {
    const recommendations = []
    
    if (score > 500) {
      recommendations.push({
        priority: 'HIGH',
        action: 'Immediate Response Required',
        description: 'High threat score detected. Consider blocking top attacking IPs.',
        icon: '🚨'
      })
    }
    
    if (Object.keys(attackTypes).includes('Brute Force') && attackTypes['Brute Force'] > 10) {
      recommendations.push({
        priority: 'MEDIUM',
        action: 'Implement Rate Limiting',
        description: 'Multiple brute force attempts detected. Enable fail2ban or similar.',
        icon: '🛡️'
      })
    }
    
    if (Object.keys(ipScores).length > 20) {
      recommendations.push({
        priority: 'MEDIUM',
        action: 'Geographic Blocking',
        description: 'Attacks from multiple sources. Consider geo-blocking high-risk countries.',
        icon: '🌍'
      })
    }
    
    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'LOW',
        action: 'Continue Monitoring',
        description: 'Current threat level is manageable. Maintain vigilance.',
        icon: '👁️'
      })
    }
    
    return recommendations
  }

  const threatAnalysis = useMemo(() => {
    let totalScore = 0
    const attackTypes = {}
    const ipRiskScores = {}
    const recentEvents = events.filter(event => {
      const eventTime = new Date(event.event_time || event.timestamp)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      return eventTime > oneDayAgo
    })

    recentEvents.forEach(event => {
      // Calculate base score
      let eventScore = 0
      const severity = event.alert?.severity || event.severity || 3
      
      // Severity scoring
      switch(severity) {
        case 1: eventScore += 10; break  // High
        case 2: eventScore += 5; break   // Medium
        case 3: eventScore += 1; break   // Low
        default: eventScore += 1
      }
      
      // Attack type scoring
      const signature = event.alert?.signature || event.signature || 'Unknown'
      const attackType = categorizeAttack(signature)
      attackTypes[attackType] = (attackTypes[attackType] || 0) + 1
      
      // Additional scoring based on attack type
      if (signature.toLowerCase().includes('brute')) eventScore *= 2
      if (signature.toLowerCase().includes('exploit')) eventScore *= 3
      if (signature.toLowerCase().includes('malware')) eventScore *= 4
      if (signature.toLowerCase().includes('trojan')) eventScore *= 5
      
      // IP reputation scoring
      const srcIp = event.src_ip || event.source_ip
      if (srcIp) {
        ipRiskScores[srcIp] = (ipRiskScores[srcIp] || 0) + eventScore
      }
      
      totalScore += eventScore
    })

    // Calculate threat level
    const getThreatLevel = (score) => {
      if (score > 1000) return { level: 'CRITICAL', color: '#dc2626', emoji: '🔴' }
      if (score > 500) return { level: 'HIGH', color: '#ea580c', emoji: '🟠' }
      if (score > 100) return { level: 'MEDIUM', color: '#ca8a04', emoji: '🟡' }
      if (score > 10) return { level: 'LOW', color: '#16a34a', emoji: '🟢' }
      return { level: 'MINIMAL', color: '#059669', emoji: '🟢' }
    }

    const threat = getThreatLevel(totalScore)
    
    return {
      totalScore,
      threatLevel: threat,
      recentEventCount: recentEvents.length,
      attackTypes: Object.entries(attackTypes)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5),
      topRiskyIPs: Object.entries(ipRiskScores)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 8),
      recommendations: generateRecommendations(totalScore, attackTypes, ipRiskScores)
    }
  }, [events, categorizeAttack])

  return (
    <div className={`threat-score-engine ${className}`}>
      <div className="threat-score-engine__header">
        <h3>🎯 AI Threat Analysis</h3>
        <div className="threat-score-engine__score">
          <div className="threat-score-badge" style={{ backgroundColor: threatAnalysis.threatLevel.color }}>
            <span className="threat-score-emoji">{threatAnalysis.threatLevel.emoji}</span>
            <div className="threat-score-info">
              <strong className="threat-score-level">{threatAnalysis.threatLevel.level}</strong>
              <span className="threat-score-value">{threatAnalysis.totalScore.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="threat-score-engine__grid">
        {/* Attack Pattern Analysis */}
        <div className="threat-score-section">
          <h4>🔍 Attack Patterns (24h)</h4>
          <div className="attack-patterns">
            {threatAnalysis.attackTypes.map(([type, count]) => (
              <div key={type} className="attack-pattern-item">
                <div className="attack-pattern-info">
                  <span className="attack-pattern-type">{type}</span>
                  <span className="attack-pattern-count">{count} events</span>
                </div>
                <div className="attack-pattern-bar">
                  <div 
                    className="attack-pattern-bar-fill" 
                    style={{ 
                      width: `${(count / threatAnalysis.attackTypes[0][1]) * 100}%`,
                      backgroundColor: getAttackTypeColor(type)
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* High Risk IPs */}
        <div className="threat-score-section">
          <h4>⚠️ High Risk IPs</h4>
          <div className="risky-ips">
            {threatAnalysis.topRiskyIPs.map(([ip, score]) => (
              <div key={ip} className="risky-ip-item">
                <code className="risky-ip-address">{ip}</code>
                <div className="risky-ip-score">
                  <span className="score-value">{Math.round(score)}</span>
                  <div className="score-indicator" style={{
                    backgroundColor: score > 50 ? '#dc2626' : score > 20 ? '#ea580c' : '#ca8a04'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        <div className="threat-score-section threat-score-section--full-width">
          <h4>💡 Security Recommendations</h4>
          <div className="recommendations">
            {threatAnalysis.recommendations.map((rec, index) => (
              <div key={index} className={`recommendation-item recommendation-item--${rec.priority.toLowerCase()}`}>
                <div className="recommendation-icon">{rec.icon}</div>
                <div className="recommendation-content">
                  <strong className="recommendation-action">{rec.action}</strong>
                  <p className="recommendation-description">{rec.description}</p>
                </div>
                <div className={`recommendation-priority recommendation-priority--${rec.priority.toLowerCase()}`}>
                  {rec.priority}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="threat-score-engine__summary">
        <div className="summary-metric">
          <span>Events Analyzed</span>
          <strong>{threatAnalysis.recentEventCount.toLocaleString()}</strong>
        </div>
        <div className="summary-metric">
          <span>Unique Attack Types</span>
          <strong>{threatAnalysis.attackTypes.length}</strong>
        </div>
        <div className="summary-metric">
          <span>Risk Score</span>
          <strong style={{ color: threatAnalysis.threatLevel.color }}>
            {threatAnalysis.totalScore.toLocaleString()}
          </strong>
        </div>
      </div>
    </div>
  )
}

const getAttackTypeColor = (type) => {
  const colors = {
    'Brute Force': '#dc2626',
    'Exploitation': '#ea580c', 
    'Malware': '#7c2d12',
    'Reconnaissance': '#ca8a04',
    'DoS Attack': '#b91c1c',
    'Web Attack': '#c2410c',
    'Remote Access': '#92400e',
    'Other': '#6b7280'
  }
  return colors[type] || '#6b7280'
}

export default ThreatScoreEngine