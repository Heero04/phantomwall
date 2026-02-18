# ===========================================================
#                     PhantomWall Cloud Threat
#                     Local Values Configuration
# ===========================================================
# Description: Defines local values and naming conventions
#             following DarkTracer standards
# 
# Naming Convention: {project-name}-{resource-type}-{environment}
# Example: phantomwall-cognito-users-dev
# ===========================================================

locals {
  # DarkTracer-style naming convention
  # Format: ${var.project_name}-{resource}-${var.environment}
  # This ensures consistent naming across all AWS resources
  name_prefix = "${var.project_name}-${var.environment}"

  # Legacy support for existing workspace-based naming
  # TODO: Migrate all resources to use name_prefix instead
  resource_name_prefix = "${var.project_name}-${terraform.workspace}"
}
