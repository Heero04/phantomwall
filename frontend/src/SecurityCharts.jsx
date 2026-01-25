import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

// Sample security data for testing
const timelineData = [
  { time: '00:00', alerts: 12, blocked: 8, allowed: 4 },
  { time: '04:00', alerts: 25, blocked: 18, allowed: 7 },
  { time: '08:00', alerts: 45, blocked: 35, allowed: 10 },
  { time: '12:00', alerts: 67, blocked: 52, allowed: 15 },
  { time: '16:00', alerts: 89, blocked: 71, allowed: 18 },
  { time: '20:00', alerts: 34, blocked: 28, allowed: 6 },
];

const topSourcesData = [
  { ip: '192.168.1.100', attacks: 156, country: 'US' },
  { ip: '203.0.113.45', attacks: 98, country: 'CN' },
  { ip: '198.51.100.22', attacks: 76, country: 'RU' },
  { ip: '10.0.0.55', attacks: 54, country: 'KR' },
  { ip: '172.16.0.10', attacks: 43, country: 'IR' },
];

const severityData = [
  { name: 'Critical', value: 45, color: '#ff4757' },
  { name: 'High', value: 89, color: '#ff6b6b' },
  { name: 'Medium', value: 156, color: '#ffa502' },
  { name: 'Low', value: 234, color: '#26de81' },
];

export const SecurityTimeline = () => (
  <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={timelineData}>
      <defs>
        <linearGradient id="alertsGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#ff6b6b" stopOpacity={0.8}/>
          <stop offset="95%" stopColor="#ff6b6b" stopOpacity={0.1}/>
        </linearGradient>
        <linearGradient id="blockedGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#4ecdc4" stopOpacity={0.8}/>
          <stop offset="95%" stopColor="#4ecdc4" stopOpacity={0.1}/>
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
      <XAxis dataKey="time" stroke="#888" />
      <YAxis stroke="#888" />
      <Tooltip 
        contentStyle={{ 
          backgroundColor: '#1a1a1a', 
          border: '1px solid #333',
          borderRadius: '8px',
          color: '#fff'
        }} 
      />
      <Legend />
      <Area
        type="monotone"
        dataKey="alerts"
        stroke="#ff6b6b"
        fillOpacity={1}
        fill="url(#alertsGradient)"
        name="Total Alerts"
      />
      <Area
        type="monotone"
        dataKey="blocked"
        stroke="#4ecdc4"
        fillOpacity={1}
        fill="url(#blockedGradient)"
        name="Blocked"
      />
    </AreaChart>
  </ResponsiveContainer>
);

export const TopSourcesChart = () => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={topSourcesData} layout="horizontal">
      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
      <XAxis type="number" stroke="#888" />
      <YAxis dataKey="ip" type="category" stroke="#888" width={100} />
      <Tooltip 
        contentStyle={{ 
          backgroundColor: '#1a1a1a', 
          border: '1px solid #333',
          borderRadius: '8px',
          color: '#fff'
        }} 
      />
      <Bar dataKey="attacks" fill="#45b7d1" radius={[0, 4, 4, 0]} />
    </BarChart>
  </ResponsiveContainer>
);

export const SeverityPieChart = () => (
  <ResponsiveContainer width="100%" height="100%">
    <PieChart>
      <Pie
        data={severityData}
        cx="50%"
        cy="50%"
        outerRadius={80}
        fill="#8884d8"
        dataKey="value"
        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
      >
        {severityData.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={entry.color} />
        ))}
      </Pie>
      <Tooltip 
        contentStyle={{ 
          backgroundColor: '#1a1a1a', 
          border: '1px solid #333',
          borderRadius: '8px',
          color: '#fff'
        }} 
      />
    </PieChart>
  </ResponsiveContainer>
);

export const AttackTrendChart = () => (
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={timelineData}>
      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
      <XAxis dataKey="time" stroke="#888" />
      <YAxis stroke="#888" />
      <Tooltip 
        contentStyle={{ 
          backgroundColor: '#1a1a1a', 
          border: '1px solid #333',
          borderRadius: '8px',
          color: '#fff'
        }} 
      />
      <Legend />
      <Line 
        type="monotone" 
        dataKey="alerts" 
        stroke="#ff6b6b" 
        strokeWidth={3}
        dot={{ fill: '#ff6b6b', strokeWidth: 2, r: 4 }}
        name="Alerts"
      />
      <Line 
        type="monotone" 
        dataKey="blocked" 
        stroke="#4ecdc4" 
        strokeWidth={2}
        dot={{ fill: '#4ecdc4', strokeWidth: 2, r: 3 }}
        name="Blocked"
      />
    </LineChart>
  </ResponsiveContainer>
);