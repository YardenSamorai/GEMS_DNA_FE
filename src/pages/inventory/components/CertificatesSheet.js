import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Sheet from "../ui/Sheet";
import { Segmented } from "../ui/InventoryHeader";
import { exportCertificates, planCertificates } from "../helpers/certificates";

const FORMAT_KEY = "inventory.certificates.format";

const FORMATS = [
  { id: "zip", label: "ZIP · separate files" },
  { id: "pdf", label: "One PDF" },
];

const FORMAT_NOTES = {
  zip: "Each certificate as its own file, named by SKU and certificate number.",
  pdf: "All certificates in one file, in the order you selected them. Ready to print or email.",
};

const count = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const SHOWN_MISSING = 12;

const readFormat = () => {
  try {
    return localStorage.getItem(FORMAT_KEY) === "pdf" ? "pdf" : "zip";
  } catch {
    return "zip";
  }
};

const progressLabel = (p) => {
  if (!p) return "Preparing…";
  if (p.stage === "appendix") return "Checking GRS appendices…";
  if (p.stage === "fetch") return `Downloading ${p.done} of ${p.total}…`;
  return "Building the file…";
};

const reportDone = ({ certificates, appendices, failed, appendixUnchecked }) => {
  if (certificates + appendices > 0) {
    const extra = appendices === 0 ? "" : appendices === 1 ? " and 1 GRS appendix" : ` and ${appendices} GRS appendices`;
    toast.success(`Downloaded ${count(certificates, "certificate")}${extra}.`);
  }
  if (failed.length) {
    const list = failed.map((f) => `${f.skus.join(" + ")}${f.appendix ? " appendix" : ""} (${f.error})`);
    toast.error(`${failed.length} couldn't be downloaded: ${list.join(", ")}`, { duration: 10000 });
  }
  if (appendixUnchecked) toast("Some GRS appendices couldn't be checked, so they were left out.");
};

/**
 * Downloads only the certificates of the selected stones: one ZIP of separate
 * files, or one PDF. GRS appendices come along, right after their certificate.
 */
const CertificatesSheet = ({ open, items, variant, onClose }) => {
  const [format, setFormat] = useState(readFormat);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    if (open) setProgress(null);
  }, [open]);

  const plan = useMemo(() => planCertificates(items), [items]);
  const stones = items.length - plan.jewelry;
  const withCertificate = stones - plan.missing.length;
  const shared = withCertificate - plan.certificates.length;
  const grs = plan.certificates.filter((c) => c.grsCert).length;
  const canDownload = !busy && plan.certificates.length > 0;

  const chooseFormat = (id) => {
    setFormat(id);
    try {
      localStorage.setItem(FORMAT_KEY, id);
    } catch {
      // Private mode: the choice just isn't remembered.
    }
  };

  const download = async () => {
    if (!canDownload) return;
    setBusy(true);
    try {
      const report = await exportCertificates(items, { format, onProgress: setProgress });
      reportDone(report);
      if (report.certificates + report.appendices > 0) onClose();
    } catch (err) {
      toast.error(err.message || "Couldn't download the certificates");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const footer = (
    <>
      <button type="button" className="inv-btn inv-btn--plain" onClick={onClose} disabled={busy}>
        Cancel
      </button>
      <button type="button" className="inv-btn inv-btn--primary" onClick={download} disabled={!canDownload} aria-busy={busy}>
        {busy ? progressLabel(progress) : plan.certificates.length ? `Download ${count(plan.certificates.length, "certificate")}` : "Download"}
      </button>
    </>
  );

  return (
    <Sheet
      open={open}
      variant={variant}
      onClose={busy ? () => {} : onClose}
      title="Certificates"
      titleId="inv-certs-title"
      closeLabel="Close"
      footer={footer}
    >
      <div className="inv-memo">
        <section className="inv-memo-section">
          <h3 className="inv-memo-h">
            {withCertificate} of {count(stones, "stone")} have a certificate
          </h3>
          {shared > 0 && (
            <p className="inv-fnote inv-memo-note">
              {shared === 1 ? "One pair shares" : `${shared} pairs share`} a single certificate; it is downloaded once.
            </p>
          )}
          {plan.missing.length > 0 && (
            <p className="inv-fnote inv-memo-warn inv-memo-note">
              No certificate on file: {plan.missing.slice(0, SHOWN_MISSING).join(", ")}
              {plan.missing.length > SHOWN_MISSING ? ` and ${plan.missing.length - SHOWN_MISSING} more` : ""}.
            </p>
          )}
          {plan.jewelry > 0 && (
            <p className="inv-fnote inv-memo-note">{count(plan.jewelry, "jewelry piece")} selected; only stones are included.</p>
          )}
        </section>

        {plan.certificates.length > 0 && (
          <section className="inv-memo-section">
            <Segmented label="Format" options={FORMATS} value={format} onChange={chooseFormat} className="inv-memo-kind" />
            <p className="inv-fnote inv-memo-kind-note">{FORMAT_NOTES[format]}</p>
            {grs > 0 && (
              <p className="inv-fnote inv-memo-kind-note">GRS appendices are added right after their certificate.</p>
            )}
          </section>
        )}
      </div>
    </Sheet>
  );
};

export default CertificatesSheet;
