/*
================================================================================
Frontend Hosting: S3 + CloudFront (Dev + Demo)
================================================================================
Purpose: Creates two independent static-site deployments for PhantomWall frontend.
         Each environment gets its own S3 bucket + CloudFront distribution.

After terraform apply:
  - Copy the CloudFront domain outputs into your browser to access each site
  - GitHub Actions uploads built frontend to the correct bucket per branch
================================================================================
*/

# ── S3 Buckets ─────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "frontend_dev" {
  bucket = "${var.project_name}-frontend-dev-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name        = "${var.project_name}-frontend-dev"
    Environment = "dev"
  }
}

resource "aws_s3_bucket" "frontend_demo" {
  bucket = "${var.project_name}-frontend-demo-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name        = "${var.project_name}-frontend-demo"
    Environment = "demo"
  }
}

resource "aws_s3_bucket_public_access_block" "frontend_dev" {
  bucket                  = aws_s3_bucket.frontend_dev.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "frontend_demo" {
  bucket                  = aws_s3_bucket.frontend_demo.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── CloudFront Origin Access Control ───────────────────────────────────────────

resource "aws_cloudfront_origin_access_control" "frontend_dev" {
  name                              = "${var.project_name}-frontend-dev-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_origin_access_control" "frontend_demo" {
  name                              = "${var.project_name}-frontend-demo-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ── CloudFront Distributions ───────────────────────────────────────────────────

resource "aws_cloudfront_distribution" "frontend_dev" {
  enabled             = true
  default_root_object = "index.html"
  comment             = "PhantomWall Dev Frontend"

  origin {
    domain_name              = aws_s3_bucket.frontend_dev.bucket_regional_domain_name
    origin_id                = "s3-frontend-dev"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend_dev.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-frontend-dev"
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name        = "${var.project_name}-frontend-dev-cf"
    Environment = "dev"
  }
}

resource "aws_cloudfront_distribution" "frontend_demo" {
  enabled             = true
  default_root_object = "index.html"
  comment             = "PhantomWall Demo Frontend"

  origin {
    domain_name              = aws_s3_bucket.frontend_demo.bucket_regional_domain_name
    origin_id                = "s3-frontend-demo"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend_demo.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-frontend-demo"
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name        = "${var.project_name}-frontend-demo-cf"
    Environment = "demo"
  }
}

# ── S3 Bucket Policies (allow CloudFront access) ──────────────────────────────

resource "aws_s3_bucket_policy" "frontend_dev" {
  bucket = aws_s3_bucket.frontend_dev.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend_dev.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend_dev.arn
          }
        }
      }
    ]
  })
}

resource "aws_s3_bucket_policy" "frontend_demo" {
  bucket = aws_s3_bucket.frontend_demo.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend_demo.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend_demo.arn
          }
        }
      }
    ]
  })
}

# ── Outputs ────────────────────────────────────────────────────────────────────

output "frontend_dev_url" {
  description = "Dev frontend URL (CloudFront)"
  value       = "https://${aws_cloudfront_distribution.frontend_dev.domain_name}"
}

output "frontend_demo_url" {
  description = "Demo frontend URL (CloudFront)"
  value       = "https://${aws_cloudfront_distribution.frontend_demo.domain_name}"
}

output "frontend_dev_bucket" {
  description = "S3 bucket name for dev frontend deployment"
  value       = aws_s3_bucket.frontend_dev.bucket
}

output "frontend_demo_bucket" {
  description = "S3 bucket name for demo frontend deployment"
  value       = aws_s3_bucket.frontend_demo.bucket
}

output "frontend_dev_cf_distribution_id" {
  description = "CloudFront distribution ID for dev (used in cache invalidation)"
  value       = aws_cloudfront_distribution.frontend_dev.id
}

output "frontend_demo_cf_distribution_id" {
  description = "CloudFront distribution ID for demo (used in cache invalidation)"
  value       = aws_cloudfront_distribution.frontend_demo.id
}
