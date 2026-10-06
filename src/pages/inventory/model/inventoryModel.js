import { getMappedCategories } from "../../../utils/categoryMap";
import { inventoryPriceScale } from "../../../utils/pricing";
import { sanitizeText } from "../../../utils/helper";
import { canonicalSku } from "../../../utils/skuQuery";
import {
  BARAK_DISPLAY_NAMES,
  DIAMOND_FILTER_GROUPS,
  EXTRA_BARAK_FILTERS,
  getBaseFancyColor,
  getDiamondColorGroups,
  getDisplayShape,
  getDnaShapes,
  isDiamondColorStone,
  LEVEL_1_SHAPES,
  locationOptions,
  treatmentOptions,
} from "../helpers/constants";

export const ITEMS_PER_PAGE = 50;
export const MODES = ["diamonds", "gemstones", "jewelry"];

export const DEFAULT_FILTERS = Object.freeze({
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
  lab: [],
  box: "",
});

export const emptyFilters = (sku = "") => ({
  ...DEFAULT_FILTERS,
  shape: [],
  treatment: [],
  category: [],
  tag: [],
  location: [],
  groupingType: [],
  diamondColor: [],
  fancyColor: [],
  lab: [],
  sku,
});

export const DEFAULT_SORT = Object.freeze({ field: "sku", direction: "asc" });

export const GROUPING_OPTIONS = ["Single", "Pair", "Set", "Parcel", "Side Stones", "Melee", "Empty"];
export const TREATMENT_OPTIONS = treatmentOptions.filter((t) => t !== "All treatments");
export const LOCATION_OPTIONS = locationOptions.filter((l) => l !== "All locations");
const CANONICAL_LABS = ["GIA", "GRS", "SSEF", "GUBELIN", "CDC", "AIGS", "AGL", "GIT", "LOTUS", "CGL", "IGI"];

/* ---------------- Normalization (API row → UI row) ---------------- */

export const normalizeStone = (row, index) => ({
  id: row.id ?? index,
  sku: row.sku ?? "",
  shape: row.shape ?? "",
  weightCt: row.weightCt != null ? Number(row.weightCt) : null,
  measurements: row.measurements ?? "",
  priceTotal: row.priceTotal != null ? Number(row.priceTotal) : null,
  pricePerCt: row.pricePerCt != null ? Number(row.pricePerCt) : null,
  rapListPrice: row.rapListPrice != null ? Number(row.rapListPrice) : null,
  imageUrl: row.imageUrl ?? null,
  additionalPictures: row.additionalPictures ?? "",
  videoUrl: row.videoUrl ?? null,
  additionalVideos: row.additionalVideos ?? "",
  certificateUrl: row.certificateUrl ?? null,
  certificateImageJpg: row.certificateImageJpg ?? null,
  lab: row.lab && row.lab.toUpperCase() !== "N/A" ? row.lab : null,
  origin: row.origin && row.origin.toUpperCase() !== "N/A" ? row.origin : null,
  ratio: row.ratio != null && row.ratio !== "" ? Number(row.ratio) : null,
  color: row.color ?? "",
  clarity: row.clarity ?? "",
  luster: row.luster ?? "",
  fluorescence: row.fluorescence ?? "",
  certificateNumber: row.certificateNumber ?? "",
  certComments: row.certComments ?? "",
  treatment: row.treatment ?? "",
  category: row.category ?? "",
  type: row.type ?? "",
  // Location — three layers (location kept for back-compat = branch)
  location: row.location ?? "",
  branch: row.branch ?? "",
  exactLocation: row.exactLocation ?? "",
  cut: row.cut ?? "",
  polish: row.polish ?? "",
  symmetry: row.symmetry ?? "",
  tablePercent: row.tablePercent != null ? Number(row.tablePercent) : null,
  depthPercent: row.depthPercent != null ? Number(row.depthPercent) : null,
  rapPrice: row.rapPrice != null ? Number(row.rapPrice) : null,
  fancyIntensity: row.fancyIntensity ?? "",
  fancyColor: row.fancyColor ?? "",
  fancyOvertone: row.fancyOvertone ?? "",
  fancyColor2: row.fancyColor2 ?? "",
  fancyOvertone2: row.fancyOvertone2 ?? "",
  pairSku: row.pairSku ?? null,
  groupingType: row.groupingType ?? "",
  box: row.box ?? "",
  stones: row.stones != null ? Number(row.stones) : null,
  homePage: row.homePage ?? "",
  tradeShow: row.tradeShow ?? "",
  updatedAt: row.updatedAt ?? null,
  assignedTo: row.assignedTo || null,
  assignedBy: row.assignedBy || null,
  assignmentNotes: row.assignmentNotes || null,
  assignmentUpdated: row.assignmentUpdated || null,
});

export const normalizeCatalogJewelry = (row, idx) => {
  const images = (row.all_pictures_link || "").split(";").map((u) => u.trim()).filter(Boolean);
  const sku = row.model_number || "";
  return {
    id: `jwl_${idx}_${sku || idx}`,
    source: "catalog",
    detailHref: sku ? `/jewelry/${sku}` : null,
    sku,
    stockNumber: row.stock_number || "",
    title: sanitizeText(row.title) || "",
    jewelryType: row.jewelry_type || "",
    style: row.style || "",
    collection: row.collection || "",
    priceTotal: row.price || 0,
    imageUrl: images[0] || null,
    allImages: images,
    videoLink: row.video_link || "",
    certificateLink: row.certificate_link || "",
    certificateNumber: row.certificate_number || "",
    description: sanitizeText(row.description) || "",
    fullDescription: sanitizeText(row.full_description) || "",
    jewelryWeight: row.jewelry_weight || "",
    weightCt: row.total_carat || 0,
    stoneType: (row.stone_type || "").replace(/\s+O$/i, "").trim(),
    centerStoneCarat: row.center_stone_carat || 0,
    shape: row.center_stone_shape || "",
    color: row.center_stone_color || "",
    clarity: row.center_stone_clarity || "",
    metalType: row.metal_type || "",
    currency: row.currency || "USD",
    availability: row.availability || "",
    shippingFrom: row.shipping_from || "",
    category: "Jewelry",
    jewelrySize: row.jewelry_size || "",
  };
};

/* Workshop pieces. Field names diverge (name vs title, cover_image_url vs
 * all_pictures_link, sale_price vs price, metal_summary vs metal_type), so
 * they are mapped into the same unified shape as catalog jewelry. */
export const normalizeWorkshopJewelry = (row) => ({
  id: `ws_${row.id}`,
  source: "workshop",
  workshopId: row.id,
  workshopStatus: row.status || "draft",
  workshopType: row.type || "",
  detailHref: `/jewelry/items/${row.id}`,
  sku: row.sku || "",
  stockNumber: "",
  title: sanitizeText(row.name) || row.sku || "",
  jewelryType: row.category || row.type || "",
  style: "",
  collection: "",
  priceTotal: Number(row.sale_price ?? row.total_cost ?? 0),
  imageUrl: row.cover_image_url || null,
  allImages: row.cover_image_url ? [row.cover_image_url] : [],
  videoLink: "",
  certificateLink: "",
  certificateNumber: "",
  description: sanitizeText(row.description) || "",
  fullDescription: sanitizeText(row.internal_notes) || sanitizeText(row.description) || "",
  jewelryWeight: row.weight_grams ?? "",
  weightCt: 0,
  stoneType: "",
  centerStoneCarat: 0,
  shape: "",
  color: "",
  clarity: "",
  metalType: row.metal_summary || "",
  currency: "USD",
  availability: row.status === "sold" ? "Sold" : row.status === "ready" ? "Ready" : "In production",
  shippingFrom: row.location || "",
  category: "Jewelry",
  jewelrySize: row.size || "",
});

/* ---------------- Classification ---------------- */

export const isJewelryItem = (item) =>
  (item?.category || "").toLowerCase() === "jewelry" || Boolean(item?.jewelryType);

export const stoneMode = (stone) =>
  getMappedCategories(stone.category).includes("Diamond") ? "diamonds" : "gemstones";

export const itemsForMode = (mode, stones, jewelryItems, jewelrySource = "all") => {
  if (mode === "jewelry") {
    if (jewelrySource === "workshop") return jewelryItems.filter((j) => j.source === "workshop");
    if (jewelrySource === "catalog") return jewelryItems.filter((j) => j.source === "catalog");
    return jewelryItems;
  }
  return stones.filter((stone) => stoneMode(stone) === mode);
};

/* Measurements arrive as "11.92-7.85-5.60" (length-width-depth). */
export const parseMeasurements = (measurements) => {
  if (!measurements) return { length: null, width: null, depth: null };
  const parts = measurements.split("-").map((p) => parseFloat(p.trim()));
  return {
    length: parts[0] && !isNaN(parts[0]) ? parts[0] : null,
    width: parts[1] && !isNaN(parts[1]) ? parts[1] : null,
    depth: parts[2] && !isNaN(parts[2]) ? parts[2] : null,
  };
};

export const hasSmartTerms = (ss) =>
  Boolean(
    ss &&
      (ss.shapes.length > 0 ||
        ss.weight ||
        ss.weightRange ||
        ss.clarities.length > 0 ||
        ss.colors.length > 0 ||
        ss.categories.length > 0 ||
        ss.treatments.length > 0 ||
        ss.locations.length > 0 ||
        ss.labs.length > 0 ||
        ss.origins.length > 0 ||
        ss.skus.length > 0 ||
        ss.fancyColors.length > 0 ||
        ss.groupingTypes.length > 0 ||
        ss.pricePerCt)
  );

/* ---------------- Filtering ---------------- */

const filterJewelry = (items, { filters, skuQuery, smartSearch }) =>
  items.filter((item) => {
    if (skuQuery.terms.length > 0) {
      const itemSku = canonicalSku(item.sku);
      const itemTitle = canonicalSku(item.title);
      if (!skuQuery.terms.some((q) => itemSku.includes(q) || itemTitle.includes(q))) return false;
    }
    if (filters.minPrice && item.priceTotal < Number(filters.minPrice)) return false;
    if (filters.maxPrice && item.priceTotal > Number(filters.maxPrice)) return false;
    if (filters.minCarat && item.weightCt < Number(filters.minCarat)) return false;
    if (filters.maxCarat && item.weightCt > Number(filters.maxCarat)) return false;
    if (filters.category.length > 0 && !filters.category.includes(item.jewelryType)) return false;
    if (filters.shape.length > 0 && !filters.shape.includes(item.style)) return false;
    if (filters.treatment.length > 0 && !filters.treatment.includes(item.collection)) return false;
    if (filters.diamondColor.length > 0 && !filters.diamondColor.includes((item.stoneType || "").trim())) return false;
    if (filters.fancyColor.length > 0 && !filters.fancyColor.includes(item.metalType)) return false;
    if (smartSearch) {
      const q = smartSearch.toLowerCase();
      const searchable = [item.sku, item.title, item.jewelryType, item.style, item.collection, item.stoneType, item.metalType, item.description]
        .join(" ")
        .toLowerCase();
      if (!searchable.includes(q)) return false;
    }
    return true;
  });

const filterStones = (items, { filters, skuQuery, parsedSearch, priceMode, stoneTags }) => {
  const ss = parsedSearch;
  const hasSmartSearch = hasSmartTerms(ss);
  return items.filter((stone) => {
    if (skuQuery.terms.length > 0) {
      // Matching stays exact per SKU — a rep pasting a list wants those
      // stones, not everything whose SKU contains them.
      const stoneSku = canonicalSku(stone.sku);
      if (!skuQuery.terms.some((term) => stoneSku === term)) return false;
    }
    const priceScale = inventoryPriceScale(stone, priceMode);
    const effectiveTotal = stone.priceTotal != null ? stone.priceTotal * priceScale : stone.priceTotal;
    const effectivePPC = stone.pricePerCt != null ? stone.pricePerCt * priceScale : stone.pricePerCt;
    if (filters.minPrice && effectiveTotal != null && effectiveTotal < Number(filters.minPrice)) return false;
    if (filters.maxPrice && effectiveTotal != null && effectiveTotal > Number(filters.maxPrice)) return false;
    if (filters.minPricePerCt && effectivePPC != null && effectivePPC < Number(filters.minPricePerCt)) return false;
    if (filters.maxPricePerCt && effectivePPC != null && effectivePPC > Number(filters.maxPricePerCt)) return false;
    if (filters.minCarat && stone.weightCt != null && stone.weightCt < Number(filters.minCarat)) return false;
    if (filters.maxCarat && stone.weightCt != null && stone.weightCt > Number(filters.maxCarat)) return false;

    const dims = parseMeasurements(stone.measurements);
    if (filters.minLength && dims.length != null && dims.length < Number(filters.minLength)) return false;
    if (filters.maxLength && dims.length != null && dims.length > Number(filters.maxLength)) return false;
    if (filters.minWidth && dims.width != null && dims.width < Number(filters.minWidth)) return false;
    if (filters.maxWidth && dims.width != null && dims.width > Number(filters.maxWidth)) return false;

    if (filters.shape.length > 0 && !filters.shape.includes(stone.shape) && !getDnaShapes(stone.shape).some((dna) => filters.shape.includes(dna))) return false;
    if (filters.treatment.length > 0 && !filters.treatment.some((t) => stone.treatment?.toLowerCase() === t.toLowerCase())) return false;
    if (filters.category.length > 0 && !filters.category.some((c) => getMappedCategories(stone.category).includes(c))) return false;
    if (filters.location.length > 0 && !filters.location.includes(stone.location)) return false;
    // Lab — case-insensitive equality; blank/"N/A" never matches a picked lab.
    const labFilterValues = filters.lab || [];
    if (labFilterValues.length > 0) {
      const stoneLab = (stone.lab || "").trim().toUpperCase();
      if (!stoneLab || stoneLab === "N/A") return false;
      if (!labFilterValues.some((l) => stoneLab === String(l).toUpperCase())) return false;
    }

    if (filters.groupingType.length > 0) {
      const matchesAny = filters.groupingType.some((gt) => {
        if (gt === "Empty") return !stone.groupingType;
        return stone.groupingType?.toLowerCase() === gt.toLowerCase();
      });
      if (!matchesAny) return false;
    }

    // Diamond and fancy colour filters work independently.
    const hasDiamondFilter = filters.diamondColor.length > 0;
    const hasFancyFilter = filters.fancyColor.length > 0;
    if (hasDiamondFilter || hasFancyFilter) {
      const mapped = getMappedCategories(stone.category);
      const isDiamond = isDiamondColorStone(mapped);
      if (isDiamond) {
        if (hasDiamondFilter && !getDiamondColorGroups(stone.color).some((g) => filters.diamondColor.includes(g))) return false;
        if (!hasDiamondFilter && hasFancyFilter) return false;
      } else {
        if (hasFancyFilter) {
          const fc = [stone.fancyIntensity, stone.fancyColor].filter(Boolean).join(" ");
          if (!filters.fancyColor.includes(getBaseFancyColor(fc))) return false;
        }
        if (!hasFancyFilter && hasDiamondFilter) return false;
      }
    }

    if (filters.box && !(stone.box || "").toLowerCase().includes(filters.box.toLowerCase())) return false;

    if (filters.tag.length > 0) {
      const stoneTagList = stoneTags[stone.sku] || [];
      if (!filters.tag.some((tagName) => stoneTagList.some((t) => t.name === tagName))) return false;
    }

    if (hasSmartSearch) {
      if (ss.skus.length > 0) {
        const sku = (stone.sku || "").toUpperCase();
        if (!ss.skus.some((s) => sku === s)) return false;
      }
      if (ss.shapes.length > 0) {
        const stoneShapes = getDnaShapes(stone.shape).map((s) => s.toUpperCase());
        if (!ss.shapes.some((s) => stoneShapes.includes(s.toUpperCase()))) return false;
      }
      if (ss.categories.length > 0) {
        const mapped = getMappedCategories(stone.category);
        if (!ss.categories.some((c) => mapped.some((m) => m.toUpperCase() === c.toUpperCase()))) return false;
      }
      if (ss.weightRange) {
        const w = stone.weightCt;
        if (w == null || w < ss.weightRange.min || w > ss.weightRange.max) return false;
      } else if (ss.weight) {
        const tolerance = ss.weight * 0.15;
        const w = stone.weightCt;
        if (w == null || w < ss.weight - tolerance || w > ss.weight + tolerance) return false;
      }
      if (ss.pricePerCt) {
        const ppc = stone.pricePerCt != null ? stone.pricePerCt * inventoryPriceScale(stone, priceMode) : stone.pricePerCt;
        if (ppc == null || ppc < ss.pricePerCt.min || ppc > ss.pricePerCt.max) return false;
      }
      if (ss.clarities.length > 0) {
        const stoneClarity = (stone.clarity || "").toUpperCase().replace(/\s+/g, "");
        if (!ss.clarities.some((c) => stoneClarity === c || stoneClarity.startsWith(c))) return false;
      }
      if (ss.treatments.length > 0) {
        if (!ss.treatments.some((t) => (stone.treatment || "").toLowerCase() === t.toLowerCase())) return false;
      }
      if (ss.locations.length > 0) {
        if (!ss.locations.some((l) => (stone.location || "").toLowerCase() === l.toLowerCase())) return false;
      }
      if (ss.labs.length > 0) {
        if (!ss.labs.some((l) => (stone.lab || "").toUpperCase() === l.toUpperCase())) return false;
      }
      if (ss.origins.length > 0) {
        if (!ss.origins.some((o) => (stone.origin || "").toLowerCase().includes(o.toLowerCase()))) return false;
      }
      if (ss.groupingTypes.length > 0) {
        if (!ss.groupingTypes.some((gt) => (stone.groupingType || "").toLowerCase() === gt.toLowerCase())) return false;
      }
      if (ss.colors.length > 0) {
        const groups = getDiamondColorGroups(stone.color);
        if (!ss.colors.some((c) => groups.includes(c))) return false;
      }
      if (ss.fancyColors.length > 0) {
        const fc = [stone.fancyIntensity, stone.fancyColor].filter(Boolean).join(" ");
        const base = getBaseFancyColor(fc);
        if (!ss.fancyColors.some((c) => c.toUpperCase() === (base || "").toUpperCase())) return false;
      }
    }
    return true;
  });
};

export const filterItems = (items, ctx) =>
  ctx.mode === "jewelry" ? filterJewelry(items, ctx) : filterStones(items, ctx);

/* ---------------- Sorting ---------------- */

/* Picked stones float to the top. On the default sort, emerald cuts lead and
 * photographed stones come before the ones still waiting for a picture. */
export const sortItems = (items, sortConfig, selectedIds) => {
  const sorted = [...items];
  const { field, direction } = sortConfig;
  const dir = direction === "desc" ? -1 : 1;
  const isDefaultSort = field === "sku" && direction === "asc";
  sorted.sort((a, b) => {
    const aIsSelected = selectedIds.has(a.id) ? 1 : 0;
    const bIsSelected = selectedIds.has(b.id) ? 1 : 0;
    if (aIsSelected !== bIsSelected) return bIsSelected - aIsSelected;

    if (isDefaultSort) {
      const aIsEmerald = a.shape?.toUpperCase() === "EM" || a.shape?.toLowerCase().includes("emerald") ? 1 : 0;
      const bIsEmerald = b.shape?.toUpperCase() === "EM" || b.shape?.toLowerCase().includes("emerald") ? 1 : 0;
      if (aIsEmerald !== bIsEmerald) return bIsEmerald - aIsEmerald;

      const aHasImage = a.imageUrl ? 1 : 0;
      const bHasImage = b.imageUrl ? 1 : 0;
      if (aHasImage !== bHasImage) return bHasImage - aHasImage;
    }

    const aVal = a[field];
    const bVal = b[field];
    if (typeof aVal === "number" && typeof bVal === "number") return (aVal - bVal) * dir;
    return String(aVal || "").localeCompare(String(bVal || "")) * dir;
  });
  return sorted;
};

const STONE_SORTS = [
  { id: "default", label: "Recommended", field: "sku", direction: "asc" },
  { id: "sku-desc", label: "SKU, Z–A", field: "sku", direction: "desc" },
  { id: "weight-desc", label: "Weight, high to low", field: "weightCt", direction: "desc" },
  { id: "weight-asc", label: "Weight, low to high", field: "weightCt", direction: "asc" },
  { id: "price-desc", label: "Price, high to low", field: "priceTotal", direction: "desc" },
  { id: "price-asc", label: "Price, low to high", field: "priceTotal", direction: "asc" },
  { id: "ppc-desc", label: "Price per carat, high to low", field: "pricePerCt", direction: "desc" },
  { id: "ppc-asc", label: "Price per carat, low to high", field: "pricePerCt", direction: "asc" },
  { id: "shape", label: "Shape", field: "shape", direction: "asc" },
  { id: "lab", label: "Lab", field: "lab", direction: "asc" },
  { id: "location", label: "Location", field: "location", direction: "asc" },
];

const JEWELRY_SORTS = [
  { id: "default", label: "Recommended", field: "sku", direction: "asc" },
  { id: "sku-desc", label: "Model, Z–A", field: "sku", direction: "desc" },
  { id: "price-desc", label: "Price, high to low", field: "priceTotal", direction: "desc" },
  { id: "price-asc", label: "Price, low to high", field: "priceTotal", direction: "asc" },
  { id: "weight-desc", label: "Carats, high to low", field: "weightCt", direction: "desc" },
  { id: "title", label: "Title", field: "title", direction: "asc" },
  { id: "type", label: "Type", field: "jewelryType", direction: "asc" },
];

export const sortOptionsFor = (mode) => (mode === "jewelry" ? JEWELRY_SORTS : STONE_SORTS);

/* Label for whatever sort is active — including column-header sorts that the
 * menu doesn't list (e.g. Ratio ascending). */
export const describeSort = (mode, sortConfig, columnLabels = {}) => {
  const match = sortOptionsFor(mode).find(
    (o) => o.field === sortConfig.field && o.direction === sortConfig.direction
  );
  if (match) return match.label;
  const name = columnLabels[sortConfig.field] || sortConfig.field;
  return `${name}, ${sortConfig.direction === "asc" ? "ascending" : "descending"}`;
};

/* ---------------- Pairs ---------------- */

export const isPairOnly = (filters) =>
  filters.groupingType.length === 1 && filters.groupingType.includes("Pair");

/* Partners are looked up across every loaded stone, not just the filtered
 * ones, so a pair still renders when only one half matches. */
export const buildPairGroups = (sortedStones, allStones) => {
  const skuMap = {};
  allStones.forEach((s) => {
    skuMap[s.sku] = s;
  });
  const visited = new Set();
  const groups = [];
  sortedStones.forEach((stone) => {
    if (visited.has(stone.sku)) return;
    visited.add(stone.sku);
    if (stone.pairSku) {
      visited.add(stone.pairSku);
      groups.push({ stoneA: stone, stoneB: skuMap[stone.pairSku] || null });
    }
  });
  return groups;
};

/* ---------------- Option lists ---------------- */

export const buildShapeOptions = (items) => {
  const set = new Set();
  items.forEach((s) => {
    if (s.shape) {
      getDnaShapes(s.shape).forEach((dna) => set.add(dna));
      if (EXTRA_BARAK_FILTERS.includes(s.shape)) set.add(s.shape);
    }
  });
  Object.values(BARAK_DISPLAY_NAMES).forEach((dn) => set.delete(dn));
  const all = Array.from(set).sort();
  return {
    all,
    main: LEVEL_1_SHAPES.filter((s) => set.has(s)),
    more: all.filter((s) => !LEVEL_1_SHAPES.includes(s)),
  };
};

export const shapeLabel = (value) => BARAK_DISPLAY_NAMES[value] || value;

export const buildCategoryOptions = (items) => {
  const set = new Set();
  items.forEach((s) => getMappedCategories(s.category).forEach((cat) => set.add(cat)));
  set.delete("Empty");
  // "Empty" (no category) is always offered, last.
  return [...Array.from(set).sort(), "Empty"];
};

export const buildDiamondColorOptions = (items) => {
  const set = new Set();
  items.forEach((s) => {
    const mapped = getMappedCategories(s.category);
    if (isDiamondColorStone(mapped) && s.color) getDiamondColorGroups(s.color).forEach((g) => set.add(g));
  });
  return DIAMOND_FILTER_GROUPS.filter((g) => set.has(g));
};

export const buildFancyColorOptions = (items) => {
  const set = new Set();
  items.forEach((s) => {
    const mapped = getMappedCategories(s.category);
    if (!isDiamondColorStone(mapped)) {
      const base = getBaseFancyColor([s.fancyIntensity, s.fancyColor].filter(Boolean).join(" "));
      if (base) set.add(base);
    }
  });
  return Array.from(set).sort((a, b) => {
    if (a === "Other") return 1;
    if (b === "Other") return -1;
    return a.localeCompare(b);
  });
};

/* Canonical labs are always offered (useful before data loads), plus any
 * other lab present in this tab's stones. */
export const buildLabOptions = (items) => {
  const set = new Set(CANONICAL_LABS);
  items.forEach((s) => {
    const lab = (s.lab || "").trim();
    if (lab && lab.toUpperCase() !== "N/A") set.add(lab.toUpperCase());
  });
  return Array.from(set).sort();
};

export const distinctValues = (items, getValue) => {
  const set = new Set();
  items.forEach((item) => {
    const v = String(getValue(item) ?? "").trim();
    if (v) set.add(v);
  });
  return Array.from(set).sort();
};

export const buildJewelryOptions = (jewelryItems) => ({
  type: distinctValues(jewelryItems, (j) => j.jewelryType),
  style: distinctValues(jewelryItems, (j) => j.style),
  collection: distinctValues(jewelryItems, (j) => j.collection),
  stoneType: distinctValues(jewelryItems, (j) => (j.stoneType || "").trim()),
  metal: distinctValues(jewelryItems, (j) => j.metalType),
});

/* ---------------- Active filter descriptors ---------------- */

/* Jewelry reuses the stone filter keys with different meanings. */
export const FILTER_LABELS = {
  stones: {
    shape: "Shape",
    category: "Category",
    treatment: "Clarity",
    location: "Location",
    lab: "Lab",
    groupingType: "Grouping",
    diamondColor: "Color",
    fancyColor: "Fancy color",
    tag: "Tag",
  },
  jewelry: {
    category: "Type",
    shape: "Style",
    treatment: "Collection",
    diamondColor: "Stone",
    fancyColor: "Metal",
  },
};

const trimNum = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
};

export const formatRange = (min, max, { prefix = "", suffix = "" } = {}) => {
  const f = (v) => `${prefix}${trimNum(v)}${suffix}`;
  if (min && max) return `${prefix}${trimNum(min)}–${trimNum(max)}${suffix}`;
  if (min) return `≥ ${f(min)}`;
  if (max) return `≤ ${f(max)}`;
  return "";
};

const RANGE_FILTERS = [
  { id: "carat", min: "minCarat", max: "maxCarat", format: (a, b) => formatRange(a, b, { suffix: " ct" }) },
  { id: "price", min: "minPrice", max: "maxPrice", format: (a, b) => formatRange(a, b, { prefix: "$" }) },
  { id: "ppc", min: "minPricePerCt", max: "maxPricePerCt", format: (a, b) => `${formatRange(a, b, { prefix: "$" })}/ct` },
  { id: "length", min: "minLength", max: "maxLength", format: (a, b) => `Length ${formatRange(a, b, { suffix: " mm" })}` },
  { id: "width", min: "minWidth", max: "maxWidth", format: (a, b) => `Width ${formatRange(a, b, { suffix: " mm" })}` },
];

const LIST_KEYS = ["shape", "category", "diamondColor", "fancyColor", "treatment", "lab", "groupingType", "location", "tag"];

const listValueLabel = (key, value, isJewelry) => {
  if (isJewelry) return value;
  switch (key) {
    case "shape":
      return shapeLabel(value);
    case "diamondColor":
      return `Color ${value}`;
    case "fancyColor":
      return `Fancy ${value}`;
    case "groupingType":
      return value === "Empty" ? "No grouping" : value;
    case "category":
      return value === "Empty" ? "No category" : value;
    case "tag":
      return `Tag: ${value}`;
    case "treatment":
      return `Clarity: ${value}`;
    default:
      return value;
  }
};

/* One chip per active value, in the order the filter panel lists them. The
 * SKU search is deliberately not a chip — the search field shows it. */
export const activeFilterChips = (filters, { mode, smartSearch = "", jewelrySource = "all", assignee = "all", assigneeLabel } = {}) => {
  const isJewelry = mode === "jewelry";
  const chips = [];
  if (smartSearch.trim()) chips.push({ id: "smart", label: `“${smartSearch.trim()}”`, remove: { type: "smart" } });
  if (isJewelry && jewelrySource !== "all") {
    chips.push({ id: "src", label: jewelrySource === "workshop" ? "Workshop" : "Catalog", remove: { type: "source" } });
  }
  LIST_KEYS.forEach((key) => {
    (filters[key] || []).forEach((value) => {
      chips.push({
        id: `${key}:${value}`,
        label: listValueLabel(key, value, isJewelry),
        remove: { type: "list", key, value },
      });
    });
  });
  RANGE_FILTERS.forEach((r) => {
    const a = filters[r.min];
    const b = filters[r.max];
    if (a || b) chips.push({ id: r.id, label: r.format(a, b), remove: { type: "range", keys: [r.min, r.max] } });
  });
  if (filters.box) chips.push({ id: "box", label: `Box “${filters.box}”`, remove: { type: "text", key: "box" } });
  if (assignee && assignee !== "all") {
    chips.push({ id: "assignee", label: assigneeLabel || "Assigned", remove: { type: "assignee" } });
  }
  return chips;
};

export const applyChipRemoval = (filters, remove) => {
  switch (remove.type) {
    case "list":
      return { ...filters, [remove.key]: (filters[remove.key] || []).filter((v) => v !== remove.value) };
    case "range":
      return remove.keys.reduce((acc, k) => ({ ...acc, [k]: "" }), { ...filters });
    case "text":
      return { ...filters, [remove.key]: "" };
    default:
      return filters;
  }
};

export const countGroupActive = (filters, keys) =>
  keys.reduce((n, k) => {
    const v = filters[k];
    if (Array.isArray(v)) return n + v.length;
    return n + (v ? 1 : 0);
  }, 0);

/* ---------------- Display helpers ---------------- */

export const scaledPrice = (item, field, priceMode) => {
  const v = item?.[field];
  if (!v) return null;
  if (isJewelryItem(item)) return Math.round(v);
  return Math.round(v * inventoryPriceScale(item, priceMode));
};

export const formatMoney = (value, currency) => {
  if (value == null) return "";
  const symbol = currency && currency !== "USD" ? `${currency} ` : "$";
  return `${symbol}${value.toLocaleString("en-US")}`;
};

export const formatCarat = (weight) => {
  if (weight == null || weight === "" || Number(weight) === 0) return "";
  const n = Number(weight);
  return `${Number.isFinite(n) ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : weight} ct`;
};

export const stoneTitle = (stone) => {
  const shape = getDisplayShape(stone.shape);
  const ct = formatCarat(stone.weightCt);
  return [ct, shape].filter(Boolean).join(" ") || stone.sku;
};

export const dnaPathFor = (item) => {
  if (!item?.sku && !item?.detailHref) return null;
  if (isJewelryItem(item)) return item.detailHref || (item.sku ? `/jewelry/${item.sku}` : null);
  return `/${item.sku}`;
};

export const shareUrlFor = (item) => {
  if (isJewelryItem(item)) {
    return item.source === "workshop"
      ? `https://gems-dna.com/jewelry/items/${item.workshopId}`
      : `https://gems-dna.com/jewelry/${item.sku}`;
  }
  return `https://gems-dna.com/${item.sku}`;
};
