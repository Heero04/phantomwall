# Honeypot MVP Terraform resources (safe defaults).
# Purpose: resources required to run a single honeypot EC2 instance that ships
# Suricata `eve.json` to CloudWatch Logs. These resources are intentionally
# minimal to keep cost low and make the MVP easy to review and test.
#
# Ownership / mapping:
# - Security group (`aws_security_group.honeypot_sg`) belongs to the Honeypot
#   and allows inbound scan traffic (ports 22 and 80).
# - IAM role/policy/instance-profile (aws_iam_role.cw_role, aws_iam_role_policy.cw_policy,
#   aws_iam_instance_profile.cw_profile) belong to the Honeypot EC2 instance and
#   grant CloudWatch Logs permissions so the CloudWatch Agent can push logs.
# - EC2 instance (`aws_instance.honeypot`) is the actual honeypot; UserData
#   installs Suricata and the CloudWatch agent. The instance tags follow the
#   project/workspace naming convention so resources are easy to find.

// `public_subnet_id` moved to `variables.tf` to centralize variables across the
// module. This placeholder was removed to avoid duplicate variable declarations.

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3a.small" # Optimized for cost (~$15/month savings) - 2GB RAM sufficient for Suricata
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "cw_log_group" {
  type    = string
  default = "/honeypot/suricata"
}

variable "cw_bootstrap_log_group" {
  description = "CloudWatch log group name for bootstrap logs"
  type        = string
  default     = "/honeypot/bootstrap"
}

# Find the latest Ubuntu 22.04 LTS AMI (recommended for SaaS)
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "state"
    values = ["available"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}



# Local naming convention helper
locals {
  # Helper used for human-friendly resource Name tags. Set `random_name`
  # (middle component) via -var or terraform.tfvars to distinguish resources.
  twoName = "${var.project_name}-${var.random_name}-${terraform.workspace}"
}

# Optional subnet lookup by tag: if `subnet_tag_value` is provided we will
# try to find a subnet with tag `${var.subnet_tag_key}=${var.subnet_tag_value}`.
data "aws_subnets" "by_tag" {
  filter {
    name   = "tag:${var.subnet_tag_key}"
    values = var.subnet_tag_value != "" ? [var.subnet_tag_value] : []
  }
}

resource "aws_cloudwatch_log_group" "honeypot_bootstrap" {
  name              = var.cw_bootstrap_log_group
  retention_in_days = 7  # Reduced from 14 days for cost optimization

  tags = {
    Project = var.project_name != "" ? var.project_name : "phantomwall"
    Env     = var.environment
    Service = "honeypot-bootstrap"
  }
}

resource "aws_security_group" "honeypot_sg" {
  # Security group for the honeypot. Intentionally permissive for MVP so
  # the instance attracts scans. Tighten only when auto-blocking exists.
  name        = "${local.resource_name_prefix}-honeypot-sg-${var.environment}"
  description = "Allow SSH and HTTP for honeypot"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
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
    # Name tag follows the global naming pattern: project-component-workspace
    Name    = "${local.resource_name_prefix}-honeypot-sg-${var.environment}"
    Project = var.project_name != "" ? var.project_name : "phantomwall"
    Env     = var.environment
  }
}

# Minimal IAM role and policy so instance can push logs to CloudWatch
resource "aws_iam_role" "cw_role" {
  # IAM role assumed by the honeypot EC2 instance. Grants the instance
  # permission to push logs to CloudWatch via the CloudWatch Agent.
  name = "${local.resource_name_prefix}-honeypot-cw-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "ec2.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
  tags = {
    # Tag shows this role belongs to the Honeypot component
    Name    = "${local.resource_name_prefix}-honeypot-cw-role-${var.environment}"
    Project = var.project_name != "" ? var.project_name : "phantomwall"
    Env     = var.environment
  }
}

resource "aws_iam_role_policy" "cw_policy" {
  # Inline policy attached to the honeypot role. Allows minimal CloudWatch
  # Logs actions needed by the CloudWatch Agent and S3 access for script downloads.
  name = "phantomwall-honeypot-cw-policy-${var.environment}"
  role = aws_iam_role.cw_role.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        Resource = "*"
      },
      {
        Effect = "Allow",
        Action = [
          "s3:GetObject"
        ],
        Resource = "${aws_s3_bucket.honeypot_scripts.arn}/*"
      }
    ]
  })
}

# Attach AWS managed policy for SSM so we can use Session Manager if SSH fails
resource "aws_iam_role_policy_attachment" "cw_ssm_attach" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
  role       = aws_iam_role.cw_role.name
}

resource "aws_iam_instance_profile" "cw_profile" {
  # Instance profile to attach the role to the EC2 instance. This is the
  # bridge that allows EC2 to assume the `cw_role` at runtime.
  name = "${local.resource_name_prefix}-honeypot-profile-${var.environment}"
  role = aws_iam_role.cw_role.name
  tags = {
    Name    = "${local.resource_name_prefix}-honeypot-profile-${var.environment}"
    Project = var.project_name != "" ? var.project_name : "phantomwall"
    Env     = var.environment
  }
}

# EC2 Instance
resource "aws_instance" "honeypot" {
  # The honeypot EC2 instance. Runs Suricata + CloudWatch Agent via
  # user-data. Keep only one instance in the workspace to limit cost.
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.instance_type
  subnet_id                   = var.subnet_tag_value != "" && length(data.aws_subnets.by_tag.ids) > 0 ? data.aws_subnets.by_tag.ids[0] : var.public_subnet_id
  associate_public_ip_address = true
  vpc_security_group_ids      = [aws_security_group.honeypot_sg.id]
  iam_instance_profile        = aws_iam_instance_profile.cw_profile.name

  # Attach key pair if provided. Preference order:
  # 1) var.key_pair_name (existing key name supplied by user)
  # 2) aws_key_pair.generated_key.key_name (auto-created when create_key_pair=true)
  # 3) null (no SSH access)
  key_name = var.key_pair_name != "" ? var.key_pair_name : (var.create_key_pair ? aws_key_pair.generated_key[0].key_name : null)

  # Runs Suricata setup and CloudWatch Agent configuration on boot.
  # Uses simplified Ubuntu-only scripts for testing.
  user_data = templatefile("${path.module}/honeypot_simple_wrapper.sh.tpl", {
    cw_log_group           = var.cw_log_group
    cw_bootstrap_log_group = var.cw_bootstrap_log_group
    suricata_script        = file("${path.module}/honeypot_ubuntu_simple.sh")
    cloudwatch_script      = file("${path.module}/honeypot_cloudwatch_agent.sh")
  })

  tags = {
    # Name uses the two-part project and workspace pattern with a middle
    # component controlled by `random_name` (set via tfvars/CLI).
    Name    = local.twoName
    Project = var.project_name != "" ? var.project_name : "phantomwall"
    Env     = var.environment
  }
}

# Optional: generate an SSH keypair locally and upload the public key to AWS
resource "tls_private_key" "generated" {
  count     = var.create_key_pair ? 1 : 0
  algorithm = "ED25519"
}

resource "aws_key_pair" "generated_key" {
  count      = var.create_key_pair ? 1 : 0
  key_name   = "${var.project_name}-generated-key-${terraform.workspace}"
  public_key = tls_private_key.generated[0].public_key_openssh
}

resource "local_file" "private_key_file" {
  count           = var.create_key_pair && var.key_private_key_path != "" ? 1 : 0
  filename        = var.key_private_key_path
  content         = tls_private_key.generated[0].private_key_pem
  file_permission = "0600"
}

output "log_group_name" {
  value = var.cw_log_group
}









