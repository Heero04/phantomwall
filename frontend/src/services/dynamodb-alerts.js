// ==========================================
// 🚨 PhantomWall Dashboard - DynamoDB Alerts Integration
// ==========================================
// Example code for integrating DynamoDB alerts into your dashboard
// ==========================================

import AWS from 'aws-sdk'

// Configure AWS SDK
const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'us-east-1'
})

const TABLE_NAME = 'phantomwall-alerts-dev' // Update based on your environment

// ==========================================
// Feature Flag for Gradual Rollout
// ==========================================
const USE_DYNAMODB_ALERTS = process.env.ENABLE_DYNAMODB_ALERTS === 'true'

// ==========================================
// DynamoDB Alert Functions
// ==========================================

/**
 * Get recent alerts from DynamoDB (fast!)
 */
export async function getRecentAlerts(limit = 100, tenant = 'default') {
  try {
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'SK = :tenant',
      ExpressionAttributeValues: {
        ':tenant': `TENANT#${tenant}`
      },
      ScanIndexForward: false, // Latest first
      Limit: limit
    }

    const result = await dynamodb.query(params).promise()
    
    return result.Items.map(item => ({
      id: item.PK,
      timestamp: item.timestamp,
      signature: item.signature,
      severity: item.severity,
      category: item.category,
      src_ip: item.src_ip,
      dest_ip: item.dest_ip,
      flow_id: item.flow_id,
      raw_data: JSON.parse(item.raw_data)
    }))
    
  } catch (error) {
    console.error('Error fetching alerts from DynamoDB:', error)
    throw error
  }
}

/**
 * Get alerts by source IP (attacker pivot)
 */
export async function getAlertsBySourceIP(srcIP, limit = 50) {
  try {
    const params = {
      TableName: TABLE_NAME,
      IndexName: 'src-ip-index',
      KeyConditionExpression: 'src_ip = :src_ip',
      ExpressionAttributeValues: {
        ':src_ip': srcIP
      },
      ScanIndexForward: false,
      Limit: limit
    }

    const result = await dynamodb.query(params).promise()
    return result.Items
    
  } catch (error) {
    console.error('Error fetching alerts by source IP:', error)
    throw error
  }
}

/**
 * Get alerts by signature (rule drill-down)
 */
export async function getAlertsBySignature(signatureId, limit = 50) {
  try {
    const params = {
      TableName: TABLE_NAME,
      IndexName: 'signature-index',
      KeyConditionExpression: 'signature_id = :sig_id',
      ExpressionAttributeValues: {
        ':sig_id': signatureId
      },
      ScanIndexForward: false,
      Limit: limit
    }

    const result = await dynamodb.query(params).promise()
    return result.Items
    
  } catch (error) {
    console.error('Error fetching alerts by signature:', error)
    throw error
  }
}

// ==========================================
// Dashboard API Integration
// ==========================================

/**
 * Main alerts API endpoint with fallback capability
 */
export async function fetchAlerts(options = {}) {
  const { limit = 100, tenant = 'default', source = 'auto' } = options
  
  // Feature flag: choose data source
  if (USE_DYNAMODB_ALERTS && source !== 'cloudwatch') {
    try {
      console.log('📊 Fetching alerts from DynamoDB (fast path)')
      return await getRecentAlerts(limit, tenant)
    } catch (error) {
      console.warn('⚠️ DynamoDB failed, falling back to CloudWatch')
      // Fall through to CloudWatch fallback
    }
  }
  
  // Fallback: use your existing CloudWatch logic
  console.log('📋 Fetching alerts from CloudWatch (existing path)')
  return await fetchAlertsFromCloudWatch(limit) // Your existing function
}

/**
 * Alert metrics for dashboard tiles
 */
export async function getAlertMetrics(timeRange = '1h', tenant = 'default') {
  if (!USE_DYNAMODB_ALERTS) {
    return await getMetricsFromCloudWatch(timeRange) // Existing function
  }
  
  try {
    // Get recent alerts
    const alerts = await getRecentAlerts(1000, tenant)
    
    // Filter by time range
    const cutoff = new Date()
    cutoff.setHours(cutoff.getHours() - parseInt(timeRange))
    
    const recentAlerts = alerts.filter(alert => 
      new Date(alert.timestamp) > cutoff
    )
    
    // Calculate metrics
    const totalAlerts = recentAlerts.length
    const uniqueSources = new Set(recentAlerts.map(a => a.src_ip)).size
    const highSeverity = recentAlerts.filter(a => a.severity <= 2).length
    
    const topSignatures = recentAlerts
      .reduce((acc, alert) => {
        acc[alert.signature] = (acc[alert.signature] || 0) + 1
        return acc
      }, {})
    
    return {
      total_alerts: totalAlerts,
      unique_sources: uniqueSources,
      high_severity_alerts: highSeverity,
      top_signatures: Object.entries(topSignatures)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([signature, count]) => ({ signature, count }))
    }
    
  } catch (error) {
    console.error('Error calculating alert metrics:', error)
    return await getMetricsFromCloudWatch(timeRange) // Fallback
  }
}

// ==========================================
// Example React Component Integration
// ==========================================

/**
 * Example React hook for alerts
 */
export function useAlerts(refreshInterval = 30000) {
  const [alerts, setAlerts] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState(null)
  
  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchAlerts({ limit: 100 })
      setAlerts(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])
  
  React.useEffect(() => {
    fetchData()
    
    // Set up polling
    const interval = setInterval(fetchData, refreshInterval)
    return () => clearInterval(interval)
  }, [fetchData, refreshInterval])
  
  return { alerts, loading, error, refresh: fetchData }
}

// ==========================================
// Migration Strategy
// ==========================================

/**
 * Gradual migration function
 * Call this to test DynamoDB vs CloudWatch side-by-side
 */
export async function compareSources() {
  try {
    console.log('🔬 Comparing DynamoDB vs CloudWatch alerts...')
    
    const [dynamoAlerts, cloudwatchAlerts] = await Promise.all([
      getRecentAlerts(50),
      fetchAlertsFromCloudWatch(50)
    ])
    
    console.log(`DynamoDB returned ${dynamoAlerts.length} alerts`)
    console.log(`CloudWatch returned ${cloudwatchAlerts.length} alerts`)
    
    // Compare first few alerts for consistency
    if (dynamoAlerts.length > 0 && cloudwatchAlerts.length > 0) {
      console.log('Latest DynamoDB alert:', dynamoAlerts[0])
      console.log('Latest CloudWatch alert:', cloudwatchAlerts[0])
    }
    
    return { dynamoAlerts, cloudwatchAlerts }
    
  } catch (error) {
    console.error('Error comparing sources:', error)
  }
}

// ==========================================
// Environment Variables for Configuration
// ==========================================

/*
Set these environment variables to control behavior:

ENABLE_DYNAMODB_ALERTS=true     # Enable DynamoDB alerts
AWS_REGION=us-east-1            # AWS region
DYNAMODB_TABLE_NAME=phantomwall-alerts-dev  # Table name

Example usage in your dashboard:

// Enable DynamoDB alerts
process.env.ENABLE_DYNAMODB_ALERTS = 'true'

// Use the new alerts API
const alerts = await fetchAlerts({ limit: 100 })

// Get alert metrics for dashboard tiles
const metrics = await getAlertMetrics('1h')

*/