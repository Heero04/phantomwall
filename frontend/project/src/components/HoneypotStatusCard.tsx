import React, { useState } from 'react';
import { Shield, Power } from 'lucide-react';
import { motion } from 'framer-motion';

const HoneypotStatusCard = () => {
  const [isActive, setIsActive] = useState(true);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-8 overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-violet-500/5"></div>
      <div className="absolute inset-0 border border-gradient-to-br from-cyan-500/20 to-violet-500/20 rounded-2xl"></div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Shield className="h-8 w-8 text-cyan-400" />
              {isActive && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-green-400/30 rounded-full blur-sm"
                ></motion.div>
              )}
            </div>
            <h2 className="text-2xl font-bold text-white">Honeypot Status</h2>
          </div>
          
          <div className="flex items-center space-x-3">
            <span className={`text-sm font-medium ${isActive ? 'text-green-400' : 'text-red-400'}`}>
              {isActive ? 'ACTIVE' : 'INACTIVE'}
            </span>
            <button
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-800 ${
                isActive ? 'bg-green-500' : 'bg-slate-600'
              }`}
              aria-label={`${isActive ? 'Deactivate' : 'Activate'} honeypot`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className={`text-3xl font-bold mb-2 ${isActive ? 'text-green-400' : 'text-slate-400'}`}>
              {isActive ? '24h 17m' : '00h 00m'}
            </div>
            <div className="text-slate-400 text-sm">Uptime</div>
          </div>
          
          <div className="text-center">
            <div className={`text-3xl font-bold mb-2 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`}>
              {isActive ? '8' : '0'}
            </div>
            <div className="text-slate-400 text-sm">Active Traps</div>
          </div>
          
          <div className="text-center">
            <div className={`text-3xl font-bold mb-2 ${isActive ? 'text-violet-400' : 'text-slate-400'}`}>
              {isActive ? '247' : '0'}
            </div>
            <div className="text-slate-400 text-sm">Interactions Today</div>
          </div>
        </div>

        {isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 flex items-center justify-center space-x-2 text-green-400"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-2 h-2 bg-green-400 rounded-full"
            ></motion.div>
            <span className="text-sm">Monitoring active threats</span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default HoneypotStatusCard;