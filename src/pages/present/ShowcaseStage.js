import React, { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FileText } from "lucide-react";
import { API_BASE } from "../inventory/helpers/constants";
import { directVideoUrl } from "./presentModel";

/* The stage takes the shape of what it shows, so there is never a margin
 * between the media and its rounded edge. */
const clampAspect = (a) => (Number.isFinite(a) && a > 0 ? Math.min(Math.max(a, 0.75), 1.6) : 1);

/* V360 / d360 players lay out from their own window size and never scale the
 * stone past its native 601×599, leaving white page around it. In a 600×700
 * window both draw it flush at the top-left, 600px wide — so the iframe always
 * gets exactly that window, is scaled as a whole to the stage, and everything
 * outside the stone (white page, the players' 17px corners) is cropped. */
const SPIN_WINDOW = { w: 600, h: 700 };
const SPIN_CROP = { x: 1, y: 1, w: 598, h: 594 };
export const SPIN_ASPECT = SPIN_CROP.w / SPIN_CROP.h;
const SPIN_CORNER = 18;
export const spinRadius = (width, base) => Math.max(base, Math.ceil((SPIN_CORNER * width) / SPIN_CROP.w) + 4);

/* Muted + playsInline is what lets iPadOS autoplay. The element is fully
 * released on unmount: iOS keeps a media session alive for <video> nodes
 * removed while loaded, which can leave taps dead page-wide afterwards. */
const LoopVideo = ({ src, onFail, onAspect }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    el.muted = true;
    el.play?.().catch(() => {});
    return () => {
      try {
        el.pause();
        el.removeAttribute("src");
        el.load();
      } catch {
        /* already gone */
      }
    };
  }, [src]);
  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video
      ref={ref}
      src={src}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      onError={onFail}
      onLoadedMetadata={(e) => onAspect(e.currentTarget.videoWidth / e.currentTarget.videoHeight)}
      className="absolute inset-0 h-full w-full select-none object-cover"
    />
  );
};

/* Visitors can drag inside it to turn the stone themselves. The photo
 * underneath covers the player's own loading, so it fades in only once the
 * frames had a moment to paint. */
const SpinFrame = ({ src, title, width }) => {
  const [ready, setReady] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!ready) return undefined;
    const el = ref.current;
    return () => {
      // iOS: a removed iframe can keep ghost focus and swallow later taps.
      if (el && document.activeElement === el) {
        el.blur();
        window.focus();
      }
    };
  }, [ready]);
  const k = width / SPIN_CROP.w;
  return (
    <iframe
      ref={ref}
      src={src}
      title={title}
      onLoad={() => setTimeout(() => setReady(true), 700)}
      frameBorder="0"
      scrolling="no"
      allow="autoplay; fullscreen; accelerometer; gyroscope"
      className={`absolute left-0 top-0 max-w-none border-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
      style={{
        width: SPIN_WINDOW.w,
        height: SPIN_WINDOW.h,
        transformOrigin: "0 0",
        transform: `scale(${k}) translate(${-SPIN_CROP.x}px, ${-SPIN_CROP.y}px)`,
      }}
    />
  );
};

const Photo = ({ src, alt, drift, duration, onPanEnd, onAspect, contain }) => {
  const reduceMotion = useReducedMotion();
  const move = drift && !reduceMotion;
  return (
    <motion.img
      key={src}
      src={src}
      alt={alt}
      draggable={false}
      onPanEnd={onPanEnd}
      onLoad={(e) => onAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
      initial={{ opacity: 0, scale: 1 }}
      animate={{ opacity: 1, scale: move ? 1.06 : 1 }}
      transition={{ opacity: { duration: 0.5 }, scale: { duration: duration / 1000, ease: "linear" } }}
      className={`absolute inset-0 h-full w-full select-none ${contain ? "object-contain p-[5%]" : "object-cover"}`}
      style={{ touchAction: "pan-y pinch-zoom" }}
    />
  );
};

const Empty = ({ children }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[15px] text-[#86868b]">{children}</div>
);

/* Renders the media for one stage of `size` ({w, h}); reports the media's own
 * aspect through onAspect so the parent can reshape the stage to it. */
const ShowcaseStage = ({ m, poster, title, duration, onSwipe, size, onAspect }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [m?.src]);

  const video = m?.type === "video" ? directVideoUrl(m.src, API_BASE) : null;
  const spin = m?.type === "video" && !video && !failed;
  const report = (a) => onAspect(clampAspect(a));

  useEffect(() => {
    if (spin) onAspect(SPIN_ASPECT);
    else if (!m || (m.type === "cert" && !m.image)) onAspect(1);
  }, [spin, m, onAspect]);

  let content;
  if (!m) {
    content = <Empty>No media</Empty>;
  } else if (spin) {
    content = (
      <>
        {poster && (
          <img src={poster} alt="" aria-hidden="true" draggable={false} className="absolute inset-0 h-full w-full select-none object-cover" />
        )}
        <SpinFrame key={m.src} src={m.src} title={`${title} 360°`} width={size.w} />
      </>
    );
  } else if (m.type === "video" && !failed) {
    content = <LoopVideo key={video} src={video} onFail={() => setFailed(true)} onAspect={report} />;
  } else if (m.type === "cert") {
    content = m.image ? (
      <Photo src={m.src} alt={`Certificate for ${title}`} onPanEnd={onSwipe} onAspect={report} contain duration={duration} />
    ) : (
      <Empty>
        <FileText size={40} strokeWidth={1.2} />
        Certificate available on request
      </Empty>
    );
  } else {
    const src = m.type === "image" ? m.src : poster;
    content = src ? (
      <Photo src={src} alt={title} drift duration={duration} onPanEnd={onSwipe} onAspect={report} />
    ) : (
      <Empty>No media</Empty>
    );
  }

  return (
    <div
      className="relative overflow-hidden bg-white shadow-[0_2px_6px_rgba(0,0,0,0.05),0_24px_64px_rgba(0,0,0,0.12)] transition-[width,height] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
      style={{ width: size.w, height: size.h, borderRadius: spin ? spinRadius(size.w, 28) : 28 }}
    >
      {content}
    </div>
  );
};

export default ShowcaseStage;
