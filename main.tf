# ===========================================================
#                     PhantomWall Cloud Threat
#                     Main Configuration File
# ===========================================================
# Description: Main Terraform configuration file that sets up
#             provider requirements, default tags, and baseline
#             security analysis for the PhantomWall platform
# 
# Last Updated: 2024-04-19
# ===========================================================

# ----------------------------------------------------------
#            Terraform Provider Configuration
# ----------------------------------------------------------
# Purpose: Defines required providers and versions
# Features:
# - AWS provider specification
# - Version constraints
# - Provider source definition
# ----------------------------------------------------------

// Required providers are declared in provider.tf

# ----------------------------------------------------------
#            AWS Provider Configuration
# ----------------------------------------------------------
# Purpose: Configures AWS provider settings and default tags
# Features:
# - Region specification
# - Default resource tagging
# - Environment tracking
# - Cost allocation
# ----------------------------------------------------------

// Provider moved to provider.tf for clearer separation of concerns.
// See provider.tf for AWS provider configuration and default tags.

# ----------------------------------------------------------
#            IAM Access Analyzer Configuration
# ----------------------------------------------------------
# Purpose: Enables security analysis for IAM resources
# Features:
# - Account-level analysis
# - External access monitoring
# - Security visibility
# - Resource tagging
# ----------------------------------------------------------

// Access Analyzer resource moved to security.tf
