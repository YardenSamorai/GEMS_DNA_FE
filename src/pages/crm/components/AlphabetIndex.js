import React, { useCallback, useRef } from "react";

/**
 * Vertical iOS-Contacts-style jump strip rendered to the right of a CRM
 * list. Letters that don't appear in the data are dimmed (so the user
 * can see the full alphabet but can't jump to an empty section).
 *
 * Click → jump. Drag (touch or mouse) → continuously jump as the
 * pointer moves across letters, which is what makes the native iOS
 * picker so fast on long lists.
 *
 * Props
 *   letters       string[]    Letters to render, in display order
 *   present       Set<string> Letters that have ≥1 row in the data
 *   onJump        (letter) => void
 *   className     string?     Extra classes for the outer wrapper
 */
export default function AlphabetIndex({ letters, present, onJump, className = "", style }) {
  const stripRef = useRef(null);
  const lastLetterRef = useRef(null);

  const fireJump = useCallback(
    (letter) => {
      if (!letter || !present.has(letter)) return;
      if (lastLetterRef.current === letter) return; // skip repeats while dragging
      lastLetterRef.current = letter;
      onJump?.(letter);
    },
    [onJump, present]
  );

  // Walk the buttons to find which one is under the pointer Y. We can't
  // rely on event.target while dragging because the original target is
  // captured by the pointer-down handler.
  const letterFromClientY = (clientY) => {
    const strip = stripRef.current;
    if (!strip) return null;
    const children = strip.querySelectorAll("[data-letter]");
    for (const btn of children) {
      const r = btn.getBoundingClientRect();
      if (clientY >= r.top && clientY <= r.bottom) {
        return btn.getAttribute("data-letter");
      }
    }
    return null;
  };

  // Drag-to-scrub: capture pointer at down, then map Y to letter on
  // every move. We run the same logic for mouse, pen and touch — the
  // inner buttons are pointer-events:none so the parent owns *all*
  // tap/drag interaction. That keeps the iPhone-like "slide your
  // thumb across the strip" gesture working everywhere.
  const handlePointerDown = (e) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (_) {}
    const l = letterFromClientY(e.clientY);
    fireJump(l);
  };

  const handlePointerMove = (e) => {
    // Only follow movement while the pointer is captured (i.e. between
    // pointerdown and pointerup). Avoid jumping just because the user
    // hovered over the strip with a mouse.
    if (!e.currentTarget.hasPointerCapture?.(e.pointerId)) return;
    const l = letterFromClientY(e.clientY);
    fireJump(l);
  };

  const handlePointerUp = (e) => {
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch (_) {}
    lastLetterRef.current = null;
  };

  if (!letters || letters.length === 0) return null;

  return (
    <div
      ref={stripRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      // Positioning and the capped height (a mixed A-Z + א-ת strip is 52
      // cells) live in .crm-index, crm.css.
      className={`crm-index ${className}`}
      role="navigation"
      aria-label="Jump to letter"
      style={style}
    >
      {letters.map((l) => (
        <div key={l} data-letter={l} data-empty={!present.has(l)} aria-label={`Jump to ${l}`} className="crm-index-letter">
          {l}
        </div>
      ))}
    </div>
  );
}
