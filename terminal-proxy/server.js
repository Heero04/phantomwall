import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { SSMClient, StartSessionCommand, TerminateSessionCommand } from '@aws-sdk/client-ssm';
import { EC2Client, DescribeInstancesCommand } from '@aws-sdk/client-ec2';
import { spawn } from 'child_process';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 8080;
const DEBUG = process.env.DEBUG === 'true';

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5174'];
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());

// Initialize AWS clients
const ssmClient = new SSMClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

const ec2Client = new EC2Client({
  region: process.env.AWS_REGION || 'us-east-1'
});

// Store active sessions
const activeSessions = new Map();

// WebSocket Server
const wss = new WebSocketServer({ 
  server,
  path: '/terminal'
});

// Debug logging function
const debugLog = (message, data = null) => {
  if (DEBUG) {
    console.log(`[DEBUG ${new Date().toISOString()}] ${message}`);
    if (data) console.log(data);
  }
};

// WebSocket connection handler
wss.on('connection', (ws, request) => {
  const sessionId = generateSessionId();
  debugLog(`New WebSocket connection: ${sessionId}`, { 
    ip: request.socket.remoteAddress,
    userAgent: request.headers['user-agent']
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'system',
    message: '🔗 Connected to PhantomWall Terminal Proxy',
    sessionId
  }));

  // Handle incoming messages
  ws.on('message', async (data) => {
    try {
      debugLog(`Received message from ${sessionId}`, data.toString());
      
      // Check if it's a JSON command or raw terminal data
      let message;
      try {
        message = JSON.parse(data);
      } catch {
        // Raw terminal input - forward to SSM session if active
        const session = activeSessions.get(sessionId);
        if (session && session.ssmSession) {
          // TODO: Send to SSM session
          debugLog(`Forwarding raw input to SSM session: ${data.toString()}`);
        } else {
          // Echo back for demo mode
          ws.send(data.toString());
        }
        return;
      }

      // Handle JSON commands
      await handleCommand(ws, sessionId, message);

    } catch (error) {
      debugLog(`Error handling message from ${sessionId}:`, error);
      ws.send(JSON.stringify({
        type: 'error',
        message: `Error: ${error.message}`
      }));
    }
  });

  // Handle connection close
  ws.on('close', () => {
    debugLog(`WebSocket connection closed: ${sessionId}`);
    cleanupSession(sessionId);
  });

  // Handle errors
  ws.on('error', (error) => {
    debugLog(`WebSocket error for ${sessionId}:`, error);
    cleanupSession(sessionId);
  });

  // Store connection
  activeSessions.set(sessionId, { 
    ws, 
    createdAt: new Date(),
    ssmSession: null 
  });
});

// Handle different types of commands
async function handleCommand(ws, sessionId, command) {
  debugLog(`Handling command for ${sessionId}:`, command);

  switch (command.type) {
    case 'connect':
      await handleConnect(ws, sessionId, command);
      break;
    
    case 'disconnect':
      await handleDisconnect(ws, sessionId);
      break;
    
    case 'input':
      await handleInput(ws, sessionId, command);
      break;
    
    case 'list-instances':
      await handleListInstances(ws, sessionId);
      break;
    
    default:
      ws.send(JSON.stringify({
        type: 'error',
        message: `Unknown command type: ${command.type}`
      }));
  }
}

// Handle SSM connection request
async function handleConnect(ws, sessionId, command) {
  const { instanceId, documentName = 'SSM-SessionManagerRunShell' } = command;
  
  if (!instanceId) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Instance ID is required for connection'
    }));
    return;
  }

  try {
    debugLog(`Starting SSM session for instance: ${instanceId}`);
    
    ws.send(JSON.stringify({
      type: 'system',
      message: `🔄 Connecting to instance ${instanceId}...`
    }));

    // Validate instance exists and is running
    const instanceInfo = await validateInstance(instanceId);
    if (!instanceInfo.isValid) {
      ws.send(JSON.stringify({
        type: 'error',
        message: `Instance validation failed: ${instanceInfo.error}`
      }));
      return;
    }

    // Start SSM session using AWS CLI with proper terminal settings
    const ssmProcess = spawn('aws', [
      'ssm',
      'start-session',
      '--target', instanceId,
      '--region', process.env.AWS_REGION || 'us-east-1'
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        LINES: '24',
        COLUMNS: '80'
      },
      shell: false
    });

    // Store session info
    const session = activeSessions.get(sessionId);
    if (session) {
      session.ssmSession = {
        instanceId,
        process: ssmProcess,
        isConnected: false
      };
    }

    // Send connected status after a short delay to allow SSM to initialize
    setTimeout(() => {
      if (session && session.ssmSession && !session.ssmSession.isConnected) {
        session.ssmSession.isConnected = true;
        ws.send(JSON.stringify({
          type: 'connected',
          message: `✅ Connected to ${instanceId}`,
          instanceId
        }));
        debugLog(`SSM session marked as connected for ${instanceId}`);
        
        // Send initial newline to trigger prompt
        setTimeout(() => {
          if (session.ssmSession && session.ssmSession.process) {
            session.ssmSession.process.stdin.write('\n');
          }
        }, 1000);
      }
    }, 2000);

    // Handle SSM process stdout (data from EC2 instance)
    ssmProcess.stdout.on('data', (data) => {
      const output = data.toString();
      debugLog(`SSM stdout: ${output}`);
      
      // Send terminal data to client
      ws.send(JSON.stringify({
        type: 'data',
        data: output
      }));
    });

    // Handle SSM process stderr (errors)
    ssmProcess.stderr.on('data', (data) => {
      const errorMsg = data.toString();
      debugLog(`SSM stderr: ${errorMsg}`);
      
      // Also send stderr to client for debugging
      ws.send(JSON.stringify({
        type: 'data',
        data: errorMsg
      }));
      
      if (errorMsg.includes('TargetNotConnected')) {
        ws.send(JSON.stringify({
          type: 'error',
          message: `❌ Instance ${instanceId} is not reachable via SSM. Check SSM agent status.`
        }));
      } else if (errorMsg.includes('InvalidInstanceId')) {
        ws.send(JSON.stringify({
          type: 'error',
          message: `❌ Instance ${instanceId} not found.`
        }));
      } else {
        ws.send(JSON.stringify({
          type: 'error',
          message: `SSM Error: ${errorMsg}`
        }));
      }
    });

    // Handle SSM process close
    ssmProcess.on('close', (code) => {
      debugLog(`SSM process closed with code: ${code}`);
      ws.send(JSON.stringify({
        type: 'disconnected',
        message: `🔌 SSM session ended (code: ${code})`
      }));
      
      // Clean up session
      if (session && session.ssmSession) {
        session.ssmSession = null;
      }
    });

    // Handle SSM process error
    ssmProcess.on('error', (error) => {
      debugLog(`SSM process error:`, error);
      ws.send(JSON.stringify({
        type: 'error',
        message: `Failed to start SSM session: ${error.message}`
      }));
    });

    // Forward WebSocket input to SSM session
    const originalOnData = ws.onData;
    ws.onData = (data) => {
      if (session && session.ssmSession && session.ssmSession.process) {
        debugLog(`Forwarding input to SSM: ${data.toString()}`);
        session.ssmSession.process.stdin.write(data);
      }
    };

  } catch (error) {
    debugLog(`SSM connection error:`, error);
    
    ws.send(JSON.stringify({
      type: 'error',
      message: `Connection failed: ${error.message}`
    }));
  }
}

// Handle disconnect request
async function handleDisconnect(ws, sessionId) {
  debugLog(`Disconnecting session: ${sessionId}`);
  
  const session = activeSessions.get(sessionId);
  if (session?.ssmSession?.process) {
    debugLog(`Terminating SSM process for session: ${sessionId}`);
    
    // Kill the SSM process
    session.ssmSession.process.kill('SIGTERM');
    session.ssmSession = null;
  }

  ws.send(JSON.stringify({
    type: 'disconnected',
    message: '🔌 Disconnected from instance'
  }));
}

// Handle input data
async function handleInput(ws, sessionId, command) {
  const { data } = command;
  
  debugLog(`📥 handleInput called for session ${sessionId}, data: "${data}", ASCII: ${data ? data.charCodeAt(0) : 'null'}`);
  
  if (!data) {
    debugLog('❌ No data provided in input command');
    return;
  }

  const session = activeSessions.get(sessionId);
  if (session && session.ssmSession && session.ssmSession.process) {
    debugLog(`✅ Forwarding input to SSM session: "${data}"`);
    try {
      session.ssmSession.process.stdin.write(data);
      debugLog(`📤 Successfully wrote to SSM stdin`);
    } catch (error) {
      debugLog(`❌ Error writing to SSM stdin: ${error.message}`);
    }
  } else {
    debugLog(`❌ No active SSM session for ${sessionId}`);
    debugLog(`Session exists: ${!!session}`);
    debugLog(`SSM Session exists: ${!!(session && session.ssmSession)}`);
    debugLog(`SSM Process exists: ${!!(session && session.ssmSession && session.ssmSession.process)}`);
    
    ws.send(JSON.stringify({
      type: 'error',
      message: 'No active SSM session'
    }));
  }
}

// Validate EC2 instance
async function validateInstance(instanceId) {
  try {
    const command = new DescribeInstancesCommand({
      InstanceIds: [instanceId]
    });
    
    const response = await ec2Client.send(command);
    
    if (!response.Reservations || response.Reservations.length === 0) {
      return {
        isValid: false,
        error: 'Instance not found'
      };
    }
    
    const instance = response.Reservations[0].Instances[0];
    const state = instance.State.Name;
    
    if (state !== 'running') {
      return {
        isValid: false,
        error: `Instance is ${state}, not running`
      };
    }
    
    return {
      isValid: true,
      instance: {
        instanceId: instance.InstanceId,
        state: instance.State.Name,
        type: instance.InstanceType,
        platform: instance.Platform || 'linux'
      }
    };
    
  } catch (error) {
    return {
      isValid: false,
      error: error.message
    };
  }
}

// List available instances
async function handleListInstances(ws, sessionId) {
  try {
    debugLog('Fetching EC2 instances...');
    
    const command = new DescribeInstancesCommand({
      Filters: [
        {
          Name: 'instance-state-name',
          Values: ['running', 'stopped']
        }
      ]
    });
    
    const response = await ec2Client.send(command);
    const instances = [];
    
    for (const reservation of response.Reservations || []) {
      for (const instance of reservation.Instances || []) {
        // Get instance name from tags
        const nameTag = instance.Tags?.find(tag => tag.Key === 'Name');
        const name = nameTag?.Value || `Instance-${instance.InstanceId}`;
        
        // Determine instance type based on name or tags
        let type = 'unknown';
        if (name.toLowerCase().includes('honeypot')) {
          type = 'honeypot';
        } else if (name.toLowerCase().includes('kali')) {
          type = 'analyst';
        }
        
        instances.push({
          instanceId: instance.InstanceId,
          name: name,
          state: instance.State.Name,
          type: type,
          platform: instance.Platform || 'linux',
          instanceType: instance.InstanceType,
          publicIp: instance.PublicIpAddress,
          privateIp: instance.PrivateIpAddress
        });
      }
    }
    
    debugLog(`Found ${instances.length} instances`);
    
    ws.send(JSON.stringify({
      type: 'instances',
      instances: instances
    }));
    
  } catch (error) {
    debugLog(`Error listing instances:`, error);
    
    // Fallback to mock data if AWS call fails
    const mockInstances = [
      {
        instanceId: 'i-1234567890abcdef0',
        name: 'PhantomWall-Honeypot',
        state: 'running',
        type: 'honeypot',
        platform: 'linux',
        instanceType: 't3.micro'
      },
      {
        instanceId: 'i-0987654321fedcba0', 
        name: 'PhantomWall-Kali',
        state: 'running',
        type: 'analyst',
        platform: 'linux',
        instanceType: 't3.small'
      }
    ];

    ws.send(JSON.stringify({
      type: 'instances',
      instances: mockInstances,
      warning: 'Using mock data - AWS credentials may not be configured'
    }));
  }
}

// Cleanup session
function cleanupSession(sessionId) {
  const session = activeSessions.get(sessionId);
  if (session?.ssmSession?.process) {
    debugLog(`Killing SSM process for session: ${sessionId}`);
    session.ssmSession.process.kill('SIGTERM');
  }
  
  activeSessions.delete(sessionId);
  debugLog(`Session ${sessionId} cleaned up`);
}

// Generate unique session ID
function generateSessionId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeSessions: activeSessions.size,
    version: '1.0.0'
  });
});

// Status endpoint
app.get('/status', (req, res) => {
  const sessions = Array.from(activeSessions.entries()).map(([id, session]) => ({
    sessionId: id,
    createdAt: session.createdAt,
    hasSSMSession: !!session.ssmSession,
    ssmInstanceId: session.ssmSession?.instanceId
  }));

  res.json({
    activeSessions: sessions,
    totalSessions: activeSessions.size,
    serverUptime: process.uptime(),
    memoryUsage: process.memoryUsage()
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 PhantomWall Terminal Proxy Server running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/terminal`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Status: http://localhost:${PORT}/status`);
  
  if (DEBUG) {
    console.log('🐛 Debug mode enabled');
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Terminal Proxy Server...');
  
  // Close all WebSocket connections
  activeSessions.forEach((session, sessionId) => {
    if (session.ws) {
      session.ws.close();
    }
    cleanupSession(sessionId);
  });
  
  wss.close();
  server.close(() => {
    console.log('✅ Server shut down gracefully');
    process.exit(0);
  });
});

export { app, server, wss };