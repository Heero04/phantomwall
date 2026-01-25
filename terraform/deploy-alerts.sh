#!/bin/bash

# ==========================================
# 🚨 PhantomWall Alerts DynamoDB Deployment
# ==========================================
# Safe deployment with rollback capability
# ==========================================

set -e  # Exit on any error

echo "🚀 Starting PhantomWall Alerts DynamoDB deployment..."

# Configuration
TERRAFORM_DIR="$(dirname "$0")"
LAMBDA_DIR="$TERRAFORM_DIR/lambda/alert-indexer"

# Colors for output
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

# Function to create Lambda deployment package
create_lambda_package() {
    log "📦 Creating Lambda deployment package..."
    
    cd "$LAMBDA_DIR"
    
    # Remove old package if exists
    rm -f alert-indexer.zip
    
    # Create new package
    zip -r alert-indexer.zip index.py
    
    # Move to terraform directory
    mv alert-indexer.zip "$TERRAFORM_DIR/"
    
    log "✅ Lambda package created: alert-indexer.zip"
}

# Function to validate Terraform
validate_terraform() {
    log "🔍 Validating Terraform configuration..."
    
    cd "$TERRAFORM_DIR"
    
    # Initialize if needed
    if [ ! -d ".terraform" ]; then
        terraform init
    fi
    
    # Validate
    terraform validate
    
    log "✅ Terraform configuration is valid"
}

# Function to show deployment plan
show_plan() {
    log "📋 Generating deployment plan..."
    
    cd "$TERRAFORM_DIR"
    
    # Create plan
    terraform plan -out=alerts-plan.tfplan
    
    echo ""
    echo -e "${BLUE}===========================================${NC}"
    echo -e "${BLUE}📊 DEPLOYMENT PLAN SUMMARY${NC}"
    echo -e "${BLUE}===========================================${NC}"
    echo "The following resources will be created:"
    echo "  • DynamoDB table: phantomwall-alerts-dev"
    echo "  • Lambda function: phantomwall-alert-indexer-dev"
    echo "  • CloudWatch subscription filter"
    echo "  • IAM roles and policies"
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANT: This is ADDITIVE - your existing CloudWatch setup will NOT be changed${NC}"
    echo ""
}

# Function to deploy
deploy() {
    log "🚀 Deploying alerts infrastructure..."
    
    cd "$TERRAFORM_DIR"
    
    # Apply the plan
    terraform apply alerts-plan.tfplan
    
    # Clean up plan file
    rm -f alerts-plan.tfplan
    
    log "✅ Deployment complete!"
}

# Function to show rollback instructions
show_rollback_info() {
    echo ""
    echo -e "${BLUE}===========================================${NC}"
    echo -e "${BLUE}🛡️  ROLLBACK INSTRUCTIONS${NC}"
    echo -e "${BLUE}===========================================${NC}"
    echo ""
    echo "If anything goes wrong, you can safely rollback with:"
    echo ""
    echo -e "${YELLOW}  cd $TERRAFORM_DIR${NC}"
    echo -e "${YELLOW}  terraform destroy -target=aws_dynamodb_table.phantomwall_alerts${NC}"
    echo -e "${YELLOW}  terraform destroy -target=aws_lambda_function.alert_indexer${NC}"
    echo -e "${YELLOW}  terraform destroy -target=aws_cloudwatch_log_subscription_filter.suricata_alerts${NC}"
    echo ""
    echo "Or destroy everything at once:"
    echo -e "${YELLOW}  terraform destroy${NC}"
    echo ""
    echo -e "${GREEN}✅ Your existing CloudWatch Logs and dashboard will continue working normally${NC}"
    echo ""
}

# Function to test deployment
test_deployment() {
    log "🧪 Testing deployment..."
    
    cd "$TERRAFORM_DIR"
    
    # Get outputs
    TABLE_NAME=$(terraform output -raw dynamodb_table_name 2>/dev/null || echo "")
    LAMBDA_NAME=$(terraform output -raw lambda_function_name 2>/dev/null || echo "")
    
    if [ -n "$TABLE_NAME" ] && [ -n "$LAMBDA_NAME" ]; then
        log "✅ Resources created successfully:"
        echo "  • DynamoDB Table: $TABLE_NAME"
        echo "  • Lambda Function: $LAMBDA_NAME"
    else
        warn "Could not retrieve all resource names. Check deployment manually."
    fi
}

# Main deployment flow
main() {
    echo ""
    echo -e "${BLUE}===========================================${NC}"
    echo -e "${BLUE}🚨 PhantomWall Alerts DynamoDB Setup${NC}"
    echo -e "${BLUE}===========================================${NC}"
    echo ""
    
    # Check prerequisites
    if ! command -v terraform &> /dev/null; then
        error "Terraform is not installed or not in PATH"
        exit 1
    fi
    
    if ! command -v zip &> /dev/null; then
        error "zip command is not available"
        exit 1
    fi
    
    # Show what we're about to do
    echo "This script will:"
    echo "  1. Create a Lambda deployment package"
    echo "  2. Validate Terraform configuration" 
    echo "  3. Show deployment plan"
    echo "  4. Deploy the alerts infrastructure"
    echo "  5. Test the deployment"
    echo ""
    
    # Ask for confirmation
    read -p "Continue with deployment? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled."
        exit 0
    fi
    
    # Execute deployment steps
    create_lambda_package
    validate_terraform
    show_plan
    
    # Final confirmation
    echo ""
    read -p "Apply this plan? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled."
        rm -f "$TERRAFORM_DIR/alerts-plan.tfplan"
        exit 0
    fi
    
    deploy
    test_deployment
    show_rollback_info
    
    echo ""
    log "🎉 PhantomWall Alerts DynamoDB is now active!"
    echo ""
    echo "Next steps:"
    echo "  1. Update your dashboard to read alerts from DynamoDB"
    echo "  2. Monitor CloudWatch Logs for the Lambda function"
    echo "  3. Test alert indexing with a few sample events"
    echo ""
}

# Run main function
main "$@"