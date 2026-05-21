# PhantomWall Architecture (Repo-Accurate)

This document reflects the architecture currently represented in this repository's Terraform and Lambda source code.

## Core Mission

PhantomWall deploys intentionally exposed honeypot infrastructure, captures and enriches Suricata telemetry, stores events for analysis, and presents both real-time and historical threat intelligence in a React dashboard.

## High-Level Architecture

1. Attack traffic reaches honeypot EC2 instances running Suricata.
2. Suricata writes `eve.json` events on the instance.
3. CloudWatch Agent ships logs to CloudWatch Logs (`/honeypot/suricata` and per-instance groups under `/honeypot/suricata/*`).
4. CloudWatch subscription filters invoke:
   - `suricata_ingest` Lambda (writes normalized events to DynamoDB, optionally archives to S3)
   - `alert_indexer` Lambda (indexes alert events into a dedicated alerts table)
5. DynamoDB Streams on the events table trigger:
   - `ws_broadcaster` Lambda (fan-out to WebSocket clients)
   - `waf_autoblock` Lambda (when WAF is enabled)
6. React frontend (Amplify-hosted pattern) uses HTTP API routes for dashboards and management plus WebSocket for live traffic feed.

## ASCII Architecture Diagram

```text
                              PHANTOMWALL (Repo-Accurate)
                        Cloud-Native Honeypot Detection Platform

    Internet Attackers
           |
           v
   +-----------------------+
   | Honeypot EC2          |
   | (t3a.small default)   |
   | Suricata -> eve.json  |
   +-----------+-----------+
               |
               | CloudWatch Agent
               v
   +-------------------------------+
   | CloudWatch Logs               |
   | /honeypot/suricata*           |
   +-----------+-------------------+
               |
      +--------+--------+
      |                 |
      v                 v
+----------------+  +----------------+
| suricata_ingest|  | alert_indexer  |
| Lambda         |  | Lambda         |
| normalize/save |  | alert indexing |
+-------+--------+  +--------+-------+
        |                    |
        v                    v
+---------------------------+   +-------------------------------+
| DynamoDB Events Table     |   | DynamoDB Alerts Table         |
| {project}-dynamodb-events |   | phantomwall-alerts-{env}      |
+-------------+-------------+   +-------------------------------+
              |
              | DynamoDB Streams
      +-------+----------------------+
      |                              |
      v                              v
+-------------------+        +-------------------+
| ws_broadcaster    |        | waf_autoblock     |
| Lambda            |        | Lambda (optional) |
+---------+---------+        +-------------------+
          |
          v
+---------------------------+        +---------------------------+
| API Gateway (WebSocket)   |------->| React Frontend (Amplify) |
| $connect/$disconnect/..   |  WSS   | live traffic feed         |
+---------------------------+        +---------------------------+
                                              ^
                                              |
                                   HTTPS (API Gateway HTTP API)
                                              |
      +------------------------+--------------+---------------------------+
      |                        |                                          |
      v                        v                                          v
+-------------+        +------------------+                    +------------------+
| suricata_api |       | fleet_manager +  |                    | suricata_chat +  |
| /events      |       | honeypot_prov.   |                    | s3_log_query      |
| /metrics     |       | /fleet/* routes  |                    | /chat, /logs      |
+-------------+        +------------------+                    +------------------+
```

## Infrastructure Components

## Honeypot Layer

- EC2 honeypot instance (default `t3a.small`, Ubuntu 22.04 lookup)
- Suricata IDS + CloudWatch Agent bootstrap scripts
- Base honeypot security group and trap-profile security groups:
  - `ssh` (22)
  - `http` (80, 443)
  - `telnet` (23)
  - `multi` (22, 23, 80, 443, 2222, 8080)

## Data and Processing Layer

- DynamoDB events table: `${project_name}-dynamodb-events-${environment}`
  - PK: `event_date`
  - SK: `event_id`
- DynamoDB alerts table: `phantomwall-alerts-${environment}` (feature-flagged)
  - PK/SK model with GSIs for source IP and signature lookup
  - TTL enabled
- Lambda functions:
  - `suricata_ingest` (CloudWatch logs -> DynamoDB events + S3 backup)
  - `alert_indexer` (CloudWatch logs -> alerts table)
  - `suricata_api` (events/metrics API)
  - `fleet_manager` (fleet status + start/stop/reboot actions)
  - `honeypot_provisioner` (deploy/destroy honeypot instances)
  - `suricata_chat` (Bedrock-powered security Q&A)
  - `s3_log_query` (Athena-backed log querying)
  - `waf_api` (WAF management endpoints, if enabled)
  - `waf_autoblock` (stream-based WAF blocklist updates, if enabled)
  - `ws_handler` (WebSocket connect/disconnect/default routes)
  - `ws_broadcaster` (DynamoDB stream fan-out to WebSocket clients)

## API Layer

- HTTP API (API Gateway v2) routes currently defined:
  - `GET /events`
  - `GET /metrics`
  - `POST /chat`
  - `GET /fleet/instances`
  - `POST /fleet/action`
  - `POST /fleet/deploy`
  - `POST /fleet/destroy`
  - `GET /logs`
  - `GET /waf/status` (when enabled)
  - `POST /waf/toggle-rule` (when enabled)
  - `POST /waf/lockdown` (when enabled)
  - `GET /waf/blocked-ips` (when enabled)
  - `POST /waf/block-ip` (when enabled)
  - `POST /waf/unblock-ip` (when enabled)
- WebSocket API routes:
  - `$connect`
  - `$disconnect`
  - `$default`

## Frontend Layer

- React frontend in `frontend/`
- Pulls data from HTTP API routes (events, fleet, chat, WAF, logs)
- Receives live traffic entries from WebSocket endpoint (`wss://.../prod`)

## Security and Identity

- Cognito resources are provisioned (User Pool, Client, Identity Pool, roles).
- API Gateway route-level Cognito authorizer enforcement is not yet wired in current Terraform.
- WAF resources and automation are provisioned when `waf_enabled = true`.
- Note: Current Terraform comments explicitly state WAF Web ACL association is not supported for the current HTTP API setup, so full in-path API protection requires a different attachment strategy (for example REST API or CloudFront fronting).

## AI/Analytics

- Bedrock chat Lambda is present and wired to `POST /chat`.
- Default model variable is currently set to `anthropic.claude-3-haiku-20240307-v1:0`.
- S3 + Athena pipeline supports deeper log exploration via `GET /logs`.

## Runtime and Version Notes

- Most Lambda runtimes are `python3.11`.
- `alert_indexer` is currently `python3.9`.
- No `python3.12` runtime definitions were found in active Terraform Lambda resources.

## Important Corrections vs Older Descriptions

- Do not describe the honeypot as `t3a.micro` Spot with Elastic IP as a default; current Terraform defaults to `t3a.small` and does not define Spot or Elastic IP in the main honeypot resource.
- Do not claim API routes are `/alerts`, `/stats`, `/honeypots` as primary deployed routes; current route set is listed above.
- Do not claim Cognito authorizer is enforced on all API routes yet.
- Do not claim WAF is fully attached inline to HTTP API in current state.
- Do not claim all Lambdas are Python 3.12.

## Repo Structure Snapshot

Main architecture-relevant directories/files:

- `frontend/` - React dashboard
- `lambda/` - Lambda handlers (`suricata_ingest`, `fleet_manager`, `chat_assistant`, `ws_*`, etc.)
- `api_gateway.tf`, `websocket.tf`, `logging_lambda.tf`, `fleet_lambda.tf`, `honeypot_provisioner_lambda.tf`, `bedrock_chat.tf`, `alerts-dynamodb.tf`, `waf.tf`, `waf_lambda.tf`, `athena_logs.tf`
- `honeypot_ec2.tf`, `honeypot_trap_sgs.tf`

---

If architecture changes are made later, update this file together with Terraform changes so docs stay aligned with deployed behavior.
