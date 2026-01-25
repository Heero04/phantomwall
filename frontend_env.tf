resource "local_file" "frontend_env" {
  filename   = "${path.module}/frontend/.env"
  content    = "VITE_SURICATA_API_URL=${aws_apigatewayv2_stage.suricata.invoke_url}\n"
  depends_on = [aws_apigatewayv2_stage.suricata]
}
