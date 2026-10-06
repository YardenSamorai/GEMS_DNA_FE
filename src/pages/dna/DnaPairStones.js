import React from "react";
import { SUPPLIER_FALLBACK_IMAGE } from "../../utils/supplierMedia";
import { ChevronRight } from "./icons";
import { dnaSubtitle, dnaTitle } from "./dnaModel";

// Each member of the pair, one row apiece, each a door into that stone's own DNA.
const DnaPairStones = ({ stones, failed, onSelect }) => (
  <section className="dna-section" aria-labelledby="dna-pairstones-title">
    <div className="dna-section-head">
      <div className="dna-section-eyebrow">The two stones</div>
      <h2 id="dna-pairstones-title" className="dna-section-title">Each with its own DNA.</h2>
      <p className="dna-section-lede">Open either stone for its media, report and complete record.</p>
    </div>
    <div className="dna-panel">
      {stones.map((stone, i) => {
        const hasPhoto = Boolean(stone.picture) && !failed[stone.stone_id];
        return (
          <button key={stone.stone_id} type="button" className="dna-stonerow" onClick={() => onSelect(stone.stone_id)}>
            <span className="dna-stonerow-thumb" aria-hidden="true">
              <img src={hasPhoto ? stone.picture : SUPPLIER_FALLBACK_IMAGE} alt="" />
            </span>
            <span className="dna-stonerow-text">
              <span className="dna-stonerow-eyebrow dna-num">
                Stone {i + 1} · {stone.stone_id}
              </span>
              <span className="dna-stonerow-title dna-num">{dnaTitle(stone)}</span>
              <span className="dna-stonerow-sub">{dnaSubtitle(stone)}</span>
            </span>
            <ChevronRight size={18} className="dna-stonerow-chevron" />
          </button>
        );
      })}
    </div>
  </section>
);

export default DnaPairStones;
