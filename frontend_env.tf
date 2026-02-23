resource "local_file" "frontend_env" {
  filename = "${path.module}/frontend/.env"
  content  = <<-EOT
VITE_SURICATA_API_URL=${aws_apigatewayv2_stage.suricata.invoke_url}
VITE_WS_URL=wss://${aws_apigatewayv2_api.websocket.id}.execute-api.${var.aws_region}.amazonaws.com/prod
EOT
  depends_on = [aws_apigatewayv2_stage.suricata, aws_apigatewayv2_stage.ws_prod]
}
