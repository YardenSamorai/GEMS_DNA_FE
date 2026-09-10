import React, { useState } from "react";

import { StonePlaceholder, SelectToggle, prettyBranch, money } from "./SalesInventory";

/* ============================================================================
 * JewelryCard — the catalog card for one jewelry piece.
 *
 * Lives apart from SalesJewelry so the stone catalog can render it too: a SKU
 * list search answers across every category at once, and a list mixing loose
 * stones with finished pieces has to come back as one grid. SalesJewelry
 * re-exports it, so existing importers are unaffected.
 *
 * The helpers below come from SalesInventory, which also imports this file.
 * That cycle is safe because every one of them is called during render, long
 * after both modules have finished evaluating — but it does mean nothing here
 * may run at module scope.
 * ========================================================================== */

/* One value-only detail line (hidden when empty). */
const Line = ({ value }) =>
  value == null || value === "" ? null : (
    <p className="text-[12.5px] leading-snug text-app-muted">{value}</p>
  );

/* Catalog card — square image, then each spec stacked on its own line:
 *   center-stone weight, total weight (g), Shape, Jewelry type, Gem type,
 *   then SKU, then price. */
export const JewelryCard = ({ item, layout = "grid" }) => {
  const isRow = layout === "row";
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = item.image && !imgFailed;
  const centerCt = Number.isFinite(item.centerCarat) ? `${item.centerCarat.toFixed(2)} ct` : null;
  const price = money(item.price);
  return (
    // "grid" = classic card (image on top); "row" = thumbnail left, details
    // right — the list view picked in Dashboard → Settings.
    <div className={isRow ? "flex items-start gap-3" : "flex flex-col"}>
      <div
        className={`relative shrink-0 overflow-hidden rounded-xl bg-app-canvas2 ${
          isRow ? "h-24 w-24 sm:h-28 sm:w-28" : "aspect-square w-full"
        }`}
      >
        {showImage ? (
          <img
            src={item.image}
            alt={item.name}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <StonePlaceholder alt={item.name} />
        )}
        <SelectToggle stone={item} />
      </div>
      <div className={`${isRow ? "min-w-0 flex-1" : "mt-2.5"} flex flex-col gap-0.5`}>
        {/* Only "Memo out" is relevant for jewelry availability. */}
        {item.onMemo && (
          <div className="mb-0.5 flex flex-wrap items-center gap-1">
            <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-amber-700">
              Memo out
            </span>
          </div>
        )}
        {/* Title leads, then labelled spec lines. */}
        <h3 className="text-[14px] font-semibold leading-snug text-app-ink">{item.name || item.sku}</h3>
        <Line value={centerCt ? `Center stone weight: ${centerCt}` : null} />
        <Line value={item.branch ? `Branch: ${prettyBranch(item.branch)}` : null} />
        <Line value={item.style ? `Style: ${item.style}` : null} />
        <Line value={item.sku ? `SKU: ${item.sku}` : null} />
        {price && (
          <div className="mt-1.5">
            <span className="text-[14px] font-semibold tabular-nums text-app-ink">Total: {price}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default JewelryCard;
