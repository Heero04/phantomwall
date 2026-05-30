resource "local_file" "frontend_env" {
  filename = "${path.module}/frontend/.env"
  content  = <<-EOT
VITE_SURICATA_API_URL=${aws_apigatewayv2_stage.suricata.invoke_url}
VITE_WS_URL=wss://${aws_apigatewayv2_api.websocket.id}.execute-api.${var.aws_region}.amazonaws.com/prod
VITE_COGNITO_USER_POOL_ID=${aws_cognito_user_pool.phantomwall.id}
VITE_COGNITO_CLIENT_ID=${aws_cognito_user_pool_client.phantomwall_web.id}
VITE_AWS_REGION=${var.aws_region}
EOT
  depends_on = [aws_apigatewayv2_stage.suricata, aws_apigatewayv2_stage.ws_prod]
}
