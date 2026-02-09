/*
================================================================================
AWS Amplify IAM Service Role Configuration
================================================================================
Purpose: Defines IAM role for AWS Amplify Console to deploy frontend resources.

Naming Convention: {project-name}-amplify-role-{environment}
Example: phantomwall-amplify-role-dev

Security: Role allows Amplify to assume identity and perform build/deployment
operations with attached policies.
================================================================================
*/

// IAM role for AWS Amplify Console to assume when deploying the frontend
resource "aws_iam_role" "amplify_console" {
  name = "${var.project_name}-amplify-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "amplify.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

# Attach a broad policy for quick setup. Replace with least-privilege policy later if desired.
resource "aws_iam_role_policy_attachment" "amplify_console_admin" {
  role       = aws_iam_role.amplify_console.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

output "amplify_console_role_arn" {
  description = "ARN of the IAM role to use as the Amplify Console service role"
  value       = aws_iam_role.amplify_console.arn
}
