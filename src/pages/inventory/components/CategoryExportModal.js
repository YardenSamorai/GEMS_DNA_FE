import { motion, AnimatePresence } from "framer-motion";

const CategoryExportModal = ({ isOpen, onClose, categories, onChoose }) => {
  if (!isOpen) return null;
  
  const emeraldCount = categories.emeralds || 0;
  const diamondCount = categories.diamonds || 0;
  const otherCount = categories.other || 0;
  
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
            <h2 className="text-lg font-semibold text-foreground">Export Options</h2>
            <p className="text-muted-foreground text-sm mt-1">
              You selected multiple categories
            </p>
          </div>
          
          {/* Content */}
          <div className="p-6">
            {/* Summary */}
            <div className="flex flex-wrap gap-2 mb-6">
              {emeraldCount > 0 && (
                <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  נ' Emeralds: {emeraldCount}
                </span>
              )}
              {diamondCount > 0 && (
                <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  נ' Diamonds: {diamondCount}
                </span>
              )}
              {otherCount > 0 && (
                <span className="px-3 py-1.5 bg-stone-100 text-stone-700 rounded-full text-sm font-medium">
                  נ"· Other: {otherCount}
                </span>
              )}
            </div>
            
            {/* Options */}
            <div className="space-y-3">
              <button
                onClick={() => onChoose('separate')}
                className="w-full p-4 border-2 border-emerald-200 rounded-xl hover:border-emerald-400 hover:bg-emerald-50 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-stone-800">Separate Sheets</h3>
                    <p className="text-sm text-stone-500">
                      Each category in its own sheet with specific columns
                    </p>
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => onChoose('combined')}
                className="w-full p-4 border-2 border-blue-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-stone-800">Combined Sheet</h3>
                    <p className="text-sm text-stone-500">
                      All stones in one sheet with all columns
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
          
          {/* Footer */}
          <div className="px-6 py-4 bg-muted/50 border-t border-border">
            <button
              onClick={onClose}
              className="w-full py-2.5 text-stone-600 hover:text-stone-800 font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CategoryExportModal;
export { CategoryExportModal };
