data "aws_route53_zone" "cognito_email_zone" {
  count        = var.cognito_use_ses ? 1 : 0
  name         = "${var.cognito_email_domain}."
  private_zone = false
}

resource "aws_ses_domain_identity" "cognito_email_domain" {
  count  = var.cognito_use_ses ? 1 : 0
  domain = var.cognito_email_domain
}

resource "aws_route53_record" "cognito_ses_verification" {
  count   = var.cognito_use_ses ? 1 : 0
  zone_id = data.aws_route53_zone.cognito_email_zone[0].zone_id
  name    = "_amazonses.${var.cognito_email_domain}"
  type    = "TXT"
  ttl     = 600
  records = [aws_ses_domain_identity.cognito_email_domain[0].verification_token]
}

resource "aws_ses_domain_dkim" "cognito_email_domain" {
  count  = var.cognito_use_ses ? 1 : 0
  domain = aws_ses_domain_identity.cognito_email_domain[0].domain
}

resource "aws_route53_record" "cognito_ses_dkim" {
  count   = var.cognito_use_ses ? 3 : 0
  zone_id = data.aws_route53_zone.cognito_email_zone[0].zone_id
  name    = "${aws_ses_domain_dkim.cognito_email_domain[0].dkim_tokens[count.index]}._domainkey.${var.cognito_email_domain}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_ses_domain_dkim.cognito_email_domain[0].dkim_tokens[count.index]}.dkim.amazonses.com"]
}

resource "aws_ses_domain_identity_verification" "cognito_email_domain" {
  count  = var.cognito_use_ses ? 1 : 0
  domain = aws_ses_domain_identity.cognito_email_domain[0].id

  depends_on = [
    aws_route53_record.cognito_ses_verification
  ]
}
