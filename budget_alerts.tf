/*
================================================================================
AWS Budget Alerts Configuration
================================================================================
Purpose: Monitors AWS costs and sends email notifications at defined thresholds.

Naming Convention: {project-name}-budget-{resource}-{environment}
Example: phantomwall-budget-monthly-dev

Resources:
- Monthly budget with tiered alerts ($30, $50, $75)
- Daily anomaly detection monitor
- Cost anomaly subscription alerts

Security: Email notifications sent to configured budget_alert_email variable.
================================================================================
*/

# Budget with multiple alert thresholds
# Only created when budget_alert_email is configured
resource "aws_budgets_budget" "phantomwall_monthly" {
  count             = var.budget_alert_email != "" ? 1 : 0
  name              = "${var.project_name}-budget-monthly-${var.environment}"
  budget_type       = "COST"
  limit_amount      = "75"
  limit_unit        = "USD"
  time_unit         = "MONTHLY"
  time_period_start = "2026-02-01_00:00"

  # Alert at $30 (80% of expected normal usage)
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 30
    threshold_type             = "ABSOLUTE_VALUE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_alert_email]
  }

  # Alert at $50 (Investigation needed)
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 50
    threshold_type             = "ABSOLUTE_VALUE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_alert_email]
  }

  # Alert at $75 (Critical - consider shutdown)
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 75
    threshold_type             = "ABSOLUTE_VALUE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_alert_email]
  }

  # Forecasted cost alert at $75
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 75
    threshold_type             = "ABSOLUTE_VALUE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.budget_alert_email]
  }

  cost_filter {
    name = "Service"
    values = [
      "Amazon Elastic Compute Cloud - Compute",
      "AWS Lambda",
      "Amazon DynamoDB",
      "Amazon Simple Storage Service",
      "Amazon API Gateway",
      "Amazon CloudWatch",
      "AWS Amplify"
    ]
  }

  tags = {
    Name        = "${var.project_name}-budget-monthly-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

# Note: AWS Cost Anomaly Detection is not created here because AWS accounts
# already have a default DIMENSIONAL monitor, and only one is allowed.
# The budget alerts above ($30/$50/$75 thresholds) provide sufficient cost monitoring.
# You can configure additional anomaly detection in the AWS Console if needed.

# Outputs
output "budget_name" {
  description = "Name of the AWS Budget"
  value       = var.budget_alert_email != "" ? aws_budgets_budget.phantomwall_monthly[0].name : "not configured"
}

output "budget_limit" {
  description = "Monthly budget limit in USD"
  value       = var.budget_alert_email != "" ? "${aws_budgets_budget.phantomwall_monthly[0].limit_amount} ${aws_budgets_budget.phantomwall_monthly[0].limit_unit}" : "not configured"
}

output "budget_alert_thresholds" {
  description = "Budget alert thresholds configured"
  value       = "$30, $50, $75 (actual) + $75 (forecasted)"
}
