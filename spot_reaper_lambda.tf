resource "aws_iam_role" "spot_reaper" {
  name = "${var.project_name}-lambda-spot-reaper-role-${var.environment}"

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

resource "aws_iam_role_policy" "spot_reaper" {
  name = "${var.project_name}-lambda-spot-reaper-policy-${var.environment}"
  role = aws_iam_role.spot_reaper.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
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
        Effect = "Allow",
        Action = [
          "ec2:DescribeInstances"
        ],
        Resource = "*"
      },
      {
        Effect = "Allow",
        Action = [
          "ec2:TerminateInstances"
        ],
        Resource = "*",
        Condition = {
          StringEquals = {
            "ec2:ResourceTag/Project"   = var.project_name,
            "ec2:ResourceTag/Env"       = var.environment,
            "ec2:ResourceTag/ManagedBy" = "phantomwall-provisioner"
          }
        }
      },
      {
        Effect = "Allow",
        Action = [
          "logs:DescribeSubscriptionFilters",
          "logs:DeleteSubscriptionFilter",
          "logs:DeleteLogGroup"
        ],
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/honeypot/suricata/${var.project_name}-${var.environment}/*"
      }
    ]
  })
}

data "archive_file" "spot_reaper" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/spot_reaper"
  output_path = "${path.module}/lambda/spot_reaper.zip"
}

resource "aws_lambda_function" "spot_reaper" {
  function_name    = "${var.project_name}-lambda-spot-reaper-${var.environment}"
  role             = aws_iam_role.spot_reaper.arn
  handler          = "handler.handler"
  runtime          = "python3.11"
  filename         = data.archive_file.spot_reaper.output_path
  source_code_hash = data.archive_file.spot_reaper.output_base64sha256
  timeout          = 60
  memory_size      = 128

  environment {
    variables = {
      PROJECT_TAG         = var.project_name
      ENVIRONMENT         = var.environment
      SPOT_TTL_HOURS      = "24"
      CW_LOG_GROUP_PREFIX = "/honeypot/suricata/${var.project_name}-${var.environment}"
    }
  }

  tags = {
    Project = var.project_name
    Env     = var.environment
  }
}

resource "aws_cloudwatch_log_group" "spot_reaper" {
  name              = "/aws/lambda/${aws_lambda_function.spot_reaper.function_name}"
  retention_in_days = 7

  tags = {
    Project = var.project_name
    Env     = var.environment
  }
}

resource "aws_cloudwatch_event_rule" "spot_reaper_hourly" {
  name                = "${var.project_name}-spot-reaper-hourly-${var.environment}"
  description         = "Auto-terminate demo spot honeypots older than 24 hours"
  schedule_expression = "rate(1 hour)"
}

resource "aws_cloudwatch_event_target" "spot_reaper_lambda" {
  rule      = aws_cloudwatch_event_rule.spot_reaper_hourly.name
  target_id = "spot-reaper"
  arn       = aws_lambda_function.spot_reaper.arn
}

resource "aws_lambda_permission" "allow_eventbridge_spot_reaper" {
  statement_id  = "AllowEventBridgeInvokeSpotReaper"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.spot_reaper.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.spot_reaper_hourly.arn
}
