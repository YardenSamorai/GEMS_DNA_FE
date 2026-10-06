import React from "react";
import { ExternalIcon } from "./icons";
import { comparisonGroups } from "./pairModel";

const Value = ({ row, certUrl }) => {
  if (!row) return <span className="dna-compare-value is-missing">Not recorded</span>;
  if (row.certificate && certUrl) {
    return (
      <a className="dna-compare-value dna-row-link dna-num" href={certUrl} target="_blank" rel="noopener noreferrer">
        {row.value}
        <ExternalIcon size={14} />
      </a>
    );
  }
  return <span className="dna-compare-value dna-num">{row.value}</span>;
};

/* The pair's complete record: both spec sheets in two aligned columns, one
   surface. A value the stones share is written once, across both. On phones
   the label sits above its two values instead of squeezing three columns. */
const DnaPairComparison = ({ a, b, isSignedIn, certUrlFor }) => {
  const groups = comparisonGroups(a, b, { isSignedIn });
  if (!groups.length) return null;
  const urls = [certUrlFor(a), certUrlFor(b)];

  return (
    <section className="dna-section" aria-labelledby="dna-compare-title">
      <div className="dna-section-head">
        <div className="dna-section-eyebrow">Specifications</div>
        <h2 id="dna-compare-title" className="dna-section-title">Side by side.</h2>
      </div>

      <div className="dna-panel dna-compare" role="table" aria-label="Stone 1 and Stone 2 specifications">
        <div className="dna-compare-head" role="row">
          <span className="dna-compare-label" role="columnheader" />
          {[a, b].map((s, i) => (
            <span key={s.stone_id} className="dna-compare-col" role="columnheader">
              <span className="dna-compare-col-label">Stone {i + 1}</span>
              <span className="dna-compare-col-sku dna-num">{s.stone_id}</span>
            </span>
          ))}
        </div>

        {groups.map((group) => (
          <div key={group.id} role="rowgroup">
            <div className="dna-compare-group" role="row">
              <span role="rowheader">{group.title}</span>
            </div>
            {group.rows.map((row) => (
              <div key={row.key} className="dna-compare-row" role="row">
                <span className="dna-compare-label" role="rowheader">{row.label}</span>
                {row.same ? (
                  <span className="dna-compare-value is-both dna-num" role="cell">
                    {row.a.value}
                    <span className="dna-compare-both">Both stones</span>
                  </span>
                ) : (
                  <>
                    <span role="cell"><Value row={row.a} certUrl={urls[0]} /></span>
                    <span role="cell"><Value row={row.b} certUrl={urls[1]} /></span>
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
};

export default DnaPairComparison;
