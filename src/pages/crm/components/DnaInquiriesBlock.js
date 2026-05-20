import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  extractDnaInquiries,
  hasDnaInquiries,
  relativeTime,
  summariseSnapshot,
} from "../utils/dnaInquiries";

const PLACEHOLDER_THUMB = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-1/2 h-1/2 text-emerald-700/60">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 2a1 1 0 011 1c0 2.5 2 4.5 4 4.5s4-2 4-4.5a1 1 0 112 0c0 3-1.74 5.36-4 6.27v.96c2.26.91 4 3.27 4 6.27a1 1 0 11-2 0c0-2.5-2-4.5-4-4.5s-4 2-4 4.5a1 1 0 11-2 0c0-3 1.74-5.36 4-6.27v-.96C5.74 8.36 4 6 4 3a1 1 0 011-1z" />
  </svg>
);

/**
 * "Interested In" block rendered on a contact page. Reads everything from
 * the contact object alone (interactions + deals are embedded in the
 * fetchContact() response), so the parent only has to pass the contact in.
 *
 * Two visual variants:
 *   - "compact" (ContactDrawer side panel) — 56px thumbnails, dense layout
 *   - "full"    (CustomerProfile main column) — 96px thumbnails, more air,
 *                full message visible, "Open deal" button
 *
 * The component returns null for contacts with zero DNA signal so it can
 * be mounted unconditionally at the top of the Info tab.
 */
export default function DnaInquiriesBlock({ contact, variant = "compact", className = "" }) {
  const inquiries = useMemo(() => extractDnaInquiries(contact), [contact]);
  const [showAll, setShowAll] = useState(false);

  if (!contact || !hasDnaInquiries(contact)) return null;
  if (inquiries.length === 0) return null;

  const isFull = variant === "full";
  const collapsedLimit = isFull ? 3 : 2;
  const visible = showAll ? inquiries : inquiries.slice(0, collapsedLimit);
  const hiddenCount = inquiries.length - visible.length;

  return (
    <section
      className={`rounded-xl border border-emerald-200/70 bg-gradient-to-b from-emerald-50/70 to-white ${
        isFull ? "p-4 sm:p-5" : "p-3"
      } ${className}`}
      aria-label="DNA inquiries"
    >
      <header className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-emerald-600 text-white">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
              <path fillRule="evenodd" d="M5 2a1 1 0 011 1c0 2.5 2 4.5 4 4.5s4-2 4-4.5a1 1 0 112 0c0 3-1.74 5.36-4 6.27v.96c2.26.91 4 3.27 4 6.27a1 1 0 11-2 0c0-2.5-2-4.5-4-4.5s-4 2-4 4.5a1 1 0 11-2 0c0-3 1.74-5.36 4-6.27v-.96C5.74 8.36 4 6 4 3a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </span>
          <div className="min-w-0">
            <h3 className={`font-semibold text-emerald-900 truncate ${isFull ? "text-base" : "text-sm"}`}>
              Interested in
            </h3>
            <p className={`text-emerald-700/80 ${isFull ? "text-xs" : "text-[11px]"}`}>
              {inquiries.length === 1
                ? "1 stone from the DNA page"
                : `${inquiries.length} stones from the DNA page`}
            </p>
          </div>
        </div>
      </header>

      <ol className={isFull ? "space-y-3" : "space-y-2"}>
        {visible.map((row) => (
          <InquiryCard key={row.sku} row={row} isFull={isFull} />
        ))}
      </ol>

      {hiddenCount > 0 && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 w-full text-center text-xs font-medium text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100/60 rounded-lg py-1.5"
        >
          Show {hiddenCount} more
        </button>
      )}
      {showAll && inquiries.length > collapsedLimit && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="mt-3 w-full text-center text-xs font-medium text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg py-1.5"
        >
          Show less
        </button>
      )}
    </section>
  );
}

function InquiryCard({ row, isFull }) {
  const spec = summariseSnapshot(row.snapshot);
  const img = row.snapshot?.image || row.snapshot?.imageUrl || row.snapshot?.picture;
  const thumbSize = isFull ? "w-24 h-24" : "w-14 h-14";

  const copyDnaLink = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}${row.stoneUrl}`;
    navigator.clipboard?.writeText(url).then(
      () => toast.success("DNA link copied", { duration: 1500 }),
      () => toast.error("Couldn't copy link")
    );
  };

  return (
    <li className="rounded-lg bg-white border border-emerald-100 overflow-hidden">
      <div className={`flex gap-3 ${isFull ? "p-3" : "p-2"}`}>
        {/* Stone thumbnail. Real product photography sits on a transparent /
            white background, so a tinted card behind it reads as colour
            wash rather than a hard frame. */}
        <Link
          to={row.stoneUrl}
          target="_blank"
          rel="noreferrer"
          className={`${thumbSize} shrink-0 rounded-lg bg-stone-50 border border-stone-200 flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-emerald-400 transition`}
          aria-label={`Open DNA page for ${row.sku}`}
        >
          {img ? (
            <img
              src={img}
              alt={row.sku}
              loading="lazy"
              className="w-full h-full object-contain"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            PLACEHOLDER_THUMB
          )}
        </Link>

        <div className="min-w-0 flex-1">
          {/* Headline row: SKU + repeat-inquiry badge + relative time */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={row.stoneUrl}
              target="_blank"
              rel="noreferrer"
              className={`font-semibold text-stone-900 hover:text-emerald-700 truncate ${
                isFull ? "text-base" : "text-sm"
              }`}
            >
              {row.sku}
            </Link>
            {row.inquiryCount > 1 && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-200"
                title={`Clicked Interested ${row.inquiryCount} times`}
              >
                ×{row.inquiryCount}
              </span>
            )}
            <span className="text-[11px] text-stone-500 ml-auto shrink-0">
              {relativeTime(row.latestAt)}
            </span>
          </div>

          {spec && (
            <div className={`text-stone-600 ${isFull ? "text-sm" : "text-xs"} truncate`}>
              {spec}
            </div>
          )}

          {row.inquiryCount > 1 && (
            <div className="text-[11px] text-stone-500 mt-0.5">
              First clicked {relativeTime(row.firstAt)}
            </div>
          )}

          {/* Visitor's message — the single highest-signal field for a
              sales call. Truncate in compact mode; show in full in profile. */}
          {row.latestMessage && (
            <blockquote
              className={`mt-2 pl-2 border-l-2 border-emerald-300 italic text-stone-700 ${
                isFull ? "text-sm whitespace-pre-line" : "text-xs line-clamp-3"
              }`}
            >
              “{row.latestMessage}”
            </blockquote>
          )}

          {/* Actions */}
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <Link
              to={row.stoneUrl}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center gap-1 rounded-md font-medium bg-emerald-600 text-white hover:bg-emerald-700 ${
                isFull ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]"
              }`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
              View DNA
            </Link>
            <button
              type="button"
              onClick={copyDnaLink}
              className={`inline-flex items-center gap-1 rounded-md font-medium bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50 ${
                isFull ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]"
              }`}
              title="Copy public DNA link"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy link
            </button>
            {isFull && row.latestDealId != null && (
              <Link
                to={`/crm/deals?open=${row.latestDealId}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-white text-stone-700 border border-stone-300 hover:bg-stone-50"
              >
                Open deal
              </Link>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
