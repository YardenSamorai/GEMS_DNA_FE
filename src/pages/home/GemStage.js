import { Component, Suspense, lazy, useEffect, useRef, useState } from "react";
import { gemSupport } from "./gemSupport";

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

/**
 * The hero's stone. A still render paints immediately; the live scene loads
 * afterwards where the device can carry it and cross-fades in on its first
 * frame (same pose, so the hand-over is invisible). It only renders while
 * on screen, and follows scroll and a fine pointer — never touch.
 */
export default function GemStage({ heroRef }) {
  const stageRef = useRef(null);
  const motion = useRef({ progress: 0, pointerX: 0, pointerY: 0, still: false });
  const [tier, setTier] = useState("none");
  const [mount, setMount] = useState(false);
  const [live, setLive] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = gemSupport();
    if (t === "none") return undefined;
    setTier(t);
    return whenSettled(() => setMount(true));
  }, []);

  // Reduced motion switched on mid-visit: back to the still render.
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return undefined;
    const onChange = () => {
      if (mq.matches) {
        setLive(false);
        setMount(false);
        setTier("none");
      }
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (!mount) return undefined;
    const el = stageRef.current;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "80px 0px" });
    io.observe(el);

    const hero = heroRef.current;
    let frame = 0;
    const readScroll = () => {
      frame = 0;
      const rect = hero.getBoundingClientRect();
      const span = Math.max(rect.height * 0.9, 1);
      motion.current.progress = Math.min(1, Math.max(0, -rect.top / span));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(readScroll);
    };
    readScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    const fine = window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
    const onPointer = (e) => {
      motion.current.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      motion.current.pointerY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onLeave = () => {
      motion.current.pointerX = 0;
      motion.current.pointerY = 0;
    };
    if (fine) {
      window.addEventListener("pointermove", onPointer, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
    }

    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [mount, heroRef]);

  const fail = () => {
    setLive(false);
    setMount(false);
  };

  return (
    <div ref={stageRef} className={`home-stage${live ? " is-live" : ""}`}>
      <img
        className="home-stage-poster"
        src="/home/gem-poster-1080.webp"
        srcSet="/home/gem-poster-640.webp 640w, /home/gem-poster-1080.webp 1080w"
        sizes="(max-width: 1023px) min(92vw, 620px), 540px"
        width="1080"
        height="993"
        alt=""
        decoding="async"
        fetchPriority="high"
        draggable="false"
      />
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
