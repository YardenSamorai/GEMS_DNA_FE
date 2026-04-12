import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ShapeFilter from "./ShapeFilter";
import MultiSelect from "./MultiSelect";
import { treatmentOptions, locationOptions } from "../helpers/constants";

const StoneFilters = ({ filters, onChange, shapesOptions, categoriesOptions, diamondColorOptions, fancyColorOptions, tags, onManageTags, inventoryMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const handleChange = (field) => (e) => {
    onChange({ ...filters, [field]: e.target.value });
  };

  const handleClear = () => {
    onChange({
      sku: "",
      minPrice: "",
      maxPrice: "",
      minPricePerCt: "",
      maxPricePerCt: "",
      minCarat: "",
      maxCarat: "",
      minLength: "",
      maxLength: "",
      minWidth: "",
      maxWidth: "",
      shape: [],
      treatment: [],
      category: [],
      tag: [],
      location: [],
      groupingType: [],
      diamondColor: [],
      fancyColor: [],
      box: "",
    });
  };

  const activeFiltersCount = [
    filters.sku,
    filters.minPrice,
    filters.maxPrice,
    filters.minPricePerCt,
    filters.maxPricePerCt,
    filters.minCarat,
    filters.maxCarat,
    filters.minLength,
    filters.maxLength,
    filters.minWidth,
    filters.maxWidth,
    filters.shape.length > 0,
    filters.treatment.length > 0,
    filters.category.length > 0,
    filters.tag.length > 0,
    filters.location.length > 0,
    filters.groupingType.length > 0,
    filters.diamondColor.length > 0,
    filters.fancyColor.length > 0,
    filters.box,
  ].filter(Boolean).length;

  return (
    <div className="rounded-lg border border-border bg-card p-4 mb-4">
      {/* Clickable Header */}
      <div 
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
            <svg className="w-4 h-4 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-medium text-foreground">Filters</h2>
            {activeFiltersCount > 0 && (
              <p className="text-xs text-muted-foreground">{activeFiltersCount} active</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOpen && activeFiltersCount > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); handleClear(); }}
              className="text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors"
            >
              Clear all
            </button>
          )}
          <div className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${isOpen ? 'bg-muted rotate-180' : 'bg-transparent'}`}>
            <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>
      
      {/* Collapsible Content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-5 space-y-5">

              {/* Row 1: SKU + Price */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-stone-500 mb-1.5">
                    Search by SKU
                    <span className="text-stone-400 font-normal ml-1">(comma / line separated)</span>
                  </label>
                  <textarea
                    value={filters.sku}
                    onChange={handleChange("sku")}
                    placeholder="e.g. T9548, T9549, T9550"
                    className="input-modern min-h-[38px] resize-y"
                    rows={1}
                  />
                  {(filters.sku?.includes(',') || filters.sku?.includes('\n')) && (
                    <p className="text-[10px] text-emerald-600 mt-0.5">
                      Searching {filters.sku.split(/[,\n]/).filter(s => s.trim()).length} SKUs
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1.5">Min Price ($)</label>
                  <input type="number" value={filters.minPrice} onChange={handleChange("minPrice")} placeholder="From" className="input-modern" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1.5">Max Price ($)</label>
                  <input type="number" value={filters.maxPrice} onChange={handleChange("maxPrice")} placeholder="To" className="input-modern" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1.5">Min PPC ($)</label>
                  <input type="number" value={filters.minPricePerCt} onChange={handleChange("minPricePerCt")} placeholder="From" className="input-modern" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1.5">Max PPC ($)</label>
                  <input type="number" value={filters.maxPricePerCt} onChange={handleChange("maxPricePerCt")} placeholder="To" className="input-modern" />
                </div>
              </div>

              {/* Row 2: Shape */}
              <ShapeFilter shapes={shapesOptions} activeShapes={filters.shape} onToggle={(shapes) => onChange({ ...filters, shape: shapes })} />

              {/* Row 3: Carat + Measurements */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1.5">Min Carat</label>
                  <input type="number" value={filters.minCarat} onChange={handleChange("minCarat")} placeholder="From" step="0.01" className="input-modern" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1.5">Max Carat</label>
                  <input type="number" value={filters.maxCarat} onChange={handleChange("maxCarat")} placeholder="To" step="0.01" className="input-modern" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1.5">Length Min</label>
                  <input type="number" value={filters.minLength} onChange={handleChange("minLength")} placeholder="mm" step="0.01" className="input-modern" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1.5">Length Max</label>
                  <input type="number" value={filters.maxLength} onChange={handleChange("maxLength")} placeholder="mm" step="0.01" className="input-modern" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1.5">Width Min</label>
                  <input type="number" value={filters.minWidth} onChange={handleChange("minWidth")} placeholder="mm" step="0.01" className="input-modern" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1.5">Width Max</label>
                  <input type="number" value={filters.maxWidth} onChange={handleChange("maxWidth")} placeholder="mm" step="0.01" className="input-modern" />
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-stone-200/60" />

              {/* Row 4: Dropdowns */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {inventoryMode === 'gemstones' && (
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1.5">Category</label>
                    <MultiSelect
                      value={filters.category}
                      options={categoriesOptions.filter(c => c !== 'All categories')}
                      onChange={(val) => onChange({ ...filters, category: val })}
                      placeholder="All categories"
                    />
                  </div>
                )}
                {inventoryMode === 'gemstones' && (
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1.5">Clarity</label>
                    <MultiSelect
                      value={filters.treatment}
                      options={treatmentOptions.filter(t => t !== 'All treatments')}
                      onChange={(val) => onChange({ ...filters, treatment: val })}
                      placeholder="All"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1.5">Location</label>
                  <MultiSelect
                    value={filters.location}
                    options={locationOptions.filter(l => l !== 'All locations')}
                    onChange={(val) => onChange({ ...filters, location: val })}
                    placeholder="All locations"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1.5">Grouping Type</label>
                  <MultiSelect
                    value={filters.groupingType}
                    options={["Single", "Pair", "Set", "Parcel", "Side Stones", "Melee", "Empty"]}
                    onChange={(val) => onChange({ ...filters, groupingType: val })}
                    placeholder="All types"
                  />
                </div>
                {inventoryMode === 'diamonds' && (
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1.5">Diamond Color</label>
                    <MultiSelect
                      value={filters.diamondColor}
                      options={diamondColorOptions.filter(c => c !== 'All colors')}
                      onChange={(val) => onChange({ ...filters, diamondColor: val })}
                      placeholder="All colors"
                    />
                  </div>
                )}
                {inventoryMode === 'diamonds' && (
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1.5">Fancy Color</label>
                    <MultiSelect
                      value={filters.fancyColor}
                      options={fancyColorOptions.filter(c => c !== 'All colors')}
                      onChange={(val) => onChange({ ...filters, fancyColor: val })}
                      placeholder="All colors"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1.5">Box</label>
                  <input type="text" value={filters.box} onChange={handleChange("box")} placeholder="Search box..." className="input-modern" />
                </div>
                <div className="col-span-2 sm:col-span-1 lg:col-span-2">
                  <label className="block text-xs font-medium text-stone-500 mb-1.5">Client Tag</label>
                  <div className="flex gap-2">
                    <MultiSelect
                      value={filters.tag}
                      options={tags.map(t => t.name)}
                      onChange={(val) => onChange({ ...filters, tag: val })}
                      placeholder="All tags"
                    />
                    <button
                      onClick={onManageTags}
                      className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl transition-colors"
                      title="Manage tags"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StoneFilters;
