import React from "react";

/* ============================================================================
 * Skeleton primitives — centralised loading placeholders.
 *
 * Why: every page/list/card that fetches data should render a skeleton that
 * mirrors the SHAPE of its content while data is in flight. This gives the
 * user instant feedback ("the page is alive, data is coming") instead of a
 * blank screen or generic "Loading..." text.
 *
 * Design rules:
 *   - Use neutral stone colors (bg-stone-200/100 in light, dark mode safe).
 *   - Always animate-pulse for clear "in progress" affordance.
 *   - Keep heights/widths matching the real content so the layout doesn't
 *     jump when data arrives.
 *   - Compose larger skeletons from these primitives — never animate-pulse
 *     ad-hoc inside pages anymore. Import from this file.
 *
 * Usage:
 *   import {
 *     Skeleton,           // raw block, accepts className
 *     SkeletonText,       // N stacked text rows of varying widths
 *     SkeletonAvatar,     // round avatar
 *     SkeletonStatCard,   // one KPI tile (icon + number + label)
 *     SkeletonCard,       // generic card body (header + N text rows)
 *     SkeletonGrid,       // grid of N image-card placeholders
 *     SkeletonTableRows,  // N rows × M columns of placeholder cells
 *     SkeletonList,       // vertical list of N rows (avatar + 2 lines)
 *   } from "../components/ui/Skeleton";
 * ============================================================================ */

/* ─────────────────────────────────────────────────────────────────────────────
 * Base block — every other skeleton composes from this.
 * ───────────────────────────────────────────────────────────────────────── */
export const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse rounded-md bg-stone-200/70 ${className}`} />
);

/* ─────────────────────────────────────────────────────────────────────────────
 * Text rows — a paragraph-ish block. Last line is shorter to feel natural.
 * ───────────────────────────────────────────────────────────────────────── */
export const SkeletonText = ({ lines = 3, className = "" }) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`}
      />
    ))}
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
 * Avatar — circular placeholder.
 * ───────────────────────────────────────────────────────────────────────── */
export const SkeletonAvatar = ({ size = 40, className = "" }) => (
  <div
    className={`shrink-0 animate-pulse rounded-full bg-stone-200/70 ${className}`}
    style={{ width: size, height: size }}
  />
);

/* ─────────────────────────────────────────────────────────────────────────────
 * Stat card — looks like a KPI tile in mid-flight.
 * ───────────────────────────────────────────────────────────────────────── */
export const SkeletonStatCard = ({ className = "" }) => (
  <div className={`rounded-xl border border-stone-200 bg-white p-4 ${className}`}>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-8 w-8 rounded-lg" />
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
 * Generic card with title + N body rows.
 * ───────────────────────────────────────────────────────────────────────── */
export const SkeletonCard = ({ lines = 3, withHeader = true, className = "" }) => (
  <div className={`rounded-xl border border-stone-200 bg-white p-4 ${className}`}>
    {withHeader && (
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
    )}
    <SkeletonText lines={lines} />
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
 * Grid of image cards — used for inventory/jewelry/catalog grids.
 *   items   – number of placeholder cards
 *   cols    – tailwind grid-cols class string for breakpoints
 *   aspect  – tailwind aspect class for the image area
 * ───────────────────────────────────────────────────────────────────────── */
export const SkeletonGrid = ({
  items = 12,
  cols = "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
  aspect = "aspect-square",
  className = "",
}) => (
  <div className={`grid gap-3 ${cols} ${className}`}>
    {Array.from({ length: items }).map((_, i) => (
      <div key={i} className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <Skeleton className={`${aspect} w-full rounded-none`} />
        <div className="p-2 space-y-1.5">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-2.5 w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
 * Table row placeholders — drop straight into a <tbody>.
 *   rows  – number of rows
 *   cols  – number of cells per row (with varied widths to feel natural)
 * ───────────────────────────────────────────────────────────────────────── */
export const SkeletonTableRows = ({ rows = 6, cols = 5 }) => {
  const widths = ["w-32", "w-24", "w-20", "w-16", "w-28", "w-12"];
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-stone-100">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="py-3 px-4">
              <Skeleton className={`h-3.5 ${widths[(r + c) % widths.length]}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Vertical list of "avatar + two lines" rows. Used for contacts/tasks/etc.
 * ───────────────────────────────────────────────────────────────────────── */
export const SkeletonList = ({ items = 6, withAvatar = true, className = "" }) => (
  <div className={`divide-y divide-stone-100 ${className}`}>
    {Array.from({ length: items }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 p-3">
        {withAvatar && <SkeletonAvatar size={36} />}
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <Skeleton className="h-3 w-12" />
      </div>
    ))}
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
 * Page-level scaffold — header + KPI strip + main panel. Used by pages where
 * the whole screen is loading from scratch and we want to give the user
 * something that looks roughly like the destination immediately.
 * ───────────────────────────────────────────────────────────────────────── */
export const SkeletonPage = ({
  kpis = 4,
  withHeader = true,
  children,
  className = "",
}) => (
  <div className={`mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6 ${className}`}>
    {withHeader && (
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-3 w-80" />
      </div>
    )}
    {kpis > 0 && (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: kpis }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>
    )}
    {children}
  </div>
);

const SkeletonAll = {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonStatCard,
  SkeletonCard,
  SkeletonGrid,
  SkeletonTableRows,
  SkeletonList,
  SkeletonPage,
};

export default SkeletonAll;
