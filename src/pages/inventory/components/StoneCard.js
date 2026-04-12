import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getDisplayShape, getDisplayColor, shortTreatment } from "../helpers/constants";
import { createEmailText, createEmailHtml } from "../helpers/exportHelpers";
import { shareToWhatsApp } from "../helpers/whatsappHelpers";
import TagSelector from "./TagSelector";

const StoneCard = ({ stone, onToggle, isExpanded, isSelected, onToggleSelection, stoneTags, allTags, onAddTag, onRemoveTag, onManageTags, onViewDNA, onImageClick, onVideoClick, priceMode }) => (
  <motion.div
    layout
    className={`rounded-lg border overflow-hidden transition-all duration-200 ${
      isSelected 
        ? 'border-primary bg-primary/5' 
        : 'border-border bg-card hover:border-foreground/20'
    }`}
  >
    <div className="p-3.5">
      <div className="flex gap-3">
        {/* Checkbox */}
        <div className="flex items-start pt-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelection(stone.id)}
            className="h-4 w-4 rounded border-input text-primary focus:ring-ring cursor-pointer"
          />
        </div>
        {/* Image */}
        <div 
          className={`w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0 ${stone.imageUrl ? 'cursor-pointer hover:ring-2 hover:ring-ring transition-all' : ''}`}
          onClick={(e) => { if (stone.imageUrl && onImageClick) { e.stopPropagation(); onImageClick(stone.imageUrl); } }}
        >
          {stone.imageUrl ? (
            <img src={stone.imageUrl} alt={stone.sku} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-xs font-mono text-primary px-1.5 py-0.5 rounded bg-primary/10">{stone.sku}</span>
              <h3 className="font-medium text-foreground mt-1 text-sm">{getDisplayShape(stone.shape)}</h3>
            </div>
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {stone.weightCt} ct
            </span>
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span><span className="opacity-60">Total:</span> <span className="font-medium text-foreground">${stone.priceTotal ? Math.round(priceMode === 'neto' ? stone.priceTotal / 2 : stone.priceTotal).toLocaleString() : '-'}</span></span>
            <span><span className="text-stone-400">Price/ct:</span> ${stone.pricePerCt ? Math.round(priceMode === 'neto' ? stone.pricePerCt / 2 : stone.pricePerCt).toLocaleString() : '-'}</span>
            <span><span className="text-stone-400">Measurements:</span> {stone.measurements || 'N/A'}</span>
            <span><span className="text-stone-400">Ratio:</span> {stone.ratio || 'N/A'}</span>
            <span><span className="text-stone-400">Clarity:</span> {shortTreatment(stone.treatment)}</span>
            <span><span className="text-stone-400">Lab:</span> {stone.lab || ''}</span>
            <span><span className="text-stone-400">Location:</span> {stone.location || ''}</span>
            <span><span className="text-stone-400">Type:</span> {stone.pairSku ? 'Pair' : 'Single'}</span>
          </div>
          
          {/* Tags */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {stoneTags?.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </span>
            ))}
            <TagSelector
              stoneSku={stone.sku}
              currentTags={stoneTags || []}
              allTags={allTags}
              onAddTag={onAddTag}
              onRemoveTag={onRemoveTag}
              onManageTags={onManageTags}
            />
          </div>
        </div>
      </div>

      <button
        onClick={() => onToggle(stone)}
        className="mt-4 w-full py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium text-sm transition-colors"
      >
        {isExpanded ? 'Hide details' : 'View details'}
      </button>
    </div>

    <AnimatePresence>
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-stone-200 bg-stone-50"
        >
          <StoneDetails stone={stone} onViewDNA={onViewDNA} onVideoClick={onVideoClick} />
        </motion.div>
      )}
    </AnimatePresence>
  </motion.div>
);

/* ---------------- Stone Details Panel ---------------- */
const StoneDetails = ({ stone, onViewDNA, onVideoClick }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyEmail = async () => {
    const emailHtml = createEmailHtml(stone);
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const blob = new Blob([emailHtml], { type: "text/html" });
        await navigator.clipboard.write([new ClipboardItem({ "text/html": blob })]);
      } else {
        await navigator.clipboard.writeText(emailHtml);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="p-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <DetailItem label="SKU" value={stone.sku} />
        <DetailItem label="Shape" value={getDisplayShape(stone.shape)} />
        <DetailItem label="Weight" value={`${stone.weightCt} ct`} />
        <DetailItem label="Measurements" value={stone.measurements} />
        <DetailItem label="Color" value={getDisplayColor(stone)} />
        <DetailItem label="Clarity" value={stone.clarity} />
        <DetailItem label="Clarity" value={stone.treatment} />
        <DetailItem label="Lab" value={stone.lab} />
        <DetailItem label="Origin" value={stone.origin} />
        <DetailItem label="Ratio" value={stone.ratio} />
        <DetailItem label="Luster" value={stone.luster} />
        <DetailItem label="Fluorescence" value={stone.fluorescence} />
        <DetailItem label="Box" value={stone.box} />
        <DetailItem label="Grouping Type" value={stone.groupingType} />
      </div>

      {/* Links */}
      <div className="flex flex-wrap gap-2 mb-5">
        {stone.imageUrl && (
          <a href={stone.imageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-100 text-primary-700 text-xs font-medium hover:bg-primary-200 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Photo
          </a>
        )}
        {stone.videoUrl && (
          <button onClick={(e) => { e.stopPropagation(); if (onVideoClick) onVideoClick(stone.videoUrl); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-100 text-accent-700 text-xs font-medium hover:bg-accent-200 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Video
          </button>
        )}
        {stone.certificateUrl && (
          <a href={stone.certificateUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 text-stone-700 text-xs font-medium hover:bg-stone-200 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Certificate
          </a>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onViewDNA && onViewDNA(stone)}
          className="btn-primary text-xs py-2 px-4 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          View DNA
        </button>
        <a
          href={`mailto:?subject=${encodeURIComponent(`Stone ${stone.sku} details`)}&body=${encodeURIComponent(createEmailText(stone))}`}
          className="btn-secondary text-xs py-2 px-4"
        >
          Open in Outlook
        </a>
        <button onClick={handleCopyEmail} className="btn-secondary text-xs py-2 px-4 flex items-center gap-2">
          {copied ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy with images
            </>
          )}
        </button>
        <button 
          onClick={() => shareToWhatsApp(stone)} 
          className="text-xs py-2 px-4 flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          WhatsApp
        </button>
      </div>
    </div>
  );
};

const DetailItem = ({ label, value }) => (
  <div className="p-2 rounded-lg bg-white">
    <span className="text-[10px] uppercase tracking-wider text-stone-400">{label}</span>
    <p className="text-sm font-medium text-stone-800 truncate">{value || '-'}</p>
  </div>
);

export { StoneCard, StoneDetails, DetailItem };
export default StoneCard;
