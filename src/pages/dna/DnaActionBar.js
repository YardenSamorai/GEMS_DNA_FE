import React from "react";
import { ShareIcon, VideoIcon } from "./icons";

// Phones only: the primary action stays under the thumb while the page scrolls.
const DnaActionBar = ({ hidden, onInterested, onShare, onShareVideo }) => (
  <div className={`dna-actionbar${hidden ? " is-hidden" : ""}`} aria-hidden={hidden}>
    <button type="button" className="dna-btn-primary" onClick={onInterested} tabIndex={hidden ? -1 : 0}>
      I'm interested
    </button>
    {onShareVideo && (
      <button type="button" className="dna-icon-btn" onClick={onShareVideo} aria-label="Share video" tabIndex={hidden ? -1 : 0}>
        <VideoIcon />
      </button>
    )}
    <button type="button" className="dna-icon-btn" onClick={onShare} aria-label="Share this stone" tabIndex={hidden ? -1 : 0}>
      <ShareIcon />
    </button>
  </div>
);

export default DnaActionBar;
