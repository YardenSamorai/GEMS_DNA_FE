import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { CertificateSheet, labLookupUrl } from "./GemstoneCertificate";
import { ChevronRight, ExternalIcon, ShieldCheckIcon } from "./icons";
import { clean } from "./dnaModel";

/* One report per stone, each labelled with the stone it belongs to. Opens in
   the same sheet as a single stone's certificate. Stones without a report are
   simply not listed. */
const DnaPairCertificates = ({ stones, certUrlFor, onOverlayChange }) => {
  const [open, setOpen] = useState(null);
  const close = useCallback(() => setOpen(null), []);

  useEffect(() => {
    onOverlayChange?.(Boolean(open));
  }, [open, onOverlayChange]);

  const reports = stones
    .map((stone, i) => ({
      stone,
      index: i + 1,
      lab: clean(stone.lab),
      number: clean(stone.certificate_number),
      url: certUrlFor(stone),
    }))
    .filter((r) => r.url || r.number);

  if (!reports.length) return null;

  const labs = [...new Set(reports.map((r) => r.lab).filter(Boolean))];
  const sharedLab = labs.length === 1 && reports.every((r) => r.lab) ? labs[0] : null;
  const active = reports.find((r) => r.stone.stone_id === open);

  const lede =
    reports.length === 2
      ? "Each stone is documented in its own laboratory report."
      : `A laboratory report is on file for Stone ${reports[0].index}.`;

  return (
    <section className="dna-section" aria-labelledby="dna-paircert-title">
      <div className="dna-section-head">
        <div className="dna-section-eyebrow">Verification</div>
        <h2 id="dna-paircert-title" className="dna-section-title">
          {sharedLab ? `Graded by ${sharedLab}.` : "Independently graded."}
        </h2>
        <p className="dna-section-lede">{lede}</p>
      </div>

      <div className="dna-paircert" style={{ "--dna-reports": reports.length }}>
        {sharedLab && (
          <div className="dna-paircert-head">
            <span style={{ color: "var(--dna-accent)", display: "inline-flex" }}>
              <ShieldCheckIcon size={26} />
            </span>
            <span className="dna-paircert-lab">{sharedLab}</span>
          </div>
        )}
        <div className="dna-paircert-items">
          {reports.map((r) => {
            const lookup = labLookupUrl(r.lab, r.number);
            return (
              <div key={r.stone.stone_id} className="dna-paircert-item">
                {r.url ? (
                  <button type="button" className="dna-doc dna-doc--small" onClick={() => setOpen(r.stone.stone_id)} aria-label={`View certificate for stone ${r.index}`}>
                    <span className="dna-doc-lab">{r.lab || "Report"}</span>
                    {r.number && <span className="dna-doc-no">No. {r.number}</span>}
                    <span className="dna-doc-lines" aria-hidden="true">
                      <span style={{ width: "92%" }} />
                      <span style={{ width: "70%" }} />
                      <span style={{ width: "82%" }} />
                    </span>
                    <span className="dna-doc-open">
                      View
                      <ChevronRight size={13} />
                    </span>
                  </button>
                ) : (
                  <span />
                )}
                <div className="dna-paircert-meta">
                  <div className="dna-paircert-stone dna-num">
                    Stone {r.index} · {r.stone.stone_id}
                  </div>
                  <dl>
                    {!sharedLab && r.lab && (
                      <div>
                        <dt>Laboratory</dt>
                        <dd>{r.lab}</dd>
                      </div>
                    )}
                    {r.number && (
                      <div>
                        <dt>Report number</dt>
                        <dd className="dna-num">{r.number}</dd>
                      </div>
                    )}
                  </dl>
                  <div className="dna-cert-actions">
                    {r.url && (
                      <button type="button" className="dna-btn-primary dna-btn--compact" onClick={() => setOpen(r.stone.stone_id)}>
                        View certificate
                      </button>
                    )}
                    {lookup && (
                      <a className="dna-btn dna-btn--compact" href={lookup} target="_blank" rel="noopener noreferrer">
                        Verify
                        <ExternalIcon size={16} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {active && (
          <CertificateSheet
            key="sheet"
            url={active.url}
            lab={active.lab}
            number={active.number}
            subtitle={`Stone ${active.index} · ${active.number ? `No. ${active.number}` : active.stone.stone_id}`}
            onClose={close}
          />
        )}
      </AnimatePresence>
    </section>
  );
};

export default DnaPairCertificates;
