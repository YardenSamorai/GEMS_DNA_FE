import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SUPPLIER_FALLBACK_IMAGE } from "../../utils/supplierMedia";
import GemstoneIdentity, { InlineActions, PriceSummary } from "./GemstoneIdentity";
import { PhotoViewer } from "./GemstoneMedia";
import { CertificateSheet } from "./GemstoneCertificate";
import { ChevronRight } from "./icons";
import { dnaTitle, formatCarat } from "./dnaModel";
import { pairFacts, pairSubtitle, pairTitle } from "./pairModel";
import { FADE, FADE_FAST, SPRING } from "./motion";

const CELL_RADIUS = 16;

/* Both stones on one surface, same scale, nothing cropped: a matched pair is
   judged by looking at the two together. Only photos load here — each 360°
   viewer opens on request, so the QR scan still lands fast. */
const PairStage = ({ stones, failed, onPhotoError, onSelect, onOverlayChange }) => {
  const reduce = useReducedMotion();
  const [viewer, setViewer] = useState(null);
  const [spin, setSpin] = useState(null);
  const closeViewer = useCallback(() => setViewer(null), []);
  const closeSpin = useCallback(() => setSpin(null), []);

  useEffect(() => {
    onOverlayChange?.(Boolean(viewer || spin));
  }, [viewer, spin, onOverlayChange]);

  const open = stones.find((s) => s.stone_id === viewer);
  const openIndex = stones.indexOf(open);
  const spinning = stones.find((s) => s.stone_id === spin);

  return (
    <div className="dna-pairstage">
      {stones.map((stone, i) => {
        const hasPhoto = Boolean(stone.picture) && !failed[stone.stone_id];
        const layoutId = `dna-pair-photo-${stone.stone_id}`;
        return (
          <figure key={stone.stone_id} className="dna-pairstage-cell">
            <div className="dna-pairstage-media">
              <AnimatePresence initial={false}>
                {hasPhoto && viewer !== stone.stone_id && (
                  <motion.button
                    key="photo"
                    type="button"
                    className="dna-pairstage-photo"
                    layoutId={reduce ? undefined : layoutId}
                    style={{ borderRadius: CELL_RADIUS }}
                    transition={{ ...SPRING, opacity: FADE }}
                    exit={{ opacity: 0, transition: FADE_FAST }}
                    onClick={() => setViewer(stone.stone_id)}
                    aria-label={`Enlarge photo of stone ${i + 1}`}
                  >
                    <img
                      src={stone.picture}
                      alt={`Stone ${i + 1} — ${dnaTitle(stone)}`}
                      onError={() => onPhotoError(stone.stone_id)}
                      draggable={false}
                    />
                  </motion.button>
                )}
              </AnimatePresence>
              {!hasPhoto && <img className="dna-pairstage-fallback" src={SUPPLIER_FALLBACK_IMAGE} alt="" />}
              {stone.video && (
                <button type="button" className="dna-pairstage-chip" onClick={() => setSpin(stone.stone_id)} aria-label={`360° view of stone ${i + 1}`}>
                  360°
                </button>
              )}
            </div>
            <figcaption>
              <button type="button" className="dna-pairstage-caption" onClick={() => onSelect(stone.stone_id)}>
                <span className="dna-pairstage-label">Stone {i + 1}</span>
                <span className="dna-pairstage-weight dna-num">{formatCarat(stone.carat) || stone.stone_id}</span>
                <span className="dna-pairstage-sku dna-num">
                  {stone.stone_id}
                  <ChevronRight size={13} />
                </span>
              </button>
            </figcaption>
          </figure>
        );
      })}

      <AnimatePresence>
        {open && (
          <PhotoViewer
            key="viewer"
            src={open.picture}
            alt={`Stone ${openIndex + 1} — ${dnaTitle(open)}`}
            caption={`Stone ${openIndex + 1} · ${open.stone_id}`}
            layoutId={`dna-pair-photo-${open.stone_id}`}
            onClose={closeViewer}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {spinning && (
          <CertificateSheet
            key="spin"
            url={spinning.video}
            title="360° view"
            subtitle={`Stone ${stones.indexOf(spinning) + 1} · ${spinning.stone_id}`}
            openLabel="New tab"
            footLabel="Open 360° view"
            live
            onClose={closeSpin}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const DnaPairHero = ({
  a,
  b,
  failed,
  onPhotoError,
  onSelect,
  onOverlayChange,
  titleRef,
  prices,
  onInterested,
  onShare,
  onShareVideo,
}) => (
  <div className="dna-hero">
    <div className="dna-hero-media">
      <PairStage stones={[a, b]} failed={failed} onPhotoError={onPhotoError} onSelect={onSelect} onOverlayChange={onOverlayChange} />
      <div className="dna-media-foot">
        <div className="dna-media-hint">Select a stone to open its own DNA</div>
      </div>
    </div>
    <div className="dna-hero-info">
      <GemstoneIdentity
        stone={a}
        skus={[]}
        eyebrow="Matched pair"
        title={pairTitle(a, b)}
        subtitle={pairSubtitle(a, b)}
        facts={pairFacts(a, b)}
        titleRef={titleRef}
      >
        {prices && (
          <PriceSummary perCarat={prices.perCarat} total={prices.total} perCaratLabel="Price per carat · pair" totalLabel="Pair total" />
        )}
        <InlineActions
          onInterested={onInterested}
          onShare={onShare}
          onShareVideo={onShareVideo}
          interestedLabel="I'm interested in this pair"
        />
      </GemstoneIdentity>
    </div>
  </div>
);

export default DnaPairHero;
