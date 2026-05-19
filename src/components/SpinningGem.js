import React from "react";

/**
 * SpinningGem — faceted diamond that spins continuously on the Y axis.
 *
 * Built from three identical SVG faces stacked at 0/60/120 deg inside a
 * `transform-style: preserve-3d` stage, so from any viewing angle at
 * least one face is roughly perpendicular to the viewer. That blend of
 * planes reads as a real spinning crystal without pulling in three.js
 * or any 3D library. A brand-emerald halo pulses underneath for
 * identity. Theme-safe: the gradient stops cover a tonal range that
 * remains visible on both dark and light canvases.
 *
 * The CSS lives in `src/index.css` under "3D Diamond loader" so the
 * keyframes are available globally (the full-screen splash and the
 * route-transition overlay both render this).
 *
 * Props:
 *   size  - pixel size of the bounding box. Defaults to 64.
 */
export default function SpinningGem({ size = 64 }) {
  const Face = ({ deg }) => (
    <svg
      className="gem3d-face"
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      style={{ transform: `rotateY(${deg}deg)` }}
      aria-hidden
    >
      <defs>
        <linearGradient id={`gem-crown-${deg}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#CBD5E1" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={`gem-pavilion-${deg}`} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%"   stopColor="#94A3B8" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#1E293B" stopOpacity="1" />
        </linearGradient>
      </defs>
      {/* Crown — top half, two facets */}
      <polygon points="32,6 6,24 32,24"  fill={`url(#gem-crown-${deg})`} />
      <polygon points="32,6 58,24 32,24" fill={`url(#gem-crown-${deg})`} fillOpacity="0.82" />
      {/* Pavilion — bottom half, two facets */}
      <polygon points="6,24 32,24 32,58"  fill={`url(#gem-pavilion-${deg})`} />
      <polygon points="32,24 58,24 32,58" fill={`url(#gem-pavilion-${deg})`} fillOpacity="0.9" />
      {/* Cut detail: girdle + vertical seam */}
      <line x1="6"  y1="24" x2="58" y2="24" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="0.6" />
      <line x1="32" y1="6"  x2="32" y2="58" stroke="#FFFFFF" strokeOpacity="0.28" strokeWidth="0.5" />
      {/* Specular table highlight */}
      <polygon points="32,6 22,14 42,14" fill="#FFFFFF" fillOpacity="0.22" />
      {/* Crisp outline for readability on dark backgrounds */}
      <polygon
        points="32,6 6,24 32,58 58,24"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.4"
        strokeWidth="0.5"
      />
    </svg>
  );
  return (
    <div className="gem3d" style={{ width: size, height: size }} aria-hidden>
      <span className="gem3d-halo" />
      <div className="gem3d-stage">
        <Face deg={0} />
        <Face deg={60} />
        <Face deg={120} />
      </div>
    </div>
  );
}
