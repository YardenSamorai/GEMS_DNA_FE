import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const PDFOptionsModal = ({ isOpen, onClose, onGenerate, stoneCount, isGenerating }) => {
  const [layout, setLayout] = useState('grid');
  const [showPrices, setShowPrices] = useState(true);

  if (!isOpen) return null;

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
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-background rounded-lg border border-border shadow-lg w-full max-w-md overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              PDF Catalog
            </h2>
            <p className="text-white/80 text-sm mt-1">
              Generate a professional catalog with {stoneCount} stones
            </p>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Layout Selection */}
            <div>
              <h3 className="font-semibold text-stone-700 mb-3">Layout Style</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setLayout('grid')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    layout === 'grid'
                      ? 'border-red-400 bg-red-50'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="grid grid-cols-2 gap-1 mb-2">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`h-4 rounded ${layout === 'grid' ? 'bg-red-300' : 'bg-stone-300'}`} />
                    ))}
                  </div>
                  <span className={`text-sm font-medium ${layout === 'grid' ? 'text-red-700' : 'text-stone-600'}`}>
                    Grid (6/page)
                  </span>
                </button>
                
                <button
                  onClick={() => setLayout('list')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    layout === 'list'
                      ? 'border-red-400 bg-red-50'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="space-y-1 mb-2">
                    {[1,2,3].map(i => (
                      <div key={i} className={`h-3 rounded ${layout === 'list' ? 'bg-red-300' : 'bg-stone-300'}`} />
                    ))}
                  </div>
                  <span className={`text-sm font-medium ${layout === 'list' ? 'text-red-700' : 'text-stone-600'}`}>
                    List (4/page)
                  </span>
                </button>
              </div>
            </div>

            {/* Options */}
            <div>
              <h3 className="font-semibold text-stone-700 mb-3">Options</h3>
              <label className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 cursor-pointer hover:bg-stone-100 transition-colors">
                <input
                  type="checkbox"
                  checked={showPrices}
                  onChange={(e) => setShowPrices(e.target.checked)}
                  className="w-5 h-5 rounded border-stone-300 text-red-500 focus:ring-red-500"
                />
                <div>
                  <span className="font-medium text-stone-700">Show Prices</span>
                  <p className="text-xs text-stone-500">Include price information in the catalog</p>
                </div>
              </label>
            </div>

            {/* Preview info */}
            <div className="p-4 rounded-md bg-destructive/5 border border-destructive/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-red-700">
                    {Math.ceil(stoneCount / (layout === 'grid' ? 6 : 4)) + 1} pages
                  </p>
                  <p className="text-xs text-red-600">
                    Including cover page
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 py-4 bg-muted/50 border-t border-border">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-stone-600 hover:text-stone-800 font-medium transition-colors rounded-lg hover:bg-stone-100"
            >
              Cancel
            </button>
            <button
              onClick={() => onGenerate({ layout, showPrices })}
              disabled={isGenerating}
              className="flex-1 h-10 bg-destructive text-destructive-foreground hover:bg-destructive/90 font-medium rounded-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Generate PDF
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PDFOptionsModal;
export { PDFOptionsModal };
