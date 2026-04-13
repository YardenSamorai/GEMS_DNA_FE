import React, { useState } from 'react';
import { decryptPrice } from '../utils/decrypt';
import { sanitizeText } from '../utils/helper';
import { motion, AnimatePresence } from 'framer-motion';
import { SignedIn } from "@clerk/clerk-react";
import toast from 'react-hot-toast';

const GemstoneDetails = ({ data }) => {
  const {
    model_number, jewelry_type, style, collection,
    price, video_link, all_pictures_link, certificate_link, certificate_number,
    title, description, jewelry_weight, total_carat, stone_type, jewelry_size,
    center_stone_carat, center_stone_shape, center_stone_color, center_stone_clarity,
    metal_type, currency, full_description
  } = data;

  const images = all_pictures_link?.split(';').map((img) => img.trim()).filter(Boolean);
  const [mainImage, setMainImage] = useState(images?.[0]);
  const [zoom, setZoom] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Check out this jewelry!', text: 'View the full DNA:', url });
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
        await navigator.share({ title: 'Jewelry Video', text: 'Check out this jewelry video:', url: videoUrl });
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
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-t-3xl px-6 py-5 sm:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-medium text-slate-200 bg-white/15 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {jewelry_type || 'Jewelry'}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(model_number);
                    toast.success('SKU copied!', { duration: 1500, style: { fontSize: '14px' } });
                  }}
                  className="flex items-center gap-1.5 text-slate-300 text-sm hover:text-white transition-colors group cursor-pointer"
                  title="Click to copy SKU"
                >
                  <span>{model_number}</span>
                  <svg className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">{sanitizeText(title)}</h1>
            </div>
            <SignedIn>
              <div className="flex flex-col items-start sm:items-end">
                <span className="text-slate-400 text-sm mb-1">Price</span>
                <span className="text-3xl font-bold text-white">
                  {currency || '$'}{price ? decryptPrice(price).toLocaleString() : 'N/A'}
                </span>
              </div>
            </SignedIn>
          </div>
        </div>

        <div className="glass rounded-b-3xl shadow-xl border border-white/50 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            {/* Left - Gallery */}
            <div className="relative bg-stone-50 p-6 sm:p-8">
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
                        ? 'border-slate-700 shadow-md shadow-slate-700/25' 
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

              {/* Video Link */}
              {video_link && (
                <a
                  href={video_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 transition-colors w-fit"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  Watch Video
                </a>
              )}

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
              {/* Collection */}
              {collection && (
                <div className="mb-4">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{collection}</span>
                </div>
              )}

              {/* Description */}
              {full_description && (
                <div className="mb-6">
                  <p className="text-stone-600 leading-relaxed whitespace-pre-line">{sanitizeText(full_description)}</p>
                </div>
              )}

              {/* Center Stone Section */}
              <div className="mb-6">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                  </svg>
                  Center Stone
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <SpecCard label="Stone Type" value={stone_type?.replace(/\s+O$/i, '').trim()} />
                  <SpecCard label="Carat" value={center_stone_carat ? `${center_stone_carat} ct` : null} />
                  <SpecCard label="Shape" value={center_stone_shape} />
                  <SpecCard label="Color" value={center_stone_color} />
                  <SpecCard label="Clarity" value={center_stone_clarity} />
                </div>
              </div>

              {/* General Details Section */}
              <div className="mb-6">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  General Details
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <SpecCard label="Type" value={jewelry_type} />
                  <SpecCard label="Style" value={style} />
                  <SpecCard label="Metal" value={metal_type} />
                  <SpecCard label="Jewelry Weight" value={jewelry_weight ? `${jewelry_weight}g` : null} />
                  <SpecCard label="Total Carat" value={total_carat ? `${total_carat} ct` : null} />
                  <SpecCard label="Size" value={jewelry_size} />
                  <SpecCard label="Certificate" value={certificate_number} />
                </div>
              </div>

              {/* Certificate Preview */}
              {certificate_link && (
                <div className="mb-6">
                  <h2 className="text-sm font-semibold text-stone-700 mb-3 uppercase tracking-wider">Certificate</h2>
                  <a 
                    href={certificate_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl overflow-hidden border border-stone-200 hover:border-slate-400 transition-colors card-hover"
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
