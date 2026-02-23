# ═══════════════════════════════════════════════════════════════
#  WebSocket API — Real-time Traffic Ledger
# ═══════════════════════════════════════════════════════════════
#  Flow: DynamoDB Stream → Broadcaster Lambda → WebSocket API → Browser
#  Cost: ~$0.00–$0.05/month at low traffic
# ═══════════════════════════════════════════════════════════════

# ── Connection Tracking Table ───────────────────────────────────
resource "aws_dynamodb_table" "ws_connections" {
  name         = "${var.project_name}-ws-connections-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "connectionId"

  attribute {
    name = "connectionId"
    type = "S"
  }

  # Auto-expire stale connections after 24 hours
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Project = var.project_name
    Env     = var.environment
    Service = "websocket-connections"
  }
}

# ── WebSocket API Gateway ───────────────────────────────────────
resource "aws_apigatewayv2_api" "websocket" {
  name                       = "${var.project_name}-ws-${var.environment}"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"

  tags = {
    Project = var.project_name
    Env     = var.environment
  }
}

resource "aws_apigatewayv2_stage" "ws_prod" {
  api_id      = aws_apigatewayv2_api.websocket.id
  name        = "prod"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 50
    throttling_rate_limit  = 25
  }

  tags = {
    Project = var.project_name
    Env     = var.environment
  }
}

# ── WebSocket Handler Lambda ───────────────────────────────────
resource "aws_iam_role" "ws_handler" {
  name = "${var.project_name}-ws-handler-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "lambda.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "ws_handler" {
  name = "${var.project_name}-ws-handler-policy-${var.environment}"
  role = aws_iam_role.ws_handler.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
          "dynamodb:GetItem",
          "dynamodb:Scan",
        ],
        Resource = aws_dynamodb_table.ws_connections.arn
      },
      {
        Effect   = "Allow",
        Action   = "execute-api:ManageConnections",
        Resource = "${aws_apigatewayv2_api.websocket.execution_arn}/*"
      },
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        Resource = "*"
      }
    ]
  })
}

data "archive_file" "ws_handler" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/ws_handler"
  output_path = "${path.module}/lambda/ws_handler.zip"
}

resource "aws_lambda_function" "ws_handler" {
  function_name    = "${var.project_name}-ws-handler-${var.environment}"
  role             = aws_iam_role.ws_handler.arn
  handler          = "handler.handler"
  runtime          = "python3.11"
  filename         = data.archive_file.ws_handler.output_path
  source_code_hash = data.archive_file.ws_handler.output_base64sha256
  timeout          = 10
  memory_size      = 128

  environment {
    variables = {
      CONNECTIONS_TABLE = aws_dynamodb_table.ws_connections.name
    }
  }

  tags = {
    Project = var.project_name
    Env     = var.environment
    Purpose = "WebSocket connect/disconnect handler"
  }
}

resource "aws_cloudwatch_log_group" "ws_handler" {
  name              = "/aws/lambda/${aws_lambda_function.ws_handler.function_name}"
  retention_in_days = 7
}

# ── WebSocket Routes ────────────────────────────────────────────
resource "aws_apigatewayv2_integration" "ws_handler" {
  api_id             = aws_apigatewayv2_api.websocket.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.ws_handler.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "ws_connect" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.ws_handler.id}"
}

resource "aws_apigatewayv2_route" "ws_disconnect" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.ws_handler.id}"
}

resource "aws_apigatewayv2_route" "ws_default" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.ws_handler.id}"
}

resource "aws_lambda_permission" "ws_handler" {
  statement_id  = "AllowAPIGatewayWebSocket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ws_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket.execution_arn}/*/*"
}


# ── Stream Broadcaster Lambda ──────────────────────────────────
#  Triggered by DynamoDB Streams, fans out new events to all
#  connected WebSocket clients.
# ────────────────────────────────────────────────────────────────
resource "aws_iam_role" "ws_broadcaster" {
  name = "${var.project_name}-ws-broadcaster-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "lambda.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "ws_broadcaster" {
  name = "${var.project_name}-ws-broadcaster-policy-${var.environment}"
  role = aws_iam_role.ws_broadcaster.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "dynamodb:Scan",
          "dynamodb:DeleteItem",
        ],
        Resource = aws_dynamodb_table.ws_connections.arn
      },
      {
        Effect = "Allow",
        Action = [
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:DescribeStream",
          "dynamodb:ListStreams",
        ],
        Resource = "${aws_dynamodb_table.suricata_events.arn}/stream/*"
      },
      {
        Effect   = "Allow",
        Action   = "execute-api:ManageConnections",
        Resource = "${aws_apigatewayv2_api.websocket.execution_arn}/*"
      },
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        Resource = "*"
      }
    ]
  })
}

data "archive_file" "ws_broadcaster" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/ws_broadcaster"
  output_path = "${path.module}/lambda/ws_broadcaster.zip"
}

resource "aws_lambda_function" "ws_broadcaster" {
  function_name    = "${var.project_name}-ws-broadcaster-${var.environment}"
  role             = aws_iam_role.ws_broadcaster.arn
  handler          = "handler.handler"
  runtime          = "python3.11"
  filename         = data.archive_file.ws_broadcaster.output_path
  source_code_hash = data.archive_file.ws_broadcaster.output_base64sha256
  timeout          = 30
  memory_size      = 128

  environment {
    variables = {
      CONNECTIONS_TABLE = aws_dynamodb_table.ws_connections.name
      WS_ENDPOINT      = "https://${aws_apigatewayv2_api.websocket.id}.execute-api.${var.aws_region}.amazonaws.com/prod"
    }
  }

  tags = {
    Project = var.project_name
    Env     = var.environment
    Purpose = "Broadcast DynamoDB stream events to WebSocket clients"
  }
}

resource "aws_cloudwatch_log_group" "ws_broadcaster" {
  name              = "/aws/lambda/${aws_lambda_function.ws_broadcaster.function_name}"
  retention_in_days = 7
}

# ── DynamoDB Stream → Broadcaster ───────────────────────────────
resource "aws_lambda_event_source_mapping" "ws_broadcaster_stream" {
  event_source_arn  = aws_dynamodb_table.suricata_events.stream_arn
  function_name     = aws_lambda_function.ws_broadcaster.arn
  starting_position = "LATEST"
  batch_size        = 10
  maximum_batching_window_in_seconds = 1  # Low latency — flush quickly

  filter_criteria {
    filter {
      pattern = jsonencode({
        eventName = ["INSERT"]
      })
    }
  }
}


# ── Outputs ─────────────────────────────────────────────────────
output "websocket_url" {
  description = "WebSocket endpoint for the Traffic Ledger"
  value       = "wss://${aws_apigatewayv2_api.websocket.id}.execute-api.${var.aws_region}.amazonaws.com/prod"
}

output "ws_handler_lambda" {
  value = aws_lambda_function.ws_handler.function_name
}

output "ws_broadcaster_lambda" {
  value = aws_lambda_function.ws_broadcaster.function_name
}
