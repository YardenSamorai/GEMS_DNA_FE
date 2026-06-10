import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchSoapStones } from "../../services/stonesApi";
import { getDisplayShape, getDisplayColor, shortTreatment } from "../inventory/helpers/constants";
import { getMappedCategories } from "../../utils/categoryMap";
import { DIAMOND_SHAPES } from "./diamondShapes";

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
  { label: "0.30 - 0.39", from: "0.30", to: "0.39" },
  { label: "0.40 - 0.49", from: "0.40", to: "0.49" },
  { label: "0.50 - 0.69", from: "0.50", to: "0.69" },
  { label: "0.70 - 0.89", from: "0.70", to: "0.89" },
  { label: "0.90 - 0.99", from: "0.90", to: "0.99" },
  { label: "1.00 - 1.49", from: "1.00", to: "1.49" },
  { label: "1.50 - 1.99", from: "1.50", to: "1.99" },
  { label: "2.00 - 2.99", from: "2.00", to: "2.99" },
  { label: "3.00 - 3.99", from: "3.00", to: "3.99" },
  { label: "4.00 - 4.99", from: "4.00", to: "4.99" },
  { label: "5.00 +", from: "5.00", to: "" },
];

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

/* One plain detail line under the title (treatment, lab, measurements, …). */
const Line = ({ value }) =>
  value == null || value === "" ? null : (
    <p className="text-[12.5px] leading-snug text-app-muted">{value}</p>
  );

const GemstoneCard = ({ stone }) => {
  const title = buildTitle(stone);
  const lab = stone.lab && String(stone.lab).toUpperCase() !== "N/A" ? stone.lab : null;
  const treatment = stone.treatment ? shortTreatment(stone.treatment) : null;
  const img = stoneImage(stone);
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = img && !imgFailed;
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
        <h3 className="text-[14px] font-semibold leading-snug text-app-ink">
          {title || stone.sku || "Gemstone"}
        </h3>
        <Line value={treatment} />
        <Line value={lab} />
        <Line value={stone.measurements} />
        <Line value={stone.location} />
        <Line value={stone.sku ? `Stock #${stone.sku}` : null} />
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
  // Selected diamond shapes (multi-select). Other categories will grow their
  // own filter state alongside this.
  const [shapeSel, setShapeSel] = useState([]);
  const toggleShape = (key) =>
    setShapeSel((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  // Carat size range (custom fields + quick-band presets).
  const [sizeFrom, setSizeFrom] = useState("");
  const [sizeTo, setSizeTo] = useState("");
  const applyPreset = (p) => {
    const active = sizeFrom === p.from && sizeTo === p.to;
    setSizeFrom(active ? "" : p.from);
    setSizeTo(active ? "" : p.to);
  };

  useEffect(() => {
    let cancelled = false;
    // Different categories expose different filters — clear selections so a
    // shape picked under Diamonds doesn't linger when you hop to Emeralds.
    setShapeSel([]);
    setSizeFrom("");
    setSizeTo("");
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

  const visibleStones = useMemo(() => stones.slice(0, visibleCount), [stones, visibleCount]);
  const hasMore = visibleCount < stones.length;

  // Infinite scroll — reveal the next batch when the sentinel nears the
  // viewport. `rootMargin` pre-loads slightly before the user hits bottom.
  const sentinelRef = useRef(null);
  const loadMore = useCallback(() => {
    setVisibleCount((c) => Math.min(c + PAGE_SIZE, stones.length));
  }, [stones.length]);

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
      {!loading && !error && stones.length === 0 && (
        <div className="mt-8 rounded-2xl glass-surface p-10 text-center">
          <p className="text-[14px] font-medium text-app-ink">No {cfg.noun} in inventory</p>
        </div>
      )}

      {/* Grid — 2 cards per row on phones, wider on larger screens. */}
      {!loading && !error && stones.length > 0 && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
            {visibleStones.map((stone, idx) => (
              <GemstoneCard key={stone.id ?? stone.sku ?? idx} stone={stone} />
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
              <div
                className="flex-1 overflow-y-auto px-5 py-4"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
              >
                {mode === "diamond" ? (
                  <div className="space-y-7">
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
                      <div className="grid grid-flow-col grid-rows-2 auto-cols-[76px] gap-2">
                        {DIAMOND_SHAPES.map((sh) => {
                          const active = shapeSel.includes(sh.key);
                          return (
                            <button
                              key={sh.key}
                              type="button"
                              aria-pressed={active}
                              onClick={() => toggleShape(sh.key)}
                              className={`flex flex-col items-center gap-1 rounded-2xl border px-1.5 py-2.5 transition ${
                                active
                                  ? "border-app-ink bg-app-ink/5 text-app-ink"
                                  : "border-app-line bg-app-surface text-app-graphite hover:bg-app-canvas2"
                              }`}
                            >
                              {sh.icon("h-8 w-8")}
                              <span className="w-full truncate text-center text-[10px] font-medium leading-none">
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
                          const active = sizeFrom === p.from && sizeTo === p.to;
                          return (
                            <button
                              key={p.label}
                              type="button"
                              aria-pressed={active}
                              onClick={() => applyPreset(p)}
                              className={`whitespace-nowrap rounded-xl border px-3 py-2 text-[12.5px] font-medium transition ${
                                active
                                  ? "border-app-ink bg-app-ink/5 text-app-ink"
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
                  </div>
                ) : (
                  <p className="text-[13px] text-app-soft">No filters configured yet.</p>
                )}
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
