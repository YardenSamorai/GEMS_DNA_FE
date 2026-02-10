import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { decryptPrice } from "../utils/decrypt";
import { changeMeasurementsFormat, encryptPrice } from "../utils/helper";
import { barakURL } from "../utils/const";
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

// API base URL from .env
const API_BASE = process.env.REACT_APP_API_URL || 'https://gems-dna-be.vercel.app';

const DiamondCard = () => {
  const { stone_id } = useParams();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const { isSignedIn } = useUser();

  // Helper functions to detect stone category
  const isEmerald = () => {
    const category = (details?.category || '').toLowerCase();
    return category.includes('emerald');
  };

  const isDiamond = () => {
    const category = (details?.category || '').toLowerCase();
    return category.includes('diamond') && !category.includes('fancy');
  };

  const isFancy = () => {
    const category = (details?.category || '').toLowerCase();
    return category.includes('fancy');
  };

  useEffect(() => {
    if (!stone_id) return;

    fetch(`${API_BASE}/api/stones/${stone_id}`)
      .then((res) => res.json())
      .then((data) => {
        setDetails(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("❌ Error fetching stone:", err);
        setLoading(false);
      });
  }, [stone_id]);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Check out this gem!', text: 'View the full DNA of this gemstone:', url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard!');
      }
    } catch (error) {
      toast.error('Sharing canceled or failed.');
    }
  };

  const handleShareVideo = async () => {
    const videoUrl = details?.video;
    if (!videoUrl) return toast.error('No video available to share.');
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Gemstone Video', text: 'Check out this gemstone video:', url: videoUrl });
      } else {
        await navigator.clipboard.writeText(videoUrl);
        toast.success('Video link copied to clipboard!');
      }
    } catch (error) {
      toast.error('Sharing canceled or failed.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary-200 rounded-full"></div>
            <div className="w-16 h-16 border-4 border-primary-500 rounded-full border-t-transparent animate-spin absolute inset-0"></div>
          </div>
          <p className="text-stone-500 font-medium">Loading stone details...</p>
        </div>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-stone-800 mb-2">Stone Not Found</h2>
          <p className="text-stone-500">The stone you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const halfTotalPrice = decryptPrice(details.total_price) / 2;

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <motion.div 
        className="max-w-6xl mx-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header Card */}
        <div className="glass rounded-3xl shadow-xl border border-white/50 overflow-hidden mb-6">
          {/* Title Bar */}
          <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-5 sm:px-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="badge badge-gold">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    {details.lab}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(details.stone_id);
                      toast.success('SKU copied!', { duration: 1500, style: { fontSize: '14px' } });
                    }}
                    className="flex items-center gap-1.5 text-stone-400 text-sm hover:text-white transition-colors group cursor-pointer"
                    title="Click to copy SKU"
                  >
                    <span>ID: {details.stone_id}</span>
                    <svg className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">
                  {details.shape} • {details.carat} ct {(isDiamond() || isFancy()) && details.clarity ? `• ${details.clarity}` : ''}
                </h1>
              </div>
              {isSignedIn && (
                <div className="flex flex-col items-start sm:items-end">
                  <span className="text-stone-400 text-sm mb-1">Total Price</span>
                  <span className="text-3xl font-bold text-gradient-gold">{encryptPrice(halfTotalPrice)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left - Media */}
              <div className="space-y-6">
                {/* Main Video/Image */}
                <div className="relative rounded-2xl overflow-hidden bg-stone-100 aspect-square shadow-lg">
                  {details.video ? (
                    <iframe 
                      className="w-full h-full absolute inset-0" 
                      src={details.video} 
                      title="Video Preview" 
                      allowFullScreen
                    ></iframe>
                  ) : (
                    <img 
                      src={details.picture || "https://app.barakdiamonds.com/Gemstones/Output/StoneImages/Eshed_no_image_2.jpg"} 
                      alt="Stone"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                {/* Thumbnails */}
                <div className="grid grid-cols-2 gap-4">
                  {details.picture && (
                    <div className="relative group">
                      <div className="rounded-xl overflow-hidden bg-stone-100 aspect-square shadow-md card-hover">
                        <img 
                          src={details.picture} 
                          alt="Stone" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="absolute bottom-2 left-2 text-xs font-medium text-white bg-black/50 px-2 py-1 rounded-lg">
                        Photo
                      </span>
                    </div>
                  )}
                  {details.certificate_number && details.certificate_number.trim() !== '' && (
                    <a
                      href={`${barakURL}/${details.certificate_number}.pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative group"
                    >
                      <div className="rounded-xl overflow-hidden bg-stone-100 aspect-square shadow-md card-hover border-2 border-transparent hover:border-primary-500">
                        <embed
                          src={`${barakURL}/${details.certificate_number}.pdf`}
                          type="application/pdf"
                          className="w-full h-full pointer-events-none"
                        />
                      </div>
                      <span className="absolute bottom-2 left-2 text-xs font-medium text-white bg-black/50 px-2 py-1 rounded-lg">
                        Certificate
                      </span>
                      <div className="absolute inset-0 bg-primary-500/0 group-hover:bg-primary-500/10 transition-colors rounded-xl flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-primary-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                          View PDF
                        </span>
                      </div>
                    </a>
                  )}
                </div>
              </div>

              {/* Right - Details */}
              <div className="space-y-6">
                {/* Tabs */}
                <div className="flex gap-2 p-1 bg-stone-100 rounded-xl">
                  <TabButton active={activeTab === 'details'} onClick={() => setActiveTab('details')}>
                    Details
                  </TabButton>
                  <TabButton active={activeTab === 'specs'} onClick={() => setActiveTab('specs')}>
                    Specifications
                  </TabButton>
                </div>

                {/* Tab Content */}
                {activeTab === 'details' && (
                  <motion.div 
                    className="space-y-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Common fields for all stones */}
                    <DetailCard icon="💎" title="Shape" value={details.shape} />
                    <DetailCard icon="⚖️" title="Carat Weight" value={`${details.carat} ct`} />
                    
                    {/* Diamond & Fancy specific: Color */}
                    {(isDiamond() || isFancy()) && details.color && (
                      <DetailCard icon="🎨" title="Color" value={details.color} />
                    )}
                    
                    {/* Diamond & Fancy specific: Clarity */}
                    {(isDiamond() || isFancy()) && (
                      <DetailCard icon="✨" title="Clarity" value={details.clarity} />
                    )}
                    
                    {/* Common: Lab */}
                    <DetailCard icon="🏛️" title="Lab" value={details.lab} />
                    
                    {/* Diamond & Fancy specific: Fluorescence */}
                    {(isDiamond() || isFancy()) && details.fluorescence && (
                      <DetailCard icon="💡" title="Fluorescence" value={details.fluorescence} />
                    )}
                    
                    {/* Common: Origin */}
                    <DetailCard icon="🌍" title="Origin" value={details.origin} />
                    
                    {/* Emerald specific: Treatment */}
                    {isEmerald() && details.treatment && (
                      <DetailCard icon="💧" title="Treatment" value={details.treatment} />
                    )}
                    
                    {/* Common: Ratio & Measurements */}
                    <DetailCard icon="📐" title="Ratio" value={details.ratio} />
                    <DetailCard icon="📏" title="Measurements" value={changeMeasurementsFormat(details.measurements1)} />
                    
                    {/* Location - only for signed-in users */}
                    {isSignedIn && details.location && (
                      <DetailCard icon="📍" title="Location" value={details.location} />
                    )}
                    
                    {/* Diamond & Fancy specific: Cut, Polish, Symmetry */}
                    {(isDiamond() || isFancy()) && (
                      <>
                        {details.cut && <DetailCard icon="✂️" title="Cut" value={details.cut} />}
                        {details.polish && <DetailCard icon="✨" title="Polish" value={details.polish} />}
                        {details.symmetry && <DetailCard icon="⚖️" title="Symmetry" value={details.symmetry} />}
                        {details.table_percent && <DetailCard icon="📊" title="Table %" value={`${details.table_percent}%`} />}
                        {details.depth_percent && <DetailCard icon="📏" title="Depth %" value={`${details.depth_percent}%`} />}
                        {details.rap_price !== null && details.rap_price !== undefined && (
                          <DetailCard icon="💰" title="Rap %" value={`${details.rap_price}%`} />
                        )}
                      </>
                    )}
                    
                    {/* Fancy specific: Fancy Color details */}
                    {isFancy() && (
                      <>
                        {details.fancy_intensity && <DetailCard icon="🌈" title="Fancy Intensity" value={details.fancy_intensity} />}
                        {details.fancy_color && <DetailCard icon="🎨" title="Fancy Color" value={details.fancy_color} />}
                        {details.fancy_overtone && <DetailCard icon="✨" title="Overtone" value={details.fancy_overtone} />}
                        {details.fancy_color_2 && <DetailCard icon="🎨" title="Secondary Color" value={details.fancy_color_2} />}
                        {details.fancy_overtone_2 && <DetailCard icon="✨" title="Secondary Overtone" value={details.fancy_overtone_2} />}
                      </>
                    )}
                    
                    {/* Pair Stone */}
                    {details.pair_stone && (
                      <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 hover:border-indigo-300 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">💎</span>
                          <span className="text-stone-600 font-medium">Pair Stone</span>
                        </div>
                        <Link
                          to={`/${details.pair_stone}`}
                          className="text-indigo-600 hover:text-indigo-700 font-semibold underline decoration-indigo-300 underline-offset-2 hover:decoration-indigo-500 transition-colors flex items-center gap-1"
                        >
                          {details.pair_stone}
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </Link>
                      </div>
                    )}

                    {isSignedIn && (
                      <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-primary-50 to-accent-50 border border-primary-200">
                        <div className="flex items-center justify-between">
                          <span className="text-stone-600 font-medium">Price per Carat</span>
                          <span className="text-lg font-bold text-primary-700">
                            B{encryptPrice(decryptPrice(details.price_per_carat))}
                          </span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'specs' && (
                  <motion.div 
                    className="space-y-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <DetailCard icon="🔢" title="Stone ID" value={details.stone_id} />
                    {details.category && <DetailCard icon="📁" title="Category" value={details.category} />}
                    <DetailCard 
                      icon="📜" 
                      title="Certificate #" 
                      value={
                        details.certificate_number ? (
                          <a 
                            href={`${barakURL}/${details.certificate_number}.pdf`} 
                            className="text-primary-600 hover:text-primary-700 underline decoration-primary-300 underline-offset-2"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {details.certificate_number}
                          </a>
                        ) : 'N/A'
                      } 
                    />
                    <DetailCard icon="📏" title="Measurements" value={changeMeasurementsFormat(details.measurements1)} />
                    
                    {/* Emerald specific: Treatment in specs */}
                    {isEmerald() && details.treatment && (
                      <DetailCard icon="💧" title="Treatment" value={details.treatment} />
                    )}
                    
                    {/* Diamond & Fancy specific technical specs */}
                    {(isDiamond() || isFancy()) && (
                      <>
                        {details.cut && <DetailCard icon="✂️" title="Cut" value={details.cut} />}
                        {details.polish && <DetailCard icon="✨" title="Polish" value={details.polish} />}
                        {details.symmetry && <DetailCard icon="⚖️" title="Symmetry" value={details.symmetry} />}
                        {details.table_percent && <DetailCard icon="📊" title="Table %" value={`${details.table_percent}%`} />}
                        {details.depth_percent && <DetailCard icon="📏" title="Depth %" value={`${details.depth_percent}%`} />}
                        {details.fluorescence && <DetailCard icon="💡" title="Fluorescence" value={details.fluorescence} />}
                        {details.rap_price !== null && details.rap_price !== undefined && (
                          <DetailCard icon="💰" title="Rap %" value={`${details.rap_price}%`} />
                        )}
                      </>
                    )}
                    
                    {/* Fancy specific: Fancy Color details in specs */}
                    {isFancy() && (
                      <>
                        {details.fancy_intensity && <DetailCard icon="🌈" title="Fancy Intensity" value={details.fancy_intensity} />}
                        {details.fancy_color && <DetailCard icon="🎨" title="Fancy Color" value={details.fancy_color} />}
                        {details.fancy_overtone && <DetailCard icon="✨" title="Overtone" value={details.fancy_overtone} />}
                      </>
                    )}
                  </motion.div>
                )}

                {/* Action Buttons */}
                <div className="pt-6 border-t border-stone-200 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={handleShare}
                      className="btn-secondary flex items-center justify-center gap-2 py-2.5"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      Share DNA
                    </button>
                    <button 
                      onClick={handleShareVideo}
                      className="btn-secondary flex items-center justify-center gap-2 py-2.5"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Share Video
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const TabButton = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
      active
        ? 'bg-white text-stone-900 shadow-md'
        : 'text-stone-500 hover:text-stone-700'
    }`}
  >
    {children}
  </button>
);

const DetailCard = ({ icon, title, value }) => (
  <div className="flex items-center justify-between p-4 rounded-xl bg-stone-50 hover:bg-stone-100 transition-colors">
    <div className="flex items-center gap-3">
      <span className="text-xl">{icon}</span>
      <span className="text-stone-600 font-medium">{title}</span>
    </div>
    <span className="text-stone-900 font-semibold">{value || 'N/A'}</span>
  </div>
);

export default DiamondCard;
