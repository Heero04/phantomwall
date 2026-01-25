# ==========================================
# 🚨 PhantomWall Alerts DynamoDB Module
# ==========================================
# Fast alert indexing with DynamoDB - integrates with existing infrastructure
# Can be deployed/destroyed independently for safe testing
# ==========================================

# Data sources for AWS account and region
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Local variables for alerts module
locals {
  alerts_enabled   = var.enable_alerts_dynamodb
  alert_table_name = "phantomwall-alerts-${var.environment}"
}

# Variable to enable/disable alerts feature
variable "enable_alerts_dynamodb" {
  description = "Enable DynamoDB alerts indexing"
  type        = bool
  default     = true
}

# ==========================================
# DynamoDB Table for Alerts
# ==========================================
resource "aws_dynamodb_table" "phantomwall_alerts" {
  count        = local.alerts_enabled ? 1 : 0
  name         = local.alert_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

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

  tags = merge(var.common_tags, {
    Name    = "PhantomWall Alerts"
    Purpose = "Fast alert indexing"
  })
}

# ==========================================
# Lambda Function for Alert Indexing
# ==========================================

# Create Lambda deployment package
data "archive_file" "alert_indexer_zip" {
  count       = local.alerts_enabled ? 1 : 0
  type        = "zip"
  output_path = "${path.module}/alert-indexer.zip"

  source {
    content = templatefile("${path.module}/lambda/alert-indexer.py", {
      table_name = local.alert_table_name
    })
    filename = "index.py"
  }
}

# Lambda execution role
resource "aws_iam_role" "alert_indexer_role" {
  count = local.alerts_enabled ? 1 : 0
  name  = "phantomwall-alert-indexer-${var.environment}"

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

  tags = var.common_tags
}

# Lambda permissions
resource "aws_iam_role_policy" "alert_indexer_policy" {
  count = local.alerts_enabled ? 1 : 0
  name  = "phantomwall-alert-indexer-policy"
  role  = aws_iam_role.alert_indexer_role[0].id

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
        Resource = aws_dynamodb_table.phantomwall_alerts[0].arn
      }
    ]
  })
}

# Lambda function
resource "aws_lambda_function" "alert_indexer" {
  count            = local.alerts_enabled ? 1 : 0
  filename         = data.archive_file.alert_indexer_zip[0].output_path
  source_code_hash = data.archive_file.alert_indexer_zip[0].output_base64sha256
  function_name    = "phantomwall-alert-indexer-${var.environment}"
  role             = aws_iam_role.alert_indexer_role[0].arn
  handler          = "index.lambda_handler"
  runtime          = "python3.9"
  timeout          = 30

  environment {
    variables = {
      DYNAMODB_TABLE = local.alert_table_name
      ENVIRONMENT    = var.environment
    }
  }

  tags = merge(var.common_tags, {
    Name = "PhantomWall Alert Indexer"
  })
}

# CloudWatch log group for Lambda
resource "aws_cloudwatch_log_group" "alert_indexer_logs" {
  count             = local.alerts_enabled ? 1 : 0
  name              = "/aws/lambda/${aws_lambda_function.alert_indexer[0].function_name}"
  retention_in_days = 7

  tags = var.common_tags
}

# ==========================================
# CloudWatch Logs Subscription Filter
# ==========================================

# Permission for CloudWatch Logs to invoke Lambda
resource "aws_lambda_permission" "allow_cloudwatch" {
  count         = local.alerts_enabled ? 1 : 0
  statement_id  = "AllowExecutionFromCloudWatchLogs"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.alert_indexer[0].function_name
  principal     = "logs.amazonaws.com"
  source_arn    = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:${var.cw_log_group}:*"
}

# Subscription filter to send only alerts to Lambda
resource "aws_cloudwatch_log_subscription_filter" "suricata_alerts" {
  count           = local.alerts_enabled ? 1 : 0
  name            = "phantomwall-alert-filter-${var.environment}"
  log_group_name  = var.cw_log_group
  filter_pattern  = "{ $.event_type = \"alert\" }"
  destination_arn = aws_lambda_function.alert_indexer[0].arn

  depends_on = [aws_lambda_permission.allow_cloudwatch]
}

# ==========================================
# Outputs
# ==========================================
output "alerts_dynamodb_table_name" {
  description = "Name of the DynamoDB alerts table"
  value       = local.alerts_enabled ? aws_dynamodb_table.phantomwall_alerts[0].name : null
}

output "alerts_lambda_function_name" {
  description = "Name of the alert indexer Lambda function"
  value       = local.alerts_enabled ? aws_lambda_function.alert_indexer[0].function_name : null
}