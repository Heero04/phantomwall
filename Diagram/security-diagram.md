# PhantomWall — Security Architecture Diagram

## 🔒 Security Layers Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              INTERNET / THREAT ACTORS                                │
│                                                                                      │
│             🌐 Attackers   🤖 Bots   🕵️ Scanners   👾 Malware                      │
└──────────┬──────────────────────────────────┬────────────────────────────────────────┘
           │                                  │
           │ Malicious Traffic                │ API Requests
           ▼                                  ▼
┌──────────────────────────┐   ┌──────────────────────────────────────────────────────┐
│   LAYER 1: HONEYPOT      │   │   LAYER 1: EDGE SECURITY — AWS WAF                   │
│   TRAP SECURITY GROUPS   │   │                                                       │
│                          │   │   WAF Web ACL (8 Rules, Priority Order)               │
│   Profile-based SGs:     │   │   ┌───────────────────────────────────────────────┐   │
│                          │   │   │  P1  IP Blocklist     — Auto-blocked IPs      │   │
│   ┌────────────────────┐ │   │   │  P2  IP Allowlist     — Trusted bypass        │   │
│   │ 🔓 ssh             │ │   │   │  P10 Rate Limiting    — Per-IP throttle       │   │
│   │    Port 22         │ │   │   │  P20 AWS SQLi Rules   — SQL injection block   │   │
│   ├────────────────────┤ │   │   │  P30 AWS Common Rules — XSS, bad bots, etc.   │   │
│   │ 🔓 http            │ │   │   │  P40 Bad Inputs       — Known attack patterns │   │
│   │    Ports 80, 443   │ │   │   │  P50 Geo Blocking     — Country-level deny    │   │
│   ├────────────────────┤ │   │   │  P60 Bot Control      — Managed bot detection │   │
│   │ 🔓 telnet          │ │   │   └───────────────────────────────────────────────┘   │
│   │    Port 23         │ │   │                                                       │
│   ├────────────────────┤ │   │   Modes:                                              │
│   │ 🔓 multi (default) │ │   │   • Normal  — Blocklist + managed rules active        │
│   │    22, 23, 80,     │ │   │   • Lockdown — Block ALL except allowlist             │
│   │    443, 2222, 8080 │ │   │                                                       │
│   └────────────────────┘ │   │   Logging → CloudWatch (aws-waf-logs-phantomwall)     │
│                          │   └──────────────────────────────┬────────────────────────┘
│   ⚠️ Intentionally       │                                  │
│   permissive — these     │                                  │ Allowed requests only
│   are TRAPS              │                                  ▼
└──────────┬───────────────┘   ┌──────────────────────────────────────────────────────┐
           │                   │   LAYER 2: AUTHENTICATION — AWS COGNITO               │
           │                   │                                                       │
           │                   │   User Pool: phantomwall-cognito-users-dev            │
           │                   │                                                       │
           │                   │   ┌───────────────────────────────────────────────┐   │
           │                   │   │  Password Policy:                             │   │
           │                   │   │  • Min 12 characters                          │   │
           │                   │   │  • Uppercase + lowercase + numbers + symbols  │   │
           │                   │   │  • Temp passwords expire in 7 days            │   │
           │                   │   │                                               │   │
           │                   │   │  Authentication Flow:                         │   │
           │                   │   │  • Email-based sign-up with verification code │   │
           │                   │   │  • JWT tokens (access + ID + refresh)         │   │
           │                   │   │  • Token validity: 1hr access, 30d refresh    │   │
           │                   │   │                                               │   │
           │                   │   │  Account Recovery:                            │   │
           │                   │   │  • Email verification code                    │   │
           │                   │   └───────────────────────────────────────────────┘   │
           │                   │                                                       │
           │                   │   App Client → API Gateway Authorizer (JWT)           │
           │                   └──────────────────────────────┬────────────────────────┘
           │                                                  │
           │                                                  │ Authenticated + Authorized
           ▼                                                  ▼
┌──────────────────────────┐   ┌──────────────────────────────────────────────────────┐
│   LAYER 3: HONEYPOT      │   │   LAYER 3: API GATEWAY                                │
│   DETECTION ENGINE       │   │                                                       │
│                          │   │   CORS: Restricted to Amplify origin                  │
│   ┌────────────────────┐ │   │   Stage: prod (auto-deploy)                           │
│   │  Suricata IDS      │ │   │   Logging: CloudWatch request/response                │
│   │                    │ │   │                                                       │
│   │  • 49,000+ rules   │ │   │   Endpoints:                                          │
│   │  • ET Open ruleset │ │   │   ├── GET  /events         → Suricata API Lambda      │
│   │  • Auto-updating   │ │   │   ├── GET  /alerts         → Alert API Lambda         │
│   │  • eve.json output │ │   │   ├── POST /chat           → Chat Assistant Lambda    │
│   │  • Interface auto- │ │   │   ├── GET  /fleet/instances → Fleet Manager Lambda    │
│   │    detect (ens5)   │ │   │   ├── POST /fleet/action   → Fleet Manager Lambda     │
│   └────────┬───────────┘ │   │   ├── GET  /waf/status     → WAF API Lambda           │
│            │             │   │   ├── POST /waf/toggle      → WAF API Lambda           │
│            │ eve.json    │   │   ├── POST /waf/lockdown    → WAF API Lambda           │
│            ▼             │   │   └── GET  /s3-logs/query   → S3 Log Query Lambda     │
│   ┌────────────────────┐ │   └──────────────────────────────────────────────────────┘
│   │  CloudWatch Agent  │ │
│   │  → Per-instance    │ │
│   │    log group       │ │
│   │  /honeypot/        │ │
│   │  suricata/{id}     │ │
│   └────────┬───────────┘ │
│            │             │
└────────────┼─────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                       LAYER 4: IAM & LEAST PRIVILEGE                                 │
│                                                                                      │
│   Every component has its own scoped IAM role with minimal permissions:              │
│                                                                                      │
│   ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────────────┐ │
│   │ Lambda Roles        │  │ EC2 Roles            │  │ Service Roles               │ │
│   │                     │  │                      │  │                             │ │
│   │ • lambda_api        │  │ • honeypot_ec2       │  │ • amplify_console           │ │
│   │   → DynamoDB:Query  │  │   → logs:PutLogEvents│  │   → Amplify deploy only    │ │
│   │                     │  │   → logs:Create*     │  │                             │ │
│   │ • lambda_chat       │  │   → ssm:* (Session   │  │ • waf_api                  │ │
│   │   → DynamoDB:Query  │  │     Manager access)  │  │   → wafv2:Get/Update/List  │ │
│   │   → bedrock:Invoke  │  │                      │  │   → wafv2:UpdateIPSet      │ │
│   │                     │  │ • kali_ec2 (optional)│  │                             │ │
│   │ • lambda_ingest     │  │   → Testing only     │  │                             │ │
│   │   → DynamoDB:Write  │  │                      │  │                             │ │
│   │                     │  └─────────────────────-┘  └─────────────────────────────┘ │
│   │ • lambda_fleet      │                                                            │
│   │   → ec2:RunInstances│  ┌──────────────────────────────────────────────────────┐  │
│   │   → ec2:Terminate   │  │  IAM Access Analyzer                                │  │
│   │   → logs:Describe*  │  │  • Account-level scope                              │  │
│   │   → DynamoDB:Query  │  │  • Monitors all IAM permissions                     │  │
│   │                     │  │  • Flags overly permissive policies                 │  │
│   │ • alert_indexer     │  │  • Reports external access findings                 │  │
│   │   → DynamoDB:Write  │  └──────────────────────────────────────────────────────┘  │
│   │   → DynamoDB:Query  │                                                            │
│   └─────────────────────┘                                                            │
└─────────────────────────────────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                       LAYER 5: DATA SECURITY                                         │
│                                                                                      │
│   ┌───────────────────────────────┐  ┌────────────────────────────────────────────┐  │
│   │  DynamoDB                     │  │  S3                                        │  │
│   │                               │  │                                            │  │
│   │  • Encryption at rest (AES-   │  │  • Encryption at rest (SSE-S3)             │  │
│   │    256, AWS-managed keys)     │  │  • Private buckets (no public access)      │  │
│   │  • Pay-per-request billing    │  │  • Bootstrap scripts bucket                │  │
│   │  • TTL auto-cleanup (30 days) │  │  • Log archive bucket                     │  │
│   │  • Point-in-time recovery     │  │  • Versioning enabled                     │  │
│   │    available                  │  │                                            │  │
│   └───────────────────────────────┘  └────────────────────────────────────────────┘  │
│                                                                                      │
│   ┌───────────────────────────────┐  ┌────────────────────────────────────────────┐  │
│   │  CloudWatch Logs              │  │  Secrets / Keys                            │  │
│   │                               │  │                                            │  │
│   │  • 14-30 day retention        │  │  • SSH keys stored locally only            │  │
│   │  • Per-instance isolation     │  │  • No secrets in source control            │  │
│   │    /honeypot/suricata/{id}    │  │  • terraform.tfvars in .gitignore          │  │
│   │  • Lambda logs auto-created   │  │  • Cognito client secret managed by AWS   │  │
│   │  • Subscription filters for   │  │  • SSM Session Manager (no SSH needed)    │  │
│   │    pipeline routing           │  │                                            │  │
│   └───────────────────────────────┘  └────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                       LAYER 6: COST & OPERATIONAL SECURITY                           │
│                                                                                      │
│   ┌───────────────────────────────────────────────────────────────────────────────┐  │
│   │  AWS Budgets                                                                  │  │
│   │                                                                               │  │
│   │  • Monthly budget: $75 limit                                                  │  │
│   │  • Alert at $30  (normal usage threshold)                                     │  │
│   │  • Alert at $50  (investigation needed)                                       │  │
│   │  • Alert at $75  (critical — consider shutdown)                               │  │
│   │  • Forecasted alert at $75                                                    │  │
│   │  • Scoped to: EC2, Lambda, DynamoDB, S3, API GW, CloudWatch, Amplify         │  │
│   │  • Email notifications to configured admin                                    │  │
│   └───────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                      │
│   ┌───────────────────────────────────────────────────────────────────────────────┐  │
│   │  Infrastructure as Code (Terraform)                                           │  │
│   │                                                                               │  │
│   │  • All resources version-controlled                                           │  │
│   │  • State file tracks drift                                                    │  │
│   │  • Multi-environment support (dev/staging/prod)                               │  │
│   │  • Reproducible, auditable deployments                                        │  │
│   └───────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔁 Security Data Flow

```
                    ┌──────────────┐
                    │   Attacker   │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
         Port 22      Port 80     Port 443 ...
              │            │            │
              └────────────┼────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │   Trap SG       │  ← Profile-based (ssh/http/telnet/multi)
                  │   (allows in)   │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │  Suricata IDS   │  ← 49k+ detection rules
                  │  (eve.json)     │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │  CloudWatch     │  ← Per-instance: /honeypot/suricata/{id}
                  │  Log Group      │
                  └───┬─────────┬───┘
                      │         │
            ┌─────────┘         └──────────┐
            ▼                              ▼
   ┌─────────────────┐           ┌─────────────────┐
   │ Suricata Ingest │           │  Alert Indexer   │
   │    Lambda       │           │     Lambda       │
   └────────┬────────┘           └────────┬────────┘
            │                             │
            ▼                             ▼
   ┌─────────────────┐           ┌─────────────────┐
   │  Events Table   │           │  Alerts Table    │
   │  (DynamoDB)     │           │  (DynamoDB)      │
   └────────┬────────┘           │  + GSIs for fast │
            │                    │    IP/sig lookup  │
            │                    └────────┬─────────┘
            │                             │
            └──────────┬──────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   Dashboard     │  ← Alerts, analytics, threat intel
              │   (React App)   │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  WAF Blocklist  │  ← Feed blocked IPs back to WAF
              │  (auto-block)   │     to protect the API itself
              └─────────────────┘
```

---

## 🛡️ Security Boundaries Summary

| Layer | Component | Purpose |
|-------|-----------|---------|
| **Edge** | AWS WAF | Rate limiting, IP blocklist, managed rules (SQLi, XSS), geo-blocking |
| **Auth** | Cognito | JWT authentication, password policy, email verification |
| **Network** | Trap SGs | Profile-based port exposure (ssh/http/telnet/multi) |
| **Detection** | Suricata IDS | 49,000+ rules, ET Open ruleset, real-time eve.json |
| **Isolation** | Per-Instance Logs | Each honeypot writes to its own CloudWatch log group |
| **Access** | IAM Least Privilege | Every Lambda/EC2/service has scoped role, Access Analyzer active |
| **Data** | Encryption at Rest | DynamoDB (AES-256), S3 (SSE-S3), CloudWatch encrypted |
| **Secrets** | No Hardcoded Keys | SSM Session Manager, tfvars gitignored, Cognito-managed secrets |
| **Cost** | Budget Alerts | $30/$50/$75 tiered alerts, forecasted alerts, scoped to platform services |
| **Infra** | Terraform IaC | Version-controlled, auditable, drift detection, multi-env |
