import React, { useMemo } from 'react'

const ThreatMap = ({ events, className = '' }) => {
  // Process events to extract geographic data
  const threatData = useMemo(() => {
    const countryStats = {}
    const ipStats = {}
    
    events.forEach(event => {
      const srcIp = event.src_ip || event.source_ip || event.alert?.source?.ip
      if (srcIp && srcIp !== '0.0.0.0') {
        // Count by IP
        ipStats[srcIp] = (ipStats[srcIp] || 0) + 1
        
        // Mock geographic data (in production, use GeoIP service)
        const country = getCountryFromIP(srcIp)
        if (country) {
          countryStats[country] = (countryStats[country] || 0) + 1
        }
      }
    })
    
    return {
      countries: Object.entries(countryStats)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10),
      topIPs: Object.entries(ipStats)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 15),
      totalUniqueIPs: Object.keys(ipStats).length
    }
  }, [events])

  // Mock country detection (replace with real GeoIP in production)
  const getCountryFromIP = (ip) => {
    const mockCountries = ['US', 'CN', 'RU', 'DE', 'BR', 'IN', 'FR', 'GB', 'JP', 'CA']
    const hash = ip.split('.').reduce((acc, octet) => acc + parseInt(octet), 0)
    return mockCountries[hash % mockCountries.length]
  }

  return (
    <div className={`threat-map ${className}`}>
      <div className="threat-map__header">
        <h3>🌍 Global Threat Intelligence</h3>
        <div className="threat-map__stats">
          <span className="stat">
            <strong>{threatData.totalUniqueIPs}</strong> Unique IPs
          </span>
          <span className="stat">
            <strong>{threatData.countries.length}</strong> Countries
          </span>
        </div>
      </div>
      
      <div className="threat-map__grid">
        <div className="threat-map__section">
          <h4>🏴 Top Attack Sources by Country</h4>
          <div className="threat-map__country-list">
            {threatData.countries.map(([country, count]) => (
              <div key={country} className="threat-map__country-item">
                <div className="threat-map__country-flag">{getFlagEmoji(country)}</div>
                <div className="threat-map__country-info">
                  <span className="threat-map__country-code">{country}</span>
                  <div className="threat-map__country-bar">
                    <div 
                      className="threat-map__country-bar-fill" 
                      style={{ 
                        width: `${(count / threatData.countries[0][1]) * 100}%` 
                      }}
                    />
                  </div>
                  <span className="threat-map__country-count">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="threat-map__section">
          <h4>🎯 Most Active Attack IPs</h4>
          <div className="threat-map__ip-list">
            {threatData.topIPs.map(([ip, count]) => (
              <div key={ip} className="threat-map__ip-item">
                <code className="threat-map__ip">{ip}</code>
                <div className="threat-map__ip-stats">
                  <span className="threat-map__ip-count">{count} events</span>
                  <div className="threat-map__ip-severity">
                    {count > 50 ? '🔴' : count > 20 ? '🟡' : '🟢'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Mock flag emoji mapping
const getFlagEmoji = (countryCode) => {
  const flags = {
    'US': '🇺🇸', 'CN': '🇨🇳', 'RU': '🇷🇺', 'DE': '🇩🇪', 'BR': '🇧🇷',
    'IN': '🇮🇳', 'FR': '🇫🇷', 'GB': '🇬🇧', 'JP': '🇯🇵', 'CA': '🇨🇦'
  }
  return flags[countryCode] || '🏳️'
}

export default ThreatMap