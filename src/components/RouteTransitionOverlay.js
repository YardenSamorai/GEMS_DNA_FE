import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import SpinningGem from "./SpinningGem";
import { useIsRouteLoading } from "./RouteLoadingContext";

/**
 * RouteTransitionOverlay — fixed full-screen overlay that shows the
 * SpinningGem during page transitions.
 *
 * Two signals keep it visible:
 *   1) Pathname changes — kicks off a minimum window so the gem is
 *      visible long enough to register, even for ultra-fast pages.
 *   2) Any page reporting `useRouteLoading(true)` — keeps the overlay
 *      up until the page reports it has finished fetching.
 *
 * Pages that haven't opted into useRouteLoading still get the minimum
 * window on every transition, so the system feels consistent.
 *
 * The overlay backdrop uses the theme canvas variable, so it works on
 * both light and dark themes. It fades out smoothly when the page is
 * ready instead of snapping.
 */

// Minimum wall-clock the overlay stays up after a route change, even
// if the page has no data to fetch. Picked so the gem makes a couple
// of frames of motion (~half a rotation) before it disappears.
const MIN_DURATION_MS = 350;
// Fade-out duration applied after the overlay decides to hide.
const FADE_OUT_MS = 220;

export default function RouteTransitionOverlay() {
  const location = useLocation();
  const pageLoading = useIsRouteLoading();
  // Tracks whether the "min duration after a route change" window is
  // still open. Separate from `pageLoading` so the overlay stays up
  // for at least MIN_DURATION_MS even when the destination page never
  // reports loading.
  const [withinMinWindow, setWithinMinWindow] = useState(false);
  // `visible` mirrors the actual mount; `entering` adds a CSS class
  // for the fade-out transition.
  const [mounted, setMounted] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const fadeTimerRef = useRef(null);

  // 1) Open the minimum window on every route change.
  useEffect(() => {
    setWithinMinWindow(true);
    const t = setTimeout(() => setWithinMinWindow(false), MIN_DURATION_MS);
    return () => clearTimeout(t);
  }, [location.pathname]);

  // 2) Decide whether the overlay should be on screen. We combine the
  //    "in flight" signals and animate the fade-out when they all
  //    settle to false.
  const shouldShow = withinMinWindow || pageLoading;

  useEffect(() => {
    if (shouldShow) {
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
      setFadingOut(false);
      setMounted(true);
    } else if (mounted) {
      setFadingOut(true);
      fadeTimerRef.current = setTimeout(() => {
        setMounted(false);
        setFadingOut(false);
      }, FADE_OUT_MS);
    }
    return () => {
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
    };
  }, [shouldShow, mounted]);

  if (!mounted) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading page"
      className="fixed inset-0 z-[80] flex items-center justify-center pointer-events-none"
      style={{
        backgroundColor: "rgb(var(--app-canvas) / 0.78)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        opacity: fadingOut ? 0 : 1,
        transition: `opacity ${FADE_OUT_MS}ms ease`,
      }}
    >
      <SpinningGem />
    </div>
  );
}
