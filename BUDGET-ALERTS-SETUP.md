# AWS Budget Alerts Setup Guide

## Overview
Configured AWS Budget with **3-tier alerting system** to prevent cost overruns.

## Alert Thresholds

| Threshold | Type | Action |
|-----------|------|--------|
| **$30** | Actual Cost | ⚠️ Early Warning - Monitor closely |
| **$50** | Actual Cost | 🔍 Investigation Required - Review resources |
| **$75** | Actual Cost | 🚨 Critical - Consider shutting down non-essential resources |
| **$75** | Forecasted | 📊 Projected overage - Plan ahead |

## Additional Protection
- **Daily Anomaly Detection**: Alerts if any service has unusual cost spike > $10/day
- **Service-Specific Monitoring**: Tracks EC2, Lambda, DynamoDB, S3, API Gateway, CloudWatch, Amplify

## Setup Instructions

### 1. Add Your Email to terraform.tfvars
```hcl
budget_alert_email = "your-email@example.com"
```

### 2. Deploy Budget Alerts
```bash
# Initialize if needed
terraform init

# Plan to review changes
terraform plan

# Apply budget configuration
terraform apply -target=aws_budgets_budget.phantomwall_monthly
terraform apply -target=aws_ce_anomaly_monitor.phantomwall_daily
terraform apply -target=aws_ce_anomaly_subscription.phantomwall_anomaly_alerts
```

### 3. Confirm Email Subscription
- AWS will send a confirmation email to your specified address
- **Important**: Click the confirmation link in the email to activate alerts
- You'll receive separate confirmations for:
  - Budget notifications
  - Anomaly detection alerts

## What to Expect

### Normal Operations ($25-40/month)
- 1 honeypot EC2 running 24/7: ~$10-15
- Lambda functions (low traffic): ~$2-5
- DynamoDB on-demand: ~$1-3
- S3 storage: ~$1-2
- API Gateway: ~$3-5
- CloudWatch logs: ~$2-5
- Amplify hosting: ~$1-2
- Data transfer: ~$5-10

**Total: $25-50/month** during active development

### Cost Optimization Tips
1. **Stop EC2 when not testing**: Can save $10-15/month
2. **Use Lambda for processing**: More cost-effective than EC2 for low traffic
3. **Enable S3 lifecycle policies**: Auto-delete old logs after 30 days
4. **Review CloudWatch retention**: Reduce log retention from 7 days to 3 days
5. **Monitor data transfer**: Largest variable cost - limit outbound traffic

## Alert Response Plan

### At $30 Alert
✅ **Review current spend** in Cost Explorer  
✅ **Check running EC2 instances**  
✅ **Verify expected usage pattern**  
✅ No immediate action needed if usage is expected  

### At $50 Alert
⚠️ **Investigate cost drivers**  
⚠️ **Stop non-essential resources**  
⚠️ **Review CloudWatch logs size**  
⚠️ **Check for data transfer spikes**  

### At $75 Alert
🚨 **Immediate action required**  
🚨 **Stop all honeypot EC2 instances**  
🚨 **Disable API Gateway endpoints if needed**  
🚨 **Review and delete unnecessary S3 data**  
🚨 **Contact AWS support if costs are unexpected**  

## Cost Monitoring Commands

### Check Current Month Spend
```bash
# Via AWS CLI
aws ce get-cost-and-usage \
  --time-period Start=$(date -d "$(date +%Y-%m-01)" +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE
```

### Check Today's Costs
```bash
aws ce get-cost-and-usage \
  --time-period Start=$(date +%Y-%m-%d),End=$(date -d tomorrow +%Y-%m-%d) \
  --granularity DAILY \
  --metrics "UnblendedCost"
```

### List Running EC2 Instances
```bash
aws ec2 describe-instances \
  --filters "Name=instance-state-name,Values=running" \
  --query 'Reservations[].Instances[].{ID:InstanceId,Type:InstanceType,Name:Tags[?Key==`Name`].Value|[0]}'
```

## Terraform Outputs
After applying, you'll see:
```
budget_name              = "phantomwall-monthly-budget"
budget_limit             = "75 USD"
budget_alert_thresholds  = "$30, $50, $75 (actual) + $75 (forecasted)"
```

## Modifying Budget Limits

To adjust thresholds, edit `budget_alerts.tf`:

```hcl
# Change overall budget limit
limit_amount = "100"  # Increase to $100

# Modify individual alert thresholds
notification {
  threshold = 40  # Change $30 to $40
  # ...
}
```

Then run: `terraform apply`

## Removing Budget Alerts

If you need to remove budget monitoring:
```bash
terraform destroy -target=aws_budgets_budget.phantomwall_monthly
terraform destroy -target=aws_ce_anomaly_subscription.phantomwall_anomaly_alerts
terraform destroy -target=aws_ce_anomaly_monitor.phantomwall_daily
```

## Notes
- Budget data updates **every 6-8 hours** (not real-time)
- Anomaly detection runs **daily at midnight UTC**
- First month may show incomplete data
- Email alerts can take up to 15 minutes to arrive
- AWS Free Tier: First 2 budgets are free, additional budgets cost $0.02/day

---

**Created**: February 8, 2026  
**Budget File**: `budget_alerts.tf`  
**Status**: Ready to deploy ✅
