import React, { useState, useMemo, useCallback } from 'react'

const AdvancedFilterPanel = ({ 
  events, 
  onFiltersChange, 
  initialFilters = {},
  className = '' 
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [filters, setFilters] = useState({
    dateRange: { start: '', end: '' },
    severity: [],
    sourceIPs: [],
    signature: '',
    attackTypes: [],
    ports: [],
    customQuery: '',
    ...initialFilters
  })
  
  const [savedFilters, setSavedFilters] = useState([
    { name: 'High Severity', filters: { severity: [1] } },
    { name: 'Brute Force', filters: { signature: 'brute' } },
    { name: 'Last Hour', filters: { dateRange: { start: new Date(Date.now() - 3600000).toISOString() } } }
  ])
  
  // Extract unique values from events for filter options
  const filterOptions = useMemo(() => {
    const sourceIPs = new Set()
    const attackTypes = new Set()
    const ports = new Set()
    
    events.forEach(event => {
      // Source IPs
      const srcIp = event.src_ip || event.source_ip
      if (srcIp && srcIp !== '0.0.0.0') sourceIPs.add(srcIp)
      
      // Attack types (derived from signature)
      const signature = event.alert?.signature || event.signature || ''
      const attackType = categorizeAttack(signature)
      if (attackType !== 'Other') attackTypes.add(attackType)
      
      // Ports
      const port = event.dest_port || event.destination_port
      if (port) ports.add(port)
    })
    
    return {
      sourceIPs: Array.from(sourceIPs).sort(),
      attackTypes: Array.from(attackTypes).sort(),
      ports: Array.from(ports).sort((a, b) => Number(a) - Number(b))
    }
  }, [events])
  
  const categorizeAttack = useCallback((signature) => {
    const sig = signature.toLowerCase()
    if (sig.includes('brute') || sig.includes('login')) return 'Brute Force'
    if (sig.includes('scan') || sig.includes('probe')) return 'Reconnaissance'
    if (sig.includes('exploit') || sig.includes('vulnerability')) return 'Exploitation'
    if (sig.includes('malware') || sig.includes('trojan')) return 'Malware'
    if (sig.includes('dos') || sig.includes('flood')) return 'DoS Attack'
    if (sig.includes('web') || sig.includes('http')) return 'Web Attack'
    return 'Other'
  }, [])
  
  // Apply filters
  const applyFilters = useCallback(() => {
    onFiltersChange?.(filters)
  }, [filters, onFiltersChange])
  
  // Update filter
  const updateFilter = useCallback((key, value) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value }
      return newFilters
    })
  }, [])
  
  // Clear all filters
  const clearAllFilters = useCallback(() => {
    const emptyFilters = {
      dateRange: { start: '', end: '' },
      severity: [],
      sourceIPs: [],
      signature: '',
      attackTypes: [],
      ports: [],
      customQuery: ''
    }
    setFilters(emptyFilters)
    onFiltersChange?.(emptyFilters)
  }, [onFiltersChange])
  
  // Save current filter preset
  const saveFilterPreset = useCallback(() => {
    const name = prompt('Enter a name for this filter preset:')
    if (name && name.trim()) {
      setSavedFilters(prev => [...prev, { name: name.trim(), filters: { ...filters } }])
    }
  }, [filters])
  
  // Load filter preset
  const loadFilterPreset = useCallback((preset) => {
    setFilters({ ...filters, ...preset.filters })
    onFiltersChange?.({ ...filters, ...preset.filters })
  }, [filters, onFiltersChange])
  
  return (
    <div className={`advanced-filter-panel ${className} ${isExpanded ? 'expanded' : ''}`}>
      <div className="filter-panel__header">
        <button 
          className="filter-panel__toggle"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span>🔍 Advanced Filters</span>
          <span className={`filter-panel__chevron ${isExpanded ? 'rotated' : ''}`}>▼</span>
        </button>
        
        <div className="filter-panel__quick-actions">
          <button 
            className="filter-panel__action filter-panel__action--secondary"
            onClick={clearAllFilters}
          >
            Clear All
          </button>
          <button 
            className="filter-panel__action filter-panel__action--primary"
            onClick={applyFilters}
          >
            Apply Filters
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="filter-panel__content">
          {/* Saved Filter Presets */}
          <div className="filter-section">
            <h4>📌 Quick Filters</h4>
            <div className="filter-presets">
              {savedFilters.map((preset, index) => (
                <button
                  key={index}
                  className="filter-preset-button"
                  onClick={() => loadFilterPreset(preset)}
                >
                  {preset.name}
                </button>
              ))}
              <button
                className="filter-preset-button filter-preset-button--save"
                onClick={saveFilterPreset}
              >
                + Save Current
              </button>
            </div>
          </div>
          
          {/* Date Range Filter */}
          <div className="filter-section">
            <h4>📅 Date Range</h4>
            <div className="date-range-inputs">
              <input
                type="datetime-local"
                value={filters.dateRange.start}
                onChange={(e) => updateFilter('dateRange', { ...filters.dateRange, start: e.target.value })}
                className="filter-input"
                placeholder="Start date"
              />
              <input
                type="datetime-local"
                value={filters.dateRange.end}
                onChange={(e) => updateFilter('dateRange', { ...filters.dateRange, end: e.target.value })}
                className="filter-input"
                placeholder="End date"
              />
            </div>
          </div>
          
          {/* Severity Filter */}
          <div className="filter-section">
            <h4>⚠️ Severity</h4>
            <div className="severity-checkboxes">
              {[
                { value: 1, label: 'High', color: '#dc2626' },
                { value: 2, label: 'Medium', color: '#ea580c' },
                { value: 3, label: 'Low', color: '#16a34a' }
              ].map(severity => (
                <label key={severity.value} className="severity-checkbox">
                  <input
                    type="checkbox"
                    checked={filters.severity.includes(severity.value)}
                    onChange={(e) => {
                      const newSeverity = e.target.checked 
                        ? [...filters.severity, severity.value]
                        : filters.severity.filter(s => s !== severity.value)
                      updateFilter('severity', newSeverity)
                    }}
                  />
                  <span 
                    className="severity-label"
                    style={{ borderColor: severity.color, color: severity.color }}
                  >
                    {severity.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
          
          {/* Attack Types Filter */}
          <div className="filter-section">
            <h4>🎯 Attack Types</h4>
            <div className="attack-type-grid">
              {filterOptions.attackTypes.map(type => (
                <label key={type} className="attack-type-checkbox">
                  <input
                    type="checkbox"
                    checked={filters.attackTypes.includes(type)}
                    onChange={(e) => {
                      const newTypes = e.target.checked
                        ? [...filters.attackTypes, type]
                        : filters.attackTypes.filter(t => t !== type)
                      updateFilter('attackTypes', newTypes)
                    }}
                  />
                  <span className="attack-type-label">{type}</span>
                </label>
              ))}
            </div>
          </div>
          
          {/* Source IP Filter */}
          <div className="filter-section">
            <h4>🌐 Source IPs</h4>
            <select
              multiple
              value={filters.sourceIPs}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions, option => option.value)
                updateFilter('sourceIPs', values)
              }}
              className="filter-select"
              size="5"
            >
              {filterOptions.sourceIPs.map(ip => (
                <option key={ip} value={ip}>{ip}</option>
              ))}
            </select>
          </div>
          
          {/* Port Filter */}
          <div className="filter-section">
            <h4>🚪 Target Ports</h4>
            <div className="port-filter">
              <select
                multiple
                value={filters.ports}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, option => option.value)
                  updateFilter('ports', values)
                }}
                className="filter-select"
                size="4"
              >
                {filterOptions.ports.map(port => (
                  <option key={port} value={port}>:{port}</option>
                ))}
              </select>
              <div className="common-ports">
                <span>Common:</span>
                {['22', '80', '443', '21', '25', '53'].map(port => (
                  <button
                    key={port}
                    className={`port-button ${filters.ports.includes(port) ? 'active' : ''}`}
                    onClick={() => {
                      const newPorts = filters.ports.includes(port)
                        ? filters.ports.filter(p => p !== port)
                        : [...filters.ports, port]
                      updateFilter('ports', newPorts)
                    }}
                  >
                    :{port}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Signature Search */}
          <div className="filter-section">
            <h4>🔎 Signature Search</h4>
            <input
              type="text"
              value={filters.signature}
              onChange={(e) => updateFilter('signature', e.target.value)}
              className="filter-input"
              placeholder="Search in alert signatures..."
            />
          </div>
          
          {/* Custom Query */}
          <div className="filter-section">
            <h4>🧮 Custom Query</h4>
            <textarea
              value={filters.customQuery}
              onChange={(e) => updateFilter('customQuery', e.target.value)}
              className="filter-textarea"
              placeholder="Advanced query (e.g., severity:1 AND src_ip:192.168.*)"
              rows="3"
            />
            <div className="query-help">
              <small>
                Syntax: field:value, AND, OR, NOT, wildcards (*)
              </small>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdvancedFilterPanel