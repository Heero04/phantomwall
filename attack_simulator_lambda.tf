resource "aws_iam_role" "attack_simulator" {
  name = "${var.project_name}-attack-simulator-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect    = "Allow",
        Principal = { Service = "lambda.amazonaws.com" },
        Action    = "sts:AssumeRole",
      }
    ],
  })
}

resource "aws_iam_role_policy" "attack_simulator" {
  name = "${var.project_name}-attack-simulator-policy-${var.environment}"
  role = aws_iam_role.attack_simulator.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        Resource = "*",
      },
      {
        Effect = "Allow",
        Action = [
          "ec2:DescribeInstances",
        ],
        Resource = "*",
      },
    ],
  })
}

data "archive_file" "attack_simulator" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/attack_simulator"
  output_path = "${path.module}/lambda/attack_simulator.zip"
}

resource "aws_lambda_function" "attack_simulator" {
  function_name    = "${var.project_name}-attack-simulator-${var.environment}"
  role             = aws_iam_role.attack_simulator.arn
  handler          = "handler.handler"
  runtime          = "python3.11"
  filename         = data.archive_file.attack_simulator.output_path
  source_code_hash = data.archive_file.attack_simulator.output_base64sha256
  timeout          = 150
  memory_size      = 256

  tags = {
    Project = var.project_name
    Env     = var.environment
  }
}

resource "aws_cloudwatch_log_group" "attack_simulator" {
  name              = "/aws/lambda/${aws_lambda_function.attack_simulator.function_name}"
  retention_in_days = 7
}

resource "aws_apigatewayv2_integration" "attack_simulator" {
  api_id                 = aws_apigatewayv2_api.suricata.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.attack_simulator.invoke_arn
  payload_format_version = "2.0"
  integration_method     = "POST"
}

resource "aws_apigatewayv2_route" "attack_simulate" {
  api_id             = aws_apigatewayv2_api.suricata.id
  route_key          = "POST /attack/simulate"
  target             = "integrations/${aws_apigatewayv2_integration.attack_simulator.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_lambda_permission" "apigw_attack_simulator_invoke" {
  statement_id  = "AllowAPIGatewayInvokeAttackSimulator"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.attack_simulator.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.suricata.execution_arn}/*/*"
}
