# ===========================================================
#                     PhantomWall Cloud Threat
#                     Fleet Manager Lambda
# ===========================================================
# Description: Lambda + API Gateway wiring for the Fleet
#              Manager page – lists EC2 honeypot instances,
#              SSM agent status, CloudWatch metrics, and
#              exposes start/stop/reboot actions.
#
# Routes:
#   GET  /fleet/instances   → list fleet with metrics
#   POST /fleet/action      → start / stop / reboot
#
# Naming Convention: phantomwall-{resource}-{environment}
# ===========================================================

# ----------------------------------------------------------
#            IAM Role & Policy
# ----------------------------------------------------------
resource "aws_iam_role" "lambda_fleet" {
  name = "${var.project_name}-lambda-fleet-role-${var.environment}"

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

  tags = {
    Project = var.project_name
    Env     = var.environment
  }
}

resource "aws_iam_role_policy" "lambda_fleet" {
  name = "${var.project_name}-lambda-fleet-policy-${var.environment}"
  role = aws_iam_role.lambda_fleet.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      # CloudWatch Logs – Lambda execution logs
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        Resource = "*"
      },
      # EC2 – describe instances + status checks
      {
        Effect = "Allow",
        Action = [
          "ec2:DescribeInstances",
          "ec2:DescribeInstanceStatus",
          "ec2:DescribeTags"
        ],
        Resource = "*"
      },
      # EC2 – instance lifecycle actions (scoped to project tag)
      {
        Effect = "Allow",
        Action = [
          "ec2:StartInstances",
          "ec2:StopInstances",
          "ec2:RebootInstances"
        ],
        Resource = "*",
        Condition = {
          StringEquals = {
            "ec2:ResourceTag/Project" = var.project_name
          }
        }
      },
      # SSM – agent status + SendCommand for graceful reboot
      {
        Effect = "Allow",
        Action = [
          "ssm:DescribeInstanceInformation",
          "ssm:SendCommand",
          "ssm:GetCommandInvocation"
        ],
        Resource = "*"
      },
      # CloudWatch – CPU & memory metrics
      {
        Effect = "Allow",
        Action = [
          "cloudwatch:GetMetricData",
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:ListMetrics"
        ],
        Resource = "*"
      }
    ]
  })
}

# ----------------------------------------------------------
#            Lambda Function
# ----------------------------------------------------------
data "archive_file" "fleet_manager" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/fleet_manager"
  output_path = "${path.module}/lambda/fleet_manager.zip"
}

resource "aws_lambda_function" "fleet_manager" {
  function_name    = "${var.project_name}-lambda-fleet-manager-${var.environment}"
  role             = aws_iam_role.lambda_fleet.arn
  handler          = "handler.handler"
  runtime          = "python3.11"
  filename         = data.archive_file.fleet_manager.output_path
  source_code_hash = data.archive_file.fleet_manager.output_base64sha256
  timeout          = 30
  memory_size      = 128

  environment {
    variables = {
      PROJECT_TAG = var.project_name
    }
  }

  tags = {
    Project = var.project_name
    Env     = var.environment
  }
}

resource "aws_cloudwatch_log_group" "fleet_manager" {
  name              = "/aws/lambda/${aws_lambda_function.fleet_manager.function_name}"
  retention_in_days = 7
}

# ----------------------------------------------------------
#            API Gateway Integration
# ----------------------------------------------------------
resource "aws_apigatewayv2_integration" "fleet_manager" {
  api_id                 = aws_apigatewayv2_api.suricata.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.fleet_manager.invoke_arn
  payload_format_version = "2.0"
  integration_method     = "POST"
}

# GET /fleet/instances
resource "aws_apigatewayv2_route" "fleet_instances" {
  api_id    = aws_apigatewayv2_api.suricata.id
  route_key = "GET /fleet/instances"
  target    = "integrations/${aws_apigatewayv2_integration.fleet_manager.id}"
}

# POST /fleet/action
resource "aws_apigatewayv2_route" "fleet_action" {
  api_id    = aws_apigatewayv2_api.suricata.id
  route_key = "POST /fleet/action"
  target    = "integrations/${aws_apigatewayv2_integration.fleet_manager.id}"
}

# ----------------------------------------------------------
#            Lambda Permission for API Gateway
# ----------------------------------------------------------
resource "aws_lambda_permission" "apigw_fleet_invoke" {
  statement_id  = "AllowAPIGatewayInvokeFleet"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fleet_manager.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.suricata.execution_arn}/*/*"
}

# ----------------------------------------------------------
#            Outputs
# ----------------------------------------------------------
output "fleet_manager_lambda" {
  value       = aws_lambda_function.fleet_manager.function_name
  description = "Lambda function for Fleet Manager API"
}

output "fleet_api_endpoint" {
  value       = "${aws_apigatewayv2_api.suricata.api_endpoint}/prod/fleet/instances"
  description = "Fleet Manager GET endpoint"
}
