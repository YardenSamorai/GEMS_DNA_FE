import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import toast from "react-hot-toast";
import { CheckIcon, CopyIcon, LockIcon, ShareIcon, VideoIcon } from "./icons";
import { FADE_FAST, SPRING } from "./motion";

const CopySku = ({ sku }) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sku);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
      toast.success("SKU copied", { duration: 1500, style: { fontSize: "13px" } });
    } catch {
      toast.error("Couldn't copy the SKU");
    }
  };

  return (
    <button type="button" className="dna-sku dna-num" onClick={copy} aria-label={`Copy SKU ${sku}`}>
      {sku}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={copied ? "done" : "copy"}
          style={{ display: "inline-flex" }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6, transition: FADE_FAST }}
          transition={SPRING}
        >
          {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
};

export const PriceSummary = ({ perCarat, total, perCaratLabel = "Price per carat", totalLabel = "Total price" }) => (
  <div className="dna-price">
    <div className="dna-price-caption">
      <LockIcon size={13} />
      Visible to Gems DNA staff only
    </div>
    <div className="dna-price-panel">
      <div className="dna-price-cell">
        <div className="dna-price-label">{perCaratLabel}</div>
        <div className="dna-price-value">{perCarat}</div>
      </div>
      <div className="dna-price-cell">
        <div className="dna-price-label">{totalLabel}</div>
        <div className="dna-price-value dna-price-value--total">{total}</div>
      </div>
    </div>
  </div>
);

export const InlineActions = ({ onInterested, onShare, onShareVideo, interestedLabel = "I'm interested" }) => (
  <div className="dna-actions dna-actions--inline" style={{ "--dna-secondary": onShareVideo ? 2 : 1 }}>
    <button type="button" className="dna-btn-primary" onClick={onInterested}>
      {interestedLabel}
    </button>
    <button type="button" className="dna-btn" onClick={onShare}>
      <ShareIcon size={18} />
      Share
    </button>
    {onShareVideo && (
      <button type="button" className="dna-btn" onClick={onShareVideo}>
        <VideoIcon size={18} />
        Share video
      </button>
    )}
  </div>
);

/* Identity first: what the stone is, in the words a grading report would
   use, then the handful of facts a buyer checks before anything else. */
const GemstoneIdentity = ({ stone, title, subtitle, facts, titleRef, children, eyebrow = "Gemstone DNA", skus }) => {
  const reduce = useReducedMotion();
  const rise = (i) => ({
    initial: { opacity: 0, y: reduce ? 0 : 10 },
    animate: { opacity: 1, y: 0 },
    transition: { ...SPRING, delay: reduce ? 0 : 0.04 * i },
  });

  return (
    <div>
      <motion.div className="dna-eyebrow" {...rise(0)}>
        <span className="dna-eyebrow-mark">
          <span className="dna-brand-dot" aria-hidden="true" />
          {eyebrow}
        </span>
        {(skus || [stone.stone_id]).map((sku) => (
          <CopySku key={sku} sku={sku} />
        ))}
      </motion.div>

      <motion.h1 ref={titleRef} className="dna-title dna-num" {...rise(1)}>
        {title}
      </motion.h1>
      {subtitle && (
        <motion.p className="dna-subtitle" {...rise(2)}>
          {subtitle}
        </motion.p>
      )}

      {facts.length > 0 && (
        <motion.dl className="dna-facts" style={{ "--dna-facts": facts.length }} {...rise(3)}>
          {facts.map((f) => (
            <div key={f.label} className="dna-fact">
              <dt className="dna-fact-label">{f.label}</dt>
              <dd className="dna-fact-value">{f.value}</dd>
            </div>
          ))}
        </motion.dl>
      )}

      {children && <motion.div {...rise(4)}>{children}</motion.div>}
    </div>
  );
};

export default GemstoneIdentity;
