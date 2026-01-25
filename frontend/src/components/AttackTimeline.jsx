import React, { useMemo } from 'react'

const AttackTimeline = ({ events, className = '' }) => {
  const timelineData = useMemo(() => {
    // Group events by hour for the last 24 hours
    const now = new Date()
    const hoursData = Array.from({ length: 24 }, (_, i) => {
      const hour = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000)
      return {
        hour: hour.getHours(),
        timestamp: hour.getTime(),
        events: [],
        total: 0,
        high_severity: 0,
        medium_severity: 0,
        low_severity: 0
      }
    })

    // Populate with actual events
    events.forEach(event => {
      const eventTime = new Date(event.event_time || event.timestamp)
      const hourIndex = Math.floor((now.getTime() - eventTime.getTime()) / (60 * 60 * 1000))
      
      if (hourIndex >= 0 && hourIndex < 24) {
        const dataIndex = 23 - hourIndex
        if (hoursData[dataIndex]) {
          hoursData[dataIndex].events.push(event)
          hoursData[dataIndex].total++
          
          // Categorize by severity
          const severity = event.alert?.severity || event.severity || 3
          if (severity === 1) hoursData[dataIndex].high_severity++
          else if (severity === 2) hoursData[dataIndex].medium_severity++
          else hoursData[dataIndex].low_severity++
        }
      }
    })

    return hoursData
  }, [events])

  const maxEvents = Math.max(...timelineData.map(d => d.total), 1)

  return (
    <div className={`attack-timeline ${className}`}>
      <div className="attack-timeline__header">
        <h3>⏰ 24-Hour Attack Timeline</h3>
        <div className="attack-timeline__legend">
          <span className="legend-item legend-item--high">🔴 High</span>
          <span className="legend-item legend-item--medium">🟡 Medium</span>
          <span className="legend-item legend-item--low">🟢 Low</span>
        </div>
      </div>
      
      <div className="attack-timeline__chart">
        <svg 
          className="attack-timeline__svg" 
          viewBox="0 0 800 200" 
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="timelineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(percent => (
            <line
              key={percent}
              x1="50"
              x2="750"
              y1={180 - (percent / 100) * 160}
              y2={180 - (percent / 100) * 160}
              stroke="#e5e7eb"
              strokeWidth="1"
              opacity="0.5"
            />
          ))}
          
          {/* Timeline bars */}
          {timelineData.map((data, index) => {
            const x = 50 + (index * (700 / 24))
            const barWidth = 700 / 24 - 2
            const totalHeight = (data.total / maxEvents) * 160
            
            return (
              <g key={index}>
                {/* Total bar background */}
                <rect
                  x={x}
                  y={180 - totalHeight}
                  width={barWidth}
                  height={totalHeight}
                  fill="url(#timelineGradient)"
                  opacity="0.3"
                />
                
                {/* Severity segments */}
                {data.total > 0 && (
                  <>
                    {/* High severity (red) */}
                    <rect
                      x={x}
                      y={180 - (data.high_severity / maxEvents) * 160}
                      width={barWidth}
                      height={(data.high_severity / maxEvents) * 160}
                      fill="#ef4444"
                      opacity="0.8"
                    />
                    
                    {/* Medium severity (yellow) */}
                    <rect
                      x={x}
                      y={180 - ((data.high_severity + data.medium_severity) / maxEvents) * 160}
                      width={barWidth}
                      height={(data.medium_severity / maxEvents) * 160}
                      fill="#f59e0b"
                      opacity="0.7"
                    />
                    
                    {/* Low severity (green) */}
                    <rect
                      x={x}
                      y={180 - totalHeight}
                      width={barWidth}
                      height={(data.low_severity / maxEvents) * 160}
                      fill="#10b981"
                      opacity="0.6"
                    />
                  </>
                )}
                
                {/* Hour label */}
                <text
                  x={x + barWidth / 2}
                  y="195"
                  textAnchor="middle"
                  fontSize="10"
                  fill="#6b7280"
                >
                  {data.hour.toString().padStart(2, '0')}:00
                </text>
                
                {/* Tooltip area */}
                <rect
                  x={x}
                  y={20}
                  width={barWidth}
                  height={160}
                  fill="transparent"
                  className="attack-timeline__tooltip-trigger"
                >
                  <title>
                    {`${data.hour.toString().padStart(2, '0')}:00 - ${data.total} events\nHigh: ${data.high_severity}, Medium: ${data.medium_severity}, Low: ${data.low_severity}`}
                  </title>
                </rect>
              </g>
            )
          })}
          
          {/* Y-axis labels */}
          {[0, 25, 50, 75, 100].map(percent => (
            <text
              key={percent}
              x="45"
              y={185 - (percent / 100) * 160}
              textAnchor="end"
              fontSize="10"
              fill="#6b7280"
            >
              {Math.round((percent / 100) * maxEvents)}
            </text>
          ))}
        </svg>
      </div>
      
      <div className="attack-timeline__summary">
        <div className="summary-stat">
          <span>Peak Hour</span>
          <strong>
            {timelineData.reduce((max, curr) => curr.total > max.total ? curr : max, timelineData[0])
              .hour.toString().padStart(2, '0')}:00
          </strong>
        </div>
        <div className="summary-stat">
          <span>Total Events</span>
          <strong>{timelineData.reduce((sum, curr) => sum + curr.total, 0)}</strong>
        </div>
        <div className="summary-stat">
          <span>Avg/Hour</span>
          <strong>{Math.round(timelineData.reduce((sum, curr) => sum + curr.total, 0) / 24)}</strong>
        </div>
      </div>
    </div>
  )
}

export default AttackTimeline