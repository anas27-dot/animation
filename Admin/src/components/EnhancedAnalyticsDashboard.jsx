import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Users, 
  MessageSquare, 
  Activity,
  Clock,
  Target,
  Zap,
  Star,
  Sparkles,
  Layers,
  Cpu,
  Database,
  Shield,
  Rocket,
  Flame,
  Wind,
  Waves,
  Mountain,
  Sun,
  Moon,
  Cloud,
  Droplets,
  Snowflake,
  Leaf,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Download,
  Filter,
  Calendar,
  Eye,
  EyeOff
} from 'lucide-react';

const EnhancedAnalyticsDashboard = ({ analytics, plan, usage, company }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('7d');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);

  // Tab configurations
  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3, color: 'blue' },
    { id: 'users', label: 'Users', icon: Users, color: 'green' },
    { id: 'messages', label: 'Messages', icon: MessageSquare, color: 'purple' },
    { id: 'performance', label: 'Performance', icon: Activity, color: 'orange' },
    { id: 'trends', label: 'Trends', icon: TrendingUp, color: 'cyan' }
  ];

  // Time range options
  const timeRanges = [
    { id: '24h', label: '24 Hours', days: 1 },
    { id: '7d', label: '7 Days', days: 7 },
    { id: '30d', label: '30 Days', days: 30 },
    { id: '90d', label: '90 Days', days: 90 }
  ];

  // Animation trigger
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationKey(prev => prev + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Enhanced chart data generation
  const generateEnhancedChartData = (data, type = 'line') => {
    if (!data || data.length === 0) return [];

    switch (type) {
      case 'line':
        return data.map((item, index) => {
          const x = (index / (data.length - 1)) * 200;
          const y = 40 - (item.value / Math.max(...data.map(d => d.value))) * 30;
          return `${x},${y}`;
        }).join(' ');

      case 'bar':
        return data.map((item, index) => ({
          x: (index / data.length) * 200,
          y: 40 - (item.value / Math.max(...data.map(d => d.value))) * 30,
          height: (item.value / Math.max(...data.map(d => d.value))) * 30,
          value: item.value,
          label: item.label
        }));

      case 'pie':
        const total = data.reduce((sum, item) => sum + item.value, 0);
        let currentAngle = 0;
        return data.map((item, index) => {
          const percentage = (item.value / total) * 100;
          const angle = (item.value / total) * 360;
          const startAngle = currentAngle;
          const endAngle = currentAngle + angle;
          currentAngle += angle;

          return {
            ...item,
            percentage,
            startAngle,
            endAngle,
            angle
          };
        });

      default:
        return data;
    }
  };

  // 3D Floating Elements
  const floatingIcons = [
    { icon: Zap, delay: 0, duration: 3 },
    { icon: Star, delay: 0.5, duration: 4 },
    { icon: Sparkles, delay: 1, duration: 2.5 },
    { icon: Layers, delay: 1.5, duration: 3.5 },
    { icon: Cpu, delay: 2, duration: 2 },
    { icon: Database, delay: 2.5, duration: 4.5 },
    { icon: Shield, delay: 3, duration: 3.2 },
    { icon: Rocket, delay: 3.5, duration: 2.8 }
  ];

  // Overview Tab Content
  const OverviewTab = () => (
    <div className="space-y-8">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-2xl p-6 border border-blue-500/20"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <MessageSquare className="w-6 h-6 text-blue-400" />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">
                {analytics?.performanceMetrics?.totalMessages || 0}
              </div>
              <div className="text-sm text-blue-400">Total Messages</div>
            </div>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (analytics?.performanceMetrics?.totalMessages || 0) / 1000 * 100)}%` }}
              transition={{ duration: 1, delay: 0.5 }}
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-2xl p-6 border border-green-500/20"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-500/20 rounded-xl">
              <Users className="w-6 h-6 text-green-400" />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">
                {analytics?.userEngagement?.totalUsers || 0}
              </div>
              <div className="text-sm text-green-400">Unique Users</div>
            </div>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (analytics?.userEngagement?.totalUsers || 0) / 100 * 100)}%` }}
              transition={{ duration: 1, delay: 0.7 }}
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 rounded-2xl p-6 border border-purple-500/20"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-500/20 rounded-xl">
              <Activity className="w-6 h-6 text-purple-400" />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">
                {analytics?.realTimeStats?.systemHealth || 0}%
              </div>
              <div className="text-sm text-purple-400">System Health</div>
            </div>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 to-violet-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${analytics?.realTimeStats?.systemHealth || 0}%` }}
              transition={{ duration: 1, delay: 0.9 }}
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 rounded-2xl p-6 border border-orange-500/20"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-500/20 rounded-xl">
              <Clock className="w-6 h-6 text-orange-400" />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">
                {analytics?.performanceMetrics?.avgResponseTime || 0}s
              </div>
              <div className="text-sm text-orange-400">Avg Response</div>
            </div>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, 100 - (analytics?.performanceMetrics?.avgResponseTime || 0) / 2)}%` }}
              transition={{ duration: 1, delay: 1.1 }}
            />
          </div>
        </motion.div>
      </div>

      {/* Enhanced Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Daily Activity Chart */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-3xl p-8 border border-gray-700/50 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Daily Activity</h3>
              <p className="text-gray-400 text-sm">Messages over the last 7 days</p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <BarChart3 className="w-6 h-6 text-blue-400" />
            </div>
          </div>

          <div className="h-64 relative">
            <svg viewBox="0 0 300 200" className="w-full h-full">
              <defs>
                <linearGradient id="dailyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient id="dailyLine" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.6" />
                  <stop offset="50%" stopColor="#60A5FA" stopOpacity="1" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.6" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              {[0, 25, 50, 75, 100].map((y, i) => (
                <line
                  key={i}
                  x1="20"
                  y1={20 + y * 1.5}
                  x2="280"
                  y2={20 + y * 1.5}
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="1"
                />
              ))}

              {/* Chart area */}
              {analytics?.dailyStats && (
                <>
                  <polygon
                    fill="url(#dailyGradient)"
                    points={`20,170 ${analytics.dailyStats.map((day, i) => 
                      `${20 + (i * 260 / 6)},${170 - (day.totalMessages / Math.max(...analytics.dailyStats.map(d => d.totalMessages))) * 120}`
                    ).join(' ')} 280,170`}
                  />
                  
                  <motion.polyline
                    fill="none"
                    stroke="url(#dailyLine)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={analytics.dailyStats.map((day, i) => 
                      `${20 + (i * 260 / 6)},${170 - (day.totalMessages / Math.max(...analytics.dailyStats.map(d => d.totalMessages))) * 120}`
                    ).join(' ')}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2, delay: 0.8 }}
                  />

                  {/* Data points */}
                  {analytics.dailyStats.map((day, i) => {
                    const x = 20 + (i * 260 / 6);
                    const y = 170 - (day.totalMessages / Math.max(...analytics.dailyStats.map(d => d.totalMessages))) * 120;
                    return (
                      <motion.circle
                        key={i}
                        cx={x}
                        cy={y}
                        r="4"
                        fill="#3B82F6"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 1 + (i * 0.1) }}
                      >
                        <animate 
                          attributeName="r" 
                          values="4;6;4" 
                          dur="2s" 
                          repeatCount="indefinite" 
                          begin={`${i * 0.2}s`} 
                        />
                      </motion.circle>
                    );
                  })}
                </>
              )}
            </svg>
          </div>
        </motion.div>

        {/* User Engagement Chart */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-3xl p-8 border border-gray-700/50 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">User Engagement</h3>
              <p className="text-gray-400 text-sm">Active vs Total Users</p>
            </div>
            <div className="p-3 bg-green-500/20 rounded-xl">
              <PieChart className="w-6 h-6 text-green-400" />
            </div>
          </div>

          <div className="h-64 flex items-center justify-center">
            <div className="relative w-48 h-48">
              {/* Background circle */}
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="8"
                />
                
                {/* Active users */}
                <motion.circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={2 * Math.PI * 40 * (1 - (analytics?.userEngagement?.activeUsers || 0) / (analytics?.userEngagement?.totalUsers || 1))}
                  initial={{ strokeDashoffset: 2 * Math.PI * 40 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 40 * (1 - (analytics?.userEngagement?.activeUsers || 0) / (analytics?.userEngagement?.totalUsers || 1)) }}
                  transition={{ duration: 2, delay: 1 }}
                />
              </svg>
              
              {/* Center text */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">
                    {analytics?.userEngagement?.activeUsers || 0}
                  </div>
                  <div className="text-sm text-gray-400">Active Users</div>
                  <div className="text-xs text-green-400 mt-1">
                    {Math.round((analytics?.userEngagement?.activeUsers || 0) / (analytics?.userEngagement?.totalUsers || 1) * 100)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 overflow-hidden">
      {/* 3D Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Floating Icons */}
        {floatingIcons.map((item, index) => (
          <motion.div
            key={index}
            className="absolute text-white/5"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -20, 0],
              rotate: [0, 360],
              scale: [1, 1.1, 1]
            }}
            transition={{
              duration: item.duration,
              delay: item.delay,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <item.icon size={40} />
          </motion.div>
        ))}

        {/* Gradient Orbs */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-green-500/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-full blur-2xl animate-pulse"></div>
      </div>

      <div className="relative z-10 p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent mb-2">
              Analytics Dashboard
            </h1>
            <p className="text-gray-400">Real-time insights and performance metrics</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Time Range Selector */}
            <div className="flex items-center gap-2 bg-gray-800/50 rounded-xl p-2 border border-gray-700/50">
              {timeRanges.map((range) => (
                <button
                  key={range.id}
                  onClick={() => setTimeRange(range.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    timeRange === range.id
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setIsRefreshing(true);
                setTimeout(() => setIsRefreshing(false), 1000);
              }}
              className="p-3 bg-gray-800/50 rounded-xl border border-gray-700/50 text-gray-400 hover:text-white hover:bg-gray-700/50 transition-all"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </motion.button>
          </div>
        </motion.div>

        {/* Tab Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2 mb-8 bg-gray-800/30 rounded-2xl p-2 border border-gray-700/50 backdrop-blur-xl"
        >
          {tabs.map((tab) => (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-6 py-3 rounded-xl font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </motion.button>
          ))}
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'overview' && <OverviewTab />}
            {/* Add other tab components here */}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default EnhancedAnalyticsDashboard;
