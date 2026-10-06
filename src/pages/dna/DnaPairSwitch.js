import React, { useRef } from "react";
import { motion } from "framer-motion";
import { SPRING } from "./motion";

/* Pair / Stone 1 / Stone 2. One pill slides between the three, so where you
   are and where you came from stay legible. Arrow keys move like a tab bar. */
const DnaPairSwitch = ({ items, current, onSelect, idPrefix, className = "" }) => {
  const refs = useRef([]);

  const onKeyDown = (e) => {
    const i = items.findIndex((it) => it.key === current);
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = items[(i + step + items.length) % items.length];
    onSelect(next.key);
    refs.current[items.indexOf(next)]?.focus();
  };

  return (
    <div className={`dna-seg dna-seg--block ${className}`} role="tablist" aria-label="Pair or individual stone" onKeyDown={onKeyDown}>
      {items.map((item, i) => {
        const active = item.key === current;
        return (
          <button
            key={item.key}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            title={item.hint}
            className={`dna-seg-btn${active ? " is-active" : ""}`}
            onClick={() => !active && onSelect(item.key)}
          >
            {active && <motion.span layoutId={`${idPrefix}-pill`} className="dna-seg-pill" transition={SPRING} />}
            <span className="dna-seg-label">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default DnaPairSwitch;
