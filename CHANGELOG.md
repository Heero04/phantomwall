# Changelog

## [v0.5] - 2026-01-24

### Security hardening for GitHub repository

- Removed personal file paths from documentation files (`terraform/DEPLOY-NOW.md`, `terraform/alerts-dynamodb.tf`) to sanitize for public GitHub upload.
- Enhanced `.gitignore` with `*.tfplan` pattern to prevent accidental Terraform plan file commits.
- Verified protection of sensitive files: AWS credentials (`.env`), Terraform state files (`*.tfstate*`, `terraform.tfstate.d/`), configuration values (`terraform.tfvars`), SSH keys (`*.pem`), and dependency directories (`node_modules/`).
- Prepared repository for safe public GitHub upload with comprehensive secrets protection.

## [v0.4] - 2025-09-21

### Honeypot log pipeline hardening

- Updated `honeypot_user_data.sh` so Suricata installs reliably, auto-discovers the primary NIC, and streams both `/var/log/suricata/eve.json` and `/var/log/honeypot-bootstrap.log` to CloudWatch log groups (`/honeypot/suricata` and `/honeypot/bootstrap`).
- Replaced the Firehose/S3 ingestion path with a Lambda + DynamoDB pipeline (`suricata_ingest` + `suricata_events`) to support low-latency dashboard feeds.
- Normalized Suricata ingest (flattened source/destination fields, severity, proto, summary) to power the API and dashboards.\r\n- Captured flow/tcp context (alerted flag, state, packet/byte counts, SYN/ACK/RST) for richer analytics and future Bedrock prompts.\r\n- Captured flow/tcp context (alerted flag, state, packet/byte counts, SYN/ACK/RST) so scans are easier to triage and prep for Bedrock summaries.\r\n- Added client-side dashboard filters (event type dropdown, source search, clear button) so scan events are easy to surface amid background noise.
- Added an HTTP API (API Gateway + Lambda) that returns raw Suricata items from DynamoDB for the upcoming dashboard.\r\n- Terraform now writes `frontend/.env` with the current API endpoint so the React app follows rebuilds automatically.
- Exposed CloudWatch bootstrap logs to simplify diagnosing user-data failures without needing privileged shell access.
- Verified the honeypot end-to-end after rebuild: Suricata service stays active and telemetry flows through CloudWatch and into DynamoDB, ready for the API layer.

- Implemented a placeholder AI assistant bubble in the frontend to preview eventual Bedrock integration while echoing recent events.\r\n- Added Bedrock-backed chat endpoint (`suricata_chat` Lambda + POST /chat) so the assistant can summarise real telemetry.
## [v0.3] - 2025-09-19

### Amplify bootstrapping and local validation

- Added `frontend/amplify.yml` so AWS Amplify runs npm install/build steps and publishes the Vite `dist/` output during console deployments.
- Extended `terraform.tfvars` with `amplify_repo` and `amplify_branch` placeholders to make wiring the frontend Git repo into Terraform-managed Amplify resources straightforward.

## [v0.2] - 2025-08-28

### SSM, key management, and security improvements

- Attached `AmazonSSMManagedInstanceCore` to the honeypot IAM role and added an SSM role/profile for the Kali instance so both EC2 instances can be accessed via AWS Systems Manager Session Manager (SSM).
- Added SSM agent installation and startup steps to the Kali `user_data` to make SSM sessions reliable across AMIs.
- Removed local `null_resource` local-exec steps that automatically moved generated private keys into `~/.ssh` to avoid placing sensitive key material on apply hosts.
- Kept optional `tls`/`aws_key_pair` and `local_file` resources so public keys can be uploaded and private keys can be written to specified local paths when explicitly desired, but `move_keys_to_ssh` behavior was removed.
- Reworked key-management guidance: recommend generating private keys outside Terraform or storing them in Secrets Manager/SSM as SecureString and fetching them local-only when needed; added notes on using SSM as the preferred access method for SaaS workloads.
- Added outputs for Kali (`kali_public_ip`, `kali_instance_id`) and retained honeypot outputs for easier access and testing.

### Miscellaneous

- Continued renaming and tagging standardization to `phantomwall` across files and scripts.
- Added `terraform.tfvars` example that demonstrates non-interactive runs and toggling key generation.

## [v0.1] - 2025-08-17

### Repo refactor & Honeypot MVP

- Renamed project identifiers and tags to `PhantomWall` / `phantomwall` across Terraform and docs.
- Added `honeypot_ec2.tf` and `honeypot_user_data.sh` to deploy a single EC2 honeypot running Suricata and shipping `eve.json` to CloudWatch Logs.
- Implemented subnet lookup by tag (`subnet_tag_key` / `subnet_tag_value`) so users can reference subnets by tag instead of raw IDs.
- Added optional TLS key generation and `aws_key_pair` upload when `create_key_pair=true` with safe local private key writing.
- Centralized provider config and required providers into `provider.tf` and re-organized resources (`security.tf`, `honeypot_ec2.tf`, `locals.tf`).
- Cleaned outputs to remove references to undeclared resources and added `terraform.tfvars.example`.
- Standardized `Name` tags to `${var.project_name}-<component}-${terraform.workspace}` pattern; added `random_name` variable for the middle component.

Note: provider-level resource `name` attributes were intentionally left conservative to avoid accidental replacements for already-deployed resources; tags are used for visible naming.








