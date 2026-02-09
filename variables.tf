# ===========================================================
#                     PhantomWall Cloud Threat
#                     Variables Configuration
# ===========================================================
# Description: Defines all variables used across the PhantomWall
#             infrastructure, including AWS region, resource
#             naming, tags, and configuration parameters
# 
# Last Updated: 2024-04-19
# ===========================================================

# ----------------------------------------------------------
#            AWS Region Configuration
# ----------------------------------------------------------
# Purpose: Specifies the AWS region for resource deployment
# Default: US East (N. Virginia)
# Usage: Can be overridden via terraform.tfvars or CLI
# ----------------------------------------------------------

variable "aws_region" {
  description = "AWS region to deploy to"
  type        = string
  default     = "us-east-1"
}

# ----------------------------------------------------------
#            EC2 Key Pair Configuration
# ----------------------------------------------------------
# Purpose: Defines SSH key pair for EC2 instance access
# Type: Required input (no default)
# Usage: Must be provided during terraform apply
# ----------------------------------------------------------

variable "key_pair_name" {
  description = "Name of the EC2 key pair"
  type        = string
  default     = ""
}

# ----------------------------------------------------------
#            Common Resource Tags
# ----------------------------------------------------------
# Purpose: Defines standard tags applied to all resources
# Features:
# - Project identification
# - Environment tracking
# - Management tool identification
# ----------------------------------------------------------

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default = {
    Project     = "phantomwall"  # Project identifier
    Environment = "dev"          # Default environment (override with var.environment)
    ManagedBy   = "terraform"    # Infrastructure management tool
  }
}

# ----------------------------------------------------------
#            Project Name Configuration
# ----------------------------------------------------------
# Purpose: Defines prefix for resource naming
# Usage: Applied to resource names for identification
# Default: "phantomwall"
# ----------------------------------------------------------

variable "project_name" {
  description = "Prefix for naming resources"
  type        = string
  default     = "phantomwall"
}

# ----------------------------------------------------------
#            Environment Configuration
# ----------------------------------------------------------
# Purpose: Defines deployment environment (dev/prod)
# Usage: Applied to resource names for environment separation
# Default: "dev"
# ----------------------------------------------------------

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  default     = "dev"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

# Middle/random name used in the two-part name convention. Can be overridden per deploy.
variable "random_name" {
  description = "Middle/random name element for resource naming (e.g. 'honeypot', 'api', etc.)"
  type        = string
  default     = "randomname"
}

# Optional: lookup a subnet by tag if you don't want to pass a raw subnet id
variable "subnet_tag_key" {
  description = "Tag key to search subnets by (e.g. 'Name' or custom tag)"
  type        = string
  default     = "Name"
}

variable "subnet_tag_value" {
  description = "Tag value to search subnets by. If empty, you must provide public_subnet_id."
  type        = string
  default     = ""
}

# Optional explicit subnet id if you do not want to use tag lookup
variable "public_subnet_id" {
  description = "Explicit public subnet id to place EC2 instances into when not using tag lookup"
  type        = string
  default     = ""
}

# Optional: auto-create an EC2 key pair when you don't want to provide an existing one.
variable "create_key_pair" {
  description = "If true, generate a new SSH keypair and upload the public key to AWS as a key pair."
  type        = bool
  default     = false
}

variable "key_private_key_path" {
  description = "If set and create_key_pair=true, write the generated private key to this local path."
  type        = string
  default     = ""
}

# Kali-specific key options
variable "kali_key_name" {
  description = "Existing key pair name to use for Kali EC2. If empty and create_kali_key=true a key will be generated."
  type        = string
  default     = ""
}

variable "create_kali_key" {
  description = "If true, generate a new SSH keypair for the Kali instance and upload the public key to AWS."
  type        = bool
  default     = false
}

variable "kali_key_private_key_path" {
  description = "Local path to write Kali private key when create_kali_key=true"
  type        = string
  default     = ""
}

# When true, after Terraform creates local PEM files this will move them to
# ~/.ssh and set permissions so SSH accepts them. Runs locally via a
# null_resource local-exec and only when keys are generated.
variable "move_keys_to_ssh" {
  description = "If true, move generated private keys to ~/.ssh and set permissions"
  type        = bool
  default     = true
}

# Bedrock configuration
variable "bedrock_model_id" {
  description = "Bedrock model ID used for the chat assistant"
  type        = string
  default     = "anthropic.claude-3-haiku-20240307-v1:0"
}

variable "chat_max_items" {
  description = "Maximum number of Suricata events to include in a chat response"
  type        = number
  default     = 25
}

# ----------------------------------------------------------
#            Budget Alert Configuration
# ----------------------------------------------------------
# Purpose: Email address for AWS budget and cost anomaly alerts
# Type: Required input
# Usage: Receives notifications at $30, $50, and $75 thresholds
# ----------------------------------------------------------

variable "budget_alert_email" {
  description = "Email address to receive AWS budget alerts"
  type        = string
  default     = ""
}
