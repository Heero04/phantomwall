# ===========================================================
#                     PhantomWall Cloud Threat
#                     Trap Profile Security Groups
# ===========================================================
# Description: Per-profile security groups for honeypot traps.
#              Each trap profile exposes only the ports it needs.
#              The provisioner Lambda selects the right SG at
#              launch time based on the chosen trap_profile.
#
# Profiles:
#   ssh     → 22
#   http    → 80, 443
#   telnet  → 23
#   multi   → 22, 80, 443, 23, 2222, 8080  (catch-all)
#   default → same as multi
#
# Naming: phantomwall-honeypot-sg-{profile}-{environment}
# ===========================================================

# Common egress block (all outbound allowed)
# Reused in every SG below via the same pattern.

# ----------------------------------------------------------
#   SSH Trap — port 22 only
# ----------------------------------------------------------
resource "aws_security_group" "honeypot_sg_ssh" {
  name        = "${var.project_name}-honeypot-sg-ssh-${var.environment}"
  description = "Honeypot trap: SSH only (port 22)"

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-honeypot-sg-ssh-${var.environment}"
    Project     = var.project_name
    Env         = var.environment
    TrapProfile = "ssh"
  }
}

# ----------------------------------------------------------
#   HTTP Trap — ports 80, 443
# ----------------------------------------------------------
resource "aws_security_group" "honeypot_sg_http" {
  name        = "${var.project_name}-honeypot-sg-http-${var.environment}"
  description = "Honeypot trap: HTTP/HTTPS (ports 80, 443)"

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-honeypot-sg-http-${var.environment}"
    Project     = var.project_name
    Env         = var.environment
    TrapProfile = "http"
  }
}

# ----------------------------------------------------------
#   Telnet Trap — port 23
# ----------------------------------------------------------
resource "aws_security_group" "honeypot_sg_telnet" {
  name        = "${var.project_name}-honeypot-sg-telnet-${var.environment}"
  description = "Honeypot trap: Telnet only (port 23)"

  ingress {
    description = "Telnet"
    from_port   = 23
    to_port     = 23
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-honeypot-sg-telnet-${var.environment}"
    Project     = var.project_name
    Env         = var.environment
    TrapProfile = "telnet"
  }
}

# ----------------------------------------------------------
#   Multi-Port Trap — 22, 23, 80, 443, 2222, 8080
#   Also used as "default" profile
# ----------------------------------------------------------
resource "aws_security_group" "honeypot_sg_multi" {
  name        = "${var.project_name}-honeypot-sg-multi-${var.environment}"
  description = "Honeypot trap: Multi-port (SSH, Telnet, HTTP, HTTPS, alt-SSH, alt-HTTP)"

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Telnet"
    from_port   = 23
    to_port     = 23
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Alt SSH (cowrie)"
    from_port   = 2222
    to_port     = 2222
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Alt HTTP"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-honeypot-sg-multi-${var.environment}"
    Project     = var.project_name
    Env         = var.environment
    TrapProfile = "multi"
  }
}

# ----------------------------------------------------------
#   Outputs — SG IDs for Lambda env vars
# ----------------------------------------------------------
output "honeypot_sg_ssh_id" {
  value       = aws_security_group.honeypot_sg_ssh.id
  description = "Security group ID for SSH trap profile"
}

output "honeypot_sg_http_id" {
  value       = aws_security_group.honeypot_sg_http.id
  description = "Security group ID for HTTP trap profile"
}

output "honeypot_sg_telnet_id" {
  value       = aws_security_group.honeypot_sg_telnet.id
  description = "Security group ID for Telnet trap profile"
}

output "honeypot_sg_multi_id" {
  value       = aws_security_group.honeypot_sg_multi.id
  description = "Security group ID for Multi-port trap profile"
}
