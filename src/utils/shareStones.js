import { getMappedCategories } from "./categoryMap";
import { getDisplayShape, getDisplayColor, shortTreatment } from "../pages/inventory/helpers/constants";
import { money, resolveLocation, parseDims, fluorDisplay, usableImg } from "../pages/sales/SalesInventory";

/* ============================================================================
 * shareStones — build a WhatsApp-friendly text summary for one or many stones
 * and hand it off to WhatsApp.
 *
 * Two delivery paths:
 *   1) "Smart share" via the Web Share API (navigator.share) — lets us attach
 *      the certificate as a real IMAGE file. Works on mobile in a secure
 *      (HTTPS) context.
 *   2) Fallback — a plain wa.me text link (text only, cert as a URL) for
 *      desktop / unsupported / non-secure contexts.
 *
 * NOTE: the exact fields & order of the text are still a first sensible default
 * — keep all of that inside buildStoneShareText so there's a single place to
 * tweak.
 * ========================================================================== */

const isDiamondStone = (stone) => {
  const m = getMappedCategories(stone?.category);
  return m.includes("Diamond") || m.includes("Fancy");
};
const isFancyStone = (stone) => getMappedCategories(stone?.category).includes("Fancy");

const firstImage = (stone) => {
  const urls = [stone?.imageUrl, ...String(stone?.additionalPictures || "").split(";")];
  for (const u of urls) {
    const ok = usableImg(u);
    if (ok) return ok;
  }
  return null;
};

const certLink = (stone) =>
  usableImg(stone?.certificateUrl) || usableImg(stone?.certificateImageJpg) || null;

/* One stone → a multi-line block. */
export const buildStoneShareText = (stone, { includeCertLink = true } = {}) => {
  if (!stone) return "";
  const isDiamond = isDiamondStone(stone);
  const isFancy = isFancyStone(stone);

  const wt = stone.weightCt != null && stone.weightCt !== "" ? Number(stone.weightCt).toFixed(2) : "";
  const shape = getDisplayShape(stone.shape);
  const lab = stone.lab && String(stone.lab).toUpperCase() !== "N/A" ? stone.lab : "";
  const treatment = stone.treatment ? shortTreatment(stone.treatment) : "";
  const fancyDesc = [stone.fancyIntensity, stone.fancyColor].filter(Boolean).join(" ");

  const title = isDiamond
    ? [wt, shape, isFancy ? fancyDesc : stone.color, isFancy ? "" : stone.clarity, lab]
        .filter(Boolean)
        .join(" ")
    : [wt, shape, lab, treatment].filter(Boolean).join(" ");

  const { label: locationLabel, memo } = resolveLocation(stone);
  const [len, wid, dep] = parseDims(stone.measurements);
  const lwd = [len, wid, dep].every((n) => Number.isFinite(n))
    ? `${len.toFixed(2)}-${wid.toFixed(2)}-${dep.toFixed(2)}`
    : String(stone.measurements || "").trim();

  const ppc = money(stone.pricePerCt);
  const total = money(stone.priceTotal);
  const holder = stone.holder && String(stone.holder).trim() ? String(stone.holder).trim() : null;

  const lines = [];
  lines.push(`*${title || stone.sku || "Stone"}*`);
  if (holder) lines.push(`HOLD · ${holder}`);
  else if (memo) lines.push("MEMO OUT");

  if (isDiamond) {
    const finish = [stone.cut, stone.polish, stone.symmetry].filter(Boolean).join(" / ");
    if (finish) lines.push(`Cut/Pol/Sym: ${finish}`);
    const fl = fluorDisplay(stone.fluorescence);
    if (fl) lines.push(`Fluorescence: ${fl}`);
  } else {
    const color = getDisplayColor(stone);
    if (color) lines.push(`Color: ${color}`);
    if (stone.origin && String(stone.origin).toUpperCase() !== "N/A") lines.push(`Origin: ${stone.origin}`);
  }

  if (lwd) lines.push(`Measurements: ${lwd}`);
  if (locationLabel) lines.push(`Location: ${locationLabel}`);

  const priceParts = [];
  if (ppc) priceParts.push(`${ppc}/ct`);
  if (isDiamond && stone.rapPrice != null && stone.rapPrice !== "") priceParts.push(`RAP ${stone.rapPrice}%`);
  if (total) priceParts.push(`Total ${total}`);
  if (priceParts.length) lines.push(priceParts.join("  |  "));

  if (stone.sku) lines.push(`SKU: ${stone.sku}`);

  if (includeCertLink) {
    const cert = certLink(stone);
    if (cert) lines.push(`Certificate: ${cert}`);
  }
  const img = firstImage(stone);
  if (img) lines.push(img);

  return lines.join("\n");
};

/* Many stones → blocks separated by a divider. */
export const buildStonesMessage = (stones, opts) =>
  (Array.isArray(stones) ? stones : [stones])
    .filter(Boolean)
    .map((s) => buildStoneShareText(s, opts))
    .join("\n\n— — —\n\n");

/* ----------------------------------------------------------------------------
 * Certificate image attachment helpers
 * -------------------------------------------------------------------------- */

/* Best image URL for a stone's certificate (prefer the JPG render). */
const certImageUrl = (stone) =>
  usableImg(stone?.certificateImageJpg) || usableImg(stone?.certificateUrl) || null;

const fileNameFor = (url, stone) => {
  const clean = String(url).split("?")[0];
  let name = clean.split("/").pop() || "";
  const base = `cert-${stone?.sku || "stone"}`;
  if (!name) name = base;
  if (!/\.(jpe?g|png|webp|gif|pdf)$/i.test(name)) name = `${base}.jpg`;
  return name;
};

/* Fetch each stone's certificate image into a File (skips anything that fails,
 * e.g. CORS-blocked or missing). Safe to call ahead of the share gesture. */
export const prepareCertFiles = async (stones) => {
  const arr = (Array.isArray(stones) ? stones : [stones]).filter(Boolean);
  const files = [];
  for (const stone of arr) {
    const url = certImageUrl(stone);
    if (!url) continue;
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) continue;
      const blob = await res.blob();
      files.push(new File([blob], fileNameFor(url, stone), { type: blob.type || "image/jpeg" }));
    } catch {
      /* ignore — we'll fall back to the text link */
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

/* ----------------------------------------------------------------------------
 * Entry point
 * -------------------------------------------------------------------------- */

/* Share via native sheet (with cert images) when possible, else wa.me text. */
export const shareStonesOnWhatsApp = async (stones, { files } = {}) => {
  const arr = (Array.isArray(stones) ? stones : [stones]).filter(Boolean);

  if (canShareFiles(files)) {
    try {
      // Cert is attached as an image → no need to repeat it as a link.
      await navigator.share({ files, text: buildStonesMessage(arr, { includeCertLink: false }) });
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return; // user cancelled the sheet
      /* otherwise fall through to the text link */
    }
  }

  const url = `https://wa.me/?text=${encodeURIComponent(buildStonesMessage(arr))}`;
  window.open(url, "_blank", "noopener,noreferrer");
};
