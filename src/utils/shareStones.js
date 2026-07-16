import { getMappedCategories } from "./categoryMap";
import { getDisplayShape, shortTreatment } from "../pages/inventory/helpers/constants";
import { parseDims, usableImg, prettyBranch } from "../pages/sales/SalesInventory";
import { logShareEvents } from "../services/stonesApi";
import { trackShare } from "./activityLog";

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

const API_BASE = process.env.REACT_APP_API_URL || "https://gems-dna-be.onrender.com";

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

/* Branch label for share text — normalises bare "USA" to the real branch
 * (shared with the catalog/detail surfaces). */
const displayBranch = (v) => prettyBranch(v);

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

/* ---- direct (full-quality) video links ------------------------------------
 * A player.vimeo.com embed link opens Vimeo's adaptive player, which serves
 * a low rendition on phones. The BE's /api/vimeo-file/:id resolves the direct
 * 1080p MP4 (Vimeo API) — the same source our in-app player uses — so every
 * link we hand to a client opens at full quality. Resolutions are cached
 * in-module; failures fall back to the original embed link. */
const VIMEO_EMBED_RE = /player\.vimeo\.com\/video\/(\d+)/i;
const directVideoCache = new Map(); // vimeoId -> direct link | null

export const resolveDirectVideoUrl = async (url) => {
  const m = VIMEO_EMBED_RE.exec(url || "");
  if (!m) return url || null;
  const id = m[1];
  if (directVideoCache.has(id)) return directVideoCache.get(id) || url;
  try {
    const r = await fetch(`${API_BASE}/api/vimeo-file/${id}`);
    const link = r.ok ? (await r.json())?.link || null : null;
    directVideoCache.set(id, link);
    return link || url;
  } catch {
    return url; // transient failure — don't poison the cache
  }
};

/* Clone the given item(s) with videoUrl swapped to the direct MP4 link.
 * Call ahead of a share gesture to warm the cache (keeps iOS activation). */
export const withDirectVideoLinks = async (stones) => {
  const arr = (Array.isArray(stones) ? stones : [stones]).filter(Boolean);
  return Promise.all(
    arr.map(async (s) => {
      const v = videoUrl(s);
      if (!v) return s;
      const direct = await resolveDirectVideoUrl(v);
      return direct && direct !== v ? { ...s, videoUrl: direct } : s;
    })
  );
};

/* Prefer a real certificate image; fall back to the (often PDF) cert file. */
const certUrl = (stone) => {
  const jpg = httpUrl(stone?.certificateImageJpg);
  if (jpg && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(jpg)) return jpg;
  return httpUrl(stone?.certificateUrl) || jpg || null;
};

/* ============================================================================
 * Text builders
 * ========================================================================== */

/* Diamonds:
 *   20.02 PS I VS2 NON GIA              ← weight shape color clarity fluor lab
 *   Ratio: 1.59
 *   Branch: New York
 *   SKU: T0644
 *   Rap %: -15                          ← only when withRap is enabled
 *   p/c: $94,000.00
 *   Total: $1,881,880.00
 *
 *   video: <url>
 *
 *   Cert: <url>
 *
 *   Image: <url>                         (each link on its own block) */
const buildDiamondText = (stone, { withPrice = true, withRap = false } = {}) => {
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

  const branch = displayBranch(stone.branch);
  if (branch) lines.push(`Branch: ${branch}`);

  if (stone.sku) lines.push(`SKU: ${stone.sku}`);

  // Rap % (diamonds/fancy only) sits just above the price block when enabled.
  if (withRap) {
    const rap = String(stone.rapPrice ?? "").trim();
    if (rap !== "") lines.push(`Rap %: ${rap}`);
  }

  if (withPrice) {
    lines.push(`p/c: ${usd(stone.pricePerCt)}`);
    lines.push(`Total: ${usd(stone.priceTotal)}`);
  }

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
 *   Branch: <branch>
 *   SKU: <sku>
 *   p/c: <price per carat>
 *   total: <total price>
 *
 *   video: <url>
 *   Cert: <url>
 *   image: <url> */
const buildColoredStoneText = (stone, { withPrice = true } = {}) => {
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

  const branch = displayBranch(stone.branch);
  if (branch) lines.push(`Branch: ${branch}`);

  if (stone.sku) lines.push(`SKU: ${stone.sku}`);

  if (withPrice) {
    lines.push(`p/c: ${usd(stone.pricePerCt)}`);
    lines.push(`total: ${usd(stone.priceTotal)}`);
  }

  // Labelled media links, each preceded by a blank line.
  const v = videoUrl(stone);
  if (v) lines.push("", `video: ${v}`);
  const c = certUrl(stone);
  if (c) lines.push("", `Cert: ${c}`);
  const img = stoneImageUrl(stone);
  if (img) lines.push("", `image: ${img}`);

  return lines.join("\n");
};

/* Jewelry — every detail line carries a label, mirroring the product page:
 *   <title>
 *   Gem type: <stone type>
 *   Center stone: <center carat> ct
 *   Total carat: <total carat> ct
 *   Style: <style>
 *   Metal: <metal>
 *   SKU: <sku>
 *   Branch: <branch>
 *   …links */
const buildJewelryText = (item, { withPrice = true } = {}) => {
  const lines = [];

  const title = String(item.name || item.title || "").trim();
  if (title) lines.push(title);

  const gemType = String(item.stoneType || "").trim();
  if (gemType) lines.push(`Gem type: ${gemType}`);

  const cc = Number(item.centerCarat);
  if (Number.isFinite(cc)) lines.push(`Center stone: ${cc.toFixed(2)} ct`);

  const tcw = Number(item.totalCarat);
  if (Number.isFinite(tcw)) lines.push(`Total carat: ${tcw.toFixed(2)} ct`);

  const wt = Number(item.jewelryWeight);
  if (Number.isFinite(wt)) lines.push(`Total weight: ${parseFloat(wt.toFixed(2))} g`);

  const style = String(item.style || "").trim();
  if (style) lines.push(`Style: ${style}`);

  const metal = String(item.metal || "").trim();
  if (metal) lines.push(`Metal: ${metal}`);

  if (item.sku) lines.push(`SKU: ${item.sku}`);

  const branch = displayBranch(item.branch || item.location);
  if (branch) lines.push(`Branch: ${branch}`);

  if (withPrice) {
    const price = Number(item.price);
    if (Number.isFinite(price) && price > 0) lines.push(`Total: ${usd(price)}`);
  }

  // Labelled media links, each preceded by a blank line.
  const v = videoUrl(item);
  if (v) lines.push("", `Video link: ${v}`);
  const c = certUrl(item);
  if (c) lines.push("", `Cert link: ${c}`);
  const img = stoneImageUrl(item);
  if (img) lines.push("", `Image link: ${img}`);

  return lines.join("\n");
};

/* One stone → a text block. Jewelry, diamonds, and coloured stones each have
 * their own field list. */
export const buildStoneShareText = (stone, opts = {}) => {
  if (!stone) return "";
  if (stone.kind === "jewelry") return buildJewelryText(stone, opts);
  return isDiamondStone(stone)
    ? buildDiamondText(stone, opts)
    : buildColoredStoneText(stone, opts);
};

/* Many stones → blocks separated by a dashed divider line. */
export const buildStonesMessage = (stones, opts = {}) =>
  (Array.isArray(stones) ? stones : [stones])
    .filter(Boolean)
    .map((s) => buildStoneShareText(s, opts))
    .join("\n\n- - - - - - - - -\n\n");

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

/* WhatsApp compresses/rejects very large attachments — skip the video file
 * beyond this size and let the text link carry it instead. */
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;

/* Fetch the item's Vimeo video as a real MP4 File: resolve the direct
 * highest-rendition file link through our BE (Vimeo API), then download it.
 * Sending the actual file preserves the full 1080p quality — a WhatsApp link
 * preview or the embedded player would degrade it. */
const fetchVideoFile = async (stone) => {
  const v = videoUrl(stone);
  if (!VIMEO_EMBED_RE.test(v || "")) return null;
  try {
    const link = await resolveDirectVideoUrl(v);
    if (!link || link === v) return null;
    const res = await fetch(link, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.size || blob.size > MAX_VIDEO_BYTES) return null;
    const sku = stone?.sku || "stone";
    return new File([blob], `${sku}.mp4`, { type: "video/mp4" });
  } catch {
    return null; // any failure → the text link still carries the video
  }
};

/* Fetch the stone photo + video + certificate for each stone into File
 * objects. Safe to call ahead of the share gesture (keeps iOS user-activation
 * intact). */
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
    const vid = await fetchVideoFile(stone);
    if (vid) files.push(vid);
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

export const shareStonesOnWhatsApp = async (
  stones,
  { files, actor, withPrice = true, withRap = false } = {}
) => {
  // Swap embed video links for the direct 1080p MP4s so the client gets the
  // full-quality file, not Vimeo's phone-degraded player. Usually instant —
  // the detail pages warm the cache when the action sheet opens.
  const arr = await withDirectVideoLinks(stones);
  const text = buildStonesMessage(arr, { withPrice, withRap });

  // Record the send for the sales Dashboard (best effort, never blocks).
  logShareEvents(actor, arr, "whatsapp");
  // Mirror into the Team activity feed, with the medium and whether prices
  // were included so the manager view can show what actually went out.
  trackShare(arr, { medium: "whatsapp", priceIncluded: !!withPrice });

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
