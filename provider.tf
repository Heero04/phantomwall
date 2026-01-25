// AWS provider configuration
// Purpose: central provider definition and default tags applied to all
// resources in this module. Keep global tags here for cost allocation
// and resource discovery.
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "phantomwall-cloud-threat" # Project identifier
      Environment = terraform.workspace        # Dynamic environment tracking
      Owner       = "team-engineering"         # Team ownership
      CostCenter  = "cloud-security"           # Cost tracking
      Service     = "threat-monitoring"        # Service classification
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
