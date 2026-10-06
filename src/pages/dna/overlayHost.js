import React, { createContext, useContext, useState } from "react";
import { createPortal } from "react-dom";

/* Full-screen layers (photo viewer, sheets) must escape the sticky media
   column and animated views they're opened from: both create stacking
   contexts that would let the nav or the switcher paint over them. Pages
   mount one host at the root of `.dna` so the scoped tokens still apply. */
export const OverlayHostContext = createContext(null);

export const InOverlayHost = ({ children }) => {
  const host = useContext(OverlayHostContext);
  return host ? createPortal(children, host) : children;
};

// The page root: scoped tokens, plus the host that overlays portal into.
export const DnaRoot = ({ children }) => {
  const [host, setHost] = useState(null);
  return (
    <div className="dna">
      <OverlayHostContext.Provider value={host}>{children}</OverlayHostContext.Provider>
      <div ref={setHost} />
    </div>
  );
};
