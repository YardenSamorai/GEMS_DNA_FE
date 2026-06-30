import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { fetchJewelryCatalog } from "../../services/jewelryApi";
import { fetchSoapStones } from "../../services/stonesApi";
import { useTeam } from "../../context/TeamContext";
import { decryptPrice } from "../../utils/decrypt";
import { sanitizeText, normalizeJewelryCategory } from "../../utils/helper";
import { getDisplayShape } from "../inventory/helpers/constants";
import { DIAMOND_SHAPES } from "./diamondShapes";
import { StonePlaceholder, SHAPE_MATCH, norm, SelectToggle, prettyBranch, modeForStone } from "./SalesInventory";

/* Stone catalog routes by mode — used to hop a SKU search over to the loose
 * stone catalog when the searched SKU belongs to a stone, not a jewelry piece. */
const STONE_ROUTES = {
  diamond: "/sales/diamonds",
  emerald: "/sales/emeralds",
  gemstone: "/sales/gemstones",
};

/* ============================================================================
 * SalesJewelry — the jewelry surface of the sales catalog.
 *
 * Mirrors the diamond / emerald / gemstone pages (same card grid, Filter /
 * Search / Sort header, live result count, infinite scroll, persisted state and
 * floating filter button) but reads the WooCommerce-fed jewelry catalog
 * (/api/jewelry).
 *
 * Filter sheet uses the shared three collapsible sections — Basic / Advanced
 * search / Measurements. Basic is fully built; the other two are scaffolded.
 * ========================================================================== */

const PAGE_SIZE = 12;
const STORE_KEY = "salesFilters:v2:jewelry";
/* Saved filters live for two hours, then reset (idle-based timer). */
const FILTER_TTL_MS = 2 * 60 * 60 * 1000;

/* Catalog scroll restoration on Back from a product page. */
const SCROLL_KEY = "salesScroll:v1:jewelry";
const SCROLL_TTL_MS = 5 * 60 * 1000;
/* The catalog scrolls inside <main> on mobile (the document is locked) and on
 * the window on desktop — read/write both so save+restore work everywhere. */
const getScrollY = () => {
  const main = typeof document !== "undefined" ? document.querySelector("main") : null;
  return Math.max(main?.scrollTop || 0, window.scrollY || window.pageYOffset || 0);
};
const setScrollY = (y) => {
  const main = typeof document !== "undefined" ? document.querySelector("main") : null;
  if (main) main.scrollTop = y;
  window.scrollTo(0, y);
};
const saveScrollPos = (count) => {
  try {
    sessionStorage.setItem(
      SCROLL_KEY,
      JSON.stringify({ y: getScrollY(), count, t: Date.now() })
    );
  } catch {
    /* non-fatal */
  }
};
const readScrollPos = () => {
  try {
    const raw = sessionStorage.getItem(SCROLL_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || typeof p.y !== "number" || Date.now() - (p.t || 0) > SCROLL_TTL_MS) return null;
    return p;
  } catch {
    return null;
  }
};
const clearScrollPos = () => {
  try {
    sessionStorage.removeItem(SCROLL_KEY);
  } catch {
    /* non-fatal */
  }
};

/* The four headline jewelry kinds (with their own line icons). `match` lists
 * the jewelry_type values that fold into each button. */
const JEWELRY_KINDS = [
  {
    key: "Rings",
    label: "Rings",
    match: ["RINGS", "RING"],
    icon: (cls) => (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <circle cx="12" cy="15.5" r="5.5" strokeWidth={1.3} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.3} d="M9.4 6.3l2.6-3 2.6 3L12 9 9.4 6.3zM9.4 6.3h5.2" />
      </svg>
    ),
  },
  {
    key: "Earrings",
    label: "Earrings",
    match: ["EARRINGS", "EARRING"],
    icon: (cls) => (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeWidth={1.3} d="M8 3.5v3.2M16 3.5v3.2" />
        <path strokeLinejoin="round" strokeWidth={1.3} d="M8 6.7c-2 2-3 3.9-3 6.2C5 16 6.3 18 8 18s3-2 3-5.1c0-2.3-1-4.2-3-6.2z" />
        <path strokeLinejoin="round" strokeWidth={1.3} d="M16 6.7c-2 2-3 3.9-3 6.2C13 16 14.3 18 16 18s3-2 3-5.1c0-2.3-1-4.2-3-6.2z" />
      </svg>
    ),
  },
  {
    key: "Necklaces",
    label: "Necklaces",
    match: ["NECKLACES", "NECKLACE", "PENDANTS", "PENDANT"],
    icon: (cls) => (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeWidth={1.3} d="M4 4c1.5 6 4.8 8.5 8 8.5S18.5 10 20 4" />
        <path strokeLinejoin="round" strokeWidth={1.3} d="M12 12.5l2.2 1.6v2.9L12 19l-2.2-2v-2.9L12 12.5z" />
      </svg>
    ),
  },
  {
    key: "Bracelets",
    label: "Bracelets",
    match: ["BRACELETS", "BRACELET", "BANGLE"],
    icon: (cls) => (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <ellipse cx="12" cy="12" rx="9" ry="5.4" strokeWidth={1.3} />
        <circle cx="7.6" cy="12" r="0.7" fill="currentColor" />
        <circle cx="12" cy="12" r="0.85" fill="currentColor" />
        <circle cx="16.4" cy="12" r="0.7" fill="currentColor" />
      </svg>
    ),
  },
];

const GEM_TYPES = ["Diamonds", "Emeralds", "Fancy", "Gemstones", "Other"];

/* Branch filter — mirrors the loose-stone catalogs. Chips show the short code,
 * matched against the (BE-resolved) branch name on each row. */
const LOCATION_OPTIONS = ["HK", "IL", "LA", "NY"];
const LOCATION_MATCH = {
  HK: ["HK", "HONG KONG"],
  IL: ["IL", "ISRAEL"],
  LA: ["LA", "LOS ANGELES"],
  NY: ["NY", "NEW YORK"],
};

/* Total carat quick bands. */
const TCW_PRESETS = [
  { label: "0.00 - 2.99", from: "0", to: "2.99" },
  { label: "3.00 - 4.99", from: "3", to: "4.99" },
  { label: "5.00 - 9.99", from: "5", to: "9.99" },
  { label: "10.00 - 15.00", from: "10", to: "15" },
  { label: "15.00 +", from: "15", to: "" },
];

/* Total-price quick bands ($). */
const PRICE_PRESETS = [
  { label: "Up to 5K", from: "", to: "5000" },
  { label: "5K - 10K", from: "5000", to: "10000" },
  { label: "10K - 50K", from: "10000", to: "50000" },
  { label: "50K - 100K", from: "50000", to: "100000" },
  { label: "100K & Up", from: "100000", to: "" },
];

const FILTER_DEFAULTS = {
  jewelrySel: [],
  shapeSel: [],
  styleSel: [],
  gemTypeSel: [],
  locationSel: [],
  tcwFrom: "",
  tcwTo: "",
  tcwBands: [],
  priceFrom: "",
  priceTo: "",
  priceBands: [],
  skuQuery: "",
  sortKey: "",
  sortDir: "asc",
};

const loadSaved = () => {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.t === "number") {
      if (Date.now() - parsed.t > FILTER_TTL_MS) {
        localStorage.removeItem(STORE_KEY);
        return {};
      }
      return parsed.f || {};
    }
    return {}; // older un-timestamped format — ignore
  } catch {
    return {};
  }
};

const money = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  return `$${Math.round(v).toLocaleString()}`;
};

/* OR-combine a custom range with quick bands over a numeric field. When a
 * filter is active but the value is missing, the row is excluded. */
const numericOk = (value, from, to, bands, presets) => {
  const hasRange = from || to;
  if (!hasRange && !bands.length) return true;
  const v = Number(value);
  if (!Number.isFinite(v)) return false;
  if (hasRange) {
    const f = from ? parseFloat(from) : -Infinity;
    const t = to ? parseFloat(to) : Infinity;
    if (v >= f && v <= t) return true;
  }
  if (bands.length) {
    return bands.some((label) => {
      const b = presets.find((p) => p.label === label);
      if (!b) return false;
      const f = b.from ? parseFloat(b.from) : -Infinity;
      const t = b.to ? parseFloat(b.to) : Infinity;
      return v >= f && v <= t;
    });
  }
  return false;
};

/* Gem-type bucket from the raw stone_type. "Gemstones" = any coloured stone
 * that isn't a diamond / emerald / fancy; "Other" = no stone type at all. */
const matchGemType = (stoneType, selected) => {
  if (!selected.length) return true;
  const t = norm(stoneType);
  return selected.some((sel) => {
    if (sel === "Diamonds") return t.includes("DIAMOND");
    if (sel === "Emeralds") return t.includes("EMERALD");
    if (sel === "Fancy") return t.includes("FANCY");
    if (sel === "Gemstones")
      return !!t && !t.includes("DIAMOND") && !t.includes("EMERALD") && !t.includes("FANCY");
    if (sel === "Other") return !t;
    return false;
  });
};

/* Map a raw jewelry_products row into the flat shape the card + filters use. */
export const mapRow = (row) => {
  const images = (row.all_pictures_link || "")
    .split(";")
    .map((u) => u.trim())
    .filter(Boolean);
  const firstImage = images[0] || null;
  // The WooCommerce feed sends `price` as a plain number ("1000", "10000"),
  // but some older rows may still be AES-encrypted. Try a direct numeric parse
  // first and only fall back to decryption when that isn't a finite number.
  let price = 0;
  const rawPrice = row.price;
  if (rawPrice != null && String(rawPrice).trim() !== "") {
    const direct = Number(rawPrice);
    if (Number.isFinite(direct)) {
      price = direct;
    } else {
      try {
        price = Number(decryptPrice(rawPrice)) || 0;
      } catch {
        price = 0;
      }
    }
  }
  // Location surface (mirrors loose stones). `branch` + `exactLocation` come
  // from the linked centre stone (masked per viewer on the BE); `location`
  // stays branch-backward-compatible. on memo/hold flags drive the catalog tags.
  const branch = row.branch ? String(row.branch).trim() : (row.shipping_from ? String(row.shipping_from).trim() : "");
  const exactLocation = row.exact_location ? String(row.exact_location).trim() : "";
  return {
    kind: "jewelry",
    id: row.model_number,
    sku: row.model_number || "",
    name: sanitizeText(row.title) || row.model_number || "Untitled",
    location: branch,
    branch,
    exactLocation,
    holder: row.holder ? String(row.holder).trim() : "",
    onMemo: !!row.on_memo,
    onHold: !!row.on_hold,
    videoUrl: row.video_link ? String(row.video_link).trim() : "",
    certificateUrl: row.certificate_link ? String(row.certificate_link).trim() : "",
    certificateNumber: row.certificate_number ? String(row.certificate_number).trim() : "",
    jewelryType: row.jewelry_type ? String(row.jewelry_type).trim() : "",
    style: row.style ? String(row.style).trim() : "",
    stoneType: row.stone_type ? String(row.stone_type).trim() : "",
    shape: row.center_stone_shape ? String(row.center_stone_shape).trim() : "",
    centerCarat:
      row.center_stone_carat != null && row.center_stone_carat !== "" ? Number(row.center_stone_carat) : null,
    jewelryWeight:
      row.jewelry_weight != null && row.jewelry_weight !== "" ? Number(row.jewelry_weight) : null,
    totalCarat: row.total_carat != null && row.total_carat !== "" ? Number(row.total_carat) : null,
    category:
      normalizeJewelryCategory(row.jewelry_type) ||
      normalizeJewelryCategory(row.style) ||
      normalizeJewelryCategory(row.category) ||
      "",
    metal: row.metal_type ? String(row.metal_type).trim() : "",
    image: firstImage,
    images,
    price: price || 0,
  };
};

/* Collapsible section header — same hairline + center label + chevron as the
 * stone catalogs. */
const SectionDivider = ({ label, open, onClick }) => (
  <button type="button" aria-expanded={open} onClick={onClick} className="flex w-full items-center gap-3 py-1">
    <span className="h-px flex-1 bg-app-line" />
    <span className="flex items-center gap-2 text-app-ink">
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

/* A single toggleable filter chip (matches the stone catalogs). */
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

const FieldLabel = ({ children, onClear, showClear }) => (
  <div className="mb-2.5 flex items-center justify-between">
    <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-app-muted">{children}</h3>
    {showClear && (
      <button type="button" onClick={onClear} className="text-[12px] font-medium text-app-soft hover:text-app-ink">
        Clear
      </button>
    )}
  </div>
);

const SORT_OPTIONS = [
  { key: "price", label: "Price" },
  { key: "name", label: "Name" },
  { key: "category", label: "Category" },
];

const SalesJewelry = () => {
  const { actor } = useTeam();
  const location = useLocation();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const saved = useMemo(() => ({ ...FILTER_DEFAULTS, ...loadSaved() }), []);
  const [jewelrySel, setJewelrySel] = useState(saved.jewelrySel);
  const [shapeSel, setShapeSel] = useState(saved.shapeSel);
  const [styleSel, setStyleSel] = useState(saved.styleSel);
  const [gemTypeSel, setGemTypeSel] = useState(saved.gemTypeSel);
  const [locationSel, setLocationSel] = useState(saved.locationSel);
  const [tcwFrom, setTcwFrom] = useState(saved.tcwFrom);
  const [tcwTo, setTcwTo] = useState(saved.tcwTo);
  const [tcwBands, setTcwBands] = useState(saved.tcwBands);
  const [priceFrom, setPriceFrom] = useState(saved.priceFrom);
  const [priceTo, setPriceTo] = useState(saved.priceTo);
  const [priceBands, setPriceBands] = useState(saved.priceBands);
  const [skuQuery, setSkuQuery] = useState(saved.skuQuery);
  const [sortKey, setSortKey] = useState(saved.sortKey);
  const [sortDir, setSortDir] = useState(saved.sortDir);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const pendingScrollRef = useRef(null);
  const restorePendingRef = useRef(false);

  const [basicOpen, setBasicOpen] = useState(true);

  // Loose stones (every category) — lets a SKU search recognise a stone that
  // lives in the loose catalog and hop the rep over to it.
  const allStonesRef = useRef([]);

  // Arrived from a cross-category SKU search (the searched SKU is a jewelry
  // piece): seed the search box with the query, then CONSUME it from history
  // state so Back-navigation later doesn't re-inject the old SKU.
  useEffect(() => {
    if (location.state?.searchSku) {
      setSkuQuery(location.state.searchSku);
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preload loose stones once (per actor) for the reverse SKU hop.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchSoapStones(actor, { assignedTo: "all" });
        const list = Array.isArray(data?.stones) ? data.stones : Array.isArray(data) ? data : [];
        if (!cancelled) allStonesRef.current = list;
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [actor?.id]);

  // Cross-category SKU search: if the query matches no jewelry piece but does
  // match a loose stone, hop to that stone's catalog (carrying the query).
  useEffect(() => {
    const q = norm(skuQuery);
    if (loading || q.length < 3) return undefined;
    const t = setTimeout(() => {
      if (rows.some((r) => norm(`${r.name} ${r.sku}`).includes(q))) return;
      const match = (allStonesRef.current || []).find(
        (s) => norm(s.sku).includes(q) || norm(s.pairSku).includes(q)
      );
      if (!match) return;
      const route = STONE_ROUTES[modeForStone(match)];
      if (route) navigate(route, { state: { searchSku: skuQuery } });
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skuQuery, rows, loading]);

  // Persist the chosen filters so the page reopens exactly as it was left.
  useEffect(() => {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          t: Date.now(),
          f: {
            jewelrySel, shapeSel, styleSel, gemTypeSel, locationSel,
            tcwFrom, tcwTo, tcwBands, priceFrom, priceTo, priceBands,
            skuQuery, sortKey, sortDir,
          },
        })
      );
    } catch {
      /* storage unavailable — non-fatal */
    }
  }, [
    jewelrySel, shapeSel, styleSel, gemTypeSel, locationSel,
    tcwFrom, tcwTo, tcwBands, priceFrom, priceTo, priceBands,
    skuQuery, sortKey, sortDir,
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const data = await fetchJewelryCatalog(actor);
        const mapped = (data?.jewelry || []).map(mapRow);
        if (!cancelled) {
          setRows(mapped);
          const savedScroll = readScrollPos();
          setVisibleCount(savedScroll?.count ? Math.max(PAGE_SIZE, savedScroll.count) : PAGE_SIZE);
          pendingScrollRef.current = savedScroll ? savedScroll.y : null;
          restorePendingRef.current = !!savedScroll;
          clearScrollPos();
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load jewelry");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [actor?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Does a row's jewelry_type fall under any of the picked headline kinds?
  // Match on whole words only — a bare `includes` made "EARRINGS" contain the
  // substring "RING", so the Rings filter wrongly returned earrings too.
  const matchesJewelry = (row) => {
    if (!jewelrySel.length) return true;
    const words = norm(row.jewelryType).split(/[^A-Z0-9]+/).filter(Boolean);
    return jewelrySel.some((key) => {
      const kind = JEWELRY_KINDS.find((j) => j.key === key);
      return kind && kind.match.some((m) => words.includes(m));
    });
  };

  // Style options depend on the jewelry selection (or the whole catalog when
  // nothing is picked) — "the fields here change with the jewelry choice".
  const styleOptions = useMemo(() => {
    // Count occurrences so the most common styles lead the list.
    const counts = new Map(); // lowercase key -> { label, n }
    for (const r of rows) {
      if (!matchesJewelry(r)) continue;
      const s = (r.style || "").trim();
      if (!s) continue;
      const k = s.toLowerCase();
      const cur = counts.get(k);
      if (cur) cur.n += 1;
      else counts.set(k, { label: s, n: 1 });
    }
    return Array.from(counts.values())
      .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label))
      .map((x) => x.label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, jewelrySel]);

  // Drop any selected styles that are no longer offered after a jewelry change.
  useEffect(() => {
    setStyleSel((prev) => prev.filter((s) => styleOptions.includes(s)));
  }, [styleOptions]);

  const filtered = useMemo(() => {
    const q = skuQuery.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (!matchesJewelry(r)) return false;
      if (shapeSel.length) {
        const raw = norm(r.shape);
        const dna = norm(getDisplayShape(r.shape));
        const ok = shapeSel.some((k) =>
          (SHAPE_MATCH[k] || [k.toUpperCase()]).some((m) => m === raw || m === dna)
        );
        if (!ok) return false;
      }
      if (styleSel.length && !styleSel.some((s) => s.toLowerCase() === (r.style || "").toLowerCase()))
        return false;
      if (locationSel.length) {
        const loc = norm(r.branch);
        if (!locationSel.some((v) => (LOCATION_MATCH[v] || [v]).some((t) => loc.includes(t)))) return false;
      }
      if (!matchGemType(r.stoneType, gemTypeSel)) return false;
      if (!numericOk(r.totalCarat, tcwFrom, tcwTo, tcwBands, TCW_PRESETS)) return false;
      if (!numericOk(r.price, priceFrom, priceTo, priceBands, PRICE_PRESETS)) return false;
      if (q) {
        const hay = `${r.name} ${r.sku}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortKey) {
      const dir = sortDir === "desc" ? -1 : 1;
      out.sort((a, b) => {
        if (sortKey === "price") {
          return ((Number(a.price) || 0) - (Number(b.price) || 0)) * dir;
        }
        return String(a[sortKey] || "").toLowerCase().localeCompare(String(b[sortKey] || "").toLowerCase()) * dir;
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rows, jewelrySel, shapeSel, styleSel, gemTypeSel, locationSel,
    tcwFrom, tcwTo, tcwBands, priceFrom, priceTo, priceBands,
    skuQuery, sortKey, sortDir,
  ]);

  const visibleRows = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  useEffect(() => {
    if (restorePendingRef.current) {
      restorePendingRef.current = false;
      return;
    }
    setVisibleCount(PAGE_SIZE);
  }, [filtered.length]);

  // Restore the saved scroll position once the grid has rendered after Back.
  useEffect(() => {
    if (loading || pendingScrollRef.current == null) return;
    const y = pendingScrollRef.current;
    pendingScrollRef.current = null;
    requestAnimationFrame(() => requestAnimationFrame(() => setScrollY(y)));
  }, [loading]);

  // Infinite scroll sentinel.
  const sentinelRef = useRef(null);
  useEffect(() => {
    if (!hasMore) return undefined;
    const node = sentinelRef.current;
    if (!node) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length));
        }
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [hasMore, filtered.length]);

  // Header ref (kept for layout; the floating filter button is always shown).
  const headerRef = useRef(null);

  const toggleIn = (setter) => (val) =>
    setter((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]));
  const toggleBand = (setter) => (label) =>
    setter((prev) => (prev.includes(label) ? prev.filter((v) => v !== label) : [...prev, label]));

  const resetFilters = () => {
    setJewelrySel([]);
    setShapeSel([]);
    setStyleSel([]);
    setGemTypeSel([]);
    setLocationSel([]);
    setTcwFrom("");
    setTcwTo("");
    setTcwBands([]);
    setPriceFrom("");
    setPriceTo("");
    setPriceBands([]);
  };

  const onSortClick = (key) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey("");
      setSortDir("asc");
    }
  };

  const filterCount =
    jewelrySel.length +
    shapeSel.length +
    styleSel.length +
    gemTypeSel.length +
    locationSel.length +
    tcwBands.length +
    (tcwFrom || tcwTo ? 1 : 0) +
    priceBands.length +
    (priceFrom || priceTo ? 1 : 0);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Header row — Filter left, search middle, Sort right. */}
      <div ref={headerRef} className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="relative rounded-xl border border-app-line bg-app-surface px-5 py-2 text-sm font-semibold tracking-tight text-app-ink transition hover:bg-app-canvas2 active:scale-95"
        >
          Filter
          {filterCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-600 px-1 text-[11px] font-bold text-white">
              {filterCount}
            </span>
          )}
        </button>

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
            placeholder="Search name / SKU"
            className="w-full rounded-xl border border-app-line bg-app-surface py-2 pl-9 pr-3 text-sm text-app-ink placeholder:text-app-soft focus:border-app-ink focus:outline-none"
          />
        </label>

        <button
          type="button"
          onClick={() => setSortOpen(true)}
          className="rounded-xl border border-app-line bg-app-surface px-5 py-2 text-sm font-semibold tracking-tight text-app-ink transition hover:bg-app-canvas2 active:scale-95"
        >
          Sort
        </button>
      </div>

      {!loading && !error && (
        <div className="mt-2 flex items-center justify-between gap-3 pl-1">
          <p className="text-[12px] font-medium text-app-soft">
            {filtered.length.toLocaleString()} {filtered.length === 1 ? "result" : "results"}
          </p>
          {filterCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(5,150,105,0.7)] transition hover:bg-emerald-700 active:scale-95"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v6h6M20 20v-6h-6M20 9a8 8 0 00-14.3-3.4L4 7M4 15a8 8 0 0014.3 3.4L20 17" />
              </svg>
              Reset
            </button>
          )}
        </div>
      )}

      {/* Floating Filter button */}
      <button
        type="button"
        onClick={() => setFiltersOpen(true)}
        aria-label="Open filters"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)" }}
        className="fixed right-4 z-30 flex items-center gap-2 rounded-full bg-app-ink px-5 py-3 text-[13.5px] font-semibold text-app-canvas shadow-[0_8px_24px_-6px_rgba(0,0,0,0.45)] transition-all duration-200 md:hidden pointer-events-auto translate-y-0 opacity-100"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5h18M6 12h12M10 19h4" />
        </svg>
        Filter
        {filterCount > 0 && <span className="tabular-nums">· {filterCount}</span>}
      </button>

      {/* Loading skeletons */}
      {loading && (
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-square w-full rounded-xl skeleton" />
              <div className="mt-2.5 h-4 w-3/4 rounded skeleton" />
              <div className="mt-1.5 h-3 w-1/2 rounded skeleton" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-2xl glass-surface p-10 text-center">
          <p className="text-[14px] font-medium text-app-ink">{error}</p>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="mt-8 rounded-2xl glass-surface p-10 text-center">
          <p className="text-[14px] font-medium text-app-ink">
            {rows.length === 0 ? "No jewelry in catalog" : "No jewelry matches your filters"}
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
            {visibleRows.map((item, idx) => (
              <Link
                key={item.id ?? item.sku ?? idx}
                to={`/sales/jewelry/${encodeURIComponent(item.sku || "")}`}
                state={{ item }}
                onClick={() => saveScrollPos(visibleCount)}
                className="transition active:opacity-80"
              >
                <JewelryCard item={item} />
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

      {/* ---- Filter sheet ---- */}
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
              aria-label="Jewelry filters"
            >
              <div className="flex items-center justify-between border-b border-app-line px-5 py-3.5">
                <h2 className="text-[16px] font-semibold tracking-tight text-app-ink">Filters</h2>
                <div className="flex items-center gap-2">
                  {filterCount > 0 && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-red-600 transition hover:bg-red-50 active:scale-95"
                    >
                      Reset
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    aria-label="Close"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-app-soft transition hover:bg-app-canvas2 hover:text-app-ink"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-7 overflow-y-auto px-5 py-4">
                <SectionDivider label="Basic" open={basicOpen} onClick={() => setBasicOpen((o) => !o)} />
                {basicOpen && (
                  <>
                    {/* Jewelry — four headline kinds with icons. */}
                    <section>
                      <FieldLabel showClear={jewelrySel.length > 0} onClear={() => setJewelrySel([])}>
                        Jewelry
                      </FieldLabel>
                      <div className="grid grid-cols-4 gap-2">
                        {JEWELRY_KINDS.map((j) => {
                          const active = jewelrySel.includes(j.key);
                          return (
                            <button
                              key={j.key}
                              type="button"
                              aria-pressed={active}
                              onClick={() => toggleIn(setJewelrySel)(j.key)}
                              className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 transition ${
                                active
                                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                                  : "border-app-line bg-app-surface text-app-graphite hover:bg-app-canvas2"
                              }`}
                            >
                              {j.icon("h-7 w-7")}
                              <span className="text-center text-[11.5px] font-medium leading-tight">{j.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </section>

                    {/* Style — options follow the jewelry selection, ordered by
                        how common each style is. Sits above Shape. */}
                    <section>
                      <FieldLabel showClear={styleSel.length > 0} onClear={() => setStyleSel([])}>
                        Style
                      </FieldLabel>
                      {styleOptions.length ? (
                        <div className="scrollbar-hide -mx-5 overflow-x-auto px-5 pb-1">
                          <div className="grid grid-flow-col grid-rows-3 auto-cols-max gap-2">
                            {styleOptions.map((s) => (
                              <Chip key={s} active={styleSel.includes(s)} onClick={() => toggleIn(setStyleSel)(s)}>
                                {s}
                              </Chip>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-[13px] text-app-soft">No styles available.</p>
                      )}
                    </section>

                    {/* Shape — same set as Emeralds. */}
                    <section>
                      <FieldLabel showClear={shapeSel.length > 0} onClear={() => setShapeSel([])}>
                        Shape
                      </FieldLabel>
                      <div className="scrollbar-hide -mx-5 overflow-x-auto px-5 pb-1">
                        <div className="grid grid-flow-col grid-rows-2 auto-cols-[90px] gap-1.5">
                          {DIAMOND_SHAPES.map((sh) => {
                            const active = shapeSel.includes(sh.key);
                            return (
                              <button
                                key={sh.key}
                                type="button"
                                aria-pressed={active}
                                onClick={() => toggleIn(setShapeSel)(sh.key)}
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
                      <FieldLabel showClear={gemTypeSel.length > 0} onClear={() => setGemTypeSel([])}>
                        Gem type
                      </FieldLabel>
                      <div className="scrollbar-hide -mx-5 overflow-x-auto px-5 pb-1">
                        <div className="flex gap-2">
                          {GEM_TYPES.map((g) => (
                            <Chip key={g} active={gemTypeSel.includes(g)} onClick={() => toggleIn(setGemTypeSel)(g)}>
                              {g}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    </section>

                    {/* Total carat weight */}
                    <section>
                      <FieldLabel>Total carat weight</FieldLabel>
                      <div className="flex items-center gap-3">
                        <label className="relative flex-1">
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            value={tcwFrom}
                            onChange={(e) => setTcwFrom(e.target.value)}
                            placeholder="From"
                            className="w-full rounded-xl border border-app-line bg-app-surface py-2.5 pl-3 pr-8 text-app-ink placeholder:text-app-soft focus:border-app-ink focus:outline-none"
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-app-soft">ct</span>
                        </label>
                        <label className="relative flex-1">
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            value={tcwTo}
                            onChange={(e) => setTcwTo(e.target.value)}
                            placeholder="To"
                            className="w-full rounded-xl border border-app-line bg-app-surface py-2.5 pl-3 pr-8 text-app-ink placeholder:text-app-soft focus:border-app-ink focus:outline-none"
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-app-soft">ct</span>
                        </label>
                      </div>
                      <div className="scrollbar-hide -mx-5 mt-3 overflow-x-auto px-5">
                        <div className="flex gap-2">
                          {TCW_PRESETS.map((p) => (
                            <Chip
                              key={p.label}
                              active={tcwBands.includes(p.label)}
                              onClick={() => toggleBand(setTcwBands)(p.label)}
                            >
                              {p.label}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    </section>

                    {/* Total price */}
                    <section>
                      <FieldLabel>Total price</FieldLabel>
                      <div className="flex items-center gap-3">
                        <label className="relative flex-1">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-app-soft">$</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={priceFrom}
                            onChange={(e) => setPriceFrom(e.target.value)}
                            placeholder="From"
                            className="w-full rounded-xl border border-app-line bg-app-surface py-2.5 pl-7 pr-3 text-app-ink placeholder:text-app-soft focus:border-app-ink focus:outline-none"
                          />
                        </label>
                        <label className="relative flex-1">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-app-soft">$</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={priceTo}
                            onChange={(e) => setPriceTo(e.target.value)}
                            placeholder="To"
                            className="w-full rounded-xl border border-app-line bg-app-surface py-2.5 pl-7 pr-3 text-app-ink placeholder:text-app-soft focus:border-app-ink focus:outline-none"
                          />
                        </label>
                      </div>
                      <div className="scrollbar-hide -mx-5 mt-3 overflow-x-auto px-5">
                        <div className="flex gap-2">
                          {PRICE_PRESETS.map((p) => (
                            <Chip
                              key={p.label}
                              active={priceBands.includes(p.label)}
                              onClick={() => toggleBand(setPriceBands)(p.label)}
                            >
                              {p.label}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    </section>

                    {/* Branch — filter by branch (HK / IL / LA / NY). */}
                    <section>
                      <FieldLabel showClear={locationSel.length > 0} onClear={() => setLocationSel([])}>
                        Branch
                      </FieldLabel>
                      <div className="scrollbar-hide -mx-5 overflow-x-auto px-5 pb-1">
                        <div className="flex gap-2">
                          {LOCATION_OPTIONS.map((loc) => (
                            <Chip key={loc} active={locationSel.includes(loc)} onClick={() => toggleIn(setLocationSel)(loc)}>
                              {loc}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    </section>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3 border-t border-app-line p-4">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-xl border border-app-line bg-app-surface px-5 py-3 text-[13px] font-semibold text-app-graphite transition hover:bg-app-canvas2"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="flex-1 rounded-xl bg-app-ink py-3 text-[14px] font-semibold text-app-canvas transition active:scale-[0.99]"
                >
                  Show {filtered.length.toLocaleString()} {filtered.length === 1 ? "result" : "results"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ---- Sort sheet ---- */}
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
              aria-label="Sort jewelry"
            >
              <div className="flex items-center justify-between border-b border-app-line px-5 py-3.5">
                <h2 className="text-[16px] font-semibold tracking-tight text-app-ink">Sort</h2>
                <button
                  type="button"
                  onClick={() => setSortOpen(false)}
                  aria-label="Close"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-app-soft transition hover:bg-app-canvas2 hover:text-app-ink"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-2">
                  {SORT_OPTIONS.map((opt) => {
                    const active = sortKey === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => onSortClick(opt.key)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-left transition ${
                          active
                            ? "border-emerald-600 bg-emerald-600/10 text-emerald-700"
                            : "border-app-line bg-app-canvas2 text-app-ink active:bg-app-line"
                        }`}
                      >
                        <span className="text-[14px] font-semibold tracking-tight">{opt.label}</span>
                        {active && (
                          <span className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide">
                            {sortDir === "asc" ? "Ascending" : "Descending"}
                            <svg
                              className={`h-4 w-4 transition-transform ${sortDir === "asc" ? "" : "rotate-180"}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* One value-only detail line (hidden when empty). */
const Line = ({ value }) =>
  value == null || value === "" ? null : (
    <p className="text-[12.5px] leading-snug text-app-muted">{value}</p>
  );

/* Catalog card — square image, then each spec stacked on its own line:
 *   center-stone weight, total weight (g), Shape, Jewelry type, Gem type,
 *   then SKU, then price. */
export const JewelryCard = ({ item }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = item.image && !imgFailed;
  const centerCt = Number.isFinite(item.centerCarat) ? `${item.centerCarat.toFixed(2)} ct` : null;
  const price = money(item.price);
  return (
    <div className="flex flex-col">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-app-canvas2">
        {showImage ? (
          <img
            src={item.image}
            alt={item.name}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <StonePlaceholder alt={item.name} />
        )}
        <SelectToggle stone={item} />
      </div>
      <div className="mt-2.5 flex flex-col gap-0.5">
        {/* Only "Memo out" is relevant for jewelry availability. */}
        {item.onMemo && (
          <div className="mb-0.5 flex flex-wrap items-center gap-1">
            <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-amber-700">
              Memo out
            </span>
          </div>
        )}
        {/* Title leads, then labelled spec lines. */}
        <h3 className="text-[14px] font-semibold leading-snug text-app-ink">{item.name || item.sku}</h3>
        <Line value={centerCt ? `Center stone weight: ${centerCt}` : null} />
        <Line value={item.branch ? `Branch: ${prettyBranch(item.branch)}` : null} />
        <Line value={item.style ? `Style: ${item.style}` : null} />
        <Line value={item.sku ? `SKU: ${item.sku}` : null} />
        {price && (
          <div className="mt-1.5">
            <span className="text-[14px] font-semibold tabular-nums text-app-ink">Total: {price}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesJewelry;
