import React, { useEffect, useMemo, useState } from "react";

/* Internal Excel export modal — pick which columns to include.
 *
 * The customer-facing exports use fixed column sets per category to keep the
 * brochure look consistent. This one is purely for internal use: just the
 * data, no branding, no logo, only the columns the user ticks. The selection
 * is persisted in localStorage so the next export starts from the same set.
 */

const STORAGE_KEY = "inventory.internalExcel.columns.v1";

// Master list of columns we know how to render in the export. Grouped so the
// modal UI can show a logical sectioned picker. Keys MUST match the cases in
// the exporter's switch statement.
export const INTERNAL_COLUMN_GROUPS = [
  {
    id: "id",
    label: "Identification",
    columns: [
      { key: "num", header: "#", width: 5 },
      { key: "sku", header: "SKU", width: 18 },
      { key: "pairSku", header: "Pair SKU", width: 18 },
      { key: "shape", header: "Shape", width: 12 },
      { key: "category", header: "Category", width: 14 },
    ],
  },
  {
    id: "quality",
    label: "Quality — Basic",
    columns: [
      { key: "weight", header: "Weight (ct)", width: 12 },
      { key: "color", header: "Color", width: 8 },
      { key: "clarity", header: "Clarity", width: 12 },
      { key: "measurements", header: "Measurements", width: 20 },
      { key: "ratio", header: "Ratio", width: 8 },
    ],
  },
  {
    id: "fancy",
    label: "Fancy color",
    columns: [
      { key: "fancyIntensity", header: "Intensity", width: 12 },
      { key: "fancyColor", header: "Fancy color", width: 14 },
      { key: "fancyOvertone", header: "Overtone", width: 12 },
      { key: "fancyColor2", header: "Fancy color 2", width: 14 },
      { key: "fancyOvertone2", header: "Overtone 2", width: 12 },
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
    ],
  },
  {
    id: "other",
    label: "Other quality",
    columns: [
      { key: "treatment", header: "Treatment", width: 18 },
      { key: "origin", header: "Origin", width: 12 },
      { key: "lab", header: "Lab", width: 10 },
      { key: "fluorescence", header: "Fluor.", width: 10 },
    ],
  },
  {
    id: "pricing",
    label: "Pricing",
    columns: [
      { key: "pricePerCt", header: "Price/ct ($)", width: 14 },
      { key: "priceTotal", header: "Total ($)", width: 14 },
      { key: "rapPrice", header: "Rap %", width: 10 },
    ],
  },
  {
    id: "internal",
    label: "Internal / Inventory",
    columns: [
      { key: "location", header: "Location", width: 14 },
      { key: "dna", header: "DNA Link", width: 22 },
      { key: "certificate", header: "Certificate URL", width: 28 },
      { key: "image", header: "Image URL", width: 28 },
      { key: "video", header: "Video URL", width: 28 },
    ],
  },
];

// Sensible default so first-time users get a useful sheet even before they tick anything
const DEFAULT_KEYS = [
  "num", "sku", "shape", "weight", "color", "clarity",
  "measurements", "treatment", "origin", "lab",
  "pricePerCt", "priceTotal", "location", "dna",
];

const ALL_COLUMNS = INTERNAL_COLUMN_GROUPS.flatMap((g) => g.columns);
const ALL_KEYS = ALL_COLUMNS.map((c) => c.key);

const loadSavedKeys = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_KEYS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return DEFAULT_KEYS;
    // Drop any stale keys that no longer exist in the column registry
    const filtered = parsed.filter((k) => ALL_KEYS.includes(k));
    return filtered.length ? filtered : DEFAULT_KEYS;
  } catch (_) {
    return DEFAULT_KEYS;
  }
};

const InternalExcelModal = ({ isOpen, onClose, selectedCount, onExport }) => {
  const [selectedKeys, setSelectedKeys] = useState(() => new Set(loadSavedKeys()));
  const [exporting, setExporting] = useState(false);

  // Re-sync from storage every time the modal opens, so a "Reset to default"
  // in another session is reflected here too.
  useEffect(() => {
    if (isOpen) {
      setSelectedKeys(new Set(loadSavedKeys()));
      setExporting(false);
    }
  }, [isOpen]);

  const orderedSelected = useMemo(
    () => ALL_COLUMNS.filter((c) => selectedKeys.has(c.key)),
    [selectedKeys]
  );

  if (!isOpen) return null;

  const toggle = (key) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleGroup = (group) => {
    const groupKeys = group.columns.map((c) => c.key);
    const allOn = groupKeys.every((k) => selectedKeys.has(k));
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      groupKeys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
      return next;
    });
  };

  const selectAll = () => setSelectedKeys(new Set(ALL_KEYS));
  const clearAll = () => setSelectedKeys(new Set());
  const resetDefault = () => setSelectedKeys(new Set(DEFAULT_KEYS));

  const handleExport = async () => {
    if (!orderedSelected.length) return;
    setExporting(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orderedSelected.map((c) => c.key)));
      await onExport(orderedSelected);
      onClose();
    } catch (e) {
      console.error("Internal Excel export failed:", e);
      alert(e?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-3xl max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-stone-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">Internal Excel export</h2>
            <p className="mt-1 text-sm text-stone-500">
              Pick the columns you need. No logo, no branding — pure data for internal use.
              {selectedCount != null && (
                <> · <span className="font-medium text-stone-700">{selectedCount}</span> stones selected</>
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

        <div className="flex items-center gap-2 border-b border-stone-200 bg-stone-50 px-6 py-2.5 text-xs">
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
            Reset to default
          </button>
          <span className="ml-auto text-stone-500">
            <span className="font-medium text-stone-800">{selectedKeys.size}</span> / {ALL_KEYS.length} columns
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {INTERNAL_COLUMN_GROUPS.map((group) => {
              const groupKeys = group.columns.map((c) => c.key);
              const onCount = groupKeys.filter((k) => selectedKeys.has(k)).length;
              const allOn = onCount === groupKeys.length;
              const someOn = onCount > 0 && !allOn;
              return (
                <div
                  key={group.id}
                  className="rounded-xl border border-stone-200 bg-white"
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
                      const checked = selectedKeys.has(col.key);
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
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-stone-200 bg-stone-50 px-6 py-3">
          <p className="text-xs text-stone-500">
            Your column selection is remembered for next time.
          </p>
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
              disabled={exporting || !orderedSelected.length}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? "Exporting…" : `Export ${orderedSelected.length} columns`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InternalExcelModal;
