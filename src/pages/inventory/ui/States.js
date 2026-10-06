import React from "react";
import { AlertCircle, ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import ActiveFilters from "./ActiveFilters";

export const SkeletonRows = ({ rows = 8 }) => (
  <div aria-busy="true" aria-label="Loading inventory">
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="inv-sk-row">
        <span className="inv-sk" style={{ width: 18, height: 18, justifySelf: "center" }} />
        <span className="inv-sk" style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: 10 }} />
        <span className="inv-sk" style={{ height: 12, width: `${60 + ((i * 17) % 30)}%` }} />
        <span className="inv-sk" style={{ height: 12, width: "70%" }} />
        <span className="inv-sk" style={{ height: 12, width: "55%" }} />
        <span className="inv-sk" style={{ height: 12, width: "60%", justifySelf: "end" }} />
      </div>
    ))}
  </div>
);

export const EmptyState = ({ noun, chips, onRemoveChip, onClearFilters, search, onClearSearch, emptyInventory }) => (
  <div className="inv-state" role="status">
    <SearchX className="inv-state-icon" size={36} strokeWidth={1.5} aria-hidden="true" />
    <h2 className="inv-state-title">{emptyInventory ? `No ${noun} yet` : `No ${noun} match`}</h2>
    {!emptyInventory && (
      <p className="inv-state-text">
        {search && chips.length
          ? `Nothing matches “${search.length > 40 ? `${search.slice(0, 40)}…` : search}” with these filters.`
          : search
          ? `Nothing matches “${search.length > 40 ? `${search.slice(0, 40)}…` : search}” in ${noun}.`
          : "Remove a filter to widen the results."}
      </p>
    )}
    {chips.length > 0 && <ActiveFilters chips={chips} onRemove={onRemoveChip} />}
    {!emptyInventory && (
      <div className="inv-state-actions">
        {search && (
          <button type="button" className="inv-btn" onClick={onClearSearch}>Clear search</button>
        )}
        {chips.length > 0 && (
          <button type="button" className="inv-btn inv-btn--primary" onClick={onClearFilters}>Clear filters</button>
        )}
      </div>
    )}
  </div>
);

const describeError = (message) => {
  const m = String(message || "").trim();
  if (!m || /failed to fetch|networkerror|load failed/i.test(m)) return "The server couldn’t be reached.";
  return /[.!?]$/.test(m) ? m : `${m}.`;
};

export const ErrorState = ({ message, onRetry, retrying }) => (
  <div className="inv-state inv-state--error" role="alert">
    <AlertCircle className="inv-state-icon" size={36} strokeWidth={1.5} aria-hidden="true" />
    <h2 className="inv-state-title">Inventory didn’t load</h2>
    <p className="inv-state-text">{describeError(message)} Your filters are kept.</p>
    <div className="inv-state-actions">
      <button type="button" className="inv-btn inv-btn--primary" onClick={onRetry} disabled={retrying}>
        {retrying ? "Retrying…" : "Try again"}
      </button>
    </div>
  </div>
);

export const Pagination = ({ page, totalPages, start, end, total, noun, onPage }) => {
  if (total <= 0) return null;
  return (
    <nav className="inv-pager" aria-label="Pages">
      <span className="inv-pager-info">
        {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()} {noun}
      </span>
      {totalPages > 1 && (
        <span className="inv-pager-nav">
          <button type="button" className="inv-btn inv-btn--sm" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
            <span>Previous</span>
          </button>
          <span className="inv-pager-page" aria-current="page">
            {page} of {totalPages}
          </span>
          <button type="button" className="inv-btn inv-btn--sm" onClick={() => onPage(page + 1)} disabled={page >= totalPages} aria-label="Next page">
            <span>Next</span>
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </span>
      )}
    </nav>
  );
};
