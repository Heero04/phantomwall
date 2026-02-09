import React from 'react';
import { Globe } from 'lucide-react';
import { motion } from 'framer-motion';

const TopAttackOrigins = () => {
  const origins = [
    { country: 'China', attacks: 89, percentage: 85 },
    { country: 'Russia', attacks: 67, percentage: 64 },
    { country: 'North Korea', attacks: 45, percentage: 43 },
    { country: 'Iran', attacks: 32, percentage: 31 },
    { country: 'Brazil', attacks: 14, percentage: 13 }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.5 }}
      className="relative bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-xl p-6 overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-slate-600/5"></div>
      
      <div className="relative z-10">
        <div className="flex items-center space-x-3 mb-6">
          <Globe className="h-6 w-6 text-cyan-400" />
          <h2 className="text-xl font-bold text-white">Top Attack Origins</h2>
        </div>

        <div className="space-y-4">
          {origins.map((origin, index) => (
            <motion.div
              key={origin.country}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="flex items-center justify-between"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-6 bg-slate-700 rounded-sm flex items-center justify-center">
                  <span className="text-xs text-slate-400">{origin.country.slice(0, 2).toUpperCase()}</span>
                </div>
                <span className="text-white font-medium">{origin.country}</span>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="w-24 bg-slate-700 rounded-full h-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${origin.percentage}%` }}
                    transition={{ duration: 1, delay: index * 0.1 }}
                    className="h-full bg-gradient-to-r from-red-500 to-red-400"
                  ></motion.div>
                </div>
                <span className="text-slate-400 text-sm w-8 text-right">{origin.attacks}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default TopAttackOrigins;