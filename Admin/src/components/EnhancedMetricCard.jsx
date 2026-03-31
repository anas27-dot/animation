import React from 'react';
import { motion } from 'framer-motion';
import { 
  MessageSquare, 
  Users, 
  Activity, 
  Zap, 
  Target, 
  Star, 
  TrendingUp, 
  Clock,
  Shield,
  Cpu,
  Database,
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
  Leaf
} from 'lucide-react';

const EnhancedMetricCard = ({ 
  title, 
  value, 
  subtitle, 
  trend, 
  icon: Icon, 
  color = "blue", 
  gradient = "from-blue-500 to-indigo-600",
  bgGradient = "from-blue-500/10 to-indigo-500/10",
  glowColor = "blue-500/20",
  chartData,
  isAnimated = true,
  delay = 0,
  size = "normal"
}) => {
  const colorVariants = {
    blue: {
      icon: "text-blue-400",
      bg: "from-blue-500/20 to-indigo-500/20",
      glow: "blue-500/30",
      accent: "blue-400"
    },
    green: {
      icon: "text-green-400",
      bg: "from-green-500/20 to-emerald-500/20",
      glow: "green-500/30",
      accent: "green-400"
    },
    purple: {
      icon: "text-purple-400",
      bg: "from-purple-500/20 to-violet-500/20",
      glow: "purple-500/30",
      accent: "purple-400"
    },
    orange: {
      icon: "text-orange-400",
      bg: "from-orange-500/20 to-amber-500/20",
      glow: "orange-500/30",
      accent: "orange-400"
    },
    red: {
      icon: "text-red-400",
      bg: "from-red-500/20 to-rose-500/20",
      glow: "red-500/30",
      accent: "red-400"
    },
    cyan: {
      icon: "text-cyan-400",
      bg: "from-cyan-500/20 to-teal-500/20",
      glow: "cyan-500/30",
      accent: "cyan-400"
    }
  };

  const sizeVariants = {
    small: "p-4",
    normal: "p-6",
    large: "p-8"
  };

  const iconSizeVariants = {
    small: "w-8 h-8",
    normal: "w-12 h-12",
    large: "w-16 h-16"
  };

  const textSizeVariants = {
    small: "text-lg",
    normal: "text-2xl",
    large: "text-3xl"
  };

  const colors = colorVariants[color] || colorVariants.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.6, 
        delay: delay,
        type: "spring",
        stiffness: 100,
        damping: 15
      }}
      whileHover={{ 
        scale: 1.02,
        y: -5,
        transition: { duration: 0.3 }
      }}
      className={`relative group bg-gradient-to-br from-gray-800/90 via-gray-800/80 to-gray-900/90 backdrop-blur-xl rounded-3xl ${sizeVariants[size]} shadow-2xl border border-gray-700/50 overflow-hidden`}
      style={{
        transformStyle: 'preserve-3d',
        perspective: '1000px'
      }}
    >
      {/* 3D Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-800/50 via-gray-700/30 to-gray-800/50"></div>
      
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%)] bg-[length:20px_20px] animate-pulse"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_70%)]"></div>
      </div>

      {/* Glowing Border Effect */}
      <div className={`absolute -inset-0.5 bg-gradient-to-r from-${colors.accent}/30 via-${colors.accent}/20 to-${colors.accent}/30 rounded-3xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-1000`}></div>
      
      {/* 3D Floating Orbs */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full -translate-y-16 translate-x-16 blur-2xl group-hover:scale-150 transition-transform duration-1000"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 rounded-full translate-y-12 -translate-x-12 blur-xl group-hover:scale-150 transition-transform duration-1000"></div>
      
      {/* Main Content */}
      <div className="relative z-10">
        {/* Header with Icon */}
        <div className="flex items-center justify-between mb-6">
          <motion.div
            whileHover={{ 
              scale: 1.1, 
              rotate: 5,
              transition: { duration: 0.3 }
            }}
            className={`relative ${iconSizeVariants[size]} bg-gradient-to-br ${gradient} rounded-2xl shadow-2xl flex items-center justify-center`}
            style={{
              boxShadow: `0 20px 40px rgba(59, 130, 246, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)`
            }}
          >
            <Icon className={`${colors.icon} ${size === 'small' ? 'w-4 h-4' : size === 'large' ? 'w-8 h-8' : 'w-6 h-6'}`} />
            
            {/* Animated Ring */}
            <motion.div
              className="absolute -inset-2 border-2 border-blue-400/30 rounded-2xl"
              animate={{ 
                rotate: 360,
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                duration: 4,
                repeat: Infinity,
                ease: "linear"
              }}
            />
            
            {/* Pulsing Dot */}
            <motion.div
              className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full"
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.7, 1, 0.7]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </motion.div>

          {/* Trend Indicator */}
          {trend && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: delay + 0.3 }}
              className={`flex items-center gap-1 px-3 py-1 rounded-full ${
                trend > 0 
                  ? 'bg-green-500/20 text-green-400' 
                  : trend < 0 
                    ? 'bg-red-500/20 text-red-400' 
                    : 'bg-gray-500/20 text-gray-400'
              }`}
            >
              {trend > 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : trend < 0 ? (
                <motion.div
                  animate={{ rotate: 180 }}
                  transition={{ duration: 0.3 }}
                >
                  <TrendingUp className="w-3 h-3" />
                </motion.div>
              ) : (
                <Activity className="w-3 h-3" />
              )}
              <span className="text-xs font-semibold">
                {Math.abs(trend)}%
              </span>
            </motion.div>
          )}
        </div>

        {/* Value Display */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + 0.2 }}
          className="mb-2"
        >
          <motion.div
            className={`font-bold text-white ${textSizeVariants[size]} mb-1`}
            animate={isAnimated ? {
              textShadow: [
                "0 0 20px rgba(59, 130, 246, 0.5)",
                "0 0 30px rgba(59, 130, 246, 0.8)",
                "0 0 20px rgba(59, 130, 246, 0.5)"
              ]
            } : {}}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            {typeof value === 'number' ? value.toLocaleString() : value}
          </motion.div>
          
          <div className="text-sm font-medium text-gray-400 mb-4">
            {subtitle}
          </div>
        </motion.div>

        {/* Mini Chart */}
        {chartData && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ delay: delay + 0.4, duration: 0.5 }}
            className="h-16 bg-gradient-to-r from-gray-700/50 to-gray-600/50 rounded-xl p-3 relative overflow-hidden"
          >
            {/* Chart Background */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-xl"></div>
            
            {/* Animated Chart Line */}
            <svg viewBox="0 0 200 40" className="w-full h-full">
              <defs>
                <linearGradient id={`chartGradient-${title}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={colors.accent} stopOpacity="0.6" />
                  <stop offset="50%" stopColor={colors.accent} stopOpacity="1" />
                  <stop offset="100%" stopColor={colors.accent} stopOpacity="0.6" />
                  <animateTransform 
                    attributeName="gradientTransform" 
                    type="translate" 
                    values="0 0; 200 0; 0 0" 
                    dur="3s" 
                    repeatCount="indefinite" 
                  />
                </linearGradient>
              </defs>
              
              <motion.polyline
                fill="none"
                stroke={`url(#chartGradient-${title})`}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={chartData}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2, delay: delay + 0.5 }}
              />
              
              {/* Animated Dots */}
              {chartData.split(' ').map((point, index) => {
                const [x, y] = point.split(',').map(Number);
                return (
                  <motion.circle
                    key={index}
                    cx={x}
                    cy={y}
                    r="2"
                    fill={colors.accent}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ 
                      delay: delay + 0.5 + (index * 0.1),
                      duration: 0.3
                    }}
                  >
                    <animate 
                      attributeName="r" 
                      values="2;4;2" 
                      dur="2s" 
                      repeatCount="indefinite" 
                      begin={`${index * 0.2}s`} 
                    />
                    <animate 
                      attributeName="opacity" 
                      values="0.6;1;0.6" 
                      dur="2s" 
                      repeatCount="indefinite" 
                      begin={`${index * 0.2}s`} 
                    />
                  </motion.circle>
                );
              })}
            </svg>
          </motion.div>
        )}

        {/* Bottom Status */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay + 0.6 }}
          className="flex items-center justify-between mt-4 pt-4 border-t border-gray-600/30"
        >
          <div className="flex items-center gap-2">
            <motion.div
              className="w-2 h-2 bg-green-400 rounded-full"
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.7, 1, 0.7]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <span className="text-xs text-gray-400 font-medium">Live</span>
          </div>
          
          <div className="text-xs text-gray-500">
            {new Date().toLocaleTimeString()}
          </div>
        </motion.div>
      </div>

      {/* 3D Shadow */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/5 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000 transform-gpu" 
           style={{transform: 'translateZ(-2px) translateY(4px)'}}></div>
    </motion.div>
  );
};

export default EnhancedMetricCard;
