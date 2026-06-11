import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelection } from "../../context/SelectionContext";
import { GemstoneCard, modeForStone } from "./SalesInventory";

/* Review page for the cross-category pick list. Lays the chosen stones out in
 * the same card grid as the catalog; each card keeps its select toggle (here it
 * removes) and still links through to the full stone page. */
const SelectionPage = () => {
  const { items, count, clear } = useSelection();
  const navigate = useNavigate();

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 rounded-xl border border-app-line bg-app-surface px-4 py-2 text-sm font-semibold tracking-tight text-app-ink transition hover:bg-app-canvas2 active:scale-95"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <h1 className="text-[15px] font-semibold tracking-tight text-app-ink">
          Selected
          <span className="ml-1.5 text-app-soft">({count})</span>
        </h1>

        {count > 0 ? (
          <button
            type="button"
            onClick={clear}
            className="rounded-xl border border-app-line bg-app-surface px-4 py-2 text-sm font-semibold tracking-tight text-red-600 transition hover:bg-red-50 active:scale-95"
          >
            Clear
          </button>
        ) : (
          <span className="w-[68px]" aria-hidden />
        )}
      </div>

      {count === 0 ? (
        <div className="mt-10 rounded-2xl glass-surface p-10 text-center">
          <p className="text-[14px] font-medium text-app-ink">No stones selected yet</p>
          <p className="mt-1 text-[13px] text-app-soft">
            Tap the <span className="font-semibold text-emerald-600">+</span> on any stone in the
            catalog to add it here.
          </p>
          <Link
            to="/sales/emeralds"
            className="mt-5 inline-flex rounded-xl bg-app-ink px-5 py-2.5 text-[13.5px] font-semibold text-app-canvas transition active:scale-95"
          >
            Browse catalog
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((stone, idx) => (
            <Link
              key={stone.id ?? stone.sku ?? idx}
              to={`/sales/stone/${encodeURIComponent(stone.sku || "")}`}
              state={{ stone }}
              className="transition active:opacity-80"
            >
              <GemstoneCard stone={stone} mode={modeForStone(stone)} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default SelectionPage;
