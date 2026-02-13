/*
================================================================================
CloudWatch Monitoring — S3 Log Pipeline
================================================================================
Purpose: End-to-end observability for the Suricata S3 logging pipeline.

Monitors:
  1. Ingest Lambda  → writes ALL events to S3 (errors, invocations, duration)
  2. S3 Bucket      → object count, bucket size
  3. Athena Queries  → success/failure, data scanned
  4. Log Query Lambda→ user-facing API Lambda (errors, invocations, duration)

Naming Convention: phantomwall-{resource}-{environment}
Last Updated: 2026-02-12
================================================================================
*/

# ----------------------------------------------------------
#  1. Ingest Lambda Monitoring (CloudWatch → Lambda → S3)
# ----------------------------------------------------------

# Alarm: Ingest Lambda is failing (events not reaching S3)
resource "aws_cloudwatch_metric_alarm" "ingest_lambda_errors" {
  alarm_name          = "${var.project_name}-ingest-lambda-errors-${var.environment}"
  alarm_description   = "Suricata ingest Lambda is throwing errors — events may NOT be reaching S3 or DynamoDB"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300 # 5 minutes
  statistic           = "Sum"
  threshold           = 3
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.suricata_ingest.function_name
  }

  tags = {
    Project = var.project_name
    Env     = var.environment
    Service = "monitoring"
  }
}

# Alarm: Ingest Lambda not invoked in 15 min (no logs flowing)
resource "aws_cloudwatch_metric_alarm" "ingest_lambda_no_invocations" {
  alarm_name          = "${var.project_name}-ingest-no-invocations-${var.environment}"
  alarm_description   = "Suricata ingest Lambda has NOT been invoked in 15 min — honeypot may be down or CloudWatch subscription broken"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 3
  metric_name         = "Invocations"
  namespace           = "AWS/Lambda"
  period              = 300 # 5 minutes
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "breaching"

  dimensions = {
    FunctionName = aws_lambda_function.suricata_ingest.function_name
  }

  tags = {
    Project = var.project_name
    Env     = var.environment
    Service = "monitoring"
  }
}

# Alarm: Ingest Lambda duration too high (may timeout)
resource "aws_cloudwatch_metric_alarm" "ingest_lambda_duration" {
  alarm_name          = "${var.project_name}-ingest-duration-high-${var.environment}"
  alarm_description   = "Suricata ingest Lambda avg duration > 20s — approaching 30s timeout, may lose events"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Average"
  threshold           = 20000 # 20 seconds in ms
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.suricata_ingest.function_name
  }

  tags = {
    Project = var.project_name
    Env     = var.environment
    Service = "monitoring"
  }
}

# Alarm: Ingest Lambda throttled (hitting concurrency limits)
resource "aws_cloudwatch_metric_alarm" "ingest_lambda_throttles" {
  alarm_name          = "${var.project_name}-ingest-throttles-${var.environment}"
  alarm_description   = "Suricata ingest Lambda is being throttled — events are being dropped"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.suricata_ingest.function_name
  }

  tags = {
    Project = var.project_name
    Env     = var.environment
    Service = "monitoring"
  }
}

# ----------------------------------------------------------
#  2. S3 Bucket Monitoring (Storage Health)
# ----------------------------------------------------------

# S3 request metrics — enable detailed monitoring on the logs bucket
resource "aws_s3_bucket_metric" "suricata_logs" {
  bucket = aws_s3_bucket.suricata_logs.id
  name   = "EntireBucket"
}

# Alarm: S3 4xx errors (permission or config issues)
resource "aws_cloudwatch_metric_alarm" "s3_4xx_errors" {
  alarm_name          = "${var.project_name}-s3-4xx-errors-${var.environment}"
  alarm_description   = "S3 logs bucket returning 4xx errors — check Lambda IAM permissions or bucket policy"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "4xxErrors"
  namespace           = "AWS/S3"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  treat_missing_data  = "notBreaching"

  dimensions = {
    BucketName = aws_s3_bucket.suricata_logs.id
    FilterId   = "EntireBucket"
  }

  tags = {
    Project = var.project_name
    Env     = var.environment
    Service = "monitoring"
  }
}

# Alarm: S3 5xx errors (AWS-side failures)
resource "aws_cloudwatch_metric_alarm" "s3_5xx_errors" {
  alarm_name          = "${var.project_name}-s3-5xx-errors-${var.environment}"
  alarm_description   = "S3 logs bucket returning 5xx errors — AWS-side issue, events may be lost"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "5xxErrors"
  namespace           = "AWS/S3"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"

  dimensions = {
    BucketName = aws_s3_bucket.suricata_logs.id
    FilterId   = "EntireBucket"
  }

  tags = {
    Project = var.project_name
    Env     = var.environment
    Service = "monitoring"
  }
}

# ----------------------------------------------------------
#  3. Log Query Lambda Monitoring (Athena API)
# ----------------------------------------------------------

# Alarm: Log query Lambda errors (user-facing — Athena queries failing)
resource "aws_cloudwatch_metric_alarm" "log_query_lambda_errors" {
  alarm_name          = "${var.project_name}-log-query-errors-${var.environment}"
  alarm_description   = "S3 log query Lambda errors — users cannot view logs from React LogViewer"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 3
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.s3_log_query.function_name
  }

  tags = {
    Project = var.project_name
    Env     = var.environment
    Service = "monitoring"
  }
}

# Alarm: Log query Lambda duration too high (Athena queries slow)
resource "aws_cloudwatch_metric_alarm" "log_query_lambda_duration" {
  alarm_name          = "${var.project_name}-log-query-duration-high-${var.environment}"
  alarm_description   = "S3 log query Lambda avg duration > 45s — Athena queries are slow, approaching 60s timeout"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Average"
  threshold           = 45000 # 45 seconds in ms
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.s3_log_query.function_name
  }

  tags = {
    Project = var.project_name
    Env     = var.environment
    Service = "monitoring"
  }
}

# ----------------------------------------------------------
#  4. Custom Metrics (Lambda publishes these)
# ----------------------------------------------------------

# The ingest Lambda already returns s3_writes and s3_total counts.
# We add a CloudWatch Metric Filter to parse these from the logs.

resource "aws_cloudwatch_log_metric_filter" "s3_writes_success" {
  name           = "${var.project_name}-s3-writes-success-${var.environment}"
  log_group_name = "/aws/lambda/${aws_lambda_function.suricata_ingest.function_name}"
  pattern        = "{ $.s3_writes > 0 }"

  metric_transformation {
    name          = "S3WritesSuccess"
    namespace     = "${var.project_name}/Pipeline"
    value         = "$.s3_writes"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "s3_writes_failed" {
  name           = "${var.project_name}-s3-writes-failed-${var.environment}"
  log_group_name = "/aws/lambda/${aws_lambda_function.suricata_ingest.function_name}"
  pattern        = "S3 write error"

  metric_transformation {
    name          = "S3WriteErrors"
    namespace     = "${var.project_name}/Pipeline"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "dynamodb_alerts_stored" {
  name           = "${var.project_name}-dynamodb-alerts-stored-${var.environment}"
  log_group_name = "/aws/lambda/${aws_lambda_function.suricata_ingest.function_name}"
  pattern        = "{ $.dynamodb_alerts > 0 }"

  metric_transformation {
    name          = "DynamoDBAlerts"
    namespace     = "${var.project_name}/Pipeline"
    value         = "$.dynamodb_alerts"
    default_value = "0"
  }
}

# Alarm: S3 writes failing (metric filter catches print() errors)
resource "aws_cloudwatch_metric_alarm" "s3_write_errors" {
  alarm_name          = "${var.project_name}-s3-write-errors-${var.environment}"
  alarm_description   = "Lambda is failing to write events to S3 — check bucket permissions or capacity"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "S3WriteErrors"
  namespace           = "${var.project_name}/Pipeline"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  treat_missing_data  = "notBreaching"

  tags = {
    Project = var.project_name
    Env     = var.environment
    Service = "monitoring"
  }
}

# ----------------------------------------------------------
#  5. CloudWatch Dashboard — S3 Pipeline Overview
# ----------------------------------------------------------

resource "aws_cloudwatch_dashboard" "s3_pipeline" {
  dashboard_name = "${var.project_name}-s3-pipeline-${var.environment}"

  dashboard_body = jsonencode({
    widgets = [
      # Row 1: Header
      {
        type   = "text"
        x      = 0
        y      = 0
        width  = 24
        height = 1
        properties = {
          markdown = "# 🛡️ PhantomWall — S3 Log Pipeline Monitoring (${var.environment})\nCloudWatch → Ingest Lambda → S3 → Athena → Log Query Lambda → React"
        }
      },

      # Row 2: Ingest Lambda Invocations & Errors
      {
        type   = "metric"
        x      = 0
        y      = 1
        width  = 8
        height = 6
        properties = {
          title   = "Ingest Lambda — Invocations"
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.suricata_ingest.function_name, { stat = "Sum", period = 300, color = "#2ca02c" }]
          ]
          view   = "timeSeries"
          region = var.aws_region
          period = 300
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 1
        width  = 8
        height = 6
        properties = {
          title   = "Ingest Lambda — Errors & Throttles"
          metrics = [
            ["AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.suricata_ingest.function_name, { stat = "Sum", period = 300, color = "#d62728" }],
            ["AWS/Lambda", "Throttles", "FunctionName", aws_lambda_function.suricata_ingest.function_name, { stat = "Sum", period = 300, color = "#ff7f0e" }]
          ]
          view   = "timeSeries"
          region = var.aws_region
          period = 300
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 1
        width  = 8
        height = 6
        properties = {
          title   = "Ingest Lambda — Duration (ms)"
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.suricata_ingest.function_name, { stat = "Average", period = 300, color = "#1f77b4" }],
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.suricata_ingest.function_name, { stat = "Maximum", period = 300, color = "#ff7f0e" }]
          ]
          view   = "timeSeries"
          region = var.aws_region
          period = 300
        }
      },

      # Row 3: S3 Pipeline Custom Metrics
      {
        type   = "metric"
        x      = 0
        y      = 7
        width  = 8
        height = 6
        properties = {
          title   = "S3 Writes (from Ingest Lambda)"
          metrics = [
            ["${var.project_name}/Pipeline", "S3WritesSuccess", { stat = "Sum", period = 300, color = "#2ca02c" }],
            ["${var.project_name}/Pipeline", "S3WriteErrors", { stat = "Sum", period = 300, color = "#d62728" }]
          ]
          view   = "timeSeries"
          region = var.aws_region
          period = 300
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 7
        width  = 8
        height = 6
        properties = {
          title   = "DynamoDB Alerts Stored"
          metrics = [
            ["${var.project_name}/Pipeline", "DynamoDBAlerts", { stat = "Sum", period = 300, color = "#9467bd" }]
          ]
          view   = "timeSeries"
          region = var.aws_region
          period = 300
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 7
        width  = 8
        height = 6
        properties = {
          title   = "S3 Bucket — Size & Object Count"
          metrics = [
            ["AWS/S3", "BucketSizeBytes", "BucketName", aws_s3_bucket.suricata_logs.id, "StorageType", "StandardStorage", { stat = "Average", period = 86400, color = "#1f77b4" }],
            ["AWS/S3", "NumberOfObjects", "BucketName", aws_s3_bucket.suricata_logs.id, "StorageType", "AllStorageTypes", { stat = "Average", period = 86400, color = "#ff7f0e", yAxis = "right" }]
          ]
          view   = "timeSeries"
          region = var.aws_region
          period = 86400
        }
      },

      # Row 4: S3 Request Metrics
      {
        type   = "metric"
        x      = 0
        y      = 13
        width  = 12
        height = 6
        properties = {
          title   = "S3 Bucket — PUT/GET Requests"
          metrics = [
            ["AWS/S3", "PutRequests", "BucketName", aws_s3_bucket.suricata_logs.id, "FilterId", "EntireBucket", { stat = "Sum", period = 300, color = "#2ca02c" }],
            ["AWS/S3", "GetRequests", "BucketName", aws_s3_bucket.suricata_logs.id, "FilterId", "EntireBucket", { stat = "Sum", period = 300, color = "#1f77b4" }]
          ]
          view   = "timeSeries"
          region = var.aws_region
          period = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 13
        width  = 12
        height = 6
        properties = {
          title   = "S3 Bucket — Errors"
          metrics = [
            ["AWS/S3", "4xxErrors", "BucketName", aws_s3_bucket.suricata_logs.id, "FilterId", "EntireBucket", { stat = "Sum", period = 300, color = "#ff7f0e" }],
            ["AWS/S3", "5xxErrors", "BucketName", aws_s3_bucket.suricata_logs.id, "FilterId", "EntireBucket", { stat = "Sum", period = 300, color = "#d62728" }]
          ]
          view   = "timeSeries"
          region = var.aws_region
          period = 300
        }
      },

      # Row 5: Log Query Lambda (Athena → React)
      {
        type   = "text"
        x      = 0
        y      = 19
        width  = 24
        height = 1
        properties = {
          markdown = "## 🔍 Athena Log Query Lambda (React LogViewer → API Gateway → Lambda → Athena → S3)"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 20
        width  = 8
        height = 6
        properties = {
          title   = "Log Query Lambda — Invocations"
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.s3_log_query.function_name, { stat = "Sum", period = 300, color = "#2ca02c" }]
          ]
          view   = "timeSeries"
          region = var.aws_region
          period = 300
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 20
        width  = 8
        height = 6
        properties = {
          title   = "Log Query Lambda — Errors"
          metrics = [
            ["AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.s3_log_query.function_name, { stat = "Sum", period = 300, color = "#d62728" }]
          ]
          view   = "timeSeries"
          region = var.aws_region
          period = 300
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 20
        width  = 8
        height = 6
        properties = {
          title   = "Log Query Lambda — Duration (ms)"
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.s3_log_query.function_name, { stat = "Average", period = 300, color = "#1f77b4" }],
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.s3_log_query.function_name, { stat = "Maximum", period = 300, color = "#ff7f0e" }]
          ]
          view   = "timeSeries"
          region = var.aws_region
          period = 300
        }
      },

      # Row 6: Alarm Status
      {
        type   = "alarm"
        x      = 0
        y      = 26
        width  = 24
        height = 3
        properties = {
          title  = "🚨 Pipeline Alarm Status"
          alarms = [
            aws_cloudwatch_metric_alarm.ingest_lambda_errors.arn,
            aws_cloudwatch_metric_alarm.ingest_lambda_no_invocations.arn,
            aws_cloudwatch_metric_alarm.ingest_lambda_duration.arn,
            aws_cloudwatch_metric_alarm.ingest_lambda_throttles.arn,
            aws_cloudwatch_metric_alarm.s3_4xx_errors.arn,
            aws_cloudwatch_metric_alarm.s3_5xx_errors.arn,
            aws_cloudwatch_metric_alarm.s3_write_errors.arn,
            aws_cloudwatch_metric_alarm.log_query_lambda_errors.arn,
            aws_cloudwatch_metric_alarm.log_query_lambda_duration.arn
          ]
        }
      }
    ]
  })
}

# ----------------------------------------------------------
#  6. Outputs
# ----------------------------------------------------------

output "s3_pipeline_dashboard_url" {
  description = "CloudWatch Dashboard URL for the S3 log pipeline"
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.s3_pipeline.dashboard_name}"
}

output "s3_pipeline_alarms" {
  description = "List of CloudWatch alarms monitoring the S3 pipeline"
  value = [
    aws_cloudwatch_metric_alarm.ingest_lambda_errors.alarm_name,
    aws_cloudwatch_metric_alarm.ingest_lambda_no_invocations.alarm_name,
    aws_cloudwatch_metric_alarm.ingest_lambda_duration.alarm_name,
    aws_cloudwatch_metric_alarm.ingest_lambda_throttles.alarm_name,
    aws_cloudwatch_metric_alarm.s3_4xx_errors.alarm_name,
    aws_cloudwatch_metric_alarm.s3_5xx_errors.alarm_name,
    aws_cloudwatch_metric_alarm.s3_write_errors.alarm_name,
    aws_cloudwatch_metric_alarm.log_query_lambda_errors.alarm_name,
    aws_cloudwatch_metric_alarm.log_query_lambda_duration.alarm_name
  ]
}
