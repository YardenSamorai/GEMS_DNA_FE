import React, { useEffect, useState } from "react";
import { ChevronLeft, ShareIcon } from "./icons";

/* Glass bar: content scrolls beneath it, so translucency is earned. The
   hairline appears only once something is underneath, and the stone's name
   slides in when the page title has scrolled away. */
const DnaNav = ({ title, titleRef, onBack, onShare }) => {
  const [scrolled, setScrolled] = useState(false);
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = titleRef?.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(
      ([entry]) => setCondensed(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { rootMargin: "-56px 0px 0px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [titleRef]);

  return (
    <header className={`dna-nav${scrolled ? " is-scrolled" : ""}${condensed ? " is-condensed" : ""}`}>
      <div className="dna-container dna-nav-inner">
        <div className="dna-nav-start">
          {onBack ? (
            <button type="button" className="dna-back" onClick={onBack}>
              <ChevronLeft size={22} />
              Back
            </button>
          ) : (
            <span className="dna-brand">
              <span className="dna-brand-dot" aria-hidden="true" />
              Gems DNA
            </span>
          )}
        </div>
        <div className="dna-nav-title" aria-hidden={!condensed}>
          {title}
        </div>
        <div className="dna-nav-end">
          {onShare && (
            <button type="button" className="dna-icon-btn" onClick={onShare} aria-label="Share this stone">
              <ShareIcon />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default DnaNav;
