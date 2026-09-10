import React from "react";

/* =============================================================================
 * The banner shown while a list of SKUs is being searched.
 *
 * A rep who pastes twenty numbers needs to know two things immediately: that
 * the page has stopped filtering by category (so nothing is quietly missing),
 * and exactly which of their SKUs came back with nothing. The second is the
 * whole point — a list search that silently returns eighteen cards looks
 * identical to one that returns twenty.
 * ========================================================================== */

/* Enough missing SKUs to be useful without pushing the grid off the screen. */
const MISSING_SHOWN = 8;

const SkuListSummary = ({ terms, items, missing, stoneCount, jewelryCount, onClear }) => {
  const parts = [];
  if (stoneCount) parts.push(`${stoneCount} ${stoneCount === 1 ? "stone" : "stones"}`);
  if (jewelryCount) parts.push(`${jewelryCount} jewelry`);

  return (
    <div className="mt-3 rounded-2xl border border-app-line bg-app-surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-app-ink">
          {items.length} of {terms.length} SKUs found
          {parts.length > 0 && (
            <span className="font-medium text-app-soft"> · {parts.join(" · ")}</span>
          )}
        </p>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg bg-app-canvas2 px-3 py-1 text-[12px] font-semibold text-app-ink transition active:scale-95"
        >
          Clear
        </button>
      </div>

      <p className="mt-1 text-[12px] leading-snug text-app-soft">
        Searching every category. Filters and sorting are off while a list is
        open, and the order below is the order you pasted.
      </p>

      {missing.length > 0 && (
        <p className="mt-2 text-[12px] leading-snug text-amber-700">
          <span className="font-semibold">Not in stock ({missing.length}):</span>{" "}
          {missing.slice(0, MISSING_SHOWN).join(", ").toUpperCase()}
          {missing.length > MISSING_SHOWN && ` +${missing.length - MISSING_SHOWN} more`}
        </p>
      )}
    </div>
  );
};

export default SkuListSummary;
