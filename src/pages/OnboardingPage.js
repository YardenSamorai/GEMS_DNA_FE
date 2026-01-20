import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";
import { motion } from 'framer-motion';

// Floating Diamond Component - with mobile size prop
const FloatingDiamond = ({ delay, duration, size, mobileSize, left, top, color, glowColor, hideOnMobile }) => (
  <motion.div
    className={`absolute ${hideOnMobile ? 'hidden md:block' : ''}`}
    initial={{ opacity: 0, scale: 0 }}
    animate={{ 
      opacity: [0.4, 0.8, 0.4],
      y: [0, -50, 0],
      x: [0, Math.random() > 0.5 ? 20 : -20, 0],
      rotate: [0, 360],
      scale: [1, 1.2, 1]
    }}
    transition={{ 
      duration,
      repeat: Infinity,
      delay,
      ease: "easeInOut"
    }}
    style={{ left, top }}
  >
    <div 
      className="relative"
      style={{ 
        filter: `drop-shadow(0 0 ${(mobileSize || size)/3}px ${glowColor})`,
      }}
    >
      <svg 
        className={`w-[${mobileSize || size * 0.6}px] h-[${mobileSize || size * 0.6}px] md:w-[${size}px] md:h-[${size}px]`}
        style={{ width: mobileSize || size * 0.6, height: mobileSize || size * 0.6 }}
        viewBox="0 0 24 24" 
        fill="none"
      >
        <defs>
          <linearGradient id={`gem-gradient-${delay}`} x1="12" y1="2" x2="12" y2="22">
            <stop offset="0%" stopColor={color} stopOpacity="0.9" />
            <stop offset="100%" stopColor={color} stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <path d="M12 2L2 9L12 22L22 9L12 2Z" fill={`url(#gem-gradient-${delay})`} />
        <path d="M12 2L8 9L12 22L16 9L12 2Z" fill="rgba(255,255,255,0.4)" />
        <path d="M2 9H22" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
      </svg>
    </div>
  </motion.div>
);

// Sparkle Component
const Sparkle = ({ delay, left, top, hideOnMobile }) => (
  <motion.div
    className={`absolute w-1 h-1 bg-white rounded-full ${hideOnMobile ? 'hidden md:block' : ''}`}
    initial={{ opacity: 0, scale: 0 }}
    animate={{ 
      opacity: [0, 1, 0],
      scale: [0, 1.5, 0],
    }}
    transition={{ 
      duration: 2,
      repeat: Infinity,
      delay,
      ease: "easeInOut"
    }}
    style={{ 
      left, 
      top,
      boxShadow: '0 0 6px 2px rgba(255,255,255,0.8), 0 0 12px 4px rgba(16,185,129,0.4)'
    }}
  />
);

const OnboardingPage = () => {
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if mobile
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const handleMouseMove = (e) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Diamond configurations - fewer and smaller on mobile
  const diamonds = [
    { delay: 0, duration: 6, size: 45, mobileSize: 25, left: '5%', top: '15%', color: '#10b981', glowColor: 'rgba(16,185,129,0.6)' },
    { delay: 0.5, duration: 7, size: 35, mobileSize: 20, left: '15%', top: '60%', color: '#06b6d4', glowColor: 'rgba(6,182,212,0.6)', hideOnMobile: true },
    { delay: 1, duration: 5, size: 55, mobileSize: 30, left: '85%', top: '20%', color: '#10b981', glowColor: 'rgba(16,185,129,0.6)' },
    { delay: 1.5, duration: 8, size: 40, mobileSize: 22, left: '90%', top: '65%', color: '#8b5cf6', glowColor: 'rgba(139,92,246,0.6)', hideOnMobile: true },
    { delay: 2, duration: 6, size: 50, mobileSize: 28, left: '75%', top: '40%', color: '#06b6d4', glowColor: 'rgba(6,182,212,0.6)' },
    { delay: 2.5, duration: 7, size: 38, mobileSize: 20, left: '25%', top: '35%', color: '#f59e0b', glowColor: 'rgba(245,158,11,0.6)', hideOnMobile: true },
    { delay: 3, duration: 5, size: 42, mobileSize: 24, left: '60%', top: '70%', color: '#10b981', glowColor: 'rgba(16,185,129,0.6)' },
    { delay: 3.5, duration: 6, size: 48, mobileSize: 26, left: '40%', top: '10%', color: '#ec4899', glowColor: 'rgba(236,72,153,0.6)', hideOnMobile: true },
    { delay: 4, duration: 7, size: 36, mobileSize: 20, left: '95%', top: '45%', color: '#06b6d4', glowColor: 'rgba(6,182,212,0.6)', hideOnMobile: true },
    { delay: 4.5, duration: 8, size: 44, mobileSize: 24, left: '10%', top: '80%', color: '#8b5cf6', glowColor: 'rgba(139,92,246,0.6)' },
  ];

  // Sparkle configurations - fewer on mobile
  const sparkles = [
    { delay: 0, left: '20%', top: '25%' },
    { delay: 0.3, left: '80%', top: '15%' },
    { delay: 0.6, left: '70%', top: '55%', hideOnMobile: true },
    { delay: 0.9, left: '30%', top: '70%' },
    { delay: 1.2, left: '50%', top: '30%', hideOnMobile: true },
    { delay: 1.5, left: '85%', top: '75%' },
    { delay: 1.8, left: '15%', top: '45%', hideOnMobile: true },
    { delay: 2.1, left: '65%', top: '85%' },
    { delay: 2.4, left: '45%', top: '60%', hideOnMobile: true },
    { delay: 2.7, left: '90%', top: '35%', hideOnMobile: true },
    { delay: 3.0, left: '25%', top: '90%' },
    { delay: 3.3, left: '55%', top: '20%', hideOnMobile: true },
  ];

  const features = [
    {
      icon: (
        <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      title: "Inventory Management",
      description: "Track diamonds, emeralds, and fancy colored stones",
      color: "from-emerald-400 to-emerald-600"
    },
    {
      icon: (
        <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      title: "PDF Catalogs",
      description: "Generate professional catalogs with your branding",
      color: "from-blue-400 to-blue-600"
    },
    {
      icon: (
        <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
      title: "Smart Tags",
      description: "Organize stones by clients or collections",
      color: "from-purple-400 to-purple-600"
    },
    {
      icon: (
        <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      ),
      title: "Excel Export",
      description: "Export with price adjustments",
      color: "from-green-400 to-green-600"
    },
    {
      icon: (
        <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      title: "SOAP Sync",
      description: "Auto-sync with your inventory system",
      color: "from-amber-400 to-amber-600"
    },
    {
      icon: (
        <svg className="w-6 h-6 md:w-8 md:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
      ),
      title: "Label Printing",
      description: "Print labels with QR codes",
      color: "from-rose-400 to-rose-600"
    }
  ];

  const steps = [
    { number: "01", title: "Sign In", description: "Create account or sign in" },
    { number: "02", title: "Sync", description: "Import your inventory" },
    { number: "03", title: "Organize", description: "Tag your stones" },
    { number: "04", title: "Export", description: "Generate catalogs" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-stone-900 to-slate-900 overflow-hidden relative">
      {/* Animated Mesh Gradient Background - Simplified on mobile */}
      <div className="fixed inset-0 pointer-events-none">
        <div 
          className="absolute inset-0 transition-all duration-500 ease-out"
          style={{
            background: isMobile 
              ? `radial-gradient(400px circle at 50% 30%, rgba(16, 185, 129, 0.2) 0%, transparent 60%)`
              : `
                radial-gradient(800px circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(16, 185, 129, 0.25) 0%, transparent 50%),
                radial-gradient(600px circle at ${100 - mousePosition.x}% ${100 - mousePosition.y}%, rgba(6, 182, 212, 0.15) 0%, transparent 50%),
                radial-gradient(400px circle at ${mousePosition.x + 20}% ${mousePosition.y - 20}%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)
              `
          }}
        />
      </div>

      {/* Grid Pattern Overlay - Hidden on mobile for performance */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.03] hidden md:block"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
      />

      {/* Floating Diamonds */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {diamonds.map((diamond, i) => (
          <FloatingDiamond key={i} {...diamond} />
        ))}
      </div>

      {/* Sparkles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {sparkles.map((sparkle, i) => (
          <Sparkle key={i} {...sparkle} />
        ))}
      </div>

      {/* Hero Section */}
      <section className="relative pt-8 sm:pt-12 md:pt-20 pb-16 sm:pb-24 md:pb-32 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Badge */}
            <motion.div 
              className="inline-flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-full bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm font-medium mb-6 sm:mb-8 backdrop-blur-sm"
              animate={{ 
                boxShadow: ['0 0 20px rgba(16,185,129,0.2)', '0 0 40px rgba(16,185,129,0.4)', '0 0 20px rgba(16,185,129,0.2)']
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Diamond Network by Gemstar
            </motion.div>

            {/* Main Title */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold mb-4 sm:mb-6 tracking-tight">
              <span className="block text-white">Manage Your</span>
              <motion.span 
                className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400"
                animate={{
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                }}
                transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                style={{ backgroundSize: '200% 200%' }}
              >
                Precious Stones
              </motion.span>
            </h1>

            <p className="text-base sm:text-lg md:text-xl text-stone-400 max-w-2xl mx-auto mb-8 sm:mb-12 leading-relaxed px-2">
              The complete inventory management system for diamonds, emeralds, and colored gemstones.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center px-4">
              <SignedIn>
                <Link 
                  to="/dashboard"
                  className="w-full sm:w-auto group relative px-6 sm:px-8 py-3.5 sm:py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl sm:rounded-2xl font-semibold text-base sm:text-lg shadow-xl shadow-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/40 transition-all hover:scale-105"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Go to Dashboard
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                </Link>
              </SignedIn>
              <SignedOut>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full sm:w-auto"
                >
                  <SignInButton mode="modal">
                    <button className="w-full sm:w-auto group relative px-6 sm:px-8 py-3.5 sm:py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl sm:rounded-2xl font-semibold text-base sm:text-lg shadow-xl shadow-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/40 transition-all overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-teal-500 to-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        Get Started Free
                        <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </span>
                    </button>
                  </SignInButton>
                </motion.div>
              </SignedOut>
              <Link 
                to="/inventory"
                className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 bg-white/5 text-white rounded-xl sm:rounded-2xl font-semibold text-base sm:text-lg border border-white/10 hover:bg-white/10 hover:border-emerald-500/50 transition-all backdrop-blur-sm text-center"
              >
                View Inventory
              </Link>
            </div>
          </motion.div>

          {/* Hero Image/Preview - Adjusted for mobile */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="mt-12 sm:mt-16 md:mt-20 relative px-2 sm:px-0"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent z-10 pointer-events-none"></div>
            <motion.div 
              className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-white/10 mx-auto max-w-5xl backdrop-blur-sm"
              style={{
                boxShadow: '0 0 40px rgba(16,185,129,0.1), 0 0 80px rgba(6,182,212,0.08)'
              }}
            >
              <div className="bg-gradient-to-br from-stone-800/80 to-stone-900/80 p-1">
                <div className="flex gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-red-400"></div>
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-green-400"></div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-stone-800/80 to-stone-900/80 p-4 sm:p-6 md:p-8 backdrop-blur-md">
                <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4">
                  {[
                    { label: "Total Stones", value: "1,247", icon: "💎", valueColor: "text-emerald-400", borderColor: "border-emerald-500/30", bgColor: "from-emerald-500/20" },
                    { label: "Total Value", value: "$2.4M", icon: "💰", valueColor: "text-cyan-400", borderColor: "border-cyan-500/30", bgColor: "from-cyan-500/20" },
                    { label: "Categories", value: "4", icon: "📦", valueColor: "text-purple-400", borderColor: "border-purple-500/30", bgColor: "from-purple-500/20" }
                  ].map((stat, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 + i * 0.1 }}
                      className={`p-3 sm:p-4 md:p-6 rounded-xl sm:rounded-2xl bg-gradient-to-br ${stat.bgColor} to-stone-800/50 border ${stat.borderColor} backdrop-blur-sm`}
                      whileHover={{ scale: 1.02 }}
                    >
                      <div className="text-lg sm:text-xl md:text-2xl mb-1 sm:mb-2">{stat.icon}</div>
                      <p className="text-[10px] sm:text-xs md:text-sm text-stone-300 font-medium">{stat.label}</p>
                      <p className={`text-lg sm:text-xl md:text-3xl font-bold ${stat.valueColor}`}>{stat.value}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-16 md:py-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8 sm:mb-12 md:mb-16"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4">Everything You Need</h2>
            <p className="text-sm sm:text-base md:text-lg text-stone-400 max-w-2xl mx-auto px-4">
              Powerful tools designed for gemstone dealers
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -5, scale: 1.02 }}
                className="group p-3 sm:p-4 md:p-6 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-500/30 hover:bg-white/10 transition-all duration-300 backdrop-blur-sm"
              >
                <motion.div 
                  className={`w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br ${feature.color} text-white flex items-center justify-center mb-2 sm:mb-3 md:mb-4`}
                  whileHover={{ rotate: 5, scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  {feature.icon}
                </motion.div>
                <h3 className="text-sm sm:text-base md:text-xl font-semibold text-white mb-1 sm:mb-2">{feature.title}</h3>
                <p className="text-xs sm:text-sm text-stone-400 line-clamp-2">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 sm:py-16 md:py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8 sm:mb-12 md:mb-16"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 sm:mb-4">How It Works</h2>
            <p className="text-sm sm:text-base md:text-lg text-stone-400">Get started in minutes</p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative text-center"
              >
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-6 md:top-8 left-1/2 w-full h-0.5 bg-gradient-to-r from-emerald-500/50 to-transparent"></div>
                )}
                <motion.div 
                  className="relative z-10 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white text-lg sm:text-xl md:text-2xl font-bold flex items-center justify-center mx-auto mb-2 sm:mb-3 md:mb-4"
                  whileHover={{ scale: 1.1 }}
                  style={{ boxShadow: '0 0 20px rgba(16,185,129,0.3)' }}
                >
                  {step.number}
                </motion.div>
                <h3 className="text-sm sm:text-base md:text-lg font-semibold text-white mb-1 sm:mb-2">{step.title}</h3>
                <p className="text-xs sm:text-sm text-stone-400">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 md:py-24 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto"
        >
          <div 
            className="relative rounded-2xl sm:rounded-3xl overflow-hidden"
            style={{
              boxShadow: '0 0 60px rgba(16,185,129,0.15)'
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500"></div>
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRoLTJ2LTJoMnYyem0wLTRoLTJ2LTJoMnYyem0tNC00aC0ydi0yaDJ2MnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30"></div>
            
            {/* Floating diamonds in CTA - Hidden on mobile */}
            <motion.div
              className="absolute top-4 left-4 sm:left-8 opacity-30 hidden sm:block"
              animate={{ y: [0, -10, 0], rotate: [0, 10, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <svg width="30" height="30" className="sm:w-10 sm:h-10" viewBox="0 0 24 24" fill="white">
                <path d="M12 2L2 9L12 22L22 9L12 2Z" />
              </svg>
            </motion.div>
            <motion.div
              className="absolute bottom-4 right-4 sm:right-8 opacity-30 hidden sm:block"
              animate={{ y: [0, 10, 0], rotate: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <svg width="40" height="40" className="sm:w-[50px] sm:h-[50px]" viewBox="0 0 24 24" fill="white">
                <path d="M12 2L2 9L12 22L22 9L12 2Z" />
              </svg>
            </motion.div>
            
            <div className="relative px-5 sm:px-8 py-10 sm:py-12 md:py-16 md:px-16 text-center">
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-3 sm:mb-4">
                Ready to Transform Your Inventory?
              </h2>
              <p className="text-sm sm:text-base md:text-lg text-white/80 mb-6 sm:mb-8 max-w-2xl mx-auto">
                Join dealers who trust GEMS DNA to manage their collections.
              </p>
              <SignedIn>
                <Link 
                  to="/dashboard"
                  className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-white text-emerald-600 rounded-xl sm:rounded-2xl font-semibold text-base sm:text-lg hover:bg-stone-50 transition-colors shadow-xl"
                >
                  Open Dashboard
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-white text-emerald-600 rounded-xl sm:rounded-2xl font-semibold text-base sm:text-lg hover:bg-stone-50 transition-colors shadow-xl">
                    Start Now — It's Free
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </SignInButton>
              </SignedOut>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-6 sm:py-8 px-4 border-t border-white/10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <svg width="20" height="20" className="sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 9L12 22L22 9L12 2Z" fill="url(#footer-gradient)" />
              <defs>
                <linearGradient id="footer-gradient" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#34d399" />
                  <stop offset="1" stopColor="#059669" />
                </linearGradient>
              </defs>
            </svg>
            <span className="text-xs sm:text-sm text-stone-400">GEMS DNA • Diamond Network</span>
          </div>
          <p className="text-xs sm:text-sm text-stone-500">© 2026 All rights reserved</p>
        </div>
      </footer>
    </div>
  );
};

export default OnboardingPage;
