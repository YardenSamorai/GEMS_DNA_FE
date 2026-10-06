import React from "react";
import { ShareIcon, VideoIcon } from "./icons";

// Phones only: the primary action stays under the thumb while the page scrolls.
// `children` (the pair switcher) sits above the buttons, within thumb reach.
const DnaActionBar = ({ hidden, onInterested, onShare, onShareVideo, interestedLabel = "I'm interested", children }) => {
  const buttons = (
    <>
      <button type="button" className="dna-btn-primary" onClick={onInterested} tabIndex={hidden ? -1 : 0}>
        {interestedLabel}
      </button>
      {onShareVideo && (
        <button type="button" className="dna-icon-btn" onClick={onShareVideo} aria-label="Share video" tabIndex={hidden ? -1 : 0}>
          <VideoIcon />
        </button>
      )}
      <button type="button" className="dna-icon-btn" onClick={onShare} aria-label="Share this stone" tabIndex={hidden ? -1 : 0}>
        <ShareIcon />
      </button>
    </>
  );

  return (
    <div className={`dna-actionbar${children ? " dna-actionbar--stacked" : ""}${hidden ? " is-hidden" : ""}`} aria-hidden={hidden}>
      {children ? (
        <>
          {children}
          <div className="dna-actionbar-row">{buttons}</div>
        </>
      ) : (
        buttons
      )}
    </div>
  );
};

export default DnaActionBar;
