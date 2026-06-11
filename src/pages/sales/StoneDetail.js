import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { fetchSoapStones } from "../../services/stonesApi";
import { getDisplayShape, getDisplayColor, shortTreatment } from "../inventory/helpers/constants";
import { getMappedCategories } from "../../utils/categoryMap";
import {
  norm,
  parseDims,
  fluorDisplay,
  money,
  resolveLocation,
  usableImg,
  hasCert,
  adjustSalesPrices,
  StonePlaceholder,
} from "./SalesInventory";

/* ============================================================================
 * StoneDetail — the per-stone product page behind the sales catalog cards.
 *
 * Visual language mirrors the rest of the sales surfaces: an edge-to-edge
 * media carousel with frosted floating controls, a rounded content sheet that
 * slides up over the photo (same rounded-t-3xl sheet the Filter/Sort dialogs
 * use), hairline section labels, and a dark ink price panel that echoes the
 * "Show results" button.
 *
 * Stones arrive via router state when opened from the catalog grid (no extra
 * fetch). Deep links (/sales/stone/:sku) fall back to fetching the shared
 * inventory and locating the SKU.
 * ========================================================================== */

/* All usable photo URLs for a stone: main image first, then the extra
 * shots. Folder-only URLs are dropped (see usableImg), duplicates removed. */
const stoneImages = (s) => {
  const urls = [s.imageUrl, ...String(s.additionalPictures || "").split(";")];
  const seen = new Set();
  const out = [];
  for (const u of urls) {
    const ok = usableImg(u);
    if (ok && !seen.has(ok)) {
      seen.add(ok);
      out.push(ok);
    }
  }
  return out;
};

const certLink = (s) =>
  usableImg(s.certificateUrl) || usableImg(s.certificateImageJpg) || null;

/* Hairline section label — the non-interactive sibling of the filter sheet's
 * SectionDivider: tiny tracked uppercase title running into a hairline. */
const SectionLabel = ({ children }) => (
  <div className="flex items-center gap-3 pb-1 pt-7">
    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-muted">
      {children}
    </span>
    <span className="h-px flex-1 bg-app-line" />
  </div>
);

/* One spec line: tracked uppercase label left, bold value right. Hidden when
 * the value is empty so the list stays tight. */
const SpecRow = ({ label, value }) =>
  value == null || value === "" ? null : (
    <div className="flex items-baseline justify-between gap-4 py-[9px]">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-app-muted">
        {label}
      </span>
      <span className="min-w-0 text-right text-[13.5px] font-semibold leading-snug text-app-ink">
        {value}
      </span>
    </div>
  );

const BLANK = "-";

const StoneDetail = () => {
  const { sku } = useParams();
  const navigate = useNavigate();
  const routerState = useLocation().state;
  const [stone, setStone] = useState(routerState?.stone || null);
  const [loading, setLoading] = useState(!routerState?.stone);
  const [error, setError] = useState("");
  const [liked, setLiked] = useState(false);

  // Deep-link fallback — no stone in router state, find it by SKU.
  useEffect(() => {
    if (stone) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchSoapStones(undefined, { assignedTo: "all" });
        const rows = Array.isArray(data?.stones) ? data.stones : Array.isArray(data) ? data : [];
        const found = rows.find((s) => norm(s.sku) === norm(sku));
        if (!cancelled) {
          // Stones opened from the catalog arrive pre-adjusted via router
          // state; deep links fetch raw rows, so apply the same price policy.
          if (found) setStone(adjustSalesPrices(found));
          else setError("Stone not found");
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load stone");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stone, sku]);

  // ---- Media carousel ------------------------------------------------------
  const images = useMemo(() => (stone ? stoneImages(stone) : []), [stone]);
  // Folder-only video URLs are as common as folder-only images — same filter.
  const video = stone ? usableImg(stone.videoUrl) : null;
  const slideCount = images.length + (video ? 1 : 0);
  const [slide, setSlide] = useState(0);
  const trackRef = useRef(null);
  const onTrackScroll = () => {
    const el = trackRef.current;
    if (!el || !el.clientWidth) return;
    setSlide(Math.round(el.scrollLeft / el.clientWidth));
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[680px]">
        <div className="aspect-square w-full skeleton" />
        <div className="space-y-3 px-5 py-6">
          <div className="h-6 w-3/4 rounded skeleton" />
          <div className="h-3.5 w-1/2 rounded skeleton" />
          <div className="h-44 w-full rounded-2xl skeleton" />
        </div>
      </div>
    );
  }

  if (error || !stone) {
    return (
      <div className="mx-auto w-full max-w-[680px] px-4 py-10 text-center">
        <p className="text-[14px] font-medium text-app-ink">{error || "Stone not found"}</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-4 rounded-xl border border-app-line bg-app-surface px-5 py-2 text-sm font-semibold text-app-ink"
        >
          Back
        </button>
      </div>
    );
  }

  const mapped = getMappedCategories(stone.category);
  const isDiamond = mapped.includes("Diamond") || mapped.includes("Fancy");
  const isFancy = mapped.includes("Fancy");

  const wt = stone.weightCt != null && stone.weightCt !== "" ? Number(stone.weightCt).toFixed(2) : "";
  const shape = getDisplayShape(stone.shape);
  const lab = stone.lab && String(stone.lab).toUpperCase() !== "N/A" ? stone.lab : "";
  const treatment = stone.treatment ? shortTreatment(stone.treatment) : "";
  const fancyDesc = [stone.fancyIntensity, stone.fancyColor].filter(Boolean).join(" ");

  // "5.05 Cushion Fancy Intense Green Yellow GIA" (fancy)
  // "0.51 Round H SI1 None IGI" (white) / "1.16 Pear ICA Minor" (colored)
  const title = isDiamond
    ? [wt, shape, isFancy ? fancyDesc : stone.color, isFancy ? "" : stone.clarity, lab]
        .filter(Boolean)
        .join(" ")
    : [wt, shape, lab, treatment].filter(Boolean).join(" ");

  const holder = stone.holder && String(stone.holder).trim() ? String(stone.holder).trim() : null;
  const { label: locationLabel, memo: memoOut } = resolveLocation(stone);

  const [len, wid, dep] = parseDims(stone.measurements);
  const lwd = [len, wid, dep].every((n) => Number.isFinite(n))
    ? `${len.toFixed(2)}-${wid.toFixed(2)}-${dep.toFixed(2)}`
    : String(stone.measurements || "").trim();
  let ratio = parseFloat(stone.ratio);
  if (!Number.isFinite(ratio) && Number.isFinite(len) && Number.isFinite(wid) && wid) {
    ratio = len / wid;
  }
  const pct = (n) => (Number.isFinite(Number(n)) && Number(n) !== 0 ? `${Number(n).toFixed(1)}%` : "");

  const cert = certLink(stone);
  const ppc = money(stone.pricePerCt);
  const total = money(stone.priceTotal);

  // Spec groups — same fields, same order as the legacy diamond card.
  const stoneSpecs = isDiamond
    ? [
        ["Carat Weight", wt],
        ["Color", isFancy ? stone.fancyColor || BLANK : stone.color || BLANK],
        ["Shape", shape || BLANK],
        ...(isFancy ? [["Intensity", stone.fancyIntensity || BLANK]] : []),
        ["Clarity", stone.clarity || BLANK],
        ["Cut", stone.cut || BLANK],
        ["Polish", stone.polish || BLANK],
        ["Sym.", stone.symmetry || BLANK],
        ["Fluorescence", fluorDisplay(stone.fluorescence) || BLANK],
      ]
    : [
        ["Carat Weight", wt],
        ["Color", getDisplayColor(stone) || BLANK],
        ["Shape", shape || BLANK],
        ["Comments", treatment || BLANK],
        ["Origin", stone.origin && String(stone.origin).toUpperCase() !== "N/A" ? stone.origin : BLANK],
      ];

  const paperSpecs = [
    ["SKU", stone.sku || BLANK],
    ["L/W/D (mm)", lwd || BLANK],
    ["L/W Ratio", Number.isFinite(ratio) ? ratio.toFixed(2) : BLANK],
    ...(isDiamond
      ? [
          ["Depth %", pct(stone.depthPercent) || BLANK],
          ["Table %", pct(stone.tablePercent) || BLANK],
        ]
      : []),
    ["Certificate", lab || BLANK],
    ["Cert. Num.", stone.certificateNumber || BLANK],
    ["Location", locationLabel || BLANK],
  ];

  return (
    <div className="mx-auto w-full max-w-[680px]">
      {/* ---- Media ---------------------------------------------------------- */}
      <div className="relative">
        {/* Floating frosted controls over the media. */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="absolute left-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-app-surface/85 text-app-ink shadow-[0_2px_12px_-2px_rgba(0,0,0,0.25)] backdrop-blur-md transition active:scale-95"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setLiked((v) => !v)}
          aria-label="Favorite"
          aria-pressed={liked}
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-app-surface/85 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.25)] backdrop-blur-md transition active:scale-95"
        >
          <svg
            className={`h-5 w-5 transition-colors ${liked ? "text-emerald-500" : "text-app-graphite"}`}
            fill={liked ? "currentColor" : "none"}
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </button>

        {/* Swipeable track — photos first, the video as the last slide. */}
        {slideCount > 0 ? (
          <div
            ref={trackRef}
            onScroll={onTrackScroll}
            className="scrollbar-hide flex snap-x snap-mandatory overflow-x-auto bg-app-canvas2"
          >
            {images.map((src) => (
              <div key={src} className="aspect-square w-full shrink-0 snap-center">
                <img src={src} alt={title || stone.sku} className="h-full w-full object-cover" />
              </div>
            ))}
            {video && (
              <div key="video" className="aspect-square w-full shrink-0 snap-center bg-black">
                <iframe
                  src={video}
                  title={`${stone.sku} video`}
                  className="h-full w-full"
                  frameBorder="0"
                  allow="autoplay; fullscreen"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        ) : (
          <div className="aspect-square w-full">
            <StonePlaceholder alt={stone.sku} />
          </div>
        )}

        {/* Slide dots — lifted above the sheet overlap; the video slide gets a
            play glyph instead of a dot. */}
        {slideCount > 1 && (
          <div className="absolute bottom-10 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1.5 backdrop-blur-sm">
            {Array.from({ length: slideCount }).map((_, i) => {
              const isVideoDot = video && i === slideCount - 1;
              const active = slide === i;
              return isVideoDot ? (
                <svg
                  key={i}
                  className={`h-3 w-3 ${active ? "text-white" : "text-white/55"}`}
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M8 5.5v13l11-6.5-11-6.5z" />
                </svg>
              ) : (
                <span
                  key={i}
                  className={`rounded-full transition-all ${
                    active ? "h-2 w-2 bg-white" : "h-1.5 w-1.5 bg-white/55"
                  }`}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ---- Content sheet — rides up over the media like our bottom sheets. */}
      <div className="relative z-10 -mt-6 rounded-t-3xl border-t border-app-line bg-app-canvas px-5 pb-4 pt-5">
        {/* Title row, with the cert action snugged to the right. */}
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-[21px] font-semibold leading-snug tracking-tight text-app-ink">
            {title || stone.sku}
          </h1>
          {(cert || hasCert(stone)) &&
            (cert ? (
              <a
                href={cert}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[12px] font-semibold text-emerald-600 transition active:scale-95"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Certificate
              </a>
            ) : (
              <span className="mt-0.5 flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5 text-[12px] font-semibold text-emerald-600/80">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Certified
              </span>
            ))}
        </div>

        {/* Status flags */}
        {(holder || memoOut) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {holder && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600/10 px-3 py-1 text-[11.5px] font-bold uppercase tracking-wide text-red-600 ring-1 ring-inset ring-red-600/25">
                <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                HOLD · {holder}
              </span>
            )}
            {memoOut && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-[11.5px] font-bold uppercase tracking-wide text-amber-600 ring-1 ring-inset ring-amber-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Memo out
              </span>
            )}
          </div>
        )}

        {/* Spec sheet — airy hairline rows under tracked section labels,
            same fields and order as before. */}
        <SectionLabel>The stone</SectionLabel>
        <div className="divide-y divide-app-line/60">
          {stoneSpecs.map(([label, value]) => (
            <SpecRow key={label} label={label} value={value} />
          ))}
        </div>

        <SectionLabel>Certificate &amp; location</SectionLabel>
        <div className="divide-y divide-app-line/60">
          {paperSpecs.map(([label, value]) => (
            <SpecRow key={label} label={label} value={value} />
          ))}
        </div>

        {/* Price panel — dark ink block, echoing the primary action buttons. */}
        {(ppc || total || (isDiamond && stone.rapPrice)) && (
          <div className="mt-7 overflow-hidden rounded-2xl bg-app-ink text-app-canvas">
            <div className="divide-y divide-white/10 px-5 tabular-nums">
              {ppc && (
                <div className="flex items-baseline justify-between py-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] opacity-60">
                    PPC
                  </span>
                  <span className="text-[14.5px] font-semibold">{ppc}</span>
                </div>
              )}
              {isDiamond && stone.rapPrice != null && stone.rapPrice !== "" && (
                <div className="flex items-baseline justify-between py-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] opacity-60">
                    RAP
                  </span>
                  <span className="text-[14.5px] font-semibold">{stone.rapPrice}%</span>
                </div>
              )}
              {total && (
                <div className="flex items-baseline justify-between py-3.5">
                  <span className="text-[12px] font-bold uppercase tracking-[0.1em] opacity-80">
                    Price
                  </span>
                  <span className="text-[22px] font-bold tracking-tight">{total}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SKU footer */}
        <p className="mt-4 text-center text-[12px] uppercase tracking-[0.14em] text-app-soft">
          SKU <span className="font-bold text-app-muted">{stone.sku}</span>
        </p>
      </div>
    </div>
  );
};

export default StoneDetail;
