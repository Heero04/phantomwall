# ===========================================================
#                     PhantomWall Cloud Threat
#                     Bedrock Chat Configuration
# ===========================================================
# Description: AWS Bedrock-powered chat assistant for
#             security analysis and threat intelligence
# 
# Naming Convention: phantomwall-{resource}-{environment}
# Last Updated: 2026-02-08
# ===========================================================

resource "aws_iam_role" "lambda_chat" {
  name = "${var.project_name}-lambda-chat-role-${var.environment}"

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

resource "aws_iam_role_policy" "lambda_chat" {
  name = "${var.project_name}-lambda-chat-policy-${var.environment}"
  role = aws_iam_role.lambda_chat.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "dynamodb:Query",
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
      },
      {
        Effect   = "Allow",
        Action   = "bedrock:InvokeModel",
        Resource = "*"
      }
    ]
  })
}

data "archive_file" "chat_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/chat_assistant"
  output_path = "${path.module}/lambda/chat_assistant.zip"
}

resource "aws_lambda_function" "suricata_chat" {
  function_name    = "${var.project_name}-lambda-bedrock-chat-${var.environment}"
  role             = aws_iam_role.lambda_chat.arn
  handler          = "handler.handler"
  runtime          = "python3.11"
  filename         = data.archive_file.chat_lambda.output_path
  source_code_hash = data.archive_file.chat_lambda.output_base64sha256
  timeout          = 30
  memory_size      = 512

  environment {
    variables = {
      TABLE_NAME       = aws_dynamodb_table.suricata_events.name
      BEDROCK_MODEL_ID = var.bedrock_model_id
      MAX_ITEMS        = var.chat_max_items
    }
  }

  tags = {
    Project = var.project_name
    Env     = var.environment
  }
}

resource "aws_cloudwatch_log_group" "suricata_chat" {
  name              = "/aws/lambda/${aws_lambda_function.suricata_chat.function_name}"
  retention_in_days = 7  # Reduced from 14 days for cost optimization
}
