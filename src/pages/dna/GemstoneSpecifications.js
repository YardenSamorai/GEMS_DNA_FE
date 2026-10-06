import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ExternalIcon } from "./icons";

const RowValue = ({ row, certUrl }) => {
  if (row.link) {
    return (
      <Link className="dna-row-link dna-num" to={row.link}>
        {row.value}
        <ChevronRight size={16} />
      </Link>
    );
  }
  if (row.certificate && certUrl) {
    return (
      <a className="dna-row-link dna-num" href={certUrl} target="_blank" rel="noopener noreferrer">
        {row.value}
        <ExternalIcon size={15} />
      </a>
    );
  }
  return <span className="dna-row-value">{row.value}</span>;
};

/* One surface per group, rows divided by hairlines — the full record reads
   like a report, not a wall of tiles. */
const GemstoneSpecifications = ({ groups, certUrl }) => {
  if (!groups.length) return null;
  return (
    <section className="dna-section" aria-labelledby="dna-spec-title">
      <div className="dna-section-head">
        <div className="dna-section-eyebrow">Specifications</div>
        <h2 id="dna-spec-title" className="dna-section-title">The complete record.</h2>
      </div>
      <div className="dna-spec-grid">
        {groups.map((group) => (
          <div key={group.id}>
            <h3 className="dna-group-label">{group.title}</h3>
            <div className="dna-panel">
              {group.rows.map((row) => (
                <div key={row.key} className="dna-row">
                  <span className="dna-row-label">{row.label}</span>
                  <RowValue row={row} certUrl={certUrl} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default GemstoneSpecifications;
