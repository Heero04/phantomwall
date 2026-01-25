#!/bin/bash

# ==========================================
# 🛡️ PhantomWall Alerts DynamoDB Rollback
# ==========================================
# Safe rollback script to remove alerts infrastructure
# ==========================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

TERRAFORM_DIR="$(dirname "$0")"

echo ""
echo -e "${RED}===========================================${NC}"
echo -e "${RED}🛡️  ROLLBACK: PhantomWall Alerts DynamoDB${NC}"
echo -e "${RED}===========================================${NC}"
echo ""

echo "This will remove the following resources:"
echo "  • DynamoDB table: phantomwall-alerts-dev"
echo "  • Lambda function: phantomwall-alert-indexer-dev"  
echo "  • CloudWatch subscription filter"
echo "  • IAM roles and policies"
echo ""
echo -e "${GREEN}✅ Your existing CloudWatch Logs and dashboard will NOT be affected${NC}"
echo ""

read -p "Are you sure you want to rollback? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Rollback cancelled."
    exit 0
fi

cd "$TERRAFORM_DIR"

log "🔄 Rolling back alerts infrastructure..."

# Destroy in reverse order to avoid dependency issues
log "Removing CloudWatch subscription filter..."
terraform destroy -target=aws_cloudwatch_log_subscription_filter.suricata_alerts -auto-approve

log "Removing Lambda function..."
terraform destroy -target=aws_lambda_function.alert_indexer -auto-approve

log "Removing Lambda IAM resources..."
terraform destroy -target=aws_iam_role_policy.alert_indexer_policy -auto-approve
terraform destroy -target=aws_iam_role.alert_indexer_role -auto-approve

log "Removing DynamoDB table..."
terraform destroy -target=aws_dynamodb_table.phantomwall_alerts -auto-approve

log "Cleaning up CloudWatch log groups..."
terraform destroy -target=aws_cloudwatch_log_group.alert_indexer_logs -auto-approve

log "Removing Lambda permissions..."
terraform destroy -target=aws_lambda_permission.allow_cloudwatch -auto-approve

# Clean up deployment files
rm -f alert-indexer.zip
rm -f alerts-plan.tfplan

echo ""
log "✅ Rollback complete!"
echo ""
echo "The alerts infrastructure has been removed."
echo "Your original CloudWatch Logs setup is unchanged and working normally."
echo ""