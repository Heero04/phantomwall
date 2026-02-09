import React from 'react';
import { AlertTriangle, Globe, Target } from 'lucide-react';
import { motion } from 'framer-motion';

const ThreatStatsGrid = () => {
  const stats = [
    {
      title: 'Attacks Today',
      value: '247',
      icon: AlertTriangle,
      color: 'text-red-400',
      bgColor: 'from-red-500/10 to-red-600/5',
      borderColor: 'from-red-500/30 to-red-600/20',
      animate: true
    },
    {
      title: 'Unique IPs',
      value: '68',
      icon: Globe,
      color: 'text-cyan-400',
      bgColor: 'from-cyan-500/10 to-cyan-600/5',
      borderColor: 'from-cyan-500/30 to-cyan-600/20'
    },
    {
      title: 'Top Threat Type',
      value: 'SSH Brute Force',
      icon: Target,
      color: 'text-violet-400',
      bgColor: 'from-violet-500/10 to-violet-600/5',
      borderColor: 'from-violet-500/30 to-violet-600/20',
      isText: true
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: index * 0.1 }}
          className="relative bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-xl p-6 overflow-hidden group hover:border-slate-600/50 transition-all duration-300"
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${stat.bgColor}`}></div>
          <div className={`absolute inset-0 border border-gradient-to-br ${stat.borderColor} rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <stat.icon className={`h-6 w-6 ${stat.color}`} />
              {stat.animate && (
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-2 h-2 bg-red-400 rounded-full"
                ></motion.div>
              )}
            </div>
            
            <div className="space-y-2">
              <h3 className="text-slate-400 text-sm font-medium">{stat.title}</h3>
              <div className={`${stat.isText ? 'text-lg' : 'text-2xl'} font-bold text-white`}>
                {stat.animate ? (
                  <motion.span
                    animate={{ opacity: [1, 0.7, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    {stat.value}
                  </motion.span>
                ) : (
                  stat.value
                )}
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default ThreatStatsGrid;