import { Component, Suspense, lazy, useEffect, useRef, useState } from "react";
import { CHAPTERS } from "./timeline";

const GemCanvas = lazy(() => import(/* webpackChunkName: "home-gem" */ "./three/GemCanvas"));

class SceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/* After first paint and idle time, so the 3D never competes with the text. */
const whenSettled = (fn) => {
  let idle;
  const run = () => {
    idle = window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout: 1500 }) : window.setTimeout(fn, 300);
  };
  if (document.readyState === "complete") run();
  else window.addEventListener("load", run, { once: true });
  return () => {
    window.removeEventListener("load", run);
    if (window.cancelIdleCallback && idle) window.cancelIdleCallback(idle);
    else window.clearTimeout(idle);
  };
};

export const stillSrc = (id, w) => `/home/gem-${id}-${w}.webp`;
export const STILL_SIZES = "(max-width: 1023px) min(92vw, 620px), 600px";

/**
 * The hero's stone. A still of the current chapter paints immediately; where
 * the device can carry it, the live scene loads afterwards and cross-fades in
 * on its first frame. It renders only while on screen, and follows scroll
 * (through `motion`) and a fine pointer — never touch.
 */
export default function GemStage({ motion, tier, chapter }) {
  const stageRef = useRef(null);
  const [mount, setMount] = useState(false);
  const [live, setLive] = useState(false);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (tier === "none") return undefined;
    return whenSettled(() => setMount(true));
  }, [tier]);

  // Dev builds only: lets the still renderer pose the live scene.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return undefined;
    window.__gemMotion = motion;
    return () => delete window.__gemMotion;
  }, [motion]);

  useEffect(() => {
    if (!mount) return undefined;
    const el = stageRef.current;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "80px 0px" });
    io.observe(el);

    const fine = window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
    if (!fine) return () => io.disconnect();
    const onPointer = (e) => {
      motion.current.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      motion.current.pointerY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onLeave = () => {
      motion.current.pointerX = 0;
      motion.current.pointerY = 0;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      io.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [mount, motion]);

  const fail = () => {
    setLive(false);
    setMount(false);
    setFailed(true);
  };

  // Devices that get the live scene only ever need the first still.
  const allStills = tier === "none" || failed;
  const shown = CHAPTERS[chapter].id;

  return (
    <div ref={stageRef} className={`home-stage${live ? " is-live" : ""}`}>
      {CHAPTERS.map(({ id }) =>
        id === "rough" || allStills ? (
          <img
            key={id}
            className={`home-stage-poster${id === shown || (!allStills && id === "rough") ? " is-shown" : ""}`}
            src={stillSrc(id, 1080)}
            srcSet={`${stillSrc(id, 640)} 640w, ${stillSrc(id, 1080)} 1080w`}
            sizes={STILL_SIZES}
            width="1080"
            height="993"
            alt=""
            decoding="async"
            fetchPriority={id === "rough" ? "high" : "low"}
            draggable="false"
          />
        ) : null
      )}
      {mount && tier !== "none" && (
        <SceneBoundary onFail={fail}>
          <Suspense fallback={null}>
            <GemCanvas motion={motion} tier={tier} active={visible} onReady={() => setLive(true)} onFail={fail} />
          </Suspense>
        </SceneBoundary>
      )}
    </div>
  );
}
