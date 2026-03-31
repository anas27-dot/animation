import React from 'react';
import { BarChart3, PieChart, TrendingUp, Users, MessageSquare, Activity } from 'lucide-react';

const DynamicCharts = ({ plan, usage, company, analytics }) => {
  // Calculate chart data based on plan and usage
  const userLimit = plan?.max_users || 2000;
  const userPercentage = Math.round(((usage?.unique_users || 0) / userLimit) * 100);

  // Calculate days used and remaining for current plan
  const totalDays = plan?.duration_days || 365;
  const daysRemaining = plan?.days_remaining || 0;
  const daysUsed = totalDays - daysRemaining;
  const daysPercentage = Math.round((daysUsed / totalDays) * 100);

  // Plan usage data for pie chart - show both users and days
  const planUsageData = [
    {
      name: 'Users Used',
      value: usage?.unique_users || 0,
      maxValue: userLimit,
      percentage: userPercentage,
      color: '#8B5CF6',
      label: 'Users'
    },
    {
      name: 'Days Used',
      value: daysUsed,
      maxValue: totalDays,
      percentage: daysPercentage,
      color: '#10B981',
      label: 'Days'
    }
  ];

  // Message statistics for bar chart
  const messageStats = [
    {
      name: 'Total Messages',
      value: usage?.total_messages || 0,
      color: '#3B82F6',
      icon: MessageSquare
    },
    {
      name: 'Unique Users',
      value: usage?.unique_users || 0,
      color: '#10B981',
      icon: Users
    },
    {
      name: 'User Limit',
      value: userLimit,
      color: '#F59E0B',
      icon: TrendingUp
    }
  ];

  // Calculate max value for bar chart scaling
  const maxValue = Math.max(...messageStats.map(stat => stat.value));

  // Line graph data - simulate usage over time
  const lineGraphData = [
    { day: 'Mon', messages: Math.floor((usage?.total_messages || 0) * 0.1), users: Math.floor((usage?.unique_users || 0) * 0.15) },
    { day: 'Tue', messages: Math.floor((usage?.total_messages || 0) * 0.2), users: Math.floor((usage?.unique_users || 0) * 0.25) },
    { day: 'Wed', messages: Math.floor((usage?.total_messages || 0) * 0.35), users: Math.floor((usage?.unique_users || 0) * 0.4) },
    { day: 'Thu', messages: Math.floor((usage?.total_messages || 0) * 0.5), users: Math.floor((usage?.unique_users || 0) * 0.6) },
    { day: 'Fri', messages: Math.floor((usage?.total_messages || 0) * 0.7), users: Math.floor((usage?.unique_users || 0) * 0.8) },
    { day: 'Sat', messages: Math.floor((usage?.total_messages || 0) * 0.85), users: Math.floor((usage?.unique_users || 0) * 0.9) },
    { day: 'Sun', messages: usage?.total_messages || 0, users: usage?.unique_users || 0 }
  ];

  const maxMessages = Math.max(...lineGraphData.map(d => d.messages));
  const maxUsers = Math.max(...lineGraphData.map(d => d.users));
  
  // Safety check to prevent division by zero
  const safeMaxMessages = maxMessages > 0 ? maxMessages : 1;
  const safeMaxUsers = maxUsers > 0 ? maxUsers : 1;

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      {/* Simple Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-base text-gray-600">Plan usage and performance metrics</p>
        </div>
        <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
          <BarChart3 className="w-4 h-4 text-blue-600" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan Usage Chart */}
        <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 bg-purple-100 rounded flex items-center justify-center">
              <PieChart className="w-3 h-3 text-purple-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Plan Usage</h2>
          </div>
          
          <div className="relative w-56 h-56 mx-auto mb-6">
            <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90 drop-shadow-lg">
              {/* Background circle with glow */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="8"
              />
              {/* Users progress circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={planUsageData[0].color}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 40}`}
                strokeDashoffset={2 * Math.PI * 40 * (1 - userPercentage / 100)}
              />
              {/* Days progress circle (inner) */}
              <circle
                cx="50"
                cy="50"
                r="28"
                fill="none"
                stroke={planUsageData[1].color}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={2 * Math.PI * 28 * (1 - daysPercentage / 100)}
              />
            </svg>

            {/* Center text */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {daysPercentage}%
                </div>
                <div className="text-base text-gray-600">Days</div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {planUsageData.map((item, index) => (
              <div 
                key={index} 
                className="space-y-2"
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <span className="text-base font-medium text-gray-800">{item.label}</span>
                </div>
                <div className="text-base font-bold text-gray-800">
                  {item.value.toLocaleString()} / {item.maxValue.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500">{item.percentage}% used</div>
                <div className="w-full bg-gray-200 rounded-full h-1">
                  <div 
                    className="h-1 rounded-full" 
                    style={{ 
                      width: `${item.percentage}%`, 
                      backgroundColor: item.color 
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Usage Statistics Chart */}
        <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center">
              <Activity className="w-3 h-3 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Weekly Usage Trend</h2>
          </div>

          {/* Line Graph */}
          <div className="relative h-56 mb-6">
            <svg viewBox="0 0 300 140" className="w-full h-full drop-shadow-lg">
              {/* Grid lines */}
              <defs>
                <linearGradient id="messagesGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4" />
                  <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient id="usersGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.4" />
                  <stop offset="50%" stopColor="#10B981" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0.05" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge> 
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              
              {/* Grid lines */}
              {[0, 25, 50, 75, 100].map((y, i) => (
                <line
                  key={i}
                  x1="20"
                  y1={20 + y}
                  x2="280"
                  y2={20 + y}
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="1"
                />
              ))}

              {/* Messages line */}
              <polyline
                fill="none"
                stroke="#3B82F6"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={lineGraphData.map((d, i) => 
                  `${20 + (i * 260 / 6)},${100 - (d.messages / safeMaxMessages) * 80}`
                ).join(' ')}
              />

              {/* Users line */}
              <polyline
                fill="none"
                stroke="#10B981"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={lineGraphData.map((d, i) => 
                  `${20 + (i * 260 / 6)},${100 - (d.users / safeMaxUsers) * 80}`
                ).join(' ')}
              />

              {/* Area under messages line */}
              <polygon
                fill="url(#messagesGradient)"
                points={`20,100 ${lineGraphData.map((d, i) => 
                  `${20 + (i * 260 / 6)},${100 - (d.messages / safeMaxMessages) * 80}`
                ).join(' ')} 280,100`}
              />

              {/* Data points */}
              {lineGraphData.map((d, i) => (
                <g key={i}>
                  {/* Messages point */}
                  <circle
                    cx={20 + (i * 260 / 6)}
                    cy={100 - (d.messages / safeMaxMessages) * 80}
                    r="4"
                    fill="#3B82F6"
                  />
                  
                  {/* Users point */}
                  <circle
                    cx={20 + (i * 260 / 6)}
                    cy={100 - (d.users / safeMaxUsers) * 80}
                    r="4"
                    fill="#10B981"
                  />
                </g>
              ))}
            </svg>

            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-sm text-gray-500 font-medium">
              <span className="text-gray-800">{maxMessages}</span>
              <span>{Math.floor(safeMaxMessages * 0.75)}</span>
              <span>{Math.floor(safeMaxMessages * 0.5)}</span>
              <span>{Math.floor(safeMaxMessages * 0.25)}</span>
              <span className="text-gray-400">0</span>
            </div>
          </div>

          {/* X-axis labels */}
          <div className="flex justify-between text-sm text-gray-500 mb-6">
            {lineGraphData.map((d, i) => (
              <span key={i} className="text-center font-medium">
                {d.day}
              </span>
            ))}
          </div>

          {/* Summary Stats */}
          <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  {usage?.total_messages || 0}
                </div>
                <div className="text-sm text-gray-600 font-medium">Total Messages</div>
              </div>
              <div className="w-px h-8 bg-gray-300"></div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 mb-1">
                  {usage?.unique_users || 0}
                </div>
                <div className="text-sm text-gray-600 font-medium">Unique Users</div>
              </div>
            </div>
          </div>

          {/* Plan Info */}
          {plan && (
            <div className="p-3 bg-gray-50 rounded border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-base font-bold text-yellow-600">
                  Current Plan: {plan.name}
                </span>
              </div>
              <div className="text-sm text-gray-600 font-medium">
                {plan.days_remaining} days remaining
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DynamicCharts;
