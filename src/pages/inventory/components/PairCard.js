import React from "react";
import { motion } from "framer-motion";
import { getDisplayShape, getDisplayColor, shortTreatment } from "../helpers/constants";
import { shareToWhatsApp } from "../helpers/whatsappHelpers";

const PairCard = ({ stoneA, stoneB, onViewDNA, stoneTags, isSelected, onToggleSelection, onImageClick, onVideoClick, priceMode }) => {
  const StoneSide = ({ stone, label }) => (
    <div className="flex-1 min-w-0">
      {/* Image */}
      <div 
        className={`w-full aspect-square rounded-xl overflow-hidden bg-stone-100 mb-3 ${stone.imageUrl ? 'cursor-pointer hover:ring-2 hover:ring-primary-300 transition-all' : ''}`}
        onClick={() => { if (stone.imageUrl && onImageClick) onImageClick(stone.imageUrl); }}
      >
        {stone.imageUrl ? (
          <img src={stone.imageUrl} alt={stone.sku} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-300">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
      {stone.videoUrl && (
        <button
          onClick={() => { if (onVideoClick) onVideoClick(stone.videoUrl); }}
          className="mt-1.5 w-full inline-flex items-center justify-center gap-1.5 px-2 py-1 rounded-lg bg-accent-100 text-accent-700 text-xs font-medium hover:bg-accent-200 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          Video
        </button>
      )}
      {/* Info */}
      <div className="space-y-1.5">
        <span className="inline-block text-xs font-mono font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-md">
          {stone.sku}
        </span>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-stone-800">{getDisplayShape(stone.shape)}</span>
          <span className="text-sm font-bold text-stone-900">{stone.weightCt} ct</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-stone-500">
          {stone.measurements && <span>{stone.measurements}</span>}
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {stone.origin && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-600">{stone.origin}</span>
          )}
          {stone.treatment && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">{stone.treatment}</span>
          )}
          {stone.lab && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700">{stone.lab}</span>
          )}
          {stone.location && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">נ" {stone.location}</span>
          )}
        </div>
        {/* Price */}
        <div className="pt-1">
          <span className="text-base font-bold text-stone-900">${stone.priceTotal ? Math.round(priceMode === 'neto' ? stone.priceTotal / 2 : stone.priceTotal).toLocaleString() : '-'}</span>
          <span className="text-xs text-stone-400 ml-1">(${stone.pricePerCt ? Math.round(priceMode === 'neto' ? stone.pricePerCt / 2 : stone.pricePerCt).toLocaleString() : '-'}/ct)</span>
        </div>
      </div>
      {/* View DNA button */}
      <button
        onClick={() => onViewDNA && onViewDNA(stone)}
        className="mt-3 w-full py-2 rounded-lg bg-primary-50 hover:bg-primary-100 text-primary-700 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        View DNA
      </button>
    </div>
  );

  // Calculate combined weight
  const combinedWeight = ((stoneA.weightCt || 0) + (stoneB ? stoneB.weightCt || 0 : 0)).toFixed(2);
  const rawCombinedPrice = ((stoneA.priceTotal || 0) + (stoneB ? stoneB.priceTotal || 0 : 0));
  const combinedPrice = priceMode === 'neto' ? Math.round(rawCombinedPrice / 2) : rawCombinedPrice;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg border bg-card overflow-hidden transition-all ${
        isSelected 
          ? 'border-emerald-500 ring-2 ring-emerald-300' 
          : 'border-emerald-200 hover:border-emerald-300'
      }`}
    >
      {/* Pair Header */}
      <div 
        className="bg-primary px-4 py-2.5 flex items-center justify-between cursor-pointer"
        onClick={() => onToggleSelection && onToggleSelection()}
      >
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isSelected || false}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelection && onToggleSelection();
            }}
            className="w-4 h-4 rounded border-white/50 text-emerald-300 focus:ring-emerald-300 cursor-pointer"
          />
          <svg className="w-4 h-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <span className="text-white font-semibold text-sm">Pair</span>
        </div>
        <div className="flex items-center gap-3 text-white/90 text-xs">
          <span>ג–ן¸ {combinedWeight} ct</span>
          <span>נ'° ${combinedPrice.toLocaleString()}</span>
        </div>
      </div>

      {/* Two stones side by side */}
      <div className="p-4">
        <div className="flex gap-4">
          <StoneSide stone={stoneA} label="Stone 1" />
          {/* Divider */}
          <div className="flex flex-col items-center justify-center">
            <div className="w-px h-full bg-stone-200 relative">
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 bg-white border border-stone-200 rounded-full w-8 h-8 flex items-center justify-center">
                <span className="text-xs font-bold text-emerald-500">+</span>
              </div>
            </div>
          </div>
          {stoneB ? (
            <StoneSide stone={stoneB} label="Stone 2" />
          ) : (
            <div className="flex-1 min-w-0 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-200 bg-stone-50 p-6">
              <svg className="w-8 h-8 text-stone-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-stone-400 text-center font-medium">Pair stone not in inventory</p>
              <p className="text-[10px] text-stone-300 mt-1">{stoneA.pairSku}</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default PairCard;
