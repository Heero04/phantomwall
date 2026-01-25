import WebSocket from 'ws';

// Test the WebSocket server
async function testTerminalProxy() {
  console.log('🧪 Testing PhantomWall Terminal Proxy...\n');
  
  const ws = new WebSocket('ws://localhost:8080/terminal');
  
  ws.on('open', () => {
    console.log('✅ WebSocket connection established');
    
    // Test sending a command
    setTimeout(() => {
      console.log('📤 Sending test command...');
      ws.send(JSON.stringify({
        type: 'list-instances'
      }));
    }, 1000);
    
    // Test raw terminal input
    setTimeout(() => {
      console.log('📤 Sending raw terminal input...');
      ws.send('whoami\r');
    }, 2000);
    
    // Close connection after tests
    setTimeout(() => {
      ws.close();
    }, 5000);
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      console.log('📥 Received JSON:', message);
    } catch {
      console.log('📥 Received raw:', data.toString());
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket connection closed');
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
  });
}

// Run test if server is running
setTimeout(testTerminalProxy, 1000);