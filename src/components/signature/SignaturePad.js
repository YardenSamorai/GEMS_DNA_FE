import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";

/**
 * SignaturePad — minimal canvas-based signature capture.
 *
 * Self-contained, no external deps. Handles:
 *   - Mouse and touch input on the same canvas.
 *   - Device-pixel-ratio scaling so strokes stay crisp on retina/mobile.
 *   - Live resize via ResizeObserver (rotation, breakpoint change).
 *   - `touch-action: none` + preventDefault on touchmove so drawing
 *     doesn't scroll the page on a phone.
 *
 * Props:
 *   onChange(dataUrl | null)  — fires when a stroke ends (dataUrl) or
 *                                 when clear() is called via the ref (null).
 *   disabled  — boolean; pointer events are ignored when true.
 *   height    — canvas display height in CSS pixels (default 180).
 *
 * Imperative API exposed via ref:
 *   clear()   — wipes the canvas and emits onChange(null).
 *   isEmpty() — true if nothing has been drawn since the last clear.
 */
const SignaturePad = forwardRef(function SignaturePad(
  { onChange, disabled = false, height = 180, className = "" },
  ref
) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const [empty, setEmpty] = useState(true);

  // (Re)initialise the canvas backing store + 2d context. Called on mount,
  // on container resize, and from clear() — because setting canvas.width
  // also wipes the bitmap, this is our cheap reset path.
  const setupCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = parent.clientWidth;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    // setTransform (not scale) so repeated calls don't compound.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#0c0a09"; // stone-950
  };

  useEffect(() => {
    setupCanvas();
    const ro = new ResizeObserver(() => setupCanvas());
    if (canvasRef.current?.parentElement) {
      ro.observe(canvasRef.current.parentElement);
    }
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  useImperativeHandle(
    ref,
    () => ({
      clear() {
        setupCanvas();
        setEmpty(true);
        onChange?.(null);
      },
      isEmpty() {
        return empty;
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [empty, onChange]
  );

  const getPoint = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches?.[0] || e.changedTouches?.[0];
    const clientX = touch?.clientX ?? e.clientX;
    const clientY = touch?.clientY ?? e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const handleStart = (e) => {
    if (disabled) return;
    if (e.cancelable) e.preventDefault();
    drawingRef.current = true;
    lastPointRef.current = getPoint(e);
  };

  const handleMove = (e) => {
    if (!drawingRef.current || disabled) return;
    if (e.cancelable) e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const p = getPoint(e);
    const last = lastPointRef.current;
    if (last) {
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    lastPointRef.current = p;
    if (empty) setEmpty(false);
  };

  const handleEnd = () => {
    if (!drawingRef.current || disabled) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    const canvas = canvasRef.current;
    if (canvas && !empty) {
      onChange?.(canvas.toDataURL("image/png"));
    }
  };

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border-2 border-dashed border-stone-300 bg-white touch-none ${disabled ? "opacity-50" : ""} ${className}`}
      style={{ height }}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        onTouchCancel={handleEnd}
        className={`block w-full h-full select-none ${disabled ? "cursor-not-allowed" : "cursor-crosshair"}`}
      />
      {empty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-stone-400 text-sm select-none">
          Sign here
        </div>
      )}
    </div>
  );
});

export default SignaturePad;
