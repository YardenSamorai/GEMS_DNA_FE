import React, { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronUp, Columns2, X } from "lucide-react";
import { EASE_OUT } from "../../dna/motion";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "./Menu";
import Sheet from "./Sheet";

/* Rises from the bottom edge when a selection begins and drops back the same
 * way when it's cleared, so the bar reads as a mode the list entered. */
const ENTER = { duration: 0.2, ease: EASE_OUT };
const EXIT = { duration: 0.14, ease: EASE_OUT };

/* Floats over the results while anything is selected. `actions` is a list of
 * sections: [{ label, items: [{ id, label, sub, icon, onSelect }] }]. */
const SelectionBar = ({ count, caratText, pairsText, canCompare, onCompare, onClear, actions, sheet }) => {
  const btnRef = useRef(null);
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  // While the bar leaves, it keeps showing the selection it had.
  const last = useRef(null);
  if (count) last.current = { count, caratText, pairsText, canCompare };
  const shown = last.current;
  const off = reduce ? { opacity: 0 } : { opacity: 0, y: 16 };

  const run = (fn) => () => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <AnimatePresence>
        {count > 0 && (
          <motion.div
            key="selbar"
            className="inv-selbar"
            role="region"
            aria-label="Selection"
            style={{ x: "-50%" }}
            initial={off}
            animate={{ opacity: 1, y: 0 }}
            exit={{ ...off, transition: EXIT }}
            transition={ENTER}
          >
            <span className="inv-selbar-count" aria-live="polite">
              <b>{shown.count.toLocaleString()}</b> selected
              {shown.pairsText && <span className="inv-selbar-ct"> · {shown.pairsText}</span>}
              {!shown.pairsText && shown.caratText && <span className="inv-selbar-ct"> · {shown.caratText}</span>}
            </span>
            <button type="button" className="inv-icon-btn" onClick={onClear} aria-label="Clear selection" title="Clear selection">
              <X size={17} strokeWidth={1.75} />
            </button>
            {shown.canCompare && (
              <>
                <span className="inv-selbar-sep" aria-hidden="true" />
                <button type="button" className="inv-btn inv-btn--quiet" onClick={onCompare}>
                  <Columns2 size={16} strokeWidth={1.75} aria-hidden="true" />
                  <span>Compare</span>
                </button>
              </>
            )}
            <button
              ref={btnRef}
              type="button"
              className="inv-btn inv-btn--primary"
              aria-haspopup={sheet ? "dialog" : "menu"}
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              <span>Actions</span>
              <ChevronUp size={15} strokeWidth={2} aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {!count ? null : sheet ? (
        <Sheet open={open} variant="bottom" onClose={() => setOpen(false)} title={`${count} selected`} titleId="inv-actions-title">
          <div className="inv-action-list">
            {actions.map((section) => (
              <div key={section.label} role="group" aria-label={section.label}>
                <div className="inv-menu-label">{section.label}</div>
                {section.items.map((a) => (
                  <button key={a.id} type="button" className="inv-menu-item" onClick={run(a.onSelect)}>
                    {a.icon && <a.icon size={18} strokeWidth={1.75} aria-hidden="true" />}
                    <span className="inv-menu-text">
                      <span>{a.label}</span>
                      {a.sub && <span className="inv-menu-sub">{a.sub}</span>}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </Sheet>
      ) : (
        <Menu anchorRef={btnRef} open={open} onClose={() => setOpen(false)} label="Selection actions" width={280}>
          {actions.map((section, i) => (
            <React.Fragment key={section.label}>
              {i > 0 && <MenuSeparator />}
              <MenuLabel>{section.label}</MenuLabel>
              {section.items.map((a) => (
                <MenuItem key={a.id} icon={a.icon} sub={a.sub} onSelect={run(a.onSelect)}>
                  {a.label}
                </MenuItem>
              ))}
            </React.Fragment>
          ))}
        </Menu>
      )}
    </>
  );
};

export default SelectionBar;
