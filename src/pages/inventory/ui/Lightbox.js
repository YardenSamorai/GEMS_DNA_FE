import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { FADE } from "../../dna/motion";
import { useFocusTrap } from "./hooks";

const LightboxLayer = ({ images, index, video, onClose }) => {
  const ref = useRef(null);
  const [idx, setIdx] = useState(index);
  const count = images.length;
  useFocusTrap(ref, true);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (count > 1 && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        e.stopPropagation();
        setIdx((i) => (i + (e.key === "ArrowRight" ? 1 : -1) + count) % count);
      }
    };
    // Capture so a quick look underneath doesn't also close or change photo.
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose, count]);

  const step = (e, d) => {
    e.stopPropagation();
    setIdx((i) => (i + d + count) % count);
  };

  return (
    <motion.div
      ref={ref}
      className="inv-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={video ? "Video" : count > 1 ? `Image ${idx + 1} of ${count}` : "Image"}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={FADE}
      onClick={onClose}
    >
      {video ? (
        <iframe src={video} title="Video" allow="autoplay; fullscreen" allowFullScreen onClick={(e) => e.stopPropagation()} />
      ) : (
        <img src={images[idx]} alt="" onClick={(e) => e.stopPropagation()} />
      )}
      <button type="button" className="inv-icon-btn" onClick={onClose} aria-label="Close">
        <X size={20} strokeWidth={1.75} />
      </button>
      {!video && count > 1 && (
        <>
          <button type="button" className="inv-icon-btn inv-lightbox-step inv-lightbox-step--prev" onClick={(e) => step(e, -1)} aria-label="Previous photo">
            <ChevronLeft size={22} strokeWidth={1.75} />
          </button>
          <button type="button" className="inv-icon-btn inv-lightbox-step inv-lightbox-step--next" onClick={(e) => step(e, 1)} aria-label="Next photo">
            <ChevronRight size={22} strokeWidth={1.75} />
          </button>
          <span className="inv-lightbox-count">
            {idx + 1} / {count}
          </span>
        </>
      )}
    </motion.div>
  );
};

/* images: every photo to page through; index: the one to open on. */
const Lightbox = ({ images = [], index = 0, video, onClose }) =>
  createPortal(
    <div className="inv">
      <AnimatePresence>
        {(images.length > 0 || video) && <LightboxLayer key="lb" images={images} index={index} video={video} onClose={onClose} />}
      </AnimatePresence>
    </div>,
    document.body
  );

export default Lightbox;
