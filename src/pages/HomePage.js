import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from "@clerk/clerk-react";
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = "https://gems-dna-be.vercel.app";

// Animated Counter Hook
const useAnimatedCounter = (end, duration = 1500, startOnView = true) => {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(!startOnView);
  const ref = useRef(null);

  useEffect(() => {
    if (!startOnView) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [startOnView, hasStarted]);

  useEffect(() => {
    if (!hasStarted || end === 0) return;
    
    let startTime;
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easeOut * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [end, duration, hasStarted]);

  return { count, ref };
};

// Mini Pie Chart Component
const MiniPieChart = ({ data, size = 120 }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let currentAngle = 0;
  
  const createArc = (startAngle, endAngle, color) => {
    const start = polarToCartesian(size/2, size/2, size/2 - 5, endAngle);
    const end = polarToCartesian(size/2, size/2, size/2 - 5, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return `M ${size/2} ${size/2} L ${start.x} ${start.y} A ${size/2 - 5} ${size/2 - 5} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
  };
  
  const polarToCartesian = (cx, cy, r, angle) => ({
    x: cx + r * Math.cos((angle - 90) * Math.PI / 180),
    y: cy + r * Math.sin((angle - 90) * Math.PI / 180)
  });

  return (
    <svg width={size} height={size} className="drop-shadow-lg">
      {data.map((item, i) => {
        const angle = (item.value / total) * 360;
        const path = createArc(currentAngle, currentAngle + angle, item.color);
        currentAngle += angle;
        return (
          <motion.path
            key={i}
            d={path}
            fill={item.color}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            className="hover:opacity-80 transition-opacity cursor-pointer"
          />
        );
      })}
      <circle cx={size/2} cy={size/2} r={size/4} fill="white" />
    </svg>
  );
};

// Bar Chart Component
const BarChart = ({ data, maxValue }) => {
  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-stone-500 w-16 truncate">{item.label}</span>
          <div className="flex-1 h-6 bg-stone-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(item.value / maxValue) * 100}%` }}
              transition={{ delay: i * 0.1, duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ backgroundColor: item.color }}
            />
          </div>
          <span className="text-sm font-semibold text-stone-700 w-12 text-right">{item.value}</span>
        </div>
      ))}
    </div>
  );
};

// Sync Info Dialog Component (Shows how to sync due to Vercel timeout limits)
const SyncInfoDialog = ({ isOpen, onClose, currentStats, onSyncComplete }) => {
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  
  if (!isOpen) return null;
  
  const syncCommand = 'cd GEMS_DNA_BE && node api/stones/importFromSoap.js';
  
  const copyCommand = () => {
    navigator.clipboard.writeText(syncCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setSyncStatus({ type: 'info', message: 'Starting sync...' });
      
      const response = await fetch(`${API_BASE}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSyncStatus({ 
          type: 'success', 
          message: 'Sync started successfully! It may take 30-60 seconds to complete. Refresh the page in a minute to see updated data.' 
        });
        // Call callback to refresh data after a delay
        if (onSyncComplete) {
          setTimeout(() => {
            onSyncComplete();
          }, 60000); // Refresh after 60 seconds
        }
      } else {
        setSyncStatus({ 
          type: 'error', 
          message: data.error || 'Failed to start sync' 
        });
      }
    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus({ 
        type: 'error', 
        message: 'Failed to start sync. Please try running from terminal instead.' 
      });
    } finally {
      setSyncing(false);
    }
  };
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
            <h2 className="text-xl font-bold text-white">🔄 Sync SOAP Data</h2>
            <p className="text-white/80 text-sm">Update inventory from Barak SOAP API</p>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Current Stats */}
            <div className="bg-stone-50 rounded-xl p-4">
              <h3 className="font-semibold text-stone-700 mb-3">📊 Current Database</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-600">{currentStats?.totalStones || 0}</p>
                  <p className="text-xs text-stone-500">Total Stones</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{Object.keys(currentStats?.categories || {}).length}</p>
                  <p className="text-xs text-stone-500">Categories</p>
                </div>
              </div>
            </div>
            
            {/* Sync Status */}
            {syncStatus && (
              <div className={`rounded-xl p-4 ${
                syncStatus.type === 'success' 
                  ? 'bg-emerald-50 border border-emerald-200' 
                  : syncStatus.type === 'error'
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-blue-50 border border-blue-200'
              }`}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">
                    {syncStatus.type === 'success' ? '✅' : syncStatus.type === 'error' ? '❌' : 'ℹ️'}
                  </span>
                  <div>
                    <h4 className={`font-semibold ${
                      syncStatus.type === 'success' 
                        ? 'text-emerald-800' 
                        : syncStatus.type === 'error'
                        ? 'text-red-800'
                        : 'text-blue-800'
                    }`}>
                      {syncStatus.type === 'success' ? 'Sync Started' : syncStatus.type === 'error' ? 'Sync Failed' : 'Sync Info'}
                    </h4>
                    <p className={`text-sm mt-1 ${
                      syncStatus.type === 'success' 
                        ? 'text-emerald-700' 
                        : syncStatus.type === 'error'
                        ? 'text-red-700'
                        : 'text-blue-700'
                    }`}>
                      {syncStatus.message}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Sync Button */}
            <button
              onClick={handleSync}
              disabled={syncing}
              className={`w-full py-3 px-4 rounded-xl font-semibold text-white transition-all ${
                syncing
                  ? 'bg-stone-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 hover:shadow-lg'
              }`}
            >
              {syncing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Syncing...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Start Sync Now
                </span>
              )}
            </button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-200"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-stone-500">Or</span>
              </div>
            </div>

            {/* Info about Terminal sync */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">ℹ️</span>
                <div>
                  <h4 className="font-semibold text-blue-800">Sync from Terminal</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Alternatively, run the sync command from your terminal:
                  </p>
                </div>
              </div>
            </div>

            {/* Command to copy */}
            <div className="bg-stone-900 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <code className="text-emerald-400 text-sm font-mono">{syncCommand}</code>
                <button
                  onClick={copyCommand}
                  className="ml-3 px-3 py-1.5 text-xs font-medium bg-stone-700 text-white rounded-lg hover:bg-stone-600 transition-colors"
                >
                  {copied ? '✅ Copied!' : '📋 Copy'}
                </button>
              </div>
            </div>

            {/* Steps */}
            <div className="bg-stone-50 rounded-xl p-4">
              <h4 className="font-semibold text-stone-700 mb-2">📝 Steps:</h4>
              <ol className="text-sm text-stone-600 space-y-1 list-decimal list-inside">
                <li>Open terminal in your project folder</li>
                <li>Copy and run the command above</li>
                <li>Wait for sync to complete (~30 seconds)</li>
                <li>Refresh this page to see updated data</li>
              </ol>
            </div>

            {/* Auto sync info */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⏰</span>
                <div>
                  <h4 className="font-semibold text-emerald-800">Auto Sync</h4>
                  <p className="text-sm text-emerald-700 mt-1">
                    The system automatically syncs every 5 hours via scheduled task.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t bg-stone-50 px-6 py-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Got it
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const HomePage = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [stones, setStones] = useState([]);
  const searchRef = useRef(null);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [stats, setStats] = useState({
    totalStones: 0,
    totalValue: 0,
    categories: {},
    locations: {},
    shapes: {},
    topStones: [],
    recentStones: []
  });

  const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch stones and tags in parallel
        const [stonesRes, tagsRes] = await Promise.all([
          fetch(`${API_BASE}/api/soap-stones`),
          fetch(`${API_BASE}/api/tags`).catch(() => ({ json: () => [] }))
        ]);
        
        const stonesData = await stonesRes.json();
        const tagsData = await tagsRes.json();
        
        const allStones = Array.isArray(stonesData.stones) ? stonesData.stones : [];
        setStones(allStones);
        setTags(Array.isArray(tagsData) ? tagsData : []);
        
        // Calculate statistics
        const categories = {};
        const locations = {};
        const shapes = {};
        let totalValue = 0;
        
        allStones.forEach(stone => {
          // Categories
          const cat = (stone.category || 'Other').toLowerCase();
          if (cat.includes('emerald')) categories['Emerald'] = (categories['Emerald'] || 0) + 1;
          else if (cat.includes('fancy')) categories['Fancy'] = (categories['Fancy'] || 0) + 1;
          else if (cat.includes('diamond')) categories['Diamond'] = (categories['Diamond'] || 0) + 1;
          else categories['Other'] = (categories['Other'] || 0) + 1;
          
          // Locations
          const loc = stone.location || 'Unknown';
          locations[loc] = (locations[loc] || 0) + 1;
          
          // Shapes
          const shape = stone.shape || 'Unknown';
          shapes[shape] = (shapes[shape] || 0) + 1;
          
          // Total value
          totalValue += stone.priceTotal || 0;
        });
        
        // Top 5 by value
        const topStones = [...allStones]
          .filter(s => s.priceTotal)
          .sort((a, b) => (b.priceTotal || 0) - (a.priceTotal || 0))
          .slice(0, 5);
        
        // Recent stones (last 5 by ID or just first 5)
        const recentStones = allStones.slice(0, 5);
        
        setStats({
          totalStones: allStones.length,
          totalValue,
          categories,
          locations,
          shapes,
          topStones,
          recentStones
        });
        
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const handleQuickSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowSuggestions(false);
      navigate(`/inventory?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // Get SKU suggestions based on search query
  const skuSuggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    const query = searchQuery.toLowerCase();
    return stones
      .filter(s => s.sku?.toLowerCase().includes(query))
      .slice(0, 8) // Limit to 8 suggestions
      .map(s => ({
        sku: s.sku,
        shape: s.shape,
        category: s.category,
        weightCt: s.weightCt,
        imageUrl: s.imageUrl
      }));
  }, [searchQuery, stones]);

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle suggestion click
  const handleSuggestionClick = (sku) => {
    setSearchQuery(sku);
    setShowSuggestions(false);
    navigate(`/inventory?search=${encodeURIComponent(sku)}`);
  };

  // Open sync info dialog
  const handleSyncClick = () => {
    setShowSyncDialog(true);
  };

  // Animated counter values
  const totalStonesCounter = useAnimatedCounter(stats.totalStones);
  const totalValueCounter = useAnimatedCounter(Math.round(stats.totalValue));
  const categoriesCounter = useAnimatedCounter(Object.keys(stats.categories).length);
  const locationsCounter = useAnimatedCounter(Object.keys(stats.locations).length);

  // Chart data
  const categoryColors = {
    'Emerald': '#10b981',
    'Diamond': '#3b82f6',
    'Fancy': '#f59e0b',
    'Other': '#6b7280'
  };

  const categoryChartData = Object.entries(stats.categories).map(([name, value]) => ({
    label: name,
    value,
    color: categoryColors[name] || '#6b7280'
  }));

  const locationColors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  const locationChartData = Object.entries(stats.locations)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value], i) => ({
      label: name,
      value,
      color: locationColors[i % locationColors.length]
    }));

  const maxLocationValue = Math.max(...locationChartData.map(d => d.value), 1);

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-stone-50 via-white to-emerald-50/30">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-stone-800 mb-1">
                {getGreeting()}, {user?.firstName || 'there'} 👋
              </h1>
              <p className="text-stone-500">
                Welcome to your GEMS DNA dashboard
              </p>
            </div>
            
            {/* Sync Button */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSyncClick}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:shadow-lg hover:shadow-blue-500/25 hover:scale-[1.02]"
              >
                <svg 
                  className="w-4 h-4" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync SOAP Data
              </button>
            </div>
          </div>
        </motion.div>

        {/* Quick Search Bar with Autocomplete */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
          ref={searchRef}
        >
          <form onSubmit={handleQuickSearch} className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Quick search by SKU..."
              className="w-full px-5 py-4 pl-12 text-lg bg-white border border-stone-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
            />
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors"
            >
              Search
            </button>
            
            {/* Autocomplete Suggestions */}
            <AnimatePresence>
              {showSuggestions && skuSuggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white border border-stone-200 rounded-xl shadow-lg z-50 overflow-hidden"
                >
                  {skuSuggestions.map((stone, index) => (
                    <button
                      key={stone.sku}
                      type="button"
                      onClick={() => handleSuggestionClick(stone.sku)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-emerald-50 transition-colors ${
                        index !== skuSuggestions.length - 1 ? 'border-b border-stone-100' : ''
                      }`}
                    >
                      {/* Stone Image */}
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-stone-100 flex-shrink-0">
                        {stone.imageUrl ? (
                          <img src={stone.imageUrl} alt={stone.sku} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-400">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      {/* Stone Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-mono font-semibold text-stone-800">{stone.sku}</p>
                        <p className="text-sm text-stone-500 truncate">
                          {stone.shape} • {stone.weightCt?.toFixed(2)}ct • {stone.category}
                        </p>
                      </div>
                      {/* Arrow */}
                      <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </motion.div>

        {/* Main Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <motion.div
            ref={totalStonesCounter.ref}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="text-xs text-stone-500 mb-1">Total Stones</p>
            <p className="text-2xl font-bold text-stone-800">
              {loading ? '...' : totalStonesCounter.count.toLocaleString()}
            </p>
          </motion.div>

          <motion.div
            ref={totalValueCounter.ref}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-xs text-stone-500 mb-1">Total Value</p>
            <p className="text-2xl font-bold text-stone-800">
              {loading ? '...' : `$${totalValueCounter.count.toLocaleString()}`}
            </p>
          </motion.div>

          <motion.div
            ref={categoriesCounter.ref}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-3">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <p className="text-xs text-stone-500 mb-1">Categories</p>
            <p className="text-2xl font-bold text-stone-800">
              {loading ? '...' : categoriesCounter.count}
            </p>
          </motion.div>

          <motion.div
            ref={locationsCounter.ref}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-3">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-xs text-stone-500 mb-1">Locations</p>
            <p className="text-2xl font-bold text-stone-800">
              {loading ? '...' : locationsCounter.count}
            </p>
          </motion.div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Category Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm"
          >
            <h3 className="text-lg font-semibold text-stone-800 mb-4">Category Distribution</h3>
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <MiniPieChart data={categoryChartData} size={140} />
                <div className="flex-1 space-y-2">
                  {categoryChartData.map((item, i) => (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.1 }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                        <span className="text-sm text-stone-600">{item.label}</span>
                      </div>
                      <span className="text-sm font-semibold text-stone-800">{item.value}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* Location Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm"
          >
            <h3 className="text-lg font-semibold text-stone-800 mb-4">Location Distribution</h3>
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
              </div>
            ) : (
              <BarChart data={locationChartData} maxValue={maxLocationValue} />
            )}
          </motion.div>
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="mb-6"
        >
          <h2 className="text-lg font-semibold text-stone-800 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Link
              to="/inventory"
              className="group bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white hover:shadow-lg hover:shadow-emerald-500/25 transition-all hover:scale-[1.02]"
            >
              <svg className="w-8 h-8 mb-3 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="font-semibold mb-1">Browse Inventory</h3>
              <p className="text-xs text-white/70">Search & filter stones</p>
            </Link>

            <Link
              to="/inventory"
              className="group bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white hover:shadow-lg hover:shadow-blue-500/25 transition-all hover:scale-[1.02]"
            >
              <svg className="w-8 h-8 mb-3 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="font-semibold mb-1">Export Excel</h3>
              <p className="text-xs text-white/70">Create client reports</p>
            </Link>

            <Link
              to="/inventory"
              className="group bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-5 text-white hover:shadow-lg hover:shadow-amber-500/25 transition-all hover:scale-[1.02]"
            >
              <svg className="w-8 h-8 mb-3 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <h3 className="font-semibold mb-1">Scan QR</h3>
              <p className="text-xs text-white/70">Quick stone lookup</p>
            </Link>

            <Link
              to="/inventory"
              className="group bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white hover:shadow-lg hover:shadow-purple-500/25 transition-all hover:scale-[1.02]"
            >
              <svg className="w-8 h-8 mb-3 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <h3 className="font-semibold mb-1">Manage Tags</h3>
              <p className="text-xs text-white/70">Organize by client</p>
            </Link>
          </div>
        </motion.div>

        {/* Bottom Row: Top Stones + Tags Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Top 5 Stones by Value */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-stone-800">Top Stones by Value</h3>
              <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Top 5</span>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-stone-100 rounded-xl animate-pulse"></div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {stats.topStones.map((stone, i) => (
                  <motion.div
                    key={stone.sku}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.55 + i * 0.1 }}
                  >
                    <Link
                      to={`/${stone.sku}`}
                      className="flex items-center justify-between p-3 rounded-xl bg-stone-50 hover:bg-emerald-50 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <div>
                          <p className="font-mono text-sm font-semibold text-stone-800 group-hover:text-emerald-600 transition-colors">
                            {stone.sku}
                          </p>
                          <p className="text-xs text-stone-500">{stone.shape} • {stone.weightCt}ct</p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-emerald-600">
                        ${(stone.priceTotal || 0).toLocaleString()}
                      </span>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Tags Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-stone-800">Tags Overview</h3>
              <Link to="/inventory" className="text-xs text-emerald-600 hover:text-emerald-700">
                Manage →
              </Link>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-10 bg-stone-100 rounded-xl animate-pulse"></div>
                ))}
              </div>
            ) : tags.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <p className="text-sm text-stone-500 mb-2">No tags created yet</p>
                <Link to="/inventory" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                  Create your first tag →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {tags.slice(0, 6).map((tag, i) => (
                  <motion.div
                    key={tag.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + i * 0.1 }}
                    className="flex items-center justify-between p-3 rounded-xl bg-stone-50 hover:bg-stone-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: tag.color || '#10b981' }}
                      ></span>
                      <span className="text-sm font-medium text-stone-800">{tag.name}</span>
                    </div>
                    <span className="text-xs text-stone-500 bg-stone-200 px-2 py-1 rounded-full">
                      {tag.stone_count || 0} stones
                    </span>
                  </motion.div>
                ))}
                {tags.length > 6 && (
                  <p className="text-xs text-stone-400 text-center pt-2">
                    +{tags.length - 6} more tags
                  </p>
                )}
              </div>
            )}
          </motion.div>
        </div>

        {/* Recent Stones */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-stone-800">Recent Stones</h3>
            <Link to="/inventory" className="text-xs text-emerald-600 hover:text-emerald-700">
              View All →
            </Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="aspect-square bg-stone-100 rounded-xl animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {stats.recentStones.map((stone, i) => (
                <motion.div
                  key={stone.sku}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.65 + i * 0.1 }}
                >
                  <Link
                    to={`/${stone.sku}`}
                    className="block group"
                  >
                    <div className="aspect-square rounded-xl overflow-hidden bg-stone-100 mb-2 relative">
                      {stone.imageUrl ? (
                        <img
                          src={stone.imageUrl}
                          alt={stone.sku}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-400">
                          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                        <span className="text-white text-xs font-medium">View DNA →</span>
                      </div>
                    </div>
                    <p className="font-mono text-xs font-semibold text-stone-800 truncate group-hover:text-emerald-600 transition-colors">
                      {stone.sku}
                    </p>
                    <p className="text-xs text-stone-500">{stone.weightCt}ct</p>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center"
        >
          <p className="text-sm text-stone-400">
            GEMS DNA • Diamond Network by Gemstar
          </p>
        </motion.div>
      </div>

      {/* Sync Info Dialog */}
      <SyncInfoDialog
        isOpen={showSyncDialog}
        onClose={() => setShowSyncDialog(false)}
        currentStats={stats}
        onSyncComplete={fetchData}
      />
    </div>
  );
};

export default HomePage;
