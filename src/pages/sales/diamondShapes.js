import React from "react";

/* Compact line-art icons for the diamond Shape filter. Each `icon` is a
 * render fn `(cls) => <svg/>` so callers control sizing/colour via className
 * (stroke = currentColor). Kept deliberately simple/uniform so the row reads
 * as a clean set of glyphs rather than detailed illustrations. */
const S = (children) => (cls) =>
  (
    <svg
      className={cls}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {children}
    </svg>
  );

export const DIAMOND_SHAPES = [
  {
    key: "Round",
    label: "Round",
    icon: S(
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      </>
    ),
  },
  {
    key: "Princess",
    label: "Princess",
    icon: S(
      <>
        <rect x="4" y="4" width="16" height="16" rx="1.2" />
        <path d="M4 4l16 16M20 4L4 20" />
      </>
    ),
  },
  {
    key: "Cushion",
    label: "Cushion",
    icon: S(<rect x="4" y="4" width="16" height="16" rx="6" />),
  },
  {
    key: "Radiant",
    label: "Radiant",
    icon: S(
      <>
        <path d="M8 4h8l4 4v8l-4 4H8l-4-4V8l4-4z" />
        <path d="M8 4l8 16M16 4L8 20" />
      </>
    ),
  },
  {
    key: "Emerald",
    label: "Emerald",
    icon: S(<path d="M9 3h6l3 3v12l-3 3H9l-3-3V6l3-3z" />),
  },
  {
    key: "Asscher",
    label: "Asscher",
    icon: S(
      <>
        <path d="M8 4h8l4 4v8l-4 4H8l-4-4V8l4-4z" />
        <rect x="9" y="9" width="6" height="6" />
      </>
    ),
  },
  {
    key: "Oval",
    label: "Oval",
    icon: S(<ellipse cx="12" cy="12" rx="6" ry="9" />),
  },
  {
    key: "Pear",
    label: "Pear",
    icon: S(<path d="M12 3c3.6 4 6 7.2 6 10.2A6 6 0 116 13.2C6 10.2 8.4 7 12 3z" />),
  },
  {
    key: "Marquise",
    label: "Marquise",
    icon: S(<path d="M3 12c4-5.5 14-5.5 18 0-4 5.5-14 5.5-18 0z" />),
  },
  {
    key: "Heart",
    label: "Heart",
    icon: S(<path d="M12 20S4 15 4 9.5A3.8 3.8 0 0112 7a3.8 3.8 0 018 2.5C20 15 12 20 12 20z" />),
  },
  {
    key: "Trilliant",
    label: "Trilliant",
    icon: S(<path d="M12 4l8.5 15h-17z" />),
  },
  {
    key: "Baguette",
    label: "Baguette",
    icon: S(<rect x="8.5" y="3" width="7" height="18" rx="0.8" />),
  },
  {
    key: "Trapezoid",
    label: "Trapeze",
    icon: S(<path d="M4 18h16l-3.5-12h-9z" />),
  },
  {
    key: "HalfMoon",
    label: "Half Moon",
    icon: S(<path d="M4 8h16a8 8 0 01-16 0z" />),
  },
  {
    key: "OldEuropean",
    label: "Eur. Cut",
    icon: S(
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M5.3 5.3l13.4 13.4M18.7 5.3L5.3 18.7" />
      </>
    ),
  },
  {
    key: "OldMine",
    label: "Old Mine",
    icon: S(
      <>
        <rect x="5" y="5" width="14" height="14" rx="5" />
        <path d="M6 6l12 12M18 6L6 18" />
      </>
    ),
  },
  {
    key: "Rose",
    label: "Rose",
    icon: S(
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 4l2.7 4.3L19.5 9l-3.8 3 1.3 5.5L12 15l-5 2.5 1.3-5.5-3.8-3 4.8-.7z" />
      </>
    ),
  },
];

export default DIAMOND_SHAPES;
