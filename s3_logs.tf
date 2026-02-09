# S3 bucket for raw Suricata logs - cost-optimized storage
# Purpose: Store ALL logs long-term at 90% lower cost than DynamoDB

resource "aws_s3_bucket" "suricata_logs" {
  bucket = "${var.project_name}-${terraform.workspace}-suricata-logs"

  tags = {
    Project = var.project_name
    Env     = terraform.workspace
    Service = "suricata-logs"
  }
}

# Enable versioning for data protection
resource "aws_s3_bucket_versioning" "suricata_logs" {
  bucket = aws_s3_bucket.suricata_logs.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "suricata_logs" {
  bucket = aws_s3_bucket.suricata_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Lifecycle policy - move old logs to cheaper storage tiers
resource "aws_s3_bucket_lifecycle_configuration" "suricata_logs" {
  bucket = aws_s3_bucket.suricata_logs.id

  # Archive logs older than 30 days to Glacier
  rule {
    id     = "archive-old-logs"
    status = "Enabled"

    filter {}  # Apply to all objects

    transition {
      days          = 30
      storage_class = "GLACIER_IR"  # Instant Retrieval Glacier - $0.004/GB
    }

    # Delete logs older than 1 year (adjust as needed)
    expiration {
      days = 365
    }
  }

  # Delete incomplete multipart uploads after 7 days
  rule {
    id     = "cleanup-incomplete-uploads"
    status = "Enabled"

    filter {}  # Apply to all objects

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# Block public access (security best practice)
resource "aws_s3_bucket_public_access_block" "suricata_logs" {
  bucket = aws_s3_bucket.suricata_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Output for Lambda to use
output "s3_logs_bucket_name" {
  value       = aws_s3_bucket.suricata_logs.id
  description = "S3 bucket name for Suricata raw logs"
}

output "s3_logs_bucket_arn" {
  value       = aws_s3_bucket.suricata_logs.arn
  description = "S3 bucket ARN for IAM policies"
}
