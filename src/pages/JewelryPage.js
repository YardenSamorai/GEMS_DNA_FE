import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import GemstoneDetails from '../components/GemstoneDetails';

const JewelryPage = () => {
  const { modelNumber } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchItem = async () => {
      try {
        // const res = await fetch(`https://gems-dna-be.onrender.com/api/jewelry/${modelNumber}`);
        const res = await fetch(`http://localhost:3001/api/jewelry/${modelNumber}`);
        if (!res.ok) throw new Error('Item not found');
        const data = await res.json();
        setItem(data);
      } catch (err) {
        console.error('❌ Error fetching item:', err);
      } finally {
        setLoading(false);
      }
    };
  
    fetchItem();
  }, [modelNumber]);

  if (loading) return <div className="p-8 text-center">🔄 Loading...</div>;
  if (!item) return <div className="p-8 text-center text-red-600">❌ Jewelry item not found</div>;

  return <GemstoneDetails data={item} />;
};

export default JewelryPage;
