import React from 'react';
import { motion } from 'framer-motion';
import { 
  SquareUserRound, 
  CircleUser, 
  Mail, 
  Globe
} from 'lucide-react';

const UserDetailsCard = ({ company }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl shadow-2xl hover:shadow-3xl transition-all duration-700 group"
    >
      {/* Enhanced 3D Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-indigo-600/10"></div>
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full -translate-y-32 translate-x-32 blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 rounded-full translate-y-24 -translate-x-24 blur-2xl group-hover:scale-110 transition-transform duration-1000"></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-gradient-to-br from-emerald-500/15 to-teal-500/15 rounded-full blur-xl group-hover:scale-125 transition-transform duration-1000"></div>
      
      {/* Animated Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px] opacity-30"></div>
      
      {/* Glowing Border Effect */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-indigo-500/30 rounded-3xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
      
      <div className="relative z-10 p-8">
        {/* Enhanced Header with 3D Effects */}
        <div className="mb-10">
          <div className="flex items-center gap-6 mb-6">
            <div className="relative group/icon">
              <motion.div 
                whileHover={{ scale: 1.1, rotate: 5 }}
                className="bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 text-white p-4 rounded-2xl shadow-2xl"
                style={{
                  background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 50%, #1E40AF 100%)',
                  boxShadow: '0 20px 40px rgba(59, 130, 246, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                }}
              >
                <SquareUserRound size={24} />
              </motion.div>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-full border-2 border-slate-900 shadow-lg animate-pulse"></div>
              <div className="absolute -inset-2 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-2xl blur-lg opacity-0 group-hover/icon:opacity-100 transition-opacity duration-500"></div>
            </div>
            <div className="flex-1">
              <motion.h3 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="text-3xl font-bold bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent mb-2"
              >
                User Profile
              </motion.h3>
              <div className="flex items-center gap-3">
                <div className="w-20 h-1 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full"></div>
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-slate-400 font-medium">Active Status</span>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced User Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Company Name */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="group relative bg-gradient-to-br from-slate-800/50 to-slate-700/50 backdrop-blur-xl border border-slate-600/30 rounded-2xl p-6 hover:bg-gradient-to-br hover:from-slate-700/60 hover:to-slate-600/60 hover:shadow-2xl transition-all duration-500 overflow-hidden"
          >
            {/* Animated Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full -translate-y-10 translate-x-10 blur-xl group-hover:scale-150 transition-transform duration-700"></div>
            
            <div className="relative z-10">
              <div className="flex items-start gap-4">
                <motion.div 
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className="flex-shrink-0"
                >
                  <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 text-white p-3 rounded-xl shadow-lg group-hover:shadow-xl transition-all duration-300"
                       style={{ boxShadow: '0 10px 25px rgba(59, 130, 246, 0.3)' }}>
                    <CircleUser size={20} />
                  </div>
                </motion.div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-400 mb-2 group-hover:text-slate-300 transition-colors duration-300">User Name</div>
                  <div className="font-bold text-white text-lg group-hover:text-blue-100 transition-colors duration-300">{company.name}</div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Email */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="group relative bg-gradient-to-br from-slate-800/50 to-slate-700/50 backdrop-blur-xl border border-slate-600/30 rounded-2xl p-6 hover:bg-gradient-to-br hover:from-slate-700/60 hover:to-slate-600/60 hover:shadow-2xl transition-all duration-500 overflow-hidden"
          >
            {/* Animated Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-indigo-400/20 to-purple-400/20 rounded-full -translate-y-10 translate-x-10 blur-xl group-hover:scale-150 transition-transform duration-700"></div>
            
            <div className="relative z-10">
              <div className="flex items-start gap-4">
                <motion.div 
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className="flex-shrink-0"
                >
                  <div className="bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 text-white p-3 rounded-xl shadow-lg group-hover:shadow-xl transition-all duration-300"
                       style={{ boxShadow: '0 10px 25px rgba(147, 51, 234, 0.3)' }}>
                    <Mail size={20} />
                  </div>
                </motion.div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-400 mb-2 group-hover:text-slate-300 transition-colors duration-300">Email Address</div>
                  <div className="font-semibold text-white text-base break-all group-hover:text-indigo-100 transition-colors duration-300">{company.email}</div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Domain */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="group relative bg-gradient-to-br from-slate-800/50 to-slate-700/50 backdrop-blur-xl border border-slate-600/30 rounded-2xl p-6 hover:bg-gradient-to-br hover:from-slate-700/60 hover:to-slate-600/60 hover:shadow-2xl transition-all duration-500 overflow-hidden md:col-span-2 lg:col-span-1"
          >
            {/* Animated Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-emerald-400/20 to-teal-400/20 rounded-full -translate-y-10 translate-x-10 blur-xl group-hover:scale-150 transition-transform duration-700"></div>
            
            <div className="relative z-10">
              <div className="flex items-start gap-4">
                <motion.div 
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className="flex-shrink-0"
                >
                  <div className="bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 text-white p-3 rounded-xl shadow-lg group-hover:shadow-xl transition-all duration-300"
                       style={{ boxShadow: '0 10px 25px rgba(16, 185, 129, 0.3)' }}>
                    <Globe size={20} />
                  </div>
                </motion.div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-400 mb-2 group-hover:text-slate-300 transition-colors duration-300">Website Domain</div>
                  <div className="font-semibold text-white text-base break-all group-hover:text-emerald-100 transition-colors duration-300">{company.url}</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Enhanced Bottom Status */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="relative z-10 mt-10 pt-8 border-t border-slate-600/30"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-3 h-3 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-full animate-pulse shadow-lg"></div>
                <div className="absolute inset-0 w-3 h-3 bg-emerald-400/30 rounded-full animate-ping"></div>
              </div>
              <span className="text-sm font-medium text-slate-300">Profile Active</span>
              <div className="w-1 h-1 bg-slate-500 rounded-full"></div>
              <span className="text-xs text-slate-400">Online</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-xs text-slate-400">
                Last updated: {new Date().toLocaleDateString()}
              </div>
              <div className="w-2 h-2 bg-gradient-to-br from-blue-400 to-indigo-400 rounded-full animate-pulse"></div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default UserDetailsCard;
