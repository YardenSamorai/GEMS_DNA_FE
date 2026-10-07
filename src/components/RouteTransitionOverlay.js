import React, { useEffect, useRef, useState } from "react";
import SpinningGem from "./SpinningGem";
import { useIsRouteLoading } from "./RouteLoadingContext";

/**
 * RouteTransitionOverlay — full-screen SpinningGem shown while a page that
 * opted in with `useRouteLoading(true)` is still fetching its first data.
 *
 * Navigation itself never shows it: most pages render their own skeletons
 * at once, and a loader on every route change only adds waiting. A load
 * that finishes within SHOW_DELAY_MS is never covered at all; once shown,
 * the overlay stays MIN_VISIBLE_MS so it can't flash.
 */
const SHOW_DELAY_MS = 250;
const MIN_VISIBLE_MS = 400;
const FADE_MS = 200;

export default function RouteTransitionOverlay() {
  const loading = useIsRouteLoading();
  const [mounted, setMounted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    if (loading) {
      setLeaving(false);
      if (mounted) return undefined;
      const t = setTimeout(() => {
        shownAt.current = performance.now();
        setMounted(true);
      }, SHOW_DELAY_MS);
      return () => clearTimeout(t);
    }
    if (!mounted) return undefined;
    const wait = Math.max(0, MIN_VISIBLE_MS - (performance.now() - shownAt.current));
    let t = setTimeout(() => {
      setLeaving(true);
      t = setTimeout(() => {
        setMounted(false);
        setLeaving(false);
      }, FADE_MS);
    }, wait);
    return () => clearTimeout(t);
  }, [loading, mounted]);

  if (!mounted) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading page"
      className="route-overlay fixed inset-0 z-[80] flex items-center justify-center pointer-events-none"
      style={{
        backgroundColor: "rgb(var(--app-canvas) / 0.78)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        opacity: leaving ? 0 : 1,
        transition: `opacity ${FADE_MS}ms cubic-bezier(0.25, 1, 0.5, 1)`,
      }}
    >
      <SpinningGem />
    </div>
  );
}
