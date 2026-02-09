import React from 'react';
import { Eye, Brain, Terminal } from 'lucide-react';
import { motion } from 'framer-motion';

const QuickActions = () => {
  const actions = [
    {
      title: 'View All Alerts',
      icon: Eye,
      color: 'from-cyan-500/20 to-cyan-600/10',
      borderColor: 'from-cyan-500/40 to-cyan-600/30',
      iconColor: 'text-cyan-400'
    },
    {
      title: 'AI Threat Analysis',
      icon: Brain,
      color: 'from-violet-500/20 to-violet-600/10',
      borderColor: 'from-violet-500/40 to-violet-600/30',
      iconColor: 'text-violet-400'
    },
    {
      title: 'Open Terminal',
      icon: Terminal,
      color: 'from-green-500/20 to-green-600/10',
      borderColor: 'from-green-500/40 to-green-600/30',
      iconColor: 'text-green-400'
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className="grid grid-cols-1 md:grid-cols-3 gap-4"
    >
      {actions.map((action, index) => (
        <motion.button
          key={action.title}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: index * 0.1 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="relative bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-xl p-6 overflow-hidden group hover:border-slate-600/50 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900"
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${action.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
          <div className={`absolute inset-0 border border-gradient-to-br ${action.borderColor} rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
          
          <div className="relative z-10 flex flex-col items-center space-y-3">
            <div className={`p-3 rounded-lg bg-slate-900/50 group-hover:bg-slate-900/70 transition-colors duration-300`}>
              <action.icon className={`h-6 w-6 ${action.iconColor}`} />
            </div>
            <span className="text-white font-medium text-sm">{action.title}</span>
          </div>
        </motion.button>
      ))}
    </motion.div>
  );
};

export default QuickActions;