# ===========================================================
#                     PhantomWall Cloud Threat
#                     Cognito Authentication Configuration
# ===========================================================
# Description: Implements AWS Cognito for user authentication,
#             JWT token generation, and API Gateway authorization
# 
# Naming Convention: phantomwall-{resource}-{environment}
# Last Updated: 2026-02-08
# ===========================================================

# ----------------------------------------------------------
#            Cognito User Pool
# ----------------------------------------------------------
# Purpose: Manages user accounts, authentication, and tokens
# Naming: phantomwall-cognito-users-dev
# ----------------------------------------------------------

resource "aws_cognito_user_pool" "phantomwall" {
  name = "${var.project_name}-cognito-users-${var.environment}"

  # ----------------------------------------------------------
  # Username & Sign-in Configuration
  # ----------------------------------------------------------
  # Note: Use either alias_attributes OR username_attributes, not both
  username_attributes = ["email"]
  
  username_configuration {
    case_sensitive = false
  }

  # ----------------------------------------------------------
  # Password Policy
  # ----------------------------------------------------------
  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }

  # ----------------------------------------------------------
  # Account Recovery
  # ----------------------------------------------------------
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # ----------------------------------------------------------
  # Email Verification
  # ----------------------------------------------------------
  auto_verified_attributes = ["email"]
  
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "PhantomWall - Verify your email"
    email_message        = "Welcome to PhantomWall! Your verification code is {####}"
  }

  # ----------------------------------------------------------
  # Email Configuration (using Cognito default for now)
  # ----------------------------------------------------------
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # ----------------------------------------------------------
  # User Attributes Schema
  # ----------------------------------------------------------
  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  schema {
    name                = "name"
    attribute_data_type = "String"
    required            = false
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  # Custom attribute for organization/company
  schema {
    name                     = "organization"
    attribute_data_type      = "String"
    required                 = false
    mutable                  = true
    developer_only_attribute = false

    string_attribute_constraints {
      min_length = 0
      max_length = 256
    }
  }

  # ----------------------------------------------------------
  # MFA Configuration (Optional - disabled by default)
  # ----------------------------------------------------------
  mfa_configuration = "OFF"  # Can be "ON" or "OPTIONAL" later

  # ----------------------------------------------------------
  # Advanced Security (Adaptive Auth)
  # ----------------------------------------------------------
  user_pool_add_ons {
    advanced_security_mode = "ENFORCED"  # Protects against compromised credentials
  }

  # ----------------------------------------------------------
  # Lambda Triggers (can add later for custom workflows)
  # ----------------------------------------------------------
  # lambda_config {
  #   pre_sign_up = aws_lambda_function.pre_signup_trigger.arn
  # }

  # ----------------------------------------------------------
  # Deletion Protection
  # ----------------------------------------------------------
  deletion_protection = "ACTIVE"

  tags = merge(var.common_tags, {
    Name = "${var.project_name}-cognito-users-${var.environment}"
  })
}

# ----------------------------------------------------------
#            Cognito User Pool Client
# ----------------------------------------------------------
# Purpose: Frontend app registration for user authentication
# Naming: phantomwall-cognito-web-client-dev
# ----------------------------------------------------------

resource "aws_cognito_user_pool_client" "phantomwall_web" {
  name         = "${var.project_name}-cognito-web-client-${var.environment}"
  user_pool_id = aws_cognito_user_pool.phantomwall.id

  # ----------------------------------------------------------
  # OAuth Flow Configuration
  # ----------------------------------------------------------
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",      # Username/password auth
    "ALLOW_REFRESH_TOKEN_AUTH",      # Refresh expired tokens
    "ALLOW_USER_SRP_AUTH"            # Secure Remote Password (SRP) protocol
  ]

  # ----------------------------------------------------------
  # Token Validity
  # ----------------------------------------------------------
  refresh_token_validity = 30  # 30 days
  access_token_validity  = 60  # 60 minutes
  id_token_validity      = 60  # 60 minutes

  token_validity_units {
    refresh_token = "days"
    access_token  = "minutes"
    id_token      = "minutes"
  }

  # ----------------------------------------------------------
  # Security Settings
  # ----------------------------------------------------------
  prevent_user_existence_errors = "ENABLED"  # Don't leak user existence
  enable_token_revocation       = true

  # ----------------------------------------------------------
  # Read/Write Permissions
  # ----------------------------------------------------------
  read_attributes = [
    "email",
    "email_verified",
    "name",
    "custom:organization"
  ]

  write_attributes = [
    "email",
    "name",
    "custom:organization"
  ]
}

# ----------------------------------------------------------
#            Cognito Identity Pool (Optional)
# ----------------------------------------------------------
# Purpose: AWS credentials for authenticated users
# Note: Only needed if users need direct AWS service access
# ----------------------------------------------------------

resource "aws_cognito_identity_pool" "phantomwall" {
  identity_pool_name               = "${var.project_name}_identity_pool_${var.environment}"
  allow_unauthenticated_identities = false
  allow_classic_flow               = false

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.phantomwall_web.id
    provider_name           = aws_cognito_user_pool.phantomwall.endpoint
    server_side_token_check = false
  }

  tags = merge(var.common_tags, {
    Name = "${var.project_name}-cognito-identity-pool-${var.environment}"
  })
}

# ----------------------------------------------------------
#            IAM Role for Authenticated Users
# ----------------------------------------------------------

resource "aws_iam_role" "authenticated" {
  name = "${var.project_name}-cognito-authenticated-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.phantomwall.id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "authenticated"
          }
        }
      }
    ]
  })

  tags = merge(var.common_tags, {
    Name = "${var.project_name}-cognito-authenticated-role-${var.environment}"
  })
}

resource "aws_iam_role_policy" "authenticated" {
  name = "authenticated-policy"
  role = aws_iam_role.authenticated.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "mobileanalytics:PutEvents",
          "cognito-sync:*",
          "cognito-identity:*"
        ]
        Resource = ["*"]
      }
    ]
  })
}

resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = aws_cognito_identity_pool.phantomwall.id

  roles = {
    "authenticated" = aws_iam_role.authenticated.arn
  }
}

# ----------------------------------------------------------
#            API Gateway Authorizer
# ----------------------------------------------------------
# Purpose: Validates JWT tokens from Cognito for API access
# NOTE: Commented out until REST API Gateway is configured
# ----------------------------------------------------------

# resource "aws_api_gateway_authorizer" "cognito" {
#   name            = "${var.project_name}-cognito-authorizer-${var.environment}"
#   rest_api_id     = aws_api_gateway_rest_api.main.id
#   type            = "COGNITO_USER_POOLS"
#   provider_arns   = [aws_cognito_user_pool.phantomwall.arn]
#   identity_source = "method.request.header.Authorization"
# }

# ----------------------------------------------------------
#            Outputs
# ----------------------------------------------------------

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.phantomwall.id
}

output "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = aws_cognito_user_pool.phantomwall.arn
}

output "cognito_user_pool_endpoint" {
  description = "Cognito User Pool Endpoint"
  value       = aws_cognito_user_pool.phantomwall.endpoint
}

output "cognito_client_id" {
  description = "Cognito User Pool Client ID (use in frontend)"
  value       = aws_cognito_user_pool_client.phantomwall_web.id
  sensitive   = true
}

output "cognito_identity_pool_id" {
  description = "Cognito Identity Pool ID"
  value       = aws_cognito_identity_pool.phantomwall.id
}

output "cognito_region" {
  description = "AWS Region for Cognito"
  value       = var.aws_region
}
