# 🚀 Phase 1 Deployment - Step-by-Step Guide

## ✅ Pre-Deployment Checklist

- [ ] Code changes saved
- [ ] Terraform files ready (s3_logs.tf, logging_lambda.tf)
- [ ] Lambda code updated (handler.py)
- [ ] Currently in correct directory

---

## 📋 Step-by-Step Deployment

### **Step 1: Review Terraform Plan**

```powershell
# See what will be created/changed
terraform plan
```

**What to look for:**
- ✅ **Create:** S3 bucket `phantomwall-dev-suricata-logs`
- ✅ **Create:** S3 lifecycle policies
- ✅ **Create:** S3 encryption config
- ✅ **Update:** Lambda IAM role (add S3 permissions)
- ✅ **Update:** Lambda function (new code + env vars)
- ⚠️ **NO changes** to DynamoDB table
- ⚠️ **NO changes** to CloudWatch logs
- ⚠️ **NO changes** to API Gateway

**If you see any DESTROY or REPLACE operations - STOP and let me know!**

---

### **Step 2: Apply Changes**

```powershell
# Deploy the infrastructure
terraform apply
```

Type `yes` when prompted.

**Expected duration:** 1-2 minutes

---

### **Step 3: Verify Lambda Updated**

```powershell
# Check Lambda environment variables
aws lambda get-function-configuration `
  --function-name phantomwall-dev-suricata-ingest `
  --query 'Environment.Variables'
```

**Expected output:**
```json
{
    "TABLE_NAME": "phantomwall-dev-suricata-events",
    "S3_BUCKET_NAME": "phantomwall-dev-suricata-logs",
    "ENABLE_S3_BACKUP": "true"
}
```

---

### **Step 4: Verify S3 Bucket Exists**

```powershell
# List S3 buckets
aws s3 ls | Select-String "suricata-logs"
```

**Expected:** You should see `phantomwall-dev-suricata-logs`

---

### **Step 5: Generate Test Traffic**

**Option A: SSH to Honeypot (triggers alerts)**
```powershell
# Get honeypot IP
terraform output honeypot_public_ip

# Try to SSH (this will trigger Suricata alert)
ssh ubuntu@<HONEYPOT_IP>
# Then disconnect (Ctrl+C)
```

**Option B: Port scan (triggers multiple alerts)**
```powershell
# Install nmap if needed
# Then scan honeypot
nmap -p 22,80,443 <HONEYPOT_IP>
```

**Option C: Just wait 5-10 minutes for background noise**
(Internet scanners constantly probe honeypots)

---

### **Step 6: Watch Lambda Logs**

```powershell
# Monitor Lambda execution in real-time
aws logs tail /aws/lambda/phantomwall-dev-suricata-ingest --follow
```

**What to look for:**
```
{
  "statusCode": 200,
  "records": 5,
  "s3_writes": 5,
  "s3_enabled": true
}
```

Press `Ctrl+C` to stop watching.

---

### **Step 7: Verify S3 Files Created**

```powershell
# List S3 objects (wait 2-3 minutes after generating traffic)
aws s3 ls s3://phantomwall-dev-suricata-logs/ --recursive | Select-Object -First 10
```

**Expected structure:**
```
year=2026/month=01/day=29/hour=14/abc123def456.json
year=2026/month=01/day=29/hour=14/789ghi012jkl.json
```

---

### **Step 8: Verify DynamoDB Still Working**

```powershell
# Check recent events in DynamoDB
aws dynamodb scan `
  --table-name phantomwall-dev-suricata-events `
  --limit 5 `
  --query 'Items[*].[event_type.S, src_ip.S, dest_ip.S]'
```

**Expected:** Should show recent events

---

### **Step 9: Test Dashboard**

1. Open your React dashboard in browser
2. Check `AlertsTable` - should show recent alerts
3. Check browser console (F12) - should be no errors
4. Verify data is loading

---

### **Step 10: Download & Inspect an S3 Log**

```powershell
# Get a specific S3 object
$s3Key = (aws s3 ls s3://phantomwall-dev-suricata-logs/ --recursive | Select-Object -First 1).Split()[-1]

# Download it
aws s3 cp "s3://phantomwall-dev-suricata-logs/$s3Key" test-event.json

# View it
Get-Content test-event.json | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

**Expected:** Should show complete Suricata event in JSON format

---

## ✅ Success Criteria

| Test | Pass/Fail | Notes |
|------|-----------|-------|
| Terraform apply succeeded | ⬜ | |
| S3 bucket created | ⬜ | |
| Lambda env vars updated | ⬜ | |
| Lambda logs show s3_writes > 0 | ⬜ | |
| S3 files exist with correct partitions | ⬜ | |
| DynamoDB still receiving events | ⬜ | |
| Dashboard loads correctly | ⬜ | |
| No errors in CloudWatch | ⬜ | |

---

## 🔧 Troubleshooting

### **Issue: Lambda shows s3_writes: 0**

```powershell
# Check if S3 is enabled
aws lambda get-function-configuration `
  --function-name phantomwall-dev-suricata-ingest `
  --query 'Environment.Variables.ENABLE_S3_BACKUP'

# Should return "true"
```

### **Issue: Permission errors in Lambda logs**

Check IAM permissions:
```powershell
aws lambda get-policy --function-name phantomwall-dev-suricata-ingest
```

### **Issue: No S3 files appearing**

```powershell
# Check if Lambda is being triggered
aws logs filter-log-events `
  --log-group-name /aws/lambda/phantomwall-dev-suricata-ingest `
  --start-time (Get-Date).AddMinutes(-10).ToFileTime() `
  --limit 5
```

---

## 🚨 Emergency Rollback

If something breaks:

```powershell
# Quick disable S3 writes (keeps everything else working)
aws lambda update-function-configuration `
  --function-name phantomwall-dev-suricata-ingest `
  --environment "Variables={TABLE_NAME=phantomwall-dev-suricata-events,S3_BUCKET_NAME=phantomwall-dev-suricata-logs,ENABLE_S3_BACKUP=false}"
```

Dashboard will keep working with DynamoDB.

---

## 📊 Cost Monitoring

After deployment, check costs:

```powershell
# S3 storage used
aws s3 ls s3://phantomwall-dev-suricata-logs/ --recursive --summarize | Select-String "Total Size"

# Lambda invocations (last 24h)
aws cloudwatch get-metric-statistics `
  --namespace AWS/Lambda `
  --metric-name Invocations `
  --dimensions Name=FunctionName,Value=phantomwall-dev-suricata-ingest `
  --start-time (Get-Date).AddDays(-1).ToString("yyyy-MM-ddTHH:mm:ss") `
  --end-time (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss") `
  --period 86400 `
  --statistics Sum
```

---

## 🎯 Ready to Deploy?

**Start with Step 1:**
```powershell
terraform plan
```

Let me know what the output shows and we'll proceed! 🚀
