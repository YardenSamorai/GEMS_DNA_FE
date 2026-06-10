import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchSoapStones } from "../../services/stonesApi";
import { getDisplayShape, getDisplayColor, shortTreatment } from "../inventory/helpers/constants";
import { getMappedCategories } from "../../utils/categoryMap";
import { DIAMOND_SHAPES } from "./diamondShapes";
import BarcodeScanner from "../inventory/components/BarcodeScanner";

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
const SHAPE_MATCH = {
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

const norm = (v) => (v == null ? "" : String(v).trim().toUpperCase());

/* Parse a measurement string ("14.94-11.75-6.62" / "14.94 x 11.75 x 6.62")
 * into [length, width, depth] numbers. */
const parseDims = (m) =>
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

/* "Coming soon" fallback shown when a stone has no usable photo (or its URL
 * fails to load). Pure CSS so it's crisp at any size and theme-aware. */
const ComingSoon = () => (
  <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-app-canvas2 to-app-canvas text-app-soft">
    <svg className="h-9 w-9 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.2}
        d="M4 9h16M9 3.5L6.5 9l5.5 11.5L17.5 9 15 3.5M9 3.5h6M9 3.5L12 9l3-5.5M12 9v11.5"
      />
    </svg>
    <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em]">Coming soon</span>
  </div>
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
const fluorDisplay = (v) => FLUOR_DISPLAY[norm(v)] || v || "";

/* "$12,500" — whole-dollar money formatting. */
const money = (n) => {
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
};
const normLoc = (v) => String(v || "").trim().replace(/\s+/g, " ").toUpperCase();

/* Resolve the location line + memo flag for a stone.
 *  - Known in-house location  -> clean label, not on memo.
 *  - Other (real company)     -> show it, flagged as MEMO OUT.
 *  - Empty                    -> fall back to branch/city, not on memo. */
const resolveLocation = (s) => {
  const raw = s.exactLocation && String(s.exactLocation).trim() ? String(s.exactLocation).trim() : "";
  if (!raw) return { label: s.location || null, memo: false };
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

/* Many soap_stones rows carry a folder-only image URL (e.g. ".../StoneImages/")
 * with no filename — the Barak export emits the directory even when no photo
 * was uploaded, so the URL 404s and renders as a broken thumbnail. Treat those
 * as "no image": require a filename after the last slash, otherwise fall back
 * to the first usable additional picture, else show the placeholder. */
const usableImg = (u) => {
  if (!u || typeof u !== "string") return null;
  const trimmed = u.trim();
  if (!trimmed) return null;
  const file = trimmed.split("?")[0].split("/").pop();
  return file ? trimmed : null;
};

const stoneImage = (s) => {
  const main = usableImg(s.imageUrl);
  if (main) return main;
  const firstExtra = (s.additionalPictures || "").split(";")[0];
  return usableImg(firstExtra);
};

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

/* One plain detail line under the title (treatment, lab, measurements, …). */
const Line = ({ value }) =>
  value == null || value === "" ? null : (
    <p className="text-[12.5px] leading-snug text-app-muted">{value}</p>
  );

const GemstoneCard = ({ stone, mode }) => {
  const isDiamond = mode === "diamond";
  const title = isDiamond ? buildDiamondTitle(stone) : buildTitle(stone);
  const holder = stone.holder && String(stone.holder).trim() ? String(stone.holder).trim() : null;
  // Precise location + memo flag (see resolveLocation).
  const { label: locationLine, memo: memoOut } = resolveLocation(stone);
  const lab = stone.lab && String(stone.lab).toUpperCase() !== "N/A" ? stone.lab : null;
  const treatment = stone.treatment ? shortTreatment(stone.treatment) : null;
  const img = stoneImage(stone);
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = img && !imgFailed;

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
      <div className="aspect-square w-full overflow-hidden rounded-xl bg-app-canvas2">
        {showImage ? (
          <img
            src={img}
            alt={title || stone.sku}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <ComingSoon />
        )}
      </div>

      {/* Details — bold title, then plain stacked lines (catalog style). */}
      <div className="mt-2.5 flex flex-col gap-0.5">
        {/* HOLD flag — stones currently held show the holder's name in bold red. */}
        {holder && (
          <p className="text-[12.5px] font-bold uppercase leading-snug tracking-wide text-red-600">
            HOLD · {holder}
          </p>
        )}
        {/* MEMO OUT flag — stone is physically out with a third party. */}
        {memoOut && (
          <span className="mb-0.5 inline-flex w-fit items-center rounded-md bg-amber-100 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-amber-700">
            Memo out
          </span>
        )}
        <h3 className="text-[14px] font-semibold leading-snug text-app-ink">
          {title || stone.sku || (isDiamond ? "Diamond" : "Gemstone")}
        </h3>
        {isDiamond ? (
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
          </>
        )}
      </div>
    </div>
  );
};

const SalesInventory = ({ mode = "gemstone" }) => {
  const cfg = MODES[mode] || MODES.gemstone;
  const [stones, setStones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [skuQuery, setSkuQuery] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
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
  // Basic block (open by default) wraps the primary filters; Advanced
  // (collapsed) holds the finish grades + fluorescence.
  const [basicOpen, setBasicOpen] = useState(true);
  const [measureOpen, setMeasureOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [cutSel, setCutSel] = useState([]);
  const [polishSel, setPolishSel] = useState([]);
  const [symmetrySel, setSymmetrySel] = useState([]);
  const [fluorSel, setFluorSel] = useState([]);
  const [parcelSel, setParcelSel] = useState([]);
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

  useEffect(() => {
    let cancelled = false;
    // Different categories expose different filters — clear selections so a
    // shape picked under Diamonds doesn't linger when you hop to Emeralds.
    setShapeSel([]);
    setSizeFrom("");
    setSizeTo("");
    setSizeBands([]);
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
    setBasicOpen(true);
    setMeasureOpen(false);
    setAdvancedOpen(false);
    setCutSel([]);
    setPolishSel([]);
    setSymmetrySel([]);
    setFluorSel([]);
    setParcelSel([]);
    setOnlyCert(false);
    setOnlyMedia(false);
    setOnlyInStock(false);
    setSkuQuery("");
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        // Sales Inventory is a shared catalog of every stone we hold, so we
        // intentionally do NOT pass the current actor: /api/soap-stones scopes
        // reps to their own + unassigned stones, which made the page show 0
        // for salespeople while owners saw everything. Calling with no actor
        // returns the full inventory consistently for everyone.
        const data = await fetchSoapStones(undefined, { assignedTo: "all" });
        const rows = Array.isArray(data?.stones) ? data.stones : Array.isArray(data) ? data : [];
        if (!cancelled) {
          setStones(rows.filter((s) => cfg.test(getMappedCategories(s.category))));
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
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

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

      if (labSel.length) {
        const lab = norm(s.lab);
        if (!labSel.some((v) => lab.includes(norm(v)))) return false;
      }

      if (locationSel.length) {
        const loc = norm(s.location);
        if (!locationSel.some((v) => (LOCATION_MATCH[v] || [v]).some((t) => loc.includes(t)))) {
          return false;
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

      if (onlyCert && !(s.certificateUrl || s.certificateNumber)) return false;
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

  // Reset paging whenever the filtered set changes so the grid starts at top.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filtered]);

  const resetFilters = () => {
    setShapeSel([]);
    setSizeFrom("");
    setSizeTo("");
    setSizeBands([]);
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
    setCutSel([]);
    setPolishSel([]);
    setSymmetrySel([]);
    setFluorSel([]);
    setParcelSel([]);
    setOnlyCert(false);
    setOnlyMedia(false);
    setOnlyInStock(false);
  };

  const visibleStones = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = visibleCount < filtered.length;

  // Infinite scroll — reveal the next batch when the sentinel nears the
  // viewport. `rootMargin` pre-loads slightly before the user hits bottom.
  const sentinelRef = useRef(null);
  const loadMore = useCallback(() => {
    setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length));
  }, [filtered.length]);

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

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      {/* No page title — the bottom dock already shows which catalog you're in.
          "Filter" sits top-left, "Sort" top-right, where the title used to be. */}
      <div className="flex items-center justify-between gap-3">
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
              <GemstoneCard key={stone.id ?? stone.sku ?? idx} stone={stone} mode={mode} />
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
              className="absolute inset-x-0 bottom-0 flex h-[70vh] flex-col rounded-t-3xl border-t border-app-line bg-app-surface"
              role="dialog"
              aria-modal="true"
              aria-label="Filters"
            >
              {/* Drag handle */}
              <div className="flex shrink-0 justify-center pt-3 pb-1">
                <div className="h-1.5 w-12 rounded-full bg-app-line2" />
              </div>

              {/* Sheet header */}
              <div className="flex shrink-0 items-center justify-between border-b border-app-line px-5 py-3">
                <h2 className="text-base font-semibold tracking-tight text-app-ink">Filter</h2>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
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
                {mode === "diamond" ? (
                  <div className="space-y-7">
                  {/* Parcel type — kept above Basic; diamonds use Single / Pair. */}
                  <section>
                    <h3 className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-app-muted">
                      Parcel type
                    </h3>
                    <ScrollRow>
                      {PARCEL_OPTIONS.map((p) => (
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

                  {/* Size — custom From/To carat fields plus quick bands. */}
                  <section>
                    <h3 className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-app-muted">
                      Size
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

                  {/* Colour — White grades (D–Z) or, under Fancy, intensity +
                      fancy-colour pickers. All multi-select. */}
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

                  {/* Clarity — multi-select grade chips. */}
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

                  {/* Lab — multi-select grading labs. */}
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

                  {/* Location — multi-select stock locations. */}
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

                  {/* Quick toggles — keep stones that carry a cert / media. */}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                    {[
                      { label: "Only with cert", checked: onlyCert, set: setOnlyCert },
                      { label: "Only with media", checked: onlyMedia, set: setOnlyMedia },
                      { label: "Only in stock", checked: onlyInStock, set: setOnlyInStock },
                    ].map(({ label, checked, set }) => (
                      <label
                        key={label}
                        className="flex cursor-pointer select-none items-center gap-2 text-[13px] font-medium text-app-ink"
                      >
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${
                            checked
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-app-line bg-app-surface text-transparent"
                          }`}
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor">
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

                  {/* Advanced Search — collapsible divider revealing finish
                      grades (Cut / Polish / Symmetry) and Fluorescence. */}
                  <SectionDivider
                    label="Advanced search"
                    open={advancedOpen}
                    onClick={() => setAdvancedOpen((o) => !o)}
                  />
                  {advancedOpen && (
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
                  onClick={() => setFiltersOpen(false)}
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
              className="absolute inset-x-0 bottom-0 flex max-h-[70vh] flex-col rounded-t-3xl border-t border-app-line bg-app-surface"
              role="dialog"
              aria-modal="true"
              aria-label="Sort"
            >
              {/* Drag handle */}
              <div className="flex shrink-0 justify-center pt-3 pb-1">
                <div className="h-1.5 w-12 rounded-full bg-app-line2" />
              </div>

              {/* Sheet header */}
              <div className="flex shrink-0 items-center justify-between border-b border-app-line px-5 py-3">
                <h2 className="text-base font-semibold tracking-tight text-app-ink">Sort</h2>
                <button
                  type="button"
                  onClick={() => setSortOpen(false)}
                  aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-app-muted transition hover:bg-app-canvas2 hover:text-app-ink"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              {/* Scrollable body */}
              <div
                className="flex-1 overflow-auto p-5"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
              >
                <p className="text-[13px] text-app-soft">No sort options configured yet.</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SalesInventory;
