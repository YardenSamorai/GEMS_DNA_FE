/**
 * catalogPdf.js — client-side "catalog" PDF for an arbitrary set of picked
 * stones / jewelry (the Selected list). Built on jspdf, ESHED-branded.
 *
 * Each item gets a full-width row card: a square photo on the left and, on the
 * right, the exact spec sheet shown on the product page (StoneDetail) — title,
 * per-category specs and the price block — so the document reads like the app
 * and never looks empty.
 *
 * Photos are fetched through the backend image-proxy so cross-origin stone
 * images embed cleanly (a direct browser fetch would be blocked by CORS). If
 * an image can't be loaded we degrade to a "No image" placeholder so the
 * document still prints with every item.
 *
 * Public surface (mirrors memoPdf.js):
 *   - buildCatalogPdf(items, opts)    → returns an un-saved jsPDF doc
 *   - downloadCatalogPdf(items, opts) → builds + triggers a file download
 */
import jsPDF from "jspdf";
import {
  API_BASE,
  getDisplayShape,
  getDisplayColor,
  shortTreatment,
} from "../pages/inventory/helpers/constants";
import {
  stoneImage,
  money,
  parseDims,
  fluorDisplay,
} from "../pages/sales/SalesInventory";
import { getMappedCategories } from "../utils/categoryMap";
import { buildStoneShareText } from "../utils/shareStones";

/* ───────────────────────── item normalisers ───────────────────────── */

const isJewelry = (it) => it?.kind === "jewelry";

const itemImageUrl = (it) => (isJewelry(it) ? it.image || null : stoneImage(it));

const categoryLabel = (it) => {
  if (isJewelry(it)) return (it.jewelryType || it.category || "JEWELRY").toUpperCase();
  const mapped = getMappedCategories(it?.category) || [];
  if (mapped.includes("Emerald")) return "EMERALD";
  if (mapped.includes("Diamond"))
    return mapped.includes("Fancy") ? "FANCY DIAMOND" : "DIAMOND";
  const label = mapped.find(
    (m) => m && m !== "Empty" && m !== "Fancy" && m !== "Diamond"
  );
  return (label || "GEMSTONE").toUpperCase();
};

/* Title — mirrors StoneDetail's per-category title construction so the PDF
 * header line reads exactly like the product page. */
const itemTitle = (it) => {
  if (isJewelry(it)) return it.name || it.sku || "";

  const mapped = getMappedCategories(it.category) || [];
  const isDiamond = mapped.includes("Diamond") || mapped.includes("Fancy");
  const isFancy = mapped.includes("Fancy");
  const isEmerald = mapped.includes("Emerald");

  const wt =
    it.weightCt != null && it.weightCt !== "" ? Number(it.weightCt).toFixed(2) : "";
  const shape = getDisplayShape(it.shape);
  const lab = it.lab && String(it.lab).toUpperCase() !== "N/A" ? it.lab : "";
  const treatment = it.treatment ? shortTreatment(it.treatment) : "";
  const fancyDesc = [it.fancyIntensity, it.fancyColor].filter(Boolean).join(" ");
  const gemTypeName =
    mapped.filter((c) => !["Empty", "Diamond", "Fancy", "Emerald"].includes(c))[0] || "";

  if (isDiamond) {
    return [
      wt,
      shape,
      isFancy ? fancyDesc : it.color,
      isFancy ? "" : it.clarity,
      lab,
      fluorDisplay(it.fluorescence),
    ]
      .filter(Boolean)
      .join(" ");
  }
  if (isEmerald) return [wt, shape, lab, treatment].filter(Boolean).join(" ");
  return [wt, gemTypeName, shape, lab, treatment].filter(Boolean).join(" ");
};

/* Spec rows — mirror the diamond/emerald/gemstone lists in StoneDetail (and a
 * sensible set for jewelry). Empty values are dropped so a card never shows a
 * blank "-" row. */
const cleanRows = (rows) =>
  rows.filter(
    ([, v]) => v != null && String(v).trim() !== "" && String(v).trim() !== "-"
  );

const itemSpecs = (it) => {
  if (isJewelry(it)) {
    const center = it.shape
      ? `${getDisplayShape(it.shape)}${it.centerCarat ? ` ${it.centerCarat} ct` : ""}`
      : it.centerCarat
      ? `${it.centerCarat} ct`
      : "";
    return cleanRows([
      ["SKU", it.sku],
      ["Type", it.jewelryType || it.style],
      ["Metal", it.metal],
      ["Center", center],
      ["Total ct", it.totalCarat != null ? `${it.totalCarat} ct` : ""],
      ["Cert #", it.certificateNumber],
      ["Branch", it.branch || it.location],
    ]);
  }

  const mapped = getMappedCategories(it.category) || [];
  const isDiamond = mapped.includes("Diamond") || mapped.includes("Fancy");
  const isEmerald = mapped.includes("Emerald");

  const [len, wid, dep] = parseDims(it.measurements);
  const lwd = [len, wid, dep].every((n) => Number.isFinite(n))
    ? `${len.toFixed(2)}-${wid.toFixed(2)}-${dep.toFixed(2)}`
    : String(it.measurements || "").trim();
  let ratio = parseFloat(it.ratio);
  if (!Number.isFinite(ratio) && Number.isFinite(len) && Number.isFinite(wid) && wid) {
    ratio = len / wid;
  }
  const pct = (n) =>
    Number.isFinite(Number(n)) && Number(n) !== 0 ? `${Number(n).toFixed(1)}%` : "";
  const origin =
    it.origin && String(it.origin).toUpperCase() !== "N/A" ? it.origin : "";

  if (isDiamond) {
    return cleanRows([
      ["SKU", it.sku],
      ["Polish", it.polish],
      ["Sym.", it.symmetry],
      ["L/W/D (mm)", lwd],
      ["Ratio", Number.isFinite(ratio) ? ratio.toFixed(2) : ""],
      ["Depth", pct(it.depthPercent)],
      ["Table", pct(it.tablePercent)],
      ...(it.cut && String(it.cut).trim() ? [["Cut", String(it.cut).trim()]] : []),
      ["Branch", it.branch],
    ]);
  }
  if (isEmerald) {
    return cleanRows([
      ["SKU", it.sku],
      ["Origin", origin],
      ["L/W/D (mm)", lwd],
      ["L/W Ratio", Number.isFinite(ratio) ? ratio.toFixed(2) : ""],
      ["Branch", it.branch],
    ]);
  }
  return cleanRows([
    ["SKU", it.sku],
    ["Color", getDisplayColor(it)],
    ["Origin", origin],
    ["L/W/D (mm)", lwd],
    ["L/W Ratio", Number.isFinite(ratio) ? ratio.toFixed(2) : ""],
    ["Branch", it.branch],
  ]);
};

const itemPrice = (it) => {
  if (isJewelry(it)) return { total: money(it.price), ppc: null, rap: null };
  const mapped = getMappedCategories(it.category) || [];
  const isDiamond = mapped.includes("Diamond") || mapped.includes("Fancy");
  const isFancy = mapped.includes("Fancy");
  const rap =
    isDiamond && !isFancy && it.rapPrice != null && it.rapPrice !== ""
      ? `${it.rapPrice}%`
      : null;
  return { total: money(it.priceTotal), ppc: money(it.pricePerCt), rap };
};

/* Media links for the per-card action buttons — real http(s) URLs only. */
const httpOk = (u) => {
  const s = String(u || "").trim();
  return /^https?:\/\//i.test(s) ? s : null;
};
const itemVideoLink = (it) => httpOk(it.videoUrl) || httpOk(it.additionalVideos);
const itemCertLink = (it) => httpOk(it.certificateUrl) || httpOk(it.certificateImageJpg);

/* ───────────────────────── image loading ───────────────────────── */

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

const formatOf = (dataUrl) => {
  const m = /^data:image\/(\w+)/i.exec(dataUrl || "");
  const t = (m && m[1] ? m[1] : "jpeg").toUpperCase();
  if (t === "PNG") return "PNG";
  if (t === "WEBP") return "WEBP";
  return "JPEG";
};

/* The real ESHED logo (same asset the Liran catalog uses) — same-origin
 * public file, so a plain fetch → data URL is enough. Falls back to the text
 * wordmark when unavailable. */
async function loadLogoAsset() {
  try {
    const res = await fetch("/images/eshed_logo_dark.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (_) {
    return null;
  }
}

/* ───────────────────────── document builder ───────────────────────── */

/**
 * Build the catalog document (un-saved) for `rawItems`.
 *
 * options:
 *   - showPrices (bool, default true) — include the price block per card.
 *   - showLogo   (bool, default true) — include the ESHED wordmark/branding in
 *     the header & footer. When false the document is unbranded (neutral
 *     "Catalog" header, no ESHED mark) — useful for white-label sends.
 */
export async function buildCatalogPdf(rawItems, options = {}) {
  const { showPrices = true, showLogo = true } = options;
  const items = (rawItems || []).filter(Boolean);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // Palette
  const ink = [17, 24, 39];
  const soft = [120, 128, 140];
  const muted = [150, 157, 168];
  const line = [228, 232, 238];
  const wash = [248, 249, 251];
  const brand = [5, 150, 105];

  const margin = 14;
  const contentW = pageW - margin * 2;
  const headerBottom = 30; // y where the header band ends
  const cardGap = 7;
  const pad = 7; // inner padding of each card
  const imgSize = 56;
  const detailsX = margin + pad + imgSize + 9;
  const detailsW = margin + contentW - pad - detailsX;
  const rowH = 5.1;
  const footerReserve = 16;
  const maxY = pageH - footerReserve;

  // Preload every photo (and the brand logo) up-front — rendering is
  // synchronous.
  const [logoImg, ...images] = await Promise.all([
    showLogo ? loadLogoAsset() : Promise.resolve(null),
    ...items.map((it) => loadImage(itemImageUrl(it))),
  ]);

  const drawHeader = () => {
    pdf.setFillColor(...wash);
    pdf.rect(0, 0, pageW, headerBottom - 4, "F");

    if (showLogo) {
      let logoDrawn = false;
      if (logoImg) {
        try {
          const lp = pdf.getImageProperties(logoImg);
          const lh = 11;
          const lw = (lp.width / lp.height) * lh;
          pdf.addImage(logoImg, "PNG", margin, 7, lw, lh);
          logoDrawn = true;
        } catch (_) {
          /* fall back to the wordmark */
        }
      }
      if (!logoDrawn) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(18);
        pdf.setTextColor(...ink);
        pdf.text("ESHED", margin, 16);

        // Emerald accent under the wordmark.
        pdf.setDrawColor(...brand);
        pdf.setLineWidth(1.1);
        pdf.line(margin, 19, margin + 16, 19);
      }

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(...soft);
      pdf.text("Catalog", margin, 24.5);
    } else {
      // Unbranded: a neutral title stands in for the wordmark.
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(15);
      pdf.setTextColor(...ink);
      pdf.text("Catalog", margin, 18);
    }

    const dateStr = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    pdf.setFontSize(9);
    pdf.setTextColor(...soft);
    pdf.text(dateStr, pageW - margin, 16, { align: "right" });
    pdf.text(
      `${items.length} ${items.length === 1 ? "item" : "items"}`,
      pageW - margin,
      24.5,
      { align: "right" }
    );

    pdf.setDrawColor(...line);
    pdf.setLineWidth(0.4);
    pdf.line(margin, headerBottom - 2, pageW - margin, headerBottom - 2);
  };

  // Measure a card's height (so we can page-break before drawing).
  const measureCard = (it, titleLines, specs, price, buttons) => {
    const titleH = titleLines.length * 5.4;
    const catH = 5;
    const dividerGap = 3.5;
    const specsH = specs.length * rowH;
    const buttonsH = buttons.length ? 9 : 0;
    const priceH = showPrices && price.total ? 12 : 0;
    const detailsH = titleH + catH + dividerGap + specsH + buttonsH + priceH + 2;
    return Math.max(imgSize, detailsH) + pad * 2;
  };

  // A small outlined pill with a link annotation — the PDF's "button".
  const drawLinkPill = (label, x, y, color, url) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.2);
    const w = pdf.getTextWidth(label) + 7;
    const h = 5.8;
    pdf.setDrawColor(...color);
    pdf.setLineWidth(0.4);
    pdf.roundedRect(x, y, w, h, 2.9, 2.9, "S");
    pdf.setTextColor(...color);
    pdf.text(label, x + w / 2, y + h / 2 + 0.9, { align: "center" });
    pdf.link(x, y, w, h, { url });
    return w;
  };

  const drawCard = (it, img, cardY, titleLines, specs, price, buttons, cardH) => {
    const cardX = margin;
    // Card frame
    pdf.setDrawColor(...line);
    pdf.setLineWidth(0.4);
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(cardX, cardY, contentW, cardH, 3.5, 3.5, "FD");

    // Photo well (vertically centred within the card)
    const imgX = cardX + pad;
    const imgY = cardY + (cardH - imgSize) / 2;
    pdf.setFillColor(...wash);
    pdf.roundedRect(imgX, imgY, imgSize, imgSize, 2.5, 2.5, "F");
    if (img) {
      try {
        const props = pdf.getImageProperties(img);
        const box = imgSize - 5;
        const ratio = Math.min(box / props.width, box / props.height);
        const w = props.width * ratio;
        const h = props.height * ratio;
        pdf.addImage(
          img,
          formatOf(img),
          imgX + (imgSize - w) / 2,
          imgY + (imgSize - h) / 2,
          w,
          h
        );
      } catch (_) {
        /* leave the well empty on a bad image */
      }
    } else {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(...muted);
      pdf.text("No image", imgX + imgSize / 2, imgY + imgSize / 2, {
        align: "center",
      });
    }

    // Details column
    let ty = cardY + pad + 4;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11.5);
    pdf.setTextColor(...ink);
    pdf.text(titleLines, detailsX, ty);
    ty += titleLines.length * 5.4;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(...brand);
    pdf.text(categoryLabel(it), detailsX, ty + 0.5);
    ty += 4;

    pdf.setDrawColor(...line);
    pdf.setLineWidth(0.3);
    pdf.line(detailsX, ty, detailsX + detailsW, ty);
    ty += 3.5;

    specs.forEach(([label, value]) => {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.6);
      pdf.setTextColor(...muted);
      pdf.text(String(label).toUpperCase(), detailsX, ty);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.6);
      pdf.setTextColor(...ink);
      const v = pdf.splitTextToSize(String(value), detailsW * 0.62);
      pdf.text(v[0], detailsX + detailsW, ty, { align: "right" });
      ty += rowH;
    });

    if (buttons.length) {
      ty += 1.5;
      let bx = detailsX;
      buttons.forEach((b) => {
        bx += drawLinkPill(b.label, bx, ty, b.color, b.url) + 3;
      });
    }

    if (showPrices && price.total) {
      // Per-carat price and Rap % now live inside the spec table above —
      // the price block carries only the total.
      const pY = cardY + cardH - pad - 6;
      pdf.setDrawColor(...line);
      pdf.setLineWidth(0.3);
      pdf.line(detailsX, pY - 2.5, detailsX + detailsW, pY - 2.5);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.6);
      pdf.setTextColor(...soft);
      pdf.text("TOTAL", detailsX, pY + 3.5);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.setTextColor(...brand);
      pdf.text(price.total, detailsX + detailsW, pY + 4, { align: "right" });
    }
  };

  let cardY = headerBottom + 4;
  let pageStarted = false;
  const startPage = (first) => {
    if (!first) pdf.addPage();
    drawHeader();
    cardY = headerBottom + 4;
  };

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const titleLines = pdf.splitTextToSize(itemTitle(it) || it.sku || "", detailsW).slice(0, 2);
    const specs = itemSpecs(it);
    const price = itemPrice(it);

    // Rap % and price-per-carat sit inside the spec table, right below the
    // Branch row (the total keeps its own block at the bottom of the card).
    if (showPrices) {
      const priceRows = [];
      if (price.rap) priceRows.push(["Rap %", price.rap]);
      if (price.ppc) priceRows.push(["Price per carat", price.ppc]);
      if (priceRows.length) {
        const branchIdx = specs.findIndex(([label]) => label === "Branch");
        if (branchIdx >= 0) specs.splice(branchIdx + 1, 0, ...priceRows);
        else specs.push(...priceRows);
      }
    }

    // Per-card action buttons — tappable link pills inside the PDF:
    //   Cert / Video open the stone's certificate & video pages; Share opens
    //   WhatsApp with the exact same message template the Action sheet sends.
    const buttons = [];
    const certL = itemCertLink(it);
    if (certL) buttons.push({ label: "CERT", color: brand, url: certL });
    const videoL = itemVideoLink(it);
    if (videoL) buttons.push({ label: "VIDEO", color: [2, 132, 199], url: videoL });
    const shareText = buildStoneShareText(it, { withPrice: showPrices });
    if (shareText) {
      buttons.push({
        label: "SHARE",
        color: [22, 163, 74],
        url: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      });
    }

    const cardH = measureCard(it, titleLines, specs, price, buttons);

    if (!pageStarted) {
      startPage(true);
      pageStarted = true;
    } else if (cardY + cardH > maxY) {
      startPage(false);
    }

    drawCard(it, images[i], cardY, titleLines, specs, price, buttons, cardH);
    cardY += cardH + cardGap;
  }

  if (!pageStarted) drawHeader(); // empty selection — still a branded page

  // Footers (page X of Y) in a post-pass now that the count is known.
  const total = pdf.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p);
    const fy = pageH - 8;
    pdf.setDrawColor(...line);
    pdf.setLineWidth(0.3);
    pdf.line(margin, fy - 4, pageW - margin, fy - 4);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...soft);
    if (showLogo) pdf.text("ESHED", margin, fy);
    pdf.text(`Page ${p} of ${total}`, pageW - margin, fy, { align: "right" });
  }

  return pdf;
}

/** Build the catalog and trigger a browser download. */
export async function downloadCatalogPdf(items, options = {}) {
  const pdf = await buildCatalogPdf(items, options);
  const d = new Date().toISOString().slice(0, 10);
  pdf.save(`eshed-catalog-${d}.pdf`);
}
