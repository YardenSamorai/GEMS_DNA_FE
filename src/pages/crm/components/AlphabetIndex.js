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
  // every move. This is what makes the iOS index feel instant on long
  // lists. We don't preventDefault on tap-only interactions so the
  // <button> still gets its normal click event (good for keyboard
  // & mouse users who don't drag).
  const handlePointerDown = (e) => {
    if (e.pointerType === "touch") {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      const l = letterFromClientY(e.clientY);
      fireJump(l);
    }
  };

  const handlePointerMove = (e) => {
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
      className={`shrink-0 flex flex-col items-center justify-center gap-px py-1 px-1 rounded-full bg-white/70 backdrop-blur-sm border border-stone-200/80 shadow-sm select-none touch-none ${className}`}
      role="navigation"
      aria-label="Jump to letter"
      style={{ writingMode: "horizontal-tb", ...style }}
    >
      {letters.map((l) => {
        const isPresent = present.has(l);
        return (
          <button
            key={l}
            type="button"
            data-letter={l}
            disabled={!isPresent}
            tabIndex={isPresent ? 0 : -1}
            onClick={(e) => {
              e.stopPropagation();
              if (isPresent) onJump?.(l);
            }}
            className={`w-5 h-4 text-[10px] font-semibold leading-none rounded transition-colors ${
              isPresent
                ? "text-stone-700 hover:bg-stone-200/70 cursor-pointer"
                : "text-stone-300 cursor-default"
            }`}
            aria-label={`Jump to ${l}`}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
