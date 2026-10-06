import React from "react";
import { X } from "lucide-react";

/* One chip per active value. Removing a chip applies immediately. */
const ActiveFilters = ({ chips, onRemove, onClearAll, className = "" }) => {
  if (!chips.length) return null;
  return (
    <div className={`inv-active ${className}`} role="list" aria-label="Active filters">
      {chips.map((c) => (
        <span key={c.id} className="inv-achip" role="listitem">
          <span className="inv-achip-label" title={c.label}>{c.label}</span>
          <button type="button" className="inv-x" onClick={() => onRemove(c)} aria-label={`Remove filter ${c.label}`}>
            <X size={14} strokeWidth={1.75} />
          </button>
        </span>
      ))}
      {onClearAll && chips.length > 1 && (
        <button type="button" className="inv-btn inv-btn--plain inv-btn--sm" onClick={onClearAll}>
          Clear all
        </button>
      )}
    </div>
  );
};

export default ActiveFilters;
