import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import {
  BookOpen,
  FileSpreadsheet,
  FileText,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
  SlidersHorizontal,
  Table2,
  Tag,
  Users,
} from "lucide-react";

import { getMappedCategories } from "../../utils/categoryMap";
import { inventoryPriceScale, readPriceMode, writePriceMode } from "../../utils/pricing";
import { buildSkuIndex, parseSkuQuery } from "../../utils/skuQuery";
import NiimbotPrintDialog from "../../components/NiimbotPrintDialog";
import SendToCrmModal from "../crm/components/SendToCrmModal";
import AssistantChat from "../../components/assistant/AssistantChat";
import { useTeam } from "../../context/TeamContext";
import { useSelection } from "../../context/SelectionContext";
import { assignStone, fetchSoapStones, fetchStoneInventoryStatus } from "../../services/stonesApi";

import {
  API_BASE,
  DIAMOND_DEFAULT_COLUMNS,
  GEMSTONE_DEFAULT_COLUMNS,
  JEWELRY_DEFAULT_COLUMNS,
  getColumnConfig,
  parseSmartSearch,
  saveColumnConfig,
} from "./helpers/constants";
import { exportForLabels } from "./helpers/labelExport";
import { generatePDFCatalog } from "./helpers/pdfCatalog";
import { shareMultipleToWhatsApp, shareToWhatsApp } from "./helpers/whatsappHelpers";
import { exportToExcel, exportToExcelSeparate, exportToInternalExcel, getCategoryBreakdown } from "./helpers/excelExport";
import { exportCatalogLiran } from "./helpers/catalogLiran";
import BarcodeScanner from "./components/BarcodeScanner";
import CatalogLiranModal from "./components/CatalogLiranModal";
import CategoryExportModal from "./components/CategoryExportModal";
import ColumnSettingsModal from "./components/ColumnSettingsModal";
import CompareModal from "./components/CompareModal";
import ExportModal from "./components/ExportModal";
import InternalExcelModal from "./components/InternalExcelModal";
import PDFOptionsModal from "./components/PDFOptionsModal";
import TagsModal from "./components/TagsModal";

import {
  ITEMS_PER_PAGE,
  activeFilterChips,
  applyChipRemoval,
  buildCategoryOptions,
  buildDiamondColorOptions,
  buildFancyColorOptions,
  buildJewelryOptions,
  buildLabOptions,
  buildPairGroups,
  buildShapeOptions,
  DEFAULT_SORT,
  describeSort,
  distinctValues,
  dnaPathFor,
  emptyFilters,
  filterItems,
  isPairOnly,
  itemsForMode,
  MODES,
  normalizeCatalogJewelry,
  normalizeStone,
  normalizeWorkshopJewelry,
  sortItems,
  sortOptionsFor,
  stoneMode,
} from "./model/inventoryModel";
import { buildUrlParams, convertPriceUnits, hasInventoryParams, parseUrlState } from "./model/inventoryUrl";

import "./ui/inventory.css";
import InventoryHeader from "./ui/InventoryHeader";
import SearchField from "./ui/SearchField";
import FilterPanel from "./ui/FilterPanel";
import ActiveFilters from "./ui/ActiveFilters";
import Toolbar, { SelectAll } from "./ui/Toolbar";
import { PairResults, ResultsGallery, ResultsList, ResultsTable } from "./ui/Results";
import { EmptyState, ErrorState, Pagination, SkeletonRows } from "./ui/States";
import QuickLook from "./ui/QuickLook";
import SelectionBar from "./ui/SelectionBar";
import Sheet from "./ui/Sheet";
import Lightbox from "./ui/Lightbox";
import { getScroller, getScrollTop, setScrollTop, useLatest, useMediaQuery } from "./ui/hooks";

const VIEW_KEY = "inventory.viewState";
const SELECTION_KEY = "inventory.selection";
const SCROLL_KEY = "inventory.scroll";
const LAYOUT_KEY = "inventory.layout";
const RAIL_KEY = "inventory.rail";
const ASSIGNEE_KEY = "inventory.assigneeFilter";
const REVALIDATE_MS = 60_000;

const DEFAULT_COLUMNS_BY_MODE = {
  diamonds: DIAMOND_DEFAULT_COLUMNS,
  gemstones: GEMSTONE_DEFAULT_COLUMNS,
  jewelry: JEWELRY_DEFAULT_COLUMNS,
};
const NOUNS = { diamonds: "diamonds", gemstones: "gemstones", jewelry: "pieces" };

const pairIds = (pair) => [pair.stoneA.id, ...(pair.stoneB ? [pair.stoneB.id] : [])];

/* Survives navigating to a stone's DNA page and back, so the list renders
 * immediately and refreshes quietly instead of showing a skeleton again. */
const cache = { stones: new Map(), jewelry: new Map(), tags: null };

const readJson = (storage, key) => {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const writeJson = (storage, key, value) => {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
};

/* URL wins (refresh, shared link, DNA → Back); otherwise the last view in
 * this tab; otherwise defaults. */
const initialView = (params, priceMode) => {
  if (hasInventoryParams(params)) {
    const url = parseUrlState(params);
    return {
      mode: url.mode || "diamonds",
      filters: convertPriceUnits(url.filters, url.priceUnit, priceMode),
      smartSearch: url.smartSearch,
      sort: url.sort,
      page: url.page,
      jewelrySource: url.jewelrySource,
      legacySearch: !url.mode && url.filters.sku ? url.filters.sku : "",
    };
  }
  const saved = readJson(sessionStorage, VIEW_KEY);
  const mode = MODES.includes(saved?.inventoryMode) ? saved.inventoryMode : "diamonds";
  return {
    mode,
    filters: { ...emptyFilters(), ...(saved?.filters || {}) },
    smartSearch: saved?.smartSearch || "",
    sort: saved?.sort?.field ? saved.sort : { ...DEFAULT_SORT },
    page: saved?.page || 1,
    jewelrySource: saved?.jewelrySource || "all",
    legacySearch: "",
  };
};

const StoneSearchPage = () => {
  const { user } = useUser();
  const team = useTeam();
  const cart = useSelection();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const isPhone = useMediaQuery("(max-width: 767px)");
  // Below 1024 the content column is too narrow for the table; rows read better.
  const compactRows = useMediaQuery("(max-width: 1023px)");
  const isDesktop = useMediaQuery("(min-width: 1280px)");
  const isWide = useMediaQuery("(min-width: 1440px)");

  /* ---------------- view state ---------------- */

  const [priceMode, setPriceMode] = useState(readPriceMode);
  const [init] = useState(() => initialView(searchParams, priceMode));
  const [mode, setMode] = useState(init.mode);
  const [filters, setFiltersRaw] = useState(init.filters);
  const [smartSearch, setSmartSearchRaw] = useState(init.smartSearch);
  const [sort, setSortRaw] = useState(init.sort);
  const [page, setPage] = useState(init.page);
  const [jewelrySource, setJewelrySourceRaw] = useState(init.jewelrySource);
  const [assignee, setAssigneeRaw] = useState(() => {
    try {
      return localStorage.getItem(ASSIGNEE_KEY) || "all";
    } catch {
      return "all";
    }
  });
  const [layout, setLayout] = useState(() => {
    try {
      return localStorage.getItem(LAYOUT_KEY) === "gallery" ? "gallery" : "list";
    } catch {
      return "list";
    }
  });
  const [pairLayout, setPairLayout] = useState("pairs");
  const [railPref, setRailPref] = useState(() => {
    try {
      return localStorage.getItem(RAIL_KEY) !== "closed";
    } catch {
      return true;
    }
  });
  const [columnConfig, setColumnConfig] = useState(() => getColumnConfig(user?.id || "default", init.mode));

  const [selected, setSelected] = useState(() => {
    const saved = readJson(sessionStorage, SELECTION_KEY);
    return new Set(Array.isArray(saved) ? saved : []);
  });
  const [activeId, setActiveId] = useState(null);

  // Every filter edit returns to page 1 — the old list did the same.
  const setFilters = useCallback((next) => {
    setFiltersRaw(next);
    setPage(1);
  }, []);
  const setSmartSearch = useCallback((v) => {
    setSmartSearchRaw(v);
    setPage(1);
  }, []);
  const setSort = useCallback((v) => {
    setSortRaw(v);
    setPage(1);
  }, []);
  const setJewelrySource = useCallback((v) => {
    setJewelrySourceRaw(v);
    setPage(1);
  }, []);
  const setAssignee = useCallback((v) => {
    setAssigneeRaw(v);
    setPage(1);
    try {
      localStorage.setItem(ASSIGNEE_KEY, v);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => writePriceMode(priceMode), [priceMode]);
  useEffect(() => {
    writeJson(sessionStorage, VIEW_KEY, { inventoryMode: mode, filters, smartSearch, sort, page, jewelrySource });
  }, [mode, filters, smartSearch, sort, page, jewelrySource]);
  useEffect(() => writeJson(sessionStorage, SELECTION_KEY, Array.from(selected)), [selected]);

  /* ---------------- URL sync ---------------- */

  // Every query string this page wrote recently. Fast typing can land an
  // older write after newer state, which must not read as Back/Forward.
  const written = useRef([]);
  const remember = (qs) => {
    written.current = [...written.current.filter((w) => w !== qs), qs].slice(-12);
  };
  useEffect(() => {
    const next = buildUrlParams({ mode, filters, smartSearch, sort, page, jewelrySource, priceMode }).toString();
    remember(next);
    if (next !== searchParams.toString()) setSearchParams(next, { replace: true });
    // searchParams is read, not tracked: the URL follows state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, filters, smartSearch, sort, page, jewelrySource, priceMode]);

  // Back / Forward or a link to another inventory view while mounted.
  const urlMounted = useRef(false);
  useEffect(() => {
    if (!urlMounted.current) {
      urlMounted.current = true;
      return;
    }
    const current = searchParams.toString();
    if (written.current.includes(current)) return;
    const latest = written.current[written.current.length - 1];
    if (!hasInventoryParams(searchParams)) {
      // e.g. the sidebar's plain /inventory link: keep the current view.
      if (latest) setSearchParams(latest, { replace: true });
      return;
    }
    const url = parseUrlState(searchParams);
    remember(current);
    if (url.mode && url.mode !== mode) {
      setMode(url.mode);
      setColumnConfig(getColumnConfig(user?.id || "default", url.mode));
    }
    setFiltersRaw(convertPriceUnits(url.filters, url.priceUnit, priceMode));
    setSmartSearchRaw(url.smartSearch);
    setSortRaw(url.sort);
    setPage(url.page);
    setJewelrySourceRaw(url.jewelrySource);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  /* ---------------- data ---------------- */

  const stonesKey = `${user?.id || "anon"}|${assignee}`;
  const cachedStones = cache.stones.get(stonesKey);
  const [stones, setStones] = useState(() => cachedStones?.stones || []);
  const [stonesReady, setStonesReady] = useState(Boolean(cachedStones));
  const [stonesLoading, setStonesLoading] = useState(!cachedStones);
  const [stonesError, setStonesError] = useState("");
  const [statusMap, setStatusMap] = useState(() => cachedStones?.statusMap || {});
  const [reloadKey, setReloadKey] = useState(0);
  const fetchSeq = useRef(0);

  useEffect(() => {
    const hit = cache.stones.get(stonesKey);
    if (hit) {
      setStones(hit.stones);
      setStatusMap(hit.statusMap || {});
      setStonesReady(true);
      if (reloadKey === 0 && Date.now() - hit.at < REVALIDATE_MS) return undefined;
    } else {
      setStonesReady(false);
    }
    const seq = ++fetchSeq.current;
    setStonesLoading(true);
    setStonesError("");
    fetchSoapStones(
      { id: user?.id, email: user?.primaryEmailAddress?.emailAddress, name: user?.fullName },
      { assignedTo: assignee !== "all" ? assignee : undefined }
    )
      .then((data) => {
        if (seq !== fetchSeq.current) return;
        const rows = Array.isArray(data?.stones) ? data.stones : Array.isArray(data) ? data : [];
        const normalized = rows.map(normalizeStone);
        setStones(normalized);
        setStonesReady(true);
        const entry = { at: Date.now(), stones: normalized, statusMap: cache.stones.get(stonesKey)?.statusMap || {} };
        cache.stones.set(stonesKey, entry);
        // Workshop status is best-effort enrichment; never blocks the list.
        fetchStoneInventoryStatus()
          .then((res) => {
            if (seq !== fetchSeq.current) return;
            const map = res?.statuses || {};
            entry.statusMap = map;
            setStatusMap(map);
          })
          .catch(() => {});
      })
      .catch((err) => {
        if (seq !== fetchSeq.current) return;
        setStonesError(err?.message || "Unknown error");
      })
      .finally(() => {
        if (seq === fetchSeq.current) setStonesLoading(false);
      });
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stonesKey, reloadKey]);

  const jewelryKey = user?.id || "anon";
  const [jewelry, setJewelry] = useState(() => cache.jewelry.get(jewelryKey)?.items || []);
  const [jewelryReady, setJewelryReady] = useState(Boolean(cache.jewelry.get(jewelryKey)));

  useEffect(() => {
    const hit = cache.jewelry.get(jewelryKey);
    if (hit && Date.now() - hit.at < REVALIDATE_MS && reloadKey === 0) return undefined;
    let cancelled = false;
    const userId = user?.id;
    Promise.allSettled([
      fetch(`${API_BASE}/api/jewelry`).then((r) => {
        if (!r.ok) throw new Error(`catalog failed (${r.status})`);
        return r.json();
      }),
      userId
        ? fetch(`${API_BASE}/api/jewelry-items?userId=${encodeURIComponent(userId)}`).then((r) => {
            if (!r.ok) throw new Error(`workshop failed (${r.status})`);
            return r.json();
          })
        : Promise.resolve({ items: [] }),
    ]).then(([catalog, workshop]) => {
      if (cancelled) return;
      if (catalog.status === "rejected") console.warn("Inventory: catalog jewelry fetch failed", catalog.reason);
      if (workshop.status === "rejected") console.warn("Inventory: workshop jewelry fetch failed", workshop.reason);
      const catalogItems = (catalog.status === "fulfilled" ? catalog.value?.jewelry || [] : []).map(normalizeCatalogJewelry);
      const workshopItems = (workshop.status === "fulfilled" ? workshop.value?.items || [] : []).map(normalizeWorkshopJewelry);
      // The rep's own production work comes before the bulk catalog.
      const items = [...workshopItems, ...catalogItems];
      cache.jewelry.set(jewelryKey, { at: Date.now(), items });
      setJewelry(items);
      setJewelryReady(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jewelryKey, reloadKey]);

  const [tags, setTags] = useState(() => cache.tags?.tags || []);
  const [stoneTags, setStoneTags] = useState(() => cache.tags?.stoneTags || {});
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetch(`${API_BASE}/api/tags`), fetch(`${API_BASE}/api/stone-tags`)])
      .then(([a, b]) => Promise.all([a.json(), b.json()]))
      .then(([tagsData, stoneTagsData]) => {
        if (cancelled) return;
        setTags(tagsData);
        setStoneTags(stoneTagsData);
      })
      .catch((err) => console.error("Error fetching tags:", err));
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    cache.tags = { tags, stoneTags };
  }, [tags, stoneTags]);

  const [savedFilters, setSavedFilters] = useState([]);
  useEffect(() => {
    if (!user?.id) return;
    fetch(`${API_BASE}/api/saved-filters?userId=${user.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSavedFilters(data);
      })
      .catch(() => {});
  }, [user?.id]);

  /* ---------------- derived ---------------- */

  const allItems = useMemo(() => [...stones, ...jewelry], [stones, jewelry]);
  const modeItems = useMemo(() => itemsForMode(mode, stones, jewelry, jewelrySource), [mode, stones, jewelry, jewelrySource]);
  const skuIndex = useMemo(
    () => buildSkuIndex((mode === "jewelry" ? jewelry : stones).map((s) => s.sku)),
    [mode, stones, jewelry]
  );
  const skuQuery = useMemo(() => parseSkuQuery(filters.sku, skuIndex), [filters.sku, skuIndex]);
  const parsedSearch = useMemo(() => parseSmartSearch(smartSearch), [smartSearch]);

  const filtered = useMemo(
    () => filterItems(modeItems, { mode, filters, skuQuery, smartSearch, parsedSearch, priceMode, stoneTags }),
    [modeItems, mode, filters, skuQuery, smartSearch, parsedSearch, priceMode, stoneTags]
  );
  const sorted = useMemo(() => sortItems(filtered, sort, selected), [filtered, sort, selected]);

  const pairOnly = mode !== "jewelry" && isPairOnly(filters);
  const pairView = pairOnly && pairLayout === "pairs";
  const pairs = useMemo(() => (pairOnly ? buildPairGroups(sorted, stones) : []), [pairOnly, sorted, stones]);

  const listItems = pairView ? pairs : sorted;
  const total = listItems.length;
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageItems = useMemo(() => listItems.slice(start, start + ITEMS_PER_PAGE), [listItems, start]);
  const stepList = useMemo(
    () => (pairView ? pageItems.flatMap((p) => [p.stoneA, ...(p.stoneB ? [p.stoneB] : [])]) : pageItems),
    [pairView, pageItems]
  );

  const counts = useMemo(() => {
    let diamonds = 0;
    stones.forEach((s) => {
      if (stoneMode(s) === "diamonds") diamonds += 1;
    });
    return { diamonds, gemstones: stones.length - diamonds, jewelry: jewelry.length };
  }, [stones, jewelry]);
  const jewelryCounts = useMemo(
    () => ({
      all: jewelry.length,
      workshop: jewelry.filter((j) => j.source === "workshop").length,
      catalog: jewelry.filter((j) => j.source === "catalog").length,
    }),
    [jewelry]
  );

  const options = useMemo(() => {
    if (mode === "jewelry") {
      return {
        shapes: { all: [], main: [], more: [] },
        categories: [],
        diamondColors: [],
        fancyColors: [],
        labs: [],
        jewelry: buildJewelryOptions(jewelry),
      };
    }
    return {
      shapes: buildShapeOptions(modeItems),
      categories: buildCategoryOptions(modeItems),
      diamondColors: buildDiamondColorOptions(modeItems),
      fancyColors: buildFancyColorOptions(modeItems),
      labs: buildLabOptions(modeItems),
      jewelry: { type: [], style: [], collection: [], stoneType: [], metal: [] },
    };
  }, [mode, modeItems, jewelry]);

  const showAssignee = mode !== "jewelry" && team?.ready && (team.members || []).length > 1;
  const assigneeLabel = useMemo(() => {
    if (assignee === "me") return "Assigned to me";
    if (assignee === "unassigned") return "Unassigned";
    const m = team?.membersByClerkId?.[assignee];
    return `Assigned to ${m?.name || "teammate"}`;
  }, [assignee, team]);

  const chips = useMemo(
    () =>
      activeFilterChips(filters, {
        mode,
        smartSearch,
        jewelrySource,
        assignee: showAssignee ? assignee : "all",
        assigneeLabel,
      }),
    [filters, mode, smartSearch, jewelrySource, showAssignee, assignee, assigneeLabel]
  );

  const columnDefs = DEFAULT_COLUMNS_BY_MODE[mode];
  const colMeta = useMemo(() => Object.fromEntries(columnDefs.map((c) => [c.id, c])), [columnDefs]);
  const visibleColumns = useMemo(
    () => columnConfig.filter((c) => c.visible && colMeta[c.id]).map((c) => c.id),
    [columnConfig, colMeta]
  );
  const sortLabels = useMemo(
    () => Object.fromEntries(columnDefs.filter((c) => c.sortField).map((c) => [c.sortField, c.label])),
    [columnDefs]
  );

  const selectedItems = useMemo(() => allItems.filter((s) => selected.has(s.id)), [allItems, selected]);
  const applyPriceMode = useCallback(
    (arr) =>
      arr.map((s) => {
        const scale = inventoryPriceScale(s, priceMode);
        if (scale === 1) return s;
        return {
          ...s,
          pricePerCt: s.pricePerCt ? s.pricePerCt * scale : s.pricePerCt,
          priceTotal: s.priceTotal ? s.priceTotal * scale : s.priceTotal,
        };
      }),
    [priceMode]
  );

  /* ---------------- handlers ---------------- */

  const handleModeSwitch = useCallback(
    (next) => {
      if (next === mode) return;
      setMode(next);
      setFiltersRaw(emptyFilters(""));
      setSelected(new Set());
      setActiveId(null);
      setPage(1);
      setSmartSearchRaw("");
      setSortRaw({ ...DEFAULT_SORT });
      // Only gemstones carry a Neto/Bruto split.
      if (next !== "gemstones") setPriceMode("neto");
      setColumnConfig(getColumnConfig(user?.id || "default", next));
    },
    [mode, user?.id]
  );

  const togglePriceMode = useCallback(() => {
    const next = priceMode === "neto" ? "bruto" : "neto";
    setFiltersRaw((f) => convertPriceUnits(f, priceMode, next));
    setPriceMode(next);
  }, [priceMode]);

  // A ?search= link (Home, QA) jumps to whichever tab holds that SKU.
  const legacyDone = useRef(!init.legacySearch);
  useEffect(() => {
    if (legacyDone.current || !stonesReady || !stones.length) return;
    legacyDone.current = true;
    const q = init.legacySearch.toLowerCase();
    const match = stones.find((s) => s.sku?.toLowerCase() === q);
    if (!match) {
      const inJewelry = jewelry.find((j) => j.sku?.toLowerCase() === q);
      if (inJewelry && mode !== "jewelry") {
        setMode("jewelry");
        setPriceMode("neto");
        setColumnConfig(getColumnConfig(user?.id || "default", "jewelry"));
      }
      return;
    }
    const target = getMappedCategories(match.category).includes("Diamond") ? "diamonds" : "gemstones";
    if (target !== mode) {
      setMode(target);
      setColumnConfig(getColumnConfig(user?.id || "default", target));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stonesReady, stones, jewelry]);

  const removeChip = useCallback(
    (chip) => {
      const r = chip.remove;
      if (r.type === "smart") setSmartSearch("");
      else if (r.type === "source") setJewelrySource("all");
      else if (r.type === "assignee") setAssignee("all");
      else setFilters((f) => applyChipRemoval(f, r));
    },
    [setFilters, setSmartSearch, setJewelrySource, setAssignee]
  );

  // The SKU search is kept: it has its own clear button.
  const clearAll = useCallback(() => {
    setFilters((f) => emptyFilters(f.sku));
    setSmartSearch("");
    setJewelrySource("all");
    if (assignee !== "all") setAssignee("all");
  }, [setFilters, setSmartSearch, setJewelrySource, setAssignee, assignee]);

  const toggleOne = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allVisibleSelected = sorted.length > 0 && sorted.every((s) => selected.has(s.id));
  const someVisibleSelected = !allVisibleSelected && sorted.some((s) => selected.has(s.id));
  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      const ids = sorted.map((s) => s.id);
      const all = ids.length > 0 && ids.every((id) => prev.has(id));
      ids.forEach((id) => (all ? next.delete(id) : next.add(id)));
      return next;
    });
  }, [sorted]);

  const togglePair = useCallback((pair) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const ids = pairIds(pair);
      const all = ids.every((id) => prev.has(id));
      ids.forEach((id) => (all ? next.delete(id) : next.add(id)));
      return next;
    });
  }, []);
  const allPairsSelected = pairs.length > 0 && pairs.flatMap(pairIds).every((id) => selected.has(id));
  const toggleAllPairs = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      const ids = pairs.flatMap(pairIds);
      const all = ids.length > 0 && ids.every((id) => prev.has(id));
      ids.forEach((id) => (all ? next.delete(id) : next.add(id)));
      return next;
    });
  }, [pairs]);

  const handleSortField = useCallback(
    (field) => setSort((prev) => ({ field, direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc" })),
    [setSort]
  );

  const [assigningSku, setAssigningSku] = useState(null);
  const handleAssign = useCallback(
    async (stone, assignedTo) => {
      if (!stone?.sku) return;
      setAssigningSku(stone.sku);
      const previous = stone.assignedTo || null;
      const target = assignedTo === "me" ? team.actorUserId : assignedTo;
      setStones((prev) => prev.map((s) => (s.sku === stone.sku ? { ...s, assignedTo: target } : s)));
      try {
        await assignStone(
          { id: user?.id, email: user?.primaryEmailAddress?.emailAddress, name: user?.fullName },
          stone.sku,
          { assignedTo: target }
        );
        toast.success(assignedTo ? `${stone.sku} claimed` : `${stone.sku} released`);
      } catch (err) {
        setStones((prev) => prev.map((s) => (s.sku === stone.sku ? { ...s, assignedTo: previous } : s)));
        toast.error(err.message || "Could not update assignment");
      } finally {
        setAssigningSku(null);
      }
    },
    [team.actorUserId, user?.id, user?.primaryEmailAddress?.emailAddress, user?.fullName]
  );
  // Keep the cache in step with optimistic assignment edits.
  useEffect(() => {
    const hit = cache.stones.get(stonesKey);
    if (hit && hit.stones !== stones && stones.length) hit.stones = stones;
  }, [stones, stonesKey]);

  /* tags */
  const createTag = async (name, color) => {
    try {
      const res = await fetch(`${API_BASE}/api/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      });
      if (res.ok) {
        const tag = await res.json();
        setTags((prev) => [...prev, { ...tag, stone_count: 0 }]);
      }
    } catch (err) {
      console.error("Error creating tag:", err);
    }
  };
  const updateTag = async (id, name, color) => {
    try {
      const res = await fetch(`${API_BASE}/api/tags/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTags((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
        setStoneTags((prev) => {
          const next = {};
          Object.keys(prev).forEach((sku) => {
            next[sku] = prev[sku].map((t) => (t.id === id ? { ...t, name: updated.name, color: updated.color } : t));
          });
          return next;
        });
      }
    } catch (err) {
      console.error("Error updating tag:", err);
    }
  };
  const deleteTag = async (id) => {
    if (!window.confirm("Are you sure you want to delete this tag?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/tags/${id}`, { method: "DELETE" });
      if (res.ok) {
        setTags((prev) => prev.filter((t) => t.id !== id));
        setStoneTags((prev) => {
          const next = {};
          Object.keys(prev).forEach((sku) => {
            next[sku] = prev[sku].filter((t) => t.id !== id);
          });
          return next;
        });
      }
    } catch (err) {
      console.error("Error deleting tag:", err);
    }
  };
  const toggleStoneTag = async (sku, tagId, has) => {
    try {
      if (has) {
        const res = await fetch(`${API_BASE}/api/stones/${sku}/tags/${tagId}`, { method: "DELETE" });
        if (!res.ok) return;
        setStoneTags((prev) => ({ ...prev, [sku]: (prev[sku] || []).filter((t) => t.id !== tagId) }));
        setTags((prev) =>
          prev.map((t) => (t.id === tagId ? { ...t, stone_count: Math.max(0, (parseInt(t.stone_count, 10) || 0) - 1) } : t))
        );
      } else {
        const res = await fetch(`${API_BASE}/api/stones/${sku}/tags`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagId }),
        });
        if (!res.ok) return;
        const tag = await res.json();
        setStoneTags((prev) => ({ ...prev, [sku]: [...(prev[sku] || []), tag] }));
        setTags((prev) => prev.map((t) => (t.id === tagId ? { ...t, stone_count: (parseInt(t.stone_count, 10) || 0) + 1 } : t)));
      }
    } catch (err) {
      console.error("Error updating stone tags:", err);
      toast.error("Couldn’t update tags");
    }
  };

  /* saved filters */
  const saveCurrent = async (name) => {
    if (!name.trim() || !user?.id) return;
    try {
      const res = await fetch(`${API_BASE}/api/saved-filters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, name: name.trim(), inventoryMode: mode, filters }),
      });
      const data = await res.json();
      setSavedFilters((prev) => [data, ...prev]);
      toast.success(`Saved “${name.trim()}”`);
    } catch (err) {
      console.error("Save filter error:", err);
      toast.error("Couldn’t save filters");
    }
  };
  const deleteSaved = async (id) => {
    try {
      await fetch(`${API_BASE}/api/saved-filters/${id}`, { method: "DELETE" });
      setSavedFilters((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      console.error("Delete filter error:", err);
    }
  };
  const loadSaved = (preset) => {
    if (preset.inventory_mode && MODES.includes(preset.inventory_mode) && preset.inventory_mode !== mode) {
      setMode(preset.inventory_mode);
      if (preset.inventory_mode !== "gemstones") setPriceMode("neto");
      setColumnConfig(getColumnConfig(user?.id || "default", preset.inventory_mode));
    }
    // Presets saved before a filter existed lack its key.
    setFilters({ ...emptyFilters(), ...(preset.filters || {}) });
  };

  const handleColumnSave = (config) => {
    setColumnConfig(config);
    saveColumnConfig(user?.id || "default", config, mode);
  };

  /* ---------------- scanner ---------------- */

  const [scannerOpen, setScannerOpen] = useState(false);
  const stonesRef = useLatest(stones);
  const handleScan = useCallback(
    (scanned) => {
      setScannerOpen(false);
      const code = String(scanned || "").toUpperCase();
      const found = stonesRef.current.find((s) => {
        const sku = s.sku?.toUpperCase() || "";
        return sku === code || sku.includes(code) || code.includes(sku);
      });
      if (found) {
        setSelected((prev) => new Set(prev).add(found.id));
        toast.success(`Added: ${scanned}`);
      } else {
        toast.error(`Stone not found: ${scanned}`);
      }
    },
    [stonesRef]
  );
  // USB scanners type fast and end with Enter.
  useEffect(() => {
    let buffer = "";
    let last = 0;
    const onKey = (e) => {
      const t = e.target;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
      const now = Date.now();
      if (e.key === "Enter" && buffer.length >= 3) {
        e.preventDefault();
        const code = buffer.trim();
        buffer = "";
        if (code) handleScan(code);
        return;
      }
      if (now - last > 50 && buffer.length > 0) buffer = "";
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        buffer += e.key;
        last = now;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleScan]);

  /* ---------------- overlays ---------------- */

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [lightbox, setLightbox] = useState({ image: null, video: null });
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMode, setExportMode] = useState("combined");
  const [categoryChoiceOpen, setCategoryChoiceOpen] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const [pdfPriceOpen, setPdfPriceOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfStones, setPdfStones] = useState([]);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [liranStones, setLiranStones] = useState(null);
  const [liranGenerating, setLiranGenerating] = useState(false);
  const [niimbotOpen, setNiimbotOpen] = useState(false);
  const [niimbotStones, setNiimbotStones] = useState([]);
  const [crmOpen, setCrmOpen] = useState(false);

  const legacyModalOpen =
    tagsOpen || columnsOpen || compareOpen || exportOpen || categoryChoiceOpen || internalOpen || pdfPriceOpen ||
    pdfOpen || Boolean(liranStones) || niimbotOpen || crmOpen || scannerOpen || Boolean(lightbox.image || lightbox.video);

  const railVisible = isDesktop && railPref;
  const quickLookVariant = isWide ? "panel" : isPhone ? "bottom" : "side";
  const activeItem = useMemo(() => (activeId == null ? null : allItems.find((s) => s.id === activeId) || null), [activeId, allItems]);
  const activeIndex = activeItem ? stepList.findIndex((s) => s.id === activeItem.id) : -1;
  // The desktop quick look borrows the rail's space while it is open.
  const panelOpen = Boolean(activeItem) && quickLookVariant === "panel";

  const openItem = useCallback((item) => setActiveId(item.id), []);
  const closeQuickLook = useCallback(() => {
    if (legacyModalOpen) return;
    setActiveId(null);
  }, [legacyModalOpen]);
  const stepQuickLook = useCallback(
    (delta) => {
      const next = stepList[activeIndex + delta];
      if (!next) return;
      setActiveId(next.id);
      requestAnimationFrame(() => {
        document.querySelector(`.inv-results [data-id="${CSS.escape(String(next.id))}"]`)?.scrollIntoView({ block: "nearest" });
      });
    },
    [stepList, activeIndex]
  );

  const openDna = useCallback(
    (item) => {
      const path = dnaPathFor(item);
      if (!path) return;
      setActiveId(null);
      navigate(path);
    },
    [navigate]
  );

  const requireSelection = () => {
    if (selectedItems.length === 0) {
      toast.error("Please select at least one stone to export.");
      return false;
    }
    return true;
  };

  const handleExportClick = () => {
    if (!requireSelection()) return;
    const b = getCategoryBreakdown(selectedItems);
    const categoryCount = [b.emeralds, b.diamonds, b.other].filter(Boolean).length;
    if (categoryCount === 1) {
      setExportMode("combined");
      setExportOpen(true);
    } else {
      setCategoryChoiceOpen(true);
    }
  };

  const internalCounts = useMemo(() => {
    const c = { diamond: 0, gemstone: 0, jewelry: 0 };
    applyPriceMode(selectedItems).forEach((it) => {
      if ((it?.category || "").toLowerCase() === "jewelry" || it?.jewelryType) c.jewelry += 1;
      else if (getMappedCategories(it?.category).includes("Diamond")) c.diamond += 1;
      else c.gemstone += 1;
    });
    return c;
  }, [selectedItems, applyPriceMode]);

  const handleLiranGenerate = async (ordered, opts = {}) => {
    setLiranGenerating(true);
    const t = toast.loading("Generating Catalog (Liran)…");
    try {
      await exportCatalogLiran(ordered, opts);
      toast.success("Catalog ready", { id: t });
      setLiranStones(null);
    } catch (err) {
      console.error("Catalog (Liran) generation failed:", err);
      toast.error("Failed to generate catalog", { id: t });
    } finally {
      setLiranGenerating(false);
    }
  };

  const selectionActions = [
    {
      label: "Export",
      items: [
        { id: "excel", label: "Excel", sub: "Spreadsheet with all details", icon: FileSpreadsheet, onSelect: handleExportClick },
        {
          id: "internal",
          label: "Excel (Internal)",
          sub: "Pick columns · no branding",
          icon: Table2,
          onSelect: () => requireSelection() && setInternalOpen(true),
        },
        { id: "pdf", label: "PDF catalog", sub: "Professional catalog with images", icon: FileText, onSelect: () => setPdfPriceOpen(true) },
        {
          id: "liran",
          label: "Catalog (Liran)",
          sub: "ESHED cover · 4×3 worksheet grid",
          icon: BookOpen,
          onSelect: () => requireSelection() && setLiranStones(selectedItems),
        },
      ],
    },
    {
      label: "Labels",
      items: [
        {
          id: "print",
          label: "Print labels",
          sub: "Bluetooth (NIIMBOT)",
          icon: Printer,
          onSelect: () => {
            setNiimbotStones([]);
            setNiimbotOpen(true);
          },
        },
        { id: "niimbot-xlsx", label: "Niimbot Excel", sub: "For the NIIMBOT app", icon: Tag, onSelect: () => exportForLabels(selectedItems, false) },
      ],
    },
    {
      label: "Share",
      items: [
        { id: "crm", label: "Send to CRM", sub: "Add to a deal or contact", icon: Users, onSelect: () => setCrmOpen(true) },
        { id: "wa", label: "WhatsApp DNA links", sub: "One message with every link", icon: MessageCircle, onSelect: () => shareMultipleToWhatsApp(selectedItems) },
      ],
    },
  ];

  /* ---------------- scroll ---------------- */

  const rootRef = useRef(null);
  const resultsTopRef = useRef(null);
  const scrollerRef = useRef(undefined);
  const restoredRef = useRef(false);
  const ready = mode === "jewelry" ? jewelryReady : stonesReady;

  useEffect(() => {
    if (!ready || restoredRef.current) return;
    restoredRef.current = true;
    const saved = readJson(sessionStorage, SCROLL_KEY);
    if (!saved || saved.search !== location.search) return;
    requestAnimationFrame(() => {
      scrollerRef.current = getScroller(rootRef.current);
      setScrollTop(scrollerRef.current, saved.top);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const searchRef = useLatest(location.search);
  useEffect(() => {
    let frame = 0;
    const record = () => {
      // Until the saved position is restored, scrolls are the page settling.
      if (!restoredRef.current) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (scrollerRef.current === undefined) scrollerRef.current = getScroller(rootRef.current);
        writeJson(sessionStorage, SCROLL_KEY, { search: searchRef.current, top: getScrollTop(scrollerRef.current) });
      });
    };
    // Capture: on phones <main> scrolls, which doesn't bubble to window.
    window.addEventListener("scroll", record, { passive: true, capture: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", record, { capture: true });
    };
  }, [searchRef]);

  const goToPage = (p) => {
    setPage(Math.min(Math.max(1, p), totalPages));
    requestAnimationFrame(() => resultsTopRef.current?.scrollIntoView({ block: "start" }));
  };

  /* ---------------- assistant ---------------- */

  const assistantVocabulary = useMemo(() => {
    if (mode === "jewelry") {
      return {
        category: options.jewelry.type,
        shape: options.jewelry.style,
        treatment: options.jewelry.collection,
        diamondColor: options.jewelry.stoneType,
        fancyColor: options.jewelry.metal,
      };
    }
    return {
      shape: options.shapes.all,
      category: options.categories,
      diamondColor: options.diamondColors,
      fancyColor: options.fancyColors,
      lab: options.labs,
      treatment: distinctValues(modeItems, (s) => s.treatment),
      location: distinctValues(modeItems, (s) => s.location),
      groupingType: distinctValues(modeItems, (s) => s.groupingType),
      tag: tags.map((t) => t.name),
    };
  }, [mode, options, modeItems, tags]);

  const assistantNavTargets = useMemo(() => {
    const targets = [];
    if (team.can("dashboard")) targets.push({ path: "/dashboard", label: "Dashboard overview" });
    if (team.can("sales")) {
      targets.push(
        { path: "/sales/diamonds", label: "Sales catalog — diamonds" },
        { path: "/sales/gemstones", label: "Sales catalog — coloured gemstones" },
        { path: "/sales/emeralds", label: "Sales catalog — emeralds" },
        { path: "/sales/jewelry", label: "Sales catalog — jewellery" }
      );
    }
    return targets;
  }, [team]);

  const handleAssistantApply = (incoming, suggestedMode, nextSort) => {
    if (suggestedMode) handleModeSwitch(suggestedMode);
    setFilters((prev) => ({ ...prev, ...incoming }));
    if (nextSort?.field) setSortRaw({ field: nextSort.field, direction: nextSort.direction });
  };
  const handleAssistantRemoveFilter = useCallback(
    (key) => setFilters((prev) => ({ ...prev, [key]: Array.isArray(prev[key]) ? [] : "" })),
    [setFilters]
  );

  /* ---------------- render ---------------- */

  const noun = NOUNS[mode];
  const loadingFirst = !ready;
  const showError = mode !== "jewelry" && stonesError && !stonesReady;
  const refreshing = ready && mode !== "jewelry" && stonesLoading;
  const selectedCarats = selectedItems.reduce((sum, s) => sum + (Number(s.weightCt) || 0), 0);

  const countText = loadingFirst ? (
    "Loading…"
  ) : pairView ? (
    <>
      <b>{pairs.length.toLocaleString()}</b> pairs · {sorted.length.toLocaleString()} stones
    </>
  ) : total === modeItems.length ? (
    <>
      <b>{total.toLocaleString()}</b> {noun}
    </>
  ) : (
    <>
      <b>{total.toLocaleString()}</b> of {modeItems.length.toLocaleString()} {noun}
    </>
  );

  const views = pairOnly ? ["pairs", "list"] : ["list", "gallery"];
  const view = pairOnly ? pairLayout : layout;
  const onView = (v) => {
    if (pairOnly) setPairLayout(v);
    else {
      setLayout(v);
      try {
        localStorage.setItem(LAYOUT_KEY, v);
      } catch {
        /* ignore */
      }
    }
  };

  const filterPanel = (
    <FilterPanel
      key={mode}
      mode={mode}
      filters={filters}
      onFiltersChange={setFilters}
      smartSearch={smartSearch}
      onSmartSearchChange={setSmartSearch}
      parsedSearch={parsedSearch}
      options={options}
      tags={tags}
      onManageTags={() => setTagsOpen(true)}
      priceMode={priceMode}
      saved={savedFilters}
      onLoadSaved={loadSaved}
      onDeleteSaved={deleteSaved}
      onSaveCurrent={saveCurrent}
      canSave={Boolean(user?.id)}
      team={team}
      assignee={assignee}
      onAssigneeChange={setAssignee}
      jewelrySource={jewelrySource}
      onJewelrySourceChange={setJewelrySource}
      jewelryCounts={jewelryCounts}
    />
  );

  const selectAllProps = pairView
    ? {
        checked: allPairsSelected,
        indeterminate: false,
        onChange: toggleAllPairs,
        disabled: !pairs.length,
        label: allPairsSelected ? "Deselect all pairs" : `Select all ${pairs.length} pairs`,
      }
    : {
        checked: allVisibleSelected,
        indeterminate: someVisibleSelected,
        onChange: toggleAll,
        disabled: !sorted.length,
        label: allVisibleSelected ? "Deselect all" : `Select all ${sorted.length.toLocaleString()} results`,
      };

  const renderResults = () => {
    if (showError) {
      return <ErrorState message={stonesError} onRetry={() => setReloadKey((k) => k + 1)} retrying={stonesLoading} />;
    }
    if (loadingFirst) {
      return (
        <div className="inv-panel">
          <SkeletonRows rows={isPhone ? 7 : 10} />
        </div>
      );
    }
    if (total === 0) {
      const emptyInventory = modeItems.length === 0 && !chips.length && !filters.sku;
      return (
        <>
          <EmptyState
            noun={noun}
            chips={chips}
            onRemoveChip={removeChip}
            onClearFilters={clearAll}
            search={filters.sku}
            onClearSearch={() => setFilters((f) => ({ ...f, sku: "" }))}
            emptyInventory={emptyInventory}
          />
          {emptyInventory && mode === "jewelry" && (
            <p className="inv-notice">
              No jewelry items yet. Import a WooCommerce catalog CSV from the{" "}
              <Link to="/dashboard?tab=jewelry">Jewelry dashboard</Link>.
            </p>
          )}
        </>
      );
    }
    const common = {
      selectedIds: selected,
      activeId,
      priceMode,
      onToggle: toggleOne,
      onOpen: openItem,
    };
    if (pairView) {
      return <PairResults pairs={pageItems} selectedIds={selected} priceMode={priceMode} onTogglePair={togglePair} onOpen={openItem} />;
    }
    if (view === "gallery") return <ResultsGallery items={pageItems} {...common} />;
    if (compactRows) {
      return (
        <div className="inv-panel">
          <ResultsList items={pageItems} {...common} statusMap={statusMap} stoneTags={stoneTags} onAssign={handleAssign} assigningSku={assigningSku} />
        </div>
      );
    }
    return (
      <div className="inv-panel">
        <ResultsTable
          items={pageItems}
          {...common}
          columns={visibleColumns}
          colMeta={colMeta}
          sortConfig={sort}
          onSortField={handleSortField}
          statusMap={statusMap}
          stoneTags={stoneTags}
          onVideo={(v) => setLightbox({ image: null, video: v })}
          onWhatsApp={shareToWhatsApp}
          onAssign={handleAssign}
          assigningSku={assigningSku}
          selectAll={<SelectAll {...selectAllProps} />}
        />
      </div>
    );
  };

  const rootClass = [
    "inv",
    cart?.count > 0 ? "inv--cart-fab" : "",
    panelOpen ? "inv--ql-open" : "",
    selected.size > 0 ? "inv--has-sel" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const showRail = railVisible && !panelOpen;
  const tableHasSelectAll = !pairView && view === "list" && !compactRows && ready && total > 0;

  return (
    <div className={rootClass} ref={rootRef}>
      <div className="inv-page">
        <InventoryHeader
          mode={mode}
          counts={counts}
          countsReady={{ diamonds: stonesReady, gemstones: stonesReady, jewelry: jewelryReady }}
          onModeChange={handleModeSwitch}
          onScan={() => setScannerOpen(true)}
          priceMode={priceMode}
          onTogglePriceMode={togglePriceMode}
        />

        <SearchField
          value={filters.sku}
          onChange={(v) => setFilters((f) => ({ ...f, sku: v }))}
          skuQuery={skuQuery}
          placeholder={
            mode === "jewelry" ? "Search model numbers" : isPhone ? "Search SKUs" : "Search SKUs — paste several to find them all"
          }
        >
          {!railVisible && (
            <button
              type="button"
              className="inv-btn inv-search-filters"
              onClick={() => setFiltersOpen(true)}
              aria-label={chips.length ? `Filters, ${chips.length} active` : "Filters"}
            >
              <SlidersHorizontal size={16} strokeWidth={1.75} aria-hidden="true" />
              {!isPhone && <span>Filters</span>}
              {chips.length > 0 && <span className="inv-badge">{chips.length}</span>}
            </button>
          )}
        </SearchField>

        <div className={showRail ? "inv-body inv-body--rail" : "inv-body"}>
          {showRail && (
            <aside className="inv-rail" aria-label="Filters">
              <div className="inv-rail-head">
                <span className="inv-rail-title">Filters</span>
                {chips.length > 0 && (
                  <button type="button" className="inv-btn inv-btn--plain inv-btn--sm" onClick={clearAll}>
                    Clear all
                  </button>
                )}
              </div>
              {filterPanel}
            </aside>
          )}

          <div className="inv-main">
            <ActiveFilters chips={chips} onRemove={removeChip} onClearAll={clearAll} />
            <div ref={resultsTopRef} className="inv-results-anchor" />
            <Toolbar
              selectAll={tableHasSelectAll || !ready || total === 0 ? null : selectAllProps}
              count={countText}
              refreshing={refreshing}
              sortOptions={sortOptionsFor(mode)}
              sortConfig={sort}
              sortLabel={describeSort(mode, sort, sortLabels)}
              onSort={(o) => setSort({ field: o.field, direction: o.direction })}
              views={views}
              view={view}
              onView={onView}
              onColumns={!compactRows && view === "list" && !pairView ? () => setColumnsOpen(true) : null}
              onFilters={isDesktop && !panelOpen ? () => {
                const next = !railPref;
                setRailPref(next);
                try {
                  localStorage.setItem(RAIL_KEY, next ? "open" : "closed");
                } catch {
                  /* ignore */
                }
              } : null}
              filtersActive={isDesktop ? railPref : undefined}
              filterCount={isDesktop && !railPref ? chips.length : 0}
              filtersIcon={railPref ? PanelLeftClose : PanelLeftOpen}
              compact={isPhone}
            />
            <div className={`inv-results${refreshing ? " inv-dim" : ""}`}>{renderResults()}</div>
            {ready && !showError && (
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                start={total ? start + 1 : 0}
                end={Math.min(start + ITEMS_PER_PAGE, total)}
                total={total}
                noun={pairView ? "pairs" : noun}
                onPage={goToPage}
              />
            )}
            {stonesError && stonesReady && mode !== "jewelry" && (
              <p className="inv-notice" role="status">
                Couldn’t refresh — showing the last loaded list.{" "}
                <button type="button" className="inv-btn inv-btn--plain inv-btn--sm" onClick={() => setReloadKey((k) => k + 1)}>
                  Try again
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      <SelectionBar
        count={selected.size}
        caratText={selectedCarats > 0 ? `${selectedCarats.toFixed(2)} ct` : ""}
        pairsText={pairView ? `${Math.ceil(selected.size / 2)} pair${Math.ceil(selected.size / 2) === 1 ? "" : "s"}` : ""}
        canCompare={selected.size >= 2 && selected.size <= 3}
        onCompare={() => setCompareOpen(true)}
        onClear={() => setSelected(new Set())}
        actions={selectionActions}
        sheet={isPhone}
      />

      {!railVisible && (
        <Sheet
          open={filtersOpen}
          variant={isPhone ? "bottom" : "side"}
          tall={isPhone}
          onClose={() => setFiltersOpen(false)}
          title="Filters"
          titleId="inv-filters-title"
          closeLabel="Close filters"
          headerExtra={
            chips.length > 0 ? (
              <button type="button" className="inv-btn inv-btn--plain inv-btn--sm" onClick={clearAll}>
                Clear all
              </button>
            ) : null
          }
          footer={
            <button type="button" className="inv-btn inv-btn--primary" onClick={() => setFiltersOpen(false)}>
              {loadingFirst ? "Done" : `Show ${total.toLocaleString()} ${pairView ? "pairs" : noun}`}
            </button>
          }
        >
          {chips.length > 0 && <ActiveFilters className="inv-active--sheet" chips={chips} onRemove={removeChip} />}
          {filterPanel}
        </Sheet>
      )}

      <QuickLook
        item={activeItem}
        variant={quickLookVariant}
        onClose={closeQuickLook}
        index={activeIndex}
        total={stepList.length}
        onStep={stepQuickLook}
        priceMode={priceMode}
        status={activeItem?.sku ? statusMap[activeItem.sku] : null}
        allTags={tags}
        itemTags={activeItem?.sku ? stoneTags[activeItem.sku] : null}
        onToggleTag={toggleStoneTag}
        onManageTags={() => setTagsOpen(true)}
        onAssign={handleAssign}
        assigning={assigningSku === activeItem?.sku}
        onOpenDna={openDna}
        onPrintLabel={(item) => {
          setNiimbotStones([item]);
          setNiimbotOpen(true);
        }}
        onImage={(src) => setLightbox({ image: src, video: null })}
      />

      <Lightbox image={lightbox.image} video={lightbox.video} onClose={() => setLightbox({ image: null, video: null })} />

      <AssistantChat
        inventoryMode={mode}
        vocabulary={assistantVocabulary}
        navTargets={assistantNavTargets}
        filters={filters}
        results={sorted}
        priceMode={priceMode}
        onApply={handleAssistantApply}
        onRemoveFilter={handleAssistantRemoveFilter}
        onNavigate={(path) => navigate(path)}
        onOpenStone={openItem}
        liftAboveFab={selected.size > 0}
      />

      <BarcodeScanner isOpen={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />

      <ColumnSettingsModal
        isOpen={columnsOpen}
        onClose={() => setColumnsOpen(false)}
        columnConfig={columnConfig}
        onSave={handleColumnSave}
        activeDefaultColumns={columnDefs}
      />

      <TagsModal
        isOpen={tagsOpen}
        onClose={() => setTagsOpen(false)}
        tags={tags}
        onCreateTag={createTag}
        onDeleteTag={deleteTag}
        onUpdateTag={updateTag}
      />

      <CompareModal isOpen={compareOpen} onClose={() => setCompareOpen(false)} stones={applyPriceMode(selectedItems)} />

      <InternalExcelModal
        isOpen={internalOpen}
        onClose={() => setInternalOpen(false)}
        counts={internalCounts}
        onExport={(selections) => exportToInternalExcel(selections, applyPriceMode(selectedItems))}
      />

      <ExportModal
        isOpen={exportOpen}
        onClose={() => {
          setExportOpen(false);
          setExportMode("combined");
        }}
        selectedStones={applyPriceMode(selectedItems)}
        priceMode={priceMode}
        onExport={(modified, opts = {}) => {
          if (exportMode === "separate") exportToExcelSeparate(modified, opts, user);
          else exportToExcel(modified, opts, user);
        }}
      />

      <CategoryExportModal
        isOpen={categoryChoiceOpen}
        onClose={() => setCategoryChoiceOpen(false)}
        categories={getCategoryBreakdown(applyPriceMode(selectedItems))}
        onChoose={(choice) => {
          setCategoryChoiceOpen(false);
          setExportMode(choice === "separate" ? "separate" : "combined");
          setExportOpen(true);
        }}
      />

      <ExportModal
        isOpen={pdfPriceOpen}
        onClose={() => setPdfPriceOpen(false)}
        selectedStones={applyPriceMode(selectedItems)}
        priceMode={priceMode}
        onExport={(modified) => {
          setPdfStones(modified);
          setPdfPriceOpen(false);
          setPdfOpen(true);
        }}
        title="Adjust Prices for PDF"
        subtitle="Modify prices before generating the catalog"
        buttonText="Continue to PDF Options"
        buttonColor="from-red-500 to-pink-500"
        showHidePricesOption={false}
      />

      <PDFOptionsModal
        isOpen={pdfOpen}
        onClose={() => {
          setPdfOpen(false);
          setPdfStones([]);
        }}
        stoneCount={pdfStones.length || selected.size}
        isGenerating={pdfGenerating}
        onGenerate={async (opts) => {
          setPdfGenerating(true);
          try {
            const stonesToUse = pdfStones.length > 0 ? pdfStones : applyPriceMode(selectedItems);
            await generatePDFCatalog(stonesToUse, {
              ...opts,
              userLocation: user?.publicMetadata?.location,
              userEmail: user?.primaryEmailAddress?.emailAddress,
            });
            setPdfOpen(false);
            setPdfStones([]);
          } catch (err) {
            console.error("PDF generation failed:", err);
            toast.error("Failed to generate PDF. Please try again.");
          } finally {
            setPdfGenerating(false);
          }
        }}
      />

      <CatalogLiranModal
        isOpen={Boolean(liranStones)}
        stones={liranStones || []}
        onClose={() => setLiranStones(null)}
        isGenerating={liranGenerating}
        onGenerate={handleLiranGenerate}
      />

      <NiimbotPrintDialog
        isOpen={niimbotOpen}
        onClose={() => {
          setNiimbotOpen(false);
          setNiimbotStones([]);
        }}
        stones={niimbotStones.length > 0 ? niimbotStones : selectedItems}
      />

      {crmOpen && <SendToCrmModal stones={selectedItems} onClose={() => setCrmOpen(false)} />}
    </div>
  );
};

export default StoneSearchPage;
