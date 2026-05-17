/**
 * memoPdf.js — client-side PDF generator for a single memo + its
 * digital signatures, built on jspdf v4. The output is a clean,
 * letterhead-style "Memo of Consignment" document that includes:
 *
 *   1. Header        — supplier name, memo number, status, dates.
 *   2. Parties       — From (supplier) / To (store) blocks.
 *   3. Items table   — SKU, description, price, status.
 *   4. Totals        — total / out / returned / sold breakdown.
 *   5. Signatures    — embedded PNGs side-by-side per event (issue
 *                      and, when present, close), each with the
 *                      signer's name, role, signed-at, IP, user-agent
 *                      summary, and the short SHA-256 integrity hash.
 *   6. Audit footer  — disclaimer + generation timestamp.
 *
 * Notes:
 *   - We render synchronously with jspdf's text/rect API for
 *     determinism (no html2canvas dependency).
 *   - Signature images are fetched as data URLs from their public
 *     blob URLs; if fetching fails (e.g. CORS, offline) we degrade
 *     gracefully and show "(image unavailable)" so the document still
 *     prints cleanly with all the auditable metadata.
 *   - All money is rendered with $ and a thousands separator. We do
 *     NOT include the supplier's internal cost / Bruto fields — those
 *     are tenant-internal and have no business on a shared document.
 */
import { jsPDF } from "jspdf";

/* ─────────── tiny formatters (mirrors MemoDetail) ─────────── */

const fmtMoney = (n) =>
  `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const fmtDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const fmtDateTime = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/* Fetch a public blob URL and return a base64 data URL we can hand
 * to jspdf's addImage. Returns null on any failure (CORS, 404, etc)
 * so the caller can render a textual placeholder instead. */
async function fetchAsDataUrl(url) {
  if (!url) return null;
  try {
    const r = await fetch(url, { mode: "cors" });
    if (!r.ok) return null;
    const blob = await r.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (_) {
    return null;
  }
}

/* ─────────── core builder ─────────── */

/**
 * Build a jsPDF document for a memo and return it (un-saved).
 *
 * Splitting `buildMemoPdf` (returns doc) from `downloadMemoPdf` /
 * `printMemoPdf` keeps the rendering logic test-able and lets callers
 * compose the doc (e.g. preview-in-iframe) without forcing a download.
 */
export async function buildMemoPdf(memo) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  const items = memo?.items || [];
  const sigs = memo?.signatures || [];

  // Pre-fetch signature images concurrently so we don't block the
  // rendering loop later.
  const sigImages = await Promise.all(
    sigs.map((s) => fetchAsDataUrl(s.signature_url))
  );

  /* ── Header strip ───────────────────────────────────────────── */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("MEMO OF CONSIGNMENT", margin, y);
  doc.setTextColor(0);
  doc.setFontSize(22);
  doc.text(String(memo.memo_number || ""), margin, y + 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80);
  const statusLabel = (memo.status || "—").toUpperCase();
  doc.text(`Status: ${statusLabel}`, pageW - margin, y, { align: "right" });
  doc.text(`Issued: ${fmtDate(memo.issued_at)}`, pageW - margin, y + 14, { align: "right" });
  doc.text(`Due: ${fmtDate(memo.due_at)}`, pageW - margin, y + 28, { align: "right" });
  if (memo.closed_at) {
    doc.text(`Closed: ${fmtDate(memo.closed_at)}`, pageW - margin, y + 42, { align: "right" });
  }
  y += 56;

  // Divider
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 16;

  /* ── Parties strip ──────────────────────────────────────────── */
  const half = (pageW - margin * 2 - 16) / 2;
  const drawParty = (x, title, name, lines) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(title.toUpperCase(), x, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(String(name || "—"), x, y + 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80);
    let ly = y + 32;
    lines.filter(Boolean).forEach((line) => {
      doc.text(line, x, ly);
      ly += 12;
    });
  };
  drawParty(margin, "From (Supplier)", memo.owner_name || memo.supplier_name, [
    memo.owner_email || memo.supplier_email,
  ]);
  drawParty(margin + half + 16, "To (Store)", memo.company_name, [
    memo.company_email,
    memo.company_phone,
    [memo.company_address, memo.company_city, memo.company_country]
      .filter(Boolean)
      .join(", "),
  ]);
  y += 88;

  /* ── Items table ────────────────────────────────────────────── */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text(`Items (${items.length})`, margin, y);
  y += 12;

  // Column layout: SKU | Description | Status | Price
  const colSku = margin;
  const colDesc = margin + 90;
  const colStatus = pageW - margin - 160;
  const colPrice = pageW - margin;
  const headerY = y + 14;
  doc.setDrawColor(200);
  doc.setFillColor(248);
  doc.rect(margin - 4, y, pageW - margin * 2 + 8, 22, "F");
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("SKU", colSku, headerY);
  doc.text("DESCRIPTION", colDesc, headerY);
  doc.text("STATUS", colStatus, headerY);
  doc.text("PRICE", colPrice, headerY, { align: "right" });
  y += 26;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(20);

  const rowHeight = 18;
  items.forEach((it) => {
    if (y > pageH - margin - 200) {
      doc.addPage();
      y = margin;
    }
    const snap = it.snapshot || {};
    const isJewelry = it.item_type === "jewelry";
    const title =
      snap.title ||
      (isJewelry ? snap.jewelryType : snap.shape) ||
      it.item_sku ||
      "—";
    const specLine = isJewelry
      ? [snap.jewelryType, snap.metalType, snap.collection].filter(Boolean).join(" · ")
      : [
          snap.shape,
          snap.weightCt ? `${snap.weightCt}ct` : null,
          snap.color,
          snap.clarity,
        ]
          .filter(Boolean)
          .join(" · ");
    doc.text(String(it.item_sku || ""), colSku, y);
    doc.text(String(title).slice(0, 40), colDesc, y);
    if (specLine) {
      doc.setTextColor(140);
      doc.text(specLine.slice(0, 55), colDesc, y + 10);
      doc.setTextColor(20);
    }
    doc.text(String(it.status || "—").toUpperCase(), colStatus, y);
    doc.text(fmtMoney(it.memo_price), colPrice, y, { align: "right" });
    y += rowHeight + (specLine ? 6 : 0);
  });

  /* ── Totals strip ───────────────────────────────────────────── */
  const total = items.reduce((a, i) => a + Number(i.memo_price || 0), 0);
  const sumBy = (filter) =>
    items.filter(filter).reduce((a, i) => a + Number(i.memo_price || 0), 0);
  const outVal = sumBy((i) => i.status === "out");
  const returnedVal = sumBy((i) => i.status === "returned");
  const soldVal = sumBy((i) => i.status === "sold");

  y += 10;
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text("Total", margin, y);
  doc.text(fmtMoney(total), pageW - margin, y, { align: "right" });
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text(`Out: ${fmtMoney(outVal)}`, margin, y);
  doc.text(`Returned: ${fmtMoney(returnedVal)}`, margin + 130, y);
  doc.text(`Sold: ${fmtMoney(soldVal)}`, margin + 260, y, { align: "left" });
  y += 22;

  /* ── Signatures ─────────────────────────────────────────────── */
  if (sigs.length > 0) {
    if (y > pageH - margin - 220) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text("Electronic signatures", margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(
      "Captured under advanced-electronic-signature standard. Each signature is bound to the memo snapshot at signing time via a SHA-256 hash.",
      margin,
      y,
      { maxWidth: pageW - margin * 2 }
    );
    y += 20;

    const blockW = (pageW - margin * 2 - 16) / 2;
    const blockH = 140;
    let col = 0;
    sigs.forEach((s, idx) => {
      if (col === 0 && y + blockH > pageH - margin) {
        doc.addPage();
        y = margin;
      }
      const x = col === 0 ? margin : margin + blockW + 16;

      doc.setDrawColor(200);
      doc.setLineWidth(0.5);
      doc.rect(x, y, blockW, blockH);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `${(s.signer_role || "").toUpperCase()} · ${(s.event || "").toUpperCase()}`,
        x + 8,
        y + 14
      );

      // Image
      const img = sigImages[idx];
      if (img) {
        try {
          doc.addImage(img, "PNG", x + 8, y + 20, blockW - 16, 60);
        } catch (_) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text("(image unavailable)", x + 8, y + 50);
        }
      } else {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text("(image unavailable)", x + 8, y + 50);
      }

      // Footer
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(20);
      doc.text(String(s.signer_name || "—"), x + 8, y + 96);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100);
      if (s.signer_email) {
        doc.text(String(s.signer_email).slice(0, 38), x + 8, y + 108);
      }
      doc.text(`Signed: ${fmtDateTime(s.signed_at)}`, x + 8, y + 120);
      const ip = s.ip_address ? `IP: ${s.ip_address}` : "";
      const hash = s.integrity_hash
        ? `Hash: ${String(s.integrity_hash).slice(0, 12)}…${String(s.integrity_hash).slice(-4)}`
        : "";
      doc.text([ip, hash].filter(Boolean).join("   ·   "), x + 8, y + 132);

      col = col === 0 ? 1 : 0;
      if (col === 0) y += blockH + 12;
    });
    if (col === 1) y += blockH + 12;
  }

  /* ── Footer disclaimer ──────────────────────────────────────── */
  if (y > pageH - margin - 50) {
    doc.addPage();
    y = margin;
  } else {
    y = pageH - margin - 32;
  }
  doc.setDrawColor(230);
  doc.line(margin, y, pageW - margin, y);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(140);
  doc.text(
    "This document is an electronically-signed record. The signatures above were captured with consent, IP-stamped, and bound to the memo's contents via a SHA-256 integrity hash. Generated " +
      fmtDateTime(new Date().toISOString()) +
      ".",
    margin,
    y + 14,
    { maxWidth: pageW - margin * 2 }
  );

  return doc;
}

/* Convenience wrappers. */
export async function downloadMemoPdf(memo) {
  const doc = await buildMemoPdf(memo);
  const fileName = `${memo?.memo_number || "memo"}.pdf`;
  doc.save(fileName);
}

export async function printMemoPdf(memo) {
  const doc = await buildMemoPdf(memo);
  doc.autoPrint();
  // Open in a new tab so the print dialog appears with a tab the user
  // can keep / discard. URL.createObjectURL is friendlier than data
  // URLs which some browsers truncate.
  const blobUrl = doc.output("bloburl");
  window.open(blobUrl, "_blank");
}
