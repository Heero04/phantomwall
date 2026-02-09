/*
Minimal Amplify app + branch managed by Terraform.

Usage notes:
- Set `amplify_repo` to your public repository HTTPS URL (or leave empty to only create a placeholder app not connected to a repo).
- If an Amplify app already exists, import it into state then update the `iam_service_role_arn` to point to the role created in `amplify_iam.tf`.
- This resource sets the Amplify app to use the IAM role so any resources Amplify creates during builds will be created under that role.

Security: The example uses the role we created (`aws_iam_role.amplify_console`). Keep repo auth (oauth_token) out of Terraform files; use the Console to connect private repos or pass a secure CI secret.
*/

variable "amplify_repo" {
  description = "HTTPS Git repo URL for the frontend (leave empty to skip creating the app)"
  type        = string
  default     = ""
}

variable "amplify_branch" {
  description = "Branch to create in Amplify (defaults to main)"
  type        = string
  default     = "main"
}

resource "aws_amplify_app" "frontend" {
  count                = var.amplify_repo != "" ? 1 : 0
  name                 = "${var.project_name}-amplify-frontend-${var.environment}"
  repository           = var.amplify_repo
  platform             = "WEB"
  iam_service_role_arn = aws_iam_role.amplify_console.arn

  # enable automatic builds on branch updates by default
  enable_branch_auto_build = true
}

resource "aws_amplify_branch" "main" {
  count       = var.amplify_repo != "" ? 1 : 0
  app_id      = aws_amplify_app.frontend[0].id
  branch_name = var.amplify_branch
}

output "amplify_app_id" {
  # Guarded output: return the app id only if the resource was created
  value       = var.amplify_repo != "" && length(aws_amplify_app.frontend) > 0 ? aws_amplify_app.frontend[0].id : ""
  description = "Amplify App ID (empty if var.amplify_repo is not set)"
}
