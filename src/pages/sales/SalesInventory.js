import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { fetchSoapStones } from "../../services/stonesApi";
import { useTeam } from "../../context/TeamContext";
import { getDisplayShape, getDisplayColor, shortTreatment } from "../inventory/helpers/constants";
import { getMappedCategories } from "../../utils/categoryMap";
import { DIAMOND_SHAPES } from "./diamondShapes";
import BarcodeScanner from "../inventory/components/BarcodeScanner";
import placeholderImg from "../../assets/stone-placeholder.jpg";
import { useSelection } from "../../context/SelectionContext";
import {
  trackCategoryView,
  trackSearch,
  trackFilter,
  trackSort,
  trackZeroResults,
} from "../../utils/activityLog";

/* The sales catalog is split into three category surfaces that all share this
 * same card grid. The category map resolves e.g. "Sapphire O" -> ["Sapphire"],
 * "Diamond O" -> ["Diamond"], "Fancy" -> ["Diamond","Fancy"],
 * "Emerald O" -> ["Emerald"]. Each mode keeps a disjoint slice so the three
 * pages never overlap:
 *   - diamond  : diamonds + fancy-colour diamonds
 *   - emerald  : emeralds only
 *   - gemstone : every coloured stone EXCEPT diamonds, fancies and emeralds
 */
const MODES = {
  diamond: {
    title: "Diamonds",
    noun: "diamonds",
    test: (m) => m.includes("Diamond") || m.includes("Fancy"),
  },
  emerald: {
    title: "Emeralds",
    noun: "emeralds",
    test: (m) => m.includes("Emerald"),
  },
  gemstone: {
    title: "Sales Inventory",
    noun: "gemstones",
    test: (m) => !m.includes("Diamond") && !m.includes("Fancy") && !m.includes("Emerald"),
  },
};

/* Resolve which catalog surface a stone belongs to from its category. Used by
 * the cross-category selection view, where each picked stone has to render with
 * its own mode's card layout regardless of which page it was added from. */
export const modeForStone = (stone) => {
  const m = getMappedCategories(stone?.category);
  if (MODES.diamond.test(m)) return "diamond";
  if (MODES.emerald.test(m)) return "emerald";
  return "gemstone";
};

/* ============================================================================
 * Sales Inventory — a salesperson-focused gemstone browser.
 *
 * Shows every stone in inventory as a 2-up card grid (image on top, details
 * below). Instead of numbered pages it uses infinite scroll: an
 * IntersectionObserver at the bottom reveals the next batch as the user
 * scrolls, so it reads like the page "flips" to the next set of stones.
 * ========================================================================== */

const PAGE_SIZE = 12;

/* Quick carat bands for the diamond Size filter. Clicking one fills the
 * From/To fields; the last band is open-ended (5ct and up). */
const SIZE_PRESETS = [
  { label: "0.00 - 0.99", from: "0.00", to: "0.99" },
  { label: "0.99 - 1.99", from: "0.99", to: "1.99" },
  { label: "1.99 - 2.99", from: "1.99", to: "2.99" },
  { label: "2.99 - 3.99", from: "2.99", to: "3.99" },
  { label: "3.99 - 5.00", from: "3.99", to: "5.00" },
  { label: "5.00 - 15.00", from: "5.00", to: "15.00" },
  { label: "15.00 +", from: "15.00", to: "" },
];

/* Price-per-carat quick bands ($). Open-ended on the first/last band. */
const PPC_PRESETS = [
  { label: "Up to 1K", from: "", to: "1000" },
  { label: "1K - 5K", from: "1000", to: "5000" },
  { label: "5K - 10K", from: "5000", to: "10000" },
  { label: "10K - 20K", from: "10000", to: "20000" },
  { label: "20K & Up", from: "20000", to: "" },
];
/* Total-price quick bands ($). */
const TOTAL_PRESETS = [
  { label: "Up to 5K", from: "", to: "5000" },
  { label: "5K - 10K", from: "5000", to: "10000" },
  { label: "10K - 50K", from: "10000", to: "50000" },
  { label: "50K - 100K", from: "50000", to: "100000" },
  { label: "100K & Up", from: "100000", to: "" },
];

/* Diamond colour grades (white) and the fancy-colour sub-filters that replace
 * them when the Fancy segment is active. */
const COLOR_GRADES = "DEFGHIJKLMNOPQRSTUVWXYZ".split("");
const FANCY_INTENSITY = [
  "Faint",
  "Very Faint",
  "Light",
  "Fancy Light",
  "Fancy",
  "Fancy Dark",
  "Fancy Intense",
  "Fancy Vivid",
  "Fancy Deep",
];
const FANCY_COLORS = [
  "Yellow",
  "Pink",
  "Green",
  "Blue",
  "Orange",
  "Brown",
  "Black",
];
const CLARITY_GRADES = [
  "FL",
  "IF",
  "VVS1",
  "VVS2",
  "VS1",
  "VS2",
  "SI1",
  "SI2",
  "SI3",
  "I1",
  "I2",
  "I3",
];
const LAB_OPTIONS = ["GIA", "HRD", "IGI", "EGL"];
const LOCATION_OPTIONS = ["HK", "IL", "LA", "NY"];
// Emerald-specific option sets.
const EMERALD_LAB_OPTIONS = ["GRS", "SSEF", "Gübelin", "GIA", "AGL", "CDC"];
const TREATMENT_OPTIONS = ["No Oil", "Insignificant", "Minor", "Moderate", "Significant"];
const ORIGIN_OPTIONS = ["Colombia", "Zambia", "Brazil", "Madagascar"];
const EMERALD_PARCEL_OPTIONS = ["Single", "Pair", "Set", "Parcel"];
// Gemstone-specific option sets. "Other" always means "matches none of the
// explicitly-listed values above it".
const GEM_COLORS = [
  { key: "Green", swatch: "#1f9d57" },
  { key: "Blue", swatch: "#2563eb" },
  { key: "Violet", swatch: "#7c3aed" },
  { key: "Pink", swatch: "#ec4899" },
  { key: "Red", swatch: "#dc2626" },
  { key: "Other", swatch: null },
];
// Color word roots used to bucket a stone (matched against category + colour
// fields, since the colour column is mostly empty for coloured stones).
const GEM_COLOR_ROOTS = {
  Green: ["GREEN"],
  Blue: ["BLUE"],
  Violet: ["VIOLET", "PURPLE"],
  Pink: ["PINK"],
  Red: ["RED"],
};
const GEM_TYPE_OPTIONS = [
  "Tourmaline",
  "Aquamarine",
  "Rubellite",
  "Ruby",
  "Sapphire",
  "Tanzanite",
  "Morganite",
  "Amethyst",
  "Tsavorite",
  "Kunzite",
  "Spinel",
  "Other",
];
const GEM_LAB_OPTIONS = ["AGL", "GRS", "GIA", "ICA", "GWL", "SIG", "Other"];
const GEM_COMMENTS_OPTIONS = ["Heated", "No Heat", "None"];
const GEM_ORIGIN_OPTIONS = ["Madagascar", "Vietnam", "Mozambique", "Other"];

/* Neutral (empty) value for every filter facet. Used to hydrate a category's
 * saved filters and to backfill any keys missing from an older snapshot. */
const FILTER_DEFAULTS = {
  shapeSel: [], sizeFrom: "", sizeTo: "", sizeBands: [],
  ppcFrom: "", ppcTo: "", ppcBands: [], totalFrom: "", totalTo: "", totalBands: [],
  lenFrom: "", lenTo: "", widthFrom: "", widthTo: "", ratioFrom: "", ratioTo: "",
  colorMode: "white", colorGrades: [], fancyIntensity: [], fancyColor: [],
  claritySel: [], labSel: [], locationSel: [], treatmentSel: [], originSel: [],
  gemColorSel: [], gemTypeSel: [], cutSel: [], polishSel: [], symmetrySel: [],
  fluorSel: [], parcelSel: ["Single"], onlyCert: false, onlyMedia: false, onlyInStock: false,
  skuQuery: "", sortBy: [],
};
/* Per-category filter persistence. Each mode (diamond / emerald / gemstone)
 * keeps its own snapshot in localStorage, so switching between catalogs — or
 * leaving and coming back later — restores exactly what was filtered. */
const filtersKey = (mode) => `salesFilters:v2:${mode}`;
const loadSavedFilters = (mode) => {
  try {
    const raw = localStorage.getItem(filtersKey(mode));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};
/* Advanced (collapsed by default) finish grades + fluorescence. */
const GRADE_EVGF = ["EX", "VG", "G", "F"];
const FLUOR_OPTIONS = ["None", "Faint", "Med.", "Strong"];
// Diamonds only deal in Single / Pair; Set & Parcel will live under Emeralds.
const PARCEL_OPTIONS = ["Single", "Pair"];

/* Add/remove a value from a multi-select array state setter. */
const toggleVal = (setter, val) =>
  setter((cur) => (cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val]));

/* ---- Filter matching maps -------------------------------------------------
 * Inventory shape/grade values come from the Barak export in varied forms
 * (raw codes like "RD"/"ASH", DNA names like "Round", and full words). Each
 * filter key maps to the set of tokens that should match a stone's raw shape
 * code OR its resolved DNA shape name. Shapes with no data equivalent simply
 * match nothing. */
export const SHAPE_MATCH = {
  Round: ["RD", "BR", "ROUND"],
  Oval: ["OV", "MOVAL", "OVAL"],
  Emerald: ["EC", "EM", "SQEC", "EMERALD"],
  Pear: ["PS", "PEAR"],
  Square: ["SQ", "CARRE"],
  Heart: ["HS", "HEART"],
  Marquise: ["MQ", "MARQUISE"],
  Cushion: ["CU", "CB", "CMB", "CUSHION"],
  Octagonal: ["OCT", "OCTAGON", "OCTAGONAL"],
  Radiant: ["RAD", "RADIANT"],
  Asscher: ["ASH", "ASSCHER"],
  Cabochon: ["CAB", "CABUSHON", "CABOCHON", "HD", "SUGAR", "SUGARLOAF"],
  Trilliant: ["TR", "TRIANGLE", "TRILLIANT"],
  Baguette: ["BGT", "BAGUETTE"],
  TaperedBaguette: ["TPR", "TAPER"],
  Kite: ["KITE"],
  Lozenge: ["LOZENGE", "LOZ"],
  Bullets: ["BULLET", "BULLETS"],
  Hexagonal: ["HEX", "HEXAGON", "HEXAGONAL"],
  Pentagonal: ["PENTAGON", "PENTAGONAL"],
  Triangular: ["TR", "TRIANGLE", "TRIANGULAR"],
  Shield: ["SHI", "SHIELD"],
  Rose: ["ROSE", "RRC"],
  Briolette: ["BRIO", "BRIOLLETE", "BRIOLETTE"],
  EuropeanCut: ["EUROPEAN", "EUR"],
  Flanders: ["FLANDERS"],
  SquareRadiant: ["SQRAD", "SQUARE RADIANT"],
  CushionBrilliant: ["CUSHION BRILLIANT"],
  CushionModified: ["CUSHION MODIFIED"],
  OldMine: ["OM", "OMB", "OLD MINE"],
};
const LOCATION_MATCH = {
  HK: ["HK", "HONG KONG"],
  IL: ["IL", "ISRAEL"],
  LA: ["LA", "LOS ANGELES"],
  NY: ["NY", "NEW YORK"],
};
const GRADE_MATCH = {
  EX: ["EX", "EXCELLENT", "ID", "IDEAL"],
  VG: ["VG", "VERY GOOD"],
  G: ["G", "GOOD"],
  F: ["F", "FAIR"],
};
const FLUOR_MATCH = {
  None: ["NONE", "NON", "NO", "N"],
  Faint: ["FAINT", "FNT", "FN"],
  "Med.": ["MED", "MEDIUM"],
  Strong: ["STRONG", "STG", "VERY STRONG"],
};

export const norm = (v) => (v == null ? "" : String(v).trim().toUpperCase());

/* Facet matcher with an "Other" bucket: a stone passes when its text contains
 * any selected known option, or — if "Other" is selected — none of the known
 * (non-Other) options. `known` is the full option list (including "Other"). */
const matchWithOther = (text, selected, known) => {
  if (!selected.length) return true;
  const t = norm(text);
  const knownVals = known.filter((o) => o !== "Other");
  const hit = (o) => t.includes(norm(o));
  if (selected.some((o) => o !== "Other" && hit(o))) return true;
  if (selected.includes("Other") && !knownVals.some(hit)) return true;
  return false;
};

/* Gemstone colour bucket: matches the colour-word roots against the combined
 * category + colour text. "Other" = none of the five colour roots present. */
const matchGemColor = (s, selected) => {
  if (!selected.length) return true;
  const t = norm([s.category, s.color, s.fancyColor, s.fancyIntensity].filter(Boolean).join(" "));
  const hitColor = (key) => (GEM_COLOR_ROOTS[key] || []).some((r) => t.includes(r));
  if (selected.some((c) => c !== "Other" && hitColor(c))) return true;
  if (selected.includes("Other") && !Object.keys(GEM_COLOR_ROOTS).some(hitColor)) return true;
  return false;
};

/* Gemstone "Comments" (heat treatment) bucket. Raw values seen: "No Heat",
 * "H", "None", "" — map them onto the three offered options. */
const matchGemComments = (treatment, selected) => {
  if (!selected.length) return true;
  const t = norm(treatment);
  return selected.some((opt) => {
    if (opt === "No Heat") return t.includes("NO HEAT") || t === "NH";
    if (opt === "Heated")
      return t === "H" || t.includes("HEATED") || (t.includes("HEAT") && !t.includes("NO HEAT"));
    if (opt === "None") return t === "" || t === "NONE" || t === "NON" || t === "N/A";
    return false;
  });
};

/* Parse a measurement string ("14.94-11.75-6.62" / "14.94 x 11.75 x 6.62")
 * into [length, width, depth] numbers. */
export const parseDims = (m) =>
  String(m || "")
    .split(/[^\d.]+/)
    .map(parseFloat)
    .filter((n) => !isNaN(n));

/* True when `val` falls inside an optional [from, to] range. A set bound with
 * a missing value fails (we can't confirm it's in range). */
const inRange = (val, from, to) => {
  if (from) {
    if (typeof val !== "number" || val < parseFloat(from)) return false;
  }
  if (to) {
    if (typeof val !== "number" || val > parseFloat(to)) return false;
  }
  return true;
};

/* A money facet (custom From/To OR any selected quick band) passes a value.
 * Inactive (no bounds, no bands) → always true; a value that can't be parsed
 * fails once the facet is active. */
const priceOk = (value, from, to, bands, presets) => {
  if (!from && !to && !bands.length) return true;
  const n = parseFloat(value);
  if (isNaN(n)) return false;
  if (from || to) {
    const f = from ? parseFloat(from) : -Infinity;
    const t = to ? parseFloat(to) : Infinity;
    if (n >= f && n <= t) return true;
  }
  return bands.some((label) => {
    const b = presets.find((p) => p.label === label);
    if (!b) return false;
    const f = b.from ? parseFloat(b.from) : -Infinity;
    const t = b.to ? parseFloat(b.to) : Infinity;
    return n >= f && n <= t;
  });
};

/* Sort facets offered in the Sort sheet (priority follows selection order). */
const SORT_OPTIONS = [
  { key: "pricePerCt", label: "Price per ct", type: "num", field: "pricePerCt" },
  { key: "priceTotal", label: "Total price", type: "num", field: "priceTotal" },
  { key: "rapPrice", label: "Rap price", type: "num", field: "rapPrice" },
  { key: "shape", label: "Shape", type: "shape" },
  { key: "size", label: "Size", type: "num", field: "weightCt" },
  { key: "color", label: "Color", type: "color" },
  { key: "clarity", label: "Clarity", type: "clarity" },
];

/* Comparable value for a stone under a sort option; null = missing (sorts last
 * regardless of direction). Colour/clarity map to their grade order. */
const sortValue = (s, opt) => {
  switch (opt.type) {
    case "num": {
      const n = Number(s[opt.field]);
      return Number.isFinite(n) ? n : null;
    }
    case "shape": {
      const v = getDisplayShape(s.shape);
      return v ? String(v) : null;
    }
    case "color": {
      const i = COLOR_GRADES.indexOf(norm(s.color)[0]);
      return i >= 0 ? i : null;
    }
    case "clarity": {
      const i = CLARITY_GRADES.indexOf(norm(s.clarity));
      return i >= 0 ? i : null;
    }
    default:
      return null;
  }
};

/* Fallback artwork shown when a stone has no usable photo (or its URL fails
 * to load): a branded dark-emerald tile with a gold line-art gem. */
export const StonePlaceholder = ({ alt = "" }) => (
  <img
    src={placeholderImg}
    alt={alt}
    loading="lazy"
    className="h-full w-full object-cover"
  />
);

/* The clean gem type (Emerald / Sapphire / Ruby …) from the category map,
 * dropping the bookkeeping tags ("Empty", and the already-excluded
 * Diamond/Fancy). */
const gemType = (s) => {
  const mapped = getMappedCategories(s.category).filter(
    (c) => c !== "Empty" && c !== "Diamond" && c !== "Fancy"
  );
  return mapped[0] || "";
};

/* "Green, Emerald, Pear, 8.74 ct" — colour, type, shape, weight. */
const buildTitle = (s) => {
  const color = getDisplayColor(s);
  const type = gemType(s);
  const shape = getDisplayShape(s.shape);
  const ct = s.weightCt != null && s.weightCt !== "" ? `${s.weightCt} ct` : "";
  return [color, type, shape, ct].filter(Boolean).join(", ");
};

/* Human-readable fluorescence from the Barak single-letter codes. */
const FLUOR_DISPLAY = {
  N: "None", NON: "None", NONE: "None",
  F: "Faint", FNT: "Faint", FAINT: "Faint",
  M: "Med.", MED: "Med.", MEDIUM: "Med.",
  S: "Strong", STG: "Strong", STRONG: "Strong",
  VS: "Very Strong", VST: "Very Strong", "VERY STRONG": "Very Strong",
};
export const fluorDisplay = (v) => FLUOR_DISPLAY[norm(v)] || v || "";

/* "$12,500" — whole-dollar money formatting. */
export const money = (n) => {
  const num = Number(n);
  if (!isFinite(num) || !num) return null;
  return `$${num.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
};

/* In-house location names → clean display labels. Any non-empty location that
 * is NOT in this map is treated as the stone being out on memo (with a third
 * party), so we surface a "MEMO OUT" flag to the sales team. Keys are
 * normalised (upper-case, single-spaced). */
const LOCATION_MAP = {
  "EMERALD OFFICE": "IL OFFICE",
  OFFICE: "IL OFFICE",
  "ESHED DIAM INC - EY": "Eshed Diam NY",
  "ESHED DIAM INC - NY": "Eshed Diam NY",
  "EL - ESHED DIAM INC (LA)": "Eshed Diam LA",
  "ESHED DIAM HK EMERALDS": "Eshed Diam HK",
  "ESHED DIAM (HK) LTD": "Eshed Diam HK",
  "ESHED DESIGNS LTD": "Eshed Designs",
  // The cutting/oiling factory is ours — stones there are NOT on memo.
  FACTORY: "Factory",
  "FACTORY OILED": "Factory",
  "FACTORY - EY": "Factory",
  "FACTORY NEW": "Factory",
};
const normLoc = (v) => String(v || "").trim().replace(/\s+/g, " ").toUpperCase();

/* Resolve the location line + memo flag for a stone.
 *  - Known in-house location  -> clean label, not on memo.
 *  - Other (real company)     -> show it, flagged as MEMO OUT.
 *  - Empty                    -> fall back to branch/city, not on memo. */
export const resolveLocation = (s) => {
  const raw = s.exactLocation && String(s.exactLocation).trim() ? String(s.exactLocation).trim() : "";
  if (!raw) {
    // No exact place: either there genuinely isn't one, or the server hid it
    // for a restricted viewer (permissions). Fall back to the branch and trust
    // the server-provided `onMemo` flag for the MEMO OUT badge.
    return { label: s.location || s.branch || null, memo: !!s.onMemo };
  }
  const mapped = LOCATION_MAP[normLoc(raw)];
  if (mapped) return { label: mapped, memo: false };
  return { label: raw, memo: true };
};

/* Diamond title: "0.51 Round H SI1 None IGI"
 * weight · shape · color · clarity · fluorescence · cert lab. */
const buildDiamondTitle = (s) => {
  const wt =
    s.weightCt != null && s.weightCt !== "" ? Number(s.weightCt).toFixed(2) : "";
  const shape = getDisplayShape(s.shape);
  return [wt, shape, s.color, s.clarity, fluorDisplay(s.fluorescence), s.lab]
    .filter(Boolean)
    .join(" ");
};

/* Emerald title: "1.16 Pear ICA Minor"
 * weight · shape · cert lab · comments (oil treatment). */
const buildEmeraldTitle = (s) => {
  const wt =
    s.weightCt != null && s.weightCt !== "" ? Number(s.weightCt).toFixed(2) : "";
  const shape = getDisplayShape(s.shape);
  const lab = s.lab && String(s.lab).toUpperCase() !== "N/A" ? s.lab : "";
  const comments = s.treatment ? shortTreatment(s.treatment) : "";
  return [wt, shape, lab, comments].filter(Boolean).join(" ");
};

/* Many soap_stones rows carry a folder-only image URL (e.g. ".../StoneImages/")
 * with no filename — the Barak export emits the directory even when no photo
 * was uploaded, so the URL 404s and renders as a broken thumbnail. Treat those
 * as "no image": require a filename after the last slash, otherwise fall back
 * to the first usable additional picture, else show the placeholder. */
export const usableImg = (u) => {
  if (!u || typeof u !== "string") return null;
  const trimmed = u.trim();
  if (!trimmed) return null;
  const file = trimmed.split("?")[0].split("/").pop();
  return file ? trimmed : null;
};

export const stoneImage = (s) => {
  const main = usableImg(s.imageUrl);
  if (main) return main;
  const firstExtra = (s.additionalPictures || "").split(";")[0];
  return usableImg(firstExtra);
};

/* Sales-floor price policy (applied once at load time so cards, the product
 * page, the price filters, sorting and WhatsApp shares all see the same
 * adjusted figures). The DB now stores real prices, so:
 *   - Diamonds / Fancy / Emeralds → shown as-is (full price, straight from DB).
 *   - Other coloured gemstones → divided by 2 (half off). */
export const adjustSalesPrices = (s) => {
  const mapped = getMappedCategories(s.category);
  const showAsIs =
    mapped.includes("Diamond") ||
    mapped.includes("Fancy") ||
    mapped.includes("Emerald");
  const divisor = showAsIs ? 1 : 2;
  const adj = (v) =>
    v != null && v !== "" && isFinite(Number(v)) ? Number(v) / divisor : v;
  return { ...s, pricePerCt: adj(s.pricePerCt), priceTotal: adj(s.priceTotal) };
};

/* The Barak export sets `certificateUrl` to a folder path (".../Certificates/")
 * for almost every stone even when there is no cert, so its mere presence is
 * meaningless. A real certificate has a cert number, or a URL that points to an
 * actual file. */
export const hasCert = (s) =>
  Boolean(
    (s.certificateNumber && String(s.certificateNumber).trim()) ||
      usableImg(s.certificateUrl) ||
      usableImg(s.certificateImageJpg)
  );

/* A horizontally-scrolling chip row (scrollbar hidden, bleeds to the sheet
 * edges so chips can scroll under the padding). */
const ScrollRow = ({ children }) => (
  <div className="scrollbar-hide -mx-5 overflow-x-auto px-5">
    <div className="flex gap-2">{children}</div>
  </div>
);

/* Collapsible section divider — a centred label between two hairlines with a
 * gem glyph and a chevron, used to group/toggle the Basic and Advanced filter
 * blocks. */
const SectionDivider = ({ label, open, onClick }) => (
  <button
    type="button"
    aria-expanded={open}
    onClick={onClick}
    className="flex w-full items-center gap-3 py-1"
  >
    <span className="h-px flex-1 bg-app-line" />
    <span className="flex items-center gap-2 text-app-ink">
      <svg className="h-4 w-4 text-app-graphite" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.3}
          d="M4 9h16M9 3.5L6.5 9l5.5 11.5L17.5 9 15 3.5M9 3.5h6M9 3.5L12 9l3-5.5M12 9v11.5"
        />
      </svg>
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.16em]">{label}</span>
      <svg
        className={`h-4 w-4 text-app-muted transition-transform ${open ? "rotate-180" : ""}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 9l-7 7-7-7" />
      </svg>
    </span>
    <span className="h-px flex-1 bg-app-line" />
  </button>
);

/* A single toggleable filter chip. */
const Chip = ({ active, onClick, children }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={`min-w-[68px] shrink-0 whitespace-nowrap rounded-xl border px-5 py-2.5 text-center text-[13.5px] font-medium transition ${
      active
        ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
        : "border-app-line bg-app-surface text-app-graphite hover:bg-app-canvas2"
    }`}
  >
    {children}
  </button>
);

/* A money range filter: two custom $ inputs over a scrollable row of quick
 * bands. Custom range and bands are OR'd together by `priceOk`. */
const PriceRange = ({ from, setFrom, to, setTo, bands, toggleBand, presets }) => (
  <div>
    <div className="flex items-center gap-3">
      {[
        { val: from, set: setFrom, ph: "From" },
        { val: to, set: setTo, ph: "To" },
      ].map((f) => (
        <label key={f.ph} className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-app-soft">
            $
          </span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={f.val}
            onChange={(e) => f.set(e.target.value)}
            placeholder={f.ph}
            className="w-full rounded-xl border border-app-line bg-app-surface py-2.5 pl-7 pr-3 text-app-ink placeholder:text-app-soft focus:border-app-ink focus:outline-none"
          />
        </label>
      ))}
    </div>
    <div className="scrollbar-hide -mx-5 mt-3 overflow-x-auto px-5">
      <div className="flex gap-2">
        {presets.map((p) => {
          const active = bands.includes(p.label);
  return (
            <button
              key={p.label}
              type="button"
              aria-pressed={active}
              onClick={() => toggleBand(p.label)}
              className={`whitespace-nowrap rounded-xl border px-4 py-2.5 text-[13.5px] font-medium transition ${
                active
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                  : "border-app-line bg-app-surface text-app-graphite hover:bg-app-canvas2"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

/* One plain detail line under the title (treatment, lab, measurements, …). */
const Line = ({ value }) =>
  value == null || value === "" ? null : (
    <p className="text-[12.5px] leading-snug text-app-muted">{value}</p>
  );

/* Round check/add control overlaid on a card's image. Stops the click from
 * bubbling to the wrapping <Link> so picking a stone never navigates away. */
export const SelectToggle = ({ stone }) => {
  const { isSelected, toggle } = useSelection();
  const selected = isSelected(stone);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(stone);
      }}
      aria-pressed={selected}
      aria-label={selected ? "Remove from selection" : "Add to selection"}
      className={`absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border shadow-sm backdrop-blur transition active:scale-90 ${
        selected
          ? "border-emerald-600 bg-emerald-600 text-white"
          : "border-white/70 bg-white/80 text-app-soft hover:text-app-ink"
      }`}
    >
      {selected ? (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.5l2.93 5.94 6.57.96-4.75 4.63 1.12 6.54L12 18.98l-5.87 3.09 1.12-6.54L2.5 9.9l6.57-.96L12 2.5z" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2.5l2.93 5.94 6.57.96-4.75 4.63 1.12 6.54L12 18.98l-5.87 3.09 1.12-6.54L2.5 9.9l6.57-.96L12 2.5z" />
        </svg>
      )}
    </button>
  );
};

/* Manager/admin-only cost peek. A small tag button overlaid on the card's
 * image (top-left, mirroring the selection star). Renders nothing for salesmen
 * or when the stone carries no cost. Tapping opens a small dialog with the
 * internal cost — kept off the card face so it's never shown to a client over
 * the rep's shoulder. */
const CostButton = ({ stone }) => {
  const { isAdmin, isManager } = useTeam();
  const [open, setOpen] = useState(false);
  const costPerCt = Number(stone?.costPerCt);
  const allowed = (isAdmin || isManager) && Number.isFinite(costPerCt) && costPerCt > 0;
  if (!allowed) return null;

  const weight = Number(stone.weightCt);
  const totalCost = Number.isFinite(weight) ? costPerCt * weight : null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label="View cost"
        className="absolute left-2 top-2 z-10 flex h-8 items-center gap-1 rounded-full border border-white/70 bg-white/85 px-2.5 text-[11px] font-bold uppercase tracking-wide text-app-graphite shadow-sm backdrop-blur transition active:scale-90 hover:text-app-ink"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h.01M7 3h5.6a2 2 0 011.4.6l6.4 6.4a2 2 0 010 2.8l-4.6 4.6a2 2 0 01-2.8 0L6.6 11.6A2 2 0 016 10.2V4a1 1 0 011-1z" />
        </svg>
        Cost
      </button>

      <AnimatePresence>
        {open && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-5"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-black/45 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 6 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              role="dialog"
              aria-label="Stone cost"
              className="relative w-full max-w-[300px] rounded-3xl border border-app-line bg-app-surface p-5 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">
                    Internal cost
                  </p>
                  <p className="mt-0.5 truncate text-[13px] font-medium text-app-muted">
                    {stone.sku || "Stone"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-app-soft transition hover:bg-app-canvas2 hover:text-app-ink"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <div className="mt-4 space-y-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] text-app-muted">Cost / ct</span>
                  <span className="text-[17px] font-semibold tabular-nums text-app-ink">{money(costPerCt)}</span>
                </div>
                {totalCost != null && (
                  <div className="flex items-baseline justify-between gap-3 border-t border-app-line pt-2.5">
                    <span className="text-[13px] text-app-muted">Total cost</span>
                    <span className="text-[17px] font-semibold tabular-nums text-app-ink">{money(totalCost)}</span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export const GemstoneCard = ({ stone, mode }) => {
  const isDiamond = mode === "diamond";
  const isEmerald = mode === "emerald";
  const title = isDiamond
    ? buildDiamondTitle(stone)
    : isEmerald
    ? buildEmeraldTitle(stone)
    : buildTitle(stone);
  const holder = stone.holder && String(stone.holder).trim() ? String(stone.holder).trim() : null;
  // Precise location + memo flag (see resolveLocation).
  const { label: locationLine, memo: memoOut } = resolveLocation(stone);
  const lab = stone.lab && String(stone.lab).toUpperCase() !== "N/A" ? stone.lab : null;
  const treatment = stone.treatment ? shortTreatment(stone.treatment) : null;
  const img = stoneImage(stone);
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = img && !imgFailed;
  const { isSelected } = useSelection();
  const selected = isSelected(stone);

  // Cut / Polish / Symmetry condensed onto one line, values only (no labels).
  const finish = [stone.cut, stone.polish, stone.symmetry]
    .filter(Boolean)
    .join("  ·  ");
  const ppc = money(stone.pricePerCt);
  const rap =
    stone.rapPrice != null && stone.rapPrice !== "" ? `RAP ${stone.rapPrice}%` : null;
  const total = money(stone.priceTotal);

  // Measurements + ratio (ratio falls back to length/width when absent).
  let ratioVal = parseFloat(stone.ratio);
  if (!Number.isFinite(ratioVal)) {
    const [l, w] = parseDims(stone.measurements);
    if (Number.isFinite(l) && Number.isFinite(w) && w) ratioVal = l / w;
  }
  const measureLine = [
    stone.measurements ? String(stone.measurements).trim() : null,
    Number.isFinite(ratioVal) ? `Ratio ${ratioVal.toFixed(2)}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <div className="flex flex-col">
      {/* Image — shows the photo when present, otherwise a "Coming soon"
          placeholder. Also falls back if a "valid"-looking URL 404s. */}
      <div
        className={`relative aspect-square w-full overflow-hidden rounded-xl bg-app-canvas2 ${
          selected ? "ring-2 ring-emerald-500 ring-offset-2 ring-offset-app-canvas" : ""
        }`}
      >
        {showImage ? (
          <img
            src={img}
            alt={title || stone.sku}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <StonePlaceholder />
        )}
        <SelectToggle stone={stone} />
        <CostButton stone={stone} />
      </div>

      {/* Details — bold title, then plain stacked lines (catalog style). */}
      <div className="mt-2.5 flex flex-col gap-0.5">
        {/* HOLD flag — the stone is held. We never reveal who holds it,
            just the generic "HOLD" word. */}
        {(holder || stone.onHold) && (
          <span className="mb-0.5 inline-flex w-fit items-center rounded-md bg-red-100 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-red-600">
            HOLD
          </span>
        )}
        {/* MEMO OUT flag — stone is physically out with a third party. */}
        {memoOut && (
          <span className="mb-0.5 inline-flex w-fit items-center rounded-md bg-amber-100 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-amber-700">
            Memo out
          </span>
        )}
        <h3 className="text-[14px] font-semibold leading-snug text-app-ink">
          {title || stone.sku || (isDiamond ? "Diamond" : isEmerald ? "Emerald" : "Gemstone")}
        </h3>
        {isEmerald ? (
          <>
            {/* Comment + lab intentionally omitted here — both are already part
                of the emerald title (buildEmeraldTitle). */}
            <Line value={measureLine || null} />
            <Line value={locationLine} />
            <Line value={stone.sku ? `Stock #${stone.sku}` : null} />
            {/* Prices side by side, diamond-style: $/ct left, total right. */}
            {(ppc || total) && (
              <div className="mt-1.5 flex items-baseline justify-between gap-x-2 whitespace-nowrap tabular-nums">
                <span className="text-[11px] text-app-muted">{ppc ? `${ppc}/ct` : ""}</span>
                {total && (
                  <span className="text-[12px] font-semibold text-app-ink">{total}</span>
                )}
              </div>
            )}
          </>
        ) : isDiamond ? (
          <>
            <Line value={finish || null} />
            <Line value={measureLine || null} />
            <Line value={locationLine} />
            <Line value={stone.sku ? `Stock #${stone.sku}` : null} />
            {/* Prices pinned to the bottom on a single, non-wrapping row so the
                total never drops below the per-ct / RAP figures. */}
            {(ppc || rap || total) && (
              <div className="mt-1.5 flex items-baseline justify-between gap-x-2 whitespace-nowrap tabular-nums">
                <span className="flex items-baseline gap-x-2 text-[11px] text-app-muted">
                  {ppc && <span>{ppc}/ct</span>}
                  {rap && <span>{rap}</span>}
                </span>
                {total && (
                  <span className="text-[12px] font-semibold text-app-ink">{total}</span>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <Line value={treatment} />
            <Line value={lab} />
            <Line value={stone.measurements} />
            <Line value={locationLine} />
            <Line value={stone.sku ? `Stock #${stone.sku}` : null} />
            {/* Prices side by side, diamond-style: $/ct left, total right. */}
            {(ppc || total) && (
              <div className="mt-1.5 flex items-baseline justify-between gap-x-2 whitespace-nowrap tabular-nums">
                <span className="text-[11px] text-app-muted">{ppc ? `${ppc}/ct` : ""}</span>
                {total && (
                  <span className="text-[12px] font-semibold text-app-ink">{total}</span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const SalesInventory = ({ mode = "gemstone" }) => {
  const cfg = MODES[mode] || MODES.gemstone;
  // The signed-in actor — passed to /api/soap-stones so the BE can apply
  // role-based scoping. Admin + manager get the full catalog; a salesman is
  // server-side restricted to the branches in their assigned region.
  const { actor } = useTeam();
  // A manager can "re-run" a logged search from the activity feed — the filter
  // criteria + sort + query arrive via router state and override the saved
  // snapshot on mount. Read once into a ref so it applies exactly once.
  const replayRef = useRef(useLocation().state?.replayFilters || null);
  const [stones, setStones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  // Drag-to-dismiss for the bottom sheets: gestures start only from the grab
  // handle / header (via dragControls) so they never fight the body scroll.
  const filterDrag = useDragControls();
  const sortDrag = useDragControls();
  const [skuQuery, setSkuQuery] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  // Once the header (Filter / search / Sort) scrolls out of view we surface a
  // floating Filter button so it stays reachable deep down the grid.
  const headerRef = useRef(null);
  const [showFloatingFilter, setShowFloatingFilter] = useState(false);
  // True for the render immediately after we hydrate a category's saved
  // filters, so the persistence effect doesn't write stale values back.
  const justSwitchedRef = useRef(true);
  // Multi-level sort: ordered [{ key, dir }]. Tap to add (desc), tap again to
  // flip to asc, once more to remove.
  const [sortBy, setSortBy] = useState([]);
  const toggleSort = (key) =>
    setSortBy((cur) => {
      const item = cur.find((x) => x.key === key);
      if (!item) return [...cur, { key, dir: "desc" }];
      if (item.dir === "desc") return cur.map((x) => (x.key === key ? { ...x, dir: "asc" } : x));
      return cur.filter((x) => x.key !== key);
    });
  // Reorder a selected sort up/down to change its priority.
  const moveSort = (key, direction) =>
    setSortBy((cur) => {
      const i = cur.findIndex((x) => x.key === key);
      if (i === -1) return cur;
      const j = direction === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  // Selected diamond shapes (multi-select). Other categories will grow their
  // own filter state alongside this.
  const [shapeSel, setShapeSel] = useState([]);
  const toggleShape = (key) =>
    setShapeSel((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  // Carat size: custom From/To range plus independently multi-selectable
  // quick bands.
  const [sizeFrom, setSizeFrom] = useState("");
  const [sizeTo, setSizeTo] = useState("");
  const [sizeBands, setSizeBands] = useState([]);
  const toggleBand = (label) =>
    setSizeBands((cur) => (cur.includes(label) ? cur.filter((l) => l !== label) : [...cur, label]));
  // Price-per-carat and total-price: custom From/To plus quick bands.
  const [ppcFrom, setPpcFrom] = useState("");
  const [ppcTo, setPpcTo] = useState("");
  const [ppcBands, setPpcBands] = useState([]);
  const [totalFrom, setTotalFrom] = useState("");
  const [totalTo, setTotalTo] = useState("");
  const [totalBands, setTotalBands] = useState([]);
  // Measurements (mm): independent Length and Width From/To ranges.
  const [lenFrom, setLenFrom] = useState("");
  const [lenTo, setLenTo] = useState("");
  const [widthFrom, setWidthFrom] = useState("");
  const [widthTo, setWidthTo] = useState("");
  // Length / width ratio range.
  const [ratioFrom, setRatioFrom] = useState("");
  const [ratioTo, setRatioTo] = useState("");
  // Colour: White grades (D–Z) vs Fancy (intensity + fancy colour), all multi.
  const [colorMode, setColorMode] = useState("white");
  const [colorGrades, setColorGrades] = useState([]);
  const [fancyIntensity, setFancyIntensity] = useState([]);
  const [fancyColor, setFancyColor] = useState([]);
  const [claritySel, setClaritySel] = useState([]);
  const [labSel, setLabSel] = useState([]);
  const [locationSel, setLocationSel] = useState([]);
  // Emerald-only facets.
  const [treatmentSel, setTreatmentSel] = useState([]);
  const [originSel, setOriginSel] = useState([]);
  // Gemstone-only facets (colour bucket + gem type).
  const [gemColorSel, setGemColorSel] = useState([]);
  const [gemTypeSel, setGemTypeSel] = useState([]);
  // Basic block (open by default) wraps the primary filters; Advanced
  // (collapsed) holds the finish grades + fluorescence.
  const [basicOpen, setBasicOpen] = useState(true);
  const [measureOpen, setMeasureOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [cutSel, setCutSel] = useState([]);
  const [polishSel, setPolishSel] = useState([]);
  const [symmetrySel, setSymmetrySel] = useState([]);
  const [fluorSel, setFluorSel] = useState([]);
  const [parcelSel, setParcelSel] = useState(["Single"]);
  // Quick toggles: restrict to stones that carry a certificate / any media.
  const [onlyCert, setOnlyCert] = useState(false);
  const [onlyMedia, setOnlyMedia] = useState(false);
  const [onlyInStock, setOnlyInStock] = useState(false);
  const advancedGroups = [
    { title: "Cut", options: GRADE_EVGF, sel: cutSel, setter: setCutSel },
    { title: "Polish", options: GRADE_EVGF, sel: polishSel, setter: setPolishSel },
    { title: "Symmetry", options: GRADE_EVGF, sel: symmetrySel, setter: setSymmetrySel },
    { title: "Fluorescence", options: FLUOR_OPTIONS, sel: fluorSel, setter: setFluorSel },
  ];

  // Snapshot of the live filter state — what we persist for each category.
  const collectFilters = () => ({
    shapeSel, sizeFrom, sizeTo, sizeBands,
    ppcFrom, ppcTo, ppcBands, totalFrom, totalTo, totalBands,
    lenFrom, lenTo, widthFrom, widthTo, ratioFrom, ratioTo,
    colorMode, colorGrades, fancyIntensity, fancyColor,
    claritySel, labSel, locationSel, treatmentSel, originSel,
    gemColorSel, gemTypeSel, cutSel, polishSel, symmetrySel,
    fluorSel, parcelSel, onlyCert, onlyMedia, onlyInStock,
    skuQuery, sortBy,
  });
  // Push a saved snapshot (or the neutral defaults) back into state. Any key
  // missing from an older snapshot falls back to its default.
  const applyFilters = (saved) => {
    const f = { ...FILTER_DEFAULTS, ...(saved || {}) };
    setShapeSel(f.shapeSel);
    setSizeFrom(f.sizeFrom);
    setSizeTo(f.sizeTo);
    setSizeBands(f.sizeBands);
    setPpcFrom(f.ppcFrom);
    setPpcTo(f.ppcTo);
    setPpcBands(f.ppcBands);
    setTotalFrom(f.totalFrom);
    setTotalTo(f.totalTo);
    setTotalBands(f.totalBands);
    setLenFrom(f.lenFrom);
    setLenTo(f.lenTo);
    setWidthFrom(f.widthFrom);
    setWidthTo(f.widthTo);
    setRatioFrom(f.ratioFrom);
    setRatioTo(f.ratioTo);
    setColorMode(f.colorMode);
    setColorGrades(f.colorGrades);
    setFancyIntensity(f.fancyIntensity);
    setFancyColor(f.fancyColor);
    setClaritySel(f.claritySel);
    setLabSel(f.labSel);
    setLocationSel(f.locationSel);
    setTreatmentSel(f.treatmentSel);
    setOriginSel(f.originSel);
    setGemColorSel(f.gemColorSel);
    setGemTypeSel(f.gemTypeSel);
    setCutSel(f.cutSel);
    setPolishSel(f.polishSel);
    setSymmetrySel(f.symmetrySel);
    setFluorSel(f.fluorSel);
    setParcelSel(f.parcelSel);
    setOnlyCert(f.onlyCert);
    setOnlyMedia(f.onlyMedia);
    setOnlyInStock(f.onlyInStock);
    setSkuQuery(f.skuQuery);
    setSortBy(f.sortBy);
  };

  useEffect(() => {
    let cancelled = false;
    trackCategoryView(cfg.noun || mode);
    // Each category keeps its own filter selections: restore this mode's saved
    // snapshot (or the neutral defaults the first time) instead of clearing, so
    // hopping between Diamonds / Emeralds / Gemstones — or returning later —
    // keeps every page's results. Panels always reopen in the default layout.
    // A re-run from the activity feed wins over the saved snapshot (once).
    if (replayRef.current) {
      applyFilters(replayRef.current);
      replayRef.current = null;
    } else {
      applyFilters(loadSavedFilters(mode));
    }
    setBasicOpen(true);
    setMeasureOpen(false);
    setAdvancedOpen(false);
    // Skip the persistence write triggered by these hydration setstates.
    justSwitchedRef.current = true;
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        // Pass the actor so /api/soap-stones can scope by role: admin/manager
        // see the whole catalog; a salesman only sees stones whose branch is
        // inside their assigned region (the real security boundary lives on
        // the server). assignedTo:"all" just means "no per-rep assignment
        // filter" — region scoping is applied independently.
        const data = await fetchSoapStones(actor, { assignedTo: "all" });
        const rows = Array.isArray(data?.stones) ? data.stones : Array.isArray(data) ? data : [];
        if (!cancelled) {
          setStones(
            rows
              .filter((s) => cfg.test(getMappedCategories(s.category)))
              .map(adjustSalesPrices)
          );
          setVisibleCount(PAGE_SIZE);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || `Failed to load ${cfg.noun}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [mode, actor?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track SKU searches for the Team activity feed — debounced so we log the
  // settled query, not every keystroke.
  useEffect(() => {
    const q = skuQuery.trim();
    if (!q) return undefined;
    const t = setTimeout(() => trackSearch(q), 900);
    return () => clearTimeout(t);
  }, [skuQuery]);

  // Track sort changes — fire when the sort sheet closes with an active sort,
  // so we log the settled order (a readable label) rather than every toggle.
  const prevSortOpenRef = useRef(false);
  useEffect(() => {
    if (prevSortOpenRef.current && !sortOpen && sortBy.length) {
      const label = sortBy
        .map(({ key, dir }) => {
          const opt = SORT_OPTIONS.find((o) => o.key === key);
          return `${opt?.label || key} ${dir === "asc" ? "↑" : "↓"}`;
        })
        .join(", ");
      trackSort(label, mode);
    }
    prevSortOpenRef.current = sortOpen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortOpen]);

  // Persist the active filters for this category whenever they change. The
  // render right after a mode switch is skipped (justSwitchedRef) so we never
  // overwrite a freshly-restored snapshot with the previous category's values.
  useEffect(() => {
    if (justSwitchedRef.current) {
      justSwitchedRef.current = false;
      return;
    }
    try {
      localStorage.setItem(filtersKey(mode), JSON.stringify(collectFilters()));
    } catch {
      /* storage unavailable (private mode / quota) — non-fatal */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode, shapeSel, sizeFrom, sizeTo, sizeBands, ppcFrom, ppcTo, ppcBands,
    totalFrom, totalTo, totalBands, lenFrom, lenTo, widthFrom, widthTo,
    ratioFrom, ratioTo, colorMode, colorGrades, fancyIntensity, fancyColor,
    claritySel, labSel, locationSel, treatmentSel, originSel, gemColorSel,
    gemTypeSel, cutSel, polishSel, symmetrySel, fluorSel, parcelSel,
    onlyCert, onlyMedia, onlyInStock, skuQuery, sortBy,
  ]);

  // Apply the selected filters to the loaded (category-scoped) stones. Each
  // active facet narrows the result; empty facets are ignored. Diamond mode is
  // the only one with filter controls today, but the logic is harmless for the
  // others (all selections stay empty → everything passes).
  const filtered = useMemo(() => {
    return stones.filter((s) => {
      if (shapeSel.length) {
        const raw = norm(s.shape);
        const dna = norm(getDisplayShape(s.shape));
        const ok = shapeSel.some((k) =>
          (SHAPE_MATCH[k] || [k.toUpperCase()]).some((t) => t === raw || t === dna)
        );
        if (!ok) return false;
      }

      if (sizeFrom || sizeTo || sizeBands.length) {
        const ct = parseFloat(s.weightCt);
        let ok = false;
        if (sizeFrom || sizeTo) {
          const f = sizeFrom ? parseFloat(sizeFrom) : -Infinity;
          const t = sizeTo ? parseFloat(sizeTo) : Infinity;
          if (!isNaN(ct) && ct >= f && ct <= t) ok = true;
        }
        if (!ok && sizeBands.length) {
          ok = sizeBands.some((label) => {
            const b = SIZE_PRESETS.find((p) => p.label === label);
            if (!b) return false;
            const f = b.from ? parseFloat(b.from) : -Infinity;
            const t = b.to ? parseFloat(b.to) : Infinity;
            return !isNaN(ct) && ct >= f && ct <= t;
          });
        }
        if (!ok) return false;
      }

      if (!priceOk(s.pricePerCt, ppcFrom, ppcTo, ppcBands, PPC_PRESETS)) return false;
      if (!priceOk(s.priceTotal, totalFrom, totalTo, totalBands, TOTAL_PRESETS)) return false;

      if (lenFrom || lenTo || widthFrom || widthTo) {
        const [len, wid] = parseDims(s.measurements);
        if (!inRange(len, lenFrom, lenTo)) return false;
        if (!inRange(wid, widthFrom, widthTo)) return false;
      }

      if (ratioFrom || ratioTo) {
        let r = parseFloat(s.ratio);
        if (!Number.isFinite(r)) {
          const [len, wid] = parseDims(s.measurements);
          if (Number.isFinite(len) && Number.isFinite(wid) && wid) r = len / wid;
        }
        if (!inRange(Number.isFinite(r) ? r : undefined, ratioFrom, ratioTo)) return false;
      }

      // White vs Fancy is a hard split for diamonds: the White tab shows only
      // colourless/near-colourless diamonds, the Fancy tab only fancy-colour
      // stones. (Other modes have no fancy stones, so this is a no-op there.)
      if (mode === "diamond") {
        const isFancy = getMappedCategories(s.category).includes("Fancy");
        if (colorMode === "fancy" ? !isFancy : isFancy) return false;
      }

      if (colorMode === "white") {
        if (colorGrades.length) {
          const tokens = norm(s.color).split(/[\s,\-+/]+/).filter(Boolean);
          if (!colorGrades.some((g) => tokens.includes(g))) return false;
        }
      } else {
        if (fancyIntensity.length) {
          const fi = norm(s.fancyIntensity);
          if (!fancyIntensity.some((v) => fi.includes(norm(v)))) return false;
        }
        if (fancyColor.length) {
          const fc = norm(s.fancyColor);
          if (!fancyColor.some((v) => fc.includes(norm(v)))) return false;
        }
      }

      if (claritySel.length) {
        const cl = norm(s.clarity);
        const parts = cl.split(/[\s,\-+/]+/).filter(Boolean);
        if (!claritySel.some((v) => cl === norm(v) || parts.includes(norm(v)))) return false;
      }

      // Gemstone-only colour + gem-type buckets.
      if (mode === "gemstone") {
        if (!matchGemColor(s, gemColorSel)) return false;
        if (!matchWithOther(s.category, gemTypeSel, GEM_TYPE_OPTIONS)) return false;
      }

      if (labSel.length) {
        // Gemstone labs have an "Other" bucket; emerald/diamond use a plain
        // substring match against their fixed lab lists.
        if (mode === "gemstone") {
          if (!matchWithOther(s.lab, labSel, GEM_LAB_OPTIONS)) return false;
        } else {
          const lab = norm(s.lab);
          if (!labSel.some((v) => lab.includes(norm(v)))) return false;
        }
      }

      if (locationSel.length) {
        const loc = norm(s.location);
        if (!locationSel.some((v) => (LOCATION_MATCH[v] || [v]).some((t) => loc.includes(t)))) {
          return false;
        }
      }

      if (treatmentSel.length) {
        // For gemstones "treatment" is the Heated / No Heat / None comment.
        if (mode === "gemstone") {
          if (!matchGemComments(s.treatment, treatmentSel)) return false;
        } else {
          const t = norm(s.treatment);
          if (!treatmentSel.some((v) => t.includes(norm(v)))) return false;
        }
      }

      if (originSel.length) {
        if (mode === "gemstone") {
          if (!matchWithOther(s.origin, originSel, GEM_ORIGIN_OPTIONS)) return false;
        } else {
          const o = norm(s.origin);
          if (!originSel.some((v) => o.includes(norm(v)))) return false;
        }
      }

      const gradeOk = (sel, field) => {
        if (!sel.length) return true;
        const val = norm(s[field]);
        return sel.some((v) => (GRADE_MATCH[v] || [v]).some((t) => val === t || val.startsWith(t)));
      };
      if (!gradeOk(cutSel, "cut")) return false;
      if (!gradeOk(polishSel, "polish")) return false;
      if (!gradeOk(symmetrySel, "symmetry")) return false;
      if (fluorSel.length) {
        const fl = norm(s.fluorescence);
        if (!fluorSel.some((v) => (FLUOR_MATCH[v] || [v]).some((t) => fl.includes(t)))) return false;
      }

      if (parcelSel.length) {
        const gt = norm(s.groupingType);
        if (!parcelSel.some((v) => gt === norm(v))) return false;
      }

      if (onlyCert && !hasCert(s)) return false;
      // "Media" = an actual photo, since the card only renders an image. Almost
      // every stone carries a v360 video link, so including video here made the
      // filter meaningless (image-less stones still showed "Coming Soon").
      if (onlyMedia && !stoneImage(s)) return false;
      if (onlyInStock && resolveLocation(s).memo) return false;

      if (skuQuery.trim()) {
        const q = norm(skuQuery);
        if (!norm(s.sku).includes(q) && !norm(s.pairSku).includes(q)) return false;
      }

      return true;
    });
  }, [
    stones,
    mode,
    shapeSel,
    sizeFrom,
    sizeTo,
    sizeBands,
    ppcFrom,
    ppcTo,
    ppcBands,
    totalFrom,
    totalTo,
    totalBands,
    lenFrom,
    lenTo,
    widthFrom,
    widthTo,
    ratioFrom,
    ratioTo,
    colorMode,
    colorGrades,
    fancyIntensity,
    fancyColor,
    claritySel,
    labSel,
    locationSel,
    treatmentSel,
    originSel,
    gemColorSel,
    gemTypeSel,
    cutSel,
    polishSel,
    symmetrySel,
    fluorSel,
    parcelSel,
    onlyCert,
    onlyMedia,
    onlyInStock,
    skuQuery,
  ]);

  // Reset paging whenever the result set or its order changes (grid back to top).
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filtered, sortBy]);

  const resetFilters = () => {
    setShapeSel([]);
    setSizeFrom("");
    setSizeTo("");
    setSizeBands([]);
    setPpcFrom("");
    setPpcTo("");
    setPpcBands([]);
    setTotalFrom("");
    setTotalTo("");
    setTotalBands([]);
    setLenFrom("");
    setLenTo("");
    setWidthFrom("");
    setWidthTo("");
    setRatioFrom("");
    setRatioTo("");
    setColorMode("white");
    setColorGrades([]);
    setFancyIntensity([]);
    setFancyColor([]);
    setClaritySel([]);
    setLabSel([]);
    setLocationSel([]);
    setTreatmentSel([]);
    setOriginSel([]);
    setGemColorSel([]);
    setGemTypeSel([]);
    setCutSel([]);
    setPolishSel([]);
    setSymmetrySel([]);
    setFluorSel([]);
    setParcelSel(["Single"]);
    setOnlyCert(false);
    setOnlyMedia(false);
    setOnlyInStock(false);
  };

  // Apply the chosen multi-level sort on top of the filtered set.
  const sorted = useMemo(() => {
    if (!sortBy.length) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      for (const { key, dir } of sortBy) {
        const opt = SORT_OPTIONS.find((o) => o.key === key);
        if (!opt) continue;
        const va = sortValue(a, opt);
        const vb = sortValue(b, opt);
        if (va === null && vb === null) continue;
        if (va === null) return 1;
        if (vb === null) return -1;
        const c = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb));
        if (c !== 0) return dir === "asc" ? c : -c;
      }
      return 0;
    });
    return arr;
  }, [filtered, sortBy]);

  const visibleStones = useMemo(() => sorted.slice(0, visibleCount), [sorted, visibleCount]);
  const hasMore = visibleCount < sorted.length;

  // Infinite scroll — reveal the next batch when the sentinel nears the
  // viewport. `rootMargin` pre-loads slightly before the user hits bottom.
  const sentinelRef = useRef(null);
  const loadMore = useCallback(() => {
    setVisibleCount((c) => Math.min(c + PAGE_SIZE, sorted.length));
  }, [sorted.length]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "300px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  // Show the floating Filter button only while the real header is off-screen.
  useEffect(() => {
    const node = headerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => setShowFloatingFilter(!entries[0].isIntersecting),
      { rootMargin: "-8px 0px 0px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Shared filter fragments reused across modes (kept identical everywhere).
  const togglesControls = (
    <div className="flex flex-nowrap items-center justify-between gap-x-2">
      {[
        { label: "Only with cert", checked: onlyCert, set: setOnlyCert },
        { label: "Only with media", checked: onlyMedia, set: setOnlyMedia },
        { label: "Guaranteed available", checked: onlyInStock, set: setOnlyInStock },
      ].map(({ label, checked, set }) => (
        <label
          key={label}
          className="flex cursor-pointer select-none items-center gap-1.5 whitespace-nowrap text-[12px] font-medium text-app-ink"
        >
          <span
            className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition ${
              checked
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-app-line bg-app-surface text-transparent"
            }`}
          >
            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l3.5 3.5L15 7" />
            </svg>
          </span>
          <input type="checkbox" className="sr-only" checked={checked} onChange={() => set((v) => !v)} />
          {label}
        </label>
      ))}
    </div>
  );

  const measurementsControls = (
    <div className="space-y-3">
      {[
        { label: "Length", from: lenFrom, setFrom: setLenFrom, to: lenTo, setTo: setLenTo },
        { label: "Width", from: widthFrom, setFrom: setWidthFrom, to: widthTo, setTo: setWidthTo },
      ].map((row) => (
        <div key={row.label} className="flex items-center gap-3">
          <span className="w-14 shrink-0 text-[12.5px] font-medium text-app-soft">{row.label}</span>
          {[
            { v: row.from, set: row.setFrom, ph: "From" },
            { v: row.to, set: row.setTo, ph: "To" },
          ].map((f) => (
            <label key={f.ph} className="relative flex-1">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={f.v}
                onChange={(e) => f.set(e.target.value)}
                placeholder={f.ph}
                className="w-full rounded-xl border border-app-line bg-app-surface py-2.5 pl-3 pr-9 text-app-ink placeholder:text-app-soft focus:border-app-ink focus:outline-none"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-app-soft">
                mm
              </span>
            </label>
          ))}
        </div>
      ))}
      <div className="flex items-center gap-3">
        <span className="w-14 shrink-0 text-[12.5px] font-medium text-app-soft">Ratio</span>
        {[
          { v: ratioFrom, set: setRatioFrom, ph: "From" },
          { v: ratioTo, set: setRatioTo, ph: "To" },
        ].map((f) => (
          <label key={f.ph} className="flex-1">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={f.v}
              onChange={(e) => f.set(e.target.value)}
              placeholder={f.ph}
              className="w-full rounded-xl border border-app-line bg-app-surface px-3 py-2.5 text-app-ink placeholder:text-app-soft focus:border-app-ink focus:outline-none"
            />
          </label>
        ))}
      </div>
    </div>
  );

  // Any facet filter differs from its default? (SKU search + sort excluded —
  // they have their own controls.) Drives the top-bar Reset button.
  const activeFilterState = collectFilters();
  const hasActiveFilters = Object.keys(FILTER_DEFAULTS).some(
    (k) =>
      k !== "sortBy" &&
      k !== "skuQuery" &&
      JSON.stringify(activeFilterState[k]) !== JSON.stringify(FILTER_DEFAULTS[k])
  );

  // Build the full, replayable snapshot of the current search for the activity
  // log: only the non-default filter values, the sort, the search text, the
  // result count, and a compact sample of the stones that came back (so a
  // manager can see exactly what the rep searched and got).
  const buildSearchSnapshot = () => {
    const criteria = {};
    for (const k of Object.keys(FILTER_DEFAULTS)) {
      if (k === "sortBy" || k === "skuQuery") continue;
      if (JSON.stringify(activeFilterState[k]) !== JSON.stringify(FILTER_DEFAULTS[k])) {
        criteria[k] = activeFilterState[k];
      }
    }
    const sample = sorted.slice(0, 30).map((s) => ({
      sku: s.sku || null,
      wt: s.weightCt ?? null,
      shape: s.shape || null,
      color: s.color || null,
      clarity: s.clarity || null,
      lab: s.lab || null,
      ppc: s.pricePerCt ?? null,
      total: s.priceTotal ?? null,
    }));
    return {
      mode,
      criteria,
      facets: Object.keys(criteria),
      sort: sortBy,
      q: skuQuery || "",
      results: sorted.length,
      zeroResults: sorted.length === 0,
      sample,
    };
  };

  // Demand signal: a search/filter that returns nothing. Fired once per
  // empty-result state (resets when results come back) and only when the
  // catalog actually loaded, so an empty initial load isn't mislogged.
  const zeroFiredRef = useRef(false);
  useEffect(() => {
    const q = skuQuery.trim();
    const hasCriteria = !!q || hasActiveFilters;
    if (sorted.length === 0 && hasCriteria && stones.length > 0) {
      if (zeroFiredRef.current) return undefined;
      zeroFiredRef.current = true;
      const t = setTimeout(() => {
        const criteria = {};
        for (const k of Object.keys(FILTER_DEFAULTS)) {
          if (k === "sortBy" || k === "skuQuery") continue;
          if (JSON.stringify(activeFilterState[k]) !== JSON.stringify(FILTER_DEFAULTS[k])) {
            criteria[k] = activeFilterState[k];
          }
        }
        trackZeroResults({ q, mode, criteria });
      }, 1200);
      return () => clearTimeout(t);
    }
    zeroFiredRef.current = false;
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted.length, skuQuery, hasActiveFilters]);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      {/* No page title — the bottom dock already shows which catalog you're in.
          "Filter" sits top-left, "Sort" top-right, where the title used to be. */}
      <div ref={headerRef} className="flex items-center justify-between gap-3">
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen(true)}
          className="rounded-xl border border-app-line bg-app-surface px-5 py-2 text-sm font-semibold tracking-tight text-app-ink transition hover:bg-app-canvas2 active:scale-95"
        >
          Filter
        </button>

        {/* SKU search — sits between Filter and Sort, matches sku / pair sku. */}
        <label className="relative min-w-0 flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-soft"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-4.35-4.35M11 18a7 7 0 110-14 7 7 0 010 14z" />
          </svg>
          <input
            type="search"
            value={skuQuery}
            onChange={(e) => setSkuQuery(e.target.value)}
            placeholder="Search SKU"
            className="w-full rounded-xl border border-app-line bg-app-surface py-2 pl-9 pr-10 text-sm text-app-ink placeholder:text-app-soft focus:border-app-ink focus:outline-none"
          />
          {/* Camera scan — opens the rear camera to read a SKU barcode/QR. */}
          <button
            type="button"
            onClick={() => setScanOpen(true)}
            aria-label="Scan SKU with camera"
            className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-app-soft transition hover:bg-app-canvas2 hover:text-app-ink"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M3 9V7a2 2 0 012-2h2M3 15v2a2 2 0 002 2h2m10-14h2a2 2 0 012 2v2m0 6v2a2 2 0 01-2 2h-2" />
              <circle cx="12" cy="12" r="3.2" strokeWidth={1.7} />
            </svg>
          </button>
        </label>

        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={sortOpen}
          onClick={() => setSortOpen(true)}
          className="rounded-xl border border-app-line bg-app-surface px-5 py-2 text-sm font-semibold tracking-tight text-app-ink transition hover:bg-app-canvas2 active:scale-95"
        >
          Sort
        </button>
      </div>

      {/* Live tally of how many stones match the active filters — sits just
          under the Filter / Search / Sort row, aligned under Filter. The Reset
          button appears here only while at least one facet filter is active. */}
      {!loading && !error && (
        <div className="mt-2 flex items-center justify-between gap-3 pl-1">
          <p className="text-[12px] font-medium text-app-soft">
            {filtered.length.toLocaleString()}{" "}
            {filtered.length === 1 ? "result" : "results"}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-app-line bg-app-surface px-3 py-1.5 text-[12px] font-semibold text-app-ink transition hover:bg-app-canvas2 active:scale-95"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v6h6M20 20v-6h-6M20 9a8 8 0 00-14.3-3.4L4 7M4 15a8 8 0 0014.3 3.4L20 17" />
              </svg>
              Reset
            </button>
          )}
        </div>
      )}

      {/* Floating Filter button — fades in once the header scrolls away so the
          filters stay one tap away anywhere down the grid. Sits above the
          mobile dock (safe-area aware) and opens the same sheet. */}
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label="Open filters"
        onClick={() => setFiltersOpen(true)}
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)" }}
        className={`fixed left-4 z-30 flex items-center gap-2 rounded-full bg-app-ink px-5 py-3 text-[13.5px] font-semibold text-app-canvas shadow-[0_8px_24px_-6px_rgba(0,0,0,0.45)] transition-all duration-200 md:hidden ${
          showFloatingFilter
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0"
        }`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        Filter
      </button>

      {/* Camera-based SKU scanner (rear camera; works on iOS Safari). */}
      <BarcodeScanner
        isOpen={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={(text) => {
          setSkuQuery(String(text || "").trim());
          setScanOpen(false);
        }}
      />

      {/* Loading skeleton */}
      {loading && (
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col">
              <div className="aspect-square w-full rounded-xl skeleton" />
              <div className="mt-2.5 space-y-2">
                <div className="h-3.5 w-3/4 rounded skeleton" />
                <div className="h-3 w-1/2 rounded skeleton" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="mt-8 rounded-2xl glass-surface p-8 text-center">
          <p className="text-[14px] font-medium text-app-ink">Couldn't load {cfg.noun}</p>
          <p className="mt-1 text-[12.5px] text-app-soft">{error}</p>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
      <div className="mt-8 rounded-2xl glass-surface p-10 text-center">
          <p className="text-[14px] font-medium text-app-ink">
            {stones.length === 0 ? `No ${cfg.noun} in inventory` : `No ${cfg.noun} match your filters`}
        </p>
      </div>
      )}

      {/* Grid — 2 cards per row on phones, wider on larger screens. */}
      {!loading && !error && filtered.length > 0 && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
            {visibleStones.map((stone, idx) => (
              <Link
                key={stone.id ?? stone.sku ?? idx}
                to={`/sales/stone/${encodeURIComponent(stone.sku || "")}`}
                state={{ stone }}
                className="transition active:opacity-80"
              >
                <GemstoneCard stone={stone} mode={mode} />
              </Link>
            ))}
          </div>

          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-8">
              <div className="flex items-center gap-2 text-[12.5px] text-app-soft">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-app-line border-t-app-graphite" />
                Loading more…
              </div>
            </div>
          )}
        </>
      )}

      {/* Filter dialog — bottom sheet that slides up to ~70% of the viewport.
          The body scrolls both vertically and horizontally. Filter controls
          will live inside here. */}
      <AnimatePresence>
        {filtersOpen && (
          <div className="fixed inset-0 z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setFiltersOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              drag="y"
              dragControls={filterDrag}
              dragListener={false}
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.2 }}
              dragSnapToOrigin
              onDragEnd={(e, info) => {
                if (info.offset.y > 120 || info.velocity.y > 600) setFiltersOpen(false);
              }}
              className="absolute inset-x-0 bottom-0 flex h-[70vh] flex-col rounded-t-3xl border-t border-app-line bg-app-surface"
              role="dialog"
              aria-modal="true"
              aria-label="Filters"
            >
              {/* Drag-to-dismiss zone — the whole top area (handle + header) is
                  grabbable so a downward finger swipe from anywhere up here
                  closes the sheet, iOS-style. Only the × button opts out. */}
              <div
                onPointerDown={(e) => filterDrag.start(e)}
                className="flex shrink-0 cursor-grab touch-none justify-center pt-3 pb-2 active:cursor-grabbing"
              >
                <div className="h-1.5 w-12 rounded-full bg-app-line2" />
              </div>

              {/* Sheet header */}
              <div
                onPointerDown={(e) => filterDrag.start(e)}
                className="flex shrink-0 cursor-grab touch-none items-center justify-between border-b border-app-line px-5 py-3 active:cursor-grabbing"
              >
                <h2 className="text-base font-semibold tracking-tight text-app-ink">Filter</h2>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-app-muted transition hover:bg-app-canvas2 hover:text-app-ink"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              {/* Scrollable body — vertical scroll for the section stack,
                  while individual rows (like Shape) scroll horizontally. */}
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {mode === "gemstone" ? (
                  <div className="space-y-7">
                    {/* Parcel type */}
                    <section>
                      <h3 className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-app-muted">
                        Parcel type
                      </h3>
                      <ScrollRow>
                        {EMERALD_PARCEL_OPTIONS.map((p) => (
                          <Chip key={p} active={parcelSel.includes(p)} onClick={() => toggleVal(setParcelSel, p)}>
                            {p}
                          </Chip>
                        ))}
                      </ScrollRow>
                    </section>

                    <SectionDivider label="Basic" open={basicOpen} onClick={() => setBasicOpen((o) => !o)} />
                    {basicOpen && (
                      <>
                        {/* Color — labelled swatches in the named colour. */}
                        <section>
                          <h3 className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-app-muted">
                            Color
                          </h3>
                          <ScrollRow>
                            {GEM_COLORS.map(({ key, swatch }) => {
                              const active = gemColorSel.includes(key);
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  aria-pressed={active}
                                  onClick={() => toggleVal(setGemColorSel, key)}
                                  className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-[13.5px] font-medium transition ${
                                    active
                                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                                      : "border-app-line bg-app-surface text-app-graphite hover:bg-app-canvas2"
                                  }`}
                                >
                                  <span
                                    className="h-4 w-4 shrink-0 rounded-[5px] border border-black/10"
                                    style={
                                      swatch
                                        ? { backgroundColor: swatch }
                                        : {
                                            backgroundImage:
                                              "linear-gradient(135deg,#ef4444,#f59e0b,#22c55e,#3b82f6,#a855f7)",
                                          }
                                    }
                                  />
                                  {key}
                                </button>
                              );
                            })}
                          </ScrollRow>
                        </section>

                        {/* Shape — same scrollable icon grid as the other modes. */}
                        <section>
                          <div className="mb-2.5 flex items-center justify-between">
                            <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-app-muted">
                              Shape
                            </h3>
                            {shapeSel.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setShapeSel([])}
                                className="text-[12px] font-medium text-app-soft hover:text-app-ink"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          <div className="scrollbar-hide -mx-5 overflow-x-auto px-5 pb-1">
                            <div className="grid grid-flow-col grid-rows-2 auto-cols-[90px] gap-1.5">
                              {DIAMOND_SHAPES.map((sh) => {
                                const active = shapeSel.includes(sh.key);
                                return (
                                  <button
                                    key={sh.key}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => toggleShape(sh.key)}
                                    className={`flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-4 transition ${
                                      active
                                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                                        : "border-app-line bg-app-surface text-app-graphite hover:bg-app-canvas2"
                                    }`}
                                  >
                                    {sh.icon("h-6 w-6")}
                                    <span className="w-full text-center text-[12px] font-medium leading-tight">
                                      {sh.label}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </section>

                        {/* Gem type */}
                        <section>
                          <h3 className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-app-muted">
                            Gem type
                          </h3>
                          <ScrollRow>
                            {GEM_TYPE_OPTIONS.map((t) => (
                              <Chip key={t} active={gemTypeSel.includes(t)} onClick={() => toggleVal(setGemTypeSel, t)}>
                                {t}
                              </Chip>
                            ))}
                          </ScrollRow>
                        </section>

                        {/* Price per carat & Total price */}
                        <section>
                          <h3 className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-app-muted">
                            Price per carat
                          </h3>
                          <PriceRange
                            from={ppcFrom}
                            setFrom={setPpcFrom}
                            to={ppcTo}
                            setTo={setPpcTo}
                            bands={ppcBands}
                            toggleBand={(l) => toggleVal(setPpcBands, l)}
                            presets={PPC_PRESETS}
                          />
                        </section>
                        <section>
                          <h3 className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-app-muted">
                            Total price
                          </h3>
                          <PriceRange
                            from={totalFrom}
                            setFrom={setTotalFrom}
                            to={totalTo}
                            setTo={setTotalTo}
                            bands={totalBands}
                            toggleBand={(l) => toggleVal(setTotalBands, l)}
                            presets={TOTAL_PRESETS}
                          />
                        </section>

                        {togglesControls}
                      </>
                    )}

                    {/* Advanced search — Lab, Comments, Origin, Location. */}
                    <SectionDivider
                      label="Advanced search"
                      open={advancedOpen}
                      onClick={() => setAdvancedOpen((o) => !o)}
                    />
                    {advancedOpen && (
                      <div className="space-y-6">
                        {[
                          { title: "Lab", options: GEM_LAB_OPTIONS, sel: labSel, setter: setLabSel },
                          { title: "Comments", options: GEM_COMMENTS_OPTIONS, sel: treatmentSel, setter: setTreatmentSel },
                          { title: "Origin", options: GEM_ORIGIN_OPTIONS, sel: originSel, setter: setOriginSel },
                          { title: "Location", options: LOCATION_OPTIONS, sel: locationSel, setter: setLocationSel },
                        ].map((g) => (
                          <div key={g.title}>
                            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-app-soft">
                              {g.title}
                            </h4>
                            <ScrollRow>
                              {g.options.map((opt) => (
                                <Chip key={opt} active={g.sel.includes(opt)} onClick={() => toggleVal(g.setter, opt)}>
                                  {opt}
                                </Chip>
                              ))}
                            </ScrollRow>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Measurements */}
                    <SectionDivider
                      label="Measurements"
                      open={measureOpen}
                      onClick={() => setMeasureOpen((o) => !o)}
                    />
                    {measureOpen && measurementsControls}
                  </div>
                ) : mode === "diamond" || mode === "emerald" ? (
                  <div className="space-y-7">
                  {/* Parcel type — kept above Basic. Diamonds: Single/Pair;
                      emeralds also use Set/Parcel. */}
                  <section>
                    <h3 className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-app-muted">
                      Parcel type
                    </h3>
                    <ScrollRow>
                      {(mode === "emerald" ? EMERALD_PARCEL_OPTIONS : PARCEL_OPTIONS).map((p) => (
                        <Chip
                          key={p}
                          active={parcelSel.includes(p)}
                          onClick={() => toggleVal(setParcelSel, p)}
                        >
                          {p}
                        </Chip>
                      ))}
                    </ScrollRow>
                  </section>

                  <SectionDivider
                    label="Basic"
                    open={basicOpen}
                    onClick={() => setBasicOpen((o) => !o)}
                  />
                  {basicOpen && (
                  <>
                  <section>
                    <div className="mb-2.5 flex items-center justify-between">
                      <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-app-muted">
                        Shape
                      </h3>
                      {shapeSel.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShapeSel([])}
                          className="text-[12px] font-medium text-app-soft hover:text-app-ink"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {/* Two rows, columns flow horizontally and scroll right.
                        Scrollbar hidden but swipe/scroll still works. */}
                    <div className="scrollbar-hide -mx-5 overflow-x-auto px-5 pb-1">
                      <div className="grid grid-flow-col grid-rows-2 auto-cols-[90px] gap-1.5">
                        {DIAMOND_SHAPES.map((sh) => {
                          const active = shapeSel.includes(sh.key);
                          return (
                            <button
                              key={sh.key}
                              type="button"
                              aria-pressed={active}
                              onClick={() => toggleShape(sh.key)}
                              className={`flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-4 transition ${
                                active
                                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                                  : "border-app-line bg-app-surface text-app-graphite hover:bg-app-canvas2"
                              }`}
                            >
                              {sh.icon("h-6 w-6")}
                              <span className="w-full text-center text-[12px] font-medium leading-tight">
                                {sh.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </section>

                  {/* Size — custom From/To carat fields plus quick bands.
                      Labelled "Weight" under Emeralds. */}
                  <section>
                    <h3 className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-app-muted">
                      {mode === "emerald" ? "Weight" : "Size"}
                    </h3>
                    <div className="flex items-center gap-3">
                      <label className="relative flex-1">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          value={sizeFrom}
                          onChange={(e) => setSizeFrom(e.target.value)}
                          placeholder="From"
                          className="w-full rounded-xl border border-app-line bg-app-surface py-2.5 pl-3 pr-8 text-app-ink placeholder:text-app-soft focus:border-app-ink focus:outline-none"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-app-soft">
                          ct
                        </span>
                      </label>
                      <label className="relative flex-1">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          value={sizeTo}
                          onChange={(e) => setSizeTo(e.target.value)}
                          placeholder="To"
                          className="w-full rounded-xl border border-app-line bg-app-surface py-2.5 pl-3 pr-8 text-app-ink placeholder:text-app-soft focus:border-app-ink focus:outline-none"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-app-soft">
                          ct
                        </span>
                      </label>
                    </div>

                    {/* Quick carat bands — single scrollable row. */}
                    <div className="scrollbar-hide -mx-5 mt-3 overflow-x-auto px-5">
                      <div className="flex gap-2">
                        {SIZE_PRESETS.map((p) => {
                          const active = sizeBands.includes(p.label);
                          return (
                            <button
                              key={p.label}
                              type="button"
                              aria-pressed={active}
                              onClick={() => toggleBand(p.label)}
                              className={`whitespace-nowrap rounded-xl border px-4 py-2.5 text-[13.5px] font-medium transition ${
                                active
                                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                                  : "border-app-line bg-app-surface text-app-graphite hover:bg-app-canvas2"
                              }`}
                            >
                              {p.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </section>

                  {/* Price per carat & Total price — custom From/To plus quick
                      bands. Emeralds only (diamonds price off RAP). */}
                  {mode === "emerald" && (
                    <section>
                      <h3 className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-app-muted">
                        Price per carat
                      </h3>
                      <PriceRange
                        from={ppcFrom}
                        setFrom={setPpcFrom}
                        to={ppcTo}
                        setTo={setPpcTo}
                        bands={ppcBands}
                        toggleBand={(l) => toggleVal(setPpcBands, l)}
                        presets={PPC_PRESETS}
                      />
                    </section>
                  )}
                  {mode === "emerald" && (
                    <section>
                      <h3 className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-app-muted">
                        Total price
                      </h3>
                      <PriceRange
                        from={totalFrom}
                        setFrom={setTotalFrom}
                        to={totalTo}
                        setTo={setTotalTo}
                        bands={totalBands}
                        toggleBand={(l) => toggleVal(setTotalBands, l)}
                        presets={TOTAL_PRESETS}
                      />
                    </section>
                  )}

                  {/* Colour — White grades (D–Z) or, under Fancy, intensity +
                      fancy-colour pickers. All multi-select. (Diamonds only.) */}
                  {mode === "diamond" && (
                  <section>
                    <h3 className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-app-muted">
                      Color
                    </h3>

                    {/* White / Fancy segmented toggle */}
                    <div className="inline-flex rounded-xl border border-app-line bg-app-surface p-0.5">
                      {[
                        { key: "white", label: "White" },
                        { key: "fancy", label: "Fancy" },
                      ].map((seg) => (
                        <button
                          key={seg.key}
                          type="button"
                          onClick={() => setColorMode(seg.key)}
                          className={`rounded-lg px-6 py-1.5 text-[13px] font-medium transition ${
                            colorMode === seg.key
                              ? "bg-emerald-500 text-white"
                              : "text-app-graphite hover:text-app-ink"
                          }`}
                        >
                          {seg.label}
                        </button>
                      ))}
                    </div>

                    {colorMode === "white" ? (
                      <div className="mt-3">
                        <ScrollRow>
                          {COLOR_GRADES.map((g) => (
                            <Chip
                              key={g}
                              active={colorGrades.includes(g)}
                              onClick={() => toggleVal(setColorGrades, g)}
                            >
                              {g}
                            </Chip>
                          ))}
                        </ScrollRow>
                      </div>
                    ) : (
                      <div className="mt-4 space-y-4">
                        <div>
                          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-app-soft">
                            Intensity
                          </h4>
                          <ScrollRow>
                            {FANCY_INTENSITY.map((v) => (
                              <Chip
                                key={v}
                                active={fancyIntensity.includes(v)}
                                onClick={() => toggleVal(setFancyIntensity, v)}
                              >
                                {v}
                              </Chip>
                            ))}
                          </ScrollRow>
                        </div>
                        <div>
                          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-app-soft">
                            Color
                          </h4>
                          <ScrollRow>
                            {FANCY_COLORS.map((v) => (
                              <Chip
                                key={v}
                                active={fancyColor.includes(v)}
                                onClick={() => toggleVal(setFancyColor, v)}
                              >
                                {v}
                              </Chip>
                            ))}
                          </ScrollRow>
                        </div>
                      </div>
                    )}
                  </section>
                  )}

                  {/* Clarity — multi-select grade chips. (Diamonds only.) */}
                  {mode === "diamond" && (
                  <section>
                    <h3 className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-app-muted">
                      Clarity
                    </h3>
                    <ScrollRow>
                      {CLARITY_GRADES.map((c) => (
                        <Chip
                          key={c}
                          active={claritySel.includes(c)}
                          onClick={() => toggleVal(setClaritySel, c)}
                        >
                          {c}
                        </Chip>
                      ))}
                    </ScrollRow>
                  </section>
                  )}

                  {/* Lab — diamonds show it here in Basic; emeralds move Lab
                      into Advanced search below. */}
                  {mode === "diamond" && (
                  <section>
                    <h3 className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-app-muted">
                      Lab
                    </h3>
                    <ScrollRow>
                      {LAB_OPTIONS.map((l) => (
                        <Chip
                          key={l}
                          active={labSel.includes(l)}
                          onClick={() => toggleVal(setLabSel, l)}
                        >
                          {l}
                        </Chip>
                      ))}
                    </ScrollRow>
                  </section>
                  )}

                  {/* Location — diamonds in Basic; emeralds in Advanced search. */}
                  {mode === "diamond" && (
                  <section>
                    <h3 className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-app-muted">
                      Location
                    </h3>
                    <ScrollRow>
                      {LOCATION_OPTIONS.map((loc) => (
                        <Chip
                          key={loc}
                          active={locationSel.includes(loc)}
                          onClick={() => toggleVal(setLocationSel, loc)}
                        >
                          {loc}
                        </Chip>
                      ))}
                    </ScrollRow>
                  </section>
                  )}

                  {/* Quick toggles — keep stones that carry a cert / media. */}
                  <div className="flex flex-nowrap items-center justify-between gap-x-2">
                    {[
                      { label: "Only with cert", checked: onlyCert, set: setOnlyCert },
                      { label: "Only with media", checked: onlyMedia, set: setOnlyMedia },
                      { label: "Guaranteed available", checked: onlyInStock, set: setOnlyInStock },
                    ].map(({ label, checked, set }) => (
                      <label
                        key={label}
                        className="flex cursor-pointer select-none items-center gap-1.5 whitespace-nowrap text-[12px] font-medium text-app-ink"
                      >
                        <span
                          className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition ${
                            checked
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-app-line bg-app-surface text-transparent"
                          }`}
                        >
                          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l3.5 3.5L15 7" />
                          </svg>
                        </span>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => set((v) => !v)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  </>
                  )}

                  {/* Advanced Search — diamonds: finish grades (Cut / Polish /
                      Symmetry) + Fluorescence. Emeralds: Lab, Comments
                      (treatment), Location, Origin. */}
                  <SectionDivider
                    label="Advanced search"
                    open={advancedOpen}
                    onClick={() => setAdvancedOpen((o) => !o)}
                  />
                  {advancedOpen && mode === "diamond" && (
                    <div className="space-y-6">
                      {advancedGroups.map((g) => (
                        <div key={g.title}>
                          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-app-soft">
                            {g.title}
                          </h4>
                          <ScrollRow>
                            {g.options.map((opt) => (
                              <Chip
                                key={opt}
                                active={g.sel.includes(opt)}
                                onClick={() => toggleVal(g.setter, opt)}
                              >
                                {opt}
                              </Chip>
                            ))}
                          </ScrollRow>
                        </div>
                      ))}
                    </div>
                  )}
                  {advancedOpen && mode === "emerald" && (
                    <div className="space-y-6">
                      <div>
                        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-app-soft">
                          Lab
                        </h4>
                        <ScrollRow>
                          {EMERALD_LAB_OPTIONS.map((l) => (
                            <Chip
                              key={l}
                              active={labSel.includes(l)}
                              onClick={() => toggleVal(setLabSel, l)}
                            >
                              {l}
                            </Chip>
                          ))}
                        </ScrollRow>
                      </div>
                      <div>
                        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-app-soft">
                          Comments
                        </h4>
                        <ScrollRow>
                          {TREATMENT_OPTIONS.map((t) => (
                            <Chip
                              key={t}
                              active={treatmentSel.includes(t)}
                              onClick={() => toggleVal(setTreatmentSel, t)}
                            >
                              {t}
                            </Chip>
                          ))}
                        </ScrollRow>
                      </div>
                      <div>
                        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-app-soft">
                          Location
                        </h4>
                        <ScrollRow>
                          {LOCATION_OPTIONS.map((loc) => (
                            <Chip
                              key={loc}
                              active={locationSel.includes(loc)}
                              onClick={() => toggleVal(setLocationSel, loc)}
                            >
                              {loc}
                            </Chip>
                          ))}
                        </ScrollRow>
                      </div>
                      <div>
                        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-app-soft">
                          Origin
                        </h4>
                        <ScrollRow>
                          {ORIGIN_OPTIONS.map((o) => (
                            <Chip
                              key={o}
                              active={originSel.includes(o)}
                              onClick={() => toggleVal(setOriginSel, o)}
                            >
                              {o}
                            </Chip>
                          ))}
                        </ScrollRow>
                      </div>
                    </div>
                  )}

                  {/* Measurements — collapsible divider with Length & Width (mm)
                      From/To ranges. */}
                  <SectionDivider
                    label="Measurements"
                    open={measureOpen}
                    onClick={() => setMeasureOpen((o) => !o)}
                  />
                  {measureOpen && (
                    <div className="space-y-3">
                      {[
                        { label: "Length", from: lenFrom, setFrom: setLenFrom, to: lenTo, setTo: setLenTo },
                        { label: "Width", from: widthFrom, setFrom: setWidthFrom, to: widthTo, setTo: setWidthTo },
                      ].map((row) => (
                        <div key={row.label} className="flex items-center gap-3">
                          <span className="w-14 shrink-0 text-[12.5px] font-medium text-app-soft">
                            {row.label}
                          </span>
                          <label className="relative flex-1">
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="0"
                              value={row.from}
                              onChange={(e) => row.setFrom(e.target.value)}
                              placeholder="From"
                              className="w-full rounded-xl border border-app-line bg-app-surface py-2.5 pl-3 pr-9 text-app-ink placeholder:text-app-soft focus:border-app-ink focus:outline-none"
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-app-soft">
                              mm
                            </span>
                          </label>
                          <label className="relative flex-1">
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="0"
                              value={row.to}
                              onChange={(e) => row.setTo(e.target.value)}
                              placeholder="To"
                              className="w-full rounded-xl border border-app-line bg-app-surface py-2.5 pl-3 pr-9 text-app-ink placeholder:text-app-soft focus:border-app-ink focus:outline-none"
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-app-soft">
                              mm
                            </span>
                          </label>
                        </div>
                      ))}

                      {/* Ratio (length / width) — unitless From/To. */}
                      <div className="flex items-center gap-3">
                        <span className="w-14 shrink-0 text-[12.5px] font-medium text-app-soft">
                          Ratio
                        </span>
                        <label className="flex-1">
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            value={ratioFrom}
                            onChange={(e) => setRatioFrom(e.target.value)}
                            placeholder="From"
                            className="w-full rounded-xl border border-app-line bg-app-surface px-3 py-2.5 text-app-ink placeholder:text-app-soft focus:border-app-ink focus:outline-none"
                          />
                        </label>
                        <label className="flex-1">
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            value={ratioTo}
                            onChange={(e) => setRatioTo(e.target.value)}
                            placeholder="To"
                            className="w-full rounded-xl border border-app-line bg-app-surface px-3 py-2.5 text-app-ink placeholder:text-app-soft focus:border-app-ink focus:outline-none"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                  </div>
                ) : (
                  <p className="text-[13px] text-app-soft">No filters configured yet.</p>
                )}
              </div>

              {/* Sticky footer — clear everything or apply (the grid filters
                  live, so "Show" just closes the sheet on the results). */}
              <div
                className="flex shrink-0 items-center gap-3 border-t border-app-line px-5 py-3"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
              >
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-xl border border-app-line bg-app-surface px-5 py-2.5 text-[13px] font-semibold text-app-graphite transition hover:bg-app-canvas2"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (hasActiveFilters && sorted.length > 0) {
                      // Replayable snapshot (criteria + sort + result sample).
                      // Zero-result applies are captured by the dedicated
                      // zero_results signal instead.
                      trackFilter(buildSearchSnapshot());
                    }
                    setFiltersOpen(false);
                  }}
                  className="flex-1 rounded-xl bg-app-ink px-5 py-2.5 text-[13px] font-semibold text-app-canvas transition active:scale-[0.99]"
                >
                  Show {filtered.length} {filtered.length === 1 ? "result" : "results"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sort dialog — bottom sheet, same slide-up behaviour as Filter. */}
      <AnimatePresence>
        {sortOpen && (
          <div className="fixed inset-0 z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setSortOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              drag="y"
              dragControls={sortDrag}
              dragListener={false}
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.2 }}
              dragSnapToOrigin
              onDragEnd={(e, info) => {
                if (info.offset.y > 120 || info.velocity.y > 600) setSortOpen(false);
              }}
              className="absolute inset-x-0 bottom-0 flex max-h-[70vh] flex-col rounded-t-3xl border-t border-app-line bg-app-surface"
              role="dialog"
              aria-modal="true"
              aria-label="Sort"
            >
              {/* Drag handle */}
              <div
                onPointerDown={(e) => sortDrag.start(e)}
                className="flex shrink-0 cursor-grab touch-none justify-center pt-3 pb-1 active:cursor-grabbing"
              >
                <div className="h-1.5 w-12 rounded-full bg-app-line2" />
              </div>

              {/* Sheet header */}
              <div
                onPointerDown={(e) => sortDrag.start(e)}
                className="flex shrink-0 cursor-grab touch-none items-center justify-between border-b border-app-line px-5 py-3 active:cursor-grabbing"
              >
                <h2 className="text-base font-semibold tracking-tight text-app-ink">Sort</h2>
                <button
                  type="button"
                  onClick={() => setSortOpen(false)}
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-app-muted transition hover:bg-app-canvas2 hover:text-app-ink"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              {/* Scrollable body — selected sorts float to the top (in priority
                  order) with a direction arrow; the rest follow. */}
              <div className="flex-1 overflow-auto px-5 py-4">
                <p className="mb-3 text-[12px] text-app-soft">
                  Tap to sort · tap again to flip direction · once more to clear
                </p>
                <div className="flex flex-col gap-2">
                  {[
                    ...sortBy
                      .map((s) => {
                        const opt = SORT_OPTIONS.find((o) => o.key === s.key);
                        return opt ? { ...opt, dir: s.dir } : null;
                      })
                      .filter(Boolean),
                    ...SORT_OPTIONS.filter((o) => !sortBy.some((s) => s.key === o.key)).map((o) => ({
                      ...o,
                      dir: null,
                    })),
                  ].map((opt) => {
                    const active = opt.dir != null;
                    const rank = sortBy.findIndex((s) => s.key === opt.key);

                    if (!active) {
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => toggleSort(opt.key)}
                          className="flex items-center justify-between rounded-xl border border-app-line bg-app-surface px-4 py-3 text-left text-[14px] font-medium text-app-graphite transition hover:bg-app-canvas2"
                        >
                          <span>{opt.label}</span>
                        </button>
                      );
                    }

                    return (
                      <div
                        key={opt.key}
                        className="flex items-center gap-2 rounded-xl border border-emerald-500 bg-emerald-500/10 px-2.5 py-2 text-emerald-600"
                      >
                        {/* Tap label/arrow to flip direction (or remove). */}
                        <button
                          type="button"
                          onClick={() => toggleSort(opt.key)}
                          className="flex flex-1 items-center gap-2 text-left text-[14px] font-medium"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">
                            {rank + 1}
                          </span>
                          {opt.label}
                          <svg
                            className={`h-5 w-5 transition-transform ${opt.dir === "asc" ? "rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M12 5v14M5 12l7 7 7-7" />
                          </svg>
                        </button>

                        {/* Reorder priority. */}
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveSort(opt.key, "up")}
                            disabled={rank === 0}
                            aria-label="Increase priority"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 transition hover:bg-emerald-500/15 disabled:opacity-30"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => moveSort(opt.key, "down")}
                            disabled={rank === sortBy.length - 1}
                            aria-label="Decrease priority"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 transition hover:bg-emerald-500/15 disabled:opacity-30"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sticky footer — clear all sorts / done. */}
              <div
                className="flex shrink-0 items-center gap-3 border-t border-app-line px-5 py-3"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
              >
                <button
                  type="button"
                  onClick={() => setSortBy([])}
                  className="rounded-xl border border-app-line bg-app-surface px-5 py-2.5 text-[13px] font-semibold text-app-graphite transition hover:bg-app-canvas2"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setSortOpen(false)}
                  className="flex-1 rounded-xl bg-app-ink px-5 py-2.5 text-[13px] font-semibold text-app-canvas transition active:scale-[0.99]"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SalesInventory;
