import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Sidabar from '../components/Sidabar';
import InfoCard from '../components/InfoCard';
import { Database, RefreshCw, CheckCircle } from 'lucide-react';

const HomePage = () => {
  // 📊 Component state for dashboard data
  const [data, setData] = useState({
    productsCount: 0,
    syncStatus: 'Loading...',
    lastSync: null
  });

  // 🚀 Fetch dashboard data from API on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/dashboard/overview');
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error('❌ Error fetching dashboard data:', err);
      }
    };

    fetchData();
  }, []);

  // 🕒 Format lastSync timestamp to Israeli time (if exists)
  const formattedSyncTime = data.lastSync
    ? new Date(data.lastSync).toLocaleString('he-IL', {
        timeZone: 'Asia/Jerusalem',
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : 'N/A';

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-800">
      {/* 📚 Sidebar navigation */}
      <Sidabar />

      {/* 🧱 Main content area */}
      <div className="flex-1 flex flex-col">
        <Navbar />

        <main className="flex-1 p-8">
          <div className="max-w-6xl mx-auto">
            {/* 📈 Info cards row */}
            <div className="flex flex-wrap gap-6">
              <InfoCard
                icon={<Database size={20} />}
                title="Live Products"
                value={data.productsCount}
                description="Total active stones in the database"
              />
              <InfoCard
                icon={<RefreshCw size={20} />}
                title="Sync Status"
                value={data.syncStatus}
                description="The system is currently connected"
              />
              <InfoCard
                icon={<CheckCircle size={20} />}
                title="Last Sync"
                value={formattedSyncTime}
                description="Last time data was imported"
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default HomePage;