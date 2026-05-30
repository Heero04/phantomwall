// Outputs: useful runtime values for the honeypot module. Keep these
// minimal to avoid leaking sensitive info. The public IP and instance ID
// are useful for quick testing and teardown.
/* Static instance outputs disabled — instances are created on-demand via UI.
output "honeypot_public_ip" {
  description = "Public IP of the honeypot EC2 instance"
  value       = aws_instance.honeypot.public_ip
}

output "honeypot_instance_id" {
  description = "EC2 Instance ID of the honeypot"
  value       = aws_instance.honeypot.id
}

output "kali_public_ip" {
  description = "Public IP of the Kali EC2 instance"
  value       = aws_instance.kali.public_ip
}

output "kali_instance_id" {
  description = "EC2 Instance ID of the Kali instance"
  value       = aws_instance.kali.id
}
*/

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

# ── WAF Outputs ─────────────────────────────────────────────────

output "waf_web_acl_arn" {
  description = "ARN of the WAF Web ACL"
  value       = var.waf_enabled ? aws_wafv2_web_acl.main[0].arn : null
}

output "waf_blocklist_id" {
  description = "ID of the WAF IP blocklist set"
  value       = var.waf_enabled ? aws_wafv2_ip_set.blocklist[0].id : null
}

output "waf_api_lambda" {
  description = "Lambda function serving the WAF management API"
  value       = var.waf_enabled ? aws_lambda_function.waf_api[0].function_name : null
}

output "waf_autoblock_lambda" {
  description = "Lambda function auto-blocking malicious IPs from honeypot alerts"
  value       = var.waf_enabled ? aws_lambda_function.waf_autoblock[0].function_name : null
}

