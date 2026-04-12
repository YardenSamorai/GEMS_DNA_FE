import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getDisplayShape, getDisplayColor } from "../helpers/constants";

const DNADrawer = ({ isOpen, onClose, stone }) => {
  const [activeTab, setActiveTab] = useState('details');

  if (!isOpen || !stone) return null;

  const handleShare = async () => {
    const url = `https://gems-dna.com/${stone.sku}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Check out this gem!', text: 'View the full DNA of this gemstone:', url });
      } else {
        await navigator.clipboard.writeText(url);
        alert('Link copied to clipboard!');
      }
    } catch (error) {
      console.log('Sharing canceled');
    }
  };

  const DetailRow = ({ label, value }) => (
    <div className="flex justify-between items-center py-2 border-b border-stone-100 last:border-0">
      <span className="text-stone-500 text-sm">{label}</span>
      <span className="text-stone-800 font-medium text-sm">{value || '-'}</span>
    </div>
  );

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer - Bottom sheet on mobile, side panel on desktop */}
      <motion.div
        initial={{ y: "100%", x: 0 }}
        animate={{ y: 0, x: 0 }}
        exit={{ y: "100%", x: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[92vh] overflow-hidden
                   sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[480px] sm:max-w-full sm:rounded-t-none sm:rounded-l-3xl sm:max-h-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle (Mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-stone-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-border bg-card px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {stone.lab && (
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                  {stone.lab}
                </span>
                )}
                <span className="text-muted-foreground text-xs">SKU: {stone.sku}</span>
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                {getDisplayShape(stone.shape)} · {stone.weightCt}ct
              </h2>
            </div>
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors text-muted-foreground"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(92vh - 140px)' }}>
          {/* Media Section */}
          <div className="p-4 sm:p-6">
            {/* Main Video/Image */}
            <div className="relative rounded-lg overflow-hidden bg-muted aspect-square mb-4">
              {stone.videoUrl ? (
                <iframe
                  className="w-full h-full absolute inset-0"
                  src={stone.videoUrl}
                  title="Video Preview"
                  allowFullScreen
                />
              ) : stone.imageUrl ? (
                <img
                  src={stone.imageUrl}
                  alt={stone.sku}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-400">
                  <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Thumbnails */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              {stone.imageUrl && (
                <a href={stone.imageUrl} target="_blank" rel="noopener noreferrer" className="relative rounded-xl overflow-hidden bg-stone-100 aspect-square shadow group">
                  <img src={stone.imageUrl} alt="Photo" className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 left-1 text-[10px] font-medium text-white bg-black/50 px-1.5 py-0.5 rounded">Photo</span>
                </a>
              )}
              {stone.videoUrl && (
                <a href={stone.videoUrl} target="_blank" rel="noopener noreferrer" className="relative rounded-xl overflow-hidden bg-stone-100 aspect-square shadow group">
                  <div className="w-full h-full flex items-center justify-center bg-stone-800">
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <span className="absolute bottom-1 left-1 text-[10px] font-medium text-white bg-black/50 px-1.5 py-0.5 rounded">Video</span>
                </a>
              )}
              {stone.certificateUrl && (
                <a href={stone.certificateUrl} target="_blank" rel="noopener noreferrer" className="relative rounded-xl overflow-hidden bg-stone-100 aspect-square shadow group">
                  <div className="w-full h-full flex items-center justify-center bg-amber-50">
                    <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <span className="absolute bottom-1 left-1 text-[10px] font-medium text-white bg-black/50 px-1.5 py-0.5 rounded">Cert</span>
                </a>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-stone-100 rounded-xl mb-4">
              <button
                onClick={() => setActiveTab('details')}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-all ${
                  activeTab === 'details' ? 'bg-white text-stone-900 shadow' : 'text-stone-500'
                }`}
              >
                Details
              </button>
              <button
                onClick={() => setActiveTab('pricing')}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-all ${
                  activeTab === 'pricing' ? 'bg-white text-stone-900 shadow' : 'text-stone-500'
                }`}
              >
                Pricing
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'details' && (
              <div className="bg-stone-50 rounded-xl p-4 space-y-0">
                <DetailRow label="Shape" value={getDisplayShape(stone.shape)} />
                <DetailRow label="Weight" value={`${stone.weightCt} ct`} />
                <DetailRow label="Color" value={getDisplayColor(stone)} />
                <DetailRow label="Clarity" value={stone.clarity} />
                <DetailRow label="Clarity" value={stone.treatment} />
                <DetailRow label="Origin" value={stone.origin} />
                <DetailRow label="Lab" value={stone.lab} />
                <DetailRow label="Measurements" value={stone.measurements} />
                <DetailRow label="Ratio" value={stone.ratio} />
                <DetailRow label="Location" value={stone.location} />
                <DetailRow label="Certificate #" value={stone.certificateNumber} />
              </div>
            )}

            {activeTab === 'pricing' && (
              <div className="space-y-3">
                <div className="bg-muted rounded-md p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-stone-600">Price per Carat</span>
                    <span className="text-xl font-bold text-emerald-700">
                      ${stone.pricePerCt?.toLocaleString() || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-emerald-200">
                    <span className="text-stone-600">Total Price</span>
                    <span className="text-2xl font-bold text-emerald-800">
                      ${stone.priceTotal?.toLocaleString() || 'N/A'}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-stone-400 text-center">
                  {stone.weightCt}ct × ${stone.pricePerCt?.toLocaleString()}/ct
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Fixed Footer Actions */}
        <div className="sticky bottom-0 bg-white border-t border-stone-200 p-4 sm:p-6 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleShare}
              className="py-2.5 px-4 bg-stone-100 text-stone-700 font-medium rounded-xl flex items-center justify-center gap-2 hover:bg-stone-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </button>
            <a
              href={`https://gems-dna.com/${stone.sku}`}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-4 bg-stone-100 text-stone-700 font-medium rounded-xl flex items-center justify-center gap-2 hover:bg-stone-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Full Page
            </a>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DNADrawer;
