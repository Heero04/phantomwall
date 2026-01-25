# Log pipeline: CloudWatch Logs -> Lambda -> DynamoDB for Suricata events.
# Purpose: capture honeypot telemetry in near real-time for the SaaS dashboard.

resource "aws_cloudwatch_log_group" "suricata" {
  name              = var.cw_log_group
  retention_in_days = 30

  tags = {
    Project = var.project_name
    Env     = terraform.workspace
    Service = "suricata"
  }
}

resource "aws_dynamodb_table" "suricata_events" {
  name         = "${var.project_name}-${terraform.workspace}-suricata-events"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "event_date"
  range_key    = "event_id"

  attribute {
    name = "event_date"
    type = "S"
  }

  attribute {
    name = "event_id"
    type = "S"
  }

  tags = {
    Project = var.project_name
    Env     = terraform.workspace
    Service = "suricata-events"
  }
}

resource "aws_iam_role" "lambda_ingest" {
  name = "${local.resource_name_prefix}-suricata-lambda-role-${terraform.workspace}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect    = "Allow",
        Principal = { Service = "lambda.amazonaws.com" },
        Action    = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_ingest" {
  name = "${local.resource_name_prefix}-suricata-lambda-policy-${terraform.workspace}"
  role = aws_iam_role.lambda_ingest.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "dynamodb:BatchWriteItem",
          "dynamodb:PutItem",
          "dynamodb:DescribeTable"
        ],
        Resource = aws_dynamodb_table.suricata_events.arn
      },
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        Resource = "*"
      }
    ]
  })
}

data "archive_file" "suricata_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/suricata_ingest"
  output_path = "${path.module}/lambda/suricata_ingest_v3.zip"
}

resource "aws_lambda_function" "suricata_ingest" {
  function_name    = "${var.project_name}-${terraform.workspace}-suricata-ingest"
  role             = aws_iam_role.lambda_ingest.arn
  handler          = "handler.handler"
  runtime          = "python3.11"
  filename         = data.archive_file.suricata_lambda.output_path
  source_code_hash = data.archive_file.suricata_lambda.output_base64sha256
  timeout          = 30
  memory_size      = 512

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.suricata_events.name
    }
  }

  tags = {
    Project = var.project_name
    Env     = terraform.workspace
  }
}

resource "aws_lambda_permission" "allow_logs" {
  statement_id  = "AllowCloudWatchLogsInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.suricata_ingest.function_name
  principal     = "logs.${var.aws_region}.amazonaws.com"
  source_arn    = "${aws_cloudwatch_log_group.suricata.arn}:*"
}

resource "aws_cloudwatch_log_subscription_filter" "suricata_to_lambda" {
  name            = "${local.resource_name_prefix}-suricata-lambda-sub"
  log_group_name  = aws_cloudwatch_log_group.suricata.name
  filter_pattern  = ""
  destination_arn = aws_lambda_function.suricata_ingest.arn

  depends_on = [aws_lambda_permission.allow_logs]
}

