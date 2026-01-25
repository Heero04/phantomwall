# PhantomWall Terminal Proxy Server

WebSocket proxy server that bridges React terminal frontend to AWS SSM sessions.

## Architecture

```
React Terminal (xterm.js) 
    ↕ WebSocket
Terminal Proxy Server (Node.js)
    ↕ AWS SDK
AWS Systems Manager (SSM)
    ↕ Encrypted Channel  
EC2 Instances (Honeypot/Kali)
```

## Features

- **WebSocket Server** - Real-time bidirectional communication
- **AWS SSM Integration** - Secure shell sessions without SSH keys
- **Session Management** - Handle multiple concurrent sessions
- **Health Monitoring** - Status endpoints and debugging
- **CORS Support** - Allow connections from React frontend

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your AWS settings
   ```

3. **Start server:**
   ```bash
   npm run dev
   ```

4. **Test connection:**
   ```bash
   npm run test
   ```

## API Endpoints

### WebSocket: `ws://localhost:8080/terminal`

**Commands:**
- `{"type": "connect", "instanceId": "i-1234567890abcdef0"}` - Connect to instance
- `{"type": "disconnect"}` - Disconnect from current session
- `{"type": "list-instances"}` - Get available instances

**Responses:**
- `{"type": "system", "message": "..."}` - System messages
- `{"type": "connected", "instanceId": "..."}` - Connection established
- `{"type": "error", "message": "..."}` - Error messages

### HTTP Endpoints

- `GET /health` - Server health check
- `GET /status` - Active sessions and server stats

## Configuration

Environment variables in `.env`:

- `PORT` - Server port (default: 8080)
- `AWS_REGION` - AWS region for SSM (default: us-east-1)
- `ALLOWED_ORIGINS` - CORS allowed origins
- `DEBUG` - Enable debug logging
- `SSM_TIMEOUT` - Session timeout in seconds
- `MAX_SESSIONS` - Maximum concurrent sessions

## AWS Setup

Ensure AWS credentials are configured via:
- AWS CLI (`aws configure`)
- IAM roles (for EC2/Lambda deployment)
- Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)

Required IAM permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:StartSession",
        "ssm:TerminateSession",
        "ec2:DescribeInstances"
      ],
      "Resource": "*"
    }
  ]
}
```

## Testing

The server includes comprehensive testing:

1. **Health Check:**
   ```bash
   curl http://localhost:8080/health
   ```

2. **WebSocket Test:**
   ```bash
   npm run test
   ```

3. **Manual Testing:**
   - Use browser console or WebSocket client
   - Connect React terminal with WebSocket URL

## Development

- **Hot Reload:** `npm run dev` (uses nodemon)
- **Production:** `npm start`
- **Debug Mode:** Set `DEBUG=true` in `.env`

## Troubleshooting

**Common Issues:**

1. **"Connection refused"**
   - Check server is running on correct port
   - Verify CORS origins include your frontend URL

2. **"AWS credentials not found"**
   - Run `aws configure` or set environment variables
   - Check IAM permissions for SSM access

3. **"Instance not found"**
   - Verify EC2 instances have SSM agent installed
   - Check instance IDs are correct
   - Ensure instances are running

## Security

- WebSocket connections should use WSS in production
- Implement authentication/authorization
- Validate all input and commands
- Use AWS IAM for fine-grained permissions
- Monitor and log all sessions