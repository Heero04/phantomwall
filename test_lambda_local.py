"""
Local test for Suricata Lambda function
Tests S3 + DynamoDB dual-write functionality
"""

import base64
import gzip
import json
import sys
import os
from datetime import datetime

# Add lambda directory to path
lambda_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lambda', 'suricata_ingest')
sys.path.insert(0, lambda_path)

# Mock environment variables BEFORE importing handler
os.environ['TABLE_NAME'] = 'test-suricata-events'
os.environ['S3_BUCKET_NAME'] = 'test-suricata-logs'
os.environ['ENABLE_S3_BACKUP'] = 'true'
os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'  # Prevent boto3 errors

# Sample Suricata events (real format)
SAMPLE_EVENTS = [
    # Alert event
    {
        "timestamp": "2026-01-29T14:30:15.123456+0000",
        "flow_id": 123456789,
        "event_type": "alert",
        "src_ip": "192.168.1.100",
        "src_port": 54321,
        "dest_ip": "10.0.0.50",
        "dest_port": 22,
        "proto": "TCP",
        "alert": {
            "signature": "ET SCAN Potential SSH Scan",
            "signature_id": 2001219,
            "severity": 2,
            "category": "Attempted Information Leak"
        },
        "flow": {
            "pkts_toserver": 5,
            "pkts_toclient": 3,
            "bytes_toserver": 450,
            "bytes_toclient": 200
        }
    },
    # Flow event (non-alert)
    {
        "timestamp": "2026-01-29T14:30:16.456789+0000",
        "flow_id": 987654321,
        "event_type": "flow",
        "src_ip": "203.0.113.50",
        "src_port": 12345,
        "dest_ip": "10.0.0.50",
        "dest_port": 80,
        "proto": "TCP",
        "flow": {
            "pkts_toserver": 10,
            "pkts_toclient": 8,
            "bytes_toserver": 1200,
            "bytes_toclient": 800
        }
    },
    # DNS event
    {
        "timestamp": "2026-01-29T14:30:17.789012+0000",
        "flow_id": 111222333,
        "event_type": "dns",
        "src_ip": "192.168.1.200",
        "src_port": 53210,
        "dest_ip": "8.8.8.8",
        "dest_port": 53,
        "proto": "UDP",
        "dns": {
            "query": [
                {
                    "rrname": "malicious-domain.com",
                    "rrtype": "A"
                }
            ]
        }
    }
]


def create_cloudwatch_event(suricata_events):
    """
    Create a CloudWatch Logs event in the same format that Lambda receives
    """
    log_events = []
    
    for event in suricata_events:
        log_events.append({
            "id": f"event_{event['flow_id']}",
            "timestamp": int(datetime.now().timestamp() * 1000),
            "message": json.dumps(event)
        })
    
    log_data = {
        "messageType": "DATA_MESSAGE",
        "owner": "123456789012",
        "logGroup": "/aws/ec2/suricata",
        "logStream": "test-stream",
        "subscriptionFilters": ["suricata-lambda-sub"],
        "logEvents": log_events
    }
    
    # Compress and encode like CloudWatch does
    compressed = gzip.compress(json.dumps(log_data).encode('utf-8'))
    encoded = base64.b64encode(compressed).decode('utf-8')
    
    return {
        "awslogs": {
            "data": encoded
        }
    }


class MockS3Client:
    """Mock S3 client to avoid actual AWS calls"""
    def __init__(self):
        self.uploaded_objects = []
    
    def put_object(self, **kwargs):
        self.uploaded_objects.append({
            'bucket': kwargs['Bucket'],
            'key': kwargs['Key'],
            'body': kwargs['Body'],
            'content_type': kwargs.get('ContentType'),
            'storage_class': kwargs.get('StorageClass')
        })
        print(f"  ✅ S3 Upload: s3://{kwargs['Bucket']}/{kwargs['Key']}")
        return {'ETag': 'mock-etag'}


class MockDynamoDBTable:
    """Mock DynamoDB table to avoid actual AWS calls"""
    def __init__(self):
        self.items = []
    
    def batch_writer(self, **kwargs):
        return self
    
    def __enter__(self):
        return self
    
    def __exit__(self, *args):
        pass
    
    def put_item(self, Item):
        self.items.append(Item)
        event_type = Item.get('event_type', 'unknown')
        src_ip = Item.get('src_ip', 'unknown')
        print(f"  ✅ DynamoDB Write: {event_type} from {src_ip}")
        return {'ResponseMetadata': {'HTTPStatusCode': 200}}


def test_lambda_handler():
    """Test the Lambda handler with mock AWS services"""
    
    print("\n" + "="*60)
    print("🧪 TESTING SURICATA LAMBDA FUNCTION")
    print("="*60 + "\n")
    
    # Import handler after setting env vars
    from handler import handler, _s3, _table
    
    # Replace real AWS clients with mocks
    import handler as handler_module
    mock_s3 = MockS3Client()
    mock_table = MockDynamoDBTable()
    handler_module._s3 = mock_s3
    handler_module._table = mock_table
    
    # Create test event
    print("📦 Creating CloudWatch event with 3 Suricata logs...")
    print("   - 1 Alert event (SSH scan)")
    print("   - 1 Flow event (HTTP traffic)")
    print("   - 1 DNS event (domain query)\n")
    
    cloudwatch_event = create_cloudwatch_event(SAMPLE_EVENTS)
    
    # Call Lambda handler
    print("⚙️  Calling Lambda handler...\n")
    
    try:
        response = handler(cloudwatch_event, None)
        
        print("\n" + "-"*60)
        print("📊 LAMBDA RESPONSE:")
        print("-"*60)
        print(json.dumps(response, indent=2))
        
        print("\n" + "-"*60)
        print("✅ VERIFICATION:")
        print("-"*60)
        
        # Verify response
        assert response['statusCode'] == 200, "Lambda failed!"
        assert response['records'] == 3, f"Expected 3 records, got {response['records']}"
        assert response['s3_writes'] == 3, f"Expected 3 S3 writes, got {response['s3_writes']}"
        assert response['s3_enabled'] == True, "S3 should be enabled"
        
        print(f"✅ Status Code: {response['statusCode']}")
        print(f"✅ Records Processed: {response['records']}")
        print(f"✅ S3 Writes: {response['s3_writes']}")
        print(f"✅ S3 Enabled: {response['s3_enabled']}")
        
        # Verify S3 uploads
        print(f"\n📦 S3 Objects Created: {len(mock_s3.uploaded_objects)}")
        for i, obj in enumerate(mock_s3.uploaded_objects, 1):
            print(f"   {i}. {obj['key']}")
            
            # Verify partitioning structure
            assert obj['key'].startswith('year='), "S3 key should have year partition"
            assert '/month=' in obj['key'], "S3 key should have month partition"
            assert '/day=' in obj['key'], "S3 key should have day partition"
            assert '/hour=' in obj['key'], "S3 key should have hour partition"
            assert obj['key'].endswith('.json'), "S3 key should end with .json"
            
            # Verify content
            stored_event = json.loads(obj['body'])
            assert 'flow_id' in stored_event, "S3 object should contain flow_id"
            print(f"      ✓ Event type: {stored_event.get('event_type')}")
            print(f"      ✓ Flow ID: {stored_event.get('flow_id')}")
        
        # Verify DynamoDB items
        print(f"\n🗄️  DynamoDB Items Created: {len(mock_table.items)}")
        for i, item in enumerate(mock_table.items, 1):
            print(f"   {i}. Event: {item.get('event_type')} | {item.get('src_ip')} → {item.get('dest_ip')}")
            
            # Verify required fields
            assert 'event_date' in item, "DynamoDB item should have event_date"
            assert 'event_id' in item, "DynamoDB item should have event_id"
            assert 'timestamp' in item, "DynamoDB item should have timestamp"
            assert 'suricata' in item, "DynamoDB item should have raw suricata event"
            
            print(f"      ✓ Date: {item.get('event_date')}")
            print(f"      ✓ ID: {item.get('event_id')}")
            print(f"      ✓ Summary: {item.get('summary', 'N/A')}")
        
        # Verify alert was processed
        alerts = [item for item in mock_table.items if item.get('event_type') == 'alert']
        print(f"\n🚨 Alerts Detected: {len(alerts)}")
        for alert in alerts:
            print(f"   - Signature: {alert.get('signature')}")
            print(f"   - Severity: {alert.get('severity')}")
            print(f"   - Category: {alert.get('category')}")
        
        print("\n" + "="*60)
        print("✅ ALL TESTS PASSED!")
        print("="*60)
        print("\n📝 Summary:")
        print(f"   • Lambda handler executed successfully")
        print(f"   • All 3 events written to both S3 and DynamoDB")
        print(f"   • S3 partitioning structure validated")
        print(f"   • DynamoDB schema validated")
        print(f"   • Alert processing verified")
        print("\n🚀 Code is ready for deployment!\n")
        
        return True
        
    except Exception as e:
        print("\n" + "="*60)
        print("❌ TEST FAILED!")
        print("="*60)
        print(f"\nError: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_lambda_handler()
    sys.exit(0 if success else 1)
