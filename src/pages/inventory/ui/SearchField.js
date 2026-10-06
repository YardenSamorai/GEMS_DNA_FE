import React, { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";

const isTyping = (el) => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);

/* SKU search. Accepts one SKU or a pasted list; matching stays exact per SKU.
 * "/" focuses it from anywhere, Escape clears it. */
const SearchField = ({ value, onChange, skuQuery, placeholder, children }) => {
  const ref = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (document.querySelector("[role='dialog'][aria-modal='true'], [data-inv-layer='menu']")) return;
      e.preventDefault();
      ref.current?.focus();
      ref.current?.select();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const terms = skuQuery?.terms?.length || 0;
  const unknown = skuQuery?.unknown || [];

  return (
    <>
      <div className="inv-searchrow">
        <div className="inv-search" role="search">
          <Search className="inv-search-icon" size={18} strokeWidth={1.75} aria-hidden="true" />
          <input
            ref={ref}
            type="search"
            className="inv-search-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                if (value) onChange("");
                else ref.current?.blur();
              }
            }}
            placeholder={placeholder}
            aria-label="Search by SKU"
            aria-describedby={terms > 1 ? "inv-search-hint" : undefined}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck="false"
            enterKeyHint="search"
          />
          <span className="inv-search-end">
            {value ? (
              <button
                type="button"
                className="inv-icon-btn inv-icon-btn--sm"
                onClick={() => {
                  onChange("");
                  ref.current?.focus();
                }}
                aria-label="Clear search"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            ) : (
              <kbd className="inv-kbd" aria-hidden="true">/</kbd>
            )}
          </span>
        </div>
        {children}
      </div>
      {terms > 1 && (
        <p id="inv-search-hint" className="inv-search-hint" aria-live="polite">
          Searching <b>{terms}</b> SKUs
          {unknown.length > 0 && (
            <span className="inv-warn">
              {" "}· {unknown.length} not in this tab: {unknown.slice(0, 3).join(", ").toUpperCase()}
              {unknown.length > 3 ? "…" : ""}
            </span>
          )}
        </p>
      )}
    </>
  );
};

export default SearchField;
