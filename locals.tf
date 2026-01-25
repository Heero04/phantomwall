# Shared naming helpers
// Purpose: central place for naming helpers used across resources. Keep
// naming logic here so updates apply consistently.
locals {
  # function-style helper: build resource name as ${project_name}-${component}-${workspace}
  # include workspace so names are unique per workspace
  resource_name_prefix = "${var.project_name}-${terraform.workspace}"
}
