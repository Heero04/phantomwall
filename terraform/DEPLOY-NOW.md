# 🚀 Ready to Deploy - Quick Start Guide

## ✅ Everything is configured and ready!

### Step 1: Create Lambda Package
```bash
# Navigate to terraform directory
cd terraform

# Create Lambda package (Windows)
create-lambda-package.bat

# OR if you have PowerShell
powershell -command "cd lambda/alert-indexer; Compress-Archive -Path 'index.py' -DestinationPath '../../alert-indexer.zip'"
```

### Step 2: Deploy with Terraform
```bash
# Initialize Terraform (first time only)
terraform init

# Validate configuration
terraform validate

# See what will be created
terraform plan

# Deploy everything
terraform apply
```

### Step 3: Verify Deployment
```bash
# Check if table exists
aws dynamodb describe-table --table-name phantomwall-alerts-dev

# Check Lambda function
aws lambda get-function --function-name phantomwall-alert-indexer-dev

# Watch for alerts being processed (wait 2-3 minutes first)
aws dynamodb scan --table-name phantomwall-alerts-dev --max-items 5
```

### Step 4: If You Need to Rollback
```bash
terraform destroy
```

## 🔧 Configuration Details

**CloudWatch Log Group:** `/aws/ec2/suricata`
- If your log group name is different, update it in `alerts-dynamodb.tf` line 18

**Resources Created:**
- DynamoDB table: `phantomwall-alerts-dev`
- Lambda function: `phantomwall-alert-indexer-dev`
- CloudWatch subscription filter
- IAM roles and policies

**Estimated Time:** 5-10 minutes
**Cost:** ~$0.75/month for 1000 alerts/day

## 🚨 Important Notes

1. **Your existing dashboard keeps working** - this is additive only
2. **Completely reversible** - `terraform destroy` removes everything
3. **No data loss risk** - only adds new functionality
4. **Auto-cleanup** - alerts auto-expire after 30 days

## 📞 If Something Goes Wrong

1. Run: `terraform destroy`
2. Check AWS CloudWatch Logs for any error messages
3. Verify your CloudWatch log group name matches line 18 in `alerts-dynamodb.tf`

---

**You're all set! Just run the terraform commands above.** 🎉