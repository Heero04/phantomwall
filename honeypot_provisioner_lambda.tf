# ===========================================================
#                     PhantomWall Cloud Threat
#                     Honeypot Provisioner Lambda
# ===========================================================
# Description: Lambda that provisions/destroys honeypot EC2
#              instances on demand via the Fleet Manager UI.
#
# Routes:
#   POST /fleet/deploy   → launch new honeypot instance
#   POST /fleet/destroy  → terminate a honeypot instance
#
# Safety:
#   - Max instance cap (default: 5)
#   - Allowed instance types whitelist
#   - Project-tag scoped termination
#   - IAM scoped to project-tagged resources
#
# Naming Convention: phantomwall-{resource}-{environment}
# ===========================================================

# ----------------------------------------------------------
#            IAM Role & Policy
# ----------------------------------------------------------
resource "aws_iam_role" "lambda_provisioner" {
  name = "${var.project_name}-lambda-provisioner-role-${var.environment}"

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

resource "aws_iam_role_policy" "lambda_provisioner" {
  name = "${var.project_name}-lambda-provisioner-policy-${var.environment}"
  role = aws_iam_role.lambda_provisioner.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      # CloudWatch Logs — basic Lambda logging
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        Resource = "*"
      },
      # CloudWatch Logs — per-instance honeypot log group lifecycle
      # Provisioner creates/deletes a log group per honeypot instance
      # and attaches subscription filters for the ingest pipeline
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogGroup",
          "logs:DeleteLogGroup",
          "logs:PutRetentionPolicy",
          "logs:PutSubscriptionFilter",
          "logs:DeleteSubscriptionFilter",
          "logs:DescribeSubscriptionFilters",
          "logs:TagLogGroup"
        ],
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/honeypot/suricata/${var.project_name}-${var.environment}/*"
      },
      # EC2 — describe (needed for AMI lookup & instance counting)
      {
        Effect = "Allow",
        Action = [
          "ec2:DescribeInstances",
          "ec2:DescribeImages",
          "ec2:DescribeTags"
        ],
        Resource = "*"
      },
      # EC2 — launch instances (scoped to project-tagged resources)
      {
        Effect = "Allow",
        Action = [
          "ec2:RunInstances"
        ],
        Resource = [
          "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:instance/*",
          "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:volume/*",
          "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:network-interface/*",
          "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:security-group/${aws_security_group.honeypot_sg.id}",
          "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:security-group/${aws_security_group.honeypot_sg_ssh.id}",
          "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:security-group/${aws_security_group.honeypot_sg_http.id}",
          "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:security-group/${aws_security_group.honeypot_sg_telnet.id}",
          "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:security-group/${aws_security_group.honeypot_sg_multi.id}",
          "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:subnet/*",
          "arn:aws:ec2:${var.aws_region}::image/*"
        ]
      },
      # EC2 — tag on create
      {
        Effect = "Allow",
        Action = [
          "ec2:CreateTags"
        ],
        Resource = "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:instance/*",
        Condition = {
          StringEquals = {
            "ec2:CreateAction" = "RunInstances"
          }
        }
      },
      # EC2 — terminate (scoped to project-tagged instances only)
      {
        Effect = "Allow",
        Action = [
          "ec2:TerminateInstances"
        ],
        Resource = "*",
        Condition = {
          StringEquals = {
            "ec2:ResourceTag/Project" = var.project_name
          }
        }
      },
      # IAM — PassRole so EC2 can assume the honeypot instance profile
      {
        Effect   = "Allow",
        Action   = "iam:PassRole",
        Resource = aws_iam_role.cw_role.arn
      },
      # S3 — read bootstrap scripts (if needed in future)
      {
        Effect = "Allow",
        Action = [
          "s3:GetObject"
        ],
        Resource = "${aws_s3_bucket.honeypot_scripts.arn}/*"
      }
    ]
  })
}

# ----------------------------------------------------------
#            Lambda Function
# ----------------------------------------------------------
data "archive_file" "honeypot_provisioner" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/honeypot_provisioner"
  output_path = "${path.module}/lambda/honeypot_provisioner.zip"
}

resource "aws_lambda_function" "honeypot_provisioner" {
  function_name    = "${var.project_name}-lambda-honeypot-provisioner-${var.environment}"
  role             = aws_iam_role.lambda_provisioner.arn
  handler          = "handler.handler"
  runtime          = "python3.11"
  filename         = data.archive_file.honeypot_provisioner.output_path
  source_code_hash = data.archive_file.honeypot_provisioner.output_base64sha256
  timeout          = 30
  memory_size      = 128

  environment {
    variables = {
      PROJECT_TAG       = var.project_name
      ENVIRONMENT       = var.environment
      SECURITY_GROUP_ID = aws_security_group.honeypot_sg.id
      SG_SSH            = aws_security_group.honeypot_sg_ssh.id
      SG_HTTP           = aws_security_group.honeypot_sg_http.id
      SG_TELNET         = aws_security_group.honeypot_sg_telnet.id
      SG_MULTI          = aws_security_group.honeypot_sg_multi.id
      INSTANCE_PROFILE  = aws_iam_instance_profile.cw_profile.name
      SUBNET_ID         = var.subnet_tag_value != "" && length(data.aws_subnets.by_tag.ids) > 0 ? data.aws_subnets.by_tag.ids[0] : var.public_subnet_id
      SCRIPTS_BUCKET    = aws_s3_bucket.honeypot_scripts.id
      MAX_INSTANCES     = "1"
      SPOT_AUTO_DESTROY_HOURS = "24"
      # Per-instance log group pipeline
      CW_LOG_GROUP_PREFIX    = "/honeypot/suricata/${var.project_name}-${var.environment}"
      CW_LOG_RETENTION_DAYS  = "7"
      INGEST_LAMBDA_ARN      = aws_lambda_function.suricata_ingest.arn
      ALERT_INDEXER_LAMBDA_ARN = local.alerts_enabled ? aws_lambda_function.alert_indexer[0].arn : ""
    }
  }

  tags = {
    Project = var.project_name
    Env     = var.environment
  }
}

resource "aws_cloudwatch_log_group" "honeypot_provisioner" {
  name              = "/aws/lambda/${aws_lambda_function.honeypot_provisioner.function_name}"
  retention_in_days = 7

  tags = {
    Project = var.project_name
    Env     = var.environment
  }
}

# ----------------------------------------------------------
#            API Gateway Integration + Routes
# ----------------------------------------------------------
resource "aws_apigatewayv2_integration" "honeypot_provisioner" {
  api_id                 = aws_apigatewayv2_api.suricata.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.honeypot_provisioner.invoke_arn
  payload_format_version = "2.0"
  integration_method     = "POST"
}

# POST /fleet/deploy → launch honeypot
resource "aws_apigatewayv2_route" "fleet_deploy" {
  api_id             = aws_apigatewayv2_api.suricata.id
  route_key          = "POST /fleet/deploy"
  target             = "integrations/${aws_apigatewayv2_integration.honeypot_provisioner.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# POST /fleet/destroy → terminate honeypot
resource "aws_apigatewayv2_route" "fleet_destroy" {
  api_id             = aws_apigatewayv2_api.suricata.id
  route_key          = "POST /fleet/destroy"
  target             = "integrations/${aws_apigatewayv2_integration.honeypot_provisioner.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# ----------------------------------------------------------
#            Lambda Permission for API Gateway
# ----------------------------------------------------------
resource "aws_lambda_permission" "apigw_provisioner_invoke" {
  statement_id  = "AllowAPIGatewayInvokeProvisioner"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.honeypot_provisioner.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.suricata.execution_arn}/*/*"
}

# ----------------------------------------------------------
#            Outputs
# ----------------------------------------------------------
output "honeypot_provisioner_lambda" {
  value       = aws_lambda_function.honeypot_provisioner.function_name
  description = "Lambda function for honeypot provisioning"
}

output "fleet_deploy_endpoint" {
  value       = "${aws_apigatewayv2_api.suricata.api_endpoint}/prod/fleet/deploy"
  description = "POST endpoint to deploy a new honeypot"
}

output "fleet_destroy_endpoint" {
  value       = "${aws_apigatewayv2_api.suricata.api_endpoint}/prod/fleet/destroy"
  description = "POST endpoint to destroy a honeypot"
}
