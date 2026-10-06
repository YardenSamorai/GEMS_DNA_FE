import React, { useRef, useState } from "react";
import { ChevronUp, Columns2, X } from "lucide-react";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "./Menu";
import Sheet from "./Sheet";

/* Floats over the results while anything is selected. `actions` is a list of
 * sections: [{ label, items: [{ id, label, sub, icon, onSelect }] }]. */
const SelectionBar = ({ count, caratText, pairsText, canCompare, onCompare, onClear, actions, sheet }) => {
  const btnRef = useRef(null);
  const [open, setOpen] = useState(false);
  if (!count) return null;

  const run = (fn) => () => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <div className="inv-selbar" role="region" aria-label="Selection">
        <span className="inv-selbar-count" aria-live="polite">
          <b>{count.toLocaleString()}</b> selected
          {pairsText && <span className="inv-selbar-ct"> · {pairsText}</span>}
          {!pairsText && caratText && <span className="inv-selbar-ct"> · {caratText}</span>}
        </span>
        <button type="button" className="inv-icon-btn" onClick={onClear} aria-label="Clear selection" title="Clear selection">
          <X size={17} strokeWidth={1.75} />
        </button>
        {canCompare && (
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
      </div>

      {sheet ? (
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
