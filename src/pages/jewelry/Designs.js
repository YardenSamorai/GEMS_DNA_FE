import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useRouteLoading } from "../../components/RouteLoadingContext";
import { fetchJewelryCatalog } from "../../services/jewelryApi";
import { decryptPrice } from "../../utils/decrypt";
import { sanitizeText, normalizeJewelryCategory } from "../../utils/helper";
import MakeFromTemplateModal from "../../components/MakeFromTemplateModal";

/* ============================================================================
 * Designs / CAD Library — a reusable design-template gallery built on the
 * catalog (jewelry_products). Each card is a design you can search, filter by
 * category, see the price of, open as a full DNA page, or spin into a new
 * workshop job via "Make from template" (createJewelryItemFromTemplate).
 * ========================================================================== */

const fmtMoney = (n) => {
  const v = Number(n) || 0;
  if (!v) return null;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(v).toLocaleString()}`;
};

// Map a raw jewelry_products row into the shape this page renders. Mirrors
// the catalog mapping used by the unified inventory grid so the two surfaces
// stay consistent.
const mapTemplate = (row) => {
  const firstImage =
    (row.all_pictures_link || "")
      .split(";")
      .map((u) => u.trim())
      .filter(Boolean)[0] || null;
  let price = 0;
  try { price = row.price ? Number(decryptPrice(row.price)) || 0 : 0; } catch (_) {}
  const category =
    normalizeJewelryCategory(row.jewelry_type) ||
    normalizeJewelryCategory(row.style) ||
    normalizeJewelryCategory(row.category) ||
    null;
  const metalSummary = row.metal_type
    ? [row.metal_type, row.style].filter(Boolean).join(" / ")
    : null;
  return {
    model_number: row.model_number,
    title: sanitizeText(row.title) || row.model_number || "Untitled",
    category,
    metal_summary: metalSummary,
    cover_image_url: firstImage,
    price: price || null,
  };
};

/* ---------- Card ---------- */

const DesignCard = ({ tpl, onMake }) => {
  const href = `/jewelry/${tpl.model_number}`;
  const priceLabel = fmtMoney(tpl.price);
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl glass-surface transition hover:-translate-y-0.5">
      <Link to={href} className="relative block aspect-square w-full overflow-hidden bg-app-canvas-2">
        {tpl.cover_image_url ? (
          <img
            src={tpl.cover_image_url}
            alt={tpl.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-app-soft">
            <svg className="h-14 w-14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.4}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
        )}
        {tpl.category && (
          <span className="absolute left-2 top-2 rounded-full bg-app-ink/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-app-canvas backdrop-blur">
            {tpl.category}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <Link to={href} className="truncate text-[13px] font-semibold text-app-ink hover:underline" title={tpl.title}>
          {tpl.title}
        </Link>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="truncate font-mono text-app-soft" title={tpl.model_number}>
            {tpl.model_number || "—"}
          </span>
          {priceLabel ? (
            <span className="shrink-0 font-bold tabular-nums text-emerald-600">{priceLabel}</span>
          ) : (
            <span className="shrink-0 text-app-soft">On request</span>
          )}
        </div>

        {tpl.metal_summary && (
          <div className="truncate text-[11.5px] text-app-muted">{tpl.metal_summary}</div>
        )}

        <div className="mt-auto flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => onMake(tpl)}
            className="flex-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-emerald-700"
          >
            Make from template
          </button>
          <Link
            to={href}
            className="rounded-lg border border-app-line px-2.5 py-1.5 text-[12px] font-medium text-app-graphite transition-colors hover:border-app-line-2 hover:text-app-ink"
            title="Open full DNA page"
          >
            DNA
          </Link>
        </div>
      </div>
    </div>
  );
};

/* ---------- Page ---------- */

const PAGE_STEP = 48;

const Designs = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  useRouteLoading(initialLoading);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [limit, setLimit] = useState(PAGE_STEP);

  const [makeTpl, setMakeTpl] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchJewelryCatalog()
      .then((res) => {
        const rows = res.jewelry || [];
        setTemplates(rows.map(mapTemplate).filter((t) => t.model_number));
      })
      .catch((err) => toast.error(err.message || "Failed to load designs"))
      .finally(() => {
        setLoading(false);
        setInitialLoading(false);
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => {
    const set = new Set();
    templates.forEach((t) => { if (t.category) set.add(t.category); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [templates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (q) {
        const hay = `${t.title} ${t.model_number} ${t.category || ""} ${t.metal_summary || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [templates, search, category]);

  // Reset paging whenever the filter set changes.
  useEffect(() => { setLimit(PAGE_STEP); }, [search, category]);

  const visible = filtered.slice(0, limit);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h1 className="text-2xl font-semibold tracking-tight text-app-ink">Designs</h1>
            <span className="text-sm text-app-muted">CAD &amp; template library</span>
          </div>
          <p className="mt-1 text-xs text-app-soft">
            Reusable design templates — open the DNA or spin one into a workshop job.
          </p>
        </div>
        {!loading && (
          <div className="text-xs text-app-soft">
            {filtered.length.toLocaleString()} {filtered.length === 1 ? "design" : "designs"}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mt-5 space-y-3">
        <div className="relative max-w-md">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, model number, metal…"
            className="h-9 w-full rounded-lg border border-app-line bg-app-canvas-2 pl-9 pr-3 text-[13px] text-app-ink placeholder:text-app-soft focus:border-app-line-2 focus:outline-none"
          />
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <CategoryChip active={category === "all"} onClick={() => setCategory("all")}>
              All
            </CategoryChip>
            {categories.map((c) => (
              <CategoryChip key={c} active={category === c} onClick={() => setCategory(c)}>
                {c}
              </CategoryChip>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl glass-surface">
              <div className="aspect-square w-full animate-pulse bg-app-canvas-2" />
              <div className="space-y-2 p-3">
                <div className="h-3 w-3/4 animate-pulse rounded bg-app-canvas-2" />
                <div className="h-2.5 w-1/2 animate-pulse rounded bg-app-canvas-2" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-5 flex flex-col items-center justify-center rounded-2xl glass-surface px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-app-canvas-2 text-app-soft">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <h3 className="mt-3 text-[15px] font-semibold text-app-ink">
            {templates.length === 0 ? "No designs in the library yet" : "Nothing matches your filters"}
          </h3>
          <p className="mt-1 max-w-sm text-[13px] text-app-muted">
            {templates.length === 0
              ? "Catalog designs will appear here once your catalog is synced."
              : "Try a different category or clear the search."}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visible.map((tpl) => (
              <DesignCard key={tpl.model_number} tpl={tpl} onMake={setMakeTpl} />
            ))}
          </div>

          {limit < filtered.length && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setLimit((l) => l + PAGE_STEP)}
                className="rounded-lg border border-app-line bg-app-canvas-2 px-4 py-2 text-[13px] font-medium text-app-graphite transition-colors hover:border-app-line-2 hover:text-app-ink"
              >
                Load more ({filtered.length - limit} left)
              </button>
            </div>
          )}
        </>
      )}

      <MakeFromTemplateModal
        open={!!makeTpl}
        template={makeTpl}
        onClose={() => setMakeTpl(null)}
      />
    </div>
  );
};

const CategoryChip = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
      active
        ? "bg-app-ink text-app-canvas"
        : "border border-app-line bg-app-canvas-2 text-app-graphite hover:text-app-ink"
    }`}
  >
    {children}
  </button>
);

export default Designs;
