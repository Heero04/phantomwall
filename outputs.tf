// Outputs: useful runtime values for the honeypot module. Keep these
// minimal to avoid leaking sensitive info. The public IP and instance ID
// are useful for quick testing and teardown.
output "honeypot_public_ip" {
  description = "Public IP of the honeypot EC2 instance"
  value       = aws_instance.honeypot.public_ip
}

// Output Honeypot EC2 instance ID for use in ad-hoc scripts and automation
output "honeypot_instance_id" {
  description = "EC2 Instance ID of the honeypot"
  value       = aws_instance.honeypot.id
}

// Kali outputs: public IP and instance ID
output "kali_public_ip" {
  description = "Public IP of the Kali EC2 instance"
  value       = aws_instance.kali.public_ip
}

output "kali_instance_id" {
  description = "EC2 Instance ID of the Kali instance"
  value       = aws_instance.kali.id
}

output "suricata_log_group" {
  description = "CloudWatch log group name receiving Suricata logs"
  value       = aws_cloudwatch_log_group.suricata.name
}

output "honeypot_bootstrap_log_group" {
  description = "CloudWatch log group name receiving honeypot bootstrap logs"
  value       = aws_cloudwatch_log_group.honeypot_bootstrap.name
}

output "suricata_events_table" {
  description = "DynamoDB table storing Suricata events"
  value       = aws_dynamodb_table.suricata_events.name
}

output "suricata_ingest_lambda" {
  description = "Lambda function processing Suricata CloudWatch log batches"
  value       = aws_lambda_function.suricata_ingest.function_name
}

output "suricata_api_function" {
  description = "Lambda function serving the Suricata events API"
  value       = aws_lambda_function.suricata_api.function_name
}

output "suricata_api_endpoint" {
  description = "Invoke URL for the Suricata events HTTP API"
  value       = aws_apigatewayv2_stage.suricata.invoke_url
}

output "suricata_chat_lambda" {
  description = "Lambda function handling Bedrock-powered chat responses"
  value       = aws_lambda_function.suricata_chat.function_name
}

