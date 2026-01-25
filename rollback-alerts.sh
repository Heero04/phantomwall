#!/bin/bash
# =========================================
# PhantomWall Alerts DynamoDB Rollback
# =========================================
# Complete cleanup and rollback script
# Removes all alerts infrastructure safely
# =========================================

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"

echo "🔄 PhantomWall Alerts DynamoDB Rollback"
echo "======================================="

# Check if we're in the right directory
if [[ ! -f "$PROJECT_DIR/alerts-dynamodb.tf" ]]; then
    echo "❌ Error: alerts-dynamodb.tf not found in current directory"
    echo "Please run this script from your Terraform project directory"
    exit 1
fi

# Function to show what will be destroyed
show_destroy_plan() {
    echo "🔍 Generating rollback plan..."
    
    terraform plan -destroy -var="enable_alerts_dynamodb=true" -out=alerts-destroy.tfplan
    
    echo ""
    echo "🗑️  ROLLBACK PLAN SUMMARY:"
    echo "=========================="
    echo "Resources to be DESTROYED:"
    echo "  - DynamoDB table: phantomwall-alerts-dev (⚠️  ALL DATA LOST)"
    echo "  - Lambda function: phantomwall-alert-indexer-dev"
    echo "  - IAM role and policies for Lambda"
    echo "  - CloudWatch subscription filter"
    echo "  - CloudWatch log groups for Lambda"
    echo ""
    echo "⚠️  WARNING: This will permanently delete all alert data"
    echo "⚠️  Your original CloudWatch logs will remain intact"
    echo ""
}

# Function to execute rollback
execute_rollback() {
    echo "🗑️  Executing rollback..."
    
    # Apply destroy plan
    terraform apply alerts-destroy.tfplan
    
    echo ""
    echo "🧹 Cleaning up deployment artifacts..."
    
    # Remove Lambda package
    if [[ -f "alert-indexer.zip" ]]; then
        rm alert-indexer.zip
        echo "  - Removed alert-indexer.zip"
    fi
    
    # Remove plan files
    rm -f alerts-*.tfplan
    echo "  - Removed plan files"
    
    echo ""
    echo "✅ ROLLBACK COMPLETE!"
    echo "===================="
    echo ""
    echo "🔍 What was removed:"
    echo "  - All DynamoDB alerts infrastructure"
    echo "  - Lambda function and execution role"
    echo "  - CloudWatch subscription filter"
    echo ""
    echo "✅ What remains intact:"
    echo "  - Your original CloudWatch logs"
    echo "  - All other PhantomWall infrastructure"
    echo "  - Terraform configuration files (for future re-deployment)"
    echo ""
    echo "🔄 To re-deploy later:"
    echo "  bash deploy-alerts.sh"
}

# Function to disable alerts without destroying
disable_alerts() {
    echo "⏸️  Disabling alerts processing..."
    
    terraform plan -var="enable_alerts_dynamodb=false" -out=alerts-disable.tfplan
    terraform apply alerts-disable.tfplan
    
    rm -f alerts-disable.tfplan
    
    echo ""
    echo "⏸️  ALERTS DISABLED!"
    echo "=================="
    echo ""
    echo "📊 Infrastructure preserved but inactive:"
    echo "  - DynamoDB table exists but no new data"
    echo "  - Lambda function removed"
    echo "  - Subscription filter removed"
    echo ""
    echo "🔄 To re-enable:"
    echo "  bash deploy-alerts.sh"
}

# Main menu
main() {
    echo "Choose rollback option:"
    echo ""
    echo "1) 🗑️  Complete Rollback (Delete everything including data)"
    echo "2) ⏸️  Disable Only (Keep data, stop processing)"
    echo "3) ❌ Cancel"
    echo ""
    
    read -p "Select option (1-3): " -r choice
    echo ""
    
    case $choice in
        1)
            echo "⚠️  COMPLETE ROLLBACK SELECTED"
            echo "This will permanently delete all alert data!"
            echo ""
            
            show_destroy_plan
            echo ""
            
            read -p "🚨 Are you SURE you want to delete everything? (type 'DELETE' to confirm): " -r
            echo ""
            
            if [[ $REPLY == "DELETE" ]]; then
                execute_rollback
            else
                echo "❌ Rollback cancelled - nothing was deleted"
                exit 0
            fi
            ;;
        2)
            echo "⏸️  DISABLE ALERTS SELECTED"
            echo ""
            
            read -p "🤔 Disable alerts processing but keep data? (y/N): " -r
            echo ""
            
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                disable_alerts
            else
                echo "❌ Operation cancelled"
                exit 0
            fi
            ;;
        3|*)
            echo "❌ Operation cancelled"
            exit 0
            ;;
    esac
    
    echo ""
    echo "🎉 Operation completed successfully!"
}

# Run main function
main "$@"