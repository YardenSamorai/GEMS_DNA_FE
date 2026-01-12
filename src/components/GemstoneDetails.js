import React, { useState } from 'react';
import { decryptPrice } from '../utils/decrypt';
import { motion, AnimatePresence } from 'framer-motion';
import { SignedIn } from "@clerk/clerk-react";
import toast from 'react-hot-toast';

const GemstoneDetails = ({ data }) => {
  const {
    model_number, jewelry_type, style, collection,
    price, video_link, all_pictures_link, certificate_link, certificate_number,
    title, description, jewelry_weight, total_carat,
    center_stone_carat, center_stone_shape, center_stone_color, center_stone_clarity,
    metal_type, currency, category, full_description
  } = data;

  const images = all_pictures_link?.split(';').map((img) => img.trim()).filter(Boolean);
  const [mainImage, setMainImage] = useState(images?.[0]);
  const [zoom, setZoom] = useState(false);

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
    const videoUrl = video_link;
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

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <motion.div 
        className="max-w-7xl mx-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="glass rounded-3xl shadow-xl border border-white/50 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            {/* Left - Gallery */}
            <div className="relative bg-stone-50 p-6 sm:p-8">
              {/* Type Badge */}
              <div className="absolute top-6 left-6 z-10">
                <span className="badge badge-success text-xs uppercase tracking-wider">
                  {jewelry_type}
                </span>
              </div>

              {/* Main Image */}
              <div 
                className="relative rounded-2xl overflow-hidden bg-white shadow-lg cursor-zoom-in aspect-square mb-4"
                onClick={() => setZoom(true)}
              >
                <AnimatePresence mode="wait">
                  <motion.img
                    key={mainImage}
                    src={mainImage}
                    alt="Main product"
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className="w-full h-full object-cover"
                  />
                </AnimatePresence>
                
                {/* Zoom hint */}
                <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                  </svg>
                  Click to zoom
                </div>
              </div>

              {/* Thumbnails */}
              <div className="flex gap-3 overflow-x-auto pb-2">
                {images?.map((img, index) => (
                  <motion.button
                    key={index}
                    onClick={() => setMainImage(img)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                      mainImage === img 
                        ? 'border-primary-500 shadow-md shadow-primary-500/25' 
                        : 'border-transparent hover:border-stone-300'
                    }`}
                  >
                    <img
                      src={img}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </motion.button>
                ))}
              </div>

              {/* Zoom Modal */}
              <AnimatePresence>
                {zoom && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4"
                    onClick={() => setZoom(false)}
                  >
                    <motion.img 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      src={mainImage} 
                      alt="Zoomed" 
                      className="max-h-[90vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl" 
                    />
                    <button className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right - Details */}
            <div className="p-6 sm:p-8 lg:p-10 flex flex-col">
              {/* Header */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">{collection}</span>
                  <span className="text-stone-300">•</span>
                  <span className="text-xs text-stone-400">{model_number}</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-stone-800 mb-4">{title}</h1>
                
                <SignedIn>
                  <div className="inline-flex items-baseline gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary-50 to-accent-50 border border-primary-200">
                    <span className="text-sm text-stone-500">{currency}</span>
                    <span className="text-2xl font-bold text-stone-800">
                      {price ? decryptPrice(price).toLocaleString() : "N/A"}
                    </span>
                  </div>
                </SignedIn>
              </div>

              {/* Description */}
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-stone-700 mb-2 uppercase tracking-wider">Description</h2>
                <p className="text-stone-600 leading-relaxed whitespace-pre-line">{full_description}</p>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <SpecCard label="Category" value={category} />
                <SpecCard label="Style" value={style} />
                <SpecCard label="Metal" value={metal_type} />
                <SpecCard label="Weight" value={`${jewelry_weight}g`} />
                <SpecCard label="Center Stone" value={`${center_stone_carat} ct`} />
                <SpecCard label="Shape" value={center_stone_shape} />
                <SpecCard label="Color" value={center_stone_color} />
                <SpecCard label="Clarity" value={center_stone_clarity} />
                <SpecCard label="Total Carat" value={total_carat} />
                <SpecCard label="Certificate" value={certificate_number} />
              </div>

              {/* Stone Code - Signed In Only */}
              <SignedIn>
                <div className="mb-6 p-4 rounded-xl bg-stone-100 border border-stone-200">
                  <span className="text-sm text-stone-500">Stone Code</span>
                  <p className="text-lg font-bold text-stone-800 font-mono">
                    {(description?.match(/\bB[A-Z]+\b/) || [])[0] || "N/A"}
                  </p>
                </div>
              </SignedIn>

              {/* Certificate Preview */}
              {certificate_link && (
                <div className="mb-6">
                  <h2 className="text-sm font-semibold text-stone-700 mb-3 uppercase tracking-wider">Certificate</h2>
                  <a 
                    href={certificate_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl overflow-hidden border border-stone-200 hover:border-primary-300 transition-colors card-hover"
                  >
                    <iframe
                      src={certificate_link}
                      title="Certificate"
                      className="w-full h-48 pointer-events-none"
                    />
                  </a>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-auto pt-6 border-t border-stone-200 flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={handleShare}
                  className="flex-1 btn-primary flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share DNA
                </button>
                <button 
                  onClick={handleShareVideo}
                  className="flex-1 btn-secondary flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Share Video
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const SpecCard = ({ label, value }) => (
  <div className="p-3 rounded-xl bg-stone-50 hover:bg-stone-100 transition-colors">
    <span className="text-xs text-stone-400 uppercase tracking-wider">{label}</span>
    <p className="text-sm font-semibold text-stone-800 mt-0.5">{value || 'N/A'}</p>
  </div>
);

export default GemstoneDetails;
