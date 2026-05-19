import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { useRouteLoading } from "../../components/RouteLoadingContext";
import {
  fetchJewelryItems,
  fetchJewelryCatalog,
  JEWELRY_STATUSES,
  JEWELRY_TYPES,
} from "../../services/jewelryApi";
import { decryptPrice } from "../../utils/decrypt";
import { sanitizeText, normalizeJewelryCategory } from "../../utils/helper";
import JewelryItemCard from "./components/JewelryItemCard";
import JewelryItemDialog from "./components/JewelryItemDialog";
import NewJewelryItemModal from "./components/NewJewelryItemModal";
import StatusBadge from "./components/StatusBadge";

// Map a row from `jewelry_products` (the WooCommerce-fed catalog) into the
// shape the JewelryItemCard expects, so both catalog pieces and workshop
// jobs can live in one grid. We tag with __source so the card knows where
// to route on click and how to badge it.
const mapCatalogRow = (row) => {
  const firstImage = (row.all_pictures_link || "")
    .split(";")
    .map((u) => u.trim())
    .filter(Boolean)[0] || null;
  let price = 0;
  try { price = row.price ? Number(decryptPrice(row.price)) || 0 : 0; } catch (_) {}
  // Prefer the specific jewelry_type ("Bracelet", "Ring") over the generic
  // top-level WooCommerce category ("Jewelry"), then normalize so plurals
  // and variants ("Bracelets", "Bangle Bracelet") collapse into one bucket.
  const category =
    normalizeJewelryCategory(row.jewelry_type) ||
    normalizeJewelryCategory(row.style) ||
    normalizeJewelryCategory(row.category) ||
    null;
  const metalSummary = row.metal_type
    ? [row.metal_type, row.style].filter(Boolean).join(" / ")
    : null;
  return {
    id: `cat_${row.model_number}`,
    __source: "catalog",
    // Keep the original row around so the quick-look dialog can render every
    // catalog field (center stone, certificate, all images, etc.) without
    // a second network round-trip.
    __raw: row,
    sku: row.model_number || "",
    name: sanitizeText(row.title) || row.model_number || "Untitled",
    category,
    metal_summary: metalSummary,
    cover_image_url: firstImage,
    sale_price: price || null,
    description: sanitizeText(row.description) || sanitizeText(row.full_description) || "",
    status: null,
    type: null,
    model_number: row.model_number,
  };
};

const FEATURE_PILLS = [
  "Multi-location",
  "Barcode scanning",
  "GIA/IGI certs",
  "Bill of materials",
  "Rapaport pricing",
  "Low stock alerts",
];

// Page size options for the inventory grid. "all" lets power users see
// everything in one go, but is gated behind an explicit pick (we don't
// want to slam the DOM with thousands of cards by default).
const PAGE_SIZE_OPTIONS = [24, 48, 96, 192, "all"];
const DEFAULT_PAGE_SIZE = 24;
const PAGE_SIZE_STORAGE_KEY = "jewelry.inventory.pageSize.v1";

const loadStoredPageSize = () => {
  try {
    const raw = localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    if (!raw) return DEFAULT_PAGE_SIZE;
    if (raw === "all") return "all";
    const n = parseInt(raw, 10);
    if (PAGE_SIZE_OPTIONS.includes(n)) return n;
    return DEFAULT_PAGE_SIZE;
  } catch (_) {
    return DEFAULT_PAGE_SIZE;
  }
};

// Build a page-button list with ellipses for long ranges, e.g.
//   1 ... 4 5 [6] 7 8 ... 25
const buildPageList = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  if (current <= 4) [2, 3, 4, 5].forEach((p) => pages.add(p));
  if (current >= total - 3) [total - 4, total - 3, total - 2, total - 1].forEach((p) => pages.add(p));
  const sorted = Array.from(pages).filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
};

const InventoryHero = () => (
  <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-900 via-stone-900 to-stone-800 px-6 py-8 text-white shadow-lg sm:px-10 sm:py-10">
    {/* Subtle decorative glows */}
    <div className="pointer-events-none absolute -top-10 -right-10 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
    <div className="pointer-events-none absolute -bottom-12 left-12 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl" />

    <div className="relative max-w-3xl">
      <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
        Your inventory, always under control
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-300 sm:text-base">
        Manage jewelry, loose stones, watches, and raw materials in one place. Tag, filter,
        and search across thousands of items with ease.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {FEATURE_PILLS.map((p) => (
          <span
            key={p}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-stone-200 backdrop-blur-sm"
          >
            {p}
          </span>
        ))}
      </div>
    </div>
  </section>
);

const JewelryItemsList = () => {
  const { user } = useUser();
  const userId = user?.id;
  const [items, setItems] = useState([]);          // workshop jobs (jewelry_items)
  const [catalogItems, setCatalogItems] = useState([]); // catalog (jewelry_products)
  const [loading, setLoading] = useState(true);
  // Keep the route-transition gem visible until the workshop list lands.
  useRouteLoading(loading);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);

  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all"); // 'all' | 'workshop' | 'catalog'
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(() => loadStoredPageSize());
  const [page, setPage] = useState(1);
  const [previewItem, setPreviewItem] = useState(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const filters = {};
      if (statusFilter) filters.status = statusFilter;
      if (typeFilter) filters.type = typeFilter;
      if (search) filters.search = search;
      const res = await fetchJewelryItems(userId, filters);
      // Normalize the workshop category too so a user-typed "Rings" buckets
      // with the catalog's "Ring" instead of showing as a separate option.
      setItems(
        (res.items || []).map((it) => ({
          ...it,
          __source: "workshop",
          category: normalizeJewelryCategory(it.category) || it.category,
        }))
      );
    } catch (err) {
      setError(err.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [userId, statusFilter, typeFilter, search]);

  // Catalog is global (not per-user) and rarely changes during a session, so
  // we load it once and keep it in memory; filters are applied client-side.
  const loadCatalog = useCallback(async () => {
    try {
      const data = await fetchJewelryCatalog();
      const rows = (data?.jewelry || []).map(mapCatalogRow);
      setCatalogItems(rows);
    } catch (err) {
      // Catalog failure shouldn't block the workshop list — log and move on
      console.warn("Catalog load failed:", err.message);
      setCatalogItems([]);
    } finally {
      setCatalogLoaded(true);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  // Combine workshop + catalog according to filters. Status/type only make
  // sense for workshop items, so when those filters are active we hide
  // catalog rows; otherwise both sources show together unless the user has
  // explicitly narrowed the source.
  const visibleItems = useMemo(() => {
    const workshopActive =
      sourceFilter !== "catalog" && (!statusFilter && !typeFilter ? true : true);
    const showWorkshop = sourceFilter === "all" || sourceFilter === "workshop";
    const showCatalog =
      (sourceFilter === "all" || sourceFilter === "catalog") &&
      !statusFilter && !typeFilter;

    let combined = [];
    if (showWorkshop && workshopActive) combined = combined.concat(items);
    if (showCatalog) {
      // Apply search client-side to catalog (BE filtered workshop already)
      const q = (search || "").trim().toLowerCase();
      const cat = q
        ? catalogItems.filter((c) =>
            (c.name || "").toLowerCase().includes(q) ||
            (c.sku || "").toLowerCase().includes(q) ||
            (c.description || "").toLowerCase().includes(q)
          )
        : catalogItems;
      combined = combined.concat(cat);
    }

    if (categoryFilter) {
      // Case-insensitive match — catalog rows from WooCommerce can come in
      // as 'Rings'/'Ring'/'rings', and a strict equality check threw all of
      // them out. We normalize on both sides.
      const target = categoryFilter.toLowerCase();
      combined = combined.filter((i) => (i.category || "").toLowerCase() === target);
    }
    return combined;
  }, [items, catalogItems, sourceFilter, statusFilter, typeFilter, categoryFilter, search]);

  // Build the category dropdown options from the actual items currently in
  // the inventory (workshop + catalog) instead of a hard-coded list. This
  // way the user only sees categories that will actually return results.
  const categoryOptions = useMemo(() => {
    const seen = new Map(); // key: lowercased label, value: original casing
    for (const it of items) {
      const c = (it.category || "").trim();
      if (c && !seen.has(c.toLowerCase())) seen.set(c.toLowerCase(), c);
    }
    for (const it of catalogItems) {
      const c = (it.category || "").trim();
      if (c && !seen.has(c.toLowerCase())) seen.set(c.toLowerCase(), c);
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }, [items, catalogItems]);

  const stats = useMemo(() => {
    const out = {
      total: visibleItems.length,
      workshop: visibleItems.filter((i) => i.__source === "workshop").length,
      catalog: visibleItems.filter((i) => i.__source === "catalog").length,
      byStatus: {},
    };
    for (const it of visibleItems) {
      if (it.status) out.byStatus[it.status] = (out.byStatus[it.status] || 0) + 1;
    }
    return out;
  }, [visibleItems]);

  // Reset to first page whenever the underlying result set changes (filters,
  // search, or page size). Without this you can land on page 12 and see an
  // empty grid because filtering shrunk the list to 3 pages.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, typeFilter, categoryFilter, sourceFilter, pageSize]);

  // Persist page size so the user's preference sticks across sessions
  useEffect(() => {
    try { localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize)); } catch (_) {}
  }, [pageSize]);

  const totalPages = pageSize === "all"
    ? 1
    : Math.max(1, Math.ceil(visibleItems.length / pageSize));

  // Clamp page if it became out of range (e.g. user was on page 5 and switched
  // page size from 24 to 192, leaving only 1 page).
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedItems = useMemo(() => {
    if (pageSize === "all") return visibleItems;
    const start = (page - 1) * pageSize;
    return visibleItems.slice(start, start + pageSize);
  }, [visibleItems, page, pageSize]);

  const rangeStart = visibleItems.length === 0 ? 0 : pageSize === "all" ? 1 : (page - 1) * pageSize + 1;
  const rangeEnd = pageSize === "all" ? visibleItems.length : Math.min(page * pageSize, visibleItems.length);

  const hasActiveFilters =
    statusFilter || typeFilter || categoryFilter || search || sourceFilter !== "all";
  const clearFilters = () => {
    setStatusFilter("");
    setTypeFilter("");
    setCategoryFilter("");
    setSourceFilter("all");
    setSearch("");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <InventoryHero />

      {/* Toolbar */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 18a7 7 0 110-14 7 7 0 010 14z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, SKU…"
              className="w-56 rounded-lg border border-stone-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            title="Show workshop jobs, catalog pieces, or both"
          >
            <option value="all">All sources</option>
            <option value="workshop">Workshop</option>
            <option value="catalog">Catalog</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            title="Categories pulled from the items actually in your inventory"
          >
            <option value="">All categories</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            disabled={sourceFilter === "catalog"}
            title={sourceFilter === "catalog" ? "Status only applies to workshop jobs" : ""}
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-400"
          >
            <option value="">All statuses</option>
            {JEWELRY_STATUSES.filter((s) => s.value !== "archived").map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            disabled={sourceFilter === "catalog"}
            title={sourceFilter === "catalog" ? "Type only applies to workshop jobs" : ""}
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-400"
          >
            <option value="">All types</option>
            {JEWELRY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="rounded-lg px-2 py-2 text-xs font-semibold text-stone-500 hover:bg-stone-100 hover:text-stone-800"
            >
              Clear
            </button>
          )}
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          New Item
        </button>
      </div>

      {/* Stats strip — total + workshop/catalog breakdown + status counts */}
      {stats.total > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">
            {stats.total} {stats.total === 1 ? "item" : "items"}
          </span>
          {stats.workshop > 0 && (
            <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              {stats.workshop} workshop
            </span>
          )}
          {stats.catalog > 0 && (
            <span className="rounded-md bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
              {stats.catalog} catalog
            </span>
          )}
          {Object.entries(stats.byStatus).slice(0, 6).map(([s, c]) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <StatusBadge status={s} size="sm" />
              <span className="text-xs text-stone-500">{c}</span>
            </span>
          ))}
        </div>
      )}

      {/* Body */}
      {error && (
        <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl glass-surface">
              <div className="aspect-square w-full animate-pulse bg-stone-100" />
              <div className="space-y-2 p-3">
                <div className="h-3 w-3/4 animate-pulse rounded bg-stone-100" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-stone-100" />
                <div className="h-4 w-1/3 animate-pulse rounded bg-stone-100" />
              </div>
            </div>
          ))}
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="mt-6 rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 px-6 py-20 text-center">
          <svg className="mx-auto mb-3 h-12 w-12 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M5 3l3.057-3 4.886 0L16 3l4 5-8 13L4 8l1-5z" />
          </svg>
          <h3 className="text-lg font-semibold text-stone-700">
            {hasActiveFilters ? "No items match your filters" : "No jewelry items yet"}
          </h3>
          <p className="mt-1 text-sm text-stone-500">
            {hasActiveFilters
              ? "Try adjusting or clearing your filters."
              : "Create your first piece to start filling your inventory."}
          </p>
          {hasActiveFilters ? (
            <button
              onClick={clearFilters}
              className="mt-4 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
            >
              Clear filters
            </button>
          ) : (
            <button
              onClick={() => setShowNewModal(true)}
              className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Create your first item
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Pagination header — range counter on the left, page-size on the right */}
          <div className="mt-6 flex flex-col items-start gap-2 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing <span className="font-semibold text-stone-800">{rangeStart}–{rangeEnd}</span>
              {" "}of <span className="font-semibold text-stone-800">{visibleItems.length}</span>
              {visibleItems.length === 1 ? " item" : " items"}
            </span>
            <label className="flex items-center gap-2">
              <span>Per page</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const v = e.target.value;
                  setPageSize(v === "all" ? "all" : Number(v));
                }}
                className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none"
              >
                {PAGE_SIZE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === "all" ? "All" : opt}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {pagedItems.map((it) => (
              <JewelryItemCard key={it.id} item={it} onSelect={setPreviewItem} />
            ))}
          </div>

          {/* Pagination footer — Prev / numbered / Next, hidden when single page */}
          {totalPages > 1 && (
            <nav className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Previous
              </button>
              {buildPageList(page, totalPages).map((p, idx) =>
                p === "…" ? (
                  <span key={`gap-${idx}`} className="px-2 text-stone-400">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    aria-current={p === page ? "page" : undefined}
                    className={`min-w-[2.25rem] rounded-lg border px-2.5 py-1.5 text-sm font-medium transition ${
                      p === page
                        ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                        : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next →
              </button>
            </nav>
          )}
        </>
      )}

      <NewJewelryItemModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreated={load}
      />

      <JewelryItemDialog
        open={!!previewItem}
        item={previewItem}
        onClose={() => setPreviewItem(null)}
      />
    </div>
  );
};

export default JewelryItemsList;
