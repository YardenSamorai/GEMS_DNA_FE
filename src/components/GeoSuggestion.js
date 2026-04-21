import React from "react";
import { flagEmoji } from "../utils/geoDetect";

/**
 * Inline "We think this is United Kingdom — apply?" bar.
 *
 * Designed to sit just below the country/city fields in any contact form.
 * Renders nothing when there's no suggestion, so callers can drop it in
 * unconditionally and let the hook decide visibility.
 *
 * Props:
 *   - suggestion : object from useGeoSuggestion (or null)
 *   - onApply    : (suggestion) => void  — called when user accepts
 *   - onDismiss  : () => void            — called when user clicks X
 *   - compact    : boolean               — smaller styling for tight UIs
 */
export default function GeoSuggestion({ suggestion, onApply, onDismiss, compact = false }) {
  if (!suggestion || !suggestion.country) return null;

  const sourceLabel = {
    phone: "from phone code",
    mapbox: "from city",
    email: "from email domain",
  }[suggestion.source] || "auto-detected";

  return (
    <div
      className={
        "flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 text-amber-900 " +
        (compact ? "px-2 py-1 text-[11px]" : "px-3 py-2 text-xs")
      }
    >
      <span className="text-base leading-none">{flagEmoji(suggestion.countryCode) || "🌍"}</span>
      <span className="flex-1 min-w-0 truncate">
        <span className="font-medium">We think this is {suggestion.country}</span>
        <span className="text-amber-700/70 ml-1">· {sourceLabel}</span>
      </span>
      <button
        type="button"
        onClick={() => onApply?.(suggestion)}
        className={
          "shrink-0 rounded font-semibold bg-amber-900 text-white hover:bg-amber-800 transition " +
          (compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]")
        }
      >
        Apply
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-amber-700/60 hover:text-amber-900"
        aria-label="Dismiss"
        title="Dismiss"
      >
        <svg className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
