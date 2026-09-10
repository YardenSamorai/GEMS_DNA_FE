import React from "react";

/* ============================================================================
 * Smart SKU search — shared by the sales catalogs (stones + jewelry).
 *
 * buildSkuSuggestions() matches the typed query against EVERY item the rep can
 * see (all stone categories + the jewelry catalog) and returns a ranked list;
 * <SkuSuggestions/> renders it as a dropdown under the search input. Picking a
 * suggestion deep-links straight to the product page, so the rep never has to
 * guess which catalog an SKU lives in.
 * ========================================================================== */

/* Same normalisation the catalogs use for SKU matching: letters+digits only,
 * case-insensitive — so "ri hj 029" finds "RI-HJ-029". */
const norm = (v) => String(v || "").replace(/[^a-z0-9]/gi, "").toLowerCase();

/**
 * @param query   raw search-box text
 * @param stones  loose stones (raw /api/soap-stones rows: sku, pairSku, ...)
 * @param jewelry jewelry pieces, either raw /api/jewelry rows (model_number,
 *                title) or ones already mapped for the catalog (sku, name) —
 *                the callers hold them in whichever form suits them
 * @param limit   max suggestions returned
 */
export const buildSkuSuggestions = ({ query, stones, jewelry, limit = 8 }) => {
  const q = norm(query);
  if (q.length < 2) return [];

  const out = [];
  // Prefix matches rank above substring matches; shorter SKUs break ties so
  // the exact stone surfaces before its longer siblings.
  const rank = (sku) => (norm(sku).startsWith(q) ? 0 : 1);

  for (const s of stones || []) {
    if (!s?.sku) continue;
    const hit = norm(s.sku).includes(q) || (s.pairSku && norm(s.pairSku).includes(q));
    if (!hit) continue;
    const detail = [
      s.weightCt != null && s.weightCt !== "" ? `${s.weightCt} ct` : null,
      s.shape || null,
      s.color || null,
    ]
      .filter(Boolean)
      .join(" · ");
    out.push({
      kind: "stone",
      sku: s.sku,
      detail,
      tag: s.category || "Stone",
      route: `/sales/stone/${encodeURIComponent(s.sku)}`,
      rank: rank(s.sku),
    });
  }

  for (const j of jewelry || []) {
    const sku = j?.model_number || j?.sku;
    if (!sku) continue;
    if (!norm(sku).includes(q)) continue;
    out.push({
      kind: "jewelry",
      sku,
      detail: j.title || j.name || j.jewelry_type || j.jewelryType || "",
      tag: "Jewelry",
      route: `/sales/jewelry/${encodeURIComponent(sku)}`,
      rank: rank(sku),
    });
  }

  out.sort(
    (a, b) =>
      a.rank - b.rank ||
      String(a.sku).length - String(b.sku).length ||
      String(a.sku).localeCompare(String(b.sku))
  );
  return out.slice(0, limit);
};

/* Dropdown under the search input. Rendered inside the input's relatively-
 * positioned wrapper. onMouseDown (not onClick) so the pick lands before the
 * input's blur closes the list. */
const SkuSuggestions = ({ open, items, onPick }) => {
  if (!open || !items?.length) return null;
  return (
    <div className="absolute left-0 right-0 top-full z-40 mt-1.5 overflow-hidden rounded-xl border border-app-line bg-app-surface shadow-[0_18px_44px_-16px_rgba(0,0,0,0.35)]">
      {items.map((it) => (
        <button
          key={`${it.kind}:${it.sku}`}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(it);
          }}
          className="flex w-full items-center justify-between gap-3 border-b border-app-line/60 px-3.5 py-2.5 text-left transition last:border-b-0 hover:bg-app-canvas2"
        >
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-semibold tracking-tight text-app-ink">
              {it.sku}
            </span>
            {it.detail ? (
              <span className="block truncate text-[12px] text-app-soft">{it.detail}</span>
            ) : null}
          </span>
          <span className="shrink-0 rounded-full border border-app-line px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-app-muted">
            {it.tag}
          </span>
        </button>
      ))}
    </div>
  );
};

export default SkuSuggestions;
