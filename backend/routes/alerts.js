/**
 * Backend API endpoint for fetching alerts from DynamoDB
 * This will replace the mock data in AlertsTable.jsx
 */

const AWS = require('aws-sdk');
const express = require('express');
const router = express.Router();

// Configure AWS SDK
const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

const TABLE_NAME = process.env.DYNAMODB_ALERTS_TABLE || 'phantomwall-alerts-dev';

/**
 * GET /api/alerts
 * Fetch alerts from DynamoDB with filtering and pagination
 */
router.get('/alerts', async (req, res) => {
  try {
    const {
      severity,
      timeRange,
      sourceIP,
      alertType,
      limit = 50,
      lastKey
    } = req.query;

    // Build query parameters
    const queryParams = {
      TableName: TABLE_NAME,
      Limit: parseInt(limit),
      ScanIndexForward: false, // Most recent first
    };

    // Add pagination
    if (lastKey) {
      queryParams.ExclusiveStartKey = JSON.parse(decodeURIComponent(lastKey));
    }

    // Build filter expression
    const filterExpressions = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    // Time range filter
    if (timeRange && timeRange !== 'all') {
      const timeRangeMs = getTimeRangeMs(timeRange);
      const cutoffTime = new Date(Date.now() - timeRangeMs).toISOString();
      
      filterExpressions.push('#timestamp >= :cutoffTime');
      expressionAttributeNames['#timestamp'] = 'timestamp';
      expressionAttributeValues[':cutoffTime'] = cutoffTime;
    }

    // Severity filter
    if (severity && severity !== 'all') {
      filterExpressions.push('severity = :severity');
      expressionAttributeValues[':severity'] = parseInt(severity);
    }

    // Source IP filter
    if (sourceIP) {
      filterExpressions.push('contains(src_ip, :sourceIP)');
      expressionAttributeValues[':sourceIP'] = sourceIP;
    }

    // Alert type/category filter
    if (alertType && alertType !== 'all') {
      filterExpressions.push('category = :alertType');
      expressionAttributeValues[':alertType'] = alertType;
    }

    // Apply filters if any
    if (filterExpressions.length > 0) {
      queryParams.FilterExpression = filterExpressions.join(' AND ');
      queryParams.ExpressionAttributeValues = expressionAttributeValues;
      if (Object.keys(expressionAttributeNames).length > 0) {
        queryParams.ExpressionAttributeNames = expressionAttributeNames;
      }
    }

    // For now, use scan (you might want to optimize with query later)
    const result = await dynamodb.scan(queryParams).promise();

    // Format response
    const formattedAlerts = result.Items.map(item => ({
      id: item.SK, // Use sort key as ID
      timestamp: item.timestamp,
      severity: item.severity,
      sourceIP: item.src_ip,
      destIP: item.dest_ip,
      signature: item.signature,
      category: item.category,
      action: item.action,
      flow_id: item.flow_id,
      signature_id: item.signature_id
    }));

    // Sort by timestamp (most recent first)
    formattedAlerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      success: true,
      alerts: formattedAlerts,
      count: formattedAlerts.length,
      lastKey: result.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey)) : null,
      hasMore: !!result.LastEvaluatedKey
    });

  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts',
      message: error.message
    });
  }
});

/**
 * GET /api/alerts/stats
 * Get alert statistics for dashboard
 */
router.get('/alerts/stats', async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query;
    
    const timeRangeMs = getTimeRangeMs(timeRange);
    const cutoffTime = new Date(Date.now() - timeRangeMs).toISOString();

    const queryParams = {
      TableName: TABLE_NAME,
      FilterExpression: '#timestamp >= :cutoffTime',
      ExpressionAttributeNames: {
        '#timestamp': 'timestamp'
      },
      ExpressionAttributeValues: {
        ':cutoffTime': cutoffTime
      }
    };

    const result = await dynamodb.scan(queryParams).promise();

    // Calculate statistics
    const stats = {
      total: result.Items.length,
      critical: result.Items.filter(item => item.severity === 1).length,
      high: result.Items.filter(item => item.severity === 2).length,
      medium: result.Items.filter(item => item.severity === 3).length,
      low: result.Items.filter(item => item.severity === 4).length,
      topCategories: {},
      topSources: {}
    };

    // Calculate top categories and sources
    result.Items.forEach(item => {
      // Categories
      stats.topCategories[item.category] = (stats.topCategories[item.category] || 0) + 1;
      
      // Source IPs
      stats.topSources[item.src_ip] = (stats.topSources[item.src_ip] || 0) + 1;
    });

    // Convert to sorted arrays
    stats.topCategories = Object.entries(stats.topCategories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    stats.topSources = Object.entries(stats.topSources)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    res.json({
      success: true,
      stats,
      timeRange
    });

  } catch (error) {
    console.error('Error fetching alert stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alert statistics',
      message: error.message
    });
  }
});

/**
 * GET /api/alerts/:id
 * Get detailed information for a specific alert
 */
router.get('/alerts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Parse the sort key to get partition key info
    // SK format: TS#<iso8601>#ET#<type>#FLOW#<flow_id>#EID#<short>
    const skParts = id.split('#');
    if (skParts.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Invalid alert ID format'
      });
    }

    // For simplicity, scan for the specific SK
    // In production, you'd want to optimize this with the full key
    const queryParams = {
      TableName: TABLE_NAME,
      FilterExpression: 'SK = :sk',
      ExpressionAttributeValues: {
        ':sk': id
      }
    };

    const result = await dynamodb.scan(queryParams).promise();

    if (result.Items.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    const alert = result.Items[0];

    res.json({
      success: true,
      alert: {
        id: alert.SK,
        timestamp: alert.timestamp,
        severity: alert.severity,
        sourceIP: alert.src_ip,
        destIP: alert.dest_ip,
        signature: alert.signature,
        category: alert.category,
        action: alert.action,
        flow_id: alert.flow_id,
        signature_id: alert.signature_id,
        tenant_id: alert.tenant_id,
        fullData: alert.alert_data // Complete alert data from Suricata
      }
    });

  } catch (error) {
    console.error('Error fetching alert detail:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alert details',
      message: error.message
    });
  }
});

// Helper function to convert time range to milliseconds
function getTimeRangeMs(range) {
  switch (range) {
    case '15m': return 15 * 60 * 1000;
    case '1h': return 60 * 60 * 1000;
    case '6h': return 6 * 60 * 60 * 1000;
    case '24h': return 24 * 60 * 60 * 1000;
    case '7d': return 7 * 24 * 60 * 60 * 1000;
    case '30d': return 30 * 24 * 60 * 60 * 1000;
    default: return 60 * 60 * 1000; // 1 hour default
  }
}

module.exports = router;