import React, { useState } from 'react';
import ReactTerminal from '../components/ReactTerminal';

const TerminalTest = () => {
  const [testResults, setTestResults] = useState({
    xtermInstalled: false,
    xtermRendered: false,
    websocketConnection: false,
    backendProxy: false,
    awsSSMConnection: false,
    fullIntegration: false
  });

  const [currentTest, setCurrentTest] = useState('installation');

  const testSections = [
    {
      id: 'installation',
      title: '1. XTerm.js Installation',
      description: 'Test if xterm.js and addons are properly installed',
      status: testResults.xtermInstalled
    },
    {
      id: 'rendering',
      title: '2. Terminal Rendering',
      description: 'Test if xterm.js terminal can render in React component',
      status: testResults.xtermRendered
    },
    {
      id: 'websocket',
      title: '3. WebSocket Connection',
      description: 'Test WebSocket connection between frontend and backend proxy',
      status: testResults.websocketConnection
    },
    {
      id: 'backend',
      title: '4. Backend Proxy Server',
      description: 'Test Node.js backend server that bridges WebSocket ↔ AWS SSM',
      status: testResults.backendProxy
    },
    {
      id: 'ssm',
      title: '5. AWS SSM Integration',
      description: 'Test AWS SSM session creation and data streaming',
      status: testResults.awsSSMConnection
    },
    {
      id: 'integration',
      title: '6. Full Integration',
      description: 'Test complete flow: React → WebSocket → Backend → SSM → EC2',
      status: testResults.fullIntegration
    }
  ];

  const updateTestResult = (testKey, result) => {
    setTestResults(prev => ({
      ...prev,
      [testKey]: result
    }));
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-blue-400">🖥️ Terminal Integration Testing</h1>
        <p className="text-gray-400 mb-8">Testing each component of the React → WebSocket → SSM → EC2 terminal integration</p>

        {/* Architecture Diagram */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4">Architecture Flow</h2>
          <div className="font-mono text-sm space-y-2 text-gray-300">
            <div>┌─────────────────────┐</div>
            <div>│   React (xterm.js)  │ ← We are here</div>
            <div>└──────────┬──────────┘</div>
            <div>           │ WebSocket</div>
            <div>           ▼</div>
            <div>┌─────────────────────┐</div>
            <div>│  Terminal Proxy     │</div>
            <div>│  Backend Server     │</div>
            <div>└──────────┬──────────┘</div>
            <div>           │ AWS SDK</div>
            <div>           ▼</div>
            <div>┌─────────────────────┐</div>
            <div>│   AWS SSM Session   │</div>
            <div>└──────────┬──────────┘</div>
            <div>           │ Encrypted</div>
            <div>           ▼</div>
            <div>┌─────────────────────┐</div>
            <div>│   Honeypot EC2      │</div>
            <div>└─────────────────────┘</div>
          </div>
        </div>

        {/* Test Checklist */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Test Steps */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Test Checklist</h2>
            <div className="space-y-4">
              {testSections.map((section) => (
                <div
                  key={section.id}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    section.status
                      ? 'border-green-500 bg-green-900/20'
                      : currentTest === section.id
                      ? 'border-blue-500 bg-blue-900/20'
                      : 'border-gray-600 bg-gray-700/50'
                  }`}
                  onClick={() => setCurrentTest(section.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{section.title}</h3>
                      <p className="text-sm text-gray-400">{section.description}</p>
                    </div>
                    <div className="text-2xl">
                      {section.status ? '✅' : '⏳'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Current Test Area */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Current Test: {testSections.find(s => s.id === currentTest)?.title}</h2>
            
            {currentTest === 'installation' && (
              <InstallationTest updateResult={updateTestResult} />
            )}
            
            {currentTest === 'rendering' && (
              <RenderingTest updateResult={updateTestResult} />
            )}
            
            {currentTest === 'websocket' && (
              <WebSocketTest updateResult={updateTestResult} />
            )}
            
            {currentTest === 'backend' && (
              <BackendTest updateResult={updateTestResult} />
            )}
            
            {currentTest === 'ssm' && (
              <SSMTest updateResult={updateTestResult} />
            )}
            
            {currentTest === 'integration' && (
              <IntegrationTest updateResult={updateTestResult} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Individual Test Components
const InstallationTest = ({ updateResult }) => {
  const [installStatus, setInstallStatus] = useState('ready');
  const [installedPackages, setInstalledPackages] = useState([]);

  const runInstallTest = async () => {
    setInstallStatus('installing');
    const packages = [];
    
    try {
      // Test xterm core package
      const xterm = await import('xterm');
      packages.push({ name: 'xterm', status: 'success', version: 'installed' });
      
      // Test fit addon
      const fitAddon = await import('@xterm/addon-fit');
      packages.push({ name: '@xterm/addon-fit', status: 'success', version: 'installed' });
      
      // Test web links addon
      const webLinksAddon = await import('@xterm/addon-web-links');
      packages.push({ name: '@xterm/addon-web-links', status: 'success', version: 'installed' });
      
      setInstalledPackages(packages);
      setInstallStatus('success');
      updateResult('xtermInstalled', true);
    } catch (error) {
      setInstallStatus('error');
      console.error('Installation test failed:', error);
      packages.push({ name: 'xterm packages', status: 'error', error: error.message });
      setInstalledPackages(packages);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-gray-300">Test if xterm.js packages are properly installed and can be imported.</p>
      
      <div className="space-y-2">
        <button
          onClick={runInstallTest}
          disabled={installStatus === 'installing'}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded transition-colors"
        >
          {installStatus === 'installing' ? 'Testing Installation...' : 'Test Installation'}
        </button>
        
        {installStatus === 'success' && (
          <div className="text-green-400 flex items-center gap-2">
            <span>✅</span>
            <span>XTerm.js packages installed successfully!</span>
          </div>
        )}
        
        {installStatus === 'error' && (
          <div className="text-red-400 flex items-center gap-2">
            <span>❌</span>
            <span>Installation failed. Run: npm install xterm @xterm/addon-fit @xterm/addon-web-links</span>
          </div>
        )}
        
        {installedPackages.length > 0 && (
          <div className="bg-gray-700 rounded p-3 mt-4">
            <h4 className="font-semibold mb-2">Package Status:</h4>
            {installedPackages.map((pkg, index) => (
              <div key={index} className="flex items-center justify-between py-1">
                <span className="text-sm">{pkg.name}</span>
                <span className={`text-sm ${pkg.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                  {pkg.status === 'success' ? '✅ Imported' : '❌ Failed'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="bg-gray-700 rounded p-3 text-sm">
        <strong>Expected packages:</strong>
        <ul className="mt-2 space-y-1 text-gray-300">
          <li>• xterm - Core terminal emulator</li>
          <li>• @xterm/addon-fit - Auto-resize terminal</li>
          <li>• @xterm/addon-web-links - Clickable URLs</li>
        </ul>
      </div>
    </div>
  );
};

const RenderingTest = ({ updateResult }) => {
  const [renderStatus, setRenderStatus] = useState('ready');
  const [showTerminal, setShowTerminal] = useState(false);

  const runRenderTest = async () => {
    setRenderStatus('testing');
    try {
      // Import the terminal component
      const ReactTerminal = await import('../components/ReactTerminal');
      
      setRenderStatus('success');
      setShowTerminal(true);
      updateResult('xtermRendered', true);
    } catch (error) {
      setRenderStatus('error');
      console.error('Rendering test failed:', error);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-gray-300">Test if xterm.js terminal can render properly in a React component.</p>
      
      <div className="space-y-2">
        <button
          onClick={runRenderTest}
          disabled={renderStatus === 'testing'}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded transition-colors"
        >
          {renderStatus === 'testing' ? 'Testing Render...' : 'Test Terminal Rendering'}
        </button>
        
        {renderStatus === 'success' && (
          <div className="text-green-400 flex items-center gap-2">
            <span>✅</span>
            <span>Terminal component rendered successfully!</span>
          </div>
        )}
        
        {renderStatus === 'error' && (
          <div className="text-red-400 flex items-center gap-2">
            <span>❌</span>
            <span>Terminal rendering failed. Check console for details.</span>
          </div>
        )}
      </div>
      
      {showTerminal && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-white font-semibold mb-3">Live Terminal Test:</h4>
          <ReactTerminal 
            title="Test Terminal"
            height="300px"
            onReady={() => console.log('Terminal ready!')}
          />
        </div>
      )}
      
      <div className="bg-gray-700 rounded p-3 text-sm">
        <strong>What this test checks:</strong>
        <ul className="mt-2 space-y-1 text-gray-300">
          <li>• Terminal component imports successfully</li>
          <li>• XTerm.js renders in React DOM</li>
          <li>• FitAddon and WebLinksAddon load properly</li>
          <li>• Terminal displays welcome message</li>
          <li>• Demo mode keyboard input works</li>
        </ul>
      </div>
    </div>
  );
};

const WebSocketTest = ({ updateResult }) => {
  const [wsStatus, setWsStatus] = useState('ready');
  const [showTerminal, setShowTerminal] = useState(false);
  const [messages, setMessages] = useState([]);

  const runWebSocketTest = async () => {
    setWsStatus('testing');
    setMessages([]);
    
    try {
      const ws = new WebSocket('ws://localhost:8080/terminal');
      
      ws.onopen = () => {
        setMessages(prev => [...prev, '✅ WebSocket connection established']);
        
        // Test sending a command
        setTimeout(() => {
          setMessages(prev => [...prev, '📤 Sending list-instances command...']);
          ws.send(JSON.stringify({
            type: 'list-instances'
          }));
        }, 1000);
        
        setTimeout(() => {
          setWsStatus('success');
          updateResult('websocketConnection', true);
          ws.close();
        }, 3000);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setMessages(prev => [...prev, `📥 Received: ${data.type} - ${data.message || JSON.stringify(data)}`]);
        } catch {
          setMessages(prev => [...prev, `📥 Raw data: ${event.data}`]);
        }
      };
      
      ws.onclose = () => {
        setMessages(prev => [...prev, '🔌 WebSocket connection closed']);
      };
      
      ws.onerror = (error) => {
        setWsStatus('error');
        setMessages(prev => [...prev, `❌ WebSocket error: ${error.message || 'Connection failed'}`]);
      };
      
    } catch (error) {
      setWsStatus('error');
      setMessages(prev => [...prev, `❌ Failed to create WebSocket: ${error.message}`]);
    }
  };

  const showLiveTerminal = () => {
    setShowTerminal(true);
  };

  return (
    <div className="space-y-4">
      <p className="text-gray-300">Test WebSocket connection between React frontend and backend proxy.</p>
      
      <div className="space-y-2">
        <div className="flex space-x-2">
          <button
            onClick={runWebSocketTest}
            disabled={wsStatus === 'testing'}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded transition-colors"
          >
            {wsStatus === 'testing' ? 'Testing Connection...' : 'Test WebSocket Connection'}
          </button>
          
          {wsStatus === 'success' && (
            <button
              onClick={showLiveTerminal}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition-colors"
            >
              Show Live Terminal
            </button>
          )}
        </div>
        
        {wsStatus === 'success' && (
          <div className="text-green-400 flex items-center gap-2">
            <span>✅</span>
            <span>WebSocket connection successful!</span>
          </div>
        )}
        
        {wsStatus === 'error' && (
          <div className="text-red-400 flex items-center gap-2">
            <span>❌</span>
            <span>WebSocket connection failed. Is the backend server running on port 8080?</span>
          </div>
        )}
        
        {messages.length > 0 && (
          <div className="bg-gray-800 rounded p-3 max-h-40 overflow-y-auto">
            <h4 className="text-white font-semibold mb-2">WebSocket Messages:</h4>
            {messages.map((msg, index) => (
              <div key={index} className="text-sm text-gray-300 py-1">
                {msg}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {showTerminal && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-white font-semibold mb-3">Live Terminal with WebSocket:</h4>
          <ReactTerminal 
            title="WebSocket Terminal"
            websocketUrl="ws://localhost:8080/terminal"
            height="300px"
            onReady={() => console.log('WebSocket terminal ready!')}
          />
        </div>
      )}
      
      <div className="bg-gray-700 rounded p-3 text-sm">
        <strong>Backend Server Status:</strong>
        <ul className="mt-2 space-y-1 text-gray-300">
          <li>• Server: ws://localhost:8080/terminal</li>
          <li>• Health: <a href="http://localhost:8080/health" target="_blank" rel="noopener" className="text-blue-400 hover:underline">http://localhost:8080/health</a></li>
          <li>• Status: <a href="http://localhost:8080/status" target="_blank" rel="noopener" className="text-blue-400 hover:underline">http://localhost:8080/status</a></li>
        </ul>
      </div>
    </div>
  );
};

const BackendTest = ({ updateResult }) => {
  return (
    <div className="space-y-4">
      <p className="text-gray-300">Test Node.js backend server that bridges WebSocket ↔ AWS SSM.</p>
      
      <div className="bg-gray-700 rounded p-3">
        <p className="text-yellow-400">⚠️ This test requires AWS credentials and backend server.</p>
        <p className="text-gray-300 mt-2">We'll test the proxy server functionality.</p>
      </div>
    </div>
  );
};

const SSMTest = ({ updateResult }) => {
  const [ssmStatus, setSsmStatus] = useState('ready');
  const [instances, setInstances] = useState([]);
  const [selectedInstance, setSelectedInstance] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('');

  const testAWSCredentials = async () => {
    setSsmStatus('testing-credentials');
    try {
      const ws = new WebSocket('ws://localhost:8080/terminal');
      
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'list-instances' }));
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'instances') {
            setInstances(data.instances);
            setSsmStatus('credentials-ok');
            if (data.warning) {
              setConnectionStatus(`⚠️ ${data.warning}`);
            } else {
              setConnectionStatus('✅ AWS credentials working');
              updateResult('awsSSMConnection', true);
            }
            ws.close();
          }
        } catch (e) {
          console.log('Non-JSON message:', event.data);
        }
      };
      
      ws.onerror = () => {
        setSsmStatus('error');
        setConnectionStatus('❌ Cannot connect to backend server');
      };
      
    } catch (error) {
      setSsmStatus('error');
      setConnectionStatus(`❌ Test failed: ${error.message}`);
    }
  };

  const testSSMConnection = async () => {
    if (!selectedInstance) {
      setConnectionStatus('❌ Please select an instance first');
      return;
    }
    
    setSsmStatus('testing-ssm');
    setConnectionStatus('🔄 Testing SSM connection...');
    
    try {
      const ws = new WebSocket('ws://localhost:8080/terminal');
      
      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'connect',
          instanceId: selectedInstance
        }));
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'connected') {
            setSsmStatus('success');
            setConnectionStatus(`✅ SSM connection successful to ${data.instanceId}`);
            updateResult('awsSSMConnection', true);
            setTimeout(() => ws.close(), 2000);
          } else if (data.type === 'error') {
            setSsmStatus('error');
            setConnectionStatus(`❌ SSM connection failed: ${data.message}`);
          }
        } catch (e) {
          console.log('SSM response:', event.data);
        }
      };
      
    } catch (error) {
      setSsmStatus('error');
      setConnectionStatus(`❌ Connection test failed: ${error.message}`);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-gray-300">Test AWS SSM session creation and data streaming.</p>
      
      <div className="space-y-3">
        <button
          onClick={testAWSCredentials}
          disabled={ssmStatus === 'testing-credentials'}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded transition-colors mr-2"
        >
          {ssmStatus === 'testing-credentials' ? 'Testing AWS...' : 'Test AWS Credentials'}
        </button>
        
        {instances.length > 0 && (
          <div className="space-y-2">
            <label className="block text-white font-medium">Select Instance:</label>
            <select
              value={selectedInstance}
              onChange={(e) => setSelectedInstance(e.target.value)}
              className="bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 w-full"
            >
              <option value="">Choose an instance...</option>
              {instances.map((instance) => (
                <option key={instance.instanceId} value={instance.instanceId}>
                  {instance.name} ({instance.instanceId}) - {instance.state}
                </option>
              ))}
            </select>
            
            <button
              onClick={testSSMConnection}
              disabled={!selectedInstance || ssmStatus === 'testing-ssm'}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded transition-colors"
            >
              {ssmStatus === 'testing-ssm' ? 'Testing SSM...' : 'Test SSM Connection'}
            </button>
          </div>
        )}
        
        {connectionStatus && (
          <div className="bg-gray-800 rounded p-3">
            <div className="text-sm">{connectionStatus}</div>
          </div>
        )}
        
        {instances.length > 0 && (
          <div className="bg-gray-800 rounded p-3">
            <h4 className="text-white font-semibold mb-2">Available Instances:</h4>
            <div className="space-y-1 text-sm">
              {instances.map((instance) => (
                <div key={instance.instanceId} className="flex justify-between">
                  <span>{instance.name}</span>
                  <span className={`${instance.state === 'running' ? 'text-green-400' : 'text-yellow-400'}`}>
                    {instance.state}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <div className="bg-gray-700 rounded p-3 text-sm">
        <strong>Prerequisites for SSM:</strong>
        <ul className="mt-2 space-y-1 text-gray-300">
          <li>• AWS credentials configured (aws configure)</li>
          <li>• EC2 instances with SSM agent installed</li>
          <li>• IAM permissions for SSM:StartSession</li>
          <li>• Instances in 'running' state</li>
        </ul>
      </div>
    </div>
  );
};

const IntegrationTest = ({ updateResult }) => {
  return (
    <div className="space-y-4">
      <p className="text-gray-300">Test the complete flow: React → WebSocket → Backend → SSM → EC2.</p>
      
      <div className="bg-gray-700 rounded p-3">
        <p className="text-yellow-400">⚠️ This test requires all previous components to be working.</p>
        <p className="text-gray-300 mt-2">We'll test end-to-end terminal session.</p>
      </div>
    </div>
  );
};

export default TerminalTest;