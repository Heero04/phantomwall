/*
================================================================================
AWS Athena S3 Log Viewer Configuration
================================================================================
Purpose: Enables querying ALL Suricata logs stored in S3 via Athena.
         Separate from DynamoDB alerts - this is for full log analysis.

Naming Convention: {project-name}-athena-{resource}-{environment}
Example: phantomwall-athena-workgroup-dev

Architecture:
  React LogViewer → API Gateway /logs → Lambda → Athena → S3 (all logs)

Cost: Athena charges $5 per TB scanned. Partitioned by year/month/day/hour
      so queries are efficient and cheap.
================================================================================
*/

# ----------------------------------------------------------
#            Athena Results Bucket
# ----------------------------------------------------------
resource "aws_s3_bucket" "athena_results" {
  bucket = "${var.project_name}-athena-results-${var.environment}"

  tags = {
    Project = var.project_name
    Env     = var.environment
    Service = "athena-query-results"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "athena_results" {
  bucket = aws_s3_bucket.athena_results.id

  rule {
    id     = "expire-query-results"
    status = "Enabled"

    filter {
      prefix = ""
    }

    # Delete query results after 7 days (they're temporary)
    expiration {
      days = 7
    }
  }
}

# ----------------------------------------------------------
#            Glue Catalog Database & Table
# ----------------------------------------------------------
resource "aws_glue_catalog_database" "suricata" {
  name = "${var.project_name}_logs_${var.environment}"
}

resource "aws_glue_catalog_table" "suricata_events" {
  name          = "suricata_events"
  database_name = aws_glue_catalog_database.suricata.name

  table_type = "EXTERNAL_TABLE"

  parameters = {
    "classification"  = "json"
    "compressionType" = "none"
  }

  storage_descriptor {
    location      = "s3://${aws_s3_bucket.suricata_logs.bucket}/"
    input_format  = "org.apache.hadoop.mapred.TextInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat"

    ser_de_info {
      serialization_library = "org.openx.data.jsonserde.JsonSerDe"
      parameters = {
        "paths" = "timestamp,event_type,src_ip,src_port,dest_ip,dest_port,proto,alert,flow,tcp"
      }
    }

    # Columns matching Suricata eve.json schema
    columns {
      name = "timestamp"
      type = "string"
    }
    columns {
      name = "event_type"
      type = "string"
    }
    columns {
      name = "src_ip"
      type = "string"
    }
    columns {
      name = "src_port"
      type = "int"
    }
    columns {
      name = "dest_ip"
      type = "string"
    }
    columns {
      name = "dest_port"
      type = "int"
    }
    columns {
      name = "proto"
      type = "string"
    }
    columns {
      name = "flow_id"
      type = "bigint"
    }
    columns {
      name = "alert"
      type = "struct<action:string,gid:int,signature_id:int,rev:int,signature:string,category:string,severity:int>"
    }
    columns {
      name = "flow"
      type = "struct<pkts_toserver:int,pkts_toclient:int,bytes_toserver:bigint,bytes_toclient:bigint,state:string,reason:string>"
    }
    columns {
      name = "app_proto"
      type = "string"
    }
  }

  # Partitioned by date/hour to match S3 key structure
  partition_keys {
    name = "year"
    type = "string"
  }
  partition_keys {
    name = "month"
    type = "string"
  }
  partition_keys {
    name = "day"
    type = "string"
  }
  partition_keys {
    name = "hour"
    type = "string"
  }
}

# ----------------------------------------------------------
#            Athena Workgroup
# ----------------------------------------------------------
resource "aws_athena_workgroup" "suricata" {
  name = "${var.project_name}-athena-workgroup-${var.environment}"

  configuration {
    result_configuration {
      output_location = "s3://${aws_s3_bucket.athena_results.bucket}/results/"
    }

    # Cost control: limit query data scan to 100MB
    bytes_scanned_cutoff_per_query = 104857600
  }

  tags = {
    Project = var.project_name
    Env     = var.environment
    Service = "log-analysis"
  }
}

# ----------------------------------------------------------
#            Lambda for S3 Log Queries
# ----------------------------------------------------------
resource "aws_iam_role" "lambda_log_query" {
  name = "${var.project_name}-lambda-log-query-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect    = "Allow",
        Principal = { Service = "lambda.amazonaws.com" },
        Action    = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_log_query" {
  name = "${var.project_name}-lambda-log-query-policy-${var.environment}"
  role = aws_iam_role.lambda_log_query.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "athena:StartQueryExecution",
          "athena:GetQueryExecution",
          "athena:GetQueryResults",
          "athena:StopQueryExecution"
        ],
        Resource = aws_athena_workgroup.suricata.arn
      },
      {
        Effect = "Allow",
        Action = [
          "glue:GetTable",
          "glue:GetPartitions",
          "glue:GetDatabase",
          "glue:BatchCreatePartition",
          "glue:CreatePartition"
        ],
        Resource = [
          "arn:aws:glue:${var.aws_region}:*:catalog",
          "arn:aws:glue:${var.aws_region}:*:database/${aws_glue_catalog_database.suricata.name}",
          "arn:aws:glue:${var.aws_region}:*:table/${aws_glue_catalog_database.suricata.name}/*"
        ]
      },
      {
        Effect = "Allow",
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ],
        Resource = [
          aws_s3_bucket.suricata_logs.arn,
          "${aws_s3_bucket.suricata_logs.arn}/*"
        ]
      },
      {
        Effect = "Allow",
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket",
          "s3:GetBucketLocation"
        ],
        Resource = [
          aws_s3_bucket.athena_results.arn,
          "${aws_s3_bucket.athena_results.arn}/*"
        ]
      },
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        Resource = "*"
      }
    ]
  })
}

data "archive_file" "s3_log_query" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/s3_log_query"
  output_path = "${path.module}/lambda/s3_log_query.zip"
}

resource "aws_lambda_function" "s3_log_query" {
  function_name    = "${var.project_name}-lambda-log-query-${var.environment}"
  role             = aws_iam_role.lambda_log_query.arn
  handler          = "handler.handler"
  runtime          = "python3.11"
  filename         = data.archive_file.s3_log_query.output_path
  source_code_hash = data.archive_file.s3_log_query.output_base64sha256
  timeout          = 60 # Athena queries can take a few seconds
  memory_size      = 128

  environment {
    variables = {
      ATHENA_DATABASE  = aws_glue_catalog_database.suricata.name
      ATHENA_TABLE     = aws_glue_catalog_table.suricata_events.name
      ATHENA_WORKGROUP = aws_athena_workgroup.suricata.name
      S3_BUCKET        = aws_s3_bucket.suricata_logs.bucket
      RESULTS_BUCKET   = aws_s3_bucket.athena_results.bucket
    }
  }

  tags = {
    Project = var.project_name
    Env     = var.environment
  }
}

resource "aws_cloudwatch_log_group" "s3_log_query" {
  name              = "/aws/lambda/${aws_lambda_function.s3_log_query.function_name}"
  retention_in_days = 7
}

# ----------------------------------------------------------
#            API Gateway Route - /logs
# ----------------------------------------------------------
resource "aws_apigatewayv2_integration" "s3_log_query" {
  api_id                 = aws_apigatewayv2_api.suricata.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.s3_log_query.invoke_arn
  payload_format_version = "2.0"
  integration_method     = "POST"
}

resource "aws_apigatewayv2_route" "s3_logs" {
  api_id    = aws_apigatewayv2_api.suricata.id
  route_key = "GET /logs"
  target    = "integrations/${aws_apigatewayv2_integration.s3_log_query.id}"
}

resource "aws_lambda_permission" "apigw_log_query_invoke" {
  statement_id  = "AllowAPIGatewayInvokeLogQuery"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.s3_log_query.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.suricata.execution_arn}/*/*"
}

# ----------------------------------------------------------
#            Outputs
# ----------------------------------------------------------
output "athena_workgroup" {
  value       = aws_athena_workgroup.suricata.name
  description = "Athena workgroup for S3 log queries"
}

output "athena_database" {
  value       = aws_glue_catalog_database.suricata.name
  description = "Glue catalog database for Suricata logs"
}

output "log_query_lambda" {
  value       = aws_lambda_function.s3_log_query.function_name
  description = "Lambda function for S3 log queries via Athena"
}
