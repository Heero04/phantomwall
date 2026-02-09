/*
================================================================================
AWS Security Configuration
================================================================================
Purpose: Defines security analysis resources for IAM visibility and auditing.

Naming Convention: {project-name}-security-{resource}-{environment}
Example: phantomwall-security-analyzer-dev

Resources:
- Access Analyzer for IAM permissions visibility
================================================================================
*/

// Access Analyzer resource
// Purpose: enable account-level analysis and visibility into IAM resource
// permissions and configurations. This resource is scoped to the account
// rather than a single honeypot instance, but it's useful to keep in the
// repo so the security posture is visible when the whole stack is applied.
resource "aws_accessanalyzer_analyzer" "default" {
  analyzer_name = "${var.project_name}-security-analyzer-${var.environment}"
  type          = "ACCOUNT"

  tags = {
    Purpose = "Baseline IAM visibility"
    Name    = "${var.project_name}-security-analyzer-${var.environment}"
  }
}
