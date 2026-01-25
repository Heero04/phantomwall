import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import 'xterm/css/xterm.css';

const PhantomWallTerminal = ({ 
  title = "PhantomWall Terminal", 
  className = "",
  height = "500px",
  theme = "dark"
}) => {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const wsRef = useRef(null);
  const fitAddonRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [instances, setInstances] = useState([]);
  const [selectedInstance, setSelectedInstance] = useState('');
  const [showInstanceSelector, setShowInstanceSelector] = useState(true);

  // Terminal themes
  const terminalTheme = {
    background: '#1e1e1e',
    foreground: '#ffffff',
    cursor: '#ffffff',
    cursorAccent: '#000000',
    selection: '#ffffff40',
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#e5e510',
    blue: '#2472c8',
    magenta: '#bc3fbc',
    cyan: '#11a8cd',
    white: '#e5e5e5',
    brightBlack: '#666666',
    brightRed: '#f14c4c',
    brightGreen: '#23d18b',
    brightYellow: '#f5f543',
    brightBlue: '#3b8eea',
    brightMagenta: '#d670d6',
    brightCyan: '#29b8db',
    brightWhite: '#ffffff'
  };

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const terminal = new Terminal({
      theme: terminalTheme,
      fontFamily: '"Cascadia Code", "Fira Code", "SF Mono", Monaco, "Inconsolata", "Roboto Mono", "Source Code Pro", monospace',
      fontSize: 14,
      fontWeight: 400,
      lineHeight: 1.2,
      letterSpacing: 0,
      cursorBlink: true,
      cursorStyle: 'block',
      bellStyle: 'sound',
      scrollback: 1000,
      tabStopWidth: 4
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    
    terminal.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Show welcome message
    terminal.writeln('\x1b[36m╔══════════════════════════════════════════════════════════════════╗\x1b[0m');
    terminal.writeln('\x1b[36m║                    \x1b[1m\x1b[33mPhantomWall Terminal\x1b[0m\x1b[36m                        ║\x1b[0m');
    terminal.writeln('\x1b[36m║              Ready for SSM connection to honeypot instances       ║\x1b[0m');
    terminal.writeln('\x1b[36m╚══════════════════════════════════════════════════════════════════╝\x1b[0m');
    terminal.writeln('');

    // Handle window resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (xtermRef.current) {
        xtermRef.current.dispose();
      }
    };
  }, []);

  // Load instances on component mount
  useEffect(() => {
    loadInstances();
  }, []);

  const loadInstances = async () => {
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
            ws.close();
          }
        } catch (e) {
          console.log('Non-JSON message:', event.data);
        }
      };
      
      ws.onerror = () => {
        if (xtermRef.current) {
          xtermRef.current.writeln('\x1b[31m❌ Cannot connect to backend server\x1b[0m');
        }
      };
      
    } catch (error) {
      if (xtermRef.current) {
        xtermRef.current.writeln(`\x1b[31m❌ Failed to load instances: ${error.message}\x1b[0m`);
      }
    }
  };

  const connectToInstance = () => {
    if (!selectedInstance) {
      if (xtermRef.current) {
        xtermRef.current.writeln('\x1b[31m❌ Please select an instance first\x1b[0m');
      }
      return;
    }

    setConnectionStatus('connecting');
    setShowInstanceSelector(false);

    if (xtermRef.current) {
      xtermRef.current.clear();
      xtermRef.current.writeln(`\x1b[33m🔄 Connecting to ${selectedInstance}...\x1b[0m`);
    }

    try {
      const ws = new WebSocket('ws://localhost:8080/terminal');
      let inputHandlerSet = false;
      
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
            setConnectionStatus('connected');
            setIsConnected(true);
            if (xtermRef.current) {
              xtermRef.current.writeln(`\x1b[32m✅ Connected to ${data.instanceId}\x1b[0m`);
              xtermRef.current.writeln('');
            }
            
            // Set up input handling after connection (only once)
            if (xtermRef.current && !inputHandlerSet) {
              inputHandlerSet = true;
              // Focus the terminal
              xtermRef.current.focus();
              
              xtermRef.current.onData((inputData) => {
                console.log('Sending input:', inputData); // Debug log
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'input',
                    data: inputData
                  }));
                }
              });
            }
          } else if (data.type === 'error') {
            setConnectionStatus('error');
            if (xtermRef.current) {
              xtermRef.current.writeln(`\x1b[31m❌ Connection failed: ${data.message}\x1b[0m`);
            }
          } else if (data.type === 'data') {
            // Handle terminal output data
            if (xtermRef.current) {
              xtermRef.current.write(data.data);
            }
          }
        } catch (e) {
          // Raw terminal data - write directly to terminal
          if (xtermRef.current) {
            xtermRef.current.write(event.data);
          }
        }
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        setIsConnected(false);
        setShowInstanceSelector(true);
        if (xtermRef.current) {
          xtermRef.current.writeln('\x1b[33m⚠️ Connection closed\x1b[0m');
        }
      };

      ws.onerror = () => {
        setConnectionStatus('error');
        if (xtermRef.current) {
          xtermRef.current.writeln('\x1b[31m❌ WebSocket connection failed\x1b[0m');
        }
      };

      wsRef.current = ws;

    } catch (error) {
      setConnectionStatus('error');
      if (xtermRef.current) {
        xtermRef.current.writeln(`\x1b[31m❌ Connection error: ${error.message}\x1b[0m`);
      }
    }
  };

  const handleDisconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setConnectionStatus('disconnected');
    setIsConnected(false);
    setShowInstanceSelector(true);
    if (xtermRef.current) {
      xtermRef.current.clear();
      xtermRef.current.writeln('\x1b[33m🔌 Disconnected from instance\x1b[0m');
    }
  };

  const handleTerminalClick = () => {
    if (xtermRef.current) {
      xtermRef.current.focus();
    }
  };

  const handleClear = () => {
    if (xtermRef.current) {
      xtermRef.current.clear();
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-400';
      case 'connecting': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return '🟢';
      case 'connecting': return '🟡';
      case 'error': return '🔴';
      default: return '⚪';
    }
  };

  return (
    <div className={`bg-gray-900 rounded-lg overflow-hidden border border-gray-700 ${className}`}>
      {/* Terminal Header */}
      <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="text-white font-medium">{title}</span>
          <div className={`text-xs flex items-center space-x-1 ${getStatusColor()}`}>
            <span>{getStatusIcon()}</span>
            <span>{connectionStatus}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {isConnected ? (
            <button
              onClick={handleDisconnect}
              className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
            >
              Disconnect
            </button>
          ) : (
            <>
              {instances.length > 0 && (
                <select
                  value={selectedInstance}
                  onChange={(e) => setSelectedInstance(e.target.value)}
                  className="px-2 py-1 text-xs bg-gray-700 text-white border border-gray-600 rounded"
                >
                  <option value="">Select Instance</option>
                  {instances.map((instance) => (
                    <option key={instance.instanceId} value={instance.instanceId}>
                      {instance.name} ({instance.state})
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={connectToInstance}
                disabled={!selectedInstance || connectionStatus === 'connecting'}
                className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded transition-colors"
              >
                {connectionStatus === 'connecting' ? 'Connecting...' : 'Connect'}
              </button>
            </>
          )}
          <button
            onClick={handleClear}
            className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Terminal Container */}
      <div 
        ref={terminalRef} 
        style={{ height }}
        className="w-full cursor-text"
        onClick={handleTerminalClick}
      />
    </div>
  );
};

export default PhantomWallTerminal;