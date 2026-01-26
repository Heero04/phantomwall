# 💰 Cost Optimization Guide

This document tracks cost optimization strategies for PhantomWall to minimize AWS spending while maintaining performance.

---

## 📊 Current Cost Estimate

### Monthly Costs (Optimized)
- **EC2 (t3a.small):** ~$22/month
- **Lambda:** ~$3-5/month
- **DynamoDB (PAY_PER_REQUEST):** ~$5-10/month
- **CloudWatch Logs:** ~$2-3/month (7-day retention)
- **API Gateway:** ~$3/month
- **Data Transfer:** ~$2-3/month
- **S3:** ~$1/month

**Total Estimated: ~$38-47/month** (down from ~$60-80/month)

---

## ✅ Implemented Optimizations (January 2026)

### 1. **EC2 Instance Right-Sizing** 💵 **Saves ~$15/month**
- **Changed:** `t3a.medium` (4GB RAM) → `t3a.small` (2GB RAM)
- **Reason:** Suricata + CloudWatch agent only need 2GB RAM for honeypot workload
- **Impact:** 50% cost reduction on EC2, same performance
- **File:** `honeypot_ec2.tf`

### 2. **Lambda Memory Optimization** 💵 **Saves ~$2/month**
- **Ingest Lambda:** 512 MB → 256 MB
- **API Lambda:** 256 MB → 128 MB
- **Reason:** Simple JSON processing doesn't require high memory allocation
- **Impact:** Lower GB-second charges, faster cold starts
- **Files:** `logging_lambda.tf`, `api_gateway.tf`

### 3. **CloudWatch Log Retention Reduction** 💵 **Saves ~$4/month**
- **Changed:** 14-30 days → 7 days across all log groups
- **Reason:** Event data persists in DynamoDB; logs are just a pipeline
- **Affected logs:**
  - Suricata logs: 30d → 7d
  - Lambda logs: 14d → 7d
  - API Gateway logs: 14d → 7d
  - Bootstrap logs: 14d → 7d
- **Files:** `logging_lambda.tf`, `api_gateway.tf`, `bedrock_chat.tf`, `honeypot_ec2.tf`

**Total Immediate Savings: ~$21/month (35% cost reduction)**

---

## 🚀 Future Optimization Opportunities

### Medium-Term (Next 3-6 months)

#### **1. EC2 Savings Plans** 💵 **Potential: ~$10-15/month**
- **Strategy:** Commit to 1-year Compute Savings Plan
- **Savings:** 30-40% discount on EC2
- **t3a.small cost:** $22/month → $13-15/month
- **When:** After confirming instance runs 24/7 for production

#### **2. Spot Instances** 💵 **Potential: ~$15/month**
- **Strategy:** Use EC2 Spot Instances for honeypot (can tolerate interruptions)
- **Savings:** Up to 70% discount
- **Cost:** $22/month → $7/month
- **Trade-off:** Possible interruptions (acceptable for honeypot)
- **Implementation:** Replace `aws_instance` with `aws_spot_instance_request`

#### **3. S3 Lifecycle Policies** 💵 **Potential: ~$1-2/month**
- **Strategy:** Archive old Lambda packages and logs
- **Tiers:**
  - 30 days: Move to STANDARD_IA
  - 90 days: Move to GLACIER
- **Implementation:** Add lifecycle rules to S3 buckets

#### **4. DynamoDB On-Demand → Provisioned (if predictable)** 💵 **Potential: ~$3-5/month**
- **Strategy:** Switch to provisioned capacity with auto-scaling
- **When:** After analyzing traffic patterns (1-3 months)
- **Condition:** Only if traffic is predictable and consistent
- **Setup:** 
  ```hcl
  billing_mode = "PROVISIONED"
  read_capacity = 5
  write_capacity = 5
  ```

### Advanced Optimizations

#### **5. Compress DynamoDB Data** 💵 **Potential: ~$2-3/month**
- **Strategy:** Gzip compress large JSON payloads before storing
- **Implementation:** Update Lambda ingest function
- **Trade-off:** Slight CPU overhead (negligible)

#### **6. Lambda Reserved Concurrency Limits** 💵 **Potential: ~$1/month**
- **Strategy:** Set concurrency limits to prevent cost spikes
- **Protection:** Prevent runaway Lambda executions
- **Setup:** 
  ```hcl
  reserved_concurrent_executions = 10
  ```

#### **7. API Gateway Caching** 💵 **Potential: ~$2/month + better performance**
- **Strategy:** Cache frequent API queries
- **Benefit:** Reduce DynamoDB reads AND improve response time
- **Setup:**
  ```hcl
  cache_cluster_enabled = true
  cache_cluster_size    = "0.5"  # Smallest cache
  ```

#### **8. CloudWatch Logs Compression** 💵 **Potential: ~$1/month**
- **Strategy:** Enable log compression before shipping to CloudWatch
- **Implementation:** Configure in CloudWatch agent

---

## 📈 Cost Monitoring

### Set Up AWS Budgets (Free)
```bash
# Create a budget alert at $50/month
aws budgets create-budget \
  --account-id YOUR_ACCOUNT_ID \
  --budget '{
    "BudgetName": "PhantomWall-Monthly",
    "BudgetLimit": {
      "Amount": "50",
      "Unit": "USD"
    },
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }'
```

### Cost Explorer Filters
- Tag all resources with `Project=phantomwall`
- Filter by tag in AWS Cost Explorer
- Set up monthly cost reports

### CloudWatch Billing Alarms
```hcl
resource "aws_cloudwatch_metric_alarm" "billing_alert" {
  alarm_name          = "phantomwall-billing-alert"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "EstimatedCharges"
  namespace           = "AWS/Billing"
  period              = "21600"  # 6 hours
  statistic           = "Maximum"
  threshold           = "50"
  alarm_description   = "Alert when monthly charges exceed $50"
}
```

---

## 🎯 Cost Optimization Checklist

### Monthly Review
- [ ] Check AWS Cost Explorer for unexpected charges
- [ ] Review CloudWatch log retention (delete old logs if needed)
- [ ] Verify EC2 instance is right-sized
- [ ] Check Lambda invocation counts and durations
- [ ] Review DynamoDB read/write capacity
- [ ] Delete unused S3 objects
- [ ] Remove old Lambda deployment packages

### Quarterly Review
- [ ] Analyze traffic patterns for DynamoDB optimization
- [ ] Consider Savings Plans if running 24/7
- [ ] Review API Gateway usage and caching opportunities
- [ ] Evaluate spot instance feasibility
- [ ] Check for unused resources (old snapshots, EBS volumes)

### Annual Review
- [ ] Re-evaluate instance types and sizes
- [ ] Consider Reserved Instances vs Savings Plans
- [ ] Review data retention policies
- [ ] Optimize cross-region data transfer

---

## 💡 Best Practices

1. **Tag Everything:** Use consistent tags for cost allocation
   ```hcl
   tags = {
     Project     = "phantomwall"
     Environment = terraform.workspace
     CostCenter  = "security"
   }
   ```

2. **Use Terraform Outputs:** Track important cost metrics
   ```hcl
   output "monthly_cost_estimate" {
     value = "~$40-50/month"
   }
   ```

3. **Delete Unused Resources:** Regularly clean up:
   - Old AMI snapshots
   - Unattached EBS volumes
   - Old CloudWatch log streams
   - Unused S3 buckets

4. **Monitor Lambda Cold Starts:** Higher memory can reduce cold starts but costs more

5. **Use AWS Free Tier:** Some services have perpetual free tiers:
   - CloudWatch: 10 custom metrics
   - Lambda: 1M requests/month
   - DynamoDB: 25 GB storage
   - S3: 5 GB storage

---

## 📊 Cost Comparison

| Resource | Before | After | Savings |
|----------|--------|-------|---------|
| EC2 Instance | t3a.medium ($30/mo) | t3a.small ($22/mo) | $8/mo |
| Lambda Ingest | 512 MB | 256 MB | $1/mo |
| Lambda API | 256 MB | 128 MB | $1/mo |
| CloudWatch Logs | 14-30 days | 7 days | $4/mo |
| **Total** | **~$60-80/mo** | **~$38-47/mo** | **~$21-33/mo** |

**Cost Reduction: 35-40%**

---

## 🚨 Cost Alerts

Set up alerts for:
- Monthly spend > $50
- Daily spend > $2
- Lambda invocations > 100K/day
- DynamoDB reads > 1M/day
- CloudWatch log ingestion > 5 GB/day

---

## 📝 Notes

- Costs may vary based on actual traffic and usage patterns
- Monitor for 30 days to establish baseline
- Adjust optimizations based on real-world metrics
- Don't sacrifice reliability for cost savings
- Document any changes to cost-related configurations

---

**Last Updated:** 2026-01-25  
**Next Review:** 2026-02-25
