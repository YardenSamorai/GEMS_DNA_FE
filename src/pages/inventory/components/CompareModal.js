import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getDisplayShape } from "../helpers/constants";

/* ---------------- Compare Modal ---------------- */
export const COMPARE_FIELDS = [
  { key: 'shape', label: 'Shape', format: (v) => getDisplayShape(v) || '-' },
  { key: 'category', label: 'Category', format: (v) => v || '-' },
  { key: 'groupingType', label: 'Type', format: (v) => v || '-' },
  { key: 'weightCt', label: 'Weight', format: (v) => v ? `${v} ct` : '-' },
  { key: 'color', label: 'Color', format: (v) => v || '-' },
  { key: 'clarity', label: 'Clarity', format: (v) => v || '-' },
  { key: 'treatment', label: 'Treatment', format: (v) => v || '-' },
  { key: 'measurements', label: 'Measurements', format: (v) => v || '-' },
  { key: 'ratio', label: 'Ratio', format: (v) => v ? Number(v).toFixed(2) : '-' },
  { key: 'lab', label: 'Lab', format: (v) => v || '-' },
  { key: 'origin', label: 'Origin', format: (v) => v || '-' },
  { key: 'fluorescence', label: 'Fluorescence', format: (v) => v || '-' },
  { key: 'cut', label: 'Cut', format: (v) => v || '-' },
  { key: 'polish', label: 'Polish', format: (v) => v || '-' },
  { key: 'symmetry', label: 'Symmetry', format: (v) => v || '-' },
  { key: 'pricePerCt', label: 'Price/ct', format: (v) => v ? `$${Number(v).toLocaleString()}` : '-' },
  { key: 'priceTotal', label: 'Total Price', format: (v) => v ? `$${Number(v).toLocaleString()}` : '-' },
  { key: 'location', label: 'Location', format: (v) => v || '-' },
];

export const CompareModal = ({ isOpen, onClose, stones }) => {
  if (!isOpen || !stones.length) return null;
  const allSame = (key) => {
    const vals = stones.map(s => s[key]).filter(Boolean);
    return vals.length > 1 && new Set(vals).size === 1;
  };
  const allDiff = (key) => {
    const vals = stones.map(s => s[key]).filter(Boolean);
    return vals.length > 1 && new Set(vals).size === vals.length;
  };
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
              <div>
                <h2 className="text-lg font-semibold text-stone-800">Compare Stones</h2>
                <p className="text-xs text-stone-500">{stones.length} stones selected</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-stone-100 flex items-center justify-center transition-colors">
                <svg className="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-stone-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 w-[140px] min-w-[140px] bg-stone-50"></th>
                    {stones.map(s => (
                      <th key={s.sku} className="px-4 py-3 text-center min-w-[180px]">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-20 h-20 rounded-xl overflow-hidden bg-stone-100 border border-stone-200">
                            {s.imageUrl ? (
                              <img src={s.imageUrl} alt={s.sku} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-stone-300">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                              </div>
                            )}
                          </div>
                          <span className="font-mono text-sm font-bold text-primary-700">{s.sku}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_FIELDS.map(({ key, label, format }) => {
                    const same = allSame(key);
                    const diff = allDiff(key);
                    return (
                      <tr key={key} className={`border-b border-stone-100 ${diff ? 'bg-amber-50/50' : ''}`}>
                        <td className="px-4 py-2.5 text-xs font-semibold text-stone-500 bg-stone-50">{label}</td>
                        {stones.map(s => (
                          <td key={s.sku} className="px-4 py-2.5 text-center">
                            <span className={`text-sm ${diff ? 'font-semibold text-amber-700' : same ? 'text-emerald-600' : 'text-stone-700'}`}>
                              {format(s[key])}
                            </span>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CompareModal;
