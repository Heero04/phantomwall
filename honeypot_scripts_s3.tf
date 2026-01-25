# S3 bucket to store honeypot installation scripts
# This avoids the 16KB user_data limit by storing large scripts in S3

resource "aws_s3_bucket" "honeypot_scripts" {
  bucket = "${var.project_name}-${var.environment}-honeypot-scripts"

  tags = {
    Name        = "${var.project_name}-${var.environment}-honeypot-scripts"
    Environment = var.environment
    Project     = var.project_name
    Purpose     = "honeypot-installation-scripts"
  }
}

resource "aws_s3_bucket_versioning" "honeypot_scripts" {
  bucket = aws_s3_bucket.honeypot_scripts.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "honeypot_scripts" {
  bucket = aws_s3_bucket.honeypot_scripts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "honeypot_scripts" {
  bucket = aws_s3_bucket.honeypot_scripts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Upload Suricata installation script
resource "aws_s3_object" "suricata_script" {
  bucket = aws_s3_bucket.honeypot_scripts.bucket
  key    = "honeypot_user_data.sh"
  source = "${path.module}/honeypot_user_data.sh"
  etag   = filemd5("${path.module}/honeypot_user_data.sh")

  tags = {
    Name        = "suricata-installation-script"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Upload CloudWatch agent installation script
resource "aws_s3_object" "cloudwatch_script" {
  bucket = aws_s3_bucket.honeypot_scripts.bucket
  key    = "honeypot_cloudwatch_agent.sh"
  source = "${path.module}/honeypot_cloudwatch_agent.sh"
  etag   = filemd5("${path.module}/honeypot_cloudwatch_agent.sh")

  tags = {
    Name        = "cloudwatch-agent-script"
    Environment = var.environment
    Project     = var.project_name
  }
}