import React, { useEffect, useState } from "react";
import { API_BASE } from "../../inventory/helpers/constants";

/**
 * Detail view for an item attached to a deal.
 *  - Renders saved snapshot data immediately
 *  - Fetches the latest version from inventory in the background to enrich
 *  - Mobile: full-height sheet sliding from bottom
 *  - Desktop: centered modal
 */
export default function ItemDetailModal({ item, onClose }) {
  const snap = item.snapshot || {};
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const isJewelry = (item.category || snap.category || "").toLowerCase() === "jewelry";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const fetchData = async () => {
      try {
        if (isJewelry) {
          const r = await fetch(`${API_BASE}/api/jewelry/${encodeURIComponent(item.sku)}`);
          if (!r.ok) throw new Error("not found");
          const d = await r.json();
          if (!cancelled) setDetails({ kind: "jewelry", data: d });
        } else {
          // Stones: /api/stones/:sku returns full row (prices come encrypted, ignore those — use snapshot)
          const r = await fetch(`${API_BASE}/api/stones/${encodeURIComponent(item.sku)}`);
          if (!r.ok) throw new Error("not found");
          const d = await r.json();
          if (!cancelled) setDetails({ kind: "stone", data: d });
        }
      } catch {
        if (!cancelled) setDetails(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (item.sku) fetchData();
    else setLoading(false);
    return () => { cancelled = true; };
  }, [item.sku, isJewelry]);

  // ---- Field consolidation ----
  // Prefer fresh inventory fields, fall back to snapshot
  const d = details?.data || {};
  const isStoneFresh = details?.kind === "stone";

  const v = (...keys) => {
    for (const k of keys) {
      const val = k.split(".").reduce((acc, kk) => (acc == null ? acc : acc[kk]), { d, snap });
      if (val != null && val !== "") return val;
    }
    return null;
  };

  const sku = item.sku || snap.sku || (isStoneFresh ? d.sku : d.model_number);
  const title = isJewelry ? (d.title || snap.title || "") : (snap.title || "");
  const category = snap.category || d.category || (isJewelry ? "Jewelry" : "Stone");

  // Image: try multiple sources
  let imageUrl = snap.imageUrl || null;
  if (!imageUrl) {
    if (isJewelry) {
      const list = String(d.all_pictures_link || "").split(";").map((s) => s.trim()).filter(Boolean);
      imageUrl = list[0] || null;
    } else if (isStoneFresh) {
      imageUrl = d.picture || null;
    }
  }
  const allImages = isJewelry
    ? String(d.all_pictures_link || "").split(";").map((s) => s.trim()).filter(Boolean)
    : (imageUrl ? [imageUrl] : []);

  // Stone fields
  const shape = snap.shape || (isStoneFresh ? d.shape : null);
  const weightCt = snap.weightCt ?? (isStoneFresh ? d.carat : null);
  const color = snap.color || (isStoneFresh ? d.color : null);
  const clarity = snap.clarity || (isStoneFresh ? d.clarity : null);
  const lab = snap.lab || (isStoneFresh ? d.lab : null);
  const certNumber = snap.certificateNumber || (isStoneFresh ? d.certificate_number : (isJewelry ? d.certificate_number : null));
  const certUrl = isStoneFresh ? d.certificate_url : (isJewelry ? d.certificate_link : null);
  const videoUrl = isStoneFresh ? d.video : (isJewelry ? d.video_link : null);
  const measurements = isStoneFresh ? d.measurements1 : null;
  const cut = isStoneFresh ? d.cut : null;
  const polish = isStoneFresh ? d.polish : null;
  const symmetry = isStoneFresh ? d.symmetry : null;
  const fluor = isStoneFresh ? d.fluorescence : null;
  const origin = isStoneFresh ? d.origin : null;
  const treatment = isStoneFresh ? d.treatment : null;
  const ratio = isStoneFresh ? d.ratio : null;
  const tablePct = isStoneFresh ? d.table_percent : null;
  const depthPct = isStoneFresh ? d.depth_percent : null;

  // Jewelry fields
  const jewelryType = isJewelry ? (d.jewelry_type || snap.jewelryType) : null;
  const style = isJewelry ? d.style : null;
  const collection = isJewelry ? d.collection : null;
  const metalType = isJewelry ? d.metal_type : null;
  const stoneType = isJewelry ? d.stone_type : null;
  const description = isJewelry ? sanitize(d.description) : null;
  const fullDescription = isJewelry ? sanitize(d.full_description) : null;

  // Pricing — use snapshot for trustworthy unencrypted values
  const bruto = snap.priceTotal ? Number(snap.priceTotal) : null;
  const neto = bruto != null ? Math.round(bruto / 2) : null;
  const ppc = snap.pricePerCt ? Number(snap.pricePerCt) : null;
  const customPrice = item.custom_price != null ? Number(item.custom_price) : null;

  // Header subtitle
  const subtitle = isJewelry
    ? [jewelryType, style, metalType, stoneType].filter(Boolean).join(" · ")
    : [shape, weightCt && `${weightCt}ct`, color, clarity, lab].filter(Boolean).join(" · ");

  // Specs
  const stoneSpecs = !isJewelry ? [
    { label: "Shape", value: shape },
    { label: "Weight", value: weightCt ? `${weightCt} ct` : null },
    { label: "Color", value: color },
    { label: "Clarity", value: clarity },
    { label: "Cut", value: cut },
    { label: "Polish", value: polish },
    { label: "Symmetry", value: symmetry },
    { label: "Fluorescence", value: fluor },
    { label: "Lab", value: lab },
    { label: "Cert #", value: certNumber },
    { label: "Origin", value: origin },
    { label: "Treatment", value: treatment },
    { label: "Measurements", value: measurements },
    { label: "Ratio", value: ratio ? Number(ratio).toFixed(2) : null },
    { label: "Table %", value: tablePct },
    { label: "Depth %", value: depthPct },
    { label: "Category", value: category },
  ].filter((f) => f.value != null && f.value !== "") : [];

  const jewelrySpecs = isJewelry ? [
    { label: "Type", value: jewelryType },
    { label: "Style", value: style },
    { label: "Collection", value: collection },
    { label: "Metal", value: metalType },
    { label: "Stone", value: stoneType },
    { label: "Cert #", value: certNumber },
  ].filter((f) => f.value != null && f.value !== "") : [];

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4 bg-stone-900/60 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden h-[92vh] sm:h-auto sm:max-h-[92vh]"
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-stone-300" />
        </div>

        {/* Header */}
        <div className="px-4 sm:px-6 pt-3 sm:pt-5 pb-3 border-b border-stone-200 flex items-start gap-3 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${isJewelry ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{category}</span>
              {item.quantity > 1 && <span className="text-[10px] text-stone-500">× {item.quantity}</span>}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-stone-900 mt-1 truncate">{sku || "—"}</h2>
            {(title || subtitle) && (
              <div className="text-sm text-stone-500 mt-0.5 truncate">{title || subtitle}</div>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 -mr-1 rounded-lg hover:bg-stone-100 shrink-0">
            <svg className="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Hero image */}
          <ImageGallery images={allImages} fallback={imageUrl} alt={sku} />

          <div className="p-4 sm:p-6 space-y-5">
            {/* Pricing card */}
            <div className="rounded-xl border border-stone-200 bg-gradient-to-br from-stone-50 to-stone-100 p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {customPrice != null && (
                  <PriceCell label="Deal price" value={customPrice} accent />
                )}
                {neto != null && <PriceCell label="Neto (list)" value={neto} muted={customPrice != null} />}
                {bruto != null && <PriceCell label="Bruto (list)" value={bruto} muted />}
                {ppc != null && !isJewelry && <PriceCell label="$/Ct" value={ppc} muted />}
              </div>
            </div>

            {/* Specs */}
            {(stoneSpecs.length > 0 || jewelrySpecs.length > 0) && (
              <div>
                <h3 className="text-[11px] uppercase tracking-wider font-semibold text-stone-500 mb-2">Specifications</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 bg-white border border-stone-200 rounded-xl p-4">
                  {(isJewelry ? jewelrySpecs : stoneSpecs).map((f) => (
                    <SpecCell key={f.label} label={f.label} value={f.value} />
                  ))}
                </div>
              </div>
            )}

            {/* Jewelry description */}
            {isJewelry && (description || fullDescription) && (
              <div>
                <h3 className="text-[11px] uppercase tracking-wider font-semibold text-stone-500 mb-2">Description</h3>
                <div className="bg-white border border-stone-200 rounded-xl p-4 text-sm text-stone-700 leading-relaxed whitespace-pre-line">
                  {fullDescription || description}
                </div>
              </div>
            )}

            {/* Links */}
            {(certUrl || videoUrl) && (
              <div>
                <h3 className="text-[11px] uppercase tracking-wider font-semibold text-stone-500 mb-2">Resources</h3>
                <div className="flex flex-wrap gap-2">
                  {certUrl && (
                    <a href={certUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-stone-200 hover:border-stone-900 text-sm text-stone-700 hover:text-stone-900">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      Certificate
                    </a>
                  )}
                  {videoUrl && (
                    <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-stone-200 hover:border-stone-900 text-sm text-stone-700 hover:text-stone-900">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      Video
                    </a>
                  )}
                </div>
              </div>
            )}

            {loading && (
              <div className="text-xs text-stone-400 text-center py-2">Loading latest details…</div>
            )}
          </div>
        </div>

        {/* Footer (mobile-friendly close button) */}
        <div className="px-4 sm:px-6 py-3 bg-stone-50 border-t border-stone-200 flex justify-end shrink-0" style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 12px)" }}>
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800">Close</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- sub-components ---------- */

function ImageGallery({ images = [], fallback, alt }) {
  const list = images.length ? images : (fallback ? [fallback] : []);
  const [idx, setIdx] = useState(0);
  if (list.length === 0) {
    return (
      <div className="w-full bg-stone-100 aspect-[4/3] sm:aspect-[16/9] flex items-center justify-center text-stone-300">
        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
      </div>
    );
  }
  return (
    <div className="relative w-full bg-stone-100 aspect-[4/3] sm:aspect-[16/9]">
      <img src={list[idx]} alt={alt} className="w-full h-full object-contain bg-stone-50" />
      {list.length > 1 && (
        <>
          <button
            onClick={() => setIdx((i) => (i - 1 + list.length) % list.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white shadow-md text-stone-700"
            aria-label="Previous"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button
            onClick={() => setIdx((i) => (i + 1) % list.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white shadow-md text-stone-700"
            aria-label="Next"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {list.map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === idx ? "bg-stone-900" : "bg-white/70"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const fmt = (n) => `$${Number(n || 0).toLocaleString()}`;

const PriceCell = ({ label, value, accent, muted }) => (
  <div>
    <div className="text-[10px] uppercase tracking-wider font-semibold text-stone-500">{label}</div>
    <div className={`mt-0.5 font-bold ${accent ? "text-emerald-700 text-2xl" : muted ? "text-stone-500 text-base" : "text-stone-900 text-lg"}`}>
      {fmt(value)}
    </div>
  </div>
);

const SpecCell = ({ label, value }) => (
  <div>
    <div className="text-[10px] uppercase tracking-wider text-stone-400 font-medium">{label}</div>
    <div className="text-sm text-stone-900 font-medium mt-0.5 break-words">{String(value)}</div>
  </div>
);

// Strip mojibake / weird unicode that sometimes comes from imports
function sanitize(text) {
  if (!text) return text;
  return String(text)
    .replace(/[\uFFFD\u00A0]/g, " ")
    .replace(/Â/g, "")
    .replace(/â€™/g, "'")
    .replace(/â€"/g, "—")
    .replace(/â€"/g, "–")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
