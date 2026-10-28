import { getMappedCategories } from "../../utils/categoryMap";
import { usableMediaUrl } from "../../utils/mediaUrl";
import { getDisplayColor, getDisplayShape } from "../inventory/helpers/constants";
import { formatCarat, isJewelryItem } from "../inventory/model/inventoryModel";
import { cleanValue as clean, isDiamondLike } from "../inventory/ui/format";

/* Items travel in the URL by SKU, so a presentation built on the desktop opens
 * the same on the iPad. DB ids change on every inventory sync; SKUs do not.
 * Jewelry is prefixed because a model number could equal a stone SKU. */
const JEWELRY_PREFIX = "j:";

export const itemsParam = (items) =>
  items
    .filter((it) => it?.sku)
    .map((it) => (isJewelryItem(it) ? `${JEWELRY_PREFIX}${it.sku}` : it.sku))
    .join(",");

export const parseItemsParam = (value) =>
  String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) =>
      s.startsWith(JEWELRY_PREFIX)
        ? { kind: "jewelry", sku: s.slice(JEWELRY_PREFIX.length) }
        : { kind: "stone", sku: s }
    );

/* In URL order; anything no longer in inventory is left out. */
export const pickItems = (refs, stones, jewelry) => {
  const bySku = (list) => new Map(list.filter((it) => it?.sku).map((it) => [it.sku, it]));
  const stoneMap = bySku(stones || []);
  const jewelryMap = bySku(jewelry || []);
  return refs
    .map((r) => (r.kind === "jewelry" ? jewelryMap.get(r.sku) : stoneMap.get(r.sku)))
    .filter(Boolean);
};

/* Opening from Inventory hands the already-loaded items over, so the
 * presentation appears instantly instead of re-downloading the catalog. */
const SNAPSHOT_KEY = "present.snapshot";

export const rememberItems = (param, items) => {
  try {
    sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ param, items }));
  } catch {
    /* storage full or blocked: the page fetches instead */
  }
};

export const recallItems = (param) => {
  try {
    const snap = JSON.parse(sessionStorage.getItem(SNAPSHOT_KEY) || "null");
    return snap && snap.param === param && Array.isArray(snap.items) ? snap.items : null;
  } catch {
    return null;
  }
};

const splitList = (v) =>
  String(v || "")
    .split(";")
    .map((u) => usableMediaUrl(u))
    .filter(Boolean);

const unique = (list) => [...new Set(list.filter(Boolean))];

const isImageUrl = (u) => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(u || "");

// Barak's stand-in for "no photo yet" (StoneImages/no_image1.jpg).
const isPlaceholder = (u) => /\/no_?image\d*\.(jpe?g|png)(\?|$)/i.test(u || "");

/* Everything the stage can show for one item, in presenting order:
 * photos, then videos / 360° spins, then the certificate. */
export const mediaFor = (item) => {
  if (!item) return [];
  const jewelry = isJewelryItem(item);
  const images = (
    jewelry
      ? unique([...(item.allImages || []).map(usableMediaUrl), usableMediaUrl(item.imageUrl)])
      : unique([usableMediaUrl(item.imageUrl), ...splitList(item.additionalPictures)])
  ).filter((u) => !isPlaceholder(u));
  const videos = jewelry
    ? splitList(item.videoLink)
    : unique([usableMediaUrl(item.videoUrl), ...splitList(item.additionalVideos)]);

  const media = images.map((src) => ({ type: "image", src }));
  videos.forEach((src, i) => {
    const spin = /v360|vision360|d360|segoma|diacam/i.test(src);
    media.push({ type: "video", src, label: spin ? "360°" : videos.length > 1 ? `Video ${i + 1}` : "Video" });
  });

  const certImage = jewelry ? null : usableMediaUrl(item.certificateImageJpg);
  const certLink = usableMediaUrl(jewelry ? item.certificateLink : item.certificateUrl);
  if (certImage && isImageUrl(certImage)) {
    media.push({ type: "cert", src: certImage, image: true, link: certLink || certImage });
  } else if (certLink) {
    media.push({ type: "cert", src: certLink, image: isImageUrl(certLink), link: certLink });
  }
  return media;
};

export const posterFor = (item) => mediaFor(item).find((m) => m.type === "image")?.src || null;

/* The showcase opens on the photo; without one, a 360° spin, else a video. */
export const primaryMediaIndex = (media) => {
  const photo = media.findIndex((m) => m.type === "image");
  if (photo >= 0) return photo;
  const spin = media.findIndex((m) => m.type === "video" && m.label === "360°");
  if (spin >= 0) return spin;
  const video = media.findIndex((m) => m.type === "video");
  if (video >= 0) return video;
  return 0;
};

/* One button for all photos, one per video, one for the certificate. */
export const mediaGroups = (media) => {
  const groups = [];
  const photos = media.map((m, i) => (m.type === "image" ? i : -1)).filter((i) => i >= 0);
  if (photos.length) {
    groups.push({ key: "photos", label: photos.length > 1 ? `Photos · ${photos.length}` : "Photo", kind: "image", indices: photos });
  }
  media.forEach((m, i) => {
    if (m.type === "video") groups.push({ key: `v${i}`, label: m.label, kind: "video", indices: [i] });
  });
  const cert = media.findIndex((m) => m.type === "cert");
  if (cert >= 0) groups.push({ key: "cert", label: "Certificate", kind: "cert", indices: [cert] });
  return groups;
};

const VIMEO_ID = /vimeo\.com\/(?:video\/|manage\/videos\/)?(\d+)/i;

/* Vimeo plays as the BE's largest progressive MP4 so it can autoplay muted in
 * a <video> at full quality; other direct files play as-is; anything else
 * (V360…) needs its own iframe. */
export const directVideoUrl = (url, apiBase) => {
  const id = VIMEO_ID.exec(url || "")?.[1];
  if (id) return `${apiBase}/api/vimeo-file/${id}/file`;
  return /\.(mp4|m4v|mov|webm)(\?|$)/i.test(url || "") ? url : null;
};

/* The title already carries weight and shape (stones) or the type (jewelry);
 * the showcase has room for eight tiles. */
export const showcaseSpecs = (item) => {
  const skip = isJewelryItem(item) ? ["Type"] : ["Shape", "Weight"];
  return specsFor(item).filter(([k]) => !skip.includes(k));
};

/* "Emerald", "Diamond", "Ring" — the small caps line above the title. */
export const categoryLabel = (item) => {
  if (isJewelryItem(item)) return clean(item.jewelryType) || "Jewelry";
  const mapped = getMappedCategories(item.category).filter((c) => c && c !== "Empty");
  if (mapped.includes("Fancy")) return "Fancy Diamond";
  return mapped[0] || clean(item.category) || "Gemstone";
};

const ratioText = (r) => (r != null && Number.isFinite(Number(r)) && Number(r) > 0 ? Number(r).toFixed(2) : "");

/* Client-facing only: no box, location, holder or internal grouping. */
export const specsFor = (item) => {
  if (!item) return [];
  const diamond = !isJewelryItem(item) && isDiamondLike(item);
  const rows = isJewelryItem(item)
    ? [
        ["Type", clean(item.jewelryType)],
        ["Metal", clean(item.metalType)],
        ["Total carat", item.weightCt ? `${item.weightCt} ct` : ""],
        ["Center stone", clean(item.stoneType)],
        ["Center carat", item.centerStoneCarat ? `${item.centerStoneCarat} ct` : ""],
        ["Shape", clean(getDisplayShape(item.shape))],
        ["Color", clean(item.color)],
        ["Clarity", clean(item.clarity)],
        ["Size", clean(item.jewelrySize)],
        ["Weight", clean(item.jewelryWeight) ? `${clean(item.jewelryWeight)} g` : ""],
        ["Certificate", clean(item.certificateNumber)],
      ]
    : [
        ["Shape", clean(getDisplayShape(item.shape))],
        ["Weight", formatCarat(item.weightCt)],
        ["Color", clean(getDisplayColor(item))],
        [diamond ? "Clarity" : "Treatment", clean(diamond ? item.clarity : item.treatment)],
        ["Origin", clean(item.origin)],
        ["Lab", clean(item.lab)],
        ...(diamond
          ? [
              ["Cut", clean(item.cut)],
              ["Polish", clean(item.polish)],
              ["Symmetry", clean(item.symmetry)],
              ["Fluorescence", clean(item.fluorescence)],
            ]
          : []),
        ["Measurements", clean(item.measurements)],
        ["Ratio", ratioText(item.ratio)],
        ["Pair", clean(item.pairSku) ? `With ${clean(item.pairSku)}` : ""],
        ["Certificate", clean(item.certificateNumber)],
      ];
  return rows.filter(([, v]) => v !== "" && v != null);
};
