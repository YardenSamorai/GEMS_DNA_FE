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

    </div>
  );
};

export default HomePage;