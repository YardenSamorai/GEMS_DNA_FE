import { getMappedCategories } from "./categoryMap";
import { getDisplayShape, getDisplayColor, shortTreatment } from "../pages/inventory/helpers/constants";
import { money, resolveLocation, parseDims, fluorDisplay, usableImg } from "../pages/sales/SalesInventory";

/* ============================================================================
 * shareStones — build a WhatsApp-friendly text summary for one or many stones
 * and hand it off to WhatsApp.
 *
 * Two delivery paths:
 *   1) "Smart share" via the Web Share API (navigator.share) — lets us attach
 *      the stone photo + the certificate as real files. Works on mobile in a
 *      secure (HTTPS) context.
 *   2) Fallback — a plain wa.me text link (text only; photo + cert as URLs) for
 *      desktop / unsupported / non-secure contexts.
 * ========================================================================== */

const SHARE_BASE = "gems-dna.com";

const isDiamondStone = (stone) => {
  const m = getMappedCategories(stone?.category);
  return m.includes("Diamond") || m.includes("Fancy");
};
const isFancyStone = (stone) => getMappedCategories(stone?.category).includes("Fancy");

/* ---- small formatters ---------------------------------------------------- */

const dash = (v) => {
  const s = String(v ?? "").trim();
  return s || "-";
};

/* "$2,726.88" — always two decimals; dash when empty/NaN. */
const usd = (n) => {
  const num = Number(n);
  if (n == null || n === "" || !Number.isFinite(num)) return "-";
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const pctText = (n) => {
  const num = Number(n);
  if (n == null || n === "" || !Number.isFinite(num)) return "-";
  return `${num.toFixed(2)}%`;
};

/* "8.64-7.52-5.68" → "8.64 x 7.52 x 5.68" */
const measurementsText = (m) => {
  const dims = parseDims(m);
  if (dims.length >= 3) return dims.slice(0, 3).map((d) => d.toFixed(2)).join(" x ");
  const raw = String(m || "").trim();
  return raw || "-";
};

/* Diamond-trade fluorescence abbreviations (N → NON, etc.). */
const FLUOR_ABBR = {
  N: "NON", NONE: "NON", NON: "NON",
  F: "FNT", FAINT: "FNT", FNT: "FNT",
  M: "MED", MEDIUM: "MED", MED: "MED",
  S: "STG", STRONG: "STG", STG: "STG",
  VS: "VST", VSTG: "VST", VST: "VST", "VERY STRONG": "VST",
};
const fluorAbbr = (v) => {
  const k = String(v ?? "").trim().toUpperCase();
  return FLUOR_ABBR[k] || k || "-";
};

/* ---- media URL helpers --------------------------------------------------- */

/* Accept only real http(s) URLs (guards against junk values in the data). */
const httpUrl = (u) => {
  const ok = usableImg(u);
  return ok && /^https?:\/\//i.test(ok) ? ok : null;
};

const stoneImageUrl = (stone) => {
  const urls = [stone?.imageUrl, ...String(stone?.additionalPictures || "").split(";")];
  for (const u of urls) {
    const ok = httpUrl(u);
    if (ok) return ok;
  }
  return null;
};

/* Prefer a real certificate image; fall back to the (often PDF) cert file. */
const certUrl = (stone) => {
  const jpg = httpUrl(stone?.certificateImageJpg);
  if (jpg && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(jpg)) return jpg;
  return httpUrl(stone?.certificateUrl) || jpg || null;
};

const publicUrl = (stone) => (stone?.sku ? `${SHARE_BASE}/sales/stone/${stone.sku}` : null);

/* ============================================================================
 * Text builders
 * ========================================================================== */

/* Diamonds — exact field list / order requested by sales. */
const buildDiamondText = (stone, { includeMediaLinks }) => {
  const isFancy = isFancyStone(stone);
  const wt = stone.weightCt != null && stone.weightCt !== "" ? Number(stone.weightCt).toFixed(2) : "-";
  const color = isFancy ? [stone.fancyIntensity, stone.fancyColor].filter(Boolean).join(" ") : stone.color;

  const lines = [
    `Stock No: ${dash(stone.sku)}`,
    `Shape: ${dash(stone.shape)}`,
    `Carats: ${wt}`,
    `Color: ${dash(color)}`,
    `Clarity: ${dash(stone.clarity)}`,
    `Cut: ${dash(stone.cut)}`,
    `Polish: ${dash(stone.polish)}`,
    `Symmetry: ${dash(stone.symmetry)}`,
    `Fluorescence: ${fluorAbbr(stone.fluorescence)}`,
    `Measurements: ${measurementsText(stone.measurements)}`,
    `Table %: ${pctText(stone.tablePercent)}`,
    `Depth %: ${pctText(stone.depthPercent)}`,
    `Rap ($): ${usd(stone.rapListPrice)}`,
    `Public URL: ${publicUrl(stone) || "-"}`,
    `Pr/Ct: ${usd(stone.pricePerCt)}`,
    `Amt ($): ${usd(stone.priceTotal)}`,
  ];

  if (includeMediaLinks) {
    const photo = stoneImageUrl(stone);
    if (photo) lines.push(`Photo: ${photo}`);
    const cert = certUrl(stone);
    if (cert) lines.push(`Certificate: ${cert}`);
  }

  return lines.join("\n");
};

/* Non-diamonds (emerald / gemstone / jewelry) — generic default for now,
 * pending the per-category formats. */
const buildGenericText = (stone, { includeMediaLinks }) => {
  const wt = stone.weightCt != null && stone.weightCt !== "" ? Number(stone.weightCt).toFixed(2) : "";
  const shape = getDisplayShape(stone.shape);
  const lab = stone.lab && String(stone.lab).toUpperCase() !== "N/A" ? stone.lab : "";
  const treatment = stone.treatment ? shortTreatment(stone.treatment) : "";
  const title = [wt, shape, lab, treatment].filter(Boolean).join(" ");

  const { label: locationLabel, memo } = resolveLocation(stone);
  const ppc = money(stone.pricePerCt);
  const total = money(stone.priceTotal);
  const holder = stone.holder && String(stone.holder).trim() ? String(stone.holder).trim() : null;

  const lines = [`*${title || stone.sku || "Stone"}*`];
  if (holder) lines.push(`HOLD · ${holder}`);
  else if (memo) lines.push("MEMO OUT");

  const color = getDisplayColor(stone);
  if (color) lines.push(`Color: ${color}`);
  if (stone.origin && String(stone.origin).toUpperCase() !== "N/A") lines.push(`Origin: ${stone.origin}`);

  const meas = measurementsText(stone.measurements);
  if (meas !== "-") lines.push(`Measurements: ${meas}`);
  if (locationLabel) lines.push(`Location: ${locationLabel}`);

  const priceParts = [];
  if (ppc) priceParts.push(`${ppc}/ct`);
  if (total) priceParts.push(`Total ${total}`);
  if (priceParts.length) lines.push(priceParts.join("  |  "));
  if (stone.sku) lines.push(`SKU: ${stone.sku}`);
  const pub = publicUrl(stone);
  if (pub) lines.push(`Public URL: ${pub}`);

  if (includeMediaLinks) {
    const photo = stoneImageUrl(stone);
    if (photo) lines.push(`Photo: ${photo}`);
    const cert = certUrl(stone);
    if (cert) lines.push(`Certificate: ${cert}`);
  }

  return lines.join("\n");
};

/* One stone → a text block. includeMediaLinks=false when files are attached. */
export const buildStoneShareText = (stone, { includeMediaLinks = true } = {}) => {
  if (!stone) return "";
  return isDiamondStone(stone)
    ? buildDiamondText(stone, { includeMediaLinks })
    : buildGenericText(stone, { includeMediaLinks });
};

/* Many stones → blocks separated by a divider. */
export const buildStonesMessage = (stones, opts) =>
  (Array.isArray(stones) ? stones : [stones])
    .filter(Boolean)
    .map((s) => buildStoneShareText(s, opts))
    .join("\n\n— — —\n\n");

/* ============================================================================
 * Attachment helpers (stone photo + certificate)
 * ========================================================================== */

const fileNameFor = (url, fallback) => {
  const clean = String(url).split("?")[0];
  let name = clean.split("/").pop() || "";
  if (!name) name = fallback;
  return name;
};

const fetchAsFile = async (url, fallbackName, fallbackType) => {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new File([blob], fileNameFor(url, fallbackName), { type: blob.type || fallbackType });
  } catch {
    return null; // CORS / network / etc → caller falls back to links
  }
};

/* Fetch the stone photo + certificate for each stone into File objects.
 * Safe to call ahead of the share gesture (keeps iOS user-activation intact). */
export const prepareShareFiles = async (stones) => {
  const arr = (Array.isArray(stones) ? stones : [stones]).filter(Boolean);
  const files = [];
  for (const stone of arr) {
    const sku = stone?.sku || "stone";
    const photo = stoneImageUrl(stone);
    if (photo) {
      const f = await fetchAsFile(photo, `${sku}.jpg`, "image/jpeg");
      if (f) files.push(f);
    }
    const cert = certUrl(stone);
    if (cert) {
      const isPdf = /\.pdf(\?|$)/i.test(cert);
      const f = await fetchAsFile(cert, `cert-${sku}${isPdf ? ".pdf" : ".jpg"}`, isPdf ? "application/pdf" : "image/jpeg");
      if (f) files.push(f);
    }
  }
  return files;
};

/* Whether the current browser can share these files (mobile + secure context). */
export const canShareFiles = (files) =>
  Array.isArray(files) &&
  files.length > 0 &&
  typeof navigator !== "undefined" &&
  typeof navigator.canShare === "function" &&
  navigator.canShare({ files });

/* ============================================================================
 * Entry point
 * ========================================================================== */

export const shareStonesOnWhatsApp = async (stones, { files } = {}) => {
  const arr = (Array.isArray(stones) ? stones : [stones]).filter(Boolean);

  if (canShareFiles(files)) {
    try {
      // Photo + cert are attached as files → don't repeat them as links.
      await navigator.share({ files, text: buildStonesMessage(arr, { includeMediaLinks: false }) });
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return; // user cancelled the sheet
      /* otherwise fall through to the text link */
    }
  }

  const url = `https://wa.me/?text=${encodeURIComponent(buildStonesMessage(arr, { includeMediaLinks: true }))}`;
  window.open(url, "_blank", "noopener,noreferrer");
};
