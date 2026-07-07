import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";

/*
 * Pre-flight dialog for the "Catalog (Liran)" export.
 *
 * Lets the user (a) reorder the selected items with drag & drop — the PDF
 * grid follows this order — (b) type an optional "Website text" per item
 * which is printed in the PDF instead of the blank fill-in lines, and
 * (c) manually add items that aren't in the inventory (image upload +
 * SKU + jewelry type + website text).
 */

const JEWELRY_TYPES = ["Ring", "Bracelet", "Necklace", "Earrings", "Pendant", "Brooch", "Jewelry"];

// Re-encode an uploaded image to a JPEG data URL (max 1000px on the long
// side) so jsPDF gets a format it always supports, at a sane size.
const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const MAX = 1000;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      // White backdrop so transparent PNGs don't turn black in JPEG.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });

const RowItem = ({ row, onTextChange, onRemove }) => {
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
            {row.manual && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-teal-600 bg-teal-50 border border-teal-200 rounded px-1.5 py-0.5 shrink-0">
                Manual
              </span>
            )}
          </div>
          <input
            type="text"
            value={row.websiteText}
            onChange={(e) => onTextChange(row.id, e.target.value)}
            placeholder="Website text (optional — blank lines if empty)"
            className="mt-1 w-full text-sm px-2.5 py-1.5 rounded-lg border border-stone-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none placeholder:text-stone-300"
          />
        </div>

        <button
          type="button"
          onClick={() => onRemove(row.id)}
          className="shrink-0 p-1.5 rounded-lg text-stone-300 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Remove from catalog"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </Reorder.Item>
  );
};

/* Inline form for adding an item that isn't in the inventory. */
const AddItemForm = ({ onAdd, onCancel }) => {
  const [image, setImage] = useState(null);
  const [sku, setSku] = useState("");
  const [type, setType] = useState("Ring");
  const [text, setText] = useState("");
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImage(await fileToDataUrl(file));
    } catch (err) {
      console.error("Image load failed:", err);
      alert("Could not read this image file.");
    }
  };

  return (
    <div className="bg-teal-50/60 border border-teal-200 rounded-xl p-3 mb-3">
      <div className="flex items-start gap-3">
        {/* Image picker */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="shrink-0 w-16 h-16 rounded-lg border-2 border-dashed border-teal-300 bg-white hover:bg-teal-50 transition-colors overflow-hidden flex items-center justify-center"
          title="Upload image"
        >
          {image ? (
            <img src={image} alt="" className="w-full h-full object-contain" />
          ) : (
            <svg className="w-6 h-6 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M12 4v.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="SKU / Model"
              className="flex-1 min-w-0 text-sm px-2.5 py-1.5 rounded-lg border border-stone-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none"
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="text-sm px-2 py-1.5 rounded-lg border border-stone-200 bg-white focus:border-teal-400 outline-none"
            >
              {JEWELRY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Website text (optional)"
            className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-stone-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none placeholder:text-stone-300"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-100 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!sku.trim()}
          onClick={() => onAdd({ image, sku: sku.trim(), type, text: text.trim() })}
          className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50"
        >
          Add item
        </button>
      </div>
    </div>
  );
};

/* ---------------- Advanced multi-level sort ---------------- */

const SORT_FIELDS = [
  { id: "category", label: "Category" },
  { id: "collection", label: "Collection" },
  { id: "sku", label: "SKU / Model" },
  { id: "title", label: "Website text" },
];

const getSortValue = (row, field) => {
  const s = row.stone;
  switch (field) {
    case "category": return String(s.jewelryType || s.category || "").trim();
    case "collection": return String(s.collection || "").trim();
    case "sku": return String(s.sku || "").trim();
    case "title": return String(row.websiteText || s.title || "").trim();
    default: return "";
  }
};

// Fields whose distinct values the user can arrange by hand ("Necklace
// first, then Ring…"). SKU/title just sort alphabetically (numeric-aware).
const ORDERABLE_FIELDS = new Set(["category", "collection"]);

const AdvancedSortPanel = ({ rows, onApply, onClose }) => {
  const [levels, setLevels] = useState([]);

  const distinctValues = (field) => {
    const seen = new Map();
    rows.forEach((r) => {
      const v = getSortValue(r, field);
      const k = v.toLowerCase();
      if (!seen.has(k)) seen.set(k, v || "(empty)");
    });
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  };

  const addLevel = () => {
    const used = new Set(levels.map((l) => l.field));
    const nextField = SORT_FIELDS.find((f) => !used.has(f.id))?.id || "sku";
    setLevels((prev) => [...prev, {
      id: `lvl-${Date.now()}`,
      field: nextField,
      dir: "asc",
      valueOrder: ORDERABLE_FIELDS.has(nextField) ? distinctValues(nextField) : null,
    }]);
  };

  const changeField = (id, field) => {
    setLevels((prev) => prev.map((l) => (l.id === id ? {
      ...l,
      field,
      valueOrder: ORDERABLE_FIELDS.has(field) ? distinctValues(field) : null,
    } : l)));
  };

  const toggleDir = (id) => {
    setLevels((prev) => prev.map((l) => (l.id === id ? { ...l, dir: l.dir === "asc" ? "desc" : "asc" } : l)));
  };

  const moveLevel = (idx, delta) => {
    setLevels((prev) => {
      const next = [...prev];
      const to = idx + delta;
      if (to < 0 || to >= next.length) return prev;
      [next[idx], next[to]] = [next[to], next[idx]];
      return next;
    });
  };

  const removeLevel = (id) => setLevels((prev) => prev.filter((l) => l.id !== id));

  const moveValue = (levelId, idx, delta) => {
    setLevels((prev) => prev.map((l) => {
      if (l.id !== levelId || !l.valueOrder) return l;
      const to = idx + delta;
      if (to < 0 || to >= l.valueOrder.length) return l;
      const order = [...l.valueOrder];
      [order[idx], order[to]] = [order[to], order[idx]];
      return { ...l, valueOrder: order };
    }));
  };

  const apply = () => {
    if (levels.length === 0) return;
    onApply((prev) => [...prev].sort((a, b) => {
      for (const lvl of levels) {
        const va = getSortValue(a, lvl.field) || "(empty)";
        const vb = getSortValue(b, lvl.field) || "(empty)";
        let c = 0;
        if (lvl.valueOrder) {
          const findIdx = (v) => {
            const i = lvl.valueOrder.findIndex((o) => o.toLowerCase() === v.toLowerCase());
            return i === -1 ? Number.MAX_SAFE_INTEGER : i;
          };
          c = findIdx(va) - findIdx(vb);
        } else {
          if (va.toLowerCase() !== vb.toLowerCase()) {
            if (va === "(empty)") c = 1;
            else if (vb === "(empty)") c = -1;
            else c = va.localeCompare(vb, undefined, { numeric: true });
          }
        }
        if (c !== 0) return lvl.dir === "desc" ? -c : c;
      }
      return 0;
    }));
    onClose();
  };

  return (
    <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-stone-800">Advanced sort</h3>
        <span className="text-[11px] text-stone-500">Level 1 wins, ties fall to the next level</span>
      </div>

      {levels.length === 0 && (
        <p className="text-xs text-stone-500 mb-2">Add a sort level to get started.</p>
      )}

      <div className="space-y-2">
        {levels.map((lvl, idx) => (
          <div key={lvl.id} className="bg-white rounded-lg border border-stone-200 p-2.5">
            <div className="flex items-center gap-2">
              <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center">
                {idx + 1}
              </span>
              <select
                value={lvl.field}
                onChange={(e) => changeField(lvl.id, e.target.value)}
                className="flex-1 min-w-0 text-sm px-2 py-1.5 rounded-lg border border-stone-200 bg-white focus:border-indigo-400 outline-none"
              >
                {SORT_FIELDS.map((f) => (
                  <option key={f.id} value={f.id} disabled={levels.some((l) => l.id !== lvl.id && l.field === f.id)}>
                    {f.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => toggleDir(lvl.id)}
                className="shrink-0 px-2 py-1.5 rounded-lg text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors"
                title="Toggle direction"
              >
                {lvl.dir === "asc" ? "A \u2192 Z" : "Z \u2192 A"}
              </button>
              <div className="shrink-0 flex flex-col">
                <button type="button" onClick={() => moveLevel(idx, -1)} disabled={idx === 0} className="text-stone-400 hover:text-stone-700 disabled:opacity-30 leading-none" title="Move level up">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
                </button>
                <button type="button" onClick={() => moveLevel(idx, 1)} disabled={idx === levels.length - 1} className="text-stone-400 hover:text-stone-700 disabled:opacity-30 leading-none" title="Move level down">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>
              <button type="button" onClick={() => removeLevel(lvl.id)} className="shrink-0 p-1 rounded text-stone-300 hover:text-red-500 transition-colors" title="Remove level">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Custom value order for category / collection levels */}
            {lvl.valueOrder && (
              <div className="mt-2 pl-7 space-y-1">
                {lvl.valueOrder.map((val, vIdx) => (
                  <div key={val} className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-md px-2 py-1">
                    <span className="text-[11px] font-semibold text-indigo-600 w-4 text-center">{vIdx + 1}</span>
                    <span className="flex-1 text-xs text-stone-700 truncate">{val}</span>
                    <button type="button" onClick={() => moveValue(lvl.id, vIdx, -1)} disabled={vIdx === 0} className="text-stone-400 hover:text-stone-700 disabled:opacity-30" title="Move up">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button type="button" onClick={() => moveValue(lvl.id, vIdx, 1)} disabled={vIdx === lvl.valueOrder.length - 1} className="text-stone-400 hover:text-stone-700 disabled:opacity-30" title="Move down">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-3">
        <button
          type="button"
          onClick={addLevel}
          disabled={levels.length >= SORT_FIELDS.length}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-40"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add level
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-stone-500 hover:bg-stone-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={levels.length === 0}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Apply sort
          </button>
        </div>
      </div>
    </div>
  );
};

const CatalogLiranModal = ({ isOpen, stones, onClose, onGenerate, isGenerating }) => {
  const [rows, setRows] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAdvancedSort, setShowAdvancedSort] = useState(false);
  const [orientation, setOrientation] = useState("portrait");

  // Re-seed rows whenever the dialog opens with a fresh selection.
  // Website text starts as the item's title (site title for catalog jewelry,
  // a built-up one for stones) and stays fully editable.
  useEffect(() => {
    if (isOpen) {
      const defaultTitle = (stone) => {
        if (stone.title) return stone.title;
        if (stone.category === "Jewelry") return "";
        return [stone.weightCt ? `${stone.weightCt}ct` : null, stone.shape, stone.category]
          .filter(Boolean)
          .join(" ");
      };
      setRows((stones || []).map((stone) => ({ id: stone.id, stone, websiteText: defaultTitle(stone) })));
      setShowAddForm(false);
      setShowAdvancedSort(false);
    }
  }, [isOpen, stones]);

  const handleTextChange = (id, text) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, websiteText: text } : r)));
  };

  const handleRemove = (id) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Fisher-Yates shuffle for a random catalog order.
  const handleShuffle = () => {
    setRows((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });
  };

  const rowKey = (r, field) => String(r.stone[field] || "").trim().toLowerCase();

  // Group by collection (items without one sink to the end), then by
  // jewelry type, then by SKU.
  const handleSortByCollection = () => {
    setRows((prev) => [...prev].sort((a, b) => {
      const colA = rowKey(a, "collection");
      const colB = rowKey(b, "collection");
      if (colA !== colB) {
        if (!colA) return 1;
        if (!colB) return -1;
        return colA.localeCompare(colB);
      }
      const typeA = rowKey(a, "jewelryType") || rowKey(a, "category");
      const typeB = rowKey(b, "jewelryType") || rowKey(b, "category");
      if (typeA !== typeB) return typeA.localeCompare(typeB);
      return String(a.stone.sku || "").localeCompare(String(b.stone.sku || ""));
    }));
  };

  // Group by category / jewelry type, then by collection, then by SKU.
  const handleSortByCategory = () => {
    setRows((prev) => [...prev].sort((a, b) => {
      const typeA = rowKey(a, "jewelryType") || rowKey(a, "category");
      const typeB = rowKey(b, "jewelryType") || rowKey(b, "category");
      if (typeA !== typeB) {
        if (!typeA) return 1;
        if (!typeB) return -1;
        return typeA.localeCompare(typeB);
      }
      const colA = rowKey(a, "collection");
      const colB = rowKey(b, "collection");
      if (colA !== colB) return colA.localeCompare(colB);
      return String(a.stone.sku || "").localeCompare(String(b.stone.sku || ""));
    }));
  };

  const handleAddManual = ({ image, sku, type, text }) => {
    const id = `manual-${Date.now()}`;
    setRows((prev) => [
      ...prev,
      {
        id,
        manual: true,
        websiteText: text,
        stone: { id, sku, category: "Jewelry", jewelryType: type, imageUrl: image || null },
      },
    ]);
    setShowAddForm(false);
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSortByCollection}
                  disabled={rows.length < 2}
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors disabled:opacity-50"
                  title="Sort by collection"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9M3 12h5m8-4v12m0 0l-4-4m4 4l4-4" />
                  </svg>
                  <span className="hidden sm:inline">Collection</span>
                </button>
                <button
                  type="button"
                  onClick={handleSortByCategory}
                  disabled={rows.length < 2}
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors disabled:opacity-50"
                  title="Sort by category (jewelry type)"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  <span className="hidden sm:inline">Category</span>
                </button>
                <button
                  type="button"
                  onClick={handleShuffle}
                  disabled={rows.length < 2}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors disabled:opacity-50"
                  title="Randomize the order"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h3.5c1.2 0 2.3.6 3 1.6l3 4.8c.7 1 1.8 1.6 3 1.6H20m0 0l-2.5-2.5M20 15l-2.5 2.5M4 17h3.5c.8 0 1.6-.3 2.2-.8M20 7h-3.5c-.8 0-1.6.3-2.2.8M20 7l-2.5-2.5M20 7l-2.5 2.5" />
                  </svg>
                  <span className="hidden sm:inline">Shuffle</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdvancedSort((v) => !v)}
                  disabled={rows.length < 2}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                    showAdvancedSort
                      ? "text-white bg-amber-600 border-amber-600"
                      : "text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200"
                  }`}
                  title="Advanced multi-level sort"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  <span className="hidden sm:inline">Advanced</span>
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Reorderable list */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {showAdvancedSort && (
                <AdvancedSortPanel
                  rows={rows}
                  onApply={setRows}
                  onClose={() => setShowAdvancedSort(false)}
                />
              )}

              {showAddForm ? (
                <AddItemForm onAdd={handleAddManual} onCancel={() => setShowAddForm(false)} />
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="w-full mb-3 py-2.5 rounded-xl border-2 border-dashed border-stone-300 text-sm font-medium text-stone-500 hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50/50 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add item not in inventory
                </button>
              )}

              <Reorder.Group axis="y" values={rows} onReorder={setRows} className="space-y-2">
                {rows.map((row) => (
                  <RowItem key={row.id} row={row} onTextChange={handleTextChange} onRemove={handleRemove} />
                ))}
              </Reorder.Group>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-stone-200 bg-white rounded-b-none sm:rounded-b-2xl flex items-center justify-between gap-3">
              {/* Page orientation picker */}
              <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setOrientation("portrait")}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    orientation === "portrait" ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700"
                  }`}
                  title="Portrait (A4 vertical)"
                >
                  <span className="inline-block w-2.5 h-3.5 border-[1.5px] border-current rounded-[2px]" />
                  Portrait
                </button>
                <button
                  type="button"
                  onClick={() => setOrientation("landscape")}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    orientation === "landscape" ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700"
                  }`}
                  title="Landscape (A4 horizontal)"
                >
                  <span className="inline-block w-3.5 h-2.5 border-[1.5px] border-current rounded-[2px]" />
                  Landscape
                </button>
              </div>

              <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                disabled={isGenerating}
                className="px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => onGenerate(rows.map((r) => ({ ...r.stone, websiteText: r.websiteText.trim() })), { orientation })}
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
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default CatalogLiranModal;
