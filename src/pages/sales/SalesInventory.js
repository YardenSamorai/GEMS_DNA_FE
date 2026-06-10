import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchSoapStones } from "../../services/stonesApi";
import { getDisplayShape, getDisplayColor, shortTreatment } from "../inventory/helpers/constants";
import { getMappedCategories } from "../../utils/categoryMap";

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

  useEffect(() => {
    let cancelled = false;
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
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h1 className="text-2xl font-semibold tracking-tight text-app-ink">{cfg.title}</h1>
        {!loading && !error && (
          <span className="text-sm text-app-muted">{stones.length} {cfg.noun}</span>
        )}
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
    </div>
  );
};

export default SalesInventory;
