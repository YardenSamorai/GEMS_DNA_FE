import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { Html5Qrcode } from "html5-qrcode";

const ITEMS_PER_PAGE = 50;
const API_BASE = "https://gems-dna-be.vercel.app";

/* ---------------- Tag Colors ---------------- */
const TAG_COLORS = [
  { name: "Emerald", value: "#10b981" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Pink", value: "#ec4899" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
  { name: "Red", value: "#ef4444" },
  { name: "Cyan", value: "#06b6d4" },
];

/* ---------------- Tags Management Modal ---------------- */
const TagsModal = ({ isOpen, onClose, tags, onCreateTag, onDeleteTag, onUpdateTag }) => {
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#10b981");
  const [editingTag, setEditingTag] = useState(null);

  if (!isOpen) return null;

  const handleCreate = () => {
    if (newTagName.trim()) {
      onCreateTag(newTagName.trim(), newTagColor);
      setNewTagName("");
      setNewTagColor("#10b981");
    }
  };

  const handleUpdate = () => {
    if (editingTag && editingTag.name.trim()) {
      onUpdateTag(editingTag.id, editingTag.name, editingTag.color);
      setEditingTag(null);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile drag handle */}
          <div className="sm:hidden flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-stone-300"></div>
          </div>
          
          {/* Header */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-b border-stone-200 bg-gradient-to-r from-blue-500 to-blue-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">Manage Client Tags</h2>
                  <p className="text-blue-100 text-xs">{tags.length} tags</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/20 transition-colors text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Create New Tag */}
          <div className="flex-shrink-0 p-4 border-b border-stone-100 bg-stone-50">
            <p className="text-xs font-medium text-stone-500 mb-3">Create New Tag</p>
            
            <div className="space-y-3">
              {/* Tag Name Input */}
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Enter client name..."
                className="w-full px-4 py-3 text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              
              {/* Color Selection */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-stone-400 mb-2">Choose Color</p>
                <div className="grid grid-cols-8 gap-2">
                  {TAG_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setNewTagColor(c.value)}
                      className={`aspect-square rounded-xl transition-all ${
                        newTagColor === c.value 
                          ? "ring-2 ring-offset-2 ring-blue-500 scale-105 shadow-lg" 
                          : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
              
              {/* Add Button */}
              <button
                onClick={handleCreate}
                disabled={!newTagName.trim()}
                className="w-full py-3 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Tag
              </button>
            </div>
          </div>

          {/* Tags List */}
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-[10px] uppercase tracking-wider text-stone-400 mb-3">Your Tags</p>
            {tags.length === 0 ? (
              <div className="text-center py-8 text-stone-400">
                <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <p>No tags yet</p>
                <p className="text-xs">Create your first client tag above</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white border border-stone-200 hover:border-stone-300 hover:shadow-sm transition-all"
                  >
                    {editingTag?.id === tag.id ? (
                      <div className="flex-1 space-y-3">
                        <input
                          type="text"
                          value={editingTag.name}
                          onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        <div className="grid grid-cols-8 gap-1.5">
                          {TAG_COLORS.map((c) => (
                            <button
                              key={c.value}
                              onClick={() => setEditingTag({ ...editingTag, color: c.value })}
                              className={`aspect-square rounded-lg transition-transform ${editingTag.color === c.value ? "scale-110 ring-2 ring-offset-1 ring-blue-500" : "hover:scale-105"}`}
                              style={{ backgroundColor: c.value }}
                            />
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={handleUpdate} className="flex-1 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600">
                            Save
                          </button>
                          <button onClick={() => setEditingTag(null)} className="flex-1 py-2 bg-stone-200 text-stone-600 rounded-lg text-sm font-medium hover:bg-stone-300">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          className="w-5 h-5 rounded-full flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="flex-1 font-medium text-stone-700">{tag.name}</span>
                        <span className="text-xs text-stone-400 bg-stone-100 px-2 py-1 rounded-full">{tag.stone_count || 0} stones</span>
                        <button
                          onClick={() => setEditingTag({ id: tag.id, name: tag.name, color: tag.color })}
                          className="p-2 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit tag"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => onDeleteTag(tag.id)}
                          className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete tag"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

/* ---------------- Tag Selector (for adding tags to stones) ---------------- */
const TagSelector = ({ stoneSku, currentTags, allTags, onAddTag, onRemoveTag, onManageTags }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) && 
          buttonRef.current && !buttonRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpen = (e) => {
    e.stopPropagation();
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: Math.min(rect.left, window.innerWidth - 200)
      });
    }
    setIsOpen(!isOpen);
  };

  const availableTags = allTags.filter((t) => !currentTags.some((ct) => ct.id === t.id));

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="flex items-center gap-1 px-2 py-1 text-xs bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
        Tag
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            className="fixed w-48 bg-white rounded-xl shadow-2xl border border-stone-200 overflow-hidden"
            style={{ 
              zIndex: 9999,
              top: position.top,
              left: position.left
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Current Tags */}
            {currentTags.length > 0 && (
              <div className="p-2 border-b border-stone-100">
                <p className="text-[10px] uppercase text-stone-400 mb-1.5 px-1">Current</p>
                <div className="flex flex-wrap gap-1">
                  {currentTags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                      <button
                        onClick={() => onRemoveTag(stoneSku, tag.id)}
                        className="hover:bg-white/20 rounded-full p-0.5"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Available Tags */}
            <div className="max-h-40 overflow-y-auto">
              {availableTags.length > 0 ? (
                <div className="p-1">
                  {availableTags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => {
                        onAddTag(stoneSku, tag.id);
                        setIsOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-stone-50 transition-colors text-left"
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                      <span className="text-sm text-stone-700">{tag.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-center text-stone-400 text-xs">
                  {allTags.length === 0 ? "No tags created yet" : "All tags assigned"}
                </div>
              )}
            </div>

            {/* Manage Tags Button */}
            <div className="p-2 border-t border-stone-100">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onManageTags();
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Manage Tags
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ---------------- Export Modal ---------------- */
const ExportModal = ({ isOpen, onClose, selectedStones, onExport }) => {
  const [globalMarkup, setGlobalMarkup] = useState(0);
  const [priceOverrides, setPriceOverrides] = useState({});

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setGlobalMarkup(0);
      setPriceOverrides({});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Calculate adjusted prices (based on Price Per Carat)
  const getAdjustedPricePerCt = (stone) => {
    if (priceOverrides[stone.id] !== undefined) {
      return priceOverrides[stone.id];
    }
    const original = stone.pricePerCt || 0;
    return original * (1 + globalMarkup / 100);
  };

  const getAdjustedTotal = (stone) => {
    const pricePerCt = getAdjustedPricePerCt(stone);
    const weight = stone.weightCt || 0;
    return pricePerCt * weight;
  };

  // Apply global markup to all
  const applyGlobalMarkup = () => {
    const newOverrides = {};
    selectedStones.forEach((stone) => {
      const original = stone.pricePerCt || 0;
      newOverrides[stone.id] = original * (1 + globalMarkup / 100);
    });
    setPriceOverrides(newOverrides);
  };

  // Reset single stone price
  const resetPrice = (stoneId) => {
    setPriceOverrides((prev) => {
      const newOverrides = { ...prev };
      delete newOverrides[stoneId];
      return newOverrides;
    });
  };

  // Reset all prices
  const resetAllPrices = () => {
    setPriceOverrides({});
    setGlobalMarkup(0);
  };

  // Calculate totals
  const totalOriginal = selectedStones.reduce((sum, s) => sum + (s.priceTotal || 0), 0);
  const totalAdjusted = selectedStones.reduce((sum, s) => sum + getAdjustedTotal(s), 0);
  const totalWeight = selectedStones.reduce((sum, s) => sum + (s.weightCt || 0), 0);

  // Handle export with modified prices
  const handleExport = () => {
    const stonesWithAdjustedPrices = selectedStones.map((stone) => ({
      ...stone,
      pricePerCt: getAdjustedPricePerCt(stone),
      priceTotal: getAdjustedTotal(stone),
    }));
    onExport(stonesWithAdjustedPrices);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden fixed sm:relative bottom-0 sm:bottom-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-stone-200 bg-gradient-to-r from-emerald-500 to-emerald-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white">Export Preview</h2>
                  <p className="text-emerald-100 text-xs sm:text-sm">{selectedStones.length} stones selected</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/20 transition-colors text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Global Markup Section */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-stone-50 border-b border-stone-200">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <label className="text-sm font-medium text-stone-700 whitespace-nowrap">Markup:</label>
                <div className="relative flex-1 sm:flex-none">
                  <input
                    type="number"
                    value={globalMarkup}
                    onChange={(e) => setGlobalMarkup(parseFloat(e.target.value) || 0)}
                    className="w-full sm:w-24 px-3 py-2 pr-8 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 text-sm">%</span>
                </div>
                <button
                  onClick={applyGlobalMarkup}
                  className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-emerald-700 bg-emerald-100 rounded-lg hover:bg-emerald-200 transition-colors whitespace-nowrap"
                >
                  Apply
                </button>
                <button
                  onClick={resetAllPrices}
                  className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-stone-600 bg-stone-100 rounded-lg hover:bg-stone-200 transition-colors whitespace-nowrap"
                >
                  Reset
                </button>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 text-xs sm:text-sm w-full sm:w-auto sm:ml-auto">
                <span className="text-stone-500">
                  Original: <span className="font-semibold text-stone-700">${totalOriginal.toLocaleString()}</span>
                </span>
                <span className="text-emerald-600">
                  Adjusted: <span className="font-bold text-emerald-700">${totalAdjusted.toLocaleString()}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Stones Table */}
          <div className="overflow-auto max-h-[50vh] sm:max-h-[45vh]">
            <table className="w-full min-w-[700px]">
              <thead className="bg-stone-100 sticky top-0">
                <tr>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-stone-600 uppercase">SKU</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-stone-600 uppercase hidden sm:table-cell">Shape</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-stone-600 uppercase">Weight</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-semibold text-stone-600 uppercase">Orig $/ct</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-stone-600 uppercase">New $/ct</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-stone-600 uppercase">+/-</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-semibold text-stone-600 uppercase">Total</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-stone-600 uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {selectedStones.map((stone, index) => {
                  const originalPricePerCt = stone.pricePerCt || 0;
                  const adjustedPricePerCt = getAdjustedPricePerCt(stone);
                  const adjustedTotal = getAdjustedTotal(stone);
                  const priceDiff = adjustedPricePerCt - originalPricePerCt;
                  const percentChange = originalPricePerCt > 0 ? ((priceDiff / originalPricePerCt) * 100).toFixed(1) : 0;
                  const isModified = priceOverrides[stone.id] !== undefined || globalMarkup !== 0;

                  return (
                    <tr key={stone.id} className={index % 2 === 0 ? "bg-white" : "bg-stone-50/50"}>
                      <td className="px-2 sm:px-4 py-2 sm:py-3">
                        <span className="font-mono text-xs sm:text-sm font-medium text-emerald-600">{stone.sku}</span>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-stone-700 hidden sm:table-cell">{stone.shape}</td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-stone-700 text-center">{stone.weightCt}ct</td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-stone-500 text-right">
                        ${originalPricePerCt.toLocaleString()}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3">
                        <input
                          type="number"
                          value={Math.round(adjustedPricePerCt)}
                          onChange={(e) => {
                            const newPricePerCt = parseFloat(e.target.value) || 0;
                            setPriceOverrides((prev) => ({ ...prev, [stone.id]: newPricePerCt }));
                          }}
                          className={`w-20 sm:w-28 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-center border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                            isModified ? "border-emerald-400 bg-emerald-50" : "border-stone-300"
                          }`}
                        />
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                        {priceDiff !== 0 && (
                          <span className={`text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full ${
                            priceDiff > 0 
                              ? "text-emerald-700 bg-emerald-100" 
                              : "text-red-700 bg-red-100"
                          }`}>
                            {priceDiff > 0 ? "+" : ""}{percentChange}%
                          </span>
                        )}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-stone-700 text-right font-medium">
                        ${Math.round(adjustedTotal).toLocaleString()}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                        {isModified && (
                          <button
                            onClick={() => resetPrice(stone.id)}
                            className="text-[10px] sm:text-xs text-stone-500 hover:text-stone-700 underline"
                          >
                            ↺
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-stone-200 bg-stone-50">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="text-xs sm:text-sm text-stone-600 text-center sm:text-left space-y-1 sm:space-y-0">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1">
                  <span><span className="font-medium">{selectedStones.length}</span> stones</span>
                  <span><span className="font-medium">{totalWeight.toFixed(2)}</span> ct</span>
                  <span className="text-stone-400">|</span>
                  <span>Orig: <span className="font-medium text-stone-500">${totalOriginal.toLocaleString()}</span></span>
                  <span className={`font-semibold ${totalAdjusted !== totalOriginal ? 'text-emerald-600' : 'text-stone-700'}`}>
                    → Total: ${Math.round(totalAdjusted).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-xl hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="hidden sm:inline">Export Excel</span>
                  <span className="sm:hidden">Export</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

/* ---------------- Barcode Scanner Modal ---------------- */
const BarcodeScanner = ({ isOpen, onClose, onScan }) => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  const startScanner = useCallback(async () => {
    if (!scannerRef.current || html5QrCodeRef.current) return;
    
    try {
      setError(null);
      setScanning(true);
      
      const html5QrCode = new Html5Qrcode("barcode-reader");
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 280, height: 180 },
          aspectRatio: 1.5,
        },
        (decodedText) => {
          // Success - barcode found
          setLastResult(decodedText);
          onScan(decodedText);
          stopScanner();
        },
        () => {
          // Ignore scan errors (no barcode found yet)
        }
      );
    } catch (err) {
      setError(err.message || "Failed to start camera");
      setScanning(false);
    }
  }, [onScan]);

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
    setScanning(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startScanner();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      stopScanner();
    }
  }, [isOpen, startScanner, stopScanner]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={() => {
          stopScanner();
          onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-stone-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-stone-700 bg-gradient-to-r from-emerald-600 to-emerald-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Scan Barcode</h2>
                  <p className="text-emerald-100 text-xs">Point camera at barcode or QR code</p>
                </div>
              </div>
              <button
                onClick={() => {
                  stopScanner();
                  onClose();
                }}
                className="p-2 rounded-lg hover:bg-white/20 transition-colors text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Scanner Area */}
          <div className="p-4">
            <div className="relative rounded-xl overflow-hidden bg-black">
              <div 
                id="barcode-reader" 
                ref={scannerRef}
                className="w-full aspect-[4/3]"
              />
              
              {/* Scanning overlay */}
              {scanning && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-64 h-40 border-2 border-emerald-400 rounded-lg relative">
                      <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg"></div>
                      <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg"></div>
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg"></div>
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg"></div>
                      {/* Scanning line animation */}
                      <motion.div
                        className="absolute left-2 right-2 h-0.5 bg-emerald-400"
                        animate={{ top: ["10%", "90%", "10%"] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="mt-4 text-center">
              {error ? (
                <div className="text-red-400 text-sm bg-red-900/30 rounded-lg p-3">
                  <p className="font-medium">Camera Error</p>
                  <p className="text-xs mt-1">{error}</p>
                </div>
              ) : scanning ? (
                <p className="text-emerald-400 text-sm flex items-center justify-center gap-2">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                  Scanning... Point at barcode
                </p>
              ) : (
                <p className="text-stone-400 text-sm">Initializing camera...</p>
              )}
            </div>

            {/* Last Result */}
            {lastResult && (
              <div className="mt-4 p-3 bg-emerald-900/30 rounded-lg border border-emerald-700">
                <p className="text-xs text-emerald-300">Last scanned:</p>
                <p className="text-sm font-mono text-emerald-400 font-semibold">{lastResult}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-stone-700 bg-stone-800/50">
            <div className="flex items-center justify-between text-xs text-stone-400">
              <span>Supports: Code128, QR Code</span>
              <button
                onClick={() => {
                  stopScanner();
                  onClose();
                }}
                className="px-4 py-2 bg-stone-700 hover:bg-stone-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const treatmentOptions = [
  "All treatments",
  "No Oil",
  "Insignificant",
  "Minor",
  "Moderate",
  "Significant",
];

/* ---------------- Progress Bar ---------------- */
const LoadingBar = ({ active, progress }) => {
  if (!active) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-primary-100">
      <motion.div
        className="h-full bg-gradient-to-r from-primary-400 to-primary-600"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.3 }}
      />
    </div>
  );
};

/* ---------------- Filters ---------------- */
const StoneFilters = ({ filters, onChange, shapesOptions, categoriesOptions, tags, onManageTags }) => {
  const handleChange = (field) => (e) => {
    onChange({ ...filters, [field]: e.target.value });
  };

  const handleClear = () => {
    onChange({
      sku: "",
      minPrice: "",
      maxPrice: "",
      minCarat: "",
      maxCarat: "",
      minLength: "",
      maxLength: "",
      minWidth: "",
      maxWidth: "",
      shape: "All shapes",
      treatment: "All treatments",
      category: "All categories",
      tag: "All tags",
    });
  };

  const activeFiltersCount = [
    filters.sku,
    filters.minPrice,
    filters.maxPrice,
    filters.minCarat,
    filters.maxCarat,
    filters.minLength,
    filters.maxLength,
    filters.minWidth,
    filters.maxWidth,
    !filters.shape.includes("All") && filters.shape,
    !filters.treatment.includes("All") && filters.treatment,
    !filters.category.includes("All") && filters.category,
    !filters.tag.includes("All") && filters.tag,
  ].filter(Boolean).length;

  return (
    <div className="glass rounded-2xl shadow-lg border border-white/50 p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-stone-800">Filters</h2>
            {activeFiltersCount > 0 && (
              <p className="text-xs text-stone-500">{activeFiltersCount} active filter{activeFiltersCount > 1 ? 's' : ''}</p>
            )}
          </div>
        </div>
        <button
          onClick={handleClear}
          className="text-sm font-medium text-primary-600 hover:text-primary-700 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
        >
          Clear all
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* SKU Search */}
        <div className="sm:col-span-2 lg:col-span-1">
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Search by SKU</label>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={filters.sku}
              onChange={handleChange("sku")}
              placeholder="e.g. T9548"
              className="input-modern pl-10"
            />
          </div>
        </div>

        {/* Price Range */}
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Min Price ($)</label>
          <input
            type="number"
            value={filters.minPrice}
            onChange={handleChange("minPrice")}
            placeholder="From"
            className="input-modern"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Max Price ($)</label>
          <input
            type="number"
            value={filters.maxPrice}
            onChange={handleChange("maxPrice")}
            placeholder="To"
            className="input-modern"
          />
        </div>

        {/* Shape */}
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Shape</label>
          <select
            value={filters.shape}
            onChange={handleChange("shape")}
            className="input-modern"
          >
            {shapesOptions.map((shape) => (
              <option key={shape} value={shape}>{shape}</option>
            ))}
          </select>
        </div>

        {/* Carat Range */}
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Min Carat (ct)</label>
          <input
            type="number"
            value={filters.minCarat}
            onChange={handleChange("minCarat")}
            placeholder="From"
            step="0.01"
            className="input-modern"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Max Carat (ct)</label>
          <input
            type="number"
            value={filters.maxCarat}
            onChange={handleChange("maxCarat")}
            placeholder="To"
            step="0.01"
            className="input-modern"
          />
        </div>

        {/* Measurements - Length & Width */}
        <div className="sm:col-span-2 lg:col-span-4 p-4 rounded-xl bg-stone-50/50 border border-stone-200/50">
          <label className="block text-xs font-semibold text-stone-600 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            Measurements (mm)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-stone-400 mb-1">Length Min</label>
              <input
                type="number"
                value={filters.minLength}
                onChange={handleChange("minLength")}
                placeholder="From"
                step="0.01"
                className="input-modern text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-stone-400 mb-1">Length Max</label>
              <input
                type="number"
                value={filters.maxLength}
                onChange={handleChange("maxLength")}
                placeholder="To"
                step="0.01"
                className="input-modern text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-stone-400 mb-1">Width Min</label>
              <input
                type="number"
                value={filters.minWidth}
                onChange={handleChange("minWidth")}
                placeholder="From"
                step="0.01"
                className="input-modern text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-stone-400 mb-1">Width Max</label>
              <input
                type="number"
                value={filters.maxWidth}
                onChange={handleChange("maxWidth")}
                placeholder="To"
                step="0.01"
                className="input-modern text-sm"
              />
            </div>
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Category</label>
          <select
            value={filters.category}
            onChange={handleChange("category")}
            className="input-modern"
          >
            {categoriesOptions.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Treatment */}
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5">Treatment</label>
          <select
            value={filters.treatment}
            onChange={handleChange("treatment")}
            className="input-modern"
          >
            {treatmentOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Client Tag */}
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1.5 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Client Tag
          </label>
          <div className="flex gap-2">
            <select
              value={filters.tag}
              onChange={handleChange("tag")}
              className="input-modern flex-1"
            >
              <option value="All tags">All tags</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.name}>{tag.name}</option>
              ))}
            </select>
            <button
              onClick={onManageTags}
              className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition-colors"
              title="Manage tags"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------------- Stone Card (Grid) ---------------- */
const StoneCard = ({ stone, onToggle, isExpanded, isSelected, onToggleSelection, stoneTags, allTags, onAddTag, onRemoveTag, onManageTags }) => (
  <motion.div
    layout
    onClick={(e) => {
      // Don't toggle if clicking on button, checkbox, or link
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'A' || e.target.closest('button') || e.target.closest('a')) return;
      onToggleSelection(stone.id);
    }}
    className={`rounded-2xl border-2 overflow-hidden shadow-md cursor-pointer transition-all duration-200 ${
      isSelected 
        ? 'border-emerald-500 bg-emerald-100 shadow-emerald-200 shadow-lg' 
        : 'border-stone-200 bg-white hover:border-stone-300'
    }`}
  >
    <div className="p-4">
      <div className="flex gap-4">
        {/* Checkbox */}
        <div className="flex items-start pt-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelection(stone.id)}
            className="w-4 h-4 text-primary-600 rounded border-stone-300 focus:ring-primary-500 cursor-pointer"
          />
        </div>
        {/* Image */}
        <div className="w-20 h-20 rounded-xl overflow-hidden bg-stone-100 flex-shrink-0">
          {stone.imageUrl ? (
            <img src={stone.imageUrl} alt={stone.sku} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-stone-300">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-xs font-mono text-primary-600 bg-primary-50 px-2 py-0.5 rounded-md">{stone.sku}</span>
              <h3 className="font-semibold text-stone-800 mt-1">{stone.shape}</h3>
            </div>
            <span className="text-lg font-bold text-stone-800">
              {stone.weightCt} ct
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3 text-sm text-stone-500">
            <span>${stone.priceTotal?.toLocaleString() || '-'}</span>
            <span>•</span>
            <span>{stone.treatment || 'N/A'}</span>
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
          <StoneDetails stone={stone} />
        </motion.div>
      )}
    </AnimatePresence>
  </motion.div>
);

/* ---------------- Stone Details Panel ---------------- */
const StoneDetails = ({ stone }) => {
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
        <DetailItem label="Shape" value={stone.shape} />
        <DetailItem label="Weight" value={`${stone.weightCt} ct`} />
        <DetailItem label="Measurements" value={stone.measurements} />
        <DetailItem label="Color" value={stone.color} />
        <DetailItem label="Clarity" value={stone.clarity} />
        <DetailItem label="Treatment" value={stone.treatment} />
        <DetailItem label="Lab" value={stone.lab} />
        <DetailItem label="Origin" value={stone.origin} />
        <DetailItem label="Ratio" value={stone.ratio} />
        <DetailItem label="Luster" value={stone.luster} />
        <DetailItem label="Fluorescence" value={stone.fluorescence} />
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
          <a href={stone.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-100 text-accent-700 text-xs font-medium hover:bg-accent-200 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Video
          </a>
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
        <Link
          to={`/${stone.sku}`}
          target="_blank"
          className="btn-primary text-xs py-2 px-4 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          View DNA
        </Link>
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
      </div>
    </div>
  );
};

const DetailItem = ({ label, value }) => (
  <div className="p-2 rounded-lg bg-white">
    <span className="text-[10px] uppercase tracking-wider text-stone-400">{label}</span>
    <p className="text-sm font-medium text-stone-800 truncate">{value || 'N/A'}</p>
  </div>
);

/* ---------------- Table (Desktop) ---------------- */
const StonesTable = ({ stones, onToggle, selectedStone, loading, error, sortConfig, onSort, selectedStones, onToggleSelection, onToggleSelectAll, allSelected, stoneTags, allTags, onAddTag, onRemoveTag, onManageTags }) => {
  if (loading) {
    return (
      <div className="glass rounded-2xl border border-white/50 p-8 sm:p-12">
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
      <div className="glass rounded-2xl border border-red-200 bg-red-50 p-6 sm:p-8 text-center">
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
      <div className="glass rounded-2xl border border-white/50 p-8 sm:p-12 text-center">
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
      className="flex items-center gap-1 hover:text-primary-600 transition-colors"
    >
      {children}
      {sortConfig?.field === field && (
        <span className="text-primary-500">
          {sortConfig.direction === "asc" ? "↑" : "↓"}
        </span>
      )}
    </button>
  );

  // Mobile Card Component
  const MobileStoneCard = ({ stone, index }) => {
    const isSelected = selectedStones?.has(stone.id);
    const isExpanded = selectedStone?.id === stone.id;

  return (
      <motion.div
        layout
        initial={false}
        animate={{ opacity: 1 }}
        className={`rounded-2xl border overflow-hidden shadow-sm transition-colors duration-200 ${
          isSelected 
            ? 'border-emerald-400 bg-emerald-50 shadow-emerald-100 ring-2 ring-emerald-200' 
            : 'border-stone-200 bg-white'
        }`}
      >
        {/* Main Card Content */}
        <div 
          className="p-4"
          onClick={() => onToggleSelection(stone.id)}
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

            {/* Image */}
            <div className="flex-shrink-0">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-stone-100 border border-stone-200">
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
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="inline-block font-mono text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-md">
                    {stone.sku}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-medium text-stone-800">{stone.shape}</span>
                    <span className="text-stone-300">•</span>
                    <span className="text-sm font-bold text-stone-900">{stone.weightCt} ct</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-stone-900">
                    ${stone.priceTotal?.toLocaleString() || '-'}
                  </p>
                  <p className="text-xs text-stone-500">
                    ${stone.pricePerCt?.toLocaleString() || '-'}/ct
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
          <Link
            to={`/${stone.sku}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-primary-600 hover:bg-primary-50 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            DNA
          </Link>
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
              <StoneDetails stone={stone} />
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

      {/* Desktop Table View */}
      <div className="hidden md:block glass rounded-2xl border border-white/50 overflow-hidden shadow-lg">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50/50">
                <th className="px-4 py-4 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected && stones.length > 0}
                    onChange={onToggleSelectAll}
                    className="w-4 h-4 text-primary-600 rounded border-stone-300 focus:ring-primary-500 cursor-pointer"
                  />
                </th>
              <th className="px-4 py-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                <SortButton field="sku">SKU</SortButton>
              </th>
              <th className="px-4 py-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">Image</th>
              <th className="px-4 py-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                <SortButton field="shape">Shape</SortButton>
              </th>
              <th className="px-4 py-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                <SortButton field="weightCt">Weight</SortButton>
              </th>
              <th className="px-4 py-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider hidden lg:table-cell">
                <SortButton field="measurements">Measurements</SortButton>
              </th>
              <th className="px-4 py-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                <SortButton field="pricePerCt">Price/ct</SortButton>
              </th>
              <th className="px-4 py-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                <SortButton field="priceTotal">Total</SortButton>
              </th>
              <th className="px-4 py-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider hidden xl:table-cell">
                <SortButton field="treatment">Treatment</SortButton>
              </th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    Tags
                  </span>
                </th>
              <th className="px-4 py-4 text-right text-xs font-semibold text-stone-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {stones.map((stone, index) => {
              const isExpanded = selectedStone?.id === stone.id;
              return (
                  <React.Fragment key={stone.id}>
                  <motion.tr
                      initial={false}
                    animate={{ opacity: 1, y: 0 }}
                      onClick={(e) => {
                        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.closest('button')) return;
                        onToggleSelection(stone.id);
                      }}
                      className={`transition-colors cursor-pointer ${
                        selectedStones?.has(stone.id) 
                          ? 'bg-emerald-50 border-l-4 border-l-emerald-500 hover:bg-emerald-100/70' 
                          : isExpanded 
                            ? 'bg-primary-50/30 hover:bg-stone-50/50' 
                            : 'hover:bg-stone-50/50'
                      }`}
                    >
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedStones?.has(stone.id) || false}
                          onChange={() => onToggleSelection(stone.id)}
                          className="w-4 h-4 text-primary-600 rounded border-stone-300 focus:ring-primary-500 cursor-pointer"
                        />
                      </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-medium text-primary-600">{stone.sku}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-100 border border-stone-200">
                        {stone.imageUrl ? (
                          <img src={stone.imageUrl} alt={stone.sku} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-300 text-xs">N/A</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-stone-700">{stone.shape}</td>
                    <td className="px-4 py-3 text-sm font-medium text-stone-800">{stone.weightCt} ct</td>
                    <td className="px-4 py-3 text-sm text-stone-600 hidden lg:table-cell">{stone.measurements}</td>
                    <td className="px-4 py-3 text-sm text-stone-700">
                      ${stone.pricePerCt?.toLocaleString() || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-stone-800">
                      ${stone.priceTotal?.toLocaleString() || '-'}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span className="badge badge-neutral">{stone.treatment || 'N/A'}</span>
                    </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1">
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
                      </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onToggle(stone)}
                        className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                          isExpanded
                            ? 'bg-primary-500 text-white'
                            : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                        }`}
                      >
                        {isExpanded ? 'Hide' : 'Details'}
                      </button>
                    </td>
                  </motion.tr>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                          <td colSpan={10} className="bg-stone-50 border-t border-stone-200">
                          <StoneDetails stone={stone} />
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

/* ---------------- Email Helpers ---------------- */
const createEmailText = (stone) => `Stone Details

SKU: ${stone.sku}
Shape: ${stone.shape}
Weight: ${stone.weightCt} ct
Measurements: ${stone.measurements || 'N/A'}
Clarity: ${stone.clarity || 'N/A'}
Treatment: ${stone.treatment || 'N/A'}
Lab: ${stone.lab || 'N/A'}
Origin: ${stone.origin || 'N/A'}

Photo: ${stone.imageUrl || 'N/A'}
Video: ${stone.videoUrl || 'N/A'}
Certificate: ${stone.certificateUrl || 'N/A'}

Best regards,
Gemstar`;

const createEmailHtml = (stone) => `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background: #f5f5f4; padding: 20px;">
<div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e7e5e4;">
<div style="background: linear-gradient(135deg, #10b981, #059669); padding: 24px; text-align: center;">
<h1 style="color: white; margin: 0; font-size: 24px;">Stone Details</h1>
</div>
<div style="padding: 24px;">
${stone.imageUrl ? `<img src="${stone.imageUrl}" style="width: 200px; height: 200px; object-fit: cover; border-radius: 8px; display: block; margin: 0 auto 20px;" />` : ''}
<table style="width: 100%; border-collapse: collapse;">
<tr><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;"><strong>SKU:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;">${stone.sku}</td></tr>
<tr><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;"><strong>Shape:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;">${stone.shape}</td></tr>
<tr><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;"><strong>Weight:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;">${stone.weightCt} ct</td></tr>
<tr><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;"><strong>Measurements:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;">${stone.measurements || 'N/A'}</td></tr>
<tr><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;"><strong>Treatment:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;">${stone.treatment || 'N/A'}</td></tr>
<tr><td style="padding: 8px 0;"><strong>Origin:</strong></td><td style="padding: 8px 0;">${stone.origin || 'N/A'}</td></tr>
</table>
<div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e7e5e4; text-align: center;">
${stone.videoUrl ? `<a href="${stone.videoUrl}" style="color: #10b981; margin-right: 16px;">View Video</a>` : ''}
${stone.certificateUrl ? `<a href="${stone.certificateUrl}" style="color: #10b981;">View Certificate</a>` : ''}
</div>
</div>
<div style="background: #f5f5f4; padding: 16px; text-align: center; font-size: 12px; color: #78716c;">
Best regards, Gemstar
</div>
</div>
</body>
</html>`;

/* ---------------- Main Page ---------------- */
const StoneSearchPage = () => {
  const [filters, setFilters] = useState({
    sku: "",
    minPrice: "",
    maxPrice: "",
    minCarat: "",
    maxCarat: "",
    minLength: "",
    maxLength: "",
    minWidth: "",
    maxWidth: "",
    shape: "All shapes",
    treatment: "All treatments",
    category: "All categories",
    tag: "All tags",
  });

  const [stones, setStones] = useState([]);
  const [selectedStone, setSelectedStone] = useState(null);
  const [selectedStones, setSelectedStones] = useState(new Set());
  const [showExportModal, setShowExportModal] = useState(false);
  const [showFloatingExport, setShowFloatingExport] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const exportButtonRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [initialLoading, setInitialLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [sortConfig, setSortConfig] = useState({ field: "sku", direction: "asc" });
  const [viewMode, setViewMode] = useState("table");

  // Tags state
  const [tags, setTags] = useState([]);
  const [stoneTags, setStoneTags] = useState({}); // { sku: [tag1, tag2, ...] }
  const [showTagsModal, setShowTagsModal] = useState(false);

  // Fetch tags on mount
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const [tagsRes, stoneTagsRes] = await Promise.all([
          fetch(`${API_BASE}/api/tags`),
          fetch(`${API_BASE}/api/stone-tags`)
        ]);
        const tagsData = await tagsRes.json();
        const stoneTagsData = await stoneTagsRes.json();
        setTags(tagsData);
        setStoneTags(stoneTagsData);
      } catch (err) {
        console.error("Error fetching tags:", err);
      }
    };
    fetchTags();
  }, []);

  // Tag management functions
  const createTag = async (name, color) => {
    try {
      const res = await fetch(`${API_BASE}/api/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      });
      if (res.ok) {
        const newTag = await res.json();
        setTags((prev) => [...prev, { ...newTag, stone_count: 0 }]);
      }
    } catch (err) {
      console.error("Error creating tag:", err);
    }
  };

  const updateTag = async (id, name, color) => {
    try {
      const res = await fetch(`${API_BASE}/api/tags/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTags((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
        // Update stoneTags as well
        setStoneTags((prev) => {
          const newStoneTags = { ...prev };
          Object.keys(newStoneTags).forEach((sku) => {
            newStoneTags[sku] = newStoneTags[sku].map((t) =>
              t.id === id ? { ...t, name: updated.name, color: updated.color } : t
            );
          });
          return newStoneTags;
        });
      }
    } catch (err) {
      console.error("Error updating tag:", err);
    }
  };

  const deleteTag = async (id) => {
    if (!window.confirm("Are you sure you want to delete this tag?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/tags/${id}`, { method: "DELETE" });
      if (res.ok) {
        setTags((prev) => prev.filter((t) => t.id !== id));
        // Remove from stoneTags
        setStoneTags((prev) => {
          const newStoneTags = { ...prev };
          Object.keys(newStoneTags).forEach((sku) => {
            newStoneTags[sku] = newStoneTags[sku].filter((t) => t.id !== id);
          });
          return newStoneTags;
        });
      }
    } catch (err) {
      console.error("Error deleting tag:", err);
    }
  };

  const addTagToStone = async (sku, tagId) => {
    try {
      const res = await fetch(`${API_BASE}/api/stones/${sku}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId }),
      });
      if (res.ok) {
        const tag = await res.json();
        setStoneTags((prev) => ({
          ...prev,
          [sku]: [...(prev[sku] || []), tag],
        }));
        // Update tag count
        setTags((prev) =>
          prev.map((t) => (t.id === tagId ? { ...t, stone_count: (parseInt(t.stone_count) || 0) + 1 } : t))
        );
      }
    } catch (err) {
      console.error("Error adding tag to stone:", err);
    }
  };

  const removeTagFromStone = async (sku, tagId) => {
    try {
      const res = await fetch(`${API_BASE}/api/stones/${sku}/tags/${tagId}`, { method: "DELETE" });
      if (res.ok) {
        setStoneTags((prev) => ({
          ...prev,
          [sku]: (prev[sku] || []).filter((t) => t.id !== tagId),
        }));
        // Update tag count
        setTags((prev) =>
          prev.map((t) => (t.id === tagId ? { ...t, stone_count: Math.max(0, (parseInt(t.stone_count) || 0) - 1) } : t))
        );
      }
    } catch (err) {
      console.error("Error removing tag from stone:", err);
    }
  };

  // Toggle single stone selection (preserve scroll position)
  const toggleStoneSelection = (stoneId) => {
    const scrollY = window.scrollY;
    setSelectedStones((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(stoneId)) {
        newSet.delete(stoneId);
      } else {
        newSet.add(stoneId);
      }
      return newSet;
    });
    // Restore scroll position after React re-renders
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
    });
  };

  // Select/Deselect all visible stones (preserve scroll position)
  const toggleSelectAll = () => {
    const scrollY = window.scrollY;
    const visibleIds = paginatedStones.map((s) => s.id);
    const allSelected = visibleIds.every((id) => selectedStones.has(id));
    
    setSelectedStones((prev) => {
      const newSet = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => newSet.delete(id));
      } else {
        visibleIds.forEach((id) => newSet.add(id));
      }
      return newSet;
    });
    // Restore scroll position after React re-renders
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
    });
  };

  // Clear all selections
  const clearSelection = () => {
    setSelectedStones(new Set());
  };

  // Handle barcode scan result
  const handleBarcodeScan = (scannedText) => {
    setScanResult(scannedText);
    setShowScanner(false);
    
    // Try to find the stone by SKU (exact match or partial)
    const foundStone = stones.find((s) => {
      const sku = s.sku?.toUpperCase() || "";
      const scanned = scannedText.toUpperCase();
      return sku === scanned || sku.includes(scanned) || scanned.includes(sku);
    });

    if (foundStone) {
      // Add to selection
      setSelectedStones((prev) => {
        const newSet = new Set(prev);
        newSet.add(foundStone.id);
        return newSet;
      });
      // Show success feedback
      setTimeout(() => setScanResult(null), 3000);
    } else {
      // Show not found message
      alert(`Stone not found: ${scannedText}\n\nTry scanning another barcode or search manually.`);
      setScanResult(null);
    }
  };

  // USB Barcode Scanner Listener (global keyboard listener)
  useEffect(() => {
    let buffer = "";
    let lastKeyTime = 0;
    const SCAN_THRESHOLD = 50; // Max ms between keystrokes for scanner input
    const MIN_LENGTH = 3; // Minimum barcode length

    const handleKeyDown = (e) => {
      // Ignore if user is typing in an input field
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) {
        return;
      }

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime;

      // If Enter key and we have buffer content
      if (e.key === "Enter" && buffer.length >= MIN_LENGTH) {
        e.preventDefault();
        const scannedBarcode = buffer.trim();
        buffer = "";
        
        // Process the scanned barcode
        if (scannedBarcode) {
          console.log("🔫 USB Scanner detected:", scannedBarcode);
          handleBarcodeScan(scannedBarcode);
        }
        return;
      }

      // If too much time passed, reset buffer (user is typing manually)
      if (timeDiff > SCAN_THRESHOLD && buffer.length > 0) {
        buffer = "";
      }

      // Add character to buffer (only printable characters)
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        buffer += e.key;
        lastKeyTime = currentTime;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [stones]); // Re-create when stones change so handleBarcodeScan has access to latest stones

  // Export selected stones to Excel with styling
  const exportToExcel = async (customStones = null) => {
    const selectedData = customStones || stones.filter((s) => selectedStones.has(s.id));
    
    if (selectedData.length === 0) {
      alert("Please select at least one stone to export.");
      return;
    }

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Gemstar";
    workbook.created = new Date();
    
    const worksheet = workbook.addWorksheet("Selected Stones");

    // Define columns with widths (added # column for numbering)
    worksheet.columns = [
      { key: "num", width: 5 },
      { key: "sku", width: 18 },
      { key: "shape", width: 12 },
      { key: "weight", width: 14 },
      { key: "measurements", width: 22 },
      { key: "color", width: 10 },
      { key: "clarity", width: 10 },
      { key: "treatment", width: 15 },
      { key: "origin", width: 12 },
      { key: "lab", width: 10 },
      { key: "pricePerCt", width: 14 },
      { key: "priceTotal", width: 14 },
      { key: "dna", width: 15 },
      { key: "certificate", width: 20 },
      { key: "image", width: 20 },
      { key: "video", width: 20 },
    ];

    // Create styled text header
    // Row 1: Company Name
    worksheet.mergeCells("A1:P1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "◆  G E M S T A R  ◆";
    titleCell.font = { bold: true, size: 22, color: { argb: "FF10B981" }, name: "Arial" };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    worksheet.getRow(1).height = 35;

    // Row 2: Tagline
    worksheet.mergeCells("A2:P2");
    const taglineCell = worksheet.getCell("A2");
    taglineCell.value = "Premium Gemstones & Diamonds";
    taglineCell.font = { size: 12, color: { argb: "FFD1D5DB" }, name: "Arial", italic: true };
    taglineCell.alignment = { vertical: "middle", horizontal: "center" };
    taglineCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    worksheet.getRow(2).height = 22;

    // Row 3: Locations
    worksheet.mergeCells("A3:P3");
    const locationsCell = worksheet.getCell("A3");
    locationsCell.value = "NYC  ·  LOS ANGELES  ·  TEL AVIV  ·  HONG KONG";
    locationsCell.font = { size: 10, color: { argb: "FF9CA3AF" }, name: "Arial" };
    locationsCell.alignment = { vertical: "middle", horizontal: "center" };
    locationsCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    worksheet.getRow(3).height = 20;

    // Calculate totals
    const totalPrice = selectedData.reduce((sum, s) => sum + (s.priceTotal || 0), 0);
    const totalWeight = selectedData.reduce((sum, s) => sum + (s.weightCt || 0), 0);
    const now = new Date();
    const date = now.toLocaleDateString("en-GB");
    const time = now.toLocaleTimeString("en-GB");

    // Row 4: Spacer
    worksheet.mergeCells("A4:P4");
    worksheet.getRow(4).height = 10;

    // ═══════════════════════════════════════════════════════════════
    // INFO TABLES (Row 5-7)
    // ═══════════════════════════════════════════════════════════════
    
    const tableBorder = {
      top: { style: "thin", color: { argb: "FF10B981" } },
      bottom: { style: "thin", color: { argb: "FF10B981" } },
      left: { style: "thin", color: { argb: "FF10B981" } },
      right: { style: "thin", color: { argb: "FF10B981" } },
    };
    const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF10B981" } };
    const lightFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F7F1" } };

    // === LEFT TABLE: Date/Time/Website ===
    
    // Row 5: Date
    worksheet.getCell("A5").value = "Date";
    worksheet.getCell("A5").font = { bold: true, size: 10, color: { argb: "FF10B981" } };
    worksheet.getCell("A5").fill = lightFill;
    worksheet.getCell("A5").border = tableBorder;
    worksheet.getCell("A5").alignment = { vertical: "middle", horizontal: "center" };
    
    worksheet.mergeCells("B5:C5");
    worksheet.getCell("B5").value = date;
    worksheet.getCell("B5").font = { size: 10, color: { argb: "FF1F2937" } };
    worksheet.getCell("B5").border = tableBorder;
    worksheet.getCell("B5").alignment = { vertical: "middle", horizontal: "center" };

    // Row 6: Time
    worksheet.getCell("A6").value = "Time";
    worksheet.getCell("A6").font = { bold: true, size: 10, color: { argb: "FF10B981" } };
    worksheet.getCell("A6").fill = lightFill;
    worksheet.getCell("A6").border = tableBorder;
    worksheet.getCell("A6").alignment = { vertical: "middle", horizontal: "center" };
    
    worksheet.mergeCells("B6:C6");
    worksheet.getCell("B6").value = time;
    worksheet.getCell("B6").font = { size: 10, color: { argb: "FF1F2937" } };
    worksheet.getCell("B6").border = tableBorder;
    worksheet.getCell("B6").alignment = { vertical: "middle", horizontal: "center" };

    // Row 7: Website Link
    worksheet.mergeCells("A7:C7");
    worksheet.getCell("A7").value = { text: "🌐 www.gems.net", hyperlink: "https://www.gems.net" };
    worksheet.getCell("A7").font = { bold: true, size: 10, color: { argb: "FF10B981" }, underline: true };
    worksheet.getCell("A7").fill = lightFill;
    worksheet.getCell("A7").border = tableBorder;
    worksheet.getCell("A7").alignment = { vertical: "middle", horizontal: "center" };

    // === RIGHT TABLE: Cts/Pcs Summary ===
    
    // Row 5: Headers
    worksheet.getCell("E5").value = "";
    worksheet.getCell("E5").fill = headerFill;
    worksheet.getCell("E5").border = tableBorder;
    
    worksheet.getCell("F5").value = "Cts";
    worksheet.getCell("F5").font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    worksheet.getCell("F5").fill = headerFill;
    worksheet.getCell("F5").border = tableBorder;
    worksheet.getCell("F5").alignment = { vertical: "middle", horizontal: "center" };
    
    worksheet.getCell("G5").value = "Pcs";
    worksheet.getCell("G5").font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    worksheet.getCell("G5").fill = headerFill;
    worksheet.getCell("G5").border = tableBorder;
    worksheet.getCell("G5").alignment = { vertical: "middle", horizontal: "center" };

    // Row 6: Total
    worksheet.getCell("E6").value = "Total";
    worksheet.getCell("E6").font = { bold: true, size: 10, color: { argb: "FF1F2937" } };
    worksheet.getCell("E6").border = tableBorder;
    worksheet.getCell("E6").alignment = { vertical: "middle", horizontal: "center" };
    
    worksheet.getCell("F6").value = totalWeight.toFixed(2);
    worksheet.getCell("F6").font = { size: 10, color: { argb: "FF1F2937" } };
    worksheet.getCell("F6").border = tableBorder;
    worksheet.getCell("F6").alignment = { vertical: "middle", horizontal: "center" };
    
    worksheet.getCell("G6").value = selectedData.length;
    worksheet.getCell("G6").font = { size: 10, color: { argb: "FF1F2937" } };
    worksheet.getCell("G6").border = tableBorder;
    worksheet.getCell("G6").alignment = { vertical: "middle", horizontal: "center" };

    // Row 7: Selected (same as total in this case)
    worksheet.getCell("E7").value = "SELECTED";
    worksheet.getCell("E7").font = { bold: true, size: 10, color: { argb: "FF10B981" } };
    worksheet.getCell("E7").fill = lightFill;
    worksheet.getCell("E7").border = tableBorder;
    worksheet.getCell("E7").alignment = { vertical: "middle", horizontal: "center" };
    
    worksheet.getCell("F7").value = totalWeight.toFixed(2);
    worksheet.getCell("F7").font = { bold: true, size: 10, color: { argb: "FF10B981" } };
    worksheet.getCell("F7").fill = lightFill;
    worksheet.getCell("F7").border = tableBorder;
    worksheet.getCell("F7").alignment = { vertical: "middle", horizontal: "center" };
    
    worksheet.getCell("G7").value = selectedData.length;
    worksheet.getCell("G7").font = { bold: true, size: 10, color: { argb: "FF10B981" } };
    worksheet.getCell("G7").fill = lightFill;
    worksheet.getCell("G7").border = tableBorder;
    worksheet.getCell("G7").alignment = { vertical: "middle", horizontal: "center" };

    // Set row heights
    worksheet.getRow(5).height = 22;
    worksheet.getRow(6).height = 22;
    worksheet.getRow(7).height = 22;

    // Row 8: Spacer before main table
    worksheet.mergeCells("A8:P8");
    worksheet.getRow(8).height = 10;

    // Add header row (row 9)
    const headers = ["#", "SKU", "Shape", "Weight (ct)", "Measurements", "Color", "Clarity", "Treatment", "Origin", "Lab", "Price/ct ($)", "Total ($)", "DNA", "Certificate", "Image", "Video"];
    const headerRow = worksheet.getRow(9);
    headers.forEach((header, index) => {
      headerRow.getCell(index + 1).value = header;
    });
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF10B981" }, // Emerald green
      };
      cell.font = {
        bold: true,
        color: { argb: "FFFFFFFF" },
        size: 11,
        name: "Arial",
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FF059669" } },
        bottom: { style: "thin", color: { argb: "FF059669" } },
        left: { style: "thin", color: { argb: "FF059669" } },
        right: { style: "thin", color: { argb: "FF059669" } },
      };
    });

    // DNA base URL (use production URL)
    const dnaBaseUrl = "https://gems-dna.com";

    // Add data rows
    selectedData.forEach((stone, index) => {
      const row = worksheet.addRow({
        num: index + 1,
        sku: stone.sku || "",
        shape: stone.shape || "",
        weight: stone.weightCt || "",
        measurements: stone.measurements || "",
        color: stone.color || "",
        clarity: stone.clarity || "",
        treatment: stone.treatment || "",
        origin: stone.origin || "",
        lab: stone.lab || "",
        pricePerCt: stone.pricePerCt || "",
        priceTotal: stone.priceTotal || "",
        dna: stone.sku || "",
        certificate: stone.certificateUrl || "",
        image: stone.imageUrl || "",
        video: stone.videoUrl || "",
      });
      
      // Style the number cell
      const numCell = row.getCell("num");
      numCell.font = { size: 9, color: { argb: "FF6B7280" }, name: "Arial" };
      numCell.alignment = { vertical: "middle", horizontal: "center" };

      // Zebra striping (alternating row colors)
      const isEvenRow = index % 2 === 0;
      row.eachCell((cell, colNumber) => {
        // Background color
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: isEvenRow ? "FFF9FAFB" : "FFFFFFFF" },
        };
        
        // Border
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } },
        };

        // Alignment (first 10 columns centered, rest left-aligned)
        cell.alignment = {
          vertical: "middle",
          horizontal: colNumber <= 10 ? "center" : "left",
        };

        // Font
        cell.font = {
          size: 10,
          name: "Arial",
          color: { argb: "FF1F2937" },
        };
      });

      // Format price columns as currency
      const pricePerCtCell = row.getCell("pricePerCt");
      const priceTotalCell = row.getCell("priceTotal");
      if (stone.pricePerCt) {
        pricePerCtCell.numFmt = '"$"#,##0.00';
      }
      if (stone.priceTotal) {
        priceTotalCell.numFmt = '"$"#,##0.00';
        priceTotalCell.font = { ...priceTotalCell.font, bold: true };
      }

      // Make URLs clickable
      // DNA Link
      if (stone.sku) {
        const dnaUrl = `${dnaBaseUrl}/${stone.sku}`;
        row.getCell("dna").value = { text: "View DNA", hyperlink: dnaUrl };
        row.getCell("dna").font = { color: { argb: "FF8B5CF6" }, underline: true, size: 10, bold: true };
        row.getCell("dna").alignment = { vertical: "middle", horizontal: "center" };
      }
      if (stone.certificateUrl) {
        row.getCell("certificate").value = { text: "View Certificate", hyperlink: stone.certificateUrl };
        row.getCell("certificate").font = { color: { argb: "FF10B981" }, underline: true, size: 10 };
      }
      if (stone.imageUrl) {
        row.getCell("image").value = { text: "View Image", hyperlink: stone.imageUrl };
        row.getCell("image").font = { color: { argb: "FF10B981" }, underline: true, size: 10 };
      }
      if (stone.videoUrl) {
        row.getCell("video").value = { text: "View Video", hyperlink: stone.videoUrl };
        row.getCell("video").font = { color: { argb: "FF10B981" }, underline: true, size: 10 };
      }

      row.height = 22;
    });

    // Auto-filter removed to prevent dropdown arrows in info tables

    // ═══════════════════════════════════════════════════════════════
    // FOOTER SECTION
    // ═══════════════════════════════════════════════════════════════
    
    const footerStartRow = 10 + selectedData.length;
    
    // Spacer row
    worksheet.mergeCells(`A${footerStartRow}:P${footerStartRow}`);
    worksheet.getRow(footerStartRow).height = 15;

    // Footer background row
    worksheet.mergeCells(`A${footerStartRow + 1}:P${footerStartRow + 1}`);
    const footerBgRow = worksheet.getRow(footerStartRow + 1);
    footerBgRow.height = 8;
    worksheet.getCell(`A${footerStartRow + 1}`).fill = { 
      type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } 
    };

    // Footer Row 1: Company & Tagline
    worksheet.mergeCells(`A${footerStartRow + 2}:P${footerStartRow + 2}`);
    const footerCell1 = worksheet.getCell(`A${footerStartRow + 2}`);
    footerCell1.value = "◆  GEMSTAR  ◆  Premium Gemstones & Diamonds";
    footerCell1.font = { bold: true, size: 12, color: { argb: "FF10B981" }, name: "Arial" };
    footerCell1.alignment = { vertical: "middle", horizontal: "center" };
    footerCell1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    worksheet.getRow(footerStartRow + 2).height = 28;

    // Footer Row 2: Locations
    worksheet.mergeCells(`A${footerStartRow + 3}:P${footerStartRow + 3}`);
    const footerCell2 = worksheet.getCell(`A${footerStartRow + 3}`);
    footerCell2.value = "📍 NEW YORK  ·  TEL AVIV  ·  HONG KONG  ·  LOS ANGELES";
    footerCell2.font = { size: 10, color: { argb: "FFD1D5DB" }, name: "Arial" };
    footerCell2.alignment = { vertical: "middle", horizontal: "center" };
    footerCell2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    worksheet.getRow(footerStartRow + 3).height = 22;

    // Footer Row 3: Contact Info
    worksheet.mergeCells(`A${footerStartRow + 4}:P${footerStartRow + 4}`);
    const footerCell3 = worksheet.getCell(`A${footerStartRow + 4}`);
    footerCell3.value = "📞 +1 (212) 869-0544  ·  ✉ info@gems.net  ·  🌐 www.gems.net";
    footerCell3.font = { size: 10, color: { argb: "FFD1D5DB" }, name: "Arial" };
    footerCell3.alignment = { vertical: "middle", horizontal: "center" };
    footerCell3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    worksheet.getRow(footerStartRow + 4).height = 22;

    // Footer Row 4: Disclaimer
    worksheet.mergeCells(`A${footerStartRow + 5}:P${footerStartRow + 5}`);
    const footerCell4 = worksheet.getCell(`A${footerStartRow + 5}`);
    footerCell4.value = "All prices are subject to change. Stones are certified and guaranteed authentic.";
    footerCell4.font = { size: 9, color: { argb: "FF9CA3AF" }, name: "Arial", italic: true };
    footerCell4.alignment = { vertical: "middle", horizontal: "center" };
    footerCell4.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    worksheet.getRow(footerStartRow + 5).height = 20;

    // Footer bottom accent line
    worksheet.mergeCells(`A${footerStartRow + 6}:P${footerStartRow + 6}`);
    const footerAccent = worksheet.getCell(`A${footerStartRow + 6}`);
    footerAccent.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF10B981" } };
    worksheet.getRow(footerStartRow + 6).height = 5;

    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer();
    const exportDate = new Date().toISOString().split("T")[0];
    const filename = `Gemstar_Export_${exportDate}.xlsx`;
    saveAs(new Blob([buffer]), filename);
  };

  const handleSort = (field) => {
    setSortConfig((prev) => ({
      field,
      direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Track visibility of export button for floating button
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show floating button when original is NOT visible and there are selected stones
        setShowFloatingExport(!entry.isIntersecting && selectedStones.size > 0);
      },
      { threshold: 0 }
    );

    if (exportButtonRef.current) {
      observer.observe(exportButtonRef.current);
    }

    return () => observer.disconnect();
  }, [selectedStones.size]);

  useEffect(() => {
    let intervalId;
    const startProgress = () => {
      setInitialLoading(true);
      setProgress(10);
      intervalId = setInterval(() => {
        setProgress((prev) => (prev >= 90 ? prev : prev + Math.random() * 10));
      }, 300);
    };

    const stopProgress = () => {
      setProgress(100);
      setTimeout(() => {
        setInitialLoading(false);
        setProgress(0);
      }, 400);
      if (intervalId) clearInterval(intervalId);
    };

    const fetchStones = async () => {
      try {
        setLoading(true);
        setError("");
        startProgress();
        const res = await fetch("https://gems-dna-be.onrender.com/api/soap-stones");
        if (!res.ok) throw new Error("Failed to load stones");
        const data = await res.json();
        const rows = Array.isArray(data.stones) ? data.stones : Array.isArray(data) ? data : [];
        const normalized = rows.map((row, index) => ({
          id: row.id ?? index,
          sku: row.sku ?? "",
          shape: row.shape ?? "",
          weightCt: row.weightCt != null ? Number(row.weightCt) : null,
          measurements: row.measurements ?? "",
          priceTotal: row.priceTotal != null ? Number(row.priceTotal) : null,
          pricePerCt: row.pricePerCt != null ? Number(row.pricePerCt) : null,
          imageUrl: row.imageUrl ?? null,
          videoUrl: row.videoUrl ?? null,
          certificateUrl: row.certificateUrl ?? null,
          lab: row.lab ?? "N/A",
          origin: row.origin ?? "N/A",
          ratio: row.ratio != null && row.ratio !== "" ? Number(row.ratio) : null,
          color: row.color ?? "",
          clarity: row.clarity ?? "",
          luster: row.luster ?? "",
          fluorescence: row.fluorescence ?? "",
          certificateNumber: row.certificateNumber ?? "",
          treatment: row.treatment ?? "",
          category: row.category ?? "",
        }));
        setStones(normalized);
      } catch (err) {
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
        stopProgress();
      }
    };

    fetchStones();
    return () => { if (intervalId) clearInterval(intervalId); };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedStone(null);
  }, [filters]);

  const shapesOptions = useMemo(() => {
    const set = new Set();
    stones.forEach((s) => s.shape && set.add(s.shape));
    return ["All shapes", ...Array.from(set).sort()];
  }, [stones]);

  const categoriesOptions = useMemo(() => {
    const set = new Set();
    stones.forEach((s) => s.category && set.add(s.category));
    return ["All categories", ...Array.from(set).sort()];
  }, [stones]);

  const filteredStones = useMemo(() => {
    // Helper to parse measurements string like "11.92-7.85-5.60" into { length, width, depth }
    const parseMeasurements = (measurements) => {
      if (!measurements) return { length: null, width: null, depth: null };
      const parts = measurements.split('-').map(p => parseFloat(p.trim()));
      return {
        length: parts[0] && !isNaN(parts[0]) ? parts[0] : null,
        width: parts[1] && !isNaN(parts[1]) ? parts[1] : null,
        depth: parts[2] && !isNaN(parts[2]) ? parts[2] : null,
      };
    };

    return stones.filter((stone) => {
      if (filters.sku && !stone.sku?.toLowerCase().includes(filters.sku.toLowerCase())) return false;
      if (filters.minPrice && stone.priceTotal != null && stone.priceTotal < Number(filters.minPrice)) return false;
      if (filters.maxPrice && stone.priceTotal != null && stone.priceTotal > Number(filters.maxPrice)) return false;
      if (filters.minCarat && stone.weightCt != null && stone.weightCt < Number(filters.minCarat)) return false;
      if (filters.maxCarat && stone.weightCt != null && stone.weightCt > Number(filters.maxCarat)) return false;
      
      // Measurements filter (length and width)
      const dims = parseMeasurements(stone.measurements);
      if (filters.minLength && dims.length != null && dims.length < Number(filters.minLength)) return false;
      if (filters.maxLength && dims.length != null && dims.length > Number(filters.maxLength)) return false;
      if (filters.minWidth && dims.width != null && dims.width < Number(filters.minWidth)) return false;
      if (filters.maxWidth && dims.width != null && dims.width > Number(filters.maxWidth)) return false;
      
      if (filters.shape !== "All shapes" && stone.shape !== filters.shape) return false;
      if (filters.treatment !== "All treatments" && stone.treatment?.toLowerCase() !== filters.treatment.toLowerCase()) return false;
      if (filters.category !== "All categories" && stone.category !== filters.category) return false;
      
      // Tag filter
      if (filters.tag !== "All tags") {
        const stoneTagList = stoneTags[stone.sku] || [];
        if (!stoneTagList.some((t) => t.name === filters.tag)) return false;
      }
      
      return true;
    });
  }, [filters, stones, stoneTags]);

  const sortedStones = useMemo(() => {
    const sorted = [...filteredStones];
    const { field, direction } = sortConfig;
    const dir = direction === "desc" ? -1 : 1;
    sorted.sort((a, b) => {
      // First, prioritize selected stones (always on top)
      const aIsSelected = selectedStones.has(a.id) ? 1 : 0;
      const bIsSelected = selectedStones.has(b.id) ? 1 : 0;
      if (aIsSelected !== bIsSelected) return bIsSelected - aIsSelected;
      
      // Second, prioritize Emerald shapes
      const aIsEmerald = a.shape?.toUpperCase() === "EM" || a.shape?.toLowerCase().includes("emerald") ? 1 : 0;
      const bIsEmerald = b.shape?.toUpperCase() === "EM" || b.shape?.toLowerCase().includes("emerald") ? 1 : 0;
      if (aIsEmerald !== bIsEmerald) return bIsEmerald - aIsEmerald;
      
      // Third, prioritize items with images (for mobile UX)
      const aHasImage = a.imageUrl ? 1 : 0;
      const bHasImage = b.imageUrl ? 1 : 0;
      if (aHasImage !== bHasImage) return bHasImage - aHasImage;
      
      // Then sort by the selected field
      const aVal = a[field];
      const bVal = b[field];
      if (typeof aVal === "number" && typeof bVal === "number") return (aVal - bVal) * dir;
      return String(aVal || "").localeCompare(String(bVal || "")) * dir;
    });
    return sorted;
  }, [filteredStones, sortConfig, selectedStones]);

  const totalItems = sortedStones.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedStones = sortedStones.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <>
      <LoadingBar active={initialLoading} progress={progress} />
      <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-stone-800 mb-2">Stone Inventory</h1>
                <p className="text-stone-500">
                  {loading ? 'Loading...' : `${totalItems.toLocaleString()} stones available`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Scan Button */}
                <button
                  onClick={() => setShowScanner(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-white font-medium rounded-xl shadow-lg transition-all"
                  title="Scan barcode"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  <span className="hidden sm:inline">Scan</span>
                </button>
                
                {/* Export Button */}
                <div ref={exportButtonRef}>
                {selectedStones.size > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={clearSelection}
                      className="px-3 py-2 text-sm text-stone-600 hover:text-stone-800 transition-colors"
                    >
                      Clear ({selectedStones.size})
                    </button>
                    <button
                      onClick={() => setShowExportModal(true)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium rounded-xl shadow-lg shadow-emerald-500/25 transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export Excel ({selectedStones.size})
                    </button>
                  </div>
                )}
                </div>
                {/* View Mode Toggle */}
              <div className="flex items-center gap-2 p-1 rounded-xl bg-stone-100">
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-2 rounded-lg transition-all ${viewMode === "table" ? "bg-white shadow-md text-primary-600" : "text-stone-500 hover:text-stone-700"}`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded-lg transition-all ${viewMode === "grid" ? "bg-white shadow-md text-primary-600" : "text-stone-500 hover:text-stone-700"}`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <StoneFilters
            filters={filters}
            onChange={setFilters}
            shapesOptions={shapesOptions}
            categoriesOptions={categoriesOptions}
            tags={tags}
            onManageTags={() => setShowTagsModal(true)}
          />

          {/* Content */}
          {viewMode === "table" ? (
            <StonesTable
              stones={paginatedStones}
              onToggle={(stone) => setSelectedStone(selectedStone?.id === stone.id ? null : stone)}
              selectedStone={selectedStone}
              loading={loading}
              error={error}
              sortConfig={sortConfig}
              onSort={handleSort}
              selectedStones={selectedStones}
              onToggleSelection={toggleStoneSelection}
              onToggleSelectAll={toggleSelectAll}
              allSelected={paginatedStones.length > 0 && paginatedStones.every((s) => selectedStones.has(s.id))}
              stoneTags={stoneTags}
              allTags={tags}
              onAddTag={addTagToStone}
              onRemoveTag={removeTagFromStone}
              onManageTags={() => setShowTagsModal(true)}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <div key={i} className="glass rounded-2xl border border-white/50 p-4 animate-pulse">
                    <div className="flex gap-4">
                      <div className="w-20 h-20 rounded-xl bg-stone-200"></div>
                      <div className="flex-1 space-y-3">
                        <div className="h-4 bg-stone-200 rounded w-1/2"></div>
                        <div className="h-5 bg-stone-200 rounded w-3/4"></div>
                        <div className="h-3 bg-stone-200 rounded w-1/3"></div>
                      </div>
                    </div>
                  </div>
                ))
              ) : error ? (
                <div className="col-span-full text-center py-12 text-red-500">{error}</div>
              ) : paginatedStones.length === 0 ? (
                <div className="col-span-full text-center py-12 text-stone-500">No stones found</div>
              ) : (
                paginatedStones.map((stone) => (
                  <StoneCard
                    key={stone.id}
                    stone={stone}
                    onToggle={(s) => setSelectedStone(selectedStone?.id === s.id ? null : s)}
                    isExpanded={selectedStone?.id === stone.id}
                    isSelected={selectedStones.has(stone.id)}
                    onToggleSelection={toggleStoneSelection}
                    stoneTags={stoneTags[stone.sku] || []}
                    allTags={tags}
                    onAddTag={addTagToStone}
                    onRemoveTag={removeTagFromStone}
                    onManageTags={() => setShowTagsModal(true)}
                  />
                ))
              )}
            </div>
          )}

          {/* Pagination */}
          {!loading && !error && totalItems > 0 && (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-stone-500">
                Showing {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, totalItems)} of {totalItems.toLocaleString()}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-sm text-stone-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Export Button */}
      <AnimatePresence>
        {showFloatingExport && (
          <motion.button
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            onClick={() => setShowExportModal(true)}
            className="fixed right-6 bottom-6 z-40 flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium rounded-2xl shadow-2xl shadow-emerald-500/30 transition-all hover:scale-105"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Export ({selectedStones.size})</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        selectedStones={stones.filter((s) => selectedStones.has(s.id))}
        onExport={exportToExcel}
      />

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleBarcodeScan}
      />

      {/* Tags Management Modal */}
      <TagsModal
        isOpen={showTagsModal}
        onClose={() => setShowTagsModal(false)}
        tags={tags}
        onCreateTag={createTag}
        onDeleteTag={deleteTag}
        onUpdateTag={updateTag}
      />

      {/* Scan Success Toast */}
      <AnimatePresence>
        {scanResult && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-emerald-600 text-white rounded-xl shadow-lg flex items-center gap-3"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">Added: {scanResult}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default StoneSearchPage;
