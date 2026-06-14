import { getMappedCategories } from "./categoryMap";
import { getDisplayShape, shortTreatment } from "../pages/inventory/helpers/constants";
import { parseDims, usableImg, resolveLocation } from "../pages/sales/SalesInventory";
import { logShareEvents } from "../services/stonesApi";

/* ============================================================================
 * shareStones — build a WhatsApp-friendly text summary for one or many stones
 * and hand it off to WhatsApp.
 *
 * Message layout (per stone):
 *   <weight> <shape> <color> <clarity> <fluorescence> <lab>   ← title
 *   <ratio>
 *   <branch>
 *   <sku>
 *   p/c - <price per carat>
 *   Total - <total price>
 *
 *   <video link>
 *   <certificate link>
 *   <image link>
 *
 * Delivery:
 *   - Smart share via the Web Share API attaches the stone photo + certificate
 *     as real files (mobile + HTTPS). The links above stay in the text too.
 *   - Fallback: a plain wa.me text link for desktop / unsupported contexts.
 * ========================================================================== */

const isDiamondStone = (stone) => {
  const m = getMappedCategories(stone?.category);
  return m.includes("Diamond") || m.includes("Fancy");
};
const isFancyStone = (stone) => getMappedCategories(stone?.category).includes("Fancy");

/* ---- small formatters ---------------------------------------------------- */

/* "$2,726.88" — always two decimals; dash when empty/NaN. */
const usd = (n) => {
  const num = Number(n);
  if (n == null || n === "" || !Number.isFinite(num)) return "-";
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  return FLUOR_ABBR[k] || k || "";
};

const ratioOf = (stone) => {
  let ratio = parseFloat(stone?.ratio);
  if (!Number.isFinite(ratio)) {
    const [l, w] = parseDims(stone?.measurements);
    if (Number.isFinite(l) && Number.isFinite(w) && w) ratio = l / w;
  }
  return Number.isFinite(ratio) ? ratio.toFixed(2) : "";
};

/* ---- media URL helpers --------------------------------------------------- */

/* Accept only real http(s) URLs (guards against junk values in the data). */
const httpUrl = (u) => {
  const ok = usableImg(u);
  return ok && /^https?:\/\//i.test(ok) ? ok : null;
};

const stoneImageUrl = (stone) => {
  const urls = [
    stone?.imageUrl,
    stone?.image, // jewelry items carry the first picture here
    ...String(stone?.additionalPictures || "").split(";"),
  ];
  for (const u of urls) {
    const ok = httpUrl(u);
    if (ok) return ok;
  }
  return null;
};

const videoUrl = (stone) => httpUrl(stone?.videoUrl) || httpUrl(stone?.additionalVideos);

/* Prefer a real certificate image; fall back to the (often PDF) cert file. */
const certUrl = (stone) => {
  const jpg = httpUrl(stone?.certificateImageJpg);
  if (jpg && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(jpg)) return jpg;
  return httpUrl(stone?.certificateUrl) || jpg || null;
};

/* video, certificate, image — in that order, only those present. */
const buildLinks = (stone) => {
  const out = [];
  const v = videoUrl(stone);
  if (v) out.push(v);
  const c = certUrl(stone);
  if (c) out.push(c);
  const img = stoneImageUrl(stone);
  if (img) out.push(img);
  return out;
};

/* ============================================================================
 * Text builders
 * ========================================================================== */

/* Diamonds:
 *   20.02 PS I VS2 NON GIA              ← weight shape color clarity fluor lab
 *   Ratio: 1.59
 *   Location: New York
 *   SKU: T0644
 *   p/c: $94,000.00
 *   Total: $1,881,880.00
 *
 *   video: <url>
 *
 *   Cert: <url>
 *
 *   Image: <url>                         (each link on its own block) */
const buildDiamondText = (stone) => {
  const isFancy = isFancyStone(stone);
  const wt = Number(stone.weightCt);
  const wtStr = Number.isFinite(wt) ? wt.toFixed(2) : "";
  const color = isFancy
    ? [stone.fancyIntensity, stone.fancyColor].filter(Boolean).join(" ")
    : stone.color;
  const lab = stone.lab && String(stone.lab).toUpperCase() !== "N/A" ? stone.lab : "";
  const fl = stone.fluorescence ? fluorAbbr(stone.fluorescence) : "";

  const title = [wtStr, stone.shape, color, stone.clarity, fl, lab].filter(Boolean).join(" ");

  const lines = [];
  if (title) lines.push(title);

  const ratio = ratioOf(stone);
  if (ratio) lines.push(`Ratio: ${ratio}`);

  const branch = String(stone.branch || "").trim();
  if (branch) lines.push(`Location: ${branch}`);

  if (stone.sku) lines.push(`SKU: ${stone.sku}`);

  lines.push(`p/c: ${usd(stone.pricePerCt)}`);
  lines.push(`Total: ${usd(stone.priceTotal)}`);

  // Labelled media links, each preceded by a blank line.
  const v = videoUrl(stone);
  if (v) lines.push("", `video: ${v}`);
  const c = certUrl(stone);
  if (c) lines.push("", `Cert: ${c}`);
  const img = stoneImageUrl(stone);
  if (img) lines.push("", `Image: ${img}`);

  return lines.join("\n");
};

/* Coloured stones (emeralds + other gemstones):
 *   <weight> <shape> <comment> <lab>
 *   Ratio : <ratio>
 *   <location>
 *   <sku>
 *   p/c: <price per carat>
 *   total: <total price>
 *   …links */
const buildColoredStoneText = (stone) => {
  const wt = Number(stone.weightCt);
  const wtStr = Number.isFinite(wt) ? wt.toFixed(2) : "";
  const shape = getDisplayShape(stone.shape) || stone.shape || "";
  const comment = stone.treatment ? shortTreatment(stone.treatment) : "";
  const lab = stone.lab && String(stone.lab).toUpperCase() !== "N/A" ? stone.lab : "";

  const title = [wtStr, shape, comment, lab].filter(Boolean).join(" ");

  const lines = [];
  if (title) lines.push(title);

  const ratio = ratioOf(stone);
  if (ratio) lines.push(`Ratio : ${ratio}`);

  const { label: location } = resolveLocation(stone);
  if (location) lines.push(String(location));

  if (stone.sku) lines.push(String(stone.sku));

  lines.push(`p/c: ${usd(stone.pricePerCt)}`);
  lines.push(`total: ${usd(stone.priceTotal)}`);

  const links = buildLinks(stone);
  if (links.length) lines.push("", ...links);

  return lines.join("\n");
};

/* Jewelry:
 *   <title>
 *   <center stone weight>
 *   <style>
 *   <sku>
 *   <location>
 *   …links */
const buildJewelryText = (item) => {
  const lines = [];

  const title = String(item.name || item.title || "").trim();
  if (title) lines.push(title);

  const cc = Number(item.centerCarat);
  if (Number.isFinite(cc)) lines.push(`${cc.toFixed(2)} ct`);

  const style = String(item.style || "").trim();
  if (style) lines.push(style);

  if (item.sku) lines.push(String(item.sku));

  const location = String(item.location || "").trim();
  if (location) lines.push(location);

  const links = buildLinks(item);
  if (links.length) lines.push("", ...links);

  return lines.join("\n");
};

/* One stone → a text block. Jewelry, diamonds, and coloured stones each have
 * their own field list. */
export const buildStoneShareText = (stone) => {
  if (!stone) return "";
  if (stone.kind === "jewelry") return buildJewelryText(stone);
  return isDiamondStone(stone) ? buildDiamondText(stone) : buildColoredStoneText(stone);
};

/* Many stones → blocks separated by a divider. */
export const buildStonesMessage = (stones) =>
  (Array.isArray(stones) ? stones : [stones])
    .filter(Boolean)
    .map(buildStoneShareText)
    .join("\n\n— — —\n\n");

/* ============================================================================
 * Attachment helpers (stone photo + certificate)
 * ========================================================================== */

const fileNameFor = (url, fallback) => {
  const clean = String(url).split("?")[0];
  return clean.split("/").pop() || fallback;
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

export const shareStonesOnWhatsApp = async (stones, { files, actor } = {}) => {
  const arr = (Array.isArray(stones) ? stones : [stones]).filter(Boolean);
  const text = buildStonesMessage(arr);

  // Record the send for the sales Dashboard (best effort, never blocks).
  logShareEvents(actor, arr, "whatsapp");

  if (canShareFiles(files)) {
    try {
      await navigator.share({ files, text });
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return; // user cancelled the sheet
      /* otherwise fall through to the text link */
    }
  }

  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
};
