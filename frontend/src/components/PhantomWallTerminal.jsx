import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import 'xterm/css/xterm.css';

const styles = {
  wrapper: {
    background: '#1e293b',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid #334155',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  header: {
    background: '#0f172a',
    padding: '0.65rem 1rem',
    borderBottom: '1px solid #334155',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  dots: {
    display: 'flex',
    gap: '6px',
  },
  dot: (color) => ({
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: color,
  }),
  title: {
    color: '#e2e8f0',
    fontWeight: 600,
    fontSize: '0.85rem',
  },
  statusBadge: (color) => ({
    fontSize: '0.7rem',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color,
  }),
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  select: {
    padding: '0.3rem 0.5rem',
    fontSize: '0.75rem',
    background: '#1e293b',
    color: '#e2e8f0',
    border: '1px solid #475569',
    borderRadius: '6px',
    outline: 'none',
  },
  btnConnect: {
    padding: '0.3rem 0.75rem',
    fontSize: '0.75rem',
    background: '#10b981',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  btnDisconnect: {
    padding: '0.3rem 0.75rem',
    fontSize: '0.75rem',
    background: '#ef4444',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  btnClear: {
    padding: '0.3rem 0.75rem',
    fontSize: '0.75rem',
    background: '#475569',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  termContainer: {
    flex: 1,
    cursor: 'text',
    minHeight: 0,
  },
};

const PhantomWallTerminal = ({
  title = 'PhantomWall Terminal',
  className = '',
}) => {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const wsRef = useRef(null);
  const fitAddonRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [instances, setInstances] = useState([]);
  const [selectedInstance, setSelectedInstance] = useState('');

  const terminalTheme = {
    background: '#1e293b',
    foreground: '#e2e8f0',
    cursor: '#e2e8f0',
    cursorAccent: '#0f172a',
    selection: '#ffffff40',
    black: '#0f172a',
    red: '#ef4444',
    green: '#10b981',
    yellow: '#f59e0b',
    blue: '#3b82f6',
    magenta: '#a855f7',
    cyan: '#06b6d4',
    white: '#e2e8f0',
    brightBlack: '#64748b',
    brightRed: '#f87171',
    brightGreen: '#34d399',
    brightYellow: '#fbbf24',
    brightBlue: '#60a5fa',
    brightMagenta: '#c084fc',
    brightCyan: '#22d3ee',
    brightWhite: '#f8fafc',
  };

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const terminal = new Terminal({
      theme: terminalTheme,
      fontFamily: '"Cascadia Code", "Fira Code", "SF Mono", Monaco, "Inconsolata", monospace',
      fontSize: 14,
      fontWeight: 400,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 1000,
      tabStopWidth: 4,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    terminal.writeln('\x1b[36m------------------------------------------------------------\x1b[0m');
    terminal.writeln('\x1b[36m  \x1b[1m\x1b[33mPhantomWall Terminal\x1b[0m');
    terminal.writeln('\x1b[36m  Ready for SSM connection to honeypot instances\x1b[0m');
    terminal.writeln('\x1b[36m------------------------------------------------------------\x1b[0m');
    terminal.writeln('');

    const handleResize = () => {
      if (fitAddonRef.current) fitAddonRef.current.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (wsRef.current) wsRef.current.close();
      if (xtermRef.current) xtermRef.current.dispose();
    };
  }, []);

  useEffect(() => {
    loadInstances();
  }, []);

  const loadInstances = async () => {
    try {
      const ws = new WebSocket('ws://localhost:8080/terminal');
      ws.onopen = () => ws.send(JSON.stringify({ type: 'list-instances' }));
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'instances') {
            setInstances(data.instances);
            ws.close();
          }
        } catch {
          /* non-json */
        }
      };
      ws.onerror = () => {
        if (xtermRef.current)
          xtermRef.current.writeln('\x1b[31mCannot connect to backend server\x1b[0m');
      };
    } catch (error) {
      if (xtermRef.current)
        xtermRef.current.writeln(`\x1b[31mFailed to load instances: ${error.message}\x1b[0m`);
    }
  };

  const connectToInstance = () => {
    if (!selectedInstance) {
      if (xtermRef.current)
        xtermRef.current.writeln('\x1b[31mPlease select an instance first\x1b[0m');
      return;
    }

    setConnectionStatus('connecting');
    if (xtermRef.current) {
      xtermRef.current.clear();
      xtermRef.current.writeln(`\x1b[33mConnecting to ${selectedInstance}...\x1b[0m`);
    }

    try {
      const ws = new WebSocket('ws://localhost:8080/terminal');
      let inputHandlerSet = false;

      ws.onopen = () =>
        ws.send(JSON.stringify({ type: 'connect', instanceId: selectedInstance }));

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'connected') {
            setConnectionStatus('connected');
            setIsConnected(true);
            if (xtermRef.current) {
              xtermRef.current.writeln(`\x1b[32mConnected to ${data.instanceId}\x1b[0m\n`);
              if (!inputHandlerSet) {
                inputHandlerSet = true;
                xtermRef.current.focus();
                xtermRef.current.onData((inputData) => {
                  if (ws.readyState === WebSocket.OPEN)
                    ws.send(JSON.stringify({ type: 'input', data: inputData }));
                });
              }
            }
          } else if (data.type === 'error') {
            setConnectionStatus('error');
            if (xtermRef.current)
              xtermRef.current.writeln(`\x1b[31mConnection failed: ${data.message}\x1b[0m`);
          } else if (data.type === 'data') {
            if (xtermRef.current) xtermRef.current.write(data.data);
          }
        } catch {
          if (xtermRef.current) xtermRef.current.write(event.data);
        }
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        setIsConnected(false);
        if (xtermRef.current)
          xtermRef.current.writeln('\x1b[33mConnection closed\x1b[0m');
      };

      ws.onerror = () => {
        setConnectionStatus('error');
        if (xtermRef.current)
          xtermRef.current.writeln('\x1b[31mWebSocket connection failed\x1b[0m');
      };

      wsRef.current = ws;
    } catch (error) {
      setConnectionStatus('error');
      if (xtermRef.current)
        xtermRef.current.writeln(`\x1b[31mConnection error: ${error.message}\x1b[0m`);
    }
  };

  const handleDisconnect = () => {
    if (wsRef.current) wsRef.current.close();
    setConnectionStatus('disconnected');
    setIsConnected(false);
    if (xtermRef.current) {
      xtermRef.current.clear();
      xtermRef.current.writeln('\x1b[33mDisconnected from instance\x1b[0m');
    }
  };

  const handleClear = () => {
    if (xtermRef.current) xtermRef.current.clear();
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#10b981';
      case 'connecting': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return '#94a3b8';
    }
  };

  return (
    <div style={styles.wrapper} className={className}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.dots}>
            <span style={styles.dot('#ef4444')} />
            <span style={styles.dot('#f59e0b')} />
            <span style={styles.dot('#10b981')} />
          </div>
          <span style={styles.title}>{title}</span>
          <span style={styles.statusBadge(getStatusColor())}>
            {connectionStatus}
          </span>
        </div>

        <div style={styles.headerRight}>
          {isConnected ? (
            <button style={styles.btnDisconnect} onClick={handleDisconnect}>
              Disconnect
            </button>
          ) : (
            <>
              {instances.length > 0 && (
                <select
                  style={styles.select}
                  value={selectedInstance}
                  onChange={(e) => setSelectedInstance(e.target.value)}
                >
                  <option value="">Select Instance</option>
                  {instances.map((inst) => (
                    <option key={inst.instanceId} value={inst.instanceId}>
                      {inst.name} ({inst.state})
                    </option>
                  ))}
                </select>
              )}
              <button
                style={{
                  ...styles.btnConnect,
                  opacity: !selectedInstance || connectionStatus === 'connecting' ? 0.5 : 1,
                  cursor: !selectedInstance || connectionStatus === 'connecting' ? 'not-allowed' : 'pointer',
                }}
                onClick={connectToInstance}
                disabled={!selectedInstance || connectionStatus === 'connecting'}
              >
                {connectionStatus === 'connecting' ? 'Connecting...' : 'Connect'}
              </button>
            </>
          )}
          <button style={styles.btnClear} onClick={handleClear}>
            Clear
          </button>
        </div>
      </div>

      <div
        ref={terminalRef}
        style={styles.termContainer}
        onClick={() => xtermRef.current?.focus()}
      />
    </div>
  );
};

export default PhantomWallTerminal;
