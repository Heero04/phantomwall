# PhantomWall Cloud Threat - Architecture Diagram

## System Architecture Overview

```mermaid
graph TB
    subgraph "User Layer"
        User[👤 End User]
        Browser[🌐 Web Browser]
    end

    subgraph "Frontend - AWS Amplify"
        Amplify[AWS Amplify App<br/>React + Vite]
        Dashboard[Dashboard UI<br/>Alerts, Charts, Analytics]
        Chat[AI Chat Assistant UI]
    end

    subgraph "API Layer - API Gateway"
        APIGW[API Gateway HTTP API<br/>CORS Enabled]
        APIStage[Stage: prod<br/>Auto Deploy]
    end

    subgraph "Compute Layer - Lambda Functions"
        LambdaAPI[Suricata API Lambda<br/>Python 3.11<br/>Query Events]
        LambdaChat[Chat Assistant Lambda<br/>Python 3.11<br/>AI Integration]
        LambdaIngest[Suricata Ingest Lambda<br/>Python 3.11<br/>Event Processing]
        AlertIndexer[Alert Indexer Lambda<br/>Python 3.11<br/>Alert Processing]
    end

    subgraph "AI/ML Services"
        Bedrock[AWS Bedrock<br/>LLM Model<br/>Threat Analysis]
    end

    subgraph "Data Layer - DynamoDB"
        DynamoEvents[Suricata Events Table<br/>PK: event_date<br/>SK: event_id]
        DynamoAlerts[PhantomWall Alerts Table<br/>PK/SK Design<br/>GSI: src_ip, signature_id<br/>TTL: 30 days]
    end

    subgraph "Logging & Monitoring"
        CWLogs[CloudWatch Logs]
        CWLogsSuricata[Log Group:<br/>/honeypot/suricata]
        CWLogsBootstrap[Log Group:<br/>/honeypot/bootstrap]
        CWAgent[CloudWatch Agent]
    end

    subgraph "Honeypot Infrastructure"
        EC2Honeypot[EC2 Honeypot Instance<br/>Ubuntu 22.04 LTS<br/>t3a.medium]
        Suricata[Suricata IDS<br/>Full Ruleset<br/>eve.json Output]
        SG[Security Group<br/>SSH: 22<br/>HTTP: 80<br/>Intentionally Permissive]
    end

    subgraph "Storage"
        S3Scripts[S3 Bucket<br/>Honeypot Scripts<br/>Bootstrap Files]
    end

    subgraph "Security & Access"
        IAMAmplify[IAM Role<br/>Amplify Console]
        IAMLambda[IAM Roles<br/>Lambda Execution]
        IAMEC2[IAM Role<br/>EC2 CloudWatch Access]
        AccessAnalyzer[IAM Access Analyzer<br/>Security Monitoring]
    end

    subgraph "Optional Tools"
        KaliEC2[EC2 Kali Linux<br/>Penetration Testing<br/>Optional]
    end

    %% User Flow
    User --> Browser
    Browser --> Amplify
    Amplify --> Dashboard
    Amplify --> Chat

    %% API Communication
    Dashboard --> APIGW
    Chat --> APIGW
    APIGW --> APIStage
    APIStage --> LambdaAPI
    APIStage --> LambdaChat

    %% Lambda to Data
    LambdaAPI --> DynamoEvents
    LambdaChat --> DynamoEvents
    LambdaChat --> Bedrock
    LambdaIngest --> DynamoEvents
    AlertIndexer --> DynamoAlerts

    %% Honeypot Data Flow
    EC2Honeypot --> Suricata
    Suricata --> CWAgent
    CWAgent --> CWLogsSuricata
    CWAgent --> CWLogsBootstrap
    CWLogsSuricata --> LambdaIngest
    S3Scripts --> EC2Honeypot

    %% Logging
    LambdaAPI --> CWLogs
    LambdaChat --> CWLogs
    LambdaIngest --> CWLogs
    AlertIndexer --> CWLogs
    APIGW --> CWLogs

    %% Security
    SG --> EC2Honeypot
    IAMAmplify --> Amplify
    IAMLambda --> LambdaAPI
    IAMLambda --> LambdaChat
    IAMLambda --> LambdaIngest
    IAMLambda --> AlertIndexer
    IAMEC2 --> EC2Honeypot
    AccessAnalyzer -.-> IAMAmplify
    AccessAnalyzer -.-> IAMLambda
    AccessAnalyzer -.-> IAMEC2

    %% Optional
    KaliEC2 -.-> EC2Honeypot

    %% Styling
    classDef frontend fill:#FF6B6B,stroke:#C92A2A,color:#fff
    classDef api fill:#4ECDC4,stroke:#0A7E76,color:#fff
    classDef compute fill:#95E1D3,stroke:#38A89D,color:#000
    classDef data fill:#F9CA24,stroke:#F79F1F,color:#000
    classDef security fill:#A55EEA,stroke:#5F27CD,color:#fff
    classDef honeypot fill:#FD79A8,stroke:#E84393,color:#fff
    classDef logs fill:#74B9FF,stroke:#0984E3,color:#000
    classDef ai fill:#6C5CE7,stroke:#341F97,color:#fff

    class Amplify,Dashboard,Chat frontend
    class APIGW,APIStage api
    class LambdaAPI,LambdaChat,LambdaIngest,AlertIndexer compute
    class DynamoEvents,DynamoAlerts data
    class IAMAmplify,IAMLambda,IAMEC2,AccessAnalyzer,SG security
    class EC2Honeypot,Suricata,KaliEC2 honeypot
    class CWLogs,CWLogsSuricata,CWLogsBootstrap,CWAgent logs
    class Bedrock ai
```

## Data Flow Diagram

```mermaid
sequenceDiagram
    participant Attacker as 🎯 Attacker
    participant Honeypot as 🍯 Honeypot EC2
    participant Suricata as 🔍 Suricata IDS
    participant CW as ☁️ CloudWatch
    participant Lambda as ⚡ Lambda Ingest
    participant DDB as 💾 DynamoDB
    participant API as 🌐 API Gateway
    participant Frontend as 🖥️ Dashboard
    participant User as 👤 User
    participant AI as 🤖 Bedrock AI

    %% Attack Detection Flow
    Attacker->>Honeypot: Scan/Attack (Port 22, 80)
    Honeypot->>Suricata: Network Traffic
    Suricata->>Suricata: Process with Rules
    Suricata->>CW: Write eve.json via Agent
    CW->>Lambda: Trigger on Log Events
    Lambda->>Lambda: Parse & Transform
    Lambda->>DDB: Write Event Records
    
    %% User Query Flow
    User->>Frontend: View Dashboard
    Frontend->>API: GET /events
    API->>Lambda: Invoke Suricata API
    Lambda->>DDB: Query Events
    DDB-->>Lambda: Return Results
    Lambda-->>API: Format Response
    API-->>Frontend: JSON Data
    Frontend-->>User: Display Charts & Alerts
    
    %% AI Assistant Flow
    User->>Frontend: Ask AI Question
    Frontend->>API: POST /chat
    API->>Lambda: Invoke Chat Lambda
    Lambda->>DDB: Query Context
    DDB-->>Lambda: Event Data
    Lambda->>AI: InvokeModel with Context
    AI-->>Lambda: AI Response
    Lambda-->>API: Formatted Answer
    API-->>Frontend: AI Analysis
    Frontend-->>User: Display Insights
```

## Component Details

### Frontend Layer
- **Technology**: React + Vite
- **Hosting**: AWS Amplify
- **Features**: 
  - Real-time threat dashboard
  - Interactive charts (Attack Timeline, Security Charts)
  - Alert management with filtering
  - AI-powered chat assistant
  - Responsive data tables

### API Layer
- **Type**: API Gateway HTTP API
- **Protocol**: REST over HTTPS
- **CORS**: Enabled for web access
- **Endpoints**:
  - `/events` - Query security events
  - `/chat` - AI assistant interaction
  - `/alerts` - Alert management

### Compute Layer
- **Runtime**: Python 3.11
- **Functions**:
  1. **Suricata Ingest** - Processes CloudWatch logs → DynamoDB
  2. **Suricata API** - Queries events for dashboard
  3. **Chat Assistant** - AI-powered threat analysis
  4. **Alert Indexer** - Fast alert processing & indexing

### Data Layer
- **Suricata Events Table**:
  - Partition Key: event_date
  - Sort Key: event_id
  - Billing: Pay-per-request
  
- **Alerts Table**:
  - Design: PK/SK pattern
  - GSI: src_ip-index, signature-index
  - TTL: 30-day automatic expiration

### Honeypot Infrastructure
- **Instance**: EC2 Ubuntu 22.04 LTS (t3a.medium)
- **IDS**: Suricata with full ruleset
- **Exposure**: Intentionally permissive (SSH, HTTP)
- **Logging**: CloudWatch Agent → eve.json streaming

### Security Features
- IAM roles with least-privilege access
- IAM Access Analyzer for monitoring
- CloudWatch Logs encryption
- Security groups with controlled ingress
- Automatic alert TTL (30 days)

## Infrastructure as Code
- **Tool**: Terraform
- **Workspaces**: dev, prod
- **State Management**: Remote state support
- **Modular Design**: Separate .tf files per service

## Cost Optimization
- Pay-per-request DynamoDB billing
- Lambda with right-sized memory/timeout
- CloudWatch log retention limits (14-30 days)
- Auto-scaling with Amplify
- t3a instances for cost savings

## Monitoring & Observability
- Centralized CloudWatch Logs
- Lambda execution metrics
- API Gateway access logs
- DynamoDB performance metrics
- Bootstrap & runtime logging separation

