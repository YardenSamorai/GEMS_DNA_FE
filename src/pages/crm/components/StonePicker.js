import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../inventory/helpers/constants";
import { getMappedCategories } from "../../../utils/categoryMap";

/**
 * Three-tab inventory picker (Diamonds / Gemstones / Jewelry) with smart search,
 * shape and size (carat) filters. Used to attach inventory items to a CRM deal.
 */
export default function StonePicker({ onClose, onSelect }) {
  const [stones, setStones] = useState([]);
  const [jewelry, setJewelry] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("diamonds"); // diamonds | gemstones | jewelry
  const [selected, setSelected] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [shapes, setShapes] = useState([]); // multi-select array of strings
  const [minCt, setMinCt] = useState("");
  const [maxCt, setMaxCt] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/api/soap-stones`).then((r) => r.json()).catch(() => ({})),
      fetch(`${API_BASE}/api/jewelry`).then((r) => r.json()).catch(() => ({})),
    ]).then(([s, j]) => {
      const stoneRows = Array.isArray(s?.stones) ? s.stones : Array.isArray(s) ? s : [];
      const jewelryRows = Array.isArray(j?.jewelry) ? j.jewelry : Array.isArray(j) ? j : [];

      setStones(stoneRows.map((row, idx) => ({
        id: row.id ?? `stn_${idx}_${row.sku || idx}`,
        sku: row.sku || "",
        category: row.category || "",
        shape: row.shape || "",
        weightCt: row.weightCt != null ? Number(row.weightCt) : null,
        color: row.color || "",
        clarity: row.clarity || "",
        lab: row.lab || "",
        certificateNumber: row.certificateNumber || "",
        priceTotal: row.priceTotal ?? null,
        pricePerCt: row.pricePerCt ?? null,
        imageUrl: row.imageUrl || null,
      })));

      setJewelry(jewelryRows.map((row, idx) => {
        const images = String(row.all_pictures_link || "").split(";").map((u) => u.trim()).filter(Boolean);
        return {
          id: `jwl_${idx}_${row.model_number || idx}`,
          sku: row.model_number || row.sku || "",
          category: "Jewelry",
          title: row.title || "",
          jewelryType: row.jewelry_type || "",
          style: row.style || "",
          collection: row.collection || "",
          metalType: row.metal_type || "",
          stoneType: row.stone_type || "",
          priceTotal: row.price ?? null,
          imageUrl: images[0] || null,
          certificateNumber: row.certificate_number || "",
        };
      }));
    }).finally(() => setLoading(false));
  }, []);

  // Tab-aware base list
  const baseList = useMemo(() => {
    if (tab === "jewelry") return jewelry;
    return stones.filter((s) => {
      const mapped = getMappedCategories(s.category);
      const isDiamond = mapped.includes("Diamond");
      return tab === "diamonds" ? isDiamond : !isDiamond && !mapped.includes("Empty");
    });
  }, [stones, jewelry, tab]);

  // Available shapes for the current tab (sorted, unique)
  const availableShapes = useMemo(() => {
    if (tab === "jewelry") return [];
    const set = new Set();
    baseList.forEach((s) => { if (s.shape) set.add(s.shape); });
    return Array.from(set).sort();
  }, [baseList, tab]);

  // Reset shape filter when switching tabs to avoid stale selections
  useEffect(() => { setShapes([]); }, [tab]);

  const counts = useMemo(() => {
    const diamondCount = stones.filter((s) => getMappedCategories(s.category).includes("Diamond")).length;
    const gemCount = stones.filter((s) => {
      const m = getMappedCategories(s.category);
      return !m.includes("Diamond") && !m.includes("Empty");
    }).length;
    return { diamonds: diamondCount, gemstones: gemCount, jewelry: jewelry.length };
  }, [stones, jewelry]);

  // Smart search:
  //  - splits input by commas → each token is OR-matched
  //  - within a token, tries SKU-exact match first, otherwise multi-field substring match
  //  - empty query = no filter
  const matchesSearch = (item, tokens) => {
    if (tokens.length === 0) return true;
    const haystack = [
      item.sku, item.shape, item.color, item.clarity, item.lab,
      item.certificateNumber, item.category, item.title, item.jewelryType,
      item.stoneType, item.metalType, item.collection,
    ].filter(Boolean).join(" ").toLowerCase();
    return tokens.some((tok) => {
      // Exact-SKU shortcut (case-insensitive)
      if ((item.sku || "").toLowerCase() === tok) return true;
      return haystack.includes(tok);
    });
  };

  const filtered = useMemo(() => {
    const tokens = search.toLowerCase().split(",").map((t) => t.trim()).filter(Boolean);
    let list = baseList.filter((s) => matchesSearch(s, tokens));

    if (tab !== "jewelry") {
      if (shapes.length > 0) list = list.filter((s) => shapes.includes(s.shape));
      const lo = minCt !== "" ? Number(minCt) : null;
      const hi = maxCt !== "" ? Number(maxCt) : null;
      if (lo != null && !isNaN(lo)) list = list.filter((s) => (s.weightCt ?? 0) >= lo);
      if (hi != null && !isNaN(hi)) list = list.filter((s) => (s.weightCt ?? 0) <= hi);
    }

    // Smart sort: exact SKU matches at top
    if (tokens.length > 0) {
      list = [...list].sort((a, b) => {
        const aSku = (a.sku || "").toLowerCase();
        const bSku = (b.sku || "").toLowerCase();
        const aExact = tokens.some((t) => aSku === t) ? 0 : 1;
        const bExact = tokens.some((t) => bSku === t) ? 0 : 1;
        return aExact - bExact;
      });
    }
    return list.slice(0, 300);
  }, [baseList, search, shapes, minCt, maxCt, tab]);

  const toggle = (item) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[item.id]) delete next[item.id];
      else next[item.id] = item;
      return next;
    });
  };

  const toggleShape = (shape) => {
    setShapes((prev) => prev.includes(shape) ? prev.filter((s) => s !== shape) : [...prev, shape]);
  };

  const clearFilters = () => {
    setShapes([]);
    setMinCt("");
    setMaxCt("");
    setSearch("");
  };

  const selectedCount = Object.keys(selected).length;
  const activeFilterCount = (shapes.length > 0 ? 1 : 0) + (minCt !== "" || maxCt !== "" ? 1 : 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-stone-900">Add from inventory</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-stone-100">
            <svg className="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 flex items-center gap-1 border-b border-stone-200 shrink-0 overflow-x-auto scrollbar-hide">
          <TabBtn active={tab === "diamonds"} onClick={() => setTab("diamonds")} count={counts.diamonds} loading={loading}>Diamonds</TabBtn>
          <TabBtn active={tab === "gemstones"} onClick={() => setTab("gemstones")} count={counts.gemstones} loading={loading}>Gemstones</TabBtn>
          <TabBtn active={tab === "jewelry"} onClick={() => setTab("jewelry")} count={counts.jewelry} loading={loading}>Jewelry</TabBtn>
        </div>

        {/* Search + filter toggle */}
        <div className="px-5 py-3 border-b border-stone-200 space-y-3 shrink-0">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tab === "jewelry" ? "Search by SKU, type, style, collection… (comma-separate multiple)" : "Search by SKU, shape, color, clarity, lab… (comma-separate multiple)"}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-stone-100" title="Clear">
                  <svg className="w-3.5 h-3.5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
            {tab !== "jewelry" && (
              <button
                onClick={() => setShowFilters((s) => !s)}
                className={`shrink-0 px-3 py-2 rounded-lg text-sm border inline-flex items-center gap-1.5 ${
                  showFilters || activeFilterCount > 0
                    ? "bg-stone-900 text-white border-stone-900"
                    : "bg-white text-stone-700 border-stone-200 hover:border-stone-400"
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                Filters
                {activeFilterCount > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${showFilters || activeFilterCount > 0 ? "bg-white/20" : "bg-stone-200"}`}>{activeFilterCount}</span>}
              </button>
            )}
          </div>

          {/* Filters panel */}
          {showFilters && tab !== "jewelry" && (
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-3">
              {/* Shape multi-select */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-600">Shape</span>
                  {shapes.length > 0 && (
                    <button onClick={() => setShapes([])} className="text-[11px] text-stone-500 hover:text-stone-900 underline">Clear</button>
                  )}
                </div>
                {availableShapes.length === 0 ? (
                  <div className="text-xs text-stone-400 italic">No shapes available</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                    {availableShapes.map((sh) => {
                      const on = shapes.includes(sh);
                      return (
                        <button
                          key={sh}
                          onClick={() => toggleShape(sh)}
                          className={`text-[11px] px-2.5 py-1 rounded-full border ${
                            on ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-700 border-stone-200 hover:border-stone-400"
                          }`}
                        >{sh}</button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Size range */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-600">Size (ct)</span>
                  {(minCt !== "" || maxCt !== "") && (
                    <button onClick={() => { setMinCt(""); setMaxCt(""); }} className="text-[11px] text-stone-500 hover:text-stone-900 underline">Clear</button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number" inputMode="decimal" step="0.01" min="0"
                    value={minCt} onChange={(e) => setMinCt(e.target.value)}
                    placeholder="From"
                    className="flex-1 px-3 py-1.5 text-sm rounded-md border border-stone-200 bg-white focus:outline-none focus:border-stone-400"
                  />
                  <span className="text-stone-400 text-xs">to</span>
                  <input
                    type="number" inputMode="decimal" step="0.01" min="0"
                    value={maxCt} onChange={(e) => setMaxCt(e.target.value)}
                    placeholder="To"
                    className="flex-1 px-3 py-1.5 text-sm rounded-md border border-stone-200 bg-white focus:outline-none focus:border-stone-400"
                  />
                </div>
                {/* Quick presets */}
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {[[0, 1], [1, 2], [2, 3], [3, 5], [5, 10], [10, null]].map(([lo, hi], i) => (
                    <button
                      key={i}
                      onClick={() => { setMinCt(String(lo)); setMaxCt(hi == null ? "" : String(hi)); }}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-stone-200 bg-white text-stone-600 hover:border-stone-400"
                    >{hi == null ? `${lo}ct+` : `${lo}-${hi}ct`}</button>
                  ))}
                </div>
              </div>

              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="text-[11px] text-stone-600 hover:text-stone-900 underline">
                  Clear all filters & search
                </button>
              )}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="p-12 text-center text-sm text-stone-500">Loading inventory…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-stone-500">
              {baseList.length === 0
                ? `No ${tab} in inventory yet`
                : "No matches — try adjusting your search or filters"}
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {filtered.map((item) => {
                const isOn = !!selected[item.id];
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => toggle(item)}
                      className={`w-full flex items-center gap-3 p-3 text-left hover:bg-stone-50 ${isOn ? "bg-emerald-50/50" : ""}`}
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                        isOn ? "bg-emerald-500 border-emerald-500" : "border-stone-300"
                      }`}>
                        {isOn && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.sku} className="w-12 h-12 rounded-md object-cover bg-stone-100 shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-md bg-stone-100 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-stone-900 truncate">{item.sku}{item.title ? ` · ${item.title}` : ""}</div>
                        <div className="text-xs text-stone-500 truncate">
                          {tab === "jewelry"
                            ? [item.jewelryType, item.style, item.metalType, item.stoneType].filter(Boolean).join(" · ")
                            : [item.shape, item.weightCt && `${item.weightCt}ct`, item.color, item.clarity, item.lab].filter(Boolean).join(" · ")
                          }
                        </div>
                      </div>
                      {item.priceTotal != null && (
                        <div className="text-right shrink-0">
                          <div className="text-sm font-semibold text-stone-900">${Number(item.priceTotal).toLocaleString()}</div>
                          <div className="text-[10px] text-stone-400">${Math.round(Number(item.priceTotal) / 2).toLocaleString()} neto</div>
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {filtered.length === 300 && (
            <div className="p-3 text-center text-[11px] text-stone-400 bg-stone-50 border-t border-stone-100">
              Showing first 300 results. Refine your search to see more.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between shrink-0">
          <div className="text-sm text-stone-600">{selectedCount} selected</div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-200 rounded-lg">Cancel</button>
            <button
              onClick={() => onSelect(Object.values(selected))}
              disabled={!selectedCount}
              className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50"
            >Add {selectedCount > 0 ? `(${selectedCount})` : ""}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const TabBtn = ({ active, onClick, count, loading, children }) => (
  <button
    onClick={onClick}
    className={`pb-2 px-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
      active ? "border-stone-900 text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"
    }`}
  >
    {children}
    {!loading && count != null && (
      <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
        active ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-500"
      }`}>{count}</span>
    )}
  </button>
);
