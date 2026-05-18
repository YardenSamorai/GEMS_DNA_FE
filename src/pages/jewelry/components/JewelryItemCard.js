import React from "react";
import { Link } from "react-router-dom";
import StatusBadge from "./StatusBadge";

const fmtPrice = (n) => {
  const v = Number(n);
  if (!v) return null;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v).toLocaleString()}`;
  return `$${v.toFixed(0)}`;
};

// Card now handles two kinds of items in the unified Jewelry inventory:
//   - workshop items (jewelry_items rows)  -> dialog preview, full page on cmd+click
//   - catalog items (jewelry_products rows) -> dialog preview, full DNA on cmd+click
// Caller marks the source via `item.__source` ('workshop' | 'catalog') and
// supplies an onSelect handler that opens the quick-look dialog. We keep the
// `to` href on the underlying Link so middle-click / cmd+click still opens
// the full page in a new tab — power users expect this from grid UIs.
const InventoryCard = ({ item, onSelect }) => {
  const isCatalog = item.__source === "catalog";
  const cover = item.cover_image_url;
  const price = item.sale_price || item.total_cost;
  const material = item.metal_summary || item.category;
  const href = isCatalog ? `/${item.sku}` : `/jewelry/items/${item.id}`;

  const handleClick = (e) => {
    // Honor new-tab gestures: cmd/ctrl/shift/middle click → let the Link work
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    if (onSelect) {
      e.preventDefault();
      onSelect(item);
    }
  };

  return (
    <Link
      to={href}
      onClick={handleClick}
      className="group flex flex-col overflow-hidden rounded-2xl glass-surface transition hover:-translate-y-0.5"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-stone-100">
        {cover ? (
          <img
            src={cover}
            alt={item.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-stone-300">
            <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M5 3l3.057-3 4.886 0L16 3l4 5-8 13L4 8l1-5z" />
            </svg>
          </div>
        )}

        {/* Source / Status badge top-left */}
        {isCatalog ? (
          <div className="absolute left-2 top-2 rounded-full bg-sky-600/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white shadow-sm backdrop-blur">
            Catalog
          </div>
        ) : (
          item.status && item.status !== "ready" && (
            <div className="absolute left-2 top-2">
              <StatusBadge status={item.status} size="sm" />
            </div>
          )
        )}
        {!isCatalog && item.type === "stock" && (
          <div className="absolute right-2 top-2 rounded-full bg-stone-900/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur">
            Stock
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="truncate text-[13px] font-semibold text-stone-900" title={item.name}>
          {item.name || "Untitled"}
        </div>

        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="truncate font-mono text-stone-500" title={item.sku}>
            {item.sku || "—"}
          </span>
          {price ? (
            <span className="shrink-0 font-bold text-emerald-600 tabular-nums">{fmtPrice(price)}</span>
          ) : (
            <span className="shrink-0 text-stone-400">—</span>
          )}
        </div>

        {material && (
          <div className="mt-auto pt-1">
            <span className="inline-block rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
              {material}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
};

export default InventoryCard;
