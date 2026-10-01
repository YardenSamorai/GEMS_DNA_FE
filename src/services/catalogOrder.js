/**
 * catalogOrder.js — which picked items print together, and in what order.
 * Shared by the PDF builder and the selection sheet, so the order the rep
 * sees is the order the catalog prints.
 */

export const isJewelry = (it) => it?.kind === "jewelry";

export const skuOf = (it) => String(it?.sku ?? "").trim();

/* ───────────────────────────── pairs ───────────────────────────── */

/* Collapse the picked list into cards: a matched pair becomes one unit, and
 * everything else stays on its own. Mirrors the rule the DNA page uses, so a
 * pair printed here is the same pair a customer sees at gems-dna.com/{sku} —
 * the partner must be present and must not point at some third stone.
 *
 * Only pairs where BOTH halves were picked are joined; pulling in an unpicked
 * partner would put stones in the catalog the sender never selected. */
export const groupPairs = (items) => {
  const bySku = new Map();
  for (const it of items) {
    if (!isJewelry(it) && skuOf(it)) bySku.set(skuOf(it), it);
  }

  const used = new Set();
  const units = [];

  for (const it of items) {
    const sku = skuOf(it);
    // Jewelry can reach here without a SKU, so an empty one is never treated
    // as "already printed" — every picked item must appear exactly once.
    if (sku && used.has(sku)) continue;

    const partnerSku = isJewelry(it) ? "" : String(it?.pairSku ?? "").trim();
    const partner = partnerSku && partnerSku !== sku ? bySku.get(partnerSku) : null;
    const partnerPointsAt = partner ? String(partner.pairSku ?? "").trim() : "";
    const contradicted = partner && partnerPointsAt && partnerPointsAt !== sku;

    if (partner && !contradicted && !used.has(partnerSku)) {
      used.add(sku);
      used.add(partnerSku);
      // Fixed order by SKU so a pair reads the same whichever half was picked
      // first.
      const [a, b] = sku.localeCompare(partnerSku) <= 0 ? [it, partner] : [partner, it];
      units.push({ pair: true, a, b });
      continue;
    }

    if (sku) used.add(sku);
    units.push({ pair: false, a: it });
  }

  return units;
};

export const pairWeight = (a, b) => (Number(a?.weightCt) || 0) + (Number(b?.weightCt) || 0);

/* ───────────────────────────── order ───────────────────────────── */

export const CATALOG_SORTS = [
  { key: "picked", label: "Picked order" },
  { key: "weight", label: "Size (ct)" },
  { key: "total", label: "Total price" },
  { key: "ppc", label: "Price / ct" },
];

const numOrNull = (v) => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const unitWeight = (u) =>
  u.pair ? pairWeight(u.a, u.b) || null : numOrNull(u.a?.weightCt);

const unitTotal = (u) => {
  if (u.pair) {
    const ta = numOrNull(u.a?.priceTotal);
    const tb = numOrNull(u.b?.priceTotal);
    return ta != null && tb != null ? ta + tb : null;
  }
  return isJewelry(u.a) ? numOrNull(u.a?.price) : numOrNull(u.a?.priceTotal);
};

const unitPpc = (u) => {
  if (!u.pair) return numOrNull(u.a?.pricePerCt);
  const total = unitTotal(u);
  const ct = unitWeight(u);
  return total != null && ct ? total / ct : null;
};

/* The picked list in the order the catalog will print it. A pair is ranked
 * as the one card it prints as (combined weight, combined price) and its
 * halves stay next to each other. Items missing the value go last either
 * way; ties keep the picked order. */
export const sortCatalogItems = (items, sort) => {
  const list = (items || []).filter(Boolean);
  if (!sort || sort.key === "picked") return list;
  const valueOf = { weight: unitWeight, total: unitTotal, ppc: unitPpc }[sort.key];
  if (!valueOf) return list;
  const dir = sort.dir === "asc" ? 1 : -1;
  const ranked = groupPairs(list).map((u, idx) => ({ u, idx, v: valueOf(u) }));
  ranked.sort((x, y) => {
    if (x.v == null || y.v == null) return (x.v == null) - (y.v == null) || x.idx - y.idx;
    return (x.v - y.v) * dir || x.idx - y.idx;
  });
  return ranked.flatMap(({ u }) => (u.pair ? [u.a, u.b] : [u.a]));
};
