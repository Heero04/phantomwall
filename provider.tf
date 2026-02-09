/*
================================================================================
AWS Provider Configuration
================================================================================
Purpose: Defines AWS provider settings and default resource tags.

Default Tags: Applied to all resources for cost tracking and organization.
================================================================================
*/

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name          # Project identifier
      Environment = var.environment           # Deployment environment
      Owner       = "team-engineering"        # Team ownership
      CostCenter  = "cloud-security"          # Cost tracking
      Service     = "threat-monitoring"       # Service classification
    }
  }
}

terraform {
  required_providers {
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.94.1"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}
