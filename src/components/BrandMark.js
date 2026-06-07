import React from "react";

/**
 * BrandMark — the GEMS DNA emerald brilliant-cut logo mark.
 *
 * A faceted emerald gem (echoing the green SpinningGem loader) sitting on a
 * theme-aware tile. The gem's facet fills are fixed emerald gradients — they
 * read clearly on both light and dark backgrounds — while the tile, ring and
 * glow use the `app-*` design tokens so the container flips automatically
 * with the user's `data-theme` (light / dark).
 *
 * Drop-in replacement for the legacy white-on-ink DiamondIcon used in the
 * marketing header and the sidebar.
 *
 * Props:
 *   size       - tile size in px (default 32)
 *   className  - extra classes merged onto the wrapper
 *   spin       - when true the gem rotates (used for hover / loading accents)
 */
export default function BrandMark({ size = 32, className = "", spin = false }) {
  const gem = Math.round(size * 0.66);
  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-[10px] bg-app-canvas-2 ring-1 ring-app-line shadow-[0_4px_12px_-4px_rgba(0,0,0,0.28)] shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* Soft emerald halo behind the gem — gives the mark presence on both
          the light grey and dark ink tiles. */}
      <span
        className="absolute inset-0 rounded-[10px] pointer-events-none"
        style={{
          background:
            "radial-gradient(58% 58% at 50% 42%, rgba(16,185,129,0.30), transparent 72%)",
        }}
      />

      <svg
        width={gem}
        height={gem}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`relative ${spin ? "brandmark-spin" : ""}`}
        style={{ transformOrigin: "center" }}
      >
        <defs>
          <linearGradient id="bm-crown-bright" x1="16" y1="6" x2="16" y2="13" gradientUnits="userSpaceOnUse">
            <stop stopColor="#A7F3D0" />
            <stop offset="1" stopColor="#34D399" />
          </linearGradient>
          <linearGradient id="bm-crown-side" x1="16" y1="6" x2="16" y2="13" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6EE7B7" />
            <stop offset="1" stopColor="#10B981" />
          </linearGradient>
          <linearGradient id="bm-crown-bezel" x1="16" y1="6" x2="16" y2="13" gradientUnits="userSpaceOnUse">
            <stop stopColor="#34D399" />
            <stop offset="1" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="bm-pav-inner" x1="16" y1="13" x2="16" y2="28.5" gradientUnits="userSpaceOnUse">
            <stop stopColor="#10B981" />
            <stop offset="1" stopColor="#047857" />
          </linearGradient>
          <linearGradient id="bm-pav-outer" x1="16" y1="13" x2="16" y2="28.5" gradientUnits="userSpaceOnUse">
            <stop stopColor="#059669" />
            <stop offset="1" stopColor="#064E3B" />
          </linearGradient>
        </defs>

        {/* Facets share a thin dark-emerald edge so the cut stays legible on
            a light tile; the outline below adds a brighter rim for dark mode. */}
        <g stroke="#064E3B" strokeOpacity="0.4" strokeWidth="0.5" strokeLinejoin="round">
          {/* Crown */}
          <path d="M11 6 L3.5 13 L11 13 Z" fill="url(#bm-crown-bezel)" />
          <path d="M21 6 L28.5 13 L21 13 Z" fill="url(#bm-crown-bezel)" />
          <path d="M11 6 L11 13 L16 13 Z" fill="url(#bm-crown-side)" />
          <path d="M21 6 L16 13 L21 13 Z" fill="url(#bm-crown-side)" />
          <path d="M11 6 L21 6 L16 13 Z" fill="url(#bm-crown-bright)" />
          {/* Pavilion */}
          <path d="M3.5 13 L11 13 L16 28.5 Z" fill="url(#bm-pav-outer)" />
          <path d="M11 13 L16 13 L16 28.5 Z" fill="url(#bm-pav-inner)" />
          <path d="M16 13 L21 13 L16 28.5 Z" fill="url(#bm-pav-inner)" />
          <path d="M21 13 L28.5 13 L16 28.5 Z" fill="url(#bm-pav-outer)" />
        </g>

        {/* Bright outer rim — keeps the silhouette crisp on a dark tile. */}
        <path
          d="M11 6 L21 6 L28.5 13 L16 28.5 L3.5 13 Z"
          stroke="#34D399"
          strokeOpacity="0.85"
          strokeWidth="0.9"
          strokeLinejoin="round"
        />

        {/* Table sparkle highlight. */}
        <path d="M12.6 6.7 L19.4 6.7 L16 11 Z" fill="#FFFFFF" fillOpacity="0.28" />
      </svg>

      <span className="absolute inset-0 rounded-[10px] ring-1 ring-inset ring-white/10 pointer-events-none" />
    </span>
  );
}
