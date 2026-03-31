// import React, { useState, useEffect } from 'react';
// import { motion, AnimatePresence } from 'framer-motion';
// import { 
//   Wifi, 
//   WifiOff, 
//   Activity, 
//   Clock, 
//   Zap, 
//   Shield, 
//   AlertCircle,
//   CheckCircle,
//   RefreshCw,
//   Database,
//   Cpu,
//   Server,
//   Users,
//   MessageSquare
// } from 'lucide-react';

// const RealTimeStatus = ({ analytics, lastUpdated }) => {
//   const [isOnline, setIsOnline] = useState(true);
//   const [connectionStatus, setConnectionStatus] = useState('excellent');
//   const [lastPing, setLastPing] = useState(Date.now());

//   // Simulate connection status
//   useEffect(() => {
//     const interval = setInterval(() => {
//       setLastPing(Date.now());
//       setIsOnline(Math.random() > 0.05); // 95% uptime simulation
      
//       // Determine connection quality
//       const quality = Math.random();
//       if (quality > 0.8) setConnectionStatus('excellent');
//       else if (quality > 0.6) setConnectionStatus('good');
//       else if (quality > 0.4) setConnectionStatus('fair');
//       else setConnectionStatus('poor');
//     }, 5000);

//     return () => clearInterval(interval);
//   }, []);

//   const getStatusColor = () => {
//     if (!isOnline) return 'red';
//     switch (connectionStatus) {
//       case 'excellent': return 'green';
//       case 'good': return 'blue';
//       case 'fair': return 'yellow';
//       case 'poor': return 'orange';
//       default: return 'gray';
//     }
//   };

//   const getStatusIcon = () => {
//     if (!isOnline) return WifiOff;
//     switch (connectionStatus) {
//       case 'excellent': return CheckCircle;
//       case 'good': return Wifi;
//       case 'fair': return Activity;
//       case 'poor': return AlertCircle;
//       default: return Wifi;
//     }
//   };

//   const StatusIcon = getStatusIcon();
//   const statusColor = getStatusColor();

//   return (
//     <motion.div
//       initial={{ opacity: 0, y: 20 }}
//       animate={{ opacity: 1, y: 0 }}
//       className="fixed top-4 right-4 z-50"
//     >
//       <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-xl rounded-2xl p-4 border border-gray-700/50 shadow-2xl">
//         {/* Header */}
//         <div className="flex items-center justify-between mb-4">
//           <div className="flex items-center gap-3">
//             <motion.div
//               animate={{ 
//                 scale: isOnline ? [1, 1.1, 1] : [1, 0.9, 1],
//                 rotate: isOnline ? 0 : [0, -10, 10, 0]
//               }}
//               transition={{ 
//                 duration: 2, 
//                 repeat: Infinity,
//                 ease: "easeInOut"
//               }}
//               className={`p-2 rounded-xl ${
//                 statusColor === 'green' ? 'bg-green-500/20' :
//                 statusColor === 'blue' ? 'bg-blue-500/20' :
//                 statusColor === 'yellow' ? 'bg-yellow-500/20' :
//                 statusColor === 'orange' ? 'bg-orange-500/20' :
//                 'bg-red-500/20'
//               }`}
//             >
//               <StatusIcon className={`w-5 h-5 ${
//                 statusColor === 'green' ? 'text-green-400' :
//                 statusColor === 'blue' ? 'text-blue-400' :
//                 statusColor === 'yellow' ? 'text-yellow-400' :
//                 statusColor === 'orange' ? 'text-orange-400' :
//                 'text-red-400'
//               }`} />
//             </motion.div>
            
//             <div>
//               <div className="text-sm font-semibold text-white">
//                 {isOnline ? 'System Online' : 'System Offline'}
//               </div>
//               <div className={`text-xs ${
//                 statusColor === 'green' ? 'text-green-400' :
//                 statusColor === 'blue' ? 'text-blue-400' :
//                 statusColor === 'yellow' ? 'text-yellow-400' :
//                 statusColor === 'orange' ? 'text-orange-400' :
//                 'text-red-400'
//               }`}>
//                 {isOnline ? `Connection: ${connectionStatus}` : 'Connection lost'}
//               </div>
//             </div>
//           </div>

//           <motion.div
//             animate={{ rotate: 360 }}
//             transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
//             className="text-gray-400"
//           >
//             <RefreshCw className="w-4 h-4" />
//           </motion.div>
//         </div>

//         {/* Real-time Metrics */}
//         <div className="space-y-3">
//           {/* System Health */}
//           <div className="flex items-center justify-between">
//             <div className="flex items-center gap-2">
//               <Shield className="w-4 h-4 text-purple-400" />
//               <span className="text-xs text-gray-400">System Health</span>
//             </div>
//             <div className="flex items-center gap-2">
//               <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
//                 <motion.div
//                   className={`h-full ${
//                     (analytics?.realTimeStats?.systemHealth || 0) > 80 ? 'bg-green-500' :
//                     (analytics?.realTimeStats?.systemHealth || 0) > 60 ? 'bg-yellow-500' :
//                     'bg-red-500'
//                   }`}
//                   initial={{ width: 0 }}
//                   animate={{ width: `${analytics?.realTimeStats?.systemHealth || 0}%` }}
//                   transition={{ duration: 1, delay: 0.5 }}
//                 />
//               </div>
//               <span className="text-xs font-semibold text-white">
//                 {analytics?.realTimeStats?.systemHealth || 0}%
//               </span>
//             </div>
//           </div>

//           {/* Active Users */}
//           <div className="flex items-center justify-between">
//             <div className="flex items-center gap-2">
//               <Users className="w-4 h-4 text-green-400" />
//               <span className="text-xs text-gray-400">Active Users</span>
//             </div>
//             <span className="text-xs font-semibold text-white">
//               {analytics?.userEngagement?.activeUsers || 0}
//             </span>
//           </div>

//           {/* Messages Last Hour */}
//           <div className="flex items-center justify-between">
//             <div className="flex items-center gap-2">
//               <MessageSquare className="w-4 h-4 text-blue-400" />
//               <span className="text-xs text-gray-400">Messages (1h)</span>
//             </div>
//             <span className="text-xs font-semibold text-white">
//               {analytics?.realTimeStats?.messagesLastHour || 0}
//             </span>
//           </div>

//           {/* Response Time */}
//           <div className="flex items-center justify-between">
//             <div className="flex items-center gap-2">
//               <Clock className="w-4 h-4 text-orange-400" />
//               <span className="text-xs text-gray-400">Avg Response</span>
//             </div>
//             <span className="text-xs font-semibold text-white">
//               {analytics?.performanceMetrics?.avgResponseTime || 0}s
//             </span>
//           </div>

//           {/* Last Update */}
//           <div className="flex items-center justify-between pt-2 border-t border-gray-700/50">
//             <div className="flex items-center gap-2">
//               <Database className="w-4 h-4 text-gray-400" />
//               <span className="text-xs text-gray-400">Last Update</span>
//             </div>
//             <span className="text-xs text-gray-500">
//               {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'Never'}
//             </span>
//           </div>
//         </div>

//         {/* Connection Indicator */}
//         <motion.div
//           className={`mt-4 h-1 rounded-full ${
//             statusColor === 'green' ? 'bg-green-500' :
//             statusColor === 'blue' ? 'bg-blue-500' :
//             statusColor === 'yellow' ? 'bg-yellow-500' :
//             statusColor === 'orange' ? 'bg-orange-500' :
//             'bg-red-500'
//           }`}
//           animate={{
//             opacity: [0.5, 1, 0.5],
//             scaleX: [0.8, 1, 0.8]
//           }}
//           transition={{
//             duration: 2,
//             repeat: Infinity,
//             ease: "easeInOut"
//           }}
//         />
//       </div>
//     </motion.div>
//   );
// };

// export default RealTimeStatus;
