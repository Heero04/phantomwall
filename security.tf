// Access Analyzer resource
// Purpose: enable account-level analysis and visibility into IAM resource
// permissions and configurations. This resource is scoped to the account
// rather than a single honeypot instance, but it's useful to keep in the
// repo so the security posture is visible when the whole stack is applied.
resource "aws_accessanalyzer_analyzer" "default" {
  analyzer_name = "phantomwall-accessanalyzer-${terraform.workspace}"
  type          = "ACCOUNT"

  tags = {
    Purpose = "Baseline IAM visibility"
    Name    = "phantomwall-accessanalyzer-${terraform.workspace}"
  }
}
