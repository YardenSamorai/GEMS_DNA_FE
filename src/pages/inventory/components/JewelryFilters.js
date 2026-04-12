import React, { useState } from "react";

const JewelryFilters = ({ filters, onChange, jewelryTypeOptions, jewelryStyleOptions, jewelryCollectionOptions, jewelryStoneTypeOptions, jewelryMetalTypeOptions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const handleChange = (field) => (e) => { onChange({ ...filters, [field]: e.target.value }); };
  const handleMulti = (field, value) => {
    const current = filters[field] || [];
    onChange({ ...filters, [field]: current.includes(value) ? current.filter(v => v !== value) : [...current, value] });
  };
  const activeCount = [
    filters.minPrice, filters.maxPrice, filters.minCarat, filters.maxCarat,
  ].filter(Boolean).length + (filters.category?.length || 0) + (filters.shape?.length || 0) + (filters.treatment?.length || 0) + (filters.diamondColor?.length || 0) + (filters.fancyColor?.length || 0);

  return (
    <div className="mb-4">
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-stone-800 transition-colors mb-2">
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        Filters {activeCount > 0 && <span className="text-xs bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded-full">{activeCount}</span>}
      </button>
      {isOpen && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Min Price</label>
              <input type="number" value={filters.minPrice} onChange={handleChange('minPrice')} placeholder="Min $" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Max Price</label>
              <input type="number" value={filters.maxPrice} onChange={handleChange('maxPrice')} placeholder="Max $" className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm focus:ring-2 focus:ring-pink-300 focus:border-pink-400 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Min Carats</label>
              <input type="number" step="0.01" value={filters.minCarat} onChange={handleChange('minCarat')} placeholder="Min ct" className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm focus:ring-2 focus:ring-pink-300 focus:border-pink-400 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Max Carats</label>
              <input type="number" step="0.01" value={filters.maxCarat} onChange={handleChange('maxCarat')} placeholder="Max ct" className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm focus:ring-2 focus:ring-pink-300 focus:border-pink-400 outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {jewelryTypeOptions.length > 1 && (
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Type</label>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {jewelryTypeOptions.slice(1).map(opt => (
                    <button key={opt} onClick={() => handleMulti('category', opt)} className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${(filters.category || []).includes(opt) ? 'bg-pink-500 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>{opt}</button>
                  ))}
                </div>
              </div>
            )}
            {jewelryStyleOptions.length > 1 && (
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Style</label>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {jewelryStyleOptions.slice(1).map(opt => (
                    <button key={opt} onClick={() => handleMulti('shape', opt)} className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${(filters.shape || []).includes(opt) ? 'bg-pink-500 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>{opt}</button>
                  ))}
                </div>
              </div>
            )}
            {jewelryCollectionOptions.length > 1 && (
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Collection</label>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {jewelryCollectionOptions.slice(1).map(opt => (
                    <button key={opt} onClick={() => handleMulti('treatment', opt)} className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${(filters.treatment || []).includes(opt) ? 'bg-pink-500 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>{opt}</button>
                  ))}
                </div>
              </div>
            )}
            {jewelryStoneTypeOptions.length > 1 && (
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Stone Type</label>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {jewelryStoneTypeOptions.slice(1).map(opt => (
                    <button key={opt} onClick={() => handleMulti('diamondColor', opt)} className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${(filters.diamondColor || []).includes(opt) ? 'bg-pink-500 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>{opt}</button>
                  ))}
                </div>
              </div>
            )}
            {jewelryMetalTypeOptions.length > 1 && (
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Metal</label>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {jewelryMetalTypeOptions.slice(1).map(opt => (
                    <button key={opt} onClick={() => handleMulti('fancyColor', opt)} className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${(filters.fancyColor || []).includes(opt) ? 'bg-pink-500 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>{opt}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default JewelryFilters;
