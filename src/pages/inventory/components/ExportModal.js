import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getMappedCategories } from "../../../utils/categoryMap";
import { supportsBrutoMode } from "../../../utils/pricing";
import { getDisplayShape } from "../helpers/constants";

/* ---------------- Export Modal ---------------- */
export const ExportModal = ({ 
  isOpen, 
  onClose, 
  selectedStones, 
  onExport,
  title = "Export Preview",
  subtitle = null,
  buttonText = "Export",
  buttonColor = "from-emerald-500 to-emerald-600",
  showHidePricesOption = true,
  priceMode = "neto"
}) => {
  const [globalMarkup, setGlobalMarkup] = useState(0);
  const [priceOverrides, setPriceOverrides] = useState({});
  const [includeAppendix, setIncludeAppendix] = useState(false);
  const [hidePrices, setHidePrices] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setGlobalMarkup(0);
      setPriceOverrides({});
      setIncludeAppendix(true);
      setHidePrices(false);
    }
  }, [isOpen]);

  const getCategoryDot = (category) => {
    const mapped = getMappedCategories(category);
    if (mapped.includes('Emerald')) {
      return <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" title="Emerald" />;
    }
    if (mapped.includes('Diamond')) {
      return <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" title="Diamond" />;
    }
    return <span className="inline-block w-2.5 h-2.5 rounded-full bg-stone-400" title={mapped[0] || 'Other'} />;
  };

  if (!isOpen) return null;

  // Diamonds and jewelry are always quoted Neto, so the Bruto toggle never
  // touches them. The badge has to say so — claiming "Bruto prices" over an
  // untouched diamond export is how a rep ends up quoting the wrong figure.
  const showsBrutoPrices =
    priceMode === "bruto" && selectedStones.some(supportsBrutoMode);

  // Base $/ct for a row. Jewelry is priced as a flat total with no per-carat
  // figure, so we derive one from total ÷ carat — otherwise its price would
  // collapse to $0 in the PDF (everything here is computed off $/ct).
  const basePricePerCt = (stone) => {
    if (stone.pricePerCt && stone.pricePerCt > 0) return stone.pricePerCt;
    const wt = stone.weightCt || 0;
    const total = stone.priceTotal || 0;
    return wt > 0 ? total / wt : 0;
  };

  // Calculate adjusted prices (based on Price Per Carat)
  const getAdjustedPricePerCt = (stone) => {
    if (priceOverrides[stone.id] !== undefined) {
      return priceOverrides[stone.id];
    }
    return basePricePerCt(stone) * (1 + globalMarkup / 100);
  };

  const getAdjustedTotal = (stone) => {
    const weight = stone.weightCt || 0;
    if (weight > 0) return getAdjustedPricePerCt(stone) * weight;
    // No carat weight (some jewelry): scale the stored total directly so the
    // price survives instead of becoming $0.
    return (stone.priceTotal || 0) * (1 + globalMarkup / 100);
  };

  // Apply global markup to all
  const applyGlobalMarkup = () => {
    const newOverrides = {};
    selectedStones.forEach((stone) => {
      newOverrides[stone.id] = basePricePerCt(stone) * (1 + globalMarkup / 100);
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
      pricePerCt: hidePrices ? 0 : getAdjustedPricePerCt(stone),
      priceTotal: hidePrices ? 0 : getAdjustedTotal(stone),
    }));
    onExport(stonesWithAdjustedPrices, { includeAppendix, hidePrices });
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
          <div className={`px-4 sm:px-6 py-3 sm:py-4 border-b border-stone-200 bg-gradient-to-r ${buttonColor}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-bold text-white">{title}</h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide bg-white/25 text-white border border-white/30">
                      {showsBrutoPrices ? "Bruto prices" : "Neto prices"}
                    </span>
                  </div>
                  <p className="text-white/80 text-xs sm:text-sm">{subtitle || `${selectedStones.length} stones selected`}</p>
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
          {!hidePrices && (
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
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${showsBrutoPrices ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"}`}>
                  {showsBrutoPrices ? "Bruto" : "Neto"}
                </span>
                <span className="text-stone-500">
                  Original: <span className="font-semibold text-stone-700">${totalOriginal.toLocaleString()}</span>
                </span>
                <span className="text-emerald-600">
                  Adjusted: <span className="font-bold text-emerald-700">${totalAdjusted.toLocaleString()}</span>
                </span>
              </div>
            </div>
          </div>
          )}

          {/* Stones List - Cards for Mobile, Table for Desktop */}
          <div className="overflow-auto max-h-[50vh] sm:max-h-[45vh]">
            {/* Mobile Cards View */}
            <div className="sm:hidden divide-y divide-stone-100">
              {selectedStones.map((stone, index) => {
                const originalPricePerCt = basePricePerCt(stone);
                const adjustedPricePerCt = getAdjustedPricePerCt(stone);
                const adjustedTotal = getAdjustedTotal(stone);
                const priceDiff = adjustedPricePerCt - originalPricePerCt;
                const percentChange = originalPricePerCt > 0 ? ((priceDiff / originalPricePerCt) * 100).toFixed(1) : 0;
                const isModified = priceOverrides[stone.id] !== undefined || globalMarkup !== 0;

                return (
                  <div key={stone.id} className={`p-3 ${index % 2 === 0 ? "bg-white" : "bg-stone-50/50"}`}>
                    {/* Top Row: SKU, Shape, Weight */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getCategoryDot(stone.category)}
                        <span className="font-mono text-sm font-bold text-emerald-600">{stone.sku}</span>
                        <span className="text-xs text-stone-500 bg-stone-100 px-2 py-0.5 rounded">{getDisplayShape(stone.shape)}</span>
                      </div>
                      <span className="text-sm font-medium text-stone-700">{stone.weightCt}ct</span>
                    </div>
                    
                    {/* Price Row */}
                    {!hidePrices && (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-stone-400 uppercase">Original $/ct</span>
                        <span className="text-sm text-stone-500">${originalPricePerCt.toLocaleString()}</span>
                      </div>
                      
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-stone-400 uppercase">New $/ct</span>
                        <input
                          type="number"
                          value={Math.round(adjustedPricePerCt)}
                          onChange={(e) => {
                            const newPricePerCt = parseFloat(e.target.value) || 0;
                            setPriceOverrides((prev) => ({ ...prev, [stone.id]: newPricePerCt }));
                          }}
                          className={`w-24 px-2 py-1.5 text-sm text-center border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                            isModified ? "border-emerald-400 bg-emerald-50" : "border-stone-300"
                          }`}
                        />
                      </div>
                      
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1">
                          {priceDiff !== 0 && (
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                              priceDiff > 0 
                                ? "text-emerald-700 bg-emerald-100" 
                                : "text-red-700 bg-red-100"
                            }`}>
                              {priceDiff > 0 ? "+" : ""}{percentChange}%
                            </span>
                          )}
                          {isModified && (
                            <button
                              onClick={() => resetPrice(stone.id)}
                              className="text-xs text-stone-400 hover:text-stone-600"
                            >
                              Γז║
                            </button>
                          )}
                        </div>
                        <span className="text-sm font-bold text-stone-800">${Math.round(adjustedTotal).toLocaleString()}</span>
                      </div>
                    </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <table className="w-full hidden sm:table">
              <thead className="bg-stone-100 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Shape</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-stone-600 uppercase">Weight</th>
                  {!hidePrices && <>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-stone-600 uppercase">Orig $/ct</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-stone-600 uppercase">New $/ct</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-stone-600 uppercase">+/-</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-stone-600 uppercase">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-stone-600 uppercase"></th>
                  </>}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {selectedStones.map((stone, index) => {
                  const originalPricePerCt = basePricePerCt(stone);
                  const adjustedPricePerCt = getAdjustedPricePerCt(stone);
                  const adjustedTotal = getAdjustedTotal(stone);
                  const priceDiff = adjustedPricePerCt - originalPricePerCt;
                  const percentChange = originalPricePerCt > 0 ? ((priceDiff / originalPricePerCt) * 100).toFixed(1) : 0;
                  const isModified = priceOverrides[stone.id] !== undefined || globalMarkup !== 0;

                  return (
                    <tr key={stone.id} className={index % 2 === 0 ? "bg-white" : "bg-stone-50/50"}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getCategoryDot(stone.category)}
                          <span className="font-mono text-sm font-medium text-emerald-600">{stone.sku}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-stone-700">{getDisplayShape(stone.shape)}</td>
                      <td className="px-4 py-3 text-sm text-stone-700 text-center">{stone.weightCt}ct</td>
                      {!hidePrices && <>
                      <td className="px-4 py-3 text-sm text-stone-500 text-right">
                        ${originalPricePerCt.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={Math.round(adjustedPricePerCt)}
                          onChange={(e) => {
                            const newPricePerCt = parseFloat(e.target.value) || 0;
                            setPriceOverrides((prev) => ({ ...prev, [stone.id]: newPricePerCt }));
                          }}
                          className={`w-28 px-3 py-1.5 text-sm text-center border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                            isModified ? "border-emerald-400 bg-emerald-50" : "border-stone-300"
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {priceDiff !== 0 && (
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                            priceDiff > 0 
                              ? "text-emerald-700 bg-emerald-100" 
                              : "text-red-700 bg-red-100"
                          }`}>
                            {priceDiff > 0 ? "+" : ""}{percentChange}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-stone-700 text-right font-medium">
                        ${Math.round(adjustedTotal).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isModified && (
                          <button
                            onClick={() => resetPrice(stone.id)}
                            className="text-xs text-stone-500 hover:text-stone-700 underline"
                          >
                            Γז║
                          </button>
                        )}
                      </td>
                      </>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-stone-200 bg-stone-50">
            {/* Options Row */}
            <div className="flex flex-wrap items-center gap-4 mb-3 pb-3 border-b border-stone-200">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeAppendix}
                  onChange={(e) => setIncludeAppendix(e.target.checked)}
                  className="w-4 h-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs sm:text-sm text-stone-700 font-medium">Include GRS Appendix</span>
              </label>
              {showHidePricesOption && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hidePrices}
                  onChange={(e) => setHidePrices(e.target.checked)}
                  className="w-4 h-4 rounded border-stone-300 text-red-500 focus:ring-red-500"
                />
                <span className="text-xs sm:text-sm text-stone-700 font-medium">Hide Prices</span>
              </label>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="text-xs sm:text-sm text-stone-600 text-center sm:text-left space-y-1 sm:space-y-0">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1">
                  <span><span className="font-medium">{selectedStones.length}</span> stones</span>
                  <span><span className="font-medium">{totalWeight.toFixed(2)}</span> ct</span>
                  {!hidePrices && <>
                  <span className="text-stone-400">|</span>
                  <span>Orig: <span className="font-medium text-stone-500">${totalOriginal.toLocaleString()}</span></span>
                  <span className={`font-semibold ${totalAdjusted !== totalOriginal ? 'text-emerald-600' : 'text-stone-700'}`}>
                    Γזע Total: ${Math.round(totalAdjusted).toLocaleString()}
                  </span>
                  </>}
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
                  className={`flex-1 sm:flex-none px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-medium text-white bg-gradient-to-r ${buttonColor} rounded-xl hover:opacity-90 shadow-lg transition-all flex items-center justify-center gap-2`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>{buttonText}</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ExportModal;
