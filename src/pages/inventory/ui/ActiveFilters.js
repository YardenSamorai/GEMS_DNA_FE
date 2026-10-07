import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { EASE_OUT } from "../../dna/motion";

/* Short enough for a control used many times a session: the removed chip
 * fades in place and its neighbours close the gap rather than jumping. */
const CHIP = { duration: 0.16, ease: EASE_OUT };

/* One chip per active value. Removing a chip applies immediately. */
const ActiveFilters = ({ chips, onRemove, onClearAll, className = "" }) => {
  const reduce = useReducedMotion();
  if (!chips.length) return null;
  const off = reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 };
  return (
    <div className={`inv-active ${className}`} role="list" aria-label="Active filters">
      <AnimatePresence initial={false} mode="popLayout">
        {chips.map((c) => (
          <motion.span
            key={c.id}
            className="inv-achip"
            role="listitem"
            layout={!reduce}
            initial={off}
            animate={{ opacity: 1, scale: 1 }}
            exit={off}
            transition={CHIP}
          >
            <span className="inv-achip-label" title={c.label}>{c.label}</span>
            <button type="button" className="inv-x" onClick={() => onRemove(c)} aria-label={`Remove filter ${c.label}`}>
              <X size={14} strokeWidth={1.75} />
            </button>
          </motion.span>
        ))}
        {onClearAll && chips.length > 1 && (
          <motion.button
            key="clear-all"
            type="button"
            className="inv-btn inv-btn--plain inv-btn--sm"
            layout={!reduce}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={CHIP}
            onClick={onClearAll}
          >
            Clear all
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ActiveFilters;
