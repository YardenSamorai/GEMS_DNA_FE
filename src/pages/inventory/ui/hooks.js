import { useEffect, useLayoutEffect, useRef, useState } from "react";

export const useMediaQuery = (query) => {
  const get = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, [query]);
  return matches;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

export const focusablesIn = (root) =>
  root ? Array.from(root.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement) : [];

/* Keeps Tab inside `ref` while active and hands focus back to whatever had
 * it before when the layer closes. */
export const useFocusTrap = (ref, active, { initialFocus, restore = true } = {}) => {
  useEffect(() => {
    if (!active) return undefined;
    const previous = document.activeElement;
    const root = ref.current;
    const first = initialFocus?.current || root;
    const id = requestAnimationFrame(() => first?.focus?.({ preventScroll: true }));
    const onKeyDown = (e) => {
      if (e.key !== "Tab" || !ref.current) return;
      const items = focusablesIn(ref.current);
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const head = items[0];
      const tail = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === head || document.activeElement === ref.current)) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("keydown", onKeyDown);
      if (restore && previous && typeof previous.focus === "function" && document.contains(previous)) {
        previous.focus({ preventScroll: true });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
};

/* The app shell scrolls <main> on phones and the document on desktop. */
export const getScroller = (el) => {
  let node = el?.parentElement;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return null;
};

export const getScrollTop = (scroller) => (scroller ? scroller.scrollTop : window.scrollY);
export const setScrollTop = (scroller, top) => {
  if (scroller) scroller.scrollTop = top;
  else window.scrollTo(0, top);
};

/* Freezes page scroll under a modal layer. */
export const useScrollLock = (active) => {
  useLayoutEffect(() => {
    if (!active) return undefined;
    const main = document.querySelector("main");
    const prevBody = document.body.style.overflow;
    const prevMain = main?.style.overflow;
    document.body.style.overflow = "hidden";
    if (main) main.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      if (main) main.style.overflow = prevMain;
    };
  }, [active]);
};

export const useLatest = (value) => {
  const ref = useRef(value);
  ref.current = value;
  return ref;
};
