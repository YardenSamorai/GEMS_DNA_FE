import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const ITEMS_PER_PAGE = 50;

const treatmentOptions = [
  "All treatments",
  "No oil",
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
const StoneFilters = ({ filters, onChange, shapesOptions, categoriesOptions }) => {
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
      shape: "All shapes",
      treatment: "All treatments",
      category: "All categories",
    });
  };

  const activeFiltersCount = [
    filters.sku,
    filters.minPrice,
    filters.maxPrice,
    filters.minCarat,
    filters.maxCarat,
    !filters.shape.includes("All") && filters.shape,
    !filters.treatment.includes("All") && filters.treatment,
    !filters.category.includes("All") && filters.category,
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
      </div>
    </div>
  );
};

/* ---------------- Stone Card (Mobile) ---------------- */
const StoneCard = ({ stone, onToggle, isExpanded }) => (
  <motion.div
    layout
    className="glass rounded-2xl border border-white/50 overflow-hidden shadow-md"
  >
    <div className="p-4">
      <div className="flex gap-4">
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
const StonesTable = ({ stones, onToggle, selectedStone, loading, error, sortConfig, onSort }) => {
  if (loading) {
    return (
      <div className="glass rounded-2xl border border-white/50 p-12">
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
      <div className="glass rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
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
      <div className="glass rounded-2xl border border-white/50 p-12 text-center">
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

  return (
    <div className="glass rounded-2xl border border-white/50 overflow-hidden shadow-lg">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50/50">
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
              <th className="px-4 py-4 text-right text-xs font-semibold text-stone-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {stones.map((stone, index) => {
              const isExpanded = selectedStone?.id === stone.id;
              return (
                <>
                  <motion.tr
                    key={stone.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className={`hover:bg-stone-50/50 transition-colors ${isExpanded ? 'bg-primary-50/30' : ''}`}
                  >
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
                        <td colSpan={9} className="bg-stone-50 border-t border-stone-200">
                          <StoneDetails stone={stone} />
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
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
Eshed Diamonds`;

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
Best regards, Eshed Diamonds
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
    shape: "All shapes",
    treatment: "All treatments",
    category: "All categories",
  });

  const [stones, setStones] = useState([]);
  const [selectedStone, setSelectedStone] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [initialLoading, setInitialLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [sortConfig, setSortConfig] = useState({ field: "sku", direction: "asc" });
  const [viewMode, setViewMode] = useState("table");

  const handleSort = (field) => {
    setSortConfig((prev) => ({
      field,
      direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

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
    return stones.filter((stone) => {
      if (filters.sku && !stone.sku?.toLowerCase().includes(filters.sku.toLowerCase())) return false;
      if (filters.minPrice && stone.priceTotal != null && stone.priceTotal < Number(filters.minPrice)) return false;
      if (filters.maxPrice && stone.priceTotal != null && stone.priceTotal > Number(filters.maxPrice)) return false;
      if (filters.minCarat && stone.weightCt != null && stone.weightCt < Number(filters.minCarat)) return false;
      if (filters.maxCarat && stone.weightCt != null && stone.weightCt > Number(filters.maxCarat)) return false;
      if (filters.shape !== "All shapes" && stone.shape !== filters.shape) return false;
      if (filters.treatment !== "All treatments" && stone.treatment !== filters.treatment) return false;
      if (filters.category !== "All categories" && stone.category !== filters.category) return false;
      return true;
    });
  }, [filters, stones]);

  const sortedStones = useMemo(() => {
    const sorted = [...filteredStones];
    const { field, direction } = sortConfig;
    const dir = direction === "desc" ? -1 : 1;
    sorted.sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      if (typeof aVal === "number" && typeof bVal === "number") return (aVal - bVal) * dir;
      return String(aVal || "").localeCompare(String(bVal || "")) * dir;
    });
    return sorted;
  }, [filteredStones, sortConfig]);

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

          {/* Filters */}
          <StoneFilters
            filters={filters}
            onChange={setFilters}
            shapesOptions={shapesOptions}
            categoriesOptions={categoriesOptions}
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
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
    </>
  );
};

export default StoneSearchPage;
