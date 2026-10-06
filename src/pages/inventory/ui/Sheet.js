import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { FADE, SPRING, SPRING_EXIT, shouldDismiss } from "../../dna/motion";
import { useFocusTrap, useScrollLock } from "./hooks";

const OFFSCREEN = {
  bottom: { y: "100%" },
  side: { x: "calc(100% + 24px)" },
  panel: { x: 24, opacity: 0 },
};

/* One overlay primitive for the filter sheet, quick look and actions.
 *   bottom — phone sheet with a grabber (drag down to dismiss)
 *   side   — tablet panel from the right, modal
 *   panel  — desktop panel beside the list, non-modal (no scrim, no trap) */
const SheetLayer = ({ variant, onClose, title, titleId, headerExtra, footer, children, tall, initialFocus, closeLabel }) => {
  const ref = useRef(null);
  const drag = useDragControls();
  const reduce = useReducedMotion();
  const modal = variant !== "panel";
  useFocusTrap(ref, modal, { initialFocus });
  useScrollLock(variant === "bottom");

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      // A menu or dialog layered above handles its own Escape.
      if (document.querySelector("[data-inv-layer='menu']")) return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const off = reduce ? { opacity: 0 } : OFFSCREEN[variant];
  const isBottom = variant === "bottom";

  return (
    <>
      {modal && (
        <motion.div
          className="inv-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: FADE }}
          transition={FADE}
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal={modal ? "true" : undefined}
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`inv-sheet inv-sheet--${variant}${tall ? " inv-sheet--tall" : ""}`}
        initial={off}
        animate={{ x: 0, y: 0, opacity: 1 }}
        exit={{ ...off, transition: reduce ? FADE : SPRING_EXIT }}
        transition={reduce ? FADE : SPRING}
        drag={isBottom ? "y" : false}
        dragListener={false}
        dragControls={drag}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 0 && shouldDismiss(info)) onClose();
        }}
      >
        {isBottom && (
          <div className="inv-grabber" onPointerDown={(e) => drag.start(e)} aria-hidden="true" />
        )}
        <div className="inv-sheet-head" onPointerDown={isBottom ? (e) => {
          if (e.target.closest("button, a, input")) return;
          drag.start(e);
        } : undefined}>
          <h2 id={titleId} className="inv-sheet-title">{title}</h2>
          {headerExtra}
          <button type="button" className="inv-icon-btn inv-icon-btn--filled" onClick={onClose} aria-label={closeLabel || "Close"}>
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <div className="inv-sheet-body">{children}</div>
        {footer && <div className="inv-sheet-foot">{footer}</div>}
      </motion.div>
    </>
  );
};

const Sheet = ({ open, ...props }) =>
  createPortal(
    <div className="inv">
      <AnimatePresence>{open && <SheetLayer key="sheet" {...props} />}</AnimatePresence>
    </div>,
    document.body
  );

export default Sheet;
