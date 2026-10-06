import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { FADE } from "../../dna/motion";
import { useFocusTrap } from "./hooks";

const LightboxLayer = ({ image, video, onClose }) => {
  const ref = useRef(null);
  useFocusTrap(ref, true);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    // Capture so a quick look underneath doesn't also close.
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      className="inv-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={video ? "Video" : "Image"}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={FADE}
      onClick={onClose}
    >
      {video ? (
        <iframe src={video} title="Video" allow="autoplay; fullscreen" allowFullScreen onClick={(e) => e.stopPropagation()} />
      ) : (
        <img src={image} alt="" onClick={(e) => e.stopPropagation()} />
      )}
      <button type="button" className="inv-icon-btn" onClick={onClose} aria-label="Close">
        <X size={20} strokeWidth={1.75} />
      </button>
    </motion.div>
  );
};

const Lightbox = ({ image, video, onClose }) =>
  createPortal(
    <div className="inv">
      <AnimatePresence>
        {(image || video) && <LightboxLayer key="lb" image={image} video={video} onClose={onClose} />}
      </AnimatePresence>
    </div>,
    document.body
  );

export default Lightbox;
