import React, { useRef } from "react";
import { ScanLine } from "lucide-react";

const MODE_LABELS = { diamonds: "Diamonds", gemstones: "Gemstones", jewelry: "Jewelry" };

/* Radio-group segmented control with roving arrow-key focus. */
export const Segmented = ({ label, options, value, onChange, className = "" }) => {
  const refs = useRef([]);
  const onKeyDown = (e, i) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + options.length) % options.length;
    refs.current[next]?.focus();
    onChange(options[next].id);
  };
  return (
    <div className={`inv-seg ${className}`} role="radiogroup" aria-label={label}>
      {options.map((o, i) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            className="inv-seg-btn"
            onClick={() => onChange(o.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            title={o.title}
            aria-label={o.ariaLabel}
          >
            {o.icon}
            {o.label}
            {o.count != null && <span className="inv-seg-count">{o.count.toLocaleString()}</span>}
          </button>
        );
      })}
    </div>
  );
};

const InventoryHeader = ({ mode, counts, countsReady, onModeChange, onScan, priceMode, onTogglePriceMode }) => (
  <header className="inv-head">
    <h1 className="inv-title">Inventory</h1>
    <Segmented
      label="Inventory type"
      value={mode}
      onChange={onModeChange}
      options={["diamonds", "gemstones", "jewelry"].map((id) => ({
        id,
        label: MODE_LABELS[id],
        count: countsReady[id] ? counts[id] : null,
      }))}
    />
    <div className="inv-head-actions">
      {mode === "gemstones" && (
        <button
          type="button"
          className="inv-price-mode"
          onClick={onTogglePriceMode}
          aria-label={priceMode === "neto" ? "Prices: Neto" : "Prices: B"}
          title="Price basis"
        >
          {priceMode === "neto" ? "Neto" : "B"}
        </button>
      )}
      <button type="button" className="inv-btn inv-btn--sm" onClick={onScan} aria-label="Scan a barcode">
        <ScanLine size={17} strokeWidth={1.75} aria-hidden="true" />
        <span>Scan</span>
      </button>
    </div>
  </header>
);

export default InventoryHeader;
