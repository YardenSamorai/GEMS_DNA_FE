import React from "react";
import DnaNav from "./DnaNav";
import "./dna.css";

const Bar = ({ w, h = 14, style }) => (
  <div className="dna-skel" style={{ width: w, height: h, ...style }} />
);

// Same geometry as the loaded page, so nothing jumps when the data lands.
export const DnaSkeleton = () => (
  <div className="dna" aria-busy="true" aria-label="Loading gemstone">
    <DnaNav title="" />
    <main className="dna-main dna-container">
      <div className="dna-hero">
        <div className="dna-hero-media">
          <div className="dna-skel dna-skel-stage" />
        </div>
        <div className="dna-hero-info">
          <Bar w={150} h={12} />
          <Bar w="78%" h={46} style={{ marginTop: 18, borderRadius: 14 }} />
          <Bar w="52%" h={20} style={{ marginTop: 14 }} />
          <div className="dna-facts" style={{ "--dna-facts": 4 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="dna-fact">
                <Bar w={56} h={10} />
                <Bar w={72} h={18} style={{ marginTop: 8 }} />
              </div>
            ))}
          </div>
          <Bar w="100%" h={50} style={{ marginTop: 32, borderRadius: 999 }} />
        </div>
      </div>
    </main>
  </div>
);

export const DnaNotFound = ({ onBack }) => (
  <div className="dna">
    <DnaNav title="" onBack={onBack} />
    <main className="dna-container">
      <div className="dna-empty">
        <div>
          <h1>Stone not found</h1>
          <p>We couldn't find a stone with this ID. Check the link, or ask the person who shared it with you.</p>
        </div>
      </div>
    </main>
  </div>
);
