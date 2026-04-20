import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../inventory/helpers/constants";

export default function StonePicker({ onClose, onSelect }) {
  const [stones, setStones] = useState([]);
  const [jewelry, setJewelry] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("stones");
  const [selected, setSelected] = useState({});

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/api/soap-stones`).then((r) => r.json()).catch(() => ({})),
      fetch(`${API_BASE}/api/jewelry`).then((r) => r.json()).catch(() => ({})),
    ]).then(([s, j]) => {
      // Both endpoints return wrapped responses ({stones: [...]} / {jewelry: [...]})
      const stoneRows = Array.isArray(s?.stones) ? s.stones : Array.isArray(s) ? s : [];
      const jewelryRows = Array.isArray(j?.jewelry) ? j.jewelry : Array.isArray(j) ? j : [];

      // Stones already arrive in camelCase from the API
      setStones(stoneRows.map((row, idx) => ({
        id: row.id ?? `stn_${idx}_${row.sku || idx}`,
        sku: row.sku || "",
        category: row.category || "",
        shape: row.shape || "",
        weightCt: row.weightCt ?? null,
        color: row.color || "",
        clarity: row.clarity || "",
        lab: row.lab || "",
        certificateNumber: row.certificateNumber || "",
        priceTotal: row.priceTotal ?? null,
        pricePerCt: row.pricePerCt ?? null,
        imageUrl: row.imageUrl || null,
      })));

      // Jewelry comes in snake_case from the database
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

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = tab === "stones" ? stones : jewelry;
    if (!q) return list.slice(0, 200);
    return list.filter((s) => {
      const haystack = [s.sku, s.shape, s.category, s.color, s.clarity, s.title, s.jewelryType, s.stoneType]
        .filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    }).slice(0, 200);
  }, [stones, jewelry, search, tab]);

  const toggle = (item) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[item.id]) delete next[item.id];
      else next[item.id] = item;
      return next;
    });
  };

  const selectedCount = Object.keys(selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <h3 className="font-semibold text-stone-900">Add from inventory</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-stone-100">
            <svg className="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-5 pt-3 flex items-center gap-3 border-b border-stone-200">
          <button onClick={() => setTab("stones")} className={`pb-2 px-1 text-sm font-medium border-b-2 ${tab === "stones" ? "border-stone-900 text-stone-900" : "border-transparent text-stone-500"}`}>
            Stones {!loading && <span className="ml-1 text-[10px] text-stone-400">({stones.length})</span>}
          </button>
          <button onClick={() => setTab("jewelry")} className={`pb-2 px-1 text-sm font-medium border-b-2 ${tab === "jewelry" ? "border-stone-900 text-stone-900" : "border-transparent text-stone-500"}`}>
            Jewelry {!loading && <span className="ml-1 text-[10px] text-stone-400">({jewelry.length})</span>}
          </button>
        </div>

        <div className="px-5 py-3 border-b border-stone-200">
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by SKU, shape, color, clarity, lab…"
            className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-12 text-center text-sm text-stone-500">Loading inventory…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-stone-500">
              {(tab === "stones" ? stones.length : jewelry.length) === 0
                ? `No ${tab} in inventory yet`
                : "No matches for your search"}
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {filtered.map((item) => {
                const isOn = !!selected[item.id];
                return (
                  <li key={item.id}>
                    <button onClick={() => toggle(item)} className={`w-full flex items-center gap-3 p-3 text-left hover:bg-stone-50 ${isOn ? "bg-emerald-50/50" : ""}`}>
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
                          {tab === "stones"
                            ? [item.shape, item.weightCt && `${item.weightCt}ct`, item.color, item.clarity, item.lab].filter(Boolean).join(" · ")
                            : [item.jewelryType, item.style, item.metalType, item.stoneType].filter(Boolean).join(" · ")
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
        </div>

        <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
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
