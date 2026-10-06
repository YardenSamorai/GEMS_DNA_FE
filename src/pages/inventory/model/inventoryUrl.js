import { DEFAULT_SORT, emptyFilters, MODES } from "./inventoryModel";

/* The inventory view lives in the query string so a refresh, a shared link
 * and the DNA page's Back button all land on the same list. `search` and
 * `mode` predate this and are linked to from other pages. */

const LIST_PARAMS = {
  shape: "shape",
  category: "cat",
  treatment: "clarity",
  location: "loc",
  lab: "lab",
  groupingType: "group",
  diamondColor: "color",
  fancyColor: "fancy",
  tag: "tag",
};

const RANGE_PARAMS = {
  ct: ["minCarat", "maxCarat"],
  price: ["minPrice", "maxPrice"],
  ppc: ["minPricePerCt", "maxPricePerCt"],
  len: ["minLength", "maxLength"],
  wid: ["minWidth", "maxWidth"],
};

const OWN_KEYS = new Set([
  "mode",
  "search",
  "ask",
  "box",
  "src",
  "sort",
  "page",
  "pu",
  ...Object.values(LIST_PARAMS),
  ...Object.keys(RANGE_PARAMS),
]);

export const hasInventoryParams = (params) => {
  for (const key of params.keys()) if (OWN_KEYS.has(key)) return true;
  return false;
};

const isNum = (v) => v !== "" && Number.isFinite(Number(v));

const parseRange = (raw) => {
  if (!raw) return ["", ""];
  const i = raw.indexOf("~");
  const [a, b] = i === -1 ? [raw, ""] : [raw.slice(0, i), raw.slice(i + 1)];
  return [isNum(a) ? a : "", isNum(b) ? b : ""];
};

export const parseUrlState = (params) => {
  const mode = MODES.includes(params.get("mode")) ? params.get("mode") : null;
  const filters = emptyFilters(params.get("search") || "");
  Object.entries(LIST_PARAMS).forEach(([key, param]) => {
    const values = params.getAll(param).map((v) => v.trim()).filter(Boolean);
    filters[key] = Array.from(new Set(values));
  });
  Object.entries(RANGE_PARAMS).forEach(([param, [minKey, maxKey]]) => {
    const [a, b] = parseRange(params.get(param));
    filters[minKey] = a;
    filters[maxKey] = b;
  });
  filters.box = params.get("box") || "";

  let sort = { ...DEFAULT_SORT };
  const rawSort = params.get("sort");
  if (rawSort) {
    const dot = rawSort.lastIndexOf(".");
    const field = dot > 0 ? rawSort.slice(0, dot) : rawSort;
    const direction = dot > 0 ? rawSort.slice(dot + 1) : "asc";
    if (/^[A-Za-z]+$/.test(field)) sort = { field, direction: direction === "desc" ? "desc" : "asc" };
  }
  const page = Math.max(1, parseInt(params.get("page"), 10) || 1);
  const src = params.get("src");
  return {
    mode,
    filters,
    smartSearch: params.get("ask") || "",
    sort,
    page,
    jewelrySource: src === "workshop" || src === "catalog" ? src : "all",
    // Price thresholds are written in the units on screen; "b" marks Bruto.
    priceUnit: params.get("pu") === "b" ? "bruto" : "neto",
  };
};

const rangeValue = (a, b) => (a || b ? `${a || ""}~${b || ""}` : "");

export const buildUrlParams = ({ mode, filters, smartSearch, sort, page, jewelrySource, priceMode }) => {
  const p = new URLSearchParams();
  p.set("mode", mode);
  if (filters.sku) p.set("search", filters.sku);
  if (smartSearch) p.set("ask", smartSearch);
  Object.entries(LIST_PARAMS).forEach(([key, param]) => {
    (filters[key] || []).forEach((v) => p.append(param, v));
  });
  let hasPrice = false;
  Object.entries(RANGE_PARAMS).forEach(([param, [minKey, maxKey]]) => {
    const v = rangeValue(filters[minKey], filters[maxKey]);
    if (v) {
      p.set(param, v);
      if (param === "price" || param === "ppc") hasPrice = true;
    }
  });
  if (filters.box) p.set("box", filters.box);
  if (mode === "jewelry" && jewelrySource && jewelrySource !== "all") p.set("src", jewelrySource);
  if (sort && (sort.field !== DEFAULT_SORT.field || sort.direction !== DEFAULT_SORT.direction)) {
    p.set("sort", `${sort.field}.${sort.direction}`);
  }
  if (page > 1) p.set("page", String(page));
  if (hasPrice && priceMode === "bruto") p.set("pu", "b");
  return p;
};

/* A link written in Bruto opened by someone viewing Neto (or the reverse)
 * must still select the same stones, so the thresholds are converted into
 * the viewer's units — the same ×2 / ÷2 the Neto/Bruto toggle applies. */
export const convertPriceUnits = (filters, fromUnit, toUnit) => {
  if (fromUnit === toUnit) return filters;
  const factor = toUnit === "bruto" ? 2 : 0.5;
  const rescale = (val) => {
    if (val === "" || val == null) return val;
    const num = Number(val);
    if (!Number.isFinite(num)) return val;
    return String(Math.round(num * factor));
  };
  return {
    ...filters,
    minPrice: rescale(filters.minPrice),
    maxPrice: rescale(filters.maxPrice),
    minPricePerCt: rescale(filters.minPricePerCt),
    maxPricePerCt: rescale(filters.maxPricePerCt),
  };
};
