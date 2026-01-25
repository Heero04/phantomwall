#!/bin/bash
# =========================================
# PhantomWall Alerts DynamoDB Deployment
# =========================================
# Safe deployment script with validation
# and rollback capability
# =========================================

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"

echo "🚀 PhantomWall Alerts DynamoDB Deployment"
echo "=========================================="

# Check if we're in the right directory
if [[ ! -f "$PROJECT_DIR/alerts-dynamodb.tf" ]]; then
    echo "❌ Error: alerts-dynamodb.tf not found in current directory"
    echo "Please run this script from your Terraform project directory"
    exit 1
fi

# Function to create Lambda deployment package
create_lambda_package() {
    echo "📦 Creating Lambda deployment package..."
    
    # Create lambda directory if it doesn't exist
    mkdir -p lambda
    
    # Check if Python file exists
    if [[ ! -f "lambda/alert-indexer.py" ]]; then
        echo "❌ Error: lambda/alert-indexer.py not found"
        echo "Please ensure the Lambda function code is in place"
        exit 1
    fi
    
    # Create zip package
    cd lambda
    zip -r ../alert-indexer.zip alert-indexer.py
    cd ..
    
    echo "✅ Lambda package created: alert-indexer.zip"
}

# Function to validate Terraform configuration
validate_terraform() {
    echo "🔍 Validating Terraform configuration..."
    
    terraform init -upgrade
    terraform validate
    
    echo "✅ Terraform configuration is valid"
}

# Function to show deployment plan
show_plan() {
    echo "📋 Generating deployment plan..."
    
    terraform plan -var="enable_alerts_dynamodb=true" -out=alerts-deploy.tfplan
    
    echo ""
    echo "📋 DEPLOYMENT PLAN SUMMARY:"
    echo "================================"
    echo "Resources to be created:"
    echo "  - DynamoDB table: phantomwall-alerts-dev"
    echo "  - Lambda function: phantomwall-alert-indexer-dev" 
    echo "  - IAM role and policies for Lambda"
    echo "  - CloudWatch subscription filter"
    echo ""
    echo "⚠️  IMPORTANT: This will start processing your Suricata logs"
    echo "⚠️  Make sure your log group '/honeypot/suricata' exists"
    echo ""
}

# Function to deploy infrastructure
deploy() {
    echo "🚀 Deploying alerts infrastructure..."
    
    terraform apply alerts-deploy.tfplan
    
    echo ""
    echo "✅ DEPLOYMENT COMPLETE!"
    echo "======================="
    echo ""
    echo "📊 What was deployed:"
    echo "  - DynamoDB alerts table with 30-day TTL"
    echo "  - Lambda function processing CloudWatch logs"
    echo "  - Subscription filter sending alerts to Lambda"
    echo ""
    echo "🔍 To verify deployment:"
    echo "  aws dynamodb describe-table --table-name phantomwall-alerts-dev"
    echo "  aws lambda get-function --function-name phantomwall-alert-indexer-dev"
    echo ""
    echo "📈 Monitor processing:"
    echo "  aws logs describe-log-groups --log-group-name-prefix '/aws/lambda/phantomwall-alert-indexer'"
    echo ""
    echo "🔄 To rollback if needed:"
    echo "  bash rollback-alerts.sh"
}

# Main deployment flow
main() {
    echo "Starting deployment process..."
    echo ""
    
    # Step 1: Create Lambda package
    create_lambda_package
    echo ""
    
    # Step 2: Validate configuration
    validate_terraform
    echo ""
    
    # Step 3: Show plan and get confirmation
    show_plan
    echo ""
    
    # Get user confirmation
    read -p "🤔 Do you want to proceed with deployment? (y/N): " -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        deploy
    else
        echo "❌ Deployment cancelled"
        echo "💾 Plan saved as: alerts-deploy.tfplan"
        echo "🔄 Run 'terraform apply alerts-deploy.tfplan' to deploy later"
        exit 0
    fi
    
    # Cleanup
    rm -f alerts-deploy.tfplan
    
    echo ""
    echo "🎉 Deployment completed successfully!"
    echo "📝 Check CloudWatch logs for Lambda function execution"
    echo "📊 Query DynamoDB table to see indexed alerts"
}

# Run main function
main "$@"