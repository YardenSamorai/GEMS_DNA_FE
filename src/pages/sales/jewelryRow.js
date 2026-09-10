import { decryptPrice } from "../../utils/decrypt";
import { sanitizeText, normalizeJewelryCategory } from "../../utils/helper";

/* =============================================================================
 * Mapping a raw jewelry_products row into the flat shape the UI works with.
 *
 * Kept clear of both catalog pages because all three surfaces need it: the
 * jewelry catalog, the product page, and — since a SKU list is answered across
 * every category at once — the stone catalog too.
 * ========================================================================== */

/* Format a raw jewelry_size ("6.500", "18.000") into a clean chip label
 * ("6.5", "18"). Returns "" when the size is missing/zero. */
export const fmtSize = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(parseFloat(n.toFixed(2)));
};

/* Map a raw jewelry_products row into the flat shape the card + filters use. */
export const mapRow = (row) => {
  const images = (row.all_pictures_link || "")
    .split(";")
    .map((u) => u.trim())
    .filter(Boolean);
  const firstImage = images[0] || null;
  // The WooCommerce feed sends `price` as a plain number ("1000", "10000"),
  // but some older rows may still be AES-encrypted. Try a direct numeric parse
  // first and only fall back to decryption when that isn't a finite number.
  let price = 0;
  const rawPrice = row.price;
  if (rawPrice != null && String(rawPrice).trim() !== "") {
    const direct = Number(rawPrice);
    if (Number.isFinite(direct)) {
      price = direct;
    } else {
      try {
        price = Number(decryptPrice(rawPrice)) || 0;
      } catch {
        price = 0;
      }
    }
  }
  // Location surface (mirrors loose stones). `branch` + `exactLocation` come
  // from the linked centre stone (masked per viewer on the BE); `location`
  // stays branch-backward-compatible. on memo/hold flags drive the catalog tags.
  const branch = row.branch ? String(row.branch).trim() : (row.shipping_from ? String(row.shipping_from).trim() : "");
  const exactLocation = row.exact_location ? String(row.exact_location).trim() : "";
  return {
    kind: "jewelry",
    id: row.model_number,
    sku: row.model_number || "",
    name: sanitizeText(row.title) || row.model_number || "Untitled",
    location: branch,
    branch,
    exactLocation,
    holder: row.holder ? String(row.holder).trim() : "",
    onMemo: !!row.on_memo,
    onHold: !!row.on_hold,
    videoUrl: row.video_link ? String(row.video_link).trim() : "",
    certificateUrl: row.certificate_link ? String(row.certificate_link).trim() : "",
    certificateNumber: row.certificate_number ? String(row.certificate_number).trim() : "",
    jewelryType: row.jewelry_type ? String(row.jewelry_type).trim() : "",
    style: row.style ? String(row.style).trim() : "",
    stoneType: row.stone_type ? String(row.stone_type).trim() : "",
    shape: row.center_stone_shape ? String(row.center_stone_shape).trim() : "",
    centerCarat:
      row.center_stone_carat != null && row.center_stone_carat !== "" ? Number(row.center_stone_carat) : null,
    jewelryWeight:
      row.jewelry_weight != null && row.jewelry_weight !== "" ? Number(row.jewelry_weight) : null,
    totalCarat: row.total_carat != null && row.total_carat !== "" ? Number(row.total_carat) : null,
    // Ring size / necklace length from the feed, cleaned up ("6.5", "18");
    // shown as a spec row on the product page. "" when the piece has no size.
    size: fmtSize(row.jewelry_size),
    // 1 = must not appear on websites, 2 = website-approved, null =
    // unclassified (arrived after the last level list was applied).
    securityLevel: row.security_level ?? null,
    category:
      normalizeJewelryCategory(row.jewelry_type) ||
      normalizeJewelryCategory(row.style) ||
      normalizeJewelryCategory(row.category) ||
      "",
    metal: row.metal_type ? String(row.metal_type).trim() : "",
    image: firstImage,
    images,
    price: price || 0,
    // What the piece cost us (feed's real_unit_cost). The BE sends null to
    // anyone not cleared for cost, so its absence is the permission check.
    cost: row.real_unit_cost != null && row.real_unit_cost !== "" ? Number(row.real_unit_cost) : null,
    // When the piece was first imported — drives the default newest-first order.
    createdAt: row.first_seen_at || null,
  };
};
