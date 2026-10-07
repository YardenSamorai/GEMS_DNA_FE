import { changeMeasurementsFormat } from "../utils/helper";
import { clean, dnaSubtitle, fancyColorText, shapeName, stoneKind } from "../pages/dna/dnaModel";

export const DNA_ORIGIN = "https://gems-dna.com";
export const STONE_API = "https://gems-dna-be.onrender.com/api/stones";

export const dnaUrl = (sku) => `${DNA_ORIGIN}/${encodeURIComponent(sku)}`;

/** Default catalog lookup: the public DNA endpoint; null when not found. */
export async function fetchStone(sku, { fetchImpl = fetch, api = STONE_API } = {}) {
  const res = await fetchImpl(`${api}/${encodeURIComponent(sku)}`);
  if (!res.ok) return null;
  const stone = await res.json();
  return stone && typeof stone === "object" ? stone : null;
}

const graded = (label, value) => (clean(value) ? `${label} ${clean(value)}` : null);

/**
 * Catalog identity for one memo line. Uses the same vocabulary and category
 * gating as the DNA page; carat and prices are never taken from the catalog.
 */
export function catalogFacts(stone) {
  const kind = stoneKind(stone);
  const isDiamondLike = kind === "diamond" || kind === "fancy";
  const measurements = clean(changeMeasurementsFormat(clean(stone.measurements1)));
  const facts = [
    shapeName(stone),
    kind === "diamond" ? clean(stone.color) : null,
    isDiamondLike ? clean(stone.clarity) : null,
    isDiamondLike ? null : clean(stone.origin),
    kind === "emerald" ? clean(stone.treatment) : null,
    measurements ? `${measurements} mm` : null,
  ].filter(Boolean);
  const grading = isDiamondLike
    ? [graded("Cut", stone.cut), graded("Pol", stone.polish), graded("Sym", stone.symmetry), graded("Fl", stone.fluorescence)].filter(Boolean)
    : [];
  return {
    kind,
    type: kind === "fancy" ? `${fancyColorText(stone) || "Fancy Color"} Diamond` : dnaSubtitle({ ...stone, origin: null }),
    facts,
    grading,
    lab: clean(stone.lab),
    reportNumber: clean(stone.certificate_number),
  };
}

const sameSku = (a, b) => clean(a) && clean(b) && clean(a).toUpperCase() === clean(b).toUpperCase();

/**
 * Adds `catalog` to items whose SKU resolves to a DNA stone.
 *
 * @param model    memo model (buildMemoModel)
 * @param options.lookupStone (sku) => stone | null
 * @param options.verifyUrl   (url) => boolean; certificate links render only
 *                            when this confirms the URL. Omit to show the lab
 *                            and report number without a link.
 * @param options.loadImage   (url) => src | null; e.g. inline/downscale. Omit
 *                            to use the catalog URL directly.
 */
export async function enrichMemo(model, options = {}) {
  const results = await Promise.all(model.items.map((item) => enrichItem(item, options)));
  return {
    ...model,
    items: results.map((r) => r.item),
    warnings: [...model.warnings, ...results.flatMap((r) => r.warnings)],
  };
}

// Barak's stand-in picture when a stone has no photo.
const PLACEHOLDER_IMAGE = /no_image/i;

async function enrichItem(item, { lookupStone = fetchStone, verifyUrl = null, loadImage = null }) {
  const warnings = [];
  if (!item.sku) return { item, warnings };
  let stone = null;
  try {
    stone = await lookupStone(item.sku);
  } catch (error) {
    warnings.push({ code: "CATALOG_UNAVAILABLE", message: `Item ${item.sku}: catalog lookup failed (${error.message}).`, item: item.index });
  }
  if (stone && !sameSku(stone.sku || stone.stone_id, item.sku)) {
    warnings.push({ code: "CATALOG_MISMATCH", message: `Item ${item.sku}: catalog returned ${stone.sku || stone.stone_id}; not used.`, item: item.index });
    stone = null;
  }
  if (!stone) {
    warnings.push({ code: "NOT_IN_CATALOG", message: `Item ${item.sku} has no DNA record; shown without image, specs or DNA link.`, item: item.index });
    return { item, warnings };
  }

  const facts = catalogFacts(stone);
  const memoCarat = item.carat?.value;
  const catalogCarat = Number(stone.carat);
  if (memoCarat != null && Number.isFinite(catalogCarat) && Math.abs(catalogCarat - memoCarat) > 0.005) {
    warnings.push({
      code: "CATALOG_CARAT_DIFFERS",
      message: `Item ${item.sku}: memo says ${item.carat.text} ct, catalog says ${stone.carat} ct. The memo value is shown.`,
      item: item.index,
    });
  }

  let certificateUrl = null;
  const candidate = clean(stone.certificate_url);
  if (candidate && verifyUrl) {
    try {
      certificateUrl = (await verifyUrl(candidate)) ? candidate : null;
    } catch {
      certificateUrl = null;
    }
    if (!certificateUrl) {
      warnings.push({ code: "CERTIFICATE_UNVERIFIED", message: `Item ${item.sku}: certificate URL did not respond; report number shown without a link.`, item: item.index });
    }
  }

  let image = null;
  const picture = clean(stone.picture);
  if (picture && !PLACEHOLDER_IMAGE.test(picture)) {
    try {
      image = loadImage ? await loadImage(picture) : picture;
    } catch {
      image = null;
    }
  }
  if (!image) warnings.push({ code: "MISSING_IMAGE", message: `Item ${item.sku}: no usable image; the row shows text only.`, item: item.index });

  return { item: { ...item, catalog: { ...facts, image, certificateUrl, dnaUrl: dnaUrl(clean(stone.sku) || item.sku) } }, warnings };
}
