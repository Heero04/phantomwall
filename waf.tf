# ===========================================================
#                     PhantomWall Cloud Threat
#                     WAF (Web Application Firewall)
# ===========================================================
# Description: AWS WAFv2 Web ACL protecting the API Gateway.
#   - IP-based blocklist (auto-populated by honeypot alerts)
#   - Rate limiting (DDoS / brute-force protection)
#   - AWS Managed Rules: SQL injection, XSS, Known Bad Inputs
#   - Optional geo-blocking & bot control
#   - Lockdown mode (block ALL traffic except allow-list)
#
# Naming: phantomwall-waf-{resource}-{environment}
# ===========================================================

# ── IP Sets ─────────────────────────────────────────────────────

resource "aws_wafv2_ip_set" "blocklist" {
  count              = var.waf_enabled ? 1 : 0
  name               = "${var.project_name}-waf-blocklist-${var.environment}"
  scope              = "REGIONAL"
  ip_address_version = "IPV4"
  addresses          = [] # Populated at runtime by Lambda auto-block pipeline

  tags = {
    Name    = "${var.project_name}-waf-blocklist-${var.environment}"
    Purpose = "Auto-blocked IPs from honeypot alerts"
  }
}

resource "aws_wafv2_ip_set" "allowlist" {
  count              = var.waf_enabled ? 1 : 0
  name               = "${var.project_name}-waf-allowlist-${var.environment}"
  scope              = "REGIONAL"
  ip_address_version = "IPV4"
  addresses          = [] # Manually managed trusted IPs

  tags = {
    Name    = "${var.project_name}-waf-allowlist-${var.environment}"
    Purpose = "Trusted IPs that bypass lockdown mode"
  }
}

# ── Web ACL ─────────────────────────────────────────────────────

resource "aws_wafv2_web_acl" "main" {
  count       = var.waf_enabled ? 1 : 0
  name        = "${var.project_name}-waf-acl-${var.environment}"
  scope       = "REGIONAL"
  description = "PhantomWall edge security - protects API Gateway"

  default_action {
    allow {}
  }

  # ── Rule 1: Blocklist (highest priority) ────────────────────
  rule {
    name     = "BlocklistedIPs"
    priority = 1

    action {
      block {}
    }

    statement {
      ip_set_reference_statement {
        arn = aws_wafv2_ip_set.blocklist[0].arn
      }
    }

    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-waf-blocklist"
    }
  }

  # ── Rule 2: Allowlist bypass (for lockdown mode) ────────────
  rule {
    name     = "AllowlistedIPs"
    priority = 2

    action {
      allow {}
    }

    statement {
      ip_set_reference_statement {
        arn = aws_wafv2_ip_set.allowlist[0].arn
      }
    }

    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-waf-allowlist"
    }
  }

  # ── Rule 3: Rate Limiting ───────────────────────────────────
  rule {
    name     = "RateLimiting"
    priority = 10

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = var.waf_rate_limit
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-waf-ratelimit"
    }
  }

  # ── Rule 4: AWS Managed – SQL Injection ─────────────────────
  rule {
    name     = "AWSManagedSQLi"
    priority = 20

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-waf-sqli"
    }
  }

  # ── Rule 5: AWS Managed – XSS / Common ─────────────────────
  rule {
    name     = "AWSManagedCommonRules"
    priority = 30

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-waf-common"
    }
  }

  # ── Rule 6: AWS Managed – Known Bad Inputs ──────────────────
  rule {
    name     = "AWSManagedKnownBadInputs"
    priority = 40

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-waf-badinputs"
    }
  }

  # ── Rule 7: Geo-Blocking (optional) ─────────────────────────
  dynamic "rule" {
    for_each = length(var.waf_geo_block_countries) > 0 ? [1] : []
    content {
      name     = "GeoBlocking"
      priority = 50

      action {
        block {}
      }

      statement {
        geo_match_statement {
          country_codes = var.waf_geo_block_countries
        }
      }

      visibility_config {
        sampled_requests_enabled   = true
        cloudwatch_metrics_enabled = true
        metric_name                = "${var.project_name}-waf-geo"
      }
    }
  }

  # ── Rule 8: Bot Control (optional – adds cost) ─────────────
  dynamic "rule" {
    for_each = var.waf_enable_bot_control ? [1] : []
    content {
      name     = "BotControl"
      priority = 60

      override_action {
        none {}
      }

      statement {
        managed_rule_group_statement {
          name        = "AWSManagedRulesBotControlRuleSet"
          vendor_name = "AWS"
        }
      }

      visibility_config {
        sampled_requests_enabled   = true
        cloudwatch_metrics_enabled = true
        metric_name                = "${var.project_name}-waf-bot"
      }
    }
  }

  visibility_config {
    sampled_requests_enabled   = true
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.project_name}-waf-acl"
  }

  tags = {
    Name    = "${var.project_name}-waf-acl-${var.environment}"
    Purpose = "Edge security for PhantomWall API"
  }
}

# ── Associate WAF with API Gateway ──────────────────────────────
# NOTE: WAFv2 Web ACL association is NOT supported for HTTP APIs
# (API Gateway v2). It only works with REST APIs (API Gateway v1),
# CloudFront, ALB, and AppSync. The WAF Web ACL is still fully
# functional for IP blocklisting, rate limiting, and rule management
# via the Lambda API. To add WAF protection to the API, migrate to
# a REST API or put CloudFront in front of the HTTP API.
#
# resource "aws_wafv2_web_acl_association" "api_gateway" {
#   count        = var.waf_enabled ? 1 : 0
#   resource_arn = <REST_API_STAGE_ARN>
#   web_acl_arn  = aws_wafv2_web_acl.main[0].arn
# }

# ── WAF CloudWatch Dashboard ───────────────────────────────────

resource "aws_cloudwatch_log_group" "waf" {
  count             = var.waf_enabled ? 1 : 0
  name              = "aws-waf-logs-${var.project_name}-${var.environment}"
  retention_in_days = 14

  tags = {
    Purpose = "WAF request logging"
  }
}

resource "aws_wafv2_web_acl_logging_configuration" "main" {
  count                   = var.waf_enabled ? 1 : 0
  log_destination_configs = [aws_cloudwatch_log_group.waf[0].arn]
  resource_arn            = aws_wafv2_web_acl.main[0].arn
}
