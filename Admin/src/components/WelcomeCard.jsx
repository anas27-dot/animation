import React from 'react';
import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const WelcomeCard = () => {

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative overflow-visible bg-gradient-to-br from-purple-50 via-purple-100 to-indigo-50 rounded-2xl shadow-2xl border border-purple-200/50 p-4 md:p-6 mb-6 md:mb-8 backdrop-blur-sm"
    >
      
      {/* Floating Elements */}
      <motion.div 
        animate={{ 
          y: [0, -10, 0],
          rotate: [0, 5, 0]
        }}
        transition={{ 
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute top-4 right-4 w-16 h-16 bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 rounded-full opacity-30 shadow-lg"
      ></motion.div>
      <motion.div 
        animate={{ 
          y: [0, 10, 0],
          rotate: [0, -5, 0]
        }}
        transition={{ 
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1
        }}
        className="absolute bottom-4 left-4 w-12 h-12 bg-gradient-to-br from-purple-400 via-purple-500 to-purple-600 rounded-full opacity-30 shadow-lg"
      ></motion.div>
      <motion.div 
        animate={{ 
          y: [0, -15, 0],
          rotate: [0, 8, 0]
        }}
        transition={{ 
          duration: 2.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.5
        }}
        className="absolute top-8 left-8 w-8 h-8 bg-gradient-to-br from-pink-400 via-rose-400 to-rose-500 rounded-full opacity-25 shadow-md"
      ></motion.div>
      <motion.div 
        animate={{ 
          y: [0, 12, 0],
          rotate: [0, -6, 0]
        }}
        transition={{ 
          duration: 3.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.5
        }}
        className="absolute bottom-8 right-8 w-10 h-10 bg-gradient-to-br from-green-400 via-emerald-400 to-emerald-500 rounded-full opacity-25 shadow-md"
      ></motion.div>
      <motion.div 
        animate={{ 
          y: [0, -8, 0],
          rotate: [0, 4, 0]
        }}
        transition={{ 
          duration: 2.8,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2
        }}
        className="absolute top-12 left-1/2 w-6 h-6 bg-gradient-to-br from-yellow-400 via-orange-400 to-orange-500 rounded-full opacity-20 shadow-sm"
      ></motion.div>
      
      {/* Main Content */}
      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between min-h-[200px]">
        {/* Left Content */}
        <div className="flex-1 mb-6 lg:mb-0 lg:mr-12 relative">
          {/* Welcome Message */}
          {/* Decorative Background Element */}
          <div className="absolute -top-4 -left-4 w-24 h-24 bg-gradient-to-br from-purple-200/30 to-indigo-200/30 rounded-full blur-xl"></div>
          
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mb-6 relative z-10"
          >
            <div className="inline-block">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-purple-900 mb-4 bg-gradient-to-r from-purple-900 via-purple-800 to-indigo-900 bg-clip-text text-transparent relative">
                Welcome Back!
                <div className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-indigo-400 rounded-full opacity-60"></div>
              </h2>
            </div>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mb-4"
            >
              <p style={{marginTop: '15px'}}>
              Experience the power of intelligent chatbots that engage, assist, and delight your users. Monitor performance, track insights, and watch your conversations transform into meaningful connections.
              </p>
            </motion.div>
          </motion.div>
          
          {/* Decorative Elements */}
          <div className="absolute bottom-0 right-0 w-16 h-16 bg-gradient-to-br from-blue-200/20 to-purple-200/20 rounded-full blur-lg"></div>
        </div>

        {/* Right Side - Enhanced 3D Model with Advanced Animations */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="flex-shrink-0 w-full lg:w-80 h-48 md:h-56 lg:h-64 relative group"
        >
          {/* Enhanced 3D Background with Multiple Layers */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-100/40 to-indigo-100/40 rounded-2xl blur-sm"></div>
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-100/30 to-purple-100/30 rounded-2xl blur-md"></div>
          <div className="absolute inset-0 bg-gradient-to-bl from-pink-100/20 to-rose-100/20 rounded-2xl blur-lg"></div>
          
          {/* 3D Glow Effect */}
          <div className="absolute -inset-4 bg-gradient-to-r from-purple-400/20 via-blue-400/20 to-indigo-400/20 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
          
          {/* 3D Shadow Layer */}
          <div className="absolute inset-0 bg-gradient-to-br from-black/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" style={{transform: 'translateZ(-20px) translateY(15px)'}}></div>
          
          <div className="relative w-full h-full flex items-center justify-center overflow-visible">
            <motion.div
              initial={{ scale: 0.8, rotateY: -30, rotateX: 15 }}
              animate={{ 
                scale: 1,
                rotateY: [-20, -25, -20],
                rotateX: [10, 15, 10],
                translateZ: [30, 50, 30]
              }}
              transition={{ 
                duration: 0.8, 
                delay: 1.2,
                rotateY: {
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                },
                rotateX: {
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.5
                },
                translateZ: {
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1
                }
              }}
              className="w-full h-full flex items-center justify-center transform-gpu"
              style={{
                transformStyle: 'preserve-3d',
                filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.4)) drop-shadow(0 0 20px rgba(147, 51, 234, 0.3)) drop-shadow(0 0 40px rgba(59, 130, 246, 0.2))'
              }}
            >
              {/* 3D Image Container with Multiple Layers */}
              <div className="relative w-full h-full transform-gpu" style={{transformStyle: 'preserve-3d'}}>
                {/* Background Glow Layer */}
                <motion.div
                  animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.3, 0.6, 0.3]
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="absolute inset-0 bg-gradient-to-br from-purple-400/30 to-blue-400/30 rounded-2xl blur-xl"
                  style={{transform: 'translateZ(-10px)'}}
                ></motion.div>
                
                {/* Main Image with Enhanced 3D Effects */}
                <motion.img
                  src="../user-dashboard-img.png"
                  alt="3D Welcome Model"
                  className="w-full h-full object-contain relative z-10"
                  style={{
                    objectPosition: 'center',
                    transform: 'translateZ(40px) scale(1.2)',
                    clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)'
                  }}
                  animate={{
                    scale: [1.2, 1.25, 1.2],
                    rotateZ: [0, 1, 0]
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.5
                  }}
                />
                
                {/* 3D Reflection Layer */}
                <motion.div
                  animate={{
                    opacity: [0.1, 0.3, 0.1],
                    scale: [1, 1.05, 1]
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 1.5
                  }}
                  className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent rounded-2xl"
                  style={{transform: 'translateZ(50px) rotateX(180deg)'}}
                ></motion.div>
                
                {/* 3D Highlight Layer */}
                <motion.div
                  animate={{
                    x: [-10, 10, -10],
                    y: [-5, 5, -5]
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 2
                  }}
                  className="absolute top-4 left-4 w-8 h-8 bg-gradient-to-br from-white/40 to-transparent rounded-full blur-sm"
                  style={{transform: 'translateZ(60px)'}}
                ></motion.div>
              </div>
            </motion.div>
          </div>
          
          {/* 3D Floating Particles around the Image */}
          <motion.div
            animate={{
              y: [0, -20, 0],
              rotate: [0, 360, 0],
              scale: [1, 1.2, 1]
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute top-2 right-2 w-3 h-3 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full opacity-60"
            style={{transform: 'translateZ(100px)'}}
          ></motion.div>
          
          <motion.div
            animate={{
              y: [0, 15, 0],
              rotate: [0, -180, 0],
              scale: [1, 0.8, 1]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1
            }}
            className="absolute bottom-4 left-2 w-2 h-2 bg-gradient-to-br from-pink-400 to-rose-400 rounded-full opacity-50"
            style={{transform: 'translateZ(80px)'}}
          ></motion.div>
          
          <motion.div
            animate={{
              y: [0, -10, 0],
              x: [0, 5, 0],
              rotate: [0, 90, 0]
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 2
            }}
            className="absolute top-1/2 left-0 w-1.5 h-1.5 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full opacity-40"
            style={{transform: 'translateZ(120px)'}}
          ></motion.div>
        </motion.div>
      </div>

    </motion.div>
  );
};

export default WelcomeCard;
