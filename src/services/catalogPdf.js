/**
 * catalogPdf.js — client-side "catalog" PDF for an arbitrary set of picked
 * stones / jewelry (the Selected list). Built on jspdf, ESHED-branded, and
 * laid out as a clean 2-up card grid (photo + title + key specs + price).
 *
 * Photos are fetched through the backend image-proxy so cross-origin stone
 * images embed cleanly (a direct browser fetch would be blocked by CORS).
 * If an image can't be loaded we degrade to a "No image" placeholder so the
 * document still prints with every item.
 *
 * The public surface mirrors memoPdf.js:
 *   - buildCatalogPdf(items, opts)    → returns an un-saved jsPDF doc
 *   - downloadCatalogPdf(items, opts) → builds + triggers a file download
 */
import jsPDF from "jspdf";
import { API_BASE } from "../pages/inventory/helpers/constants";
import { stoneTitle, stoneImage, money } from "../pages/sales/SalesInventory";
import { getMappedCategories } from "../utils/categoryMap";

/* The picked list mixes loose stones and jewelry. Normalise the handful of
 * fields the catalog needs so the renderer doesn't branch everywhere. */
const isJewelry = (it) => it?.kind === "jewelry";

const itemTitle = (it) =>
  isJewelry(it) ? it.name || it.sku || "" : stoneTitle(it) || it.sku || "";

const itemImageUrl = (it) => (isJewelry(it) ? it.image || null : stoneImage(it));

const itemCategory = (it) => {
  if (isJewelry(it)) return "JEWELRY";
  const mapped = getMappedCategories(it?.category) || [];
  if (mapped.includes("Emerald")) return "EMERALD";
  if (mapped.includes("Diamond"))
    return mapped.includes("Fancy") ? "FANCY DIAMOND" : "DIAMOND";
  const label = mapped.find(
    (m) => m && m !== "Empty" && m !== "Fancy" && m !== "Diamond"
  );
  return (label || "GEMSTONE").toUpperCase();
};

const itemTotal = (it) => (isJewelry(it) ? money(it.price) : money(it.priceTotal));
const itemPerCt = (it) => (isJewelry(it) ? null : money(it.pricePerCt));

/* Pull a stone photo through the image-proxy and hand back a data URL jspdf
 * can embed. Returns null on any failure so the caller can draw a placeholder. */
async function loadImage(url) {
  if (!url) return null;
  try {
    const res = await fetch(`${API_BASE}/api/image-proxy?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.image && data.image.startsWith("data:") ? data.image : null;
  } catch (_) {
    return null;
  }
}

/**
 * Build the catalog document (un-saved) for `rawItems`.
 *
 * options:
 *   - showPrices (bool, default true) — include the price block per card.
 */
export async function buildCatalogPdf(rawItems, options = {}) {
  const { showPrices = true } = options;
  const items = (rawItems || []).filter(Boolean);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const margin = 14;
  const cols = 2;
  const colGap = 10;
  const rowGap = 8;
  const cardW = (pageW - margin * 2 - colGap * (cols - 1)) / cols;
  const imgH = 64;
  const cardH = 95;
  const startY = 34;
  const usableH = pageH - startY - 12;
  const rows = Math.max(1, Math.floor((usableH + rowGap) / (cardH + rowGap)));
  const perPage = cols * rows;
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));

  // Preload every photo up-front (the document is rendered synchronously).
  const images = await Promise.all(items.map((it) => loadImage(itemImageUrl(it))));

  const ink = [17, 24, 39];
  const soft = [107, 114, 128];
  const line = [226, 232, 240];
  const brand = [5, 150, 105];

  const drawHeader = () => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(17);
    pdf.setTextColor(...ink);
    pdf.text("ESHED", margin, 17);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...soft);
    pdf.text("Gemstone Catalog", margin, 22);

    const dateStr = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    pdf.text(dateStr, pageW - margin, 17, { align: "right" });
    pdf.text(
      `${items.length} ${items.length === 1 ? "item" : "items"}`,
      pageW - margin,
      22,
      { align: "right" }
    );

    pdf.setDrawColor(...line);
    pdf.setLineWidth(0.3);
    pdf.line(margin, 26, pageW - margin, 26);
  };

  const drawFooter = (pageNum) => {
    const fy = pageH - 8;
    pdf.setDrawColor(...line);
    pdf.setLineWidth(0.3);
    pdf.line(margin, fy - 4, pageW - margin, fy - 4);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...soft);
    pdf.text("ESHED", margin, fy);
    pdf.text(`Page ${pageNum} of ${totalPages}`, pageW - margin, fy, {
      align: "right",
    });
  };

  const drawCard = (it, img, x, y) => {
    pdf.setDrawColor(...line);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(x, y, cardW, cardH, 2.5, 2.5, "S");

    // Image well
    pdf.setFillColor(247, 247, 249);
    pdf.roundedRect(x, y, cardW, imgH, 2.5, 2.5, "F");
    if (img) {
      try {
        const props = pdf.getImageProperties(img);
        const boxW = cardW - 6;
        const boxH = imgH - 6;
        const ratio = Math.min(boxW / props.width, boxH / props.height);
        const w = props.width * ratio;
        const h = props.height * ratio;
        const ix = x + (cardW - w) / 2;
        const iy = y + (imgH - h) / 2;
        const fmt = /image\/png/i.test(img) ? "PNG" : "JPEG";
        pdf.addImage(img, fmt, ix, iy, w, h);
      } catch (_) {
        /* corrupt/oversized image — leave the well empty */
      }
    } else {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(...soft);
      pdf.text("No image", x + cardW / 2, y + imgH / 2, { align: "center" });
    }

    const tx = x + 4;
    const innerW = cardW - 8;
    let ty = y + imgH + 6;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9.5);
    pdf.setTextColor(...ink);
    const titleLines = pdf.splitTextToSize(itemTitle(it), innerW).slice(0, 2);
    pdf.text(titleLines, tx, ty);
    ty += titleLines.length * 4.4 + 1.5;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...soft);
    const meta = [itemCategory(it), it.sku ? `#${it.sku}` : null]
      .filter(Boolean)
      .join("   ·   ");
    pdf.text(meta, tx, ty);
    ty += 4;

    if (it.branch) {
      pdf.text(String(it.branch), tx, ty);
    }

    if (showPrices) {
      const total = itemTotal(it);
      const ppc = itemPerCt(it);
      if (total) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(...brand);
        pdf.text(total, tx, y + cardH - 5);
        if (ppc) {
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(7.5);
          pdf.setTextColor(...soft);
          pdf.text(`${ppc}/ct`, x + cardW - 4, y + cardH - 5, { align: "right" });
        }
      }
    }
  };

  let idx = 0;
  for (let p = 0; p < totalPages; p++) {
    if (p > 0) pdf.addPage();
    drawHeader();
    drawFooter(p + 1);
    for (let r = 0; r < rows && idx < items.length; r++) {
      for (let c = 0; c < cols && idx < items.length; c++) {
        const x = margin + c * (cardW + colGap);
        const y = startY + r * (cardH + rowGap);
        drawCard(items[idx], images[idx], x, y);
        idx++;
      }
    }
  }

  return pdf;
}

/** Build the catalog and trigger a browser download. */
export async function downloadCatalogPdf(items, options = {}) {
  const pdf = await buildCatalogPdf(items, options);
  const d = new Date().toISOString().slice(0, 10);
  pdf.save(`eshed-catalog-${d}.pdf`);
}
