import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import DnaNav from "./DnaNav";
import DnaActionBar from "./DnaActionBar";
import DnaPairSwitch from "./DnaPairSwitch";
import DnaPairHero from "./DnaPairHero";
import DnaPairStones from "./DnaPairStones";
import DnaPairCertificates from "./DnaPairCertificates";
import DnaPairComparison from "./DnaPairComparison";
import { DnaFooter, GemstoneDnaBody } from "./GemstoneDnaPage";
import { dnaTitle } from "./dnaModel";
import { orderPair, pairTitle } from "./pairModel";
import { SPRING } from "./motion";
import { DnaRoot } from "./overlayHost";
import "./dna.css";

const VIEW_SHIFT = 28;

// Entrance only: the outgoing view leaves at once (an exit phase would hold the
// shared-element photos hostage), the incoming one arrives from the side the
// switcher moved toward.
const enterFrom = (dir, reduce) => (dir === 0 ? false : { opacity: 0, x: reduce ? 0 : dir * VIEW_SHIFT });
const CENTER = { opacity: 1, x: 0 };
const ENTER_TRANSITION = { ...SPRING, opacity: { duration: 0.22 } };

/* A matched pair: the pair first, then each of its two stones. All three views
   are drawn from the pair record already in memory, so switching never waits
   on the network; the URL still changes so every view can be shared. */
const DnaPairPage = ({
  a: rawA,
  b: rawB,
  view,
  onSelect,
  isSignedIn,
  certUrlFor,
  pairPrices,
  pricesFor,
  onBack,
  onInterested,
  onShare,
  pairShareVideo,
  shareVideoFor,
  staffPanelFor,
}) => {
  const reduce = useReducedMotion();
  const [a, b] = orderPair(rawA, rawB);
  const stones = [a, b];
  const index = view === a.stone_id ? 1 : view === b.stone_id ? 2 : 0;
  const stone = index ? stones[index - 1] : null;

  const [titleEl, setTitleEl] = useState(null);
  const [failed, setFailed] = useState({});
  const [overlays, setOverlays] = useState({});

  const flags = useMemo(() => {
    const make = (id) => (v) => setOverlays((o) => (Boolean(o[id]) === v ? o : { ...o, [id]: v }));
    return { stage: make("stage"), certs: make("certs"), media: make("media"), cert: make("cert") };
  }, []);
  const photoError = useMemo(() => (sku) => setFailed((f) => (f[sku] ? f : { ...f, [sku]: true })), []);

  const prevIndex = useRef(index);
  const dir = index === prevIndex.current ? 0 : index > prevIndex.current ? 1 : -1;
  useEffect(() => {
    if (prevIndex.current === index) return;
    prevIndex.current = index;
    setOverlays({});
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: "auto" });
  }, [index]);

  const items = [
    { key: "pair", label: "Pair", hint: `${a.stone_id} + ${b.stone_id}` },
    { key: a.stone_id, label: "Stone 1", hint: a.stone_id },
    { key: b.stone_id, label: "Stone 2", hint: b.stone_id },
  ];
  const current = stone ? stone.stone_id : "pair";
  const shareVideo = stone ? shareVideoFor(stone) : pairShareVideo;
  const anyOverlay = Object.values(overlays).some(Boolean);

  return (
    <DnaRoot>
      <DnaNav
        title={stone ? dnaTitle(stone) : pairTitle(a, b)}
        titleEl={titleEl}
        onBack={isSignedIn ? onBack : null}
        onShare={onShare}
      />

      <main className="dna-main dna-main--pair dna-container">
        <nav className="dna-pairnav" aria-label="Matched pair">
          <DnaPairSwitch items={items} current={current} onSelect={onSelect} idPrefix="dna-pairnav-top" />
        </nav>

          <motion.div key={current} initial={enterFrom(dir, reduce)} animate={CENTER} transition={ENTER_TRANSITION}>
            {stone ? (
              <GemstoneDnaBody
                stone={stone}
                isSignedIn={isSignedIn}
                certUrl={certUrlFor(stone)}
                prices={pricesFor ? pricesFor(stone) : null}
                photoFailed={Boolean(failed[stone.stone_id])}
                onPhotoError={() => photoError(stone.stone_id)}
                onInterested={onInterested}
                onShare={onShare}
                onShareVideo={shareVideo}
                staffPanel={staffPanelFor ? staffPanelFor(stone) : null}
                titleRef={setTitleEl}
                eyebrow={`Stone ${index} · Matched pair`}
                onMediaOverlay={flags.media}
                onCertOverlay={flags.cert}
              />
            ) : (
              <>
                <DnaPairHero
                  a={a}
                  b={b}
                  failed={failed}
                  onPhotoError={photoError}
                  onSelect={onSelect}
                  onOverlayChange={flags.stage}
                  titleRef={setTitleEl}
                  prices={pairPrices}
                  onInterested={onInterested}
                  onShare={onShare}
                  onShareVideo={shareVideo}
                />
                <DnaPairCertificates stones={stones} certUrlFor={certUrlFor} onOverlayChange={flags.certs} />
                <DnaPairStones stones={stones} failed={failed} onSelect={onSelect} />
                <DnaPairComparison a={a} b={b} isSignedIn={isSignedIn} certUrlFor={certUrlFor} />
              </>
            )}
          </motion.div>

        <DnaFooter note={stone ? stone.stone_id : `${a.stone_id} + ${b.stone_id}`} />
      </main>

      <DnaActionBar hidden={anyOverlay} onInterested={onInterested} onShare={onShare} onShareVideo={shareVideo}>
        <DnaPairSwitch items={items} current={current} onSelect={onSelect} idPrefix="dna-pairnav-bar" />
      </DnaActionBar>
    </DnaRoot>
  );
};

export default DnaPairPage;
