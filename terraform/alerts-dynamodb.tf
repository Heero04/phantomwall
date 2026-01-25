# Move this content to the main directory
# This file should be moved to: ../alerts-dynamodb.tf

# Variables for configuration
variable "cloudwatch_log_group_name" {
  description = "CloudWatch log group name for Suricata logs"
  type        = string
  default     = "/aws/ec2/suricata"  # Common pattern - update if different
}

variable "environment" {
  description = "Environment (dev/prod)"
  type        = string
  default     = "dev"
}

# Get current AWS account and region
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ==========================================
# DynamoDB Table for Alerts
# ==========================================
resource "aws_dynamodb_table" "phantomwall_alerts" {
  name           = "phantomwall-alerts-${var.environment}"
  billing_mode   = "ON_DEMAND"  # Pay per request - perfect for alerts
  hash_key       = "PK"
  range_key      = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  # GSI for querying by source IP
  attribute {
    name = "src_ip"
    type = "S"
  }

  global_secondary_index {
    name            = "src-ip-index"
    hash_key        = "src_ip"
    range_key       = "PK"
    projection_type = "ALL"
  }

  # GSI for querying by signature
  attribute {
    name = "signature_id"
    type = "N"
  }

  global_secondary_index {
    name            = "signature-index"
    hash_key        = "signature_id"
    range_key       = "PK"
    projection_type = "ALL"
  }

  # Auto-delete old alerts after 30 days
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Name        = "PhantomWall Alerts"
    Environment = var.environment
    Purpose     = "Alert indexing for fast queries"
  }
}

# ==========================================
# Lambda Function for Alert Indexing
# ==========================================

# Lambda execution role
resource "aws_iam_role" "alert_indexer_role" {
  name = "phantomwall-alert-indexer-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# Lambda permissions
resource "aws_iam_role_policy" "alert_indexer_policy" {
  name = "phantomwall-alert-indexer-policy"
  role = aws_iam_role.alert_indexer_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem"
        ]
        Resource = aws_dynamodb_table.phantomwall_alerts.arn
      }
    ]
  })
}

# Lambda function code
resource "aws_lambda_function" "alert_indexer" {
  filename         = "alert-indexer.zip"
  function_name    = "phantomwall-alert-indexer-${var.environment}"
  role            = aws_iam_role.alert_indexer_role.arn
  handler         = "index.handler"
  runtime         = "python3.9"
  timeout         = 30

  environment {
    variables = {
      DYNAMODB_TABLE = aws_dynamodb_table.phantomwall_alerts.name
      ENVIRONMENT    = var.environment
    }
  }

  depends_on = [aws_iam_role_policy.alert_indexer_policy]

  tags = {
    Name        = "PhantomWall Alert Indexer"
    Environment = var.environment
  }
}

# CloudWatch log group for Lambda
resource "aws_cloudwatch_log_group" "alert_indexer_logs" {
  name              = "/aws/lambda/${aws_lambda_function.alert_indexer.function_name}"
  retention_in_days = 7
}

# ==========================================
# CloudWatch Logs Subscription Filter
# ==========================================

# Permission for CloudWatch Logs to invoke Lambda
resource "aws_lambda_permission" "allow_cloudwatch" {
  statement_id  = "AllowExecutionFromCloudWatchLogs"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.alert_indexer.function_name
  principal     = "logs.amazonaws.com"
  source_arn    = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:${var.cloudwatch_log_group_name}:*"
}

# Subscription filter to send only alerts to Lambda
resource "aws_cloudwatch_log_subscription_filter" "suricata_alerts" {
  name            = "phantomwall-alert-filter-${var.environment}"
  log_group_name  = var.cloudwatch_log_group_name
  filter_pattern  = "{ $.event_type = \"alert\" }"
  destination_arn = aws_lambda_function.alert_indexer.arn

  depends_on = [aws_lambda_permission.allow_cloudwatch]
}

# ==========================================
# Outputs
# ==========================================
output "dynamodb_table_name" {
  description = "Name of the DynamoDB alerts table"
  value       = aws_dynamodb_table.phantomwall_alerts.name
}

output "lambda_function_name" {
  description = "Name of the alert indexer Lambda function"
  value       = aws_lambda_function.alert_indexer.function_name
}

output "subscription_filter_name" {
  description = "Name of the CloudWatch subscription filter"
  value       = aws_cloudwatch_log_subscription_filter.suricata_alerts.name
}

# Rollback instructions
output "rollback_command" {
  description = "Command to rollback this module"
  value       = "terraform destroy -target=module.alerts"
}