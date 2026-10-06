import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useDragControls, useReducedMotion } from "framer-motion";
import { ChevronRight, CloseIcon, ExternalIcon, ShieldCheckIcon } from "./icons";
import { FADE, FADE_FAST, SPRING, SPRING_EXIT, shouldDismiss } from "./motion";

const useIsPhone = () => {
  const query = "(max-width: 767.98px)";
  const [match, setMatch] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatch(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return match;
};

// Only where the lab publishes a stable lookup URL keyed by report number.
const labLookupUrl = (lab, number) => {
  if (!lab || !number) return null;
  const key = String(lab).trim().toUpperCase();
  const no = String(number).trim();
  if (key === "GIA" && /^\d+$/.test(no)) return `https://www.gia.edu/report-check?reportno=${no}`;
  return null;
};

const CertificateSheet = ({ url, lab, number, onClose }) => {
  const reduce = useReducedMotion();
  const phone = useIsPhone();
  const drag = useDragControls();
  const closeRef = useRef(null);
  const [loaded, setLoaded] = useState(false);

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

  const sheetMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0, transition: FADE_FAST }, transition: FADE }
    : phone
      ? { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%", transition: SPRING_EXIT }, transition: SPRING }
      : {
          initial: { opacity: 0, scale: 0.96, y: 16 },
          animate: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0, scale: 0.97, y: 10, transition: SPRING_EXIT },
          transition: SPRING,
        };

  const title = lab ? `${lab} report` : "Laboratory report";

  return (
    <div className="dna-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <motion.div
        className="dna-scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.18 } }}
        transition={FADE}
        onClick={onClose}
      />
      <motion.div
        className="dna-sheet"
        {...sheetMotion}
        drag={phone && !reduce ? "y" : false}
        dragListener={false}
        dragControls={drag}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.04, bottom: 0.8 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 0 && shouldDismiss(info)) onClose();
        }}
      >
        <div className="dna-sheet-grab" onPointerDown={(e) => drag.start(e)} aria-hidden="true">
          <span />
        </div>
        <div className="dna-sheet-head" onPointerDown={(e) => phone && drag.start(e)}>
          <div className="dna-sheet-title">
            <strong>{title}</strong>
            {number && <span>No. {number}</span>}
          </div>
          <a className="dna-btn dna-btn--quiet" href={url} target="_blank" rel="noopener noreferrer" style={{ display: phone ? "none" : undefined }}>
            Open PDF
            <ExternalIcon size={16} />
          </a>
          <button ref={closeRef} type="button" className="dna-icon-btn" onClick={onClose} aria-label="Close report">
            <CloseIcon />
          </button>
        </div>
        <div className="dna-sheet-body">
          {!loaded && <div className="dna-skel" style={{ position: "absolute", inset: 0, borderRadius: 0 }} />}
          <iframe src={url} title={title} onLoad={() => setLoaded(true)} />
        </div>
        <div className="dna-sheet-foot">
          <a className="dna-btn-primary" href={url} target="_blank" rel="noopener noreferrer">
            Open full PDF
            <ExternalIcon size={18} />
          </a>
        </div>
      </motion.div>
    </div>
  );
};

/* Verification is the reason a DNA page exists, so the report gets its own
   moment: who graded the stone, under which number, and the document itself
   one tap away — in a sheet, without leaving the page. */
const GemstoneCertificate = ({ lab, number, url, onOverlayChange }) => {
  const [open, setOpen] = useState(false);
  const openSheet = useCallback(() => setOpen(true), []);
  const closeSheet = useCallback(() => setOpen(false), []);
  const lookup = labLookupUrl(lab, number);

  useEffect(() => {
    onOverlayChange?.(open);
  }, [open, onOverlayChange]);

  if (!url && !number) return null;
  const labName = lab || "Laboratory";

  return (
    <section className="dna-section" aria-labelledby="dna-cert-title">
      <div className="dna-section-head">
        <div className="dna-section-eyebrow">Verification</div>
        <h2 id="dna-cert-title" className="dna-section-title">
          {lab ? `Graded by ${lab}.` : "Independently graded."}
        </h2>
        <p className="dna-section-lede">
          This stone is documented in an independent laboratory report. The report number below is
          its permanent reference.
        </p>
      </div>

      <div className="dna-cert">
        <div className="dna-cert-body">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: "var(--dna-accent)", display: "inline-flex" }}>
              <ShieldCheckIcon size={30} />
            </span>
            <div className="dna-cert-lab">{labName}</div>
          </div>
          <dl className="dna-cert-meta" style={{ margin: 0 }}>
            {number && (
              <div>
                <dt>Report number</dt>
                <dd>{number}</dd>
              </div>
            )}
            <div>
              <dt>Document</dt>
              <dd>{url ? "Grading report (PDF)" : "On file"}</dd>
            </div>
          </dl>
          <div className="dna-cert-actions">
            {url && (
              <button type="button" className="dna-btn-primary" onClick={openSheet}>
                View certificate
              </button>
            )}
            {lookup && (
              <a className="dna-btn" href={lookup} target="_blank" rel="noopener noreferrer">
                Verify with {lab}
                <ExternalIcon size={17} />
              </a>
            )}
          </div>
        </div>

        {url && (
          <div className="dna-cert-aside">
            <button type="button" className="dna-doc" onClick={openSheet} aria-label="View certificate">
              <span className="dna-doc-lab">{labName}</span>
              {number && <span className="dna-doc-no">No. {number}</span>}
              <span className="dna-doc-lines" aria-hidden="true">
                <span style={{ width: "92%" }} />
                <span style={{ width: "74%" }} />
                <span style={{ width: "84%" }} />
                <span style={{ width: "58%" }} />
              </span>
              <span className="dna-doc-open">
                View report
                <ChevronRight size={15} />
              </span>
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {open && url && <CertificateSheet key="sheet" url={url} lab={lab} number={number} onClose={closeSheet} />}
      </AnimatePresence>
    </section>
  );
};

export default GemstoneCertificate;
