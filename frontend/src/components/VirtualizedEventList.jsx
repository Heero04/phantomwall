import React, { useState, useMemo, useCallback } from 'react'

const VirtualizedEventList = ({ events, onEventSelect, className = '' }) => {
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(400)
  
  const ITEM_HEIGHT = 60
  const BUFFER_SIZE = 5
  
  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_SIZE)
    const endIndex = Math.min(
      events.length - 1,
      Math.floor((scrollTop + containerHeight) / ITEM_HEIGHT) + BUFFER_SIZE
    )
    return { startIndex, endIndex }
  }, [scrollTop, containerHeight, events.length])
  
  // Get visible events
  const visibleEvents = useMemo(() => {
    return events.slice(visibleRange.startIndex, visibleRange.endIndex + 1)
  }, [events, visibleRange])
  
  // Handle scroll
  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop)
  }, [])
  
  // Format event for display
  const formatEvent = useCallback((event) => {
    const timestamp = new Date(event.event_time || event.timestamp).toLocaleTimeString()
    const severity = event.alert?.severity || event.severity || 3
    const signature = event.alert?.signature || event.signature || 'Unknown Event'
    const srcIp = event.src_ip || event.source_ip || 'Unknown'
    const destPort = event.dest_port || event.destination_port || '--'
    
    return {
      timestamp,
      severity,
      signature: signature.length > 60 ? signature.substring(0, 60) + '...' : signature,
      srcIp,
      destPort,
      severityColor: severity === 1 ? '#dc2626' : severity === 2 ? '#ea580c' : '#16a34a',
      severityLabel: severity === 1 ? 'HIGH' : severity === 2 ? 'MED' : 'LOW'
    }
  }, [])
  
  return (
    <div className={`virtualized-event-list ${className}`}>
      <div className="virtualized-event-list__header">
        <h3>📋 Event Stream ({events.length.toLocaleString()} events)</h3>
        <div className="virtualized-event-list__stats">
          <span>Showing {visibleEvents.length} of {events.length}</span>
        </div>
      </div>
      
      <div 
        className="virtualized-event-list__container"
        style={{ height: containerHeight }}
        onScroll={handleScroll}
      >
        <div 
          className="virtualized-event-list__spacer"
          style={{ height: events.length * ITEM_HEIGHT }}
        >
          <div 
            className="virtualized-event-list__visible-area"
            style={{ 
              transform: `translateY(${visibleRange.startIndex * ITEM_HEIGHT}px)` 
            }}
          >
            {visibleEvents.map((event, index) => {
              const actualIndex = visibleRange.startIndex + index
              const formattedEvent = formatEvent(event)
              
              return (
                <div
                  key={actualIndex}
                  className="virtualized-event-list__item"
                  onClick={() => onEventSelect?.(event, actualIndex)}
                  style={{ height: ITEM_HEIGHT }}
                >
                  <div className="event-item__main">
                    <div className="event-item__header">
                      <span className="event-item__timestamp">{formattedEvent.timestamp}</span>
                      <span 
                        className="event-item__severity"
                        style={{ backgroundColor: formattedEvent.severityColor }}
                      >
                        {formattedEvent.severityLabel}
                      </span>
                    </div>
                    <div className="event-item__signature">{formattedEvent.signature}</div>
                    <div className="event-item__details">
                      <span className="event-item__ip">🎯 {formattedEvent.srcIp}</span>
                      <span className="event-item__port">:{formattedEvent.destPort}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default VirtualizedEventList