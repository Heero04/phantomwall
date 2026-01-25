import json
import boto3
import gzip
import base64
import os
import time

# Initialize DynamoDB client
dynamodb = boto3.client('dynamodb')
TABLE_NAME = os.environ['DYNAMODB_TABLE']

def handler(event, context):
    """
    Process CloudWatch Logs events and index alerts to DynamoDB
    """
    
    print(f"Processing {len(event.get('Records', []))} records")
    
    for record in event.get('Records', []):
        try:
            # Parse CloudWatch Logs data
            cw_data = record['awslogs']['data']
            
            # Decode and decompress the log data
            compressed_payload = base64.b64decode(cw_data)
            uncompressed_payload = gzip.decompress(compressed_payload)
            log_data = json.loads(uncompressed_payload)
            
            # Process each log event
            for log_event in log_data['logEvents']:
                try:
                    # Parse the Suricata JSON
                    suricata_event = json.loads(log_event['message'])
                    
                    # Only process alerts
                    if suricata_event.get('event_type') != 'alert':
                        continue
                    
                    # Index the alert
                    index_alert(suricata_event, log_data['logGroup'])
                    
                except json.JSONDecodeError:
                    print(f"Failed to parse log message: {log_event['message']}")
                    continue
                except Exception as e:
                    print(f"Error processing log event: {e}")
                    continue
                    
        except Exception as e:
            print(f"Error processing record: {e}")
            continue
    
    return {'statusCode': 200, 'body': 'Processing complete'}

def index_alert(alert_data, log_group):
    """
    Index a single alert to DynamoDB
    """
    
    try:
        # Extract key information
        timestamp = alert_data.get('timestamp')
        flow_id = alert_data.get('flow_id')
        src_ip = alert_data.get('src_ip')
        dest_ip = alert_data.get('dest_ip')
        
        # Extract alert details
        alert_info = alert_data.get('alert', {})
        signature_id = alert_info.get('signature_id')
        signature = alert_info.get('signature', '')
        severity = alert_info.get('severity')
        category = alert_info.get('category', '')
        
        # Create unique primary key
        pk = f"ALERT#{timestamp}#{flow_id}"
        
        # Derive tenant from log group or use a default
        # You can customize this based on your log group naming
        tenant = extract_tenant_from_log_group(log_group)
        sk = f"TENANT#{tenant}"
        
        # Create DynamoDB item
        item = {
            'PK': {'S': pk},
            'SK': {'S': sk},
            'timestamp': {'S': timestamp},
            'flow_id': {'N': str(flow_id)},
            'src_ip': {'S': src_ip},
            'dest_ip': {'S': dest_ip},
            'signature_id': {'N': str(signature_id)},
            'signature': {'S': signature},
            'severity': {'N': str(severity)},
            'category': {'S': category},
            'ttl': {'N': str(int(time.time()) + (30 * 24 * 60 * 60))},  # 30 days TTL
            'raw_data': {'S': json.dumps(alert_data)}  # Store complete original data
        }
        
        # Write to DynamoDB (idempotent)
        dynamodb.put_item(
            TableName=TABLE_NAME,
            Item=item,
            ConditionExpression='attribute_not_exists(PK)'  # Prevent duplicates
        )
        
        print(f"Indexed alert: {signature} from {src_ip}")
        
    except dynamodb.exceptions.ConditionalCheckFailedException:
        # Alert already exists - this is fine (idempotent)
        print(f"Alert already indexed: {pk}")
    except Exception as e:
        print(f"Error indexing alert: {e}")
        # Don't raise - we want to continue processing other alerts

def extract_tenant_from_log_group(log_group):
    """
    Extract tenant identifier from log group name
    Customize this based on your naming convention
    """
    
    # Example: "/aws/ec2/honeypot-1/suricata" -> "honeypot-1"
    # Or: "/aws/ec2/suricata" -> "default"
    
    if 'honeypot' in log_group:
        parts = log_group.split('/')
        for part in parts:
            if 'honeypot' in part:
                return part
    
    # Default tenant if no specific identifier found
    return "default"

def lambda_handler(event, context):
    """
    Main Lambda handler - wrapper for error handling
    """
    try:
        return handler(event, context)
    except Exception as e:
        print(f"Lambda handler error: {e}")
        return {
            'statusCode': 500,
            'body': f'Error: {str(e)}'
        }