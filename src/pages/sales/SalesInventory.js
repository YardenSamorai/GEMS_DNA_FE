import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { fetchSoapStones } from "../../services/stonesApi";
import { getDisplayShape, shortTreatment } from "../inventory/helpers/constants";
import { getMappedCategories } from "../../utils/categoryMap";

/* Gemstones only — exclude diamonds and fancy-colour diamonds. The category
 * map resolves e.g. "Sapphire O" -> ["Sapphire"], "Diamond O" -> ["Diamond"],
 * "Fancy" -> ["Diamond", "Fancy"]. Anything tagged Diamond/Fancy is filtered
 * out; coloured stones (Sapphire, Emerald, Ruby, Tourmaline, …) stay. */
const isGemstone = (stone) => {
  const mapped = getMappedCategories(stone.category);
  return !mapped.includes("Diamond") && !mapped.includes("Fancy");
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

/* "1.16ct Pear ICA Minor" — carat + shape + lab + treatment. */
const buildTitle = (s) => {
  const ct = s.weightCt != null && s.weightCt !== "" ? `${s.weightCt}ct` : "";
  const shape = getDisplayShape(s.shape);
  const lab = s.lab || "";
  const treatment = s.treatment ? shortTreatment(s.treatment) : "";
  return [ct, shape, lab, treatment].filter(Boolean).join(" ");
};

const Tag = ({ label, value }) => {
  if (!value && value !== 0) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-app-canvas2 border border-app-line px-2 py-0.5 text-[11px] leading-none">
      <span className="font-medium uppercase tracking-[0.08em] text-app-soft">{label}</span>
      <span className="font-medium text-app-graphite">{value}</span>
    </span>
  );
};

const GemstoneCard = ({ stone }) => {
  const title = buildTitle(stone);
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-app-line glass-surface">
      {/* Image */}
      <div className="aspect-square w-full overflow-hidden bg-app-canvas2">
        {stone.imageUrl ? (
          <img
            src={stone.imageUrl}
            alt={title || stone.sku}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-app-soft">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.3} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="text-[13.5px] font-semibold leading-snug tracking-tight text-app-ink">
          {title || stone.sku || "Gemstone"}
        </h3>
        <div className="mt-auto flex flex-wrap gap-1.5">
          <Tag label="ct" value={stone.weightCt != null && stone.weightCt !== "" ? stone.weightCt : null} />
          <Tag label="treatment" value={stone.treatment ? shortTreatment(stone.treatment) : null} />
          <Tag label="lab" value={stone.lab || null} />
          <Tag label="location" value={stone.location || null} />
        </div>
      </div>
    </div>
  );
};

const SalesInventory = () => {
  const { user } = useUser();
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
        const data = await fetchSoapStones(
          {
            id: user?.id,
            email: user?.primaryEmailAddress?.emailAddress,
            name: user?.fullName,
          },
          { assignedTo: "all" }
        );
        const rows = Array.isArray(data?.stones) ? data.stones : Array.isArray(data) ? data : [];
        if (!cancelled) setStones(rows.filter(isGemstone));
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load gemstones");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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
        <h1 className="text-2xl font-semibold tracking-tight text-app-ink">Sales Inventory</h1>
        {!loading && !error && (
          <span className="text-sm text-app-muted">{stones.length} gemstones</span>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-app-line glass-surface">
              <div className="aspect-square w-full skeleton" />
              <div className="space-y-2 p-3">
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
          <p className="text-[14px] font-medium text-app-ink">Couldn't load gemstones</p>
          <p className="mt-1 text-[12.5px] text-app-soft">{error}</p>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && stones.length === 0 && (
        <div className="mt-8 rounded-2xl glass-surface p-10 text-center">
          <p className="text-[14px] font-medium text-app-ink">No gemstones in inventory</p>
        </div>
      )}

      {/* Grid — 2 cards per row on phones, wider on larger screens. */}
      {!loading && !error && stones.length > 0 && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
