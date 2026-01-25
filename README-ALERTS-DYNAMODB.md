# 🚨 PhantomWall Alerts DynamoDB Integration

**Safe, rollback-ready implementation of fast alert indexing with DynamoDB.**

## 🎯 What This Does

- **Indexes alerts** from CloudWatch Logs to DynamoDB for instant queries
- **Preserves existing setup** - your current dashboard keeps working
- **Enables fast alert feeds** - sub-50ms response times vs 1-5 second CloudWatch queries
- **Costs less** - ~$2/month vs $15+/month for equivalent CloudWatch usage
- **Fully reversible** - complete rollback capability

## 📁 File Structure

```
terraform/
├── alerts-dynamodb.tf              # Main Terraform configuration
├── deploy-alerts.sh                # Safe deployment script
├── rollback-alerts.sh              # Complete rollback script
└── lambda/
    └── alert-indexer/
        └── index.py                 # Lambda function code

frontend/src/services/
└── dynamodb-alerts.js              # Dashboard integration code
```

## 🚀 Quick Start

### Prerequisites
- Terraform installed
- AWS CLI configured
- Your CloudWatch log group name (update in `alerts-dynamodb.tf`)

### 1. Deploy (Safe & Reversible)
```bash
cd terraform/
chmod +x deploy-alerts.sh
./deploy-alerts.sh
```

### 2. Test
```bash
# Check if alerts are being indexed
aws dynamodb scan --table-name phantomwall-alerts-dev --max-items 5
```

### 3. Update Dashboard (Optional)
```javascript
// In your dashboard code:
import { fetchAlerts } from './services/dynamodb-alerts'

// Enable DynamoDB alerts
process.env.ENABLE_DYNAMODB_ALERTS = 'true'

// Use the new fast alerts API
const alerts = await fetchAlerts({ limit: 100 })
```

### 4. Rollback (If Needed)
```bash
cd terraform/
chmod +x rollback-alerts.sh
./rollback-alerts.sh
```

## 🛡️ Safety Features

### ✅ Non-Destructive
- Your existing CloudWatch Logs **unchanged**
- Current dashboard **keeps working**
- No data loss risk

### ✅ Feature Flag Control
```javascript
// Easy on/off switch
const USE_DYNAMODB_ALERTS = process.env.ENABLE_DYNAMODB_ALERTS === 'true'

if (USE_DYNAMODB_ALERTS) {
  // Use fast DynamoDB path
} else {
  // Use existing CloudWatch path
}
```

### ✅ Automatic Fallback
If DynamoDB fails, automatically falls back to CloudWatch Logs.

### ✅ Complete Rollback
```bash
# Remove everything in reverse order
terraform destroy -target=aws_cloudwatch_log_subscription_filter.suricata_alerts
terraform destroy -target=aws_lambda_function.alert_indexer  
terraform destroy -target=aws_dynamodb_table.phantomwall_alerts
```

## 📊 Architecture

```
Suricata → CloudWatch Logs ──┬── Dashboard (existing CloudWatch API)
                             │
                             └── Subscription Filter → Lambda → DynamoDB → Dashboard (new fast API)
```

## 💰 Cost Analysis

| Component | Monthly Cost (1000 alerts/day) |
|-----------|--------------------------------|
| DynamoDB writes | ~$0.38 |
| DynamoDB reads | ~$0.25 |
| Lambda invocations | ~$0.02 |
| DynamoDB storage | ~$0.10 |
| **Total** | **~$0.75/month** |

Compare to CloudWatch Logs queries: **$5-15/month**

## 🔧 Configuration

### Update CloudWatch Log Group
Edit `alerts-dynamodb.tf`:
```hcl
variable "cloudwatch_log_group_name" {
  default = "/your/actual/log/group/name"  # Update this!
}
```

### Customize Tenant Extraction
Edit `lambda/alert-indexer/index.py`:
```python
def extract_tenant_from_log_group(log_group):
    # Customize based on your naming convention
    if 'honeypot-1' in log_group:
        return 'honeypot-1'
    elif 'honeypot-2' in log_group:
        return 'honeypot-2'
    return 'default'
```

## 📈 Performance Benefits

| Operation | CloudWatch Logs | DynamoDB |
|-----------|-----------------|----------|
| Get 100 recent alerts | 1-5 seconds | 10-50ms |
| Filter by source IP | 5-10 seconds | 20-100ms |
| Filter by signature | 5-10 seconds | 20-100ms |
| Dashboard load time | 3-8 seconds | 0.5-2 seconds |

## 🧪 Testing

### 1. Verify Lambda Function
```bash
aws logs filter-log-events \
  --log-group-name "/aws/lambda/phantomwall-alert-indexer-dev" \
  --start-time $(date -d '5 minutes ago' +%s)000
```

### 2. Check DynamoDB Items
```bash
aws dynamodb scan \
  --table-name phantomwall-alerts-dev \
  --max-items 5 \
  --output table
```

### 3. Compare Sources
```javascript
// In browser console
import { compareSources } from './services/dynamodb-alerts'
compareSources()
```

## 🔄 Migration Strategy

### Phase 1: Deploy (No Changes)
- Deploy DynamoDB infrastructure
- Alerts start indexing to DynamoDB
- Dashboard still uses CloudWatch

### Phase 2: Test (Side-by-Side)
- Enable feature flag for testing
- Compare DynamoDB vs CloudWatch results
- Verify performance improvements

### Phase 3: Switch (Gradual)
```javascript
// Enable for specific users/features first
if (user.isAdmin || feature.enableFastAlerts) {
  process.env.ENABLE_DYNAMODB_ALERTS = 'true'
}
```

### Phase 4: Full Migration
- Enable for all users
- Monitor performance and costs
- Keep CloudWatch as backup

## 🚨 Troubleshooting

### Lambda Function Not Triggering
```bash
# Check CloudWatch subscription filter
aws logs describe-subscription-filters \
  --log-group-name "/your/log/group/name"
```

### No Items in DynamoDB
```bash
# Check Lambda logs for errors
aws logs filter-log-events \
  --log-group-name "/aws/lambda/phantomwall-alert-indexer-dev" \
  --filter-pattern "ERROR"
```

### Dashboard Not Showing Alerts
1. Check feature flag: `process.env.ENABLE_DYNAMODB_ALERTS`
2. Verify table name in dashboard code
3. Check AWS credentials for dashboard

## 📞 Support

If anything goes wrong:

1. **Immediate rollback**: `./rollback-alerts.sh`
2. **Check logs**: Look at Lambda CloudWatch logs
3. **Verify config**: Ensure log group name is correct
4. **Test manually**: Use AWS CLI to verify data flow

## 🎉 Success Metrics

After deployment, you should see:
- ✅ Alerts appearing in DynamoDB within 1-2 minutes
- ✅ Dashboard alert feeds loading in <100ms
- ✅ Reduced CloudWatch Logs query costs
- ✅ No disruption to existing functionality

---

**Remember: This is completely reversible. Your existing setup remains untouched and functional throughout the process.**