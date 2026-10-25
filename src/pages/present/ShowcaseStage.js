import React, { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FileText } from "lucide-react";
import { API_BASE } from "../inventory/helpers/constants";
import { directVideoUrl } from "./presentModel";

/* Muted + playsInline is what lets iPadOS autoplay. The element is fully
 * released on unmount: iOS keeps a media session alive for <video> nodes
 * removed while loaded, which can leave taps dead page-wide afterwards. */
const LoopVideo = ({ src, onFail }) => {
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
      className="relative h-full w-full select-none object-contain"
    />
  );
};

/* V360 and other hosted spins. The photo stays visible underneath until the
 * player has loaded, so a slow spin never shows as a blank box. Visitors can
 * drag inside it to turn the stone themselves. */
const SpinFrame = ({ src, title }) => {
  const [ready, setReady] = useState(false);
  const ref = useRef(null);
  useEffect(
    () => () => {
      // iOS: a removed iframe can keep ghost focus and swallow later taps.
      const ae = document.activeElement;
      if (ae && ae === ref.current) {
        ae.blur();
        window.focus();
      }
    },
    []
  );
  return (
    <iframe
      ref={ref}
      src={src}
      title={title}
      onLoad={() => setReady(true)}
      frameBorder="0"
      allow="autoplay; fullscreen; accelerometer; gyroscope"
      className={`relative h-full w-full transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
    />
  );
};

const Photo = ({ src, alt, drift, duration, onPanEnd, contain = true, padded }) => {
  const reduceMotion = useReducedMotion();
  const move = drift && !reduceMotion;
  return (
    <motion.img
      key={src}
      src={src}
      alt={alt}
      draggable={false}
      onPanEnd={onPanEnd}
      initial={{ opacity: 0, scale: 1 }}
      animate={{ opacity: 1, scale: move ? 1.07 : 1 }}
      transition={{ opacity: { duration: 0.5 }, scale: { duration: duration / 1000, ease: "linear" } }}
      className={`relative h-full w-full select-none ${contain ? "object-contain" : "object-cover"} ${padded ? "p-[6%]" : ""}`}
      style={{ touchAction: "pan-y pinch-zoom" }}
    />
  );
};

/* Coloured light around the stage: the stone's own photo, blurred far out,
 * so an emerald glows green and a diamond glows cool white. */
export const Glow = ({ src }) =>
  src ? (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      className="pointer-events-none absolute -inset-[12%] h-[124%] w-[124%] select-none object-cover opacity-50 blur-[90px] saturate-150"
    />
  ) : null;

const ShowcaseStage = ({ m, poster, title, duration, onSwipe }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [m?.src]);

  const video = m?.type === "video" ? directVideoUrl(m.src, API_BASE) : null;

  let content;
  if (!m) {
    content = <div className="flex h-full items-center justify-center text-[15px] text-white/40">No media</div>;
  } else if (m.type === "video" && !failed) {
    content = video ? (
      <LoopVideo key={video} src={video} onFail={() => setFailed(true)} />
    ) : (
      <SpinFrame key={m.src} src={m.src} title={`${title} 360°`} />
    );
  } else if (m.type === "cert") {
    content = m.image ? (
      <div className="relative h-full w-full bg-white">
        <Photo src={m.src} alt={`Certificate for ${title}`} onPanEnd={onSwipe} padded duration={duration} />
      </div>
    ) : (
      <div className="relative flex h-full flex-col items-center justify-center gap-3 text-white/60">
        <FileText size={44} strokeWidth={1.2} />
        <p className="text-[15px]">Certificate available on request</p>
      </div>
    );
  } else {
    const src = m.type === "image" ? m.src : poster;
    content = src ? (
      <Photo src={src} alt={title} drift duration={duration} onPanEnd={onSwipe} />
    ) : (
      <div className="flex h-full items-center justify-center text-[15px] text-white/40">No media</div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[36px] bg-[#0d0d0f] shadow-[0_40px_120px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
      {poster && (
        <img
          src={poster}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full scale-150 select-none object-cover opacity-80 blur-3xl"
        />
      )}
      {poster && m?.type === "video" && !video && !failed && (
        <img src={poster} alt="" aria-hidden="true" draggable={false} className="absolute inset-0 h-full w-full select-none object-contain" />
      )}
      {content}
    </div>
  );
};

export default ShowcaseStage;
