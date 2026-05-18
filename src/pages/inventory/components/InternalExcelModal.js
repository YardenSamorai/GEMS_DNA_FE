import React, { useEffect, useMemo, useState } from "react";

/* Internal Excel export modal — pick which columns to include, **per type**.
 *
 * Internal-use only: no branding, no images, no presets.
 *
 * Three column registries (Diamond / Gemstones / Jewelry) with their own
 * groups + persisted selection. The user can flip between tabs while
 * preparing an export — selections are kept independently so a mixed
 * selection of 4 diamonds + 3 emeralds + 2 jewelry items each get their
 * own appropriate column set in their own sheet.
 */

const STORAGE_KEY = "inventory.internalExcel.byType.v1";

/* =========================================================================
 *  Column registries
 * ========================================================================= */

// Shared column descriptor: { key, header, width }
//
// All keys must be unique across types — the sheet renderer looks them up
// in a single switch.

const DIAMOND_GROUPS = [
  {
    id: "id",
    label: "ID & basic",
    columns: [
      { key: "num", header: "#", width: 5 },
      { key: "sku", header: "SKU", width: 18 },
      { key: "pairSku", header: "Pair SKU", width: 18 },
      { key: "shape", header: "Shape", width: 12 },
      { key: "category", header: "Category", width: 14 },
      { key: "type", header: "Type", width: 14 },
    ],
  },
  {
    id: "fourCs",
    label: "4Cs",
    columns: [
      { key: "weight", header: "Weight (ct)", width: 12 },
      { key: "color", header: "Color", width: 8 },
      { key: "clarity", header: "Clarity", width: 10 },
      { key: "lab", header: "Lab", width: 10 },
    ],
  },
  {
    id: "cut",
    label: "Cut",
    columns: [
      { key: "cut", header: "Cut", width: 10 },
      { key: "polish", header: "Polish", width: 10 },
      { key: "symmetry", header: "Symmetry", width: 10 },
      { key: "tablePercent", header: "Table %", width: 10 },
      { key: "depthPercent", header: "Depth %", width: 10 },
      { key: "ratio", header: "Ratio", width: 8 },
      { key: "measurements", header: "Measurements", width: 20 },
      { key: "fluorescence", header: "Fluor.", width: 10 },
    ],
  },
  {
    id: "fancy",
    label: "Fancy color",
    columns: [
      { key: "fancyIntensity", header: "Intensity", width: 14 },
      { key: "fancyColor", header: "Fancy color", width: 16 },
      { key: "fancyOvertone", header: "Overtone", width: 14 },
      { key: "fancyColor2", header: "Fancy color 2", width: 16 },
      { key: "fancyOvertone2", header: "Overtone 2", width: 14 },
    ],
  },
  {
    id: "pricing",
    label: "Pricing",
    columns: [
      { key: "pricePerCt", header: "Price / ct ($)", width: 14 },
      { key: "priceTotal", header: "Total ($)", width: 14 },
      { key: "rapPrice", header: "Rap %", width: 10 },
      { key: "rapListPrice", header: "Rap list ($)", width: 14 },
    ],
  },
  {
    id: "location",
    label: "📍 Location",
    columns: [
      { key: "branch", header: "Branch", width: 14 },
      { key: "exactLocation", header: "Exact location", width: 18 },
      { key: "box", header: "Box", width: 12 },
      { key: "groupingType", header: "Grouping", width: 12 },
      { key: "stonesCount", header: "Stones in parcel", width: 14 },
    ],
  },
  {
    id: "cert",
    label: "Certificate",
    columns: [
      { key: "certificateNumber", header: "Cert #", width: 16 },
      { key: "certComments", header: "Cert comments", width: 24 },
      { key: "certificate", header: "Cert URL", width: 28 },
      { key: "certificateImageJpg", header: "Cert JPG URL", width: 28 },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    columns: [
      { key: "homePage", header: "Home page", width: 12 },
      { key: "tradeShow", header: "Trade show", width: 16 },
    ],
  },
  {
    id: "links",
    label: "Links",
    columns: [
      { key: "dna", header: "DNA Link", width: 22 },
      { key: "image", header: "Image URL", width: 28 },
      { key: "additionalPictures", header: "Additional pics", width: 28 },
      { key: "video", header: "Video URL", width: 28 },
      { key: "updatedAt", header: "Last sync", width: 18 },
    ],
  },
];

const DIAMOND_DEFAULTS = [
  "num", "sku", "shape", "weight", "color", "clarity", "lab",
  "cut", "polish", "symmetry", "fluorescence", "measurements",
  "pricePerCt", "priceTotal", "rapPrice",
  "branch", "exactLocation", "box",
  "certificateNumber", "dna",
];

const GEM_GROUPS = [
  {
    id: "id",
    label: "ID & basic",
    columns: [
      { key: "num", header: "#", width: 5 },
      { key: "sku", header: "SKU", width: 18 },
      { key: "pairSku", header: "Pair SKU", width: 18 },
      { key: "shape", header: "Shape", width: 12 },
      { key: "category", header: "Category", width: 14 },
      { key: "type", header: "Type", width: 14 },
    ],
  },
  {
    id: "quality",
    label: "Quality",
    columns: [
      { key: "weight", header: "Weight (ct)", width: 12 },
      { key: "color", header: "Color", width: 14 },
      { key: "clarity", header: "Clarity", width: 12 },
      { key: "measurements", header: "Measurements", width: 20 },
      { key: "ratio", header: "Ratio", width: 8 },
    ],
  },
  {
    id: "treatmentOrigin",
    label: "⭐ Treatment & Origin",
    columns: [
      { key: "origin", header: "Origin", width: 14 },
      { key: "treatment", header: "Treatment", width: 22 },
      { key: "lab", header: "Lab", width: 10 },
      { key: "certificateNumber", header: "Cert #", width: 16 },
      { key: "certComments", header: "Cert comments", width: 24 },
    ],
  },
  {
    id: "pricing",
    label: "Pricing",
    columns: [
      { key: "pricePerCt", header: "Price / ct ($)", width: 14 },
      { key: "priceTotal", header: "Total ($)", width: 14 },
    ],
  },
  {
    id: "location",
    label: "📍 Location",
    columns: [
      { key: "branch", header: "Branch", width: 14 },
      { key: "exactLocation", header: "Exact location", width: 18 },
      { key: "box", header: "Box", width: 12 },
      { key: "groupingType", header: "Grouping", width: 12 },
      { key: "stonesCount", header: "Stones in parcel", width: 14 },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    columns: [
      { key: "homePage", header: "Home page", width: 12 },
      { key: "tradeShow", header: "Trade show", width: 16 },
    ],
  },
  {
    id: "links",
    label: "Links",
    columns: [
      { key: "dna", header: "DNA Link", width: 22 },
      { key: "certificate", header: "Cert URL", width: 28 },
      { key: "image", header: "Image URL", width: 28 },
      { key: "additionalPictures", header: "Additional pics", width: 28 },
      { key: "video", header: "Video URL", width: 28 },
      { key: "updatedAt", header: "Last sync", width: 18 },
    ],
  },
];

const GEM_DEFAULTS = [
  "num", "sku", "shape", "weight", "color", "clarity",
  "measurements", "ratio",
  "origin", "treatment", "lab", "certificateNumber",
  "pricePerCt", "priceTotal",
  "branch", "exactLocation", "box", "dna",
];

const JEWELRY_GROUPS = [
  {
    id: "id",
    label: "ID",
    columns: [
      { key: "num", header: "#", width: 5 },
      { key: "sku", header: "Model #", width: 18 },
      { key: "stockNumber", header: "Stock #", width: 14 },
      { key: "title", header: "Title", width: 26 },
      { key: "jewelryType", header: "Jewelry type", width: 14 },
      { key: "category", header: "Category", width: 14 },
      { key: "style", header: "Style", width: 14 },
      { key: "collection", header: "Collection", width: 18 },
    ],
  },
  {
    id: "specs",
    label: "Specs",
    columns: [
      { key: "metalType", header: "Metal", width: 12 },
      { key: "jewelryWeight", header: "Weight (g)", width: 12 },
      { key: "jewelrySize", header: "Size", width: 10 },
      { key: "totalCarat", header: "Total carat", width: 12 },
      { key: "stoneType", header: "Stone type", width: 14 },
      { key: "description", header: "Description", width: 30 },
    ],
  },
  {
    id: "centerStone",
    label: "Center stone",
    columns: [
      { key: "centerStoneCarat", header: "Center ct", width: 12 },
      { key: "shape", header: "Center shape", width: 12 },
      { key: "color", header: "Center color", width: 12 },
      { key: "clarity", header: "Center clarity", width: 12 },
    ],
  },
  {
    id: "pricing",
    label: "Pricing",
    columns: [
      { key: "priceTotal", header: "Price ($)", width: 14 },
      { key: "currency", header: "Currency", width: 10 },
    ],
  },
  {
    id: "logistics",
    label: "Logistics",
    columns: [
      { key: "availability", header: "Availability", width: 14 },
      { key: "shippingFrom", header: "Shipping from", width: 16 },
    ],
  },
  {
    id: "links",
    label: "Links",
    columns: [
      { key: "dna", header: "DNA Link", width: 22 },
      { key: "image", header: "Image URL", width: 28 },
      { key: "video", header: "Video URL", width: 28 },
      { key: "certificate", header: "Cert URL", width: 28 },
      { key: "certificateNumber", header: "Cert #", width: 16 },
    ],
  },
];

const JEWELRY_DEFAULTS = [
  "num", "sku", "stockNumber", "title", "jewelryType", "category",
  "metalType", "jewelryWeight", "jewelrySize", "totalCarat", "stoneType",
  "centerStoneCarat", "shape", "color", "clarity",
  "priceTotal", "currency",
  "availability", "shippingFrom",
  "dna",
];

/* =========================================================================
 *  Type registry — exported so the exporter can look up groups + headers.
 * ========================================================================= */

export const INTERNAL_TYPE_REGISTRY = {
  diamond: {
    id: "diamond",
    label: "💎 Diamond",
    sheetName: "Diamonds",
    groups: DIAMOND_GROUPS,
    defaults: DIAMOND_DEFAULTS,
    description: "Diamonds & fancy colored diamonds",
  },
  gemstone: {
    id: "gemstone",
    label: "🟢 Gemstones",
    sheetName: "Gemstones",
    groups: GEM_GROUPS,
    defaults: GEM_DEFAULTS,
    description: "Emeralds, rubies, sapphires & other colored stones",
  },
  jewelry: {
    id: "jewelry",
    label: "💍 Jewelry",
    sheetName: "Jewelry",
    groups: JEWELRY_GROUPS,
    defaults: JEWELRY_DEFAULTS,
    description: "Catalog jewelry (rings, bracelets, necklaces…)",
  },
};

const TYPE_ORDER = ["diamond", "gemstone", "jewelry"];

const allKeysFor = (typeId) =>
  INTERNAL_TYPE_REGISTRY[typeId].groups.flatMap((g) => g.columns.map((c) => c.key));

const allColumnsFor = (typeId) =>
  INTERNAL_TYPE_REGISTRY[typeId].groups.flatMap((g) => g.columns);

/* =========================================================================
 *  Persistence
 * ========================================================================= */

const loadSavedSelections = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        diamond: new Set(INTERNAL_TYPE_REGISTRY.diamond.defaults),
        gemstone: new Set(INTERNAL_TYPE_REGISTRY.gemstone.defaults),
        jewelry: new Set(INTERNAL_TYPE_REGISTRY.jewelry.defaults),
      };
    }
    const parsed = JSON.parse(raw) || {};
    const out = {};
    for (const id of TYPE_ORDER) {
      const valid = new Set(allKeysFor(id));
      const stored = Array.isArray(parsed[id]) ? parsed[id] : null;
      const filtered = stored?.filter((k) => valid.has(k)) || [];
      out[id] = new Set(filtered.length ? filtered : INTERNAL_TYPE_REGISTRY[id].defaults);
    }
    return out;
  } catch (_) {
    return {
      diamond: new Set(INTERNAL_TYPE_REGISTRY.diamond.defaults),
      gemstone: new Set(INTERNAL_TYPE_REGISTRY.gemstone.defaults),
      jewelry: new Set(INTERNAL_TYPE_REGISTRY.jewelry.defaults),
    };
  }
};

const saveSelections = (selections) => {
  try {
    const serial = {};
    for (const id of TYPE_ORDER) {
      serial[id] = Array.from(selections[id] || []);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serial));
  } catch (_) {
    /* ignore quota errors */
  }
};

/* =========================================================================
 *  Component
 * ========================================================================= */

const InternalExcelModal = ({
  isOpen,
  onClose,
  // Counts per category from the parent so we can hide empty tabs and show
  // contextual "X items" badges.
  counts = { diamond: 0, gemstone: 0, jewelry: 0 },
  onExport,
}) => {
  const [activeType, setActiveType] = useState("diamond");
  const [selections, setSelections] = useState(() => loadSavedSelections());
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelections(loadSavedSelections());
      setExporting(false);
      // Auto-pick the first non-empty tab so the user lands on something useful
      const firstWithData = TYPE_ORDER.find((id) => (counts[id] || 0) > 0);
      if (firstWithData) setActiveType(firstWithData);
    }
    // counts are stable enough — we only re-pick the tab when modal opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const activeRegistry = INTERNAL_TYPE_REGISTRY[activeType];
  const activeKeys = selections[activeType];
  const allKeysActive = useMemo(() => allKeysFor(activeType), [activeType]);

  if (!isOpen) return null;

  const setActiveSelection = (next) => {
    setSelections((prev) => ({ ...prev, [activeType]: next }));
  };

  const toggle = (key) => {
    const next = new Set(activeKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setActiveSelection(next);
  };

  const toggleGroup = (group) => {
    const groupKeys = group.columns.map((c) => c.key);
    const allOn = groupKeys.every((k) => activeKeys.has(k));
    const next = new Set(activeKeys);
    groupKeys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
    setActiveSelection(next);
  };

  const selectAll = () => setActiveSelection(new Set(allKeysActive));
  const clearAll = () => setActiveSelection(new Set());
  const resetDefault = () => setActiveSelection(new Set(activeRegistry.defaults));

  const totalSelected = TYPE_ORDER.reduce(
    (acc, id) => acc + ((counts[id] || 0) > 0 && selections[id].size > 0 ? counts[id] : 0),
    0,
  );

  const handleExport = async () => {
    // Build the per-type payload: only include types that have both data and chosen columns.
    const payload = {};
    for (const id of TYPE_ORDER) {
      const itemCount = counts[id] || 0;
      const keys = selections[id];
      if (itemCount > 0 && keys.size > 0) {
        const columns = allColumnsFor(id).filter((c) => keys.has(c.key));
        payload[id] = {
          sheetName: INTERNAL_TYPE_REGISTRY[id].sheetName,
          columns,
        };
      }
    }
    if (!Object.keys(payload).length) return;

    setExporting(true);
    try {
      saveSelections(selections);
      await onExport(payload);
      onClose();
    } catch (e) {
      console.error("Internal Excel export failed:", e);
      alert(e?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const activeSelectionSize = activeKeys.size;
  const activeCount = counts[activeType] || 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-4xl max-h-[92vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-stone-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">Internal Excel export</h2>
            <p className="mt-1 text-sm text-stone-500">
              Pick columns per category. Each type gets its own sheet — selections are saved per type.
              {totalSelected > 0 && (
                <> · <span className="font-medium text-stone-700">{totalSelected}</span> items will be exported</>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            title="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Type tabs */}
        <div className="flex items-stretch gap-1 border-b border-stone-200 bg-stone-50 px-4 pt-3">
          {TYPE_ORDER.map((id) => {
            const reg = INTERNAL_TYPE_REGISTRY[id];
            const itemCount = counts[id] || 0;
            const selectedCount = selections[id].size;
            const isActive = activeType === id;
            const disabled = itemCount === 0;
            return (
              <button
                key={id}
                onClick={() => !disabled && setActiveType(id)}
                disabled={disabled}
                className={`relative flex flex-col items-start gap-0.5 rounded-t-lg border px-4 py-2 text-left transition ${
                  isActive
                    ? "border-stone-200 border-b-white bg-white text-stone-900 shadow-sm"
                    : disabled
                      ? "cursor-not-allowed border-transparent text-stone-300"
                      : "border-transparent text-stone-600 hover:bg-white/60 hover:text-stone-900"
                }`}
              >
                <span className="text-sm font-semibold">{reg.label}</span>
                <span className="text-xs">
                  <span className={`font-medium ${disabled ? "text-stone-300" : "text-stone-500"}`}>
                    {itemCount} item{itemCount === 1 ? "" : "s"}
                  </span>
                  {!disabled && selectedCount > 0 && (
                    <> · <span className="text-emerald-600">{selectedCount} cols</span></>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active-type description + bulk actions */}
        <div className="flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-6 py-2.5">
          <p className="text-xs text-stone-500">{activeRegistry.description}</p>
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={selectAll}
              className="rounded-md border border-stone-200 bg-white px-2.5 py-1 font-medium text-stone-700 hover:bg-stone-100"
            >
              Select all
            </button>
            <button
              onClick={clearAll}
              className="rounded-md border border-stone-200 bg-white px-2.5 py-1 font-medium text-stone-700 hover:bg-stone-100"
            >
              Clear
            </button>
            <button
              onClick={resetDefault}
              className="rounded-md border border-stone-200 bg-white px-2.5 py-1 font-medium text-stone-700 hover:bg-stone-100"
            >
              Reset default
            </button>
            <span className="ml-2 text-stone-500">
              <span className="font-medium text-stone-800">{activeSelectionSize}</span> / {allKeysActive.length}
            </span>
          </div>
        </div>

        {/* Groups grid */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {activeCount === 0 ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center text-sm text-stone-500">
              <p>No {activeRegistry.label} items in your current selection.</p>
              <p className="mt-1 text-xs">Pick a different category above, or change your inventory selection.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeRegistry.groups.map((group) => {
                const groupKeys = group.columns.map((c) => c.key);
                const onCount = groupKeys.filter((k) => activeKeys.has(k)).length;
                const allOn = onCount === groupKeys.length;
                const someOn = onCount > 0 && !allOn;
                return (
                  <div
                    key={group.id}
                    className="rounded-xl glass-surface"
                  >
                    <div className="flex items-center justify-between border-b border-stone-100 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleGroup(group)}
                          className={`flex h-4 w-4 items-center justify-center rounded border transition ${
                            allOn
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : someOn
                                ? "border-emerald-400 bg-emerald-100 text-emerald-700"
                                : "border-stone-300 bg-white text-transparent"
                          }`}
                          title={allOn ? "Deselect all in group" : "Select all in group"}
                        >
                          {(allOn || someOn) && (
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                          {group.label}
                        </span>
                      </div>
                      <span className="text-xs text-stone-400">{onCount}/{groupKeys.length}</span>
                    </div>
                    <div className="divide-y divide-stone-50">
                      {group.columns.map((col) => {
                        const checked = activeKeys.has(col.key);
                        return (
                          <label
                            key={col.key}
                            className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition ${
                              checked ? "bg-emerald-50/50 text-stone-900" : "text-stone-700 hover:bg-stone-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(col.key)}
                              className="h-3.5 w-3.5 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="flex-1">{col.header}</span>
                            <span className="text-xs text-stone-400">{col.key}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer summary */}
        <div className="flex items-center justify-between gap-3 border-t border-stone-200 bg-stone-50 px-6 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
            {TYPE_ORDER.map((id) => {
              const reg = INTERNAL_TYPE_REGISTRY[id];
              const itemCount = counts[id] || 0;
              const colCount = selections[id].size;
              if (itemCount === 0) return null;
              const willExport = colCount > 0;
              return (
                <span
                  key={id}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
                    willExport
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-stone-200 text-stone-500"
                  }`}
                  title={willExport ? "Will be exported" : "No columns selected — sheet will be skipped"}
                >
                  <span className="font-semibold">{reg.label}</span>
                  <span className="opacity-80">{itemCount} × {colCount}c</span>
                </span>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={exporting}
              className="rounded-lg px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || totalSelected === 0}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? "Exporting…" : `Export ${totalSelected} items`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InternalExcelModal;
