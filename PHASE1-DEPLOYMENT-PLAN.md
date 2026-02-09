# Phase 1 Implementation - S3 Storage Addition

## 🎯 **What We're Testing**

Adding S3 storage for raw Suricata logs while keeping DynamoDB working for the dashboard.

---

## ✅ **Changes Made**

### **1. Infrastructure (Terraform)**
- ✅ Created `s3_logs.tf` with S3 bucket
- ✅ Added lifecycle policy (30 days → Glacier, 365 days → delete)
- ✅ Updated Lambda IAM permissions to write to S3
- ✅ Added S3 bucket name to Lambda environment variables

### **2. Lambda Function**
- ✅ Added S3 client initialization
- ✅ Created `_write_to_s3()` function (partitioned by date/hour)
- ✅ Modified handler to write to BOTH S3 and DynamoDB
- ✅ Added feature flag `ENABLE_S3_BACKUP=true`
- ✅ Graceful error handling (S3 failure won't break Lambda)

---

## 📋 **Deployment Steps**

### **Step 1: Review Changes**
```powershell
# Check what Terraform will create
terraform plan
```

**Expected output:**
- ✅ Create S3 bucket
- ✅ Create lifecycle policies
- ✅ Update Lambda IAM role (add S3 permissions)
- ✅ Update Lambda function (new code + env vars)
- ⚠️ NO changes to DynamoDB
- ⚠️ NO changes to CloudWatch

### **Step 2: Apply Infrastructure**
```powershell
# Deploy S3 bucket and updated Lambda
terraform apply
```

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

### **Step 4: Test with Real Traffic**

1. **Generate some honeypot traffic** (SSH to honeypot, trigger alerts)
2. **Check CloudWatch Logs:**
   ```powershell
   aws logs tail /aws/lambda/phantomwall-dev-suricata-ingest --follow
   ```
   
   **Look for:**
   - ✅ `"statusCode": 200`
   - ✅ `"records": X` (DynamoDB writes)
   - ✅ `"s3_writes": X` (should match records)
   - ✅ `"s3_enabled": true`

3. **Verify S3 Objects Created:**
   ```powershell
   aws s3 ls s3://phantomwall-dev-suricata-logs/ --recursive
   ```
   
   **Expected structure:**
   ```
   year=2026/month=01/day=29/hour=14/abc123.json
   year=2026/month=01/day=29/hour=14/def456.json
   ```

4. **Verify DynamoDB Still Working:**
   ```powershell
   aws dynamodb scan `
     --table-name phantomwall-dev-suricata-events `
     --limit 5
   ```

5. **Check Dashboard (React):**
   - Open dashboard in browser
   - Verify `AlertsTable` still shows data
   - Verify `ThreatMap` still works
   - Check browser console for errors

---

## ✅ **Success Criteria**

| Test | Expected Result | Status |
|------|----------------|--------|
| Terraform plan shows S3 creation | ✅ S3 bucket + policies | ⬜ |
| Terraform apply succeeds | ✅ No errors | ⬜ |
| Lambda has S3 env vars | ✅ S3_BUCKET_NAME set | ⬜ |
| Lambda writes to S3 | ✅ JSON files in S3 | ⬜ |
| Lambda writes to DynamoDB | ✅ Events in table | ⬜ |
| Dashboard loads data | ✅ Alerts visible | ⬜ |
| No errors in CloudWatch | ✅ Clean logs | ⬜ |

---

## 🔧 **Rollback Plan (If Something Breaks)**

### **Option 1: Disable S3 (Quick Fix)**
```powershell
# Turn off S3 writes without redeploying
aws lambda update-function-configuration `
  --function-name phantomwall-dev-suricata-ingest `
  --environment "Variables={TABLE_NAME=phantomwall-dev-suricata-events,S3_BUCKET_NAME=phantomwall-dev-suricata-logs,ENABLE_S3_BACKUP=false}"
```

### **Option 2: Full Rollback**
```powershell
# Revert to previous Terraform state
git checkout HEAD~1 lambda/suricata_ingest/handler.py
git checkout HEAD~1 logging_lambda.tf
rm s3_logs.tf
terraform apply
```

---

## 📊 **Cost Impact (Phase 1)**

| Service | Before | After (Phase 1) | Change |
|---------|--------|-----------------|--------|
| DynamoDB | $2.63/mo | $2.63/mo | No change |
| S3 Storage | $0 | $0.12/mo (5GB) | +$0.12 |
| Lambda | $1.50/mo | $1.50/mo | No change |
| **Total** | **$4.13/mo** | **$4.25/mo** | **+$0.12/mo** |

**Note:** Slight increase now, but sets up for Phase 2 cost savings when we optimize DynamoDB.

---

## 🚀 **Next Phases (After Phase 1 Verified)**

### **Phase 2: Optimize DynamoDB (Week 2)**
- Only write ALERTS to DynamoDB (not all events)
- Reduces DynamoDB by ~95%
- **Expected savings:** -$2.20/month

### **Phase 3: Add Athena Queries (Week 3)**
- Create Athena table for S3 logs
- Add historical query Lambda function
- Update React dashboard for date range queries

### **Phase 4: Separate Alerts Table (Week 4)**
- Create dedicated `suricata_alerts` table
- Smaller, faster queries
- Better indexing for dashboard

---

## 📝 **Testing Checklist**

Before deployment:
- [ ] Review all Terraform changes
- [ ] Check Lambda code for syntax errors
- [ ] Verify IAM permissions include S3

After deployment:
- [ ] Terraform apply completed successfully
- [ ] S3 bucket exists
- [ ] Lambda function updated
- [ ] Environment variables set correctly
- [ ] Test Lambda with sample event
- [ ] Verify S3 files created with correct partition structure
- [ ] Verify DynamoDB still receiving events
- [ ] Dashboard loads without errors
- [ ] Check CloudWatch logs for errors

---

## 🎯 **Ready to Deploy?**

Run these commands in order:

```powershell
# 1. Review changes
terraform plan -out=tfplan

# 2. If plan looks good, apply
terraform apply tfplan

# 3. Verify Lambda
aws lambda get-function-configuration `
  --function-name phantomwall-dev-suricata-ingest

# 4. Watch logs
aws logs tail /aws/lambda/phantomwall-dev-suricata-ingest --follow

# 5. Check S3 after a few minutes
aws s3 ls s3://phantomwall-dev-suricata-logs/ --recursive | head -10
```

---

**Status:** Ready for deployment  
**Risk Level:** Low (additive change, no breaking modifications)  
**Rollback Time:** < 5 minutes  
**Estimated Duration:** 10-15 minutes
