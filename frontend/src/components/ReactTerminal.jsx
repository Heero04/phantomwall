import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import 'xterm/css/xterm.css';

const ReactTerminal = ({ 
  title = "Terminal", 
  websocketUrl = null,
  onReady = null,
  className = "",
  height = "400px",
  theme = "dark"
}) => {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const wsRef = useRef(null);
  const fitAddonRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // Terminal themes
  const themes = {
    dark: {
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
    },
    light: {
      background: '#ffffff',
      foreground: '#000000',
      cursor: '#000000',
      cursorAccent: '#ffffff',
      selection: '#00000040'
    }
  };

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal instance
    const terminal = new Terminal({
      theme: themes[theme],
      fontSize: 13,
      fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", monospace',
      cursorBlink: true,
      allowTransparency: false,
      rows: 24,
      cols: 80
    });

    // Create addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    // Load addons
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    // Store references
    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Open terminal
    terminal.open(terminalRef.current);
    fitAddon.fit();

    // Welcome message
    terminal.writeln('\x1b[1;34m╭─────────────────────────────────────────────────────────╮\x1b[0m');
    terminal.writeln('\x1b[1;34m│\x1b[0m              \x1b[1;36mPhantomWall Terminal\x1b[0m                    \x1b[1;34m│\x1b[0m');
    terminal.writeln('\x1b[1;34m│\x1b[0m     Ready for SSM connection to honeypot instances     \x1b[1;34m│\x1b[0m');
    terminal.writeln('\x1b[1;34m╰─────────────────────────────────────────────────────────╯\x1b[0m');
    terminal.writeln('');

    if (websocketUrl) {
      connectWebSocket();
    } else {
      terminal.writeln('\x1b[33m⚠️  WebSocket URL not provided - running in demo mode\x1b[0m');
      terminal.writeln('\x1b[32m✓  Terminal ready for backend connection\x1b[0m');
      terminal.write('\x1b[36mphantomwall@terminal\x1b[0m:\x1b[34m~\x1b[0m$ ');
      
      // Demo mode - echo what user types
      terminal.onData(data => {
        if (data === '\r') {
          terminal.write('\r\n\x1b[36mphantomwall@terminal\x1b[0m:\x1b[34m~\x1b[0m$ ');
        } else if (data === '\u007F') { // Backspace
          terminal.write('\b \b');
        } else {
          terminal.write(data);
        }
      });
    }

    // Handle terminal resize
    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit();
      }
    };

    window.addEventListener('resize', handleResize);

    // Call onReady callback
    if (onReady) {
      onReady(terminal);
    }

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (wsRef.current) {
        wsRef.current.close();
      }
      terminal.dispose();
    };
  }, [websocketUrl, theme]);

  const connectWebSocket = () => {
    if (!websocketUrl || !xtermRef.current) return;

    setConnectionStatus('connecting');
    const terminal = xtermRef.current;

    try {
      const ws = new WebSocket(websocketUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        terminal.writeln('\x1b[32m✓ Connected to terminal proxy\x1b[0m');
        terminal.writeln('Establishing SSM session...');
      };

      ws.onmessage = (event) => {
        terminal.write(event.data);
      };

      ws.onclose = () => {
        setIsConnected(false);
        setConnectionStatus('disconnected');
        terminal.writeln('\r\n\x1b[31m✗ Connection closed\x1b[0m');
      };

      ws.onerror = (error) => {
        setIsConnected(false);
        setConnectionStatus('error');
        terminal.writeln('\r\n\x1b[31m✗ WebSocket connection failed\x1b[0m');
        console.error('WebSocket error:', error);
      };

      // Send terminal input to WebSocket
      terminal.onData(data => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

    } catch (error) {
      setConnectionStatus('error');
      terminal.writeln('\x1b[31m✗ Failed to create WebSocket connection\x1b[0m');
      console.error('WebSocket creation failed:', error);
    }
  };

  const handleReconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    connectWebSocket();
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
          {websocketUrl && (
            <button
              onClick={handleReconnect}
              disabled={connectionStatus === 'connecting'}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded transition-colors"
            >
              {connectionStatus === 'connecting' ? 'Connecting...' : 'Reconnect'}
            </button>
          )}
          <button
            onClick={handleClear}
            className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Terminal Content */}
      <div 
        ref={terminalRef}
        style={{ height }}
        className="terminal-container"
      />
    </div>
  );
};

export default ReactTerminal;