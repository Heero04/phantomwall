# ===========================================================
#                     PhantomWall Cloud Threat
#                     API Gateway Configuration
# ===========================================================
# Description: Public API for the PhantomWall dashboard
#             surfaces Suricata events stored in DynamoDB
# 
# Naming Convention: phantomwall-{resource}-{environment}
# Last Updated: 2026-02-08
# ===========================================================

resource "aws_iam_role" "lambda_api" {
  name = "${var.project_name}-lambda-api-role-${var.environment}"

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

resource "aws_iam_role_policy" "lambda_api" {
  name = "${var.project_name}-lambda-api-policy-${var.environment}"
  role = aws_iam_role.lambda_api.id

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
      }
    ]
  })
}

data "archive_file" "suricata_api" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/suricata_api"
  output_path = "${path.module}/lambda/suricata_api.zip"
}

resource "aws_lambda_function" "suricata_api" {
  function_name    = "${var.project_name}-lambda-suricata-api-${var.environment}"
  role             = aws_iam_role.lambda_api.arn
  handler          = "handler.handler"
  runtime          = "python3.11"
  filename         = data.archive_file.suricata_api.output_path
  source_code_hash = data.archive_file.suricata_api.output_base64sha256
  timeout          = 45
  memory_size      = 128 # Reduced from 256 MB - sufficient for DynamoDB queries (~$1/month savings)

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.suricata_events.name
    }
  }

  tags = {
    Project = var.project_name
    Env     = var.environment
  }
}

resource "aws_cloudwatch_log_group" "suricata_api" {
  name              = "/aws/lambda/${aws_lambda_function.suricata_api.function_name}"
  retention_in_days = 7 # Reduced from 14 days for cost optimization
}

resource "aws_apigatewayv2_api" "suricata" {
  name          = "${var.project_name}-api-gateway-${var.environment}"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["*"]
    max_age       = 600
  }
}

resource "aws_apigatewayv2_stage" "suricata" {
  api_id      = aws_apigatewayv2_api.suricata.id
  name        = "prod"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gw_logs.arn
    format = jsonencode({
      requestId        = "$context.requestId",
      httpMethod       = "$context.httpMethod",
      path             = "$context.path",
      status           = "$context.status",
      integrationError = "$context.integrationErrorMessage"
    })
  }
}

resource "aws_cloudwatch_log_group" "api_gw_logs" {
  name              = "/aws/lambda/${aws_lambda_function.suricata_api.function_name}"
  retention_in_days = 7 # Reduced from 14 days for cost optimization
}

resource "aws_apigatewayv2_integration" "suricata" {
  api_id                 = aws_apigatewayv2_api.suricata.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.suricata_api.invoke_arn
  payload_format_version = "2.0"
  integration_method     = "POST"
}

resource "aws_apigatewayv2_route" "suricata_events" {
  api_id    = aws_apigatewayv2_api.suricata.id
  route_key = "GET /events"
  target    = "integrations/${aws_apigatewayv2_integration.suricata.id}"
}

resource "aws_apigatewayv2_route" "suricata_metrics" {
  api_id    = aws_apigatewayv2_api.suricata.id
  route_key = "GET /metrics"
  target    = "integrations/${aws_apigatewayv2_integration.suricata.id}"
}

resource "aws_lambda_permission" "apigw_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.suricata_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.suricata.execution_arn}/*/*"
}

resource "aws_apigatewayv2_integration" "suricata_chat" {
  api_id                 = aws_apigatewayv2_api.suricata.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.suricata_chat.invoke_arn
  payload_format_version = "2.0"
  integration_method     = "POST"
}

resource "aws_apigatewayv2_route" "suricata_chat" {
  api_id    = aws_apigatewayv2_api.suricata.id
  route_key = "POST /chat"
  target    = "integrations/${aws_apigatewayv2_integration.suricata_chat.id}"
}

resource "aws_lambda_permission" "apigw_chat_invoke" {
  statement_id  = "AllowAPIGatewayInvokeChat"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.suricata_chat.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.suricata.execution_arn}/*/*"
}

