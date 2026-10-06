import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

const GAP = 6;
const MARGIN = 12;

/* Anchored popover menu. Arrow keys move between items, Escape and Tab
 * close it and return focus to the trigger. */
export const Menu = ({ anchorRef, open, onClose, label, align = "end", children, width }) => {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  const place = useCallback(() => {
    const a = anchorRef.current;
    const m = ref.current;
    if (!a || !m) return;
    const r = a.getBoundingClientRect();
    const mh = m.offsetHeight;
    const mw = m.offsetWidth;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const below = vh - r.bottom - MARGIN;
    const top = below >= mh + GAP || below >= r.top ? r.bottom + GAP : Math.max(MARGIN, r.top - GAP - mh);
    let left = align === "end" ? r.right - mw : r.left;
    left = Math.min(Math.max(MARGIN, left), vw - mw - MARGIN);
    setPos({ top, left });
  }, [anchorRef, align]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const items = () => Array.from(ref.current?.querySelectorAll('[role^="menuitem"]') || []);
    const first = items().find((el) => el.getAttribute("aria-checked") === "true") || items()[0];
    first?.focus({ preventScroll: true });
    const close = (refocus) => {
      onClose();
      if (refocus) anchorRef.current?.focus({ preventScroll: true });
    };
    const onKey = (e) => {
      const list = items();
      const i = list.indexOf(document.activeElement);
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close(true);
      } else if (e.key === "Tab") {
        close(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        list[(i + 1) % list.length]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        list[(i - 1 + list.length) % list.length]?.focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        list[0]?.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        list[list.length - 1]?.focus();
      }
    };
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      close(false);
    };
    const onScroll = (e) => {
      if (ref.current?.contains(e.target)) return;
      place();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, onClose, anchorRef, place]);

  if (!open) return null;
  return createPortal(
    <div className="inv">
      <div
        ref={ref}
        role="menu"
        aria-label={label}
        data-inv-layer="menu"
        className="inv-menu"
        style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width, visibility: pos ? "visible" : "hidden" }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

export const MenuItem = ({ icon: Icon, children, sub, onSelect, checked, radio, disabled }) => (
  <button
    type="button"
    role={radio ? "menuitemradio" : "menuitem"}
    aria-checked={radio ? Boolean(checked) : undefined}
    className="inv-menu-item"
    onClick={onSelect}
    disabled={disabled}
    tabIndex={-1}
  >
    {Icon && <Icon size={18} strokeWidth={1.75} aria-hidden="true" />}
    <span className="inv-menu-text">
      <span>{children}</span>
      {sub && <span className="inv-menu-sub">{sub}</span>}
    </span>
    {radio && checked && <Check size={16} strokeWidth={2} className="inv-menu-check" aria-hidden="true" />}
  </button>
);

export const MenuLabel = ({ children }) => <div className="inv-menu-label" role="presentation">{children}</div>;
export const MenuSeparator = () => <div className="inv-menu-sep" role="separator" />;
