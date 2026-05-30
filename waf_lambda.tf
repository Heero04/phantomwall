# ===========================================================
#                     PhantomWall Cloud Threat
#                     WAF Lambda + API Routes
# ===========================================================
# Description: Lambda function serving the WAF management API
#   and the auto-block pipeline triggered by DynamoDB Streams.
#
# Naming: phantomwall-waf-{resource}-{environment}
# ===========================================================

# ── WAF API Lambda ──────────────────────────────────────────────

resource "aws_iam_role" "waf_api" {
  count = var.waf_enabled ? 1 : 0
  name  = "${var.project_name}-waf-api-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "lambda.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "waf_api" {
  count = var.waf_enabled ? 1 : 0
  name  = "${var.project_name}-waf-api-policy-${var.environment}"
  role  = aws_iam_role.waf_api[0].id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "wafv2:GetWebACL",
          "wafv2:UpdateWebACL",
          "wafv2:GetIPSet",
          "wafv2:UpdateIPSet",
          "wafv2:ListWebACLs",
        ],
        Resource = [
          aws_wafv2_web_acl.main[0].arn,
          aws_wafv2_ip_set.blocklist[0].arn,
          aws_wafv2_ip_set.allowlist[0].arn,
          # UpdateWebACL requires permission on managed rule set references
          "arn:aws:wafv2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:regional/managedruleset/*/*",
        ]
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

data "archive_file" "waf_api" {
  count       = var.waf_enabled ? 1 : 0
  type        = "zip"
  source_dir  = "${path.module}/lambda/waf_api"
  output_path = "${path.module}/lambda/waf_api.zip"
}

resource "aws_lambda_function" "waf_api" {
  count            = var.waf_enabled ? 1 : 0
  function_name    = "${var.project_name}-waf-api-${var.environment}"
  role             = aws_iam_role.waf_api[0].arn
  handler          = "handler.handler"
  runtime          = "python3.11"
  filename         = data.archive_file.waf_api[0].output_path
  source_code_hash = data.archive_file.waf_api[0].output_base64sha256
  timeout          = 30
  memory_size      = 128

  environment {
    variables = {
      WAF_WEB_ACL_NAME = aws_wafv2_web_acl.main[0].name
      WAF_WEB_ACL_ID   = aws_wafv2_web_acl.main[0].id
      WAF_BLOCKLIST_NAME = aws_wafv2_ip_set.blocklist[0].name
      WAF_BLOCKLIST_ID   = aws_wafv2_ip_set.blocklist[0].id
      WAF_ALLOWLIST_NAME = aws_wafv2_ip_set.allowlist[0].name
      WAF_ALLOWLIST_ID   = aws_wafv2_ip_set.allowlist[0].id
    }
  }

  tags = {
    Project = var.project_name
    Env     = var.environment
    Purpose = "WAF management API"
  }
}

resource "aws_cloudwatch_log_group" "waf_api" {
  count             = var.waf_enabled ? 1 : 0
  name              = "/aws/lambda/${aws_lambda_function.waf_api[0].function_name}"
  retention_in_days = 7
}

# ── API Gateway Integration ─────────────────────────────────────

resource "aws_apigatewayv2_integration" "waf_api" {
  count                  = var.waf_enabled ? 1 : 0
  api_id                 = aws_apigatewayv2_api.suricata.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.waf_api[0].invoke_arn
  payload_format_version = "2.0"
  integration_method     = "POST"
}

resource "aws_apigatewayv2_route" "waf_status" {
  count     = var.waf_enabled ? 1 : 0
  api_id    = aws_apigatewayv2_api.suricata.id
  route_key = "GET /waf/status"
  target    = "integrations/${aws_apigatewayv2_integration.waf_api[0].id}"
}

resource "aws_apigatewayv2_route" "waf_toggle" {
  count              = var.waf_enabled ? 1 : 0
  api_id             = aws_apigatewayv2_api.suricata.id
  route_key          = "POST /waf/toggle-rule"
  target             = "integrations/${aws_apigatewayv2_integration.waf_api[0].id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "waf_lockdown" {
  count              = var.waf_enabled ? 1 : 0
  api_id             = aws_apigatewayv2_api.suricata.id
  route_key          = "POST /waf/lockdown"
  target             = "integrations/${aws_apigatewayv2_integration.waf_api[0].id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "waf_blocked_ips" {
  count     = var.waf_enabled ? 1 : 0
  api_id    = aws_apigatewayv2_api.suricata.id
  route_key = "GET /waf/blocked-ips"
  target    = "integrations/${aws_apigatewayv2_integration.waf_api[0].id}"
}

resource "aws_apigatewayv2_route" "waf_block_ip" {
  count              = var.waf_enabled ? 1 : 0
  api_id             = aws_apigatewayv2_api.suricata.id
  route_key          = "POST /waf/block-ip"
  target             = "integrations/${aws_apigatewayv2_integration.waf_api[0].id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "waf_unblock_ip" {
  count              = var.waf_enabled ? 1 : 0
  api_id             = aws_apigatewayv2_api.suricata.id
  route_key          = "POST /waf/unblock-ip"
  target             = "integrations/${aws_apigatewayv2_integration.waf_api[0].id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_lambda_permission" "apigw_waf_invoke" {
  count         = var.waf_enabled ? 1 : 0
  statement_id  = "AllowAPIGatewayInvokeWAF"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.waf_api[0].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.suricata.execution_arn}/*/*"
}

# ── Auto-Block Pipeline (DynamoDB Stream → Lambda) ──────────────

resource "aws_iam_role" "waf_autoblock" {
  count = var.waf_enabled ? 1 : 0
  name  = "${var.project_name}-waf-autoblock-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "lambda.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "waf_autoblock" {
  count = var.waf_enabled ? 1 : 0
  name  = "${var.project_name}-waf-autoblock-policy-${var.environment}"
  role  = aws_iam_role.waf_autoblock[0].id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "wafv2:GetIPSet",
          "wafv2:UpdateIPSet",
        ],
        Resource = aws_wafv2_ip_set.blocklist[0].arn
      },
      {
        Effect = "Allow",
        Action = [
          "dynamodb:DescribeStream",
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:ListStreams",
        ],
        Resource = "${aws_dynamodb_table.suricata_events.arn}/stream/*"
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

data "archive_file" "waf_autoblock" {
  count       = var.waf_enabled ? 1 : 0
  type        = "zip"
  source_dir  = "${path.module}/lambda/waf_autoblock"
  output_path = "${path.module}/lambda/waf_autoblock.zip"
}

resource "aws_lambda_function" "waf_autoblock" {
  count            = var.waf_enabled ? 1 : 0
  function_name    = "${var.project_name}-waf-autoblock-${var.environment}"
  role             = aws_iam_role.waf_autoblock[0].arn
  handler          = "handler.handler"
  runtime          = "python3.11"
  filename         = data.archive_file.waf_autoblock[0].output_path
  source_code_hash = data.archive_file.waf_autoblock[0].output_base64sha256
  timeout          = 60
  memory_size      = 128

  environment {
    variables = {
      WAF_BLOCKLIST_NAME     = aws_wafv2_ip_set.blocklist[0].name
      WAF_BLOCKLIST_ID       = aws_wafv2_ip_set.blocklist[0].id
      AUTO_BLOCK_MAX_SEVERITY = "1"
    }
  }

  tags = {
    Project = var.project_name
    Env     = var.environment
    Purpose = "Auto-block malicious IPs from honeypot alerts"
  }
}

resource "aws_cloudwatch_log_group" "waf_autoblock" {
  count             = var.waf_enabled ? 1 : 0
  name              = "/aws/lambda/${aws_lambda_function.waf_autoblock[0].function_name}"
  retention_in_days = 7
}

resource "aws_lambda_event_source_mapping" "waf_autoblock_stream" {
  count             = var.waf_enabled ? 1 : 0
  event_source_arn  = aws_dynamodb_table.suricata_events.stream_arn
  function_name     = aws_lambda_function.waf_autoblock[0].arn
  starting_position = "LATEST"
  batch_size        = 25
  maximum_batching_window_in_seconds = 30

  filter_criteria {
    filter {
      pattern = jsonencode({
        eventName = ["INSERT"]
      })
    }
  }
}
