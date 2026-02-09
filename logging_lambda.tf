# ===========================================================
#                     PhantomWall Cloud Threat
#                     Logging Lambda Configuration
# ===========================================================
# Description: Log pipeline: CloudWatch Logs -> Lambda -> DynamoDB
#             Captures honeypot telemetry in near real-time
# 
# Naming Convention: phantomwall-{resource}-{environment}
# Last Updated: 2026-02-08
# ===========================================================

resource "aws_cloudwatch_log_group" "suricata" {
  name              = var.cw_log_group
  retention_in_days = 7  # Reduced from 30 days - data persists in DynamoDB (~$4/month savings)

  tags = {
    Project = var.project_name
    Env     = var.environment
    Service = "suricata"
  }
}

resource "aws_dynamodb_table" "suricata_events" {
  name         = "${var.project_name}-dynamodb-events-${var.environment}"
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
    Env     = var.environment
    Service = "suricata-events"
  }
}

resource "aws_iam_role" "lambda_ingest" {
  name = "${var.project_name}-lambda-ingest-role-${var.environment}"

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
  name = "${var.project_name}-lambda-ingest-policy-${var.environment}"
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
          "s3:PutObject",
          "s3:PutObjectAcl"
        ],
        Resource = "${aws_s3_bucket.suricata_logs.arn}/*"
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
  function_name    = "${var.project_name}-lambda-ingest-${var.environment}"
  role             = aws_iam_role.lambda_ingest.arn
  handler          = "handler.handler"
  runtime          = "python3.11"
  filename         = data.archive_file.suricata_lambda.output_path
  source_code_hash = data.archive_file.suricata_lambda.output_base64sha256
  timeout          = 30
  memory_size      = 256  # Reduced from 512 MB - sufficient for JSON processing (~$1/month savings)

  environment {
    variables = {
      TABLE_NAME       = aws_dynamodb_table.suricata_events.name
      S3_BUCKET_NAME   = aws_s3_bucket.suricata_logs.id
      ENABLE_S3_BACKUP = "true"  # Feature flag to enable/disable S3 writes
    }
  }

  tags = {
    Project = var.project_name
    Env     = var.environment
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
  name            = "${var.project_name}-cloudwatch-lambda-subscription-${var.environment}"
  log_group_name  = aws_cloudwatch_log_group.suricata.name
  filter_pattern  = ""
  destination_arn = aws_lambda_function.suricata_ingest.arn

  depends_on = [aws_lambda_permission.allow_logs]
}

