import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  buildStoneShareText,
  shareStonesOnWhatsApp,
  prepareShareFiles,
  canShareFiles,
} from "../../utils/shareStones";
import { fetchJewelryCatalog } from "../../services/jewelryApi";
import { getDisplayShape } from "../inventory/helpers/constants";
import { norm, money, usableImg, enhanceVimeoUrl, StonePlaceholder, prettyBranch } from "./SalesInventory";
import { mapRow as mapJewelryRow } from "./SalesJewelry";
import { useTeam } from "../../context/TeamContext";
import { useSelection } from "../../context/SelectionContext";
import { trackStoneView, trackStoneDwell, trackPriceView } from "../../utils/activityLog";

/* ============================================================================
 * JewelryDetail — the per-piece product page behind the sales jewelry cards.
 *
 * Deliberately shares StoneDetail's visual language so the whole sales
 * inventory (diamonds / emeralds / gemstones / jewelry) feels identical: an
 * edge-to-edge media carousel with frosted floating controls, a rounded
 * content sheet that rides up over the photo, hairline section labels, a dark
 * ink price panel, and the same Action / Share-to-WhatsApp bottom sheet.
 *
 * Items arrive via router state when opened from the catalog grid (no extra
 * fetch). Deep links (/sales/jewelry/:sku) fall back to fetching the catalog
 * and locating the SKU.
 * ========================================================================== */

const itemImages = (item) => {
  const urls = Array.isArray(item.images)
    ? item.images
    : [item.image, ...String(item.additionalPictures || "").split(";")];
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

const certLink = (item) => usableImg(item.certificateUrl) || null;

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

const JewelryDetail = () => {
  const { sku } = useParams();
  const navigate = useNavigate();
  const { actor } = useTeam();
  const routerState = useLocation().state;
  const [item, setItem] = useState(routerState?.item || null);
  const [loading, setLoading] = useState(!routerState?.item);
  const [error, setError] = useState("");
  // The top-right star adds/removes this piece from the shared selection —
  // same behaviour as the catalog card's star and the other product pages.
  const { isSelected, toggle } = useSelection();
  const [actionOpen, setActionOpen] = useState(false);
  const [shareFiles, setShareFiles] = useState([]);
  const [withPrice, setWithPrice] = useState(true);

  // Always open the product page scrolled to the top. On mobile the document is
  // locked and the real scroll lives in an inner <main> container, so
  // window.scrollTo is a no-op there — reset that container too.
  useLayoutEffect(() => {
    const main = document.querySelector("main");
    if (main) main.scrollTop = 0;
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [sku]);

  // Deep-link fallback — no item in router state, find it by SKU.
  useEffect(() => {
    if (item) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await fetchJewelryCatalog(actor);
        const rows = (data?.jewelry || []).map(mapJewelryRow);
        const found = rows.find((r) => norm(r.sku) === norm(sku));
        if (!cancelled) {
          if (found) setItem(found);
          else setError("Item not found");
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load item");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item, sku, actor?.id]);

  // Record the jewelry view for the manager's Team activity feed, plus a
  // price view when the piece carries a price.
  useEffect(() => {
    if (!item?.sku) return;
    trackStoneView(item.sku, "Jewelry");
    if (item.price != null && item.price !== "") {
      trackPriceView(item.sku, "price", "Jewelry");
    }
  }, [item?.sku]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dwell time — captured on unmount / SKU change.
  useEffect(() => {
    if (!item?.sku) return undefined;
    const sku = item.sku;
    const startedAt = Date.now();
    return () => trackStoneDwell(sku, Date.now() - startedAt, "Jewelry");
  }, [item?.sku]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fetch photo + certificate when the action sheet opens (keeps iOS
  // user-activation intact for the share gesture).
  useEffect(() => {
    if (!actionOpen || !item) {
      setShareFiles([]);
      return;
    }
    let alive = true;
    prepareShareFiles(item).then((files) => {
      if (alive) setShareFiles(files);
    });
    return () => {
      alive = false;
    };
  }, [actionOpen, item]);

  const images = useMemo(() => (item ? itemImages(item) : []), [item]);
  const video = item ? usableImg(item.videoUrl) : null;
  const slideCount = images.length + (video ? 1 : 0);
  const [slide, setSlide] = useState(0);
  const trackRef = useRef(null);
  const onTrackScroll = () => {
    const el = trackRef.current;
    if (!el || !el.clientWidth) return;
    setSlide(Math.round(el.scrollLeft / el.clientWidth));
  };
  const scrollToSlide = (index) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: el.clientWidth * index, behavior: "smooth" });
  };
  const scrollToVideo = () => scrollToSlide(images.length);

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

  if (error || !item) {
    return (
      <div className="mx-auto w-full max-w-[680px] px-4 py-10 text-center">
        <p className="text-[14px] font-medium text-app-ink">{error || "Item not found"}</p>
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

  const title = item.name || item.sku;
  const shape = item.shape ? getDisplayShape(item.shape) : "";
  const centerCt = Number.isFinite(item.centerCarat) ? `${item.centerCarat.toFixed(2)} ct` : "";
  const totalWt = Number.isFinite(item.jewelryWeight)
    ? `${parseFloat(item.jewelryWeight.toFixed(2))} g`
    : "";
  const totalCt = Number.isFinite(item.totalCarat) ? `${item.totalCarat.toFixed(2)} ct` : "";
  const cert = certLink(item);
  const total = money(item.price);

  // Exact physical place (e.g. "Eiseman Jewels - JN") comes from the linked
  // centre stone and is only present for viewers entitled to it; lower tiers
  // get just the branch. Fall back to the branch when no exact place is shared.
  const exactLoc = item.exactLocation && String(item.exactLocation).trim()
    ? String(item.exactLocation).trim()
    : "";
  const branchLabel = item.branch ? prettyBranch(item.branch) : "";

  // Flat spec list (no section dividers) — matches the diamond / emerald /
  // gemstone product pages.
  const specs = [
    ["SKU", item.sku || BLANK],
    ["Gem type", item.stoneType || BLANK],
    ["Center stone weight", centerCt || BLANK],
    ["Total carat", totalCt || BLANK],
    ["Total weight", totalWt || BLANK],
    ["Center stone shape", shape || BLANK],
    ["Style", item.style || BLANK],
    ["Metal", item.metal || BLANK],
    ["Branch", branchLabel || BLANK],
    ["Location", exactLoc || branchLabel || BLANK],
  ];

  return (
    <div className="mx-auto w-full max-w-[680px]">
      {/* ---- Media ---------------------------------------------------------- */}
      <div className="relative">
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
          onClick={() => toggle(item)}
          aria-label={isSelected(item) ? "Remove from selection" : "Add to selection"}
          aria-pressed={isSelected(item)}
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-app-surface/85 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.25)] backdrop-blur-md transition active:scale-95"
        >
          <svg
            className={`h-5 w-5 transition-colors ${isSelected(item) ? "text-emerald-500" : "text-app-graphite"}`}
            fill={isSelected(item) ? "currentColor" : "none"}
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 2.5l2.93 5.94 6.57.96-4.75 4.63 1.12 6.54L12 18.98l-5.87 3.09 1.12-6.54L2.5 9.9l6.57-.96L12 2.5z"
            />
          </svg>
        </button>

        {slideCount > 0 ? (
          <div
            ref={trackRef}
            onScroll={onTrackScroll}
            className="scrollbar-hide flex snap-x snap-mandatory overflow-x-auto bg-app-canvas2"
          >
            {images.map((src) => (
              <div key={src} className="aspect-square w-full shrink-0 snap-center">
                <img src={src} alt={title} className="h-full w-full object-cover" />
              </div>
            ))}
            {video && (
              <div key="video" className="aspect-square w-full shrink-0 snap-center bg-black">
                <iframe
                  src={enhanceVimeoUrl(video)}
                  title={`${item.sku} video`}
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
            <StonePlaceholder alt={item.sku} />
          </div>
        )}

        {/* Prev / next arrows — sit above the media (z-10) so they keep working
            even on the interactive 360° video slide, whose iframe swallows
            swipe gestures and otherwise traps the user on the last slide. */}
        {slideCount > 1 && slide > 0 && (
          <button
            type="button"
            onClick={() => scrollToSlide(slide - 1)}
            aria-label="Previous"
            className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-app-surface/85 text-app-ink shadow-[0_2px_12px_-2px_rgba(0,0,0,0.25)] backdrop-blur-md transition active:scale-95"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {slideCount > 1 && slide < slideCount - 1 && (
          <button
            type="button"
            onClick={() => scrollToSlide(slide + 1)}
            aria-label="Next"
            className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-app-surface/85 text-app-ink shadow-[0_2px_12px_-2px_rgba(0,0,0,0.25)] backdrop-blur-md transition active:scale-95"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

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

      {/* ---- Content sheet -------------------------------------------------- */}
      {/* The sheet normally overlaps the media by 24px for the rounded look, but
          on the video slide that overlap hides the player's controls (play /
          progress bar), so drop the overlap there to free up room. */}
      <div className={`relative z-10 rounded-t-3xl border-t border-app-line bg-app-canvas px-5 pb-4 pt-5 ${
        video && slide >= slideCount - 1 ? "mt-0" : "-mt-6"
      }`}>
        {/* Title — stands on its own line. */}
        <h1 className="text-[21px] font-semibold leading-snug tracking-tight text-app-ink">
          {title}
        </h1>

        {/* Tags row — all chips together under the title (same as the other
            product pages): Memo out status plus the Certificate / Video quick
            actions. These appear here only, not on the catalog card. */}
        {(item.onMemo || cert || video) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {item.onMemo && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 ring-1 ring-inset ring-amber-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Memo out
              </span>
            )}
            {cert && (
              <a
                href={cert}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 transition active:scale-95"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Certificate
              </a>
            )}
            {video && (
              <button
                type="button"
                onClick={scrollToVideo}
                aria-label="Play video"
                className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-600 transition active:scale-95"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5.5v13l11-6.5-11-6.5z" />
                </svg>
                Video
              </button>
            )}
          </div>
        )}

        <div className="mt-5 divide-y divide-app-line/60">
          {specs.map(([label, value]) => (
            <SpecRow key={label} label={label} value={value} />
          ))}
        </div>

        {total && (
          <div className="mt-7 overflow-hidden rounded-2xl bg-app-ink text-app-canvas">
            <div className="divide-y divide-white/10 px-5 tabular-nums">
              <div className="flex items-baseline justify-between py-3.5">
                <span className="text-[12px] font-bold uppercase tracking-[0.1em] opacity-80">
                  Price
                </span>
                <span className="text-[22px] font-bold tracking-tight">{total}</span>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setActionOpen(true)}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-app-ink py-3.5 text-[14px] font-semibold text-app-canvas transition active:scale-[0.99]"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 5v.01M12 12v.01M12 19v.01" />
          </svg>
          Action
        </button>

        <p className="mt-4 text-center text-[12px] uppercase tracking-[0.14em] text-app-soft">
          SKU <span className="font-bold text-app-muted">{item.sku}</span>
        </p>
      </div>

      {/* Action sheet */}
      <AnimatePresence>
        {actionOpen && (
          <div className="fixed inset-0 z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setActionOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="absolute inset-x-0 bottom-0 flex max-h-[80vh] flex-col rounded-t-3xl border-t border-app-line bg-app-surface"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
              role="dialog"
              aria-label="Jewelry actions"
            >
              <div className="flex justify-center pt-3" aria-hidden>
                <span className="h-1.5 w-10 rounded-full bg-app-line" />
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <h2 className="text-[16px] font-semibold tracking-tight text-app-ink">Action</h2>
                <button
                  type="button"
                  onClick={() => setActionOpen(false)}
                  aria-label="Close"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-app-soft transition hover:bg-app-canvas2 hover:text-app-ink"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <div className="px-5 pb-2">
                {/* Include price toggle — flips whether the total price appears
                    in the WhatsApp message (and the preview below). */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={withPrice}
                  onClick={() => setWithPrice((v) => !v)}
                  className="mb-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-app-line bg-app-canvas2 px-4 py-3 text-left transition active:scale-[0.99]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold tracking-tight text-app-ink">Include price</span>
                    <span className="block text-[12px] text-app-soft">
                      {withPrice ? "Message will show the total price" : "Price hidden from the message"}
                    </span>
                  </span>
                  <span
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                      withPrice ? "bg-emerald-500" : "bg-app-line"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        withPrice ? "translate-x-[22px]" : "translate-x-0.5"
                      }`}
                    />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    shareStonesOnWhatsApp(item, { files: shareFiles, actor, withPrice });
                    setActionOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-app-line bg-app-canvas2 px-4 py-3.5 text-left transition active:scale-[0.99]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.8 14.13c-.24.68-1.42 1.32-1.96 1.36-.5.05-.96.23-3.23-.67-2.72-1.07-4.45-3.85-4.59-4.03-.13-.18-1.1-1.46-1.1-2.79 0-1.32.7-1.97.94-2.24.25-.27.54-.34.72-.34l.52.01c.17.01.4-.06.62.47.24.57.81 1.97.88 2.11.07.14.12.31.02.49-.09.18-.14.29-.27.45-.14.16-.29.36-.41.48-.14.14-.28.29-.12.56.16.27.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.21 1.37.27.14.43.12.59-.07.16-.18.68-.79.86-1.06.18-.27.36-.22.61-.13.25.09 1.6.75 1.87.89.27.14.45.2.52.32.07.11.07.66-.17 1.34z" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold tracking-tight text-app-ink">Share on WhatsApp</span>
                    <span className="block text-[12px] text-app-soft">
                      {canShareFiles(shareFiles)
                        ? `Details + ${shareFiles.length} attachment${shareFiles.length > 1 ? "s" : ""}`
                        : "Send this piece's details"}
                    </span>
                  </span>
                  <svg className="h-4 w-4 text-app-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <div className="mb-1 mt-4 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-app-muted">Preview</p>
                  {canShareFiles(shareFiles) && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 5h16v14H4z M4 15l4-4 4 4 4-4 4 4" />
                      </svg>
                      Photo &amp; certificate attached
                    </span>
                  )}
                </div>
                <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl border border-app-line bg-app-canvas2 px-3 py-2.5 text-[12px] leading-relaxed text-app-graphite">
                  {buildStoneShareText(item, { withPrice })}
                </pre>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default JewelryDetail;
