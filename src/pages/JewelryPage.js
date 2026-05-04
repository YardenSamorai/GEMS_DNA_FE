import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import GemstoneDetails from '../components/GemstoneDetails';
import { Skeleton, SkeletonText } from '../components/ui/Skeleton';

const API_BASE = process.env.REACT_APP_API_URL || 'https://gems-dna-be.onrender.com';

const JewelryPage = () => {
  const { modelNumber } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchItem = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/jewelry/${modelNumber}`);
        if (!res.ok) throw new Error('Item not found');
        const data = await res.json();
        setItem(data);
      } catch (err) {
        console.error('Error fetching item:', err);
      } finally {
        setLoading(false);
      }
    };
  
    fetchItem();
  }, [modelNumber]);

  if (loading) {
    // Mirror the public DNA jewelry layout: large hero image on top, then
    // title + meta + 2 paragraphs of description below.
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-5">
        <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
        <div className="space-y-3">
          <Skeleton className="h-7 w-2/3" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <SkeletonText lines={4} />
        </div>
      </div>
    );
  }
  if (!item) return <div className="p-8 text-center text-red-600">Jewelry item not found</div>;

  return <GemstoneDetails data={item} />;
};

export default JewelryPage;
