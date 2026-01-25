# Honeypot MVP (v0.1)

This README lets you spin up a **single EC2 honeypot** that logs attacks with Suricata and ships events to CloudWatch Logs. No SaaS layers yet—just the **honey-first** core you can demo and extend.

---

## Goals

- Launch one EC2 instance (public) that attracts scans on SSH/HTTP.
- Run **Suricata** and ship `eve.json` to **CloudWatch Logs**.
- Verify attacks via **nmap** and see events appear.
- Keep costs low and set retention/alarms.

---

## Prereqs

- AWS account with permissions to create EC2, IAM, CloudWatch resources.
- A VPC with a **public subnet** and an **Internet Gateway**.
- (Optional) A key pair to SSH if you want to inspect the box.

---

## 1) Security Group (attract scans)

Allow inbound 22 and 80 from anywhere (you can add more later):

- **Inbound**: 22/tcp from `0.0.0.0/0`
- **Inbound**: 80/tcp from `0.0.0.0/0`
- **Outbound**: All

> You can tighten later with allowlists once auto-blocking exists. For MVP we want traffic.

---

## 2) IAM Role (instance profile)

Attach a minimal role so the instance can push logs to CloudWatch.

**Policy JSON (inline or managed):**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

Create an **IAM role** for EC2 with this policy attached, then create an **instance profile** and attach it to the instance.

---

## 3) Launch EC2 (Amazon Linux 2)

- **Instance type**: `t3a.small` (or `t4g.small` if you prefer ARM + compatible AMI)
- **AMI**: Amazon Linux 2 (latest in your region)
- **Subnet**: Public subnet
- **Auto-assign public IP**: Enabled
- **Security Group**: The one above
- **IAM instance profile**: Attach the role you created
- **Tags**: `Project=Honeysaasy`, `Env=dev`

> Cost guardrail: run **1 instance** only; stop/terminate when not testing.

---

## 4) Install Suricata & CloudWatch Agent

SSH into the instance (if you created a key pair) and run:

```bash
# Update
sudo yum update -y

# Enable EPEL and install Suricata
sudo amazon-linux-extras enable epel
sudo yum install -y suricata

# Enable & start Suricata
sudo systemctl enable suricata
sudo systemctl start suricata

# Install CloudWatch Agent
sudo yum install -y amazon-cloudwatch-agent
```

**Create CloudWatch Agent config** at `/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json`:

```json
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/suricata/eve.json",
            "log_group_name": "/honeypot/suricata",
            "log_stream_name": "{instance_id}"
          }
        ]
      }
    }
  }
}
```

**Start the agent:**

```bash
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json \
  -s
```

**Verify:**

```bash
sudo systemctl status suricata --no-pager
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -m ec2 -a status
```

> In CloudWatch → Log groups, you should see `/honeypot/suricata` shortly after.

---

## 5) Generate Test Traffic

From another machine you control:

```bash
nmap -Pn --top-ports 100 <EC2_PUBLIC_IP>
```

Then open **CloudWatch Logs** → `/honeypot/suricata` → the stream named with your instance ID. You should see JSON events including `src_ip`, `dest_port`, and timestamps.

---

## 6) Retention & Alarms (cost + health)

- Set log group **retention** to **7 days** (can increase later by plan).
- Create **CloudWatch Alarms**:
  - EC2 **StatusCheckFailed** > 0 for 5 minutes → Alarm
  - **Metric filter** for log events; if **no logs** in 10 minutes → Alarm (optional)
- (Optional) Create a simple **AWS Budget** alert for monthly spend.

---

## 7) Teardown

When you’re done testing:

- **Terminate** the EC2 instance
- Delete the **log group** `/honeypot/suricata` (to stop ongoing charges)
- Remove the **IAM instance profile/role** if not reusing

---

## 8) What’s Next (when this works)

- **EventBridge → API Gateway**: create a subscription from the log group to EventBridge, then POST batches to your ingest API (SaaS step).
- **DynamoDB**: store normalized events keyed by day and tenant.
- **Auto-blocking (Pro)**: Lambda assuming a role to add temporary SG deny rules.
- **Enrichment**: GeoIP/ASN lookups before persisting.

> Keep MVP strict: prove “**click → honeypot → see attacks**” first. Everything else comes after.

---

## FAQ

**Q: Which ports should I open?**  Start with 22 and 80. Add 443/3389/445 later to attract diverse probes.

**Q: Can I run this without SSHing?**  Yes—bake the steps into UserData or a lightweight AMI later.

**Q: Is this safe?**  It’s a decoy box. Keep it isolated, no sensitive creds, least-privilege IAM, and monitor costs.

