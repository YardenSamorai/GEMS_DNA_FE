import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";

/*
 * Pre-flight dialog for the "Catalog (Liran)" export.
 *
 * Lets the user (a) reorder the selected items with drag & drop — the PDF
 * grid follows this order — and (b) type an optional "Website text" per item
 * which is printed in the PDF instead of the blank fill-in lines.
 */

const RowItem = ({ row, onTextChange }) => {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={row}
      dragListener={false}
      dragControls={controls}
      className="bg-white rounded-xl border border-stone-200 shadow-sm select-none"
      whileDrag={{ scale: 1.02, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", zIndex: 10 }}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Drag handle — the only place that starts a drag, so the text
            input below stays freely clickable/selectable. */}
        <button
          type="button"
          onPointerDown={(e) => { e.preventDefault(); controls.start(e); }}
          className="shrink-0 p-2 -m-1 cursor-grab active:cursor-grabbing text-stone-400 hover:text-stone-600 touch-none"
          title="Drag to reorder"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <circle cx="7" cy="5" r="1.5" /><circle cx="13" cy="5" r="1.5" />
            <circle cx="7" cy="10" r="1.5" /><circle cx="13" cy="10" r="1.5" />
            <circle cx="7" cy="15" r="1.5" /><circle cx="13" cy="15" r="1.5" />
          </svg>
        </button>

        <div className="shrink-0 w-12 h-12 rounded-lg bg-stone-100 border border-stone-200 overflow-hidden flex items-center justify-center">
          {row.stone.imageUrl ? (
            <img src={row.stone.imageUrl} alt="" className="w-full h-full object-contain" draggable={false} />
          ) : (
            <svg className="w-5 h-5 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-stone-800 truncate">{row.stone.sku || "-"}</span>
            <span className="text-xs text-stone-400 shrink-0">
              {row.stone.category === "Jewelry" ? (row.stone.jewelryType || "Jewelry") : (row.stone.category || "Stone")}
            </span>
          </div>
          <input
            type="text"
            value={row.websiteText}
            onChange={(e) => onTextChange(row.id, e.target.value)}
            placeholder="Website text (optional — blank lines if empty)"
            className="mt-1 w-full text-sm px-2.5 py-1.5 rounded-lg border border-stone-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none placeholder:text-stone-300"
          />
        </div>
      </div>
    </Reorder.Item>
  );
};

const CatalogLiranModal = ({ isOpen, stones, onClose, onGenerate, isGenerating }) => {
  const [rows, setRows] = useState([]);

  // Re-seed rows whenever the dialog opens with a fresh selection.
  useEffect(() => {
    if (isOpen) {
      setRows((stones || []).map((stone) => ({ id: stone.id, stone, websiteText: "" })));
    }
  }, [isOpen, stones]);

  const handleTextChange = (id, text) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, websiteText: text } : r)));
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full sm:max-w-2xl bg-stone-50 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh]"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-stone-200 bg-white rounded-t-2xl flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-stone-800">Catalog (Liran)</h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Drag to set the order &middot; add website text per item ({rows.length} items)
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Reorderable list */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <Reorder.Group axis="y" values={rows} onReorder={setRows} className="space-y-2">
                {rows.map((row) => (
                  <RowItem key={row.id} row={row} onTextChange={handleTextChange} />
                ))}
              </Reorder.Group>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-stone-200 bg-white rounded-b-none sm:rounded-b-2xl flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                disabled={isGenerating}
                className="px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => onGenerate(rows.map((r) => ({ ...r.stone, websiteText: r.websiteText.trim() })))}
                disabled={isGenerating || rows.length === 0}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 rounded-lg shadow-md transition-all disabled:opacity-60 flex items-center gap-2"
              >
                {isGenerating && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                )}
                {isGenerating ? "Generating\u2026" : "Generate PDF"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default CatalogLiranModal;
