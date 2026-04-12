import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getMappedCategories } from "../../../utils/categoryMap";
import { getDisplayShape, getDisplayColor, shortTreatment, DEFAULT_COLUMNS } from "../helpers/constants";
import { shareToWhatsApp } from "../helpers/whatsappHelpers";
import { StoneDetails } from "./StoneCard";
import TagSelector from "./TagSelector";
import ColumnSettingsModal from "./ColumnSettingsModal";

const StonesTable = ({ stones, onToggle, selectedStone, loading, error, sortConfig, onSort, selectedStones, onToggleSelection, onToggleSelectAll, allSelected, stoneTags, allTags, onAddTag, onRemoveTag, onManageTags, onViewDNA, onImageClick, onVideoClick, columnConfig, onColumnConfigChange, priceMode, activeDefaultColumns }) => {
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const defaultCols = activeDefaultColumns || DEFAULT_COLUMNS;

  const visibleColumns = useMemo(() => {
    if (!columnConfig) return defaultCols.map(c => c.id);
    return columnConfig.filter(c => c.visible).map(c => c.id);
  }, [columnConfig, defaultCols]);

  const colMeta = useMemo(() => Object.fromEntries(defaultCols.map(c => [c.id, c])), [defaultCols]);

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 sm:p-12">
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-primary-200 rounded-full"></div>
            <div className="w-12 h-12 border-4 border-primary-500 rounded-full border-t-transparent animate-spin absolute inset-0"></div>
          </div>
          <p className="text-stone-500">Loading stones...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 sm:p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-red-600 font-medium">{error}</p>
      </div>
    );
  }

  if (!stones.length) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 sm:p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-stone-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-stone-800 mb-1">No stones found</h3>
        <p className="text-stone-500">Try adjusting your filters</p>
      </div>
    );
  }

  const SortButton = ({ field, children }) => (
    <button
      onClick={() => onSort(field)}
      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {children}
      {sortConfig?.field === field && (
        <span className="text-primary text-[10px]">
          {sortConfig.direction === "asc" ? "▲" : "▼"}
        </span>
      )}
    </button>
  );

  const renderHeader = (colId) => {
    const meta = colMeta[colId];
    if (!meta) return null;
    const base = "px-3 py-3 text-left text-xs font-medium text-muted-foreground";
    switch (colId) {
      case 'sku': return <th key={colId} className={`${base} uppercase`}><SortButton field="sku">SKU</SortButton></th>;
      case 'img': return <th key={colId} className={base}>Img</th>;
      case 'video': return <th key={colId} className={base}>Video</th>;
      case 'category': return <th key={colId} className={base}><SortButton field="category">Category</SortButton></th>;
      case 'type': return <th key={colId} className={`${base} text-center`}>Type</th>;
      case 'shape': return <th key={colId} className={`${base} uppercase`}><SortButton field="shape">Shape</SortButton></th>;
      case 'color': return <th key={colId} className={base}>Color</th>;
      case 'qty': return <th key={colId} className={`${base} text-center`}>Qty</th>;
      case 'weight': return <th key={colId} className={`${base} uppercase`}><SortButton field="weightCt">Weight</SortButton></th>;
      case 'measurements': return <th key={colId} className={`${base} uppercase`}><SortButton field="measurements">Measurements</SortButton></th>;
      case 'ratio': return <th key={colId} className={`${base} uppercase`}><SortButton field="ratio">Ratio</SortButton></th>;
      case 'treatment': return <th key={colId} className={`${base} uppercase`}><SortButton field="treatment">Clarity</SortButton></th>;
      case 'clarity': return <th key={colId} className={`${base} uppercase`}><SortButton field="clarity">Clarity</SortButton></th>;
      case 'origin': return <th key={colId} className={base}>Origin</th>;
      case 'fluorescence': return <th key={colId} className={base}>Fluor.</th>;
      case 'lab': return <th key={colId} className={`${base} uppercase`}><SortButton field="lab">Lab</SortButton></th>;
      case 'ppc': return <th key={colId} className={`${base} uppercase`}><SortButton field="pricePerCt">PPC</SortButton></th>;
      case 'total': return <th key={colId} className={`${base} uppercase`}><SortButton field="priceTotal">Total</SortButton></th>;
      case 'location': return <th key={colId} className={`${base} uppercase`}><SortButton field="location">Location</SortButton></th>;
      case 'title': return <th key={colId} className={base}><SortButton field="title">Title</SortButton></th>;
      case 'jewelryType': return <th key={colId} className={base}><SortButton field="jewelryType">Type</SortButton></th>;
      case 'style': return <th key={colId} className={base}><SortButton field="style">Style</SortButton></th>;
      case 'collection': return <th key={colId} className={base}><SortButton field="collection">Collection</SortButton></th>;
      case 'stoneType': return <th key={colId} className={base}><SortButton field="stoneType">Stone</SortButton></th>;
      case 'metalType': return <th key={colId} className={base}><SortButton field="metalType">Metal</SortButton></th>;
      case 'availability': return <th key={colId} className={base}><SortButton field="availability">Avail.</SortButton></th>;
      default: return null;
    }
  };

  const renderCell = (colId, stone) => {
    const cellBase = "px-3 py-2 whitespace-nowrap";
    switch (colId) {
      case 'sku': return <td key={colId} className={cellBase}><span className="font-mono text-xs font-medium text-primary-600">{stone.sku}</span></td>;
      case 'img': return (
        <td key={colId} className="px-3 py-2">
          <div
            className={`w-10 h-10 rounded-lg overflow-hidden bg-stone-100 border border-stone-200 ${stone.imageUrl ? 'cursor-pointer hover:ring-2 hover:ring-primary-300 transition-all' : ''}`}
            onClick={(e) => { if (stone.imageUrl && onImageClick) { e.stopPropagation(); onImageClick(stone.imageUrl); } }}
          >
            {stone.imageUrl ? (
              <img src={stone.imageUrl} alt={stone.sku} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-stone-300 text-[10px]">N/A</div>
            )}
          </div>
        </td>
      );
      case 'video': return (
        <td key={colId} className="px-3 py-2">
          <div
            className={`w-10 h-10 rounded-lg overflow-hidden bg-stone-100 border border-stone-200 flex items-center justify-center ${stone.videoUrl ? 'cursor-pointer hover:ring-2 hover:ring-accent-300 transition-all' : ''}`}
            onClick={(e) => { if (stone.videoUrl && onVideoClick) { e.stopPropagation(); onVideoClick(stone.videoUrl); } }}
          >
            {stone.videoUrl ? (
              <svg className="w-5 h-5 text-accent-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-stone-300 text-[10px]">N/A</div>
            )}
          </div>
        </td>
      );
      case 'category': return (
        <td key={colId} className={cellBase}>
          <span className="text-xs text-stone-600">{getMappedCategories(stone.category).filter(c => c !== 'Empty').join(', ') || '-'}</span>
        </td>
      );
      case 'type': return (
        <td key={colId} className={`${cellBase} text-center`}>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
            stone.groupingType === 'Pair' ? 'bg-indigo-100 text-indigo-700 font-semibold' :
            stone.groupingType === 'Set' ? 'bg-purple-100 text-purple-700 font-semibold' :
            stone.groupingType === 'Parcel' ? 'bg-amber-100 text-amber-700 font-semibold' :
            stone.groupingType === 'Fancy' ? 'bg-pink-100 text-pink-700 font-semibold' :
            stone.groupingType === 'Side Stones' ? 'bg-teal-100 text-teal-700 font-semibold' :
            stone.groupingType === 'Melee' ? 'bg-rose-100 text-rose-700 font-semibold' :
            stone.groupingType === 'Single' ? 'bg-stone-200 text-stone-600' :
            'bg-stone-100 text-stone-400'
          }`}>
            {stone.groupingType || '-'}
          </span>
        </td>
      );
      case 'shape': return <td key={colId} className={`${cellBase} text-xs text-stone-700`}>{stone.shape}</td>;
      case 'color': return <td key={colId} className="px-3 py-2 text-xs text-stone-700 max-w-[120px]">{getDisplayColor(stone) || '-'}</td>;
      case 'qty': return (
        <td key={colId} className={`${cellBase} text-center`}>
          <span className="inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-600">
            {stone.stones ?? '-'}
          </span>
        </td>
      );
      case 'weight': return <td key={colId} className={`${cellBase} text-xs font-medium text-stone-800`}>{stone.weightCt} ct</td>;
      case 'measurements': return <td key={colId} className={`${cellBase} text-xs text-stone-600`}>{stone.measurements}</td>;
      case 'ratio': return <td key={colId} className={cellBase}><span className="text-xs text-stone-600">{stone.ratio || ''}</span></td>;
      case 'treatment': return <td key={colId} className={cellBase}><span className="badge badge-neutral text-xs">{shortTreatment(stone.treatment)}</span></td>;
      case 'clarity': return <td key={colId} className={cellBase}><span className="text-xs text-stone-600">{stone.clarity || ''}</span></td>;
      case 'origin': return <td key={colId} className={cellBase}><span className="text-xs text-stone-600">{stone.origin || ''}</span></td>;
      case 'fluorescence': return <td key={colId} className={cellBase}><span className="text-xs text-stone-600">{stone.fluorescence || ''}</span></td>;
      case 'lab': return <td key={colId} className={cellBase}><span className="text-xs text-stone-600">{stone.lab || ''}</span></td>;
      case 'ppc': return <td key={colId} className={`${cellBase} text-xs text-stone-700`}>${stone.pricePerCt ? Math.round(priceMode === 'neto' ? stone.pricePerCt / 2 : stone.pricePerCt).toLocaleString() : '-'}</td>;
      case 'total': return <td key={colId} className={`${cellBase} text-xs font-semibold text-stone-800`}>${stone.priceTotal ? Math.round(priceMode === 'neto' ? stone.priceTotal / 2 : stone.priceTotal).toLocaleString() : '-'}</td>;
      case 'location': return <td key={colId} className={cellBase}><span className="text-xs text-stone-600">{stone.location || ''}</span></td>;
      case 'title': return <td key={colId} className="px-3 py-2 max-w-[200px]"><span className="text-xs text-stone-700 truncate block">{stone.title || '-'}</span></td>;
      case 'jewelryType': return (
        <td key={colId} className={cellBase}>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
            stone.jewelryType === 'Rings' ? 'bg-pink-100 text-pink-700' :
            stone.jewelryType === 'Earrings' ? 'bg-purple-100 text-purple-700' :
            stone.jewelryType === 'Necklaces' ? 'bg-blue-100 text-blue-700' :
            stone.jewelryType === 'Pendants' ? 'bg-cyan-100 text-cyan-700' :
            stone.jewelryType === 'Bracelets' ? 'bg-amber-100 text-amber-700' :
            'bg-stone-100 text-stone-600'
          }`}>{stone.jewelryType || '-'}</span>
        </td>
      );
      case 'style': return <td key={colId} className={cellBase}><span className="text-xs text-stone-600">{stone.style || '-'}</span></td>;
      case 'collection': return <td key={colId} className={cellBase}><span className="text-xs text-stone-600">{stone.collection || '-'}</span></td>;
      case 'stoneType': return <td key={colId} className={cellBase}><span className="text-xs text-stone-600">{stone.stoneType || '-'}</span></td>;
      case 'metalType': return <td key={colId} className={cellBase}><span className="text-xs text-stone-600">{stone.metalType || '-'}</span></td>;
      case 'availability': return (
        <td key={colId} className={cellBase}>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
            stone.availability === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>{stone.availability || '-'}</span>
        </td>
      );
      default: return null;
    }
  };

  const MobileStoneCard = ({ stone, index }) => {
    const isSelected = selectedStones?.has(stone.id);
    const isExpanded = selectedStone?.id === stone.id;

  return (
      <motion.div
        layout
        initial={false}
        animate={{ opacity: 1 }}
        className={`rounded-lg border overflow-hidden transition-colors duration-200 ${
          isSelected 
            ? 'border-primary bg-primary/5 ring-1 ring-primary/30' 
            : 'border-border bg-card'
        }`}
      >
        {/* Main Card Content */}
        <div 
          className="p-4"
        >
          <div className="flex gap-3">
            {/* Checkbox */}
            <div className="flex-shrink-0 pt-1">
              <input
                type="checkbox"
                checked={isSelected || false}
                onChange={(e) => {
                  e.stopPropagation();
                  onToggleSelection(stone.id);
                }}
                className="w-5 h-5 text-primary-600 rounded border-stone-300 focus:ring-primary-500"
              />
            </div>

            {/* Image & Video */}
            <div className="flex-shrink-0 flex gap-1.5">
              <div 
                className={`w-16 h-16 rounded-xl overflow-hidden bg-stone-100 border border-stone-200 ${stone.imageUrl ? 'cursor-pointer hover:ring-2 hover:ring-primary-300 transition-all' : ''}`}
                onClick={(e) => { if (stone.imageUrl && onImageClick) { e.stopPropagation(); onImageClick(stone.imageUrl); } }}
              >
                {stone.imageUrl ? (
                  <img src={stone.imageUrl} alt={stone.sku} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-300">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>
              {stone.videoUrl && (
                <div
                  className="w-10 h-16 rounded-xl overflow-hidden bg-stone-100 border border-stone-200 cursor-pointer hover:ring-2 hover:ring-accent-300 transition-all flex items-center justify-center"
                  onClick={(e) => { e.stopPropagation(); if (onVideoClick) onVideoClick(stone.videoUrl); }}
                >
                  <svg className="w-5 h-5 text-accent-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="inline-block font-mono text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-md">
                    {stone.sku}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-medium text-stone-800">{getDisplayShape(stone.shape)}</span>
                    <span className="text-stone-300">•</span>
                    <span className="text-sm font-bold text-stone-900">{stone.weightCt} ct</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-stone-900">
                    ${stone.priceTotal ? Math.round(priceMode === 'neto' ? stone.priceTotal / 2 : stone.priceTotal).toLocaleString() : '-'}
                  </p>
                  <p className="text-xs text-stone-500">
                    ${stone.pricePerCt ? Math.round(priceMode === 'neto' ? stone.pricePerCt / 2 : stone.pricePerCt).toLocaleString() : '-'}/ct
                  </p>
                </div>
              </div>

              {/* Quick Info Tags */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {stone.origin && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                    {stone.origin}
                  </span>
                )}
                {stone.treatment && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                    {stone.treatment}
                  </span>
                )}
                {stone.lab && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                    {stone.lab}
                  </span>
                )}
                {stone.location && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                    📍 {stone.location}
                  </span>
                )}
              </div>
              
              {/* Client Tags */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {stoneTags?.[stone.sku]?.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.name}
                  </span>
                ))}
                <TagSelector
                  stoneSku={stone.sku}
                  currentTags={stoneTags?.[stone.sku] || []}
                  allTags={allTags || []}
                  onAddTag={onAddTag}
                  onRemoveTag={onRemoveTag}
                  onManageTags={onManageTags}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex border-t border-stone-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewDNA && onViewDNA(stone);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-primary-600 hover:bg-primary-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            DNA
          </button>
          <div className="w-px bg-stone-100"></div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(stone);
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
              isExpanded 
                ? 'bg-primary-500 text-white' 
                : 'text-stone-600 hover:bg-stone-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {isExpanded ? 'Hide' : 'Details'}
          </button>
          {stone.certificateUrl && (
            <>
              <div className="w-px bg-stone-100"></div>
              <a
                href={stone.certificateUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Cert
              </a>
            </>
          )}
          <div className="w-px bg-stone-100"></div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              shareToWhatsApp(stone);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-green-600 hover:bg-green-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Share
          </button>
        </div>

        {/* Expanded Details */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-stone-200"
            >
              <StoneDetails stone={stone} onViewDNA={onViewDNA} onVideoClick={onVideoClick} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <>
      {/* Mobile Select All Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 mb-3 rounded-xl bg-stone-100/50">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={allSelected && stones.length > 0}
            onChange={onToggleSelectAll}
            className="w-5 h-5 text-primary-600 rounded border-stone-300 focus:ring-primary-500"
          />
          <span className="text-sm font-medium text-stone-700">Select All</span>
        </label>
        <span className="text-xs text-stone-500">{stones.length} stones</span>
      </div>

      {/* Mobile Cards View */}
      <div className="md:hidden space-y-3">
        {stones.map((stone, index) => (
          <MobileStoneCard key={stone.id} stone={stone} index={index} />
        ))}
      </div>

      {/* Column Settings Modal */}
      <ColumnSettingsModal
        isOpen={showColumnSettings}
        onClose={() => setShowColumnSettings(false)}
        columnConfig={columnConfig || defaultCols.map(c => ({ id: c.id, visible: true }))}
        onSave={onColumnConfigChange}
        activeDefaultColumns={defaultCols}
      />

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-lg border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-3 text-center w-10">
                  <input
                    type="checkbox"
                    checked={allSelected && stones.length > 0}
                    onChange={onToggleSelectAll}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-ring cursor-pointer"
                  />
                </th>
              {visibleColumns.map(colId => renderHeader(colId))}
              <th className="px-2 py-3 text-right w-10">
                <button
                  onClick={() => setShowColumnSettings(true)}
                  className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  title="Column settings"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
                </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {stones.map((stone, index) => {
              const isExpanded = selectedStone?.id === stone.id;
              return (
                  <React.Fragment key={stone.id}>
                  <motion.tr
                      initial={false}
                    animate={{ opacity: 1, y: 0 }}
                      className={`transition-colors ${
                        selectedStones?.has(stone.id) 
                          ? 'border-l-2 border-l-primary bg-primary/5' 
                          : isExpanded 
                            ? 'bg-muted/30 hover:bg-muted/50' 
                            : 'hover:bg-muted/50'
                      }`}
                    >
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={selectedStones?.has(stone.id) || false}
                          onChange={() => onToggleSelection(stone.id)}
                          className="h-4 w-4 rounded border-input text-primary focus:ring-ring cursor-pointer"
                        />
                      </td>
                    {visibleColumns.map(colId => renderCell(colId, stone))}
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => shareToWhatsApp(stone)}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md text-green-600 hover:bg-green-50 transition-colors"
                          title="Share on WhatsApp"
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => onToggle(stone)}
                          className={`inline-flex items-center justify-center h-7 px-3 rounded-md text-xs font-medium transition-colors ${
                            isExpanded
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {isExpanded ? 'Hide' : 'Details'}
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                          <td colSpan={15} className="bg-muted/30 border-t border-border">
                          <StoneDetails stone={stone} onViewDNA={onViewDNA} onVideoClick={onVideoClick} />
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                  </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    </>
  );
};

export default StonesTable;
