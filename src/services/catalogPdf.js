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
import { withDirectVideoLinks } from "../utils/shareStones";

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
  const gemTypeName =
    mapped.filter((c) => !["Empty", "Diamond", "Fancy", "Emerald"].includes(c))[0] || "";

  if (isDiamond) {
    return [
      wt,
      shape,
      // Fancy colour = intensity + overtone + color (white `color` is empty on Fancy).
      isFancy ? getDisplayColor(it) : it.color,
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

/* ───────────────────────────── pairs ───────────────────────────── */

const skuOf = (it) => String(it?.sku ?? "").trim();

/* Collapse the picked list into cards: a matched pair becomes one unit, and
 * everything else stays on its own. Mirrors the rule the DNA page uses, so a
 * pair printed here is the same pair a customer sees at gems-dna.com/{sku} —
 * the partner must be present and must not point at some third stone.
 *
 * Only pairs where BOTH halves were picked are joined; pulling in an unpicked
 * partner would put stones in the catalog the sender never selected. */
const groupPairs = (items) => {
  const bySku = new Map();
  for (const it of items) {
    if (!isJewelry(it) && skuOf(it)) bySku.set(skuOf(it), it);
  }

  const used = new Set();
  const units = [];

  for (const it of items) {
    const sku = skuOf(it);
    // Jewelry can reach here without a SKU, so an empty one is never treated
    // as "already printed" — every picked item must appear exactly once.
    if (sku && used.has(sku)) continue;

    const partnerSku = isJewelry(it) ? "" : String(it?.pairSku ?? "").trim();
    const partner = partnerSku && partnerSku !== sku ? bySku.get(partnerSku) : null;
    const partnerPointsAt = partner ? String(partner.pairSku ?? "").trim() : "";
    const contradicted = partner && partnerPointsAt && partnerPointsAt !== sku;

    if (partner && !contradicted && !used.has(partnerSku)) {
      used.add(sku);
      used.add(partnerSku);
      // Fixed order by SKU so a pair reads the same whichever half was picked
      // first.
      const [a, b] = sku.localeCompare(partnerSku) <= 0 ? [it, partner] : [partner, it];
      units.push({ pair: true, a, b });
      continue;
    }

    if (sku) used.add(sku);
    units.push({ pair: false, a: it });
  }

  return units;
};

const pairWeight = (a, b) => (Number(a?.weightCt) || 0) + (Number(b?.weightCt) || 0);

const dropLeadingWeight = (title) => String(title).replace(/^\s*\d+(\.\d+)?\s*/, "");

const pairTitle = (a, b) => {
  const total = pairWeight(a, b);
  // What follows the weight is the same phrase for both halves of a real pair,
  // so it is stated once; a mismatched pair says so rather than describing
  // both stones with one stone's grades.
  const ra = dropLeadingWeight(itemTitle(a));
  const rb = dropLeadingWeight(itemTitle(b));
  const rest = ra === rb ? ra : `${ra} / ${rb}`;
  return [total ? `${total.toFixed(2)} ct total` : "", rest].filter(Boolean).join(" ");
};

/* One spec table for two stones: a value both stones share is stated once, and
 * where they differ both are shown. Same idea as the comparison table on the
 * pair DNA page. */
const pairSpecs = (a, b) => {
  const sa = itemSpecs(a);
  const sb = new Map(itemSpecs(b).map(([label, value]) => [label, value]));

  const rows = sa.map(([label, va]) => {
    const vb = sb.get(label);
    if (label === "SKU") return [label, `${skuOf(a)} + ${skuOf(b)}`];
    if (vb == null || String(vb) === String(va)) return [label, va];
    return [label, `${va} / ${vb}`];
  });

  const wa = Number(a?.weightCt) || 0;
  const wb = Number(b?.weightCt) || 0;
  if (wa && wb) rows.splice(1, 0, ["Weights", `${wa} + ${wb} ct`]);

  return rows;
};

const pairPrice = (a, b) => {
  const ta = Number(a?.priceTotal) || 0;
  const tb = Number(b?.priceTotal) || 0;
  const total = ta + tb;
  if (!total) return { total: null, ppc: null, rap: null };

  // Price per carat is a rate: the pair's figure is the combined price over
  // the combined weight, never the two rates added together.
  const ct = pairWeight(a, b);
  const rapA = itemPrice(a).rap;
  const rapB = itemPrice(b).rap;
  return {
    total: money(total),
    ppc: ct ? money(total / ct) : null,
    rap: rapA && rapB && rapA !== rapB ? `${rapA} / ${rapB}` : rapA || rapB || null,
  };
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

/* Compact item payload for the PDF's SHARE button → /share-item page. Only
 * the fields the WhatsApp message template reads; empty values dropped, and
 * every price field stripped when the catalog was exported without prices. */
const SHARE_FIELDS = [
  "kind", "sku", "category", "branch", "location",
  "weightCt", "shape", "color", "clarity", "fluorescence", "lab",
  "fancyIntensity", "fancyColor", "treatment", "ratio", "measurements",
  "name", "title", "stoneType", "centerCarat", "totalCarat", "jewelryWeight",
  "style", "metal", "jewelryType",
  "rapPrice", "pricePerCt", "priceTotal", "price",
  "videoUrl", "additionalVideos", "certificateUrl", "certificateImageJpg",
  "imageUrl", "image", "additionalPictures",
];

const sharePayload = (it, showPrices) => {
  const slim = {};
  for (const k of SHARE_FIELDS) {
    const v = it[k];
    if (v != null && v !== "") slim[k] = v;
  }
  if (!showPrices) {
    delete slim.rapPrice;
    delete slim.pricePerCt;
    delete slim.priceTotal;
    delete slim.price;
  }
  return slim;
};

/* base64url — keeps the payload safe inside a PDF link annotation. */
const encodePayload = (obj) =>
  window
    .btoa(unescape(encodeURIComponent(JSON.stringify(obj))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/* ───────────────────────── image loading ───────────────────────── */

/* Suppliers send photos in whatever aspect ratio they happen to shoot, and
 * fitting those inside the well left every card with a differently sized
 * picture — a wide shot printed short, a tall one printed narrow. Each photo is
 * therefore re-drawn centred and cropped to one fixed square before it reaches
 * the document, so every card shows the same size picture filling its frame. */
const PHOTO_PX = 600; // ≈300 dpi at the 54 mm single-card well

function squareCrop(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = PHOTO_PX;
        canvas.height = PHOTO_PX;
        const ctx = canvas.getContext("2d");
        // JPEG carries no alpha — without a white ground a transparent PNG
        // would come out black.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, PHOTO_PX, PHOTO_PX);

        const side = Math.min(img.naturalWidth, img.naturalHeight);
        if (!side) return resolve(dataUrl);
        ctx.drawImage(
          img,
          (img.naturalWidth - side) / 2,
          (img.naturalHeight - side) / 2,
          side,
          side,
          0,
          0,
          PHOTO_PX,
          PHOTO_PX
        );
        return resolve(canvas.toDataURL("image/jpeg", 0.85));
      } catch (_) {
        // Tainted canvas or an unsupported codec — the original still prints.
        return resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function loadImage(url) {
  if (!url) return null;
  try {
    const res = await fetch(`${API_BASE}/api/image-proxy?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.image || !data.image.startsWith("data:")) return null;
    return await squareCrop(data.image);
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
  // Swap Vimeo embed links for the direct 1080p MP4s (BE-resolved) so the
  // VIDEO buttons and the WhatsApp share text always open at full quality.
  const items = await withDirectVideoLinks((rawItems || []).filter(Boolean));

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
  const footerReserve = 16;
  const startY = headerBottom + 4; // y of the first card
  const maxY = pageH - footerReserve;

  // Fixed layout: exactly ROWS_PER_PAGE equal-height cards per page. Each card
  // gets the same slot height, so pages are uniform regardless of how many
  // spec rows an item carries (the spec block below adapts to fit its slot).
  const ROWS_PER_PAGE = 3;
  const cardGap = 6;
  const cardH = (maxY - startY - (ROWS_PER_PAGE - 1) * cardGap) / ROWS_PER_PAGE;

  const pad = 6; // inner padding of each card
  const imgSize = 54;
  // A pair card trades details width for a wider media column, so two photos
  // still print big enough to judge a stone by.
  const PAIR_PHOTO_W = 76;
  const PAIR_PHOTO_GAP = 4;
  const detailsX = margin + pad + imgSize + 9;
  const detailsW = margin + contentW - pad - detailsX;
  const rowH = 5.1; // baseline spec-row height (compressed to fit when needed)

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

  // One square photo well, filled or captioned "No image".
  const drawPhoto = (img, x, y, size) => {
    const radius = 2.5;
    pdf.setFillColor(...wash);
    pdf.roundedRect(x, y, size, size, radius, radius, "F");
    if (img) {
      try {
        const props = pdf.getImageProperties(img);
        // Photos reach here pre-cropped to a square and cover the well edge to
        // edge. Anything that slipped past the crop is centred at its own
        // proportions rather than stretched.
        const square = Math.abs(props.width - props.height) / props.width < 0.01;
        const fit = square ? 1 : Math.min(size / props.width, size / props.height);
        const w = square ? size : props.width * fit;
        const h = square ? size : props.height * fit;

        pdf.saveGraphicsState();
        try {
          pdf.roundedRect(x, y, size, size, radius, radius, null);
          pdf.clip();
          pdf.discardPath();
          pdf.addImage(img, formatOf(img), x + (size - w) / 2, y + (size - h) / 2, w, h);
        } finally {
          // A leaked clip would blank everything drawn after it on the page.
          pdf.restoreGraphicsState();
        }
        return;
      } catch (_) {
        /* leave the well empty on a bad image */
      }
    }
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(size >= imgSize ? 8 : 6.5);
    pdf.setTextColor(...muted);
    pdf.text("No image", x + size / 2, y + size / 2, { align: "center" });
  };

  const drawCard = (it, imgs, cardY, titleLines, specs, price, buttons, cardH, pair) => {
    const cardX = margin;
    // Card frame
    pdf.setDrawColor(...line);
    pdf.setLineWidth(0.4);
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(cardX, cardY, contentW, cardH, 3.5, 3.5, "FD");

    /* A pair needs two photos, so its card gives the media column more width
       and takes it back off the details column. These shadow the single-card
       values above, which the rest of this function reads unchanged. */
    const photoW = pair ? PAIR_PHOTO_W : imgSize;
    const detailsX = cardX + pad + photoW + 9;
    const detailsW = margin + contentW - pad - detailsX;

    const imgX = cardX + pad;
    if (pair) {
      const size = (photoW - PAIR_PHOTO_GAP) / 2;
      const imgY = cardY + (cardH - size) / 2 - 2;
      [pair.a, pair.b].forEach((stone, idx) => {
        const x = imgX + idx * (size + PAIR_PHOTO_GAP);
        drawPhoto(imgs[idx], x, imgY, size);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6.4);
        pdf.setTextColor(...muted);
        pdf.text(skuOf(stone), x + size / 2, imgY + size + 3.4, {
          align: "center",
          maxWidth: size,
        });
      });
    } else {
      drawPhoto(imgs[0], imgX, cardY + (cardH - imgSize) / 2, imgSize);
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
    pdf.text(
      pair ? `MATCHED PAIR  ·  ${categoryLabel(it)}` : categoryLabel(it),
      detailsX,
      ty + 0.5
    );
    ty += 4;

    pdf.setDrawColor(...line);
    pdf.setLineWidth(0.3);
    pdf.line(detailsX, ty, detailsX + detailsW, ty);
    ty += 3.5;

    // Space left for the spec block: everything from here down to the price
    // block (or the card bottom when prices are hidden), minus the button row.
    // The spec rows compress to fit their slot, and spill into two columns
    // when there are many — so no card ever overflows into the next.
    const buttonsH = buttons.length ? 8 : 0;
    const pY = cardY + cardH - pad - 6;
    const priceTop =
      showPrices && price.total
        ? (price.ppc ? pY - 8.5 : pY - 2.5)
        : cardY + cardH - pad;
    const specsAvail = Math.max(6, priceTop - ty - buttonsH - 2.5);

    const twoCol = specs.length > 6;
    const colW = (detailsW - 6) / 2;

    /* Two-column layout with an escape hatch: a row whose value can't be read
       in half the width — a pair's "3.65-3.62-2.24 / 3.66-3.61-2.25" — takes
       the full width instead of being clipped to look like a single figure. */
    const fitsHalf = ([label, value]) => {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.8);
      const labelW = pdf.getTextWidth(String(label).toUpperCase());
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(5.6); // the smallest size drawSpec will shrink a value to
      return pdf.getTextWidth(String(value)) <= colW - labelW - 2;
    };

    const layout = [];
    let specRows = 0;
    if (twoCol) {
      let row = 0;
      let held = null;
      const flushHeld = () => {
        if (!held) return;
        layout.push({ spec: held, x: detailsX, w: colW, row });
        held = null;
        row += 1;
      };
      for (const spec of specs) {
        if (!fitsHalf(spec)) {
          flushHeld();
          layout.push({ spec, x: detailsX, w: detailsW, row });
          row += 1;
        } else if (!held) {
          held = spec;
        } else {
          layout.push({ spec: held, x: detailsX, w: colW, row });
          layout.push({ spec, x: detailsX + colW + 6, w: colW, row });
          held = null;
          row += 1;
        }
      }
      flushHeld();
      specRows = row;
    } else {
      specs.forEach((spec, idx) => {
        layout.push({ spec, x: detailsX, w: detailsW, row: idx });
      });
      specRows = specs.length;
    }

    const sRowH = specRows ? Math.min(rowH, specsAvail / specRows) : rowH;

    const drawSpec = ([label, value], x, y, colWidth) => {
      const text = String(label).toUpperCase();
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(twoCol ? 6.8 : 7.6);
      pdf.setTextColor(...muted);
      pdf.text(text, x, y);
      const labelW = pdf.getTextWidth(text);

      /* Values shrink to fit the space the label leaves rather than being cut
         at a fixed width — a pair states two measurements in one row, and half
         a measurement silently printed as the whole is worse than small type. */
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...ink);
      const v = String(value);
      const avail = Math.max(6, colWidth - labelW - 2);
      let size = twoCol ? 7.8 : 8.6;
      pdf.setFontSize(size);
      while (size > 5.6 && pdf.getTextWidth(v) > avail) {
        size -= 0.3;
        pdf.setFontSize(size);
      }
      pdf.text(pdf.splitTextToSize(v, avail)[0], x + colWidth, y, { align: "right" });
    };

    const specsTop = ty;
    layout.forEach(({ spec, x, w, row }) => {
      drawSpec(spec, x, specsTop + row * sRowH, w);
    });
    ty = specsTop + specRows * sRowH;

    if (buttons.length) {
      ty += 1.5;
      let bx = detailsX;
      buttons.forEach((b) => {
        bx += drawLinkPill(b.label, bx, ty, b.color, b.url) + 3;
      });
    }

    if (showPrices && price.total) {
      // Price block below the spec table: per-carat price (when present)
      // right above the total. Rap % stays inside the table.
      const pY = cardY + cardH - pad - 6;
      const dividerY = price.ppc ? pY - 8.5 : pY - 2.5;
      pdf.setDrawColor(...line);
      pdf.setLineWidth(0.3);
      pdf.line(detailsX, dividerY, detailsX + detailsW, dividerY);

      if (price.ppc) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.6);
        pdf.setTextColor(...muted);
        pdf.text("PRICE PER CARAT", detailsX, pY - 2.5);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.6);
        pdf.setTextColor(...ink);
        pdf.text(price.ppc, detailsX + detailsW, pY - 2.5, { align: "right" });
      }

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

  let cardY = startY;
  let rowIndex = 0; // card position within the current page (0..ROWS_PER_PAGE-1)
  let pageStarted = false;
  const startPage = (first) => {
    if (!first) pdf.addPage();
    drawHeader();
    cardY = startY;
    rowIndex = 0;
  };

  const units = groupPairs(items);
  const imageByItem = new Map(items.map((it, idx) => [it, images[idx]]));
  const imageOf = (it) => imageByItem.get(it) || null;

  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    const it = unit.a;
    const pair = unit.pair ? unit : null;

    // A pair card's details column is narrower, so its title wraps sooner.
    const titleW = pair ? detailsW - (PAIR_PHOTO_W - imgSize) : detailsW;
    const titleLines = pdf
      .splitTextToSize((pair ? pairTitle(unit.a, unit.b) : itemTitle(it)) || it.sku || "", titleW)
      .slice(0, 2);
    const specs = pair ? pairSpecs(unit.a, unit.b) : itemSpecs(it);
    const price = pair ? pairPrice(unit.a, unit.b) : itemPrice(it);

    // Rap % sits inside the spec table, right below the Branch row.
    // Price-per-carat lives in the price block under the table, just above
    // the total.
    if (showPrices && price.rap) {
      const branchIdx = specs.findIndex(([label]) => label === "Branch");
      if (branchIdx >= 0) specs.splice(branchIdx + 1, 0, ["Rap %", price.rap]);
      else specs.push(["Rap %", price.rap]);
    }

    // Per-card action buttons — tappable link pills inside the PDF:
    //   Cert / Video open our branded /media viewer page (dark ESHED page
    //   with the media front-and-center — a PDF can't open dialogs, so this
    //   is the closest equivalent); Share opens WhatsApp with the exact same
    //   message template the Action sheet sends.
    const viewerUrl = (type, src, stone) =>
      `${window.location.origin}/media?type=${type}&sku=${encodeURIComponent(stone.sku || "")}&src=${encodeURIComponent(src)}`;
    const VIDEO_BLUE = [2, 132, 199];
    const buttons = [];

    if (pair) {
      // Each half keeps its own cert and video, so the pills are numbered to
      // match the SKUs printed under the two photos. SHARE is left off: the
      // composer it opens sends one stone, and a pair split across two
      // messages is exactly what this card exists to avoid.
      [unit.a, unit.b].forEach((stone, idx) => {
        const c = itemCertLink(stone);
        if (c) buttons.push({ label: `CERT ${idx + 1}`, color: brand, url: viewerUrl("cert", c, stone) });
      });
      [unit.a, unit.b].forEach((stone, idx) => {
        const v = itemVideoLink(stone);
        if (v) buttons.push({ label: `VIDEO ${idx + 1}`, color: VIDEO_BLUE, url: viewerUrl("video", v, stone) });
      });
    } else {
      const certL = itemCertLink(it);
      if (certL) buttons.push({ label: "CERT", color: brand, url: viewerUrl("cert", certL, it) });
      const videoL = itemVideoLink(it);
      if (videoL) buttons.push({ label: "VIDEO", color: VIDEO_BLUE, url: viewerUrl("video", videoL, it) });
      // SHARE opens our composer page — the price can be adjusted there before
      // the message goes out (a PDF can't show an edit dialog itself).
      buttons.push({
        label: "SHARE",
        color: [22, 163, 74],
        url: `${window.location.origin}/share-item?p=${showPrices ? 1 : 0}&d=${encodePayload(sharePayload(it, showPrices))}`,
      });
    }

    if (!pageStarted) {
      startPage(true);
      pageStarted = true;
    } else if (rowIndex >= ROWS_PER_PAGE) {
      startPage(false);
    }

    const cardImgs = pair
      ? [imageOf(unit.a), imageOf(unit.b)]
      : [imageOf(it)];
    drawCard(it, cardImgs, cardY, titleLines, specs, price, buttons, cardH, pair);
    cardY += cardH + cardGap;
    rowIndex += 1;
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

/** Build the catalog and hand it to the user.
 *
 * On phones (Web Share API with files), we open the native share sheet with a
 * real PDF File named "Catalog YYYY-MM-DD.pdf" and the caption set to the same
 * string — so WhatsApp gets the file + "Catalog 2026-07-22", never a
 * `blob:https://…` URL. (jsPDF's pdf.save() on iOS opens a blob: tab; sharing
 * from there is what was injecting that junk into the message.)
 *
 * Desktop (no file-share support) falls back to a normal download. */
export async function downloadCatalogPdf(items, options = {}) {
  const pdf = await buildCatalogPdf(items, options);
  // Local calendar date (not UTC) so an evening export in Israel doesn't
  // slip to yesterday. Filename is just "Catalog" + the export date —
  // no company name in the file name.
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const label = `Catalog ${yyyy}-${mm}-${dd}`;
  const filename = `${label}.pdf`;

  try {
    const blob = pdf.output("blob");
    const file = new File([blob], filename, { type: "application/pdf" });
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    ) {
      await navigator.share({
        files: [file],
        title: label,
        text: label,
      });
      return;
    }
  } catch (err) {
    if (err && err.name === "AbortError") return; // user cancelled the sheet
    /* otherwise fall through to a plain download */
  }

  pdf.save(filename);
}
