import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from "@clerk/clerk-react";
import { motion } from 'framer-motion';

const HomePage = () => {
  const { user } = useUser();
  const [stats, setStats] = useState({
    totalStones: 0,
    categories: 0,
    lastSync: null,
    loading: true
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('https://gems-dna-be.vercel.app/api/soap-stones');
        const data = await res.json();
        const stones = Array.isArray(data.stones) ? data.stones : Array.isArray(data) ? data : [];
        
        const categories = new Set(stones.map(s => s.category).filter(Boolean));
        
        setStats({
          totalStones: stones.length,
          categories: categories.size,
          lastSync: new Date(),
          loading: false
        });
      } catch (err) {
        console.error('Error fetching stats:', err);
        setStats(prev => ({ ...prev, loading: false }));
      }
    };

    fetchStats();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl sm:text-4xl font-bold text-stone-800 mb-2">
            {getGreeting()}, {user?.firstName || 'there'} 👋
          </h1>
          <p className="text-stone-500 text-lg">
            Welcome to your GEMS DNA dashboard
          </p>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <StatCard
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              }
              label="Total Stones"
              value={stats.loading ? '...' : stats.totalStones.toLocaleString()}
              color="primary"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <StatCard
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              }
              label="Categories"
              value={stats.loading ? '...' : stats.categories}
              color="accent"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <StatCard
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              label="Status"
              value="Online"
              color="green"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <StatCard
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              }
              label="Last Sync"
              value={stats.lastSync ? stats.lastSync.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '...'}
              color="stone"
            />
          </motion.div>
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-8"
        >
          <h2 className="text-xl font-semibold text-stone-800 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <QuickActionCard
              to="/inventory"
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
              title="Search Inventory"
              description="Browse and filter through all available stones"
              color="primary"
            />

            <QuickActionCard
              to="/inventory"
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              }
              title="Email Templates"
              description="Create and send professional stone details to clients"
              color="accent"
            />

            <QuickActionCard
              to="/inventory"
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
              title="View Reports"
              description="Access detailed inventory and sales analytics"
              color="stone"
            />
          </div>
        </motion.div>

        {/* Recent Activity / Featured */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div className="glass rounded-2xl border border-white/50 p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-stone-800">Getting Started</h2>
              <span className="badge badge-success">New</span>
            </div>
            
            <div className="space-y-4">
              <ChecklistItem 
                done={true}
                title="Account Setup"
                description="Your account has been successfully created"
              />
              <ChecklistItem 
                done={true}
                title="Access Granted"
                description="You now have access to the inventory system"
              />
              <ChecklistItem 
                done={false}
                title="Explore Inventory"
                description="Browse through available stones and their details"
                action={
                  <Link to="/inventory" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                    Go to Inventory →
                  </Link>
                }
              />
              <ChecklistItem 
                done={false}
                title="Send Your First Email"
                description="Select a stone and send details to a client"
              />
            </div>
          </div>
        </motion.div>

        {/* Footer Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 text-center"
        >
          <p className="text-sm text-stone-400">
            GEMS DNA • Diamond Network by Eshed
          </p>
        </motion.div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, color }) => {
  const colorClasses = {
    primary: 'bg-primary-100 text-primary-600',
    accent: 'bg-accent-100 text-accent-600',
    green: 'bg-green-100 text-green-600',
    stone: 'bg-stone-100 text-stone-600',
  };

  return (
    <div className="glass rounded-2xl border border-white/50 p-5 shadow-lg card-hover">
      <div className={`w-12 h-12 rounded-xl ${colorClasses[color]} flex items-center justify-center mb-4`}>
        {icon}
      </div>
      <p className="text-sm text-stone-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-stone-800">{value}</p>
    </div>
  );
};

const QuickActionCard = ({ to, icon, title, description, color }) => {
  const colorClasses = {
    primary: 'from-primary-500 to-primary-600 shadow-primary-500/25',
    accent: 'from-accent-500 to-accent-600 shadow-accent-500/25',
    stone: 'from-stone-600 to-stone-700 shadow-stone-500/25',
  };

  return (
    <Link
      to={to}
      className="group glass rounded-2xl border border-white/50 p-6 shadow-lg card-hover block"
    >
      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center mb-4 text-white shadow-lg group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-stone-800 mb-1 group-hover:text-primary-600 transition-colors">
        {title}
      </h3>
      <p className="text-sm text-stone-500">{description}</p>
    </Link>
  );
};

const ChecklistItem = ({ done, title, description, action }) => (
  <div className="flex items-start gap-4 p-4 rounded-xl bg-stone-50 hover:bg-stone-100 transition-colors">
    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
      done ? 'bg-primary-500 text-white' : 'border-2 border-stone-300'
    }`}>
      {done && (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <h4 className={`font-medium ${done ? 'text-stone-400 line-through' : 'text-stone-800'}`}>
        {title}
      </h4>
      <p className="text-sm text-stone-500">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  </div>
);

export default HomePage;
