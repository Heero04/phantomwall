import json
import boto3
import gzip
import base64
import logging
from datetime import datetime, timedelta
import os
import hashlib

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb')
table_name = os.environ['DYNAMODB_TABLE']
table = dynamodb.Table(table_name)

def lambda_handler(event, context):
    """
    Process CloudWatch Logs events and index alerts to DynamoDB
    """
    try:
        # Decode CloudWatch Logs data
        log_data = event['awslogs']['data']
        compressed_payload = base64.b64decode(log_data)
        uncompressed_payload = gzip.decompress(compressed_payload)
        log_events = json.loads(uncompressed_payload)
        
        logger.info(f"Processing {len(log_events['logEvents'])} log events")
        
        alerts_processed = 0
        for log_event in log_events['logEvents']:
            if process_log_event(log_event, log_events['logGroup']):
                alerts_processed += 1
        
        logger.info(f"Successfully processed {alerts_processed} alerts")
        return {
            'statusCode': 200,
            'body': json.dumps({
                'processed': alerts_processed,
                'timestamp': datetime.utcnow().isoformat()
            })
        }
        
    except Exception as e:
        logger.error(f"Error processing log events: {str(e)}")
        raise

def process_log_event(log_event, log_group):
    """
    Process a single log event and index alert if it contains one
    """
    try:
        # Parse JSON log message
        message = log_event['message'].strip()
        if not message:
            return False
            
        log_data = json.loads(message)
        
        # Only process alerts
        if log_data.get('event_type') != 'alert':
            return False
        
        # Extract tenant from log group name
        tenant_id = extract_tenant_from_log_group(log_group)
        
        # Index the alert
        return index_alert(log_data, tenant_id, log_event['timestamp'])
        
    except json.JSONDecodeError:
        logger.debug(f"Non-JSON log message: {log_event['message'][:100]}")
        return False
    except Exception as e:
        logger.error(f"Error processing log event: {str(e)}")
        return False

def extract_tenant_from_log_group(log_group):
    """
    Extract tenant ID from log group name
    Default implementation - adjust based on your naming convention
    """
    # Example: /aws/ec2/suricata-tenant1 -> tenant1
    # Example: /aws/ec2/suricata -> default
    
    parts = log_group.split('/')
    if len(parts) > 2 and 'tenant' in parts[-1]:
        return parts[-1].split('-')[-1]
    
    return 'default'

def index_alert(alert_data, tenant_id, timestamp):
    """
    Index alert to DynamoDB with optimized structure
    """
    try:
        # Create timestamp
        alert_time = datetime.fromtimestamp(timestamp / 1000)
        iso_timestamp = alert_time.isoformat()
        
        # Extract key fields
        flow_id = alert_data.get('flow_id', 0)
        signature_id = alert_data.get('alert', {}).get('signature_id', 0)
        event_type = alert_data.get('event_type', 'alert')
        
        # Create unique event ID
        event_id = create_event_id(alert_data)
        
        # Create partition and sort keys
        pk = f"TENANT#{tenant_id}"
        sk = f"TS#{iso_timestamp}#ET#{event_type}#FLOW#{flow_id}#EID#{event_id}"
        
        # Prepare item for DynamoDB
        item = {
            'PK': pk,
            'SK': sk,
            'tenant_id': tenant_id,
            'timestamp': iso_timestamp,
            'epoch_timestamp': int(timestamp / 1000),
            'event_type': event_type,
            'flow_id': flow_id,
            'signature_id': signature_id,
            'src_ip': alert_data.get('src_ip', ''),
            'src_port': alert_data.get('src_port', 0),
            'dest_ip': alert_data.get('dest_ip', ''),
            'dest_port': alert_data.get('dest_port', 0),
            'proto': alert_data.get('proto', ''),
            'ttl': int((alert_time + timedelta(days=30)).timestamp()),
            'alert_data': alert_data  # Store full alert for detailed queries
        }
        
        # Add alert-specific fields
        if 'alert' in alert_data:
            alert_info = alert_data['alert']
            item.update({
                'signature': alert_info.get('signature', ''),
                'category': alert_info.get('category', ''),
                'severity': alert_info.get('severity', 3),
                'action': alert_info.get('action', '')
            })
        
        # Write to DynamoDB with idempotent operation
        table.put_item(
            Item=item,
            ConditionExpression='attribute_not_exists(PK)'
        )
        
        logger.debug(f"Indexed alert: {pk}#{sk}")
        return True
        
    except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
        # Alert already exists - this is expected for retries
        logger.debug(f"Alert already exists: {pk}#{sk}")
        return True
    except Exception as e:
        logger.error(f"Error indexing alert: {str(e)}")
        return False

def create_event_id(alert_data):
    """
    Create a short, unique event ID for deduplication
    """
    # Create hash from key fields
    key_fields = {
        'flow_id': alert_data.get('flow_id', 0),
        'signature_id': alert_data.get('alert', {}).get('signature_id', 0),
        'src_ip': alert_data.get('src_ip', ''),
        'dest_ip': alert_data.get('dest_ip', ''),
        'timestamp': alert_data.get('timestamp', '')
    }
    
    # Create short hash
    content = json.dumps(key_fields, sort_keys=True)
    return hashlib.md5(content.encode()).hexdigest()[:8]