import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ShapeIcon from "./ShapeIcon";

const LEVEL_1_SHAPES = [
  'Round', 'Emerald', 'Cushion', 'Pear', 'Oval', 'Marquise',
  'Baguette', 'Heart', 'Radiant', 'Old Mine', 'Cabushon', 'Carre',
];

const EXTRA_BARAK_FILTERS = ['ASH', 'TPR'];
const BARAK_DISPLAY_NAMES = { 'ASH': 'Asscher', 'TPR': 'Taper' };

const ShapeFilter = ({ shapes, activeShapes, onToggle }) => {
  const [showMore, setShowMore] = useState(false);
  const [shapeSearch, setShapeSearch] = useState('');

  const mainShapes = ['All shapes', ...LEVEL_1_SHAPES].filter(s => shapes.includes(s));
  const otherShapes = shapes.filter(s => s !== 'All shapes' && !LEVEL_1_SHAPES.includes(s));
  const filteredOtherShapes = otherShapes.filter(s => {
    const q = shapeSearch.toLowerCase();
    const display = BARAK_DISPLAY_NAMES[s] || s;
    return s.toLowerCase().includes(q) || display.toLowerCase().includes(q);
  });

  const isAllActive = activeShapes.length === 0;

  const toggleShape = (shape) => {
    if (activeShapes.includes(shape)) {
      onToggle(activeShapes.filter(s => s !== shape));
    } else {
      onToggle([...activeShapes, shape]);
    }
  };

  const ShapeButton = ({ shape }) => {
    const isAll = shape === "All shapes";
    const isActive = isAll ? isAllActive : activeShapes.includes(shape);
    return (
      <button
        key={shape}
        onClick={() => isAll ? onToggle([]) : toggleShape(shape)}
        className={`flex flex-col items-center justify-center rounded-xl border-2 transition-all duration-150 w-[72px] h-[72px] sm:w-20 sm:h-20 ${
          isAll
            ? `text-sm font-semibold ${isActive ? 'bg-emerald-500 text-white border-emerald-500 shadow-md' : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300 hover:bg-stone-50'}`
            : `${isActive ? 'bg-emerald-50 border-emerald-500 shadow-md' : 'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50'}`
        }`}
      >
        {isAll ? (
          <span>All</span>
        ) : (
          <>
            <ShapeIcon shape={shape} isActive={isActive} />
            <span className={`text-[10px] mt-1 font-medium ${isActive ? 'text-emerald-700' : 'text-stone-500'}`}>
              {shape}
            </span>
          </>
        )}
      </button>
    );
  };

  return (
    <div className="sm:col-span-2 lg:col-span-4">
      <label className="block text-xs font-medium text-stone-500 mb-2">
        Shape
        {activeShapes.length > 0 && (
          <span className="ml-2 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
            {activeShapes.length} selected
          </span>
        )}
      </label>
      {/* Main shapes (Level 1) */}
      <div className="flex flex-wrap gap-2">
        {mainShapes.map((shape) => (
          <ShapeButton key={shape} shape={shape} />
        ))}
      </div>
      {/* Show more / less (Level 2) */}
      {otherShapes.length > 0 && (
        <>
          <button
            onClick={() => { setShowMore(!showMore); setShapeSearch(''); }}
            className="mt-2 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1"
          >
            {showMore ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                Show less
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                Show more ({otherShapes.length})
              </>
            )}
          </button>
          <AnimatePresence>
            {showMore && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-2 p-3 rounded-xl border border-stone-200 bg-stone-50/50 max-w-xs">
                  <input
                    type="text"
                    value={shapeSearch}
                    onChange={(e) => setShapeSearch(e.target.value)}
                    placeholder="Search shapes..."
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 mb-2"
                    autoFocus
                  />
                  <div className="max-h-48 overflow-y-auto">
                    {filteredOtherShapes.map((shape) => {
                      const isActive = activeShapes.includes(shape);
                      const displayName = BARAK_DISPLAY_NAMES[shape] || shape;
                      return (
                        <button
                          key={shape}
                          onClick={() => toggleShape(shape)}
                          className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'text-stone-600 hover:bg-stone-100'
                          }`}
                        >
                          <span>{displayName}</span>
                          {isActive && (
                            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                    {filteredOtherShapes.length === 0 && (
                      <span className="text-xs text-stone-400 py-2 px-3 block">No shapes found</span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};

export default ShapeFilter;
export { ShapeFilter };
