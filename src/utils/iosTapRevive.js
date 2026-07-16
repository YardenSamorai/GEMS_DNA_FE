/* ============================================================================
 * iosTapRevive — safety net for the iOS Safari "dead taps" bug.
 *
 * On some iOS versions, WebKit's click synthesis can break page-wide after
 * certain interactions (video elements being played/removed, layer changes
 * mid-touch, etc.): touchstart/touchend still fire, scrolling still works,
 * but Safari never dispatches the `click` — so every button in the app goes
 * dead until a full page reload. There is no programmatic way to repair
 * Safari's synthesis once it breaks (confirmed upstream, WebKit bug), so
 * instead we watch every tap and, if Safari fails to deliver its click
 * within a grace period, dispatch the click ourselves.
 *
 * Deliberately conservative — a synthetic click is only fired when ALL hold:
 *   - single-finger touch that didn't move (a real tap, not a swipe/drag)
 *   - finger down for < 700ms (not a long-press)
 *   - no scrolling anywhere between touchstart and the check (tapping to
 *     stop momentum scroll legitimately produces no click)
 *   - the page didn't preventDefault() the touchend (intentional opt-out)
 *   - no trusted click arrived within 350ms of the touchend
 *   - the target is still in the document and isn't a <video>/<iframe>
 *     (their native controls handle taps internally, no click expected)
 * ========================================================================== */

const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iP(hone|od|ad)/.test(navigator.userAgent) ||
    // iPadOS 13+ masquerades as macOS but is the only "Mac" with touch.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export const installIosTapRevive = () => {
  if (typeof window === "undefined" || !isIOS()) return;

  let tap = null; // { x, y, t, target, moved }
  let lastTrustedClick = 0;
  let lastScroll = 0;

  document.addEventListener(
    "click",
    (e) => {
      if (e.isTrusted) lastTrustedClick = Date.now();
    },
    true
  );

  // Any scroll (document or inner container) disqualifies the current tap.
  document.addEventListener(
    "scroll",
    () => {
      lastScroll = Date.now();
    },
    { capture: true, passive: true }
  );

  document.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1) {
        tap = null;
        return;
      }
      const t = e.touches[0];
      tap = { x: t.clientX, y: t.clientY, t: Date.now(), target: e.target, moved: false };
    },
    { capture: true, passive: true }
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      if (!tap) return;
      const t = e.touches[0];
      if (Math.abs(t.clientX - tap.x) > 10 || Math.abs(t.clientY - tap.y) > 10) {
        tap.moved = true;
      }
    },
    { capture: true, passive: true }
  );

  document.addEventListener(
    "touchcancel",
    () => {
      tap = null;
    },
    { capture: true, passive: true }
  );

  document.addEventListener(
    "touchend",
    (e) => {
      const current = tap;
      tap = null;
      if (!current || current.moved) return;
      const now = Date.now();
      if (now - current.t > 700) return; // long-press, not a tap
      if (e.defaultPrevented) return; // page suppressed the click on purpose
      if (lastScroll >= current.t) return; // tap-to-stop momentum scroll

      const touchEndAt = now;
      const { target, x, y } = current;

      window.setTimeout(() => {
        if (lastTrustedClick >= touchEndAt) return; // Safari delivered — all good
        if (lastScroll >= current.t) return;
        if (!document.contains(target)) return;

        const tag = (target.tagName || "").toUpperCase();
        if (tag === "VIDEO" || tag === "IFRAME") return;
        if (typeof target.closest === "function" && target.closest("video, iframe")) return;
        if (target.disabled || (typeof target.closest === "function" && target.closest("[disabled]"))) return;

        // Text fields need focus, which an untrusted click won't grant.
        if (typeof target.matches === "function" && target.matches("input, textarea, select, [contenteditable]")) {
          try {
            target.focus();
          } catch {
            /* non-fatal */
          }
        }

        const proceeded = target.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: x,
            clientY: y,
          })
        );

        // Browsers ignore untrusted clicks for anchor navigation — finish the
        // job by hand (unless a handler preventDefault()ed, e.g. router links).
        if (proceeded && typeof target.closest === "function") {
          const a = target.closest("a[href]");
          if (a && a.getAttribute("href") && !a.getAttribute("href").startsWith("#")) {
            if (a.target === "_blank") window.open(a.href, "_blank", "noopener,noreferrer");
            else window.location.assign(a.href);
          }
        }
      }, 350);
    },
    { capture: true, passive: true }
  );
};
