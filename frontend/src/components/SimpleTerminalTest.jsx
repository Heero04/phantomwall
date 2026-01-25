import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import 'xterm/css/xterm.css';

const SimpleTerminalTest = () => {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const wsRef = useRef(null);
  const fitAddonRef = useRef(null);
  const [status, setStatus] = useState('disconnected');

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const terminal = new Terminal({
      theme: {
        background: '#1e1e1e',
        foreground: '#ffffff',
        cursor: '#ffffff'
      },
      fontFamily: 'monospace',
      fontSize: 14,
      cursorBlink: true,
      cursorStyle: 'block'
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    terminal.writeln('🧪 Simple Terminal Test');
    terminal.writeln('Type anything and it should appear...');
    terminal.write('\r\ntest$ ');

    // Simple echo test first
    terminal.onData((data) => {
      console.log('Terminal input captured:', data, 'char code:', data.charCodeAt(0));
      
      // Handle enter key
      if (data === '\r') {
        terminal.write('\r\ntest$ ');
      } else if (data === '\x7f') {
        // Handle backspace
        terminal.write('\b \b');
      } else {
        // Echo the character
        terminal.write(data);
      }
    });

    // Focus the terminal
    terminal.focus();

    return () => {
      if (xtermRef.current) {
        xtermRef.current.dispose();
      }
    };
  }, []);

  const connectToSSM = () => {
    if (!xtermRef.current) return;

    setStatus('connecting');
    xtermRef.current.clear();
    xtermRef.current.writeln('🔄 Connecting to SSM...');

    const ws = new WebSocket('ws://localhost:8080/terminal');

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'connect',
        instanceId: 'i-0fcc697a0a3f2b50f'
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'connected') {
          setStatus('connected');
          xtermRef.current.writeln('✅ Connected! Setting up input...');
          
          // Clear any existing handlers
          xtermRef.current.onData(() => {});
          
          // Set up SSM input handling
          xtermRef.current.onData((inputData) => {
            console.log('📤 Sending to SSM:', inputData, 'ASCII:', inputData.charCodeAt(0));
            ws.send(JSON.stringify({
              type: 'input',
              data: inputData
            }));
          });
          
          xtermRef.current.focus();
        } else if (data.type === 'data') {
          console.log('📥 Received from SSM:', data.data);
          xtermRef.current.write(data.data);
        } else if (data.type === 'error') {
          xtermRef.current.writeln(`❌ ${data.message}`);
        }
      } catch (e) {
        console.log('📥 Raw data:', event.data);
        xtermRef.current.write(event.data);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setStatus('error');
    };

    wsRef.current = ws;
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Terminal Input Debug Test</h2>
      
      <div className="mb-4">
        <button
          onClick={connectToSSM}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mr-2"
        >
          Connect to SSM
        </button>
        <span className="text-sm">Status: {status}</span>
      </div>

      <div className="bg-gray-900 rounded-lg p-2">
        <div 
          ref={terminalRef} 
          style={{ height: '400px' }}
          className="w-full"
        />
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <p>1. First test: Type in terminal above - should echo locally</p>
        <p>2. Click "Connect to SSM" button</p>
        <p>3. After connected, try typing - should send to server</p>
        <p>4. Check browser console (F12) for debug messages</p>
      </div>
    </div>
  );
};

export default SimpleTerminalTest;