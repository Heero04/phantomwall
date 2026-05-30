/*
================================================================================
AWS EC2 Kali Linux Configuration
================================================================================
Purpose: Deploys Kali Linux instance for security testing and attack simulation.

Naming Convention: {project-name}-ec2-kali-{resource}-{environment}
Example: phantomwall-ec2-kali-instance-dev

Features:
- Kali Linux AMI with pre-installed security tools
- SSM Session Manager access (no SSH required)
- IAM instance profile for AWS service access
- Security group with restricted access
- Optional SSH key generation

Resources:
- EC2 instance (t3.micro)
- Security group with SSH access control
- IAM role and instance profile for SSM
- Optional SSH keypair generation
================================================================================
*/

# ----------------------------------------------------------
#                EC2 Instance Configuration
# ----------------------------------------------------------
# Purpose: Deploys Kali Linux instance for security testing
# Features:
# - AMI specification
# - Instance type selection
# - Network configuration
# - Security group association
# - Tag management
# ----------------------------------------------------------

/* Kali instance disabled for demo — attack simulation handled by Lambda.
resource "aws_instance" "kali" {
  ami           = "ami-0206d67558efa3db1"
  instance_type = "t3.micro"
  key_name = var.kali_key_name != "" ? var.kali_key_name : (var.create_kali_key ? aws_key_pair.kali_generated[0].key_name : null)
  subnet_id = var.subnet_tag_value != "" ? data.aws_subnets.by_tag.ids[0] : var.public_subnet_id
  iam_instance_profile   = aws_iam_instance_profile.kali_profile.name
  vpc_security_group_ids = [aws_security_group.kali_sg.id]
  user_data = "..."
  tags = { Name = "${var.project_name}-ec2-kali-instance-${var.environment}" }
}
*/


# ----------------------------------------------------------
#            Security Group Configuration
# ----------------------------------------------------------
# Purpose: Defines network access rules for Kali instance
# Features:
# - SSH access control
# - Outbound traffic rules
# - IP-based restrictions
# - Security group tagging
# ----------------------------------------------------------

resource "aws_security_group" "kali_sg" {
  name        = "${var.project_name}-ec2-kali-sg-${var.environment}"
  description = "Security group for Kali instance"
  # Use the account's default VPC so we don't rely on an aws_vpc resource
  vpc_id = data.aws_vpc.default.id

  # SSH access configuration
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["173.23.109.146/32"] # Restricted to specific IP
  }

  # Outbound traffic configuration
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-ec2-kali-sg-${var.environment}"
  }
}

# IAM role for Kali to allow SSM access
resource "aws_iam_role" "kali_role" {
  name = "${var.project_name}-ec2-kali-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "ec2.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "kali_ssm_attach" {
  role       = aws_iam_role.kali_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "kali_profile" {
  name = "${var.project_name}-ec2-kali-profile-${var.environment}"
  role = aws_iam_role.kali_role.name
}

# Optional: generate SSH key for Kali and upload to AWS
resource "tls_private_key" "kali_generated" {
  count     = var.create_kali_key ? 1 : 0
  algorithm = "ED25519"
}

resource "aws_key_pair" "kali_generated" {
  count      = var.create_kali_key ? 1 : 0
  key_name   = "${var.project_name}-ec2-kali-keypair-${var.environment}"
  public_key = tls_private_key.kali_generated[0].public_key_openssh
}

resource "local_file" "kali_private_key_file" {
  count           = var.create_kali_key && var.kali_key_private_key_path != "" ? 1 : 0
  filename        = var.kali_key_private_key_path
  content         = tls_private_key.kali_generated[0].private_key_pem
  file_permission = "0600"
}

// Data sources for VPC/subnet lookup
data "aws_vpc" "default" {
  default = true
}

// Reuse `data.aws_subnets.by_tag` from `honeypot_ec2.tf` to avoid duplicate
// data source declarations. The data source is declared once in the root
// module and shared by all resources.

// Local key mover removed: we now rely on SSM and explicit local key management.
