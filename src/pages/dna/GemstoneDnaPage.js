import React, { useCallback, useRef, useState } from "react";
import DnaNav from "./DnaNav";
import DnaPairSwitch from "./DnaPairSwitch";
import DnaActionBar from "./DnaActionBar";
import GemstoneMedia from "./GemstoneMedia";
import GemstoneIdentity, { InlineActions, PriceSummary } from "./GemstoneIdentity";
import GemstoneCertificate from "./GemstoneCertificate";
import GemstoneSpecifications from "./GemstoneSpecifications";
import { dnaSubtitle, dnaTitle, primaryFacts, specGroups } from "./dnaModel";
import "./dna.css";

/* The single-stone DNA page: the stone's digital passport. Data, pricing and
   permissions are decided by the caller; this only lays them out. */
const GemstoneDnaPage = ({
  stone,
  isSignedIn,
  certUrl,
  prices,
  photoFailed,
  onPhotoError,
  onBack,
  onInterested,
  onShare,
  onShareVideo,
  staffPanel,
}) => {
  const titleRef = useRef(null);
  const [mediaOverlay, setMediaOverlay] = useState(false);
  const [certOverlay, setCertOverlay] = useState(false);
  const onMediaOverlay = useCallback((v) => setMediaOverlay(v), []);
  const onCertOverlay = useCallback((v) => setCertOverlay(v), []);

  const title = dnaTitle(stone);
  const subtitle = dnaSubtitle(stone);
  const facts = primaryFacts(stone);
  const groups = specGroups(stone, { isSignedIn });
  const lab = stone.lab && String(stone.lab).trim();
  const number = stone.certificate_number && String(stone.certificate_number).trim();

  return (
    <div className="dna">
      <DnaNav title={title} titleRef={titleRef} onBack={isSignedIn ? onBack : null} onShare={onShare} />

      <main className="dna-main dna-container">
        {stone.pair && <DnaPairSwitch a={stone} b={stone.pair} current={stone.stone_id} />}

        <div className="dna-hero">
          <div className="dna-hero-media">
            <GemstoneMedia
              stone={stone}
              title={title}
              photoFailed={photoFailed}
              onPhotoError={onPhotoError}
              onOverlayChange={onMediaOverlay}
            />
          </div>
          <div className="dna-hero-info">
            <GemstoneIdentity stone={stone} title={title} subtitle={subtitle} facts={facts} titleRef={titleRef}>
              {prices && <PriceSummary perCarat={prices.perCarat} total={prices.total} />}
              <InlineActions onInterested={onInterested} onShare={onShare} onShareVideo={onShareVideo} />
            </GemstoneIdentity>
          </div>
        </div>

        <GemstoneCertificate lab={lab} number={number} url={certUrl} onOverlayChange={onCertOverlay} />

        <GemstoneSpecifications groups={groups} certUrl={certUrl} />

        {staffPanel && (
          <section className="dna-staff" aria-labelledby="dna-staff-title">
            <div className="dna-section-head">
              <div className="dna-section-eyebrow">Staff only</div>
              <h2 id="dna-staff-title" className="dna-section-title">Across Gems DNA.</h2>
            </div>
            {staffPanel}
          </section>
        )}

        <footer className="dna-footer">
          <span className="dna-brand">
            <span className="dna-brand-dot" aria-hidden="true" />
            Gems DNA
          </span>
          <span className="dna-footer-note dna-num">Digital identity · {stone.stone_id}</span>
        </footer>
      </main>

      <DnaActionBar
        hidden={mediaOverlay || certOverlay}
        onInterested={onInterested}
        onShare={onShare}
        onShareVideo={onShareVideo}
      />
    </div>
  );
};

export default GemstoneDnaPage;
