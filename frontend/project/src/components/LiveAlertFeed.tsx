import React from 'react';
import { AlertCircle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

const LiveAlertFeed = () => {
  const alerts = [
    {
      id: 1,
      type: 'SSH Brute Force',
      sourceIp: '192.168.1.45',
      severity: 'critical',
      timestamp: new Date(Date.now() - 2 * 60 * 1000)
    },
    {
      id: 2,
      type: 'Port Scan',
      sourceIp: '10.0.0.23',
      severity: 'warning',
      timestamp: new Date(Date.now() - 5 * 60 * 1000)
    },
    {
      id: 3,
      type: 'HTTP Probe',
      sourceIp: '172.16.0.8',
      severity: 'info',
      timestamp: new Date(Date.now() - 8 * 60 * 1000)
    },
    {
      id: 4,
      type: 'FTP Login Attempt',
      sourceIp: '203.0.113.42',
      severity: 'critical',
      timestamp: new Date(Date.now() - 12 * 60 * 1000)
    },
    {
      id: 5,
      type: 'DNS Query',
      sourceIp: '198.51.100.15',
      severity: 'info',
      timestamp: new Date(Date.now() - 15 * 60 * 1000)
    },
    {
      id: 6,
      type: 'Telnet Access',
      sourceIp: '192.0.2.67',
      severity: 'warning',
      timestamp: new Date(Date.now() - 18 * 60 * 1000)
    }
  ];

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          badge: 'bg-red-500/20 text-red-400 border-red-500/30',
          glow: 'shadow-red-500/20'
        };
      case 'warning':
        return {
          badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
          glow: 'shadow-amber-500/20'
        };
      case 'info':
        return {
          badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
          glow: 'shadow-blue-500/20'
        };
      default:
        return {
          badge: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
          glow: 'shadow-slate-500/20'
        };
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="relative bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-xl p-6 overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-slate-600/5"></div>
      
      <div className="relative z-10">
        <div className="flex items-center space-x-3 mb-6">
          <AlertCircle className="h-6 w-6 text-cyan-400" />
          <h2 className="text-xl font-bold text-white">Live Alert Feed</h2>
          <motion.div
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-2 h-2 bg-green-400 rounded-full"
          ></motion.div>
        </div>

        <div className="space-y-3 max-h-80 overflow-y-auto scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-slate-600">
          {alerts.map((alert, index) => {
            const styles = getSeverityStyles(alert.severity);
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className={`bg-slate-900/50 border border-slate-700/50 rounded-lg p-4 hover:border-slate-600/50 transition-all duration-300 ${styles.glow} hover:shadow-lg`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-1 rounded-md text-xs font-medium border ${styles.badge}`}>
                    {alert.severity.toUpperCase()}
                  </span>
                  <div className="flex items-center space-x-1 text-slate-400 text-xs">
                    <Clock className="h-3 w-3" />
                    <span>{formatDistanceToNow(alert.timestamp, { addSuffix: true })}</span>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="text-white font-medium">{alert.type}</div>
                  <div className="text-slate-400 text-sm">Source: {alert.sourceIp}</div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default LiveAlertFeed;