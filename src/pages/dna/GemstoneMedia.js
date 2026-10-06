import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { SUPPLIER_FALLBACK_IMAGE } from "../../utils/supplierMedia";
import { CloseIcon, ExpandIcon } from "./icons";
import { FADE, FADE_FAST, SPRING, SPRING_EXIT, shouldDismiss } from "./motion";
import { InOverlayHost } from "./overlayHost";

const RADIUS = 26;

const canHover = () =>
  typeof window !== "undefined" && window.matchMedia?.("(hover: hover)").matches;

export const MediaSwitch = ({ modes, mode, onChange, label = "Media", idPrefix = "dna-seg" }) => (
  <div className="dna-seg" role="tablist" aria-label={label}>
    {modes.map((m) => {
      const active = m.id === mode;
      return (
        <button
          key={m.id}
          type="button"
          role="tab"
          aria-selected={active}
          className={`dna-seg-btn${active ? " is-active" : ""}`}
          onClick={() => onChange(m.id)}
        >
          {active && <motion.span layoutId={`${idPrefix}-pill`} className="dna-seg-pill" transition={SPRING} />}
          <span className="dna-seg-label">{m.label}</span>
        </button>
      );
    })}
  </div>
);

export const PhotoViewer = ({ src, alt, caption, layoutId, onClose }) => {
  const reduce = useReducedMotion();
  const closeRef = useRef(null);
  const y = useMotionValue(0);
  const scale = useTransform(y, [-260, 0, 260], [0.86, 1, 0.86]);
  const dim = useTransform(y, [-260, 0, 260], [0.3, 1, 0.3]);

  useEffect(() => {
    const prev = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  return (
    <InOverlayHost>
    <div className="dna-lightbox" role="dialog" aria-modal="true" aria-label={alt}>
      <motion.div
        style={{ position: "absolute", inset: 0 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: FADE_FAST }}
        transition={FADE}
        onClick={onClose}
      >
        <motion.div className="dna-lightbox-scrim" style={{ opacity: dim }} />
      </motion.div>
      <motion.div
        className="dna-lightbox-figure"
        layoutId={reduce ? undefined : layoutId}
        initial={reduce ? { opacity: 0 } : false}
        animate={reduce ? { opacity: 1 } : undefined}
        exit={reduce ? { opacity: 0 } : undefined}
        style={{ y, scale, borderRadius: RADIUS }}
        transition={SPRING}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.9}
        dragTransition={{ bounceStiffness: 420, bounceDamping: 34 }}
        onDragEnd={(_, info) => {
          if (shouldDismiss(info)) onClose();
        }}
      >
        <img src={src} alt={alt} draggable={false} />
      </motion.div>
      <motion.button
        ref={closeRef}
        type="button"
        className="dna-lightbox-close"
        onClick={onClose}
        aria-label="Close photo"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: FADE_FAST }}
        transition={FADE}
      >
        <CloseIcon size={22} />
      </motion.button>
      {caption && (
        <motion.div
          className="dna-lightbox-caption"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: FADE_FAST }}
          transition={FADE}
        >
          {caption}
        </motion.div>
      )}
    </div>
    </InOverlayHost>
  );
};

/* The stone is the hero. The 360° viewer stays mounted underneath so going
   back to it never reloads; the photo crossfades over it and can be lifted
   into a full-screen viewer that it physically travels to and from. */
const GemstoneMedia = ({ stone, title, photoFailed, onPhotoError, onOverlayChange }) => {
  const reduce = useReducedMotion();
  const hasVideo = Boolean(stone.video);
  const hasPhoto = Boolean(stone.picture) && !photoFailed;
  const [mode, setMode] = useState(hasVideo ? "360" : "photo");
  const [frameReady, setFrameReady] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [hint] = useState(() => (canHover() ? "Click the photo to enlarge" : "Tap the photo to enlarge"));
  const returningRef = useRef(false);
  const layoutId = `dna-photo-${stone.stone_id}`;

  const openViewer = useCallback(() => {
    returningRef.current = false;
    setViewerOpen(true);
  }, []);
  const closeViewer = useCallback(() => {
    returningRef.current = true;
    setViewerOpen(false);
  }, []);

  useEffect(() => {
    setMode(stone.video ? "360" : "photo");
    setFrameReady(false);
    setViewerOpen(false);
  }, [stone.stone_id, stone.video]);

  useEffect(() => {
    if (mode === "photo" && !hasPhoto && hasVideo) setMode("360");
  }, [mode, hasPhoto, hasVideo]);

  useEffect(() => {
    onOverlayChange?.(viewerOpen);
  }, [viewerOpen, onOverlayChange]);

  const changeMode = (next) => {
    returningRef.current = false;
    setMode(next);
  };

  const modes = [
    hasVideo && { id: "360", label: "360° view" },
    hasPhoto && { id: "photo", label: "Photo" },
  ].filter(Boolean);

  const showPhoto = mode === "photo" && hasPhoto;
  const alt = `${title} — photo`;

  return (
    <div>
      <div className="dna-stage">
        {hasVideo && (
          <div className="dna-stage-layer" aria-hidden={showPhoto}>
            {!frameReady && (
              <div className="dna-stage-loading">
                {hasPhoto ? (
                  <img className="dna-stage-poster" src={stone.picture} alt="" />
                ) : (
                  <>
                    <div className="dna-skel" style={{ position: "absolute", inset: 0, borderRadius: 0 }} />
                    <span style={{ position: "relative" }}>Loading 360° view</span>
                  </>
                )}
              </div>
            )}
            <iframe
              className="dna-stage-frame"
              src={stone.video}
              title={`${title} — 360° view`}
              allowFullScreen
              onLoad={() => setFrameReady(true)}
              tabIndex={showPhoto ? -1 : 0}
            />
          </div>
        )}

        <AnimatePresence initial={false}>
          {showPhoto && !viewerOpen && (
            <motion.button
              key="photo"
              type="button"
              className="dna-stage-layer dna-stage-photo"
              layoutId={reduce ? undefined : layoutId}
              style={{ borderRadius: RADIUS, zIndex: 1 }}
              initial={returningRef.current && !reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: FADE_FAST }}
              transition={{ ...SPRING, opacity: FADE }}
              onClick={openViewer}
              aria-label="Enlarge photo"
            >
              <img src={stone.picture} alt={alt} onError={onPhotoError} draggable={false} />
            </motion.button>
          )}
        </AnimatePresence>

        {!hasVideo && !hasPhoto && (
          <img className="dna-stage-layer dna-stage-photo" src={SUPPLIER_FALLBACK_IMAGE} alt="" style={{ cursor: "default" }} />
        )}

        <AnimatePresence>
          {showPhoto && !viewerOpen && (
            <motion.button
              key="expand"
              type="button"
              className="dna-stage-expand"
              onClick={openViewer}
              aria-label="Enlarge photo"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: SPRING_EXIT }}
              transition={SPRING}
            >
              <ExpandIcon size={18} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {modes.length > 0 && (
        <div className="dna-media-foot">
          {modes.length > 1 && <MediaSwitch modes={modes} mode={mode} onChange={changeMode} label="Stone media" />}
          <div className="dna-media-hint" aria-live="polite">
            {mode === "360" && hasVideo ? "Drag inside the view to turn the stone" : hint}
          </div>
        </div>
      )}

      <AnimatePresence>
        {viewerOpen && (
          <PhotoViewer
            key="viewer"
            src={stone.picture}
            alt={alt}
            caption={`${title} · ${stone.stone_id}`}
            layoutId={layoutId}
            onClose={closeViewer}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default GemstoneMedia;
