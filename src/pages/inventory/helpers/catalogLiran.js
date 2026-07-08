/*
 * "Catalog (Liran)" — one-off ESHED-branded jewelry catalog export.
 *
 * Completely separate from the regular PDF catalog on purpose: the cover uses
 * the ESHED logo (white, transparent) instead of Gemstar, the contact details
 * are fixed (www.eshed.com / info@eshed.com / NY phone), and the content pages
 * are a plain 4x3 worksheet grid (image, SKU, type, website text / blanks and
 * a product-page link) that Liran fills in for the website. Pages can be
 * portrait or landscape (options.orientation), same 4x3 grid in both.
 */
import jsPDF from "jspdf";

const API_BASE = process.env.REACT_APP_API_URL || "https://gems-dna-be.onrender.com";

const ESHED = {
  site: "www.eshed.com",
  siteUrl: "https://www.eshed.com",
  phone: "+1.917.309.2523",
  email: "info@eshed.com",
  branches: "NEW YORK      \u00B7      LOS ANGELES      \u00B7      HONG KONG      \u00B7      TEL AVIV",
};

const imageToBase64 = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d").drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });

const fetchFontAsBase64 = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font not found: ${url}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

let _fontsCache = null;
const loadFonts = async () => {
  if (_fontsCache) return _fontsCache;
  try {
    const [playfair, latoLight] = await Promise.all([
      fetchFontAsBase64("/fonts/PlayfairDisplay-Regular.ttf"),
      fetchFontAsBase64("/fonts/Lato-Light.ttf"),
    ]);
    _fontsCache = { playfair, latoLight };
  } catch (e) {
    _fontsCache = null;
  }
  return _fontsCache;
};

// Product photos ship with wildly different amounts of white padding around
// the jewel, so "same image size" doesn't mean "same jewel size". Cropping
// each photo to its content bounding box first, then fitting everything into
// the same square slot, makes every piece come out visually equal.
const trimWhitespace = (dataUrl) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
        for (let py = 0; py < canvas.height; py++) {
          for (let px = 0; px < canvas.width; px++) {
            const i = (py * canvas.width + px) * 4;
            const isContent = data[i + 3] > 16 &&
              (data[i] < 242 || data[i + 1] < 242 || data[i + 2] < 242);
            if (isContent) {
              if (px < minX) minX = px;
              if (px > maxX) maxX = px;
              if (py < minY) minY = py;
              if (py > maxY) maxY = py;
            }
          }
        }
        // Nothing (or almost nothing) detected — keep the original.
        if (maxX <= minX || maxY <= minY || (maxX - minX) * (maxY - minY) < canvas.width * canvas.height * 0.005) {
          resolve(dataUrl);
          return;
        }
        const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.05);
        minX = Math.max(0, minX - pad);
        minY = Math.max(0, minY - pad);
        maxX = Math.min(canvas.width - 1, maxX + pad);
        maxY = Math.min(canvas.height - 1, maxY + pad);
        const w = maxX - minX + 1;
        const h = maxY - minY + 1;
        const out = document.createElement("canvas");
        out.width = w;
        out.height = h;
        const octx = out.getContext("2d");
        octx.fillStyle = "#ffffff";
        octx.fillRect(0, 0, w, h);
        octx.drawImage(canvas, minX, minY, w, h, 0, 0, w, h);
        resolve(out.toDataURL("image/jpeg", 0.92));
      } catch (e) {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });

// Product page on the public eshed.com website (e.g.
// https://eshed.com/eshed/RI-HER-021/).
const itemUrl = (stone) =>
  stone.sku ? `https://eshed.com/eshed/${encodeURIComponent(stone.sku)}/` : null;

// Where "View more" points when the item's product page no longer exists.
const CATALOG_FALLBACK_URL = "https://eshed.com/shop/";

// Ask the backend which SKUs still have a live page on eshed.com. Returns a
// lower-cased Set of DEAD skus. Any failure returns an empty set (fail open:
// better an occasional dead link than wrongly rerouting live ones).
const fetchDeadSkus = async (stones) => {
  const skus = [...new Set(stones.map((s) => String(s.sku || "").trim()).filter(Boolean))];
  if (skus.length === 0) return new Set();
  try {
    const res = await fetch(`${API_BASE}/api/check-product-links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skus }),
    });
    if (!res.ok) return new Set();
    const data = await res.json();
    return new Set(
      Object.entries(data.results || {})
        .filter(([, alive]) => alive === false)
        .map(([sku]) => sku.toLowerCase())
    );
  } catch (e) {
    console.warn("Product link check failed, keeping original links:", e);
    return new Set();
  }
};

const itemTypeLabel = (stone) => {
  if (stone.category === "Jewelry") return stone.jewelryType || "Jewelry";
  return stone.category || "Gemstone";
};


export const exportCatalogLiran = async (selectedStones, options = {}) => {
  const orientation = options.orientation === "landscape" ? "landscape" : "portrait";
  const isLandscape = orientation === "landscape";
  const pdf = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;

  const fonts = await loadFonts();
  let TITLE_FONT = "helvetica";
  let BODY_FONT = "helvetica";
  if (fonts) {
    pdf.addFileToVFS("PlayfairDisplay-Regular.ttf", fonts.playfair);
    pdf.addFont("PlayfairDisplay-Regular.ttf", "PlayfairDisplay", "normal");
    pdf.addFileToVFS("Lato-Light.ttf", fonts.latoLight);
    pdf.addFont("Lato-Light.ttf", "LatoLight", "normal");
    TITLE_FONT = "PlayfairDisplay";
    BODY_FONT = "LatoLight";
  }

  let coverBg = null;
  let logo = null;
  let logoDark = null;
  try { coverBg = await imageToBase64("/images/A4_cover_bg.png"); } catch (e) { /* fallback: dark fill */ }
  try { logo = await imageToBase64("/images/eshed_logo_white.png"); } catch (e) { /* skip logo */ }
  try { logoDark = await imageToBase64("/images/eshed_logo_dark.png"); } catch (e) { /* skip logo */ }

  // Draw the stone-texture background scaled to COVER the page (crop instead
  // of stretch), so landscape pages don't get a distorted texture.
  const drawCoverBg = (h = pageHeight) => {
    if (!coverBg) {
      pdf.setFillColor(24, 24, 24);
      pdf.rect(0, 0, pageWidth, h, "F");
      return;
    }
    try {
      const p = pdf.getImageProperties(coverBg);
      const ratio = p.height / p.width;
      let drawW = pageWidth;
      let drawH = pageWidth * ratio;
      if (drawH < h) {
        drawH = h;
        drawW = h / ratio;
      }
      // Overflow past the page edges is clipped by the PDF viewer.
      pdf.addImage(coverBg, "PNG", 0, 0, drawW, drawH);
    } catch (e) {
      pdf.setFillColor(24, 24, 24);
      pdf.rect(0, 0, pageWidth, h, "F");
    }
  };

  const loadItemImage = async (url) => {
    if (!url) return null;
    // Manually-added items carry an already-encoded data URL from the upload.
    if (url.startsWith("data:")) return trimWhitespace(url);
    try {
      const res = await fetch(`${API_BASE}/api/image-proxy?url=${encodeURIComponent(url)}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.image && data.image.startsWith("data:")) return trimWhitespace(data.image);
      return null;
    } catch (e) { return null; }
  };

  // ==================== COVER ====================
  drawCoverBg();

  if (logo) {
    try {
      const props = pdf.getImageProperties(logo);
      const logoW = 58;
      const logoH = logoW * (props.height / props.width);
      // Keep the logo/title spacing proportional in both orientations.
      pdf.addImage(logo, "PNG", pageWidth / 2 - logoW / 2, pageHeight * 0.16, logoW, logoH);
    } catch (e) { /* skip */ }
  }

  const titleY = pageHeight * (isLandscape ? 0.42 : 0.44);
  pdf.setFont(TITLE_FONT, "normal");
  pdf.setFontSize(24);
  pdf.setTextColor(255, 255, 255);
  pdf.text("JEWELRY CATALOG", pageWidth / 2, titleY, { align: "center" });

  // --- About sections (Our Company / Our Jewelry) ---
  const ABOUT = [
    {
      heading: "OUR COMPANY",
      body: "Eshed is part of Eshed\u2013Gemstar, a family-led gemstone and jewelry group with decades of experience in sourcing, cutting, manufacturing, and wholesale supply. As manufacturers, we offer a full mine-to-jewelry process, from natural gemstone sourcing to finished high jewelry. With deep expertise in natural gemstones and diamonds, Eshed\u2013Gemstar serves leading jewelry houses and luxury retailers worldwide.",
    },
    {
      heading: "OUR JEWELRY",
      body: "Our collection features fine jewelry and one-of-a-kind high jewelry showcasing natural emeralds, rare gemstones, natural diamonds, and fancy-color diamonds. Each piece is created for luxury retailers, combining exceptional gemstones with elegant design, superior craftsmanship, value, and strong commercial appeal.",
    },
  ];
  const aboutMaxW = isLandscape ? 235 : 165;
  const aboutBodySize = isLandscape ? 10.5 : 11;
  const aboutLineH = isLandscape ? 4.9 : 5.3;
  let aboutY = titleY + (isLandscape ? 15 : 20);
  ABOUT.forEach((section) => {
    pdf.setFont(TITLE_FONT, "normal");
    pdf.setFontSize(14);
    pdf.setTextColor(240, 240, 240);
    pdf.text(section.heading, pageWidth / 2, aboutY, { align: "center", charSpace: 1.6 });
    // short accent line under the heading
    pdf.setDrawColor(170, 170, 170);
    pdf.setLineWidth(0.3);
    pdf.line(pageWidth / 2 - 12, aboutY + 2.8, pageWidth / 2 + 12, aboutY + 2.8);
    aboutY += 10;
    pdf.setFont(BODY_FONT, "normal");
    pdf.setFontSize(aboutBodySize);
    pdf.setTextColor(220, 220, 220);
    const lines = pdf.splitTextToSize(section.body, aboutMaxW);
    lines.forEach((line) => {
      pdf.text(line, pageWidth / 2, aboutY, { align: "center" });
      aboutY += aboutLineH;
    });
    aboutY += isLandscape ? 6.5 : 9;
  });

  pdf.setFont(BODY_FONT, "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(200, 200, 200);
  const dateStr = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
  pdf.text(dateStr, pageWidth / 2, pageHeight - 34, { align: "center" });

  pdf.setDrawColor(180, 180, 180);
  pdf.setLineWidth(0.3);
  pdf.line(15, pageHeight - 24, pageWidth - 15, pageHeight - 24);

  pdf.setFontSize(8.5);
  pdf.setTextColor(230, 230, 230);
  pdf.text(ESHED.branches, pageWidth / 2, pageHeight - 17, { align: "center" });

  pdf.setFontSize(8);
  const coverFooterY = pageHeight - 10;
  const sepLeft = pageWidth / 2 - 32;
  const sepRight = pageWidth / 2 + 32;
  pdf.setTextColor(220, 220, 220);
  pdf.textWithLink(ESHED.site, sepLeft - 4, coverFooterY, { align: "right", url: ESHED.siteUrl });
  pdf.setTextColor(150, 150, 150);
  pdf.text("|", sepLeft, coverFooterY, { align: "center" });
  pdf.setTextColor(220, 220, 220);
  pdf.text(ESHED.phone, pageWidth / 2, coverFooterY, { align: "center" });
  pdf.setTextColor(150, 150, 150);
  pdf.text("|", sepRight, coverFooterY, { align: "center" });
  pdf.setTextColor(220, 220, 220);
  pdf.text(ESHED.email, sepRight + 4, coverFooterY, { align: "left" });

  // ==================== CONTENT PAGES ====================
  // Dense grid so pages look full and colorful: portrait 4x4 (16/page),
  // landscape 5x3 (15/page). The card is compact — the image fills most of
  // it, with no dead space at the bottom.
  const COLS = isLandscape ? 5 : 4;
  const ROWS = isLandscape ? 3 : 4;
  const perPage = COLS * ROWS;
  const totalPages = Math.ceil(selectedStones.length / perPage);

  // Clean header: just the dark ESHED logo on the left — no background bar,
  // no branch/contact text.
  const HEADER_H = 20;
  const drawHeader = () => {
    const headerLogo = logoDark || logo;
    if (headerLogo) {
      try {
        const lp = pdf.getImageProperties(headerLogo);
        const lh = 12;
        const lw = lh * (lp.width / lp.height);
        pdf.addImage(headerLogo, "PNG", margin + 2, (HEADER_H - lh) / 2 + 2, lw, lh);
      } catch (e) { /* skip */ }
    }
  };

  const drawFooter = (pageNum) => {
    const fY = pageHeight - 10;
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.3);
    pdf.line(margin, fY - 5, pageWidth - margin, fY - 5);
    pdf.setFont(BODY_FONT, "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);
    const fDate = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
    pdf.text(fDate, margin, fY);
    pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, fY, { align: "right" });
  };

  // Pre-load all item images and check which product pages are still live
  // on eshed.com, in parallel (same proxy as the regular catalog).
  const [images, deadSkus] = await Promise.all([
    Promise.all(selectedStones.map((s) => loadItemImage(s.imageUrl))),
    fetchDeadSkus(selectedStones),
  ]);

  const gridTop = HEADER_H + 5;
  const gridBottom = pageHeight - 18;
  const cellW = (pageWidth - margin * 2) / COLS;
  const cellH = (gridBottom - gridTop) / ROWS;

  let pageNum = 0;
  for (let i = 0; i < selectedStones.length; i += perPage) {
    pdf.addPage();
    pageNum++;
    drawHeader();

    const pageItems = selectedStones.slice(i, i + perPage);
    for (let j = 0; j < pageItems.length; j++) {
      const stone = pageItems[j];
      const img = images[i + j];
      const col = j % COLS;
      const row = Math.floor(j / COLS);
      const x = margin + col * cellW;
      const y = gridTop + row * cellH;

      // Cell border — thin gray, cells touching like a table.
      pdf.setDrawColor(190, 190, 190);
      pdf.setLineWidth(0.2);
      pdf.rect(x, y, cellW, cellH);

      // Image area — everything above the tight text block. Photos were
      // already cropped to the jewel itself (trimWhitespace), and each one is
      // scaled so its LARGEST side hits the same uniform square slot. That
      // way every piece prints at the same visual size, original aspect kept.
      const TEXT_BLOCK = 16; // sku + type + title/blanks + link, tight
      const areaW = cellW - 2;
      const areaH = cellH - TEXT_BLOCK - 5;
      const areaX = x + (cellW - areaW) / 2;
      const areaY = y + 1.5;
      const slot = Math.min(areaW, areaH); // uniform square, same on every card
      if (img) {
        try {
          const p = pdf.getImageProperties(img);
          const ratio = p.width / p.height;
          let w = slot, h = slot / ratio;
          if (h > slot) { h = slot; w = slot * ratio; }
          const fmt = img.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
          pdf.addImage(img, fmt, areaX + (areaW - w) / 2, areaY + (areaH - h) / 2, w, h);
        } catch (e) { /* leave blank */ }
      } else {
        pdf.setFontSize(6.5);
        pdf.setTextColor(180, 180, 180);
        pdf.setFont("helvetica", "italic");
        pdf.text("No image", x + cellW / 2, areaY + areaH / 2, { align: "center" });
      }

      let textY = areaY + areaH + 3.5;

      // SKU / model number — bold, centered.
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(30, 30, 30);
      pdf.text(String(stone.sku || "-"), x + cellW / 2, textY, { align: "center" });
      textY += 3;

      // Type label — small gray, centered.
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.3);
      pdf.setTextColor(120, 120, 120);
      pdf.text(itemTypeLabel(stone), x + cellW / 2, textY, { align: "center" });
      textY += 3.8;

      // Website text (item title) — printed when typed in the dialog,
      // otherwise blank fill-in lines so the sheet still works as a
      // handwriting worksheet. Set in Playfair Display, the same elegant
      // serif as the cover title, centered like a caption.
      if (stone.websiteText) {
        pdf.setFont(TITLE_FONT, "normal");
        pdf.setFontSize(7.2);
        pdf.setTextColor(40, 40, 40);
        const lines = pdf.splitTextToSize(stone.websiteText, cellW - 6).slice(0, 2);
        pdf.text(lines, x + cellW / 2, textY, { align: "center" });
        textY += lines.length * 3 + 2.6;
      } else {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(6.3);
        pdf.setTextColor(60, 60, 60);
        pdf.text("Website text:", x + 3, textY);
        pdf.setDrawColor(160, 160, 160);
        pdf.setLineWidth(0.15);
        pdf.line(x + 18, textY + 0.5, x + cellW - 3, textY + 0.5);
        textY += 3.6;
        pdf.line(x + 3, textY + 0.5, x + cellW - 3, textY + 0.5);
        textY += 4.2;
      }

      // Product page link — blue + underlined when the item has a DNA page.
      // Items whose page was removed from eshed.com link to the shop catalog
      // instead of a dead product URL.
      let url = itemUrl(stone);
      if (url && deadSkus.has(String(stone.sku || "").trim().toLowerCase())) {
        url = CATALOG_FALLBACK_URL;
      }
      pdf.setFontSize(6.3);
      if (url) {
        const label = "View more images & videos";
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(37, 99, 235);
        pdf.textWithLink(label, x + cellW / 2, textY, { align: "center", url });
        const lw = pdf.getTextWidth(label);
        pdf.setDrawColor(37, 99, 235);
        pdf.setLineWidth(0.15);
        pdf.line(x + cellW / 2 - lw / 2, textY + 0.6, x + cellW / 2 + lw / 2, textY + 0.6);
      } else {
        pdf.setFont("helvetica", "italic");
        pdf.setTextColor(140, 140, 140);
        pdf.text("Add product-page link", x + cellW / 2, textY, { align: "center" });
      }
    }

    drawFooter(pageNum);
  }

  // ==================== CONTACT US (closing page) ====================
  pdf.addPage();
  drawCoverBg();

  if (logo) {
    try {
      const props = pdf.getImageProperties(logo);
      const logoW = 45;
      const logoH = logoW * (props.height / props.width);
      pdf.addImage(logo, "PNG", pageWidth / 2 - logoW / 2, pageHeight * 0.13, logoW, logoH);
    } catch (e) { /* skip */ }
  }

  const contactTitleY = pageHeight * (isLandscape ? 0.38 : 0.38);
  pdf.setFont(TITLE_FONT, "normal");
  pdf.setFontSize(24);
  pdf.setTextColor(255, 255, 255);
  pdf.text("CONTACT US", pageWidth / 2, contactTitleY, { align: "center", charSpace: 1 });
  pdf.setDrawColor(170, 170, 170);
  pdf.setLineWidth(0.3);
  pdf.line(pageWidth / 2 - 14, contactTitleY + 3.5, pageWidth / 2 + 14, contactTitleY + 3.5);

  let cy = contactTitleY + (isLandscape ? 17 : 22);

  // Contact person
  pdf.setFont(TITLE_FONT, "normal");
  pdf.setFontSize(15);
  pdf.setTextColor(245, 245, 245);
  pdf.text("Liran Eshed", pageWidth / 2, cy, { align: "center" });
  cy += 7.5;
  pdf.setFont(BODY_FONT, "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(220, 220, 220);
  const phoneLabel = "+1 (917) 309-2523";
  pdf.textWithLink(phoneLabel, pageWidth / 2 - pdf.getTextWidth(phoneLabel) / 2, cy, { url: "tel:+19173092523" });
  cy += isLandscape ? 11 : 14;

  // New York office
  pdf.setFont(TITLE_FONT, "normal");
  pdf.setFontSize(10.5);
  pdf.setTextColor(235, 235, 235);
  pdf.text("NEW YORK OFFICE", pageWidth / 2, cy, { align: "center", charSpace: 1.2 });
  cy += 6;
  pdf.setFont(BODY_FONT, "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(210, 210, 210);
  pdf.text("580 Fifth Ave, Suite 3000", pageWidth / 2, cy, { align: "center" });
  cy += 4.8;
  pdf.text("New York, NY 10036, United States", pageWidth / 2, cy, { align: "center" });
  cy += isLandscape ? 11 : 14;

  // Website + Instagram links
  pdf.setFont(BODY_FONT, "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(235, 235, 235);
  const siteLabel = "www.eshed.com";
  pdf.textWithLink(siteLabel, pageWidth / 2 - pdf.getTextWidth(siteLabel) / 2, cy, { url: "https://www.eshed.com" });
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.2);
  pdf.line(pageWidth / 2 - pdf.getTextWidth(siteLabel) / 2, cy + 1, pageWidth / 2 + pdf.getTextWidth(siteLabel) / 2, cy + 1);
  cy += 7.5;
  pdf.setFontSize(10);
  pdf.setTextColor(220, 220, 220);
  const igLabel = "@eshed_gemstar";
  pdf.textWithLink(igLabel, pageWidth / 2 - pdf.getTextWidth(igLabel) / 2, cy, { url: "https://www.instagram.com/eshed_gemstar/" });
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.2);
  pdf.line(pageWidth / 2 - pdf.getTextWidth(igLabel) / 2, cy + 1, pageWidth / 2 + pdf.getTextWidth(igLabel) / 2, cy + 1);

  // Same bottom strip as the cover: divider + branches + contact row.
  pdf.setDrawColor(180, 180, 180);
  pdf.setLineWidth(0.3);
  pdf.line(15, pageHeight - 24, pageWidth - 15, pageHeight - 24);
  pdf.setFont(BODY_FONT, "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(230, 230, 230);
  pdf.text(ESHED.branches, pageWidth / 2, pageHeight - 17, { align: "center" });
  pdf.setFontSize(8);
  const cFooterY = pageHeight - 10;
  pdf.setTextColor(220, 220, 220);
  pdf.textWithLink(ESHED.site, sepLeft - 4, cFooterY, { align: "right", url: ESHED.siteUrl });
  pdf.setTextColor(150, 150, 150);
  pdf.text("|", sepLeft, cFooterY, { align: "center" });
  pdf.setTextColor(220, 220, 220);
  pdf.text(ESHED.phone, pageWidth / 2, cFooterY, { align: "center" });
  pdf.setTextColor(150, 150, 150);
  pdf.text("|", sepRight, cFooterY, { align: "center" });
  pdf.setTextColor(220, 220, 220);
  pdf.text(ESHED.email, sepRight + 4, cFooterY, { align: "left" });

  const filename = `ESHED_Jewelry_Catalog_${new Date().toISOString().split("T")[0]}_${selectedStones.length}pcs.pdf`;
  pdf.save(filename);
};
