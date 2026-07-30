/* =============================================================================
 * SINGLE SOURCE OF TRUTH FOR PRICE SCALING
 * =============================================================================
 *
 * Every screen that renders a stone price MUST go through this module. Do not
 * write `price / 2` or `price * 2` anywhere else in the codebase.
 *
 * ---------------------------------------------------------------------------
 * THE CONVENTION
 * ---------------------------------------------------------------------------
 * The `price_per_carat` / `total_price` columns hold the supplier's real
 * asking price, exactly as it appears in the Barak export. Neither importer
 * transforms it: both the SOAP sync and the CSV/Excel upload run the raw cell
 * through `parseFloat` and store the result verbatim, and neither column is in
 * the preserve/restore list, so nothing can overwrite them after the insert.
 *
 *   Stored value  = the real price          → this is what we call "Neto"
 *   Neto display  = stored × 1
 *   Bruto display = stored × 2              → negotiation headroom, gemstones only
 *   Sales display = stored × 1              → customers see the real price
 *
 * Diamonds (including Fancy) and jewelry have no Neto/Bruto split: they are
 * always shown as-is.
 *
 * ---------------------------------------------------------------------------
 * WHY WE KNOW THIS IS RIGHT (do not "fix" it without re-running this proof)
 * ---------------------------------------------------------------------------
 * The feed sends the price per carat and the Rap discount percentage in two
 * independent fields, so they validate each other:
 *
 *     pricePerCt = rapListPrice × (1 + rapPrice / 100)
 *
 * That identity holds for 272 of the 279 diamonds that carry Rap data (the
 * remaining 7 are small drifts from a stale Rap list, not scaling errors). If
 * the stored price were doubled, every implied percentage would be off by
 * ~100 points. It is not. The importers apply no per-category branching, so
 * the same convention necessarily applies to sapphires, rubies and emeralds.
 *
 * The backend re-runs this proof automatically after every import — see
 * `utils/priceIntegrity.js` and the `price_audit_log` table. If someone
 * reintroduces a ×2 upstream, that check fails loudly instead of silently
 * shipping wrong prices to customers.
 *
 * ---------------------------------------------------------------------------
 * HISTORY — the bug this module exists to prevent
 * ---------------------------------------------------------------------------
 * The importer used to double prices on the way in, so the DB really did hold
 * a doubled value and screens divided by 2 to undo it. When the doubling was
 * removed from the importer, the divisions were left behind in several places
 * and drifted apart, which produced two contradictory definitions of "Neto"
 * living in the same app and gemstones being shown at a quarter of their real
 * price on the sales floor. Centralising the rule here is what stops that from
 * happening again.
 * ========================================================================== */

import { getMappedCategories } from "./categoryMap";

/** Multiplier applied on top of the stored price to reach the Bruto figure. */
export const BRUTO_MULTIPLIER = 2;

/** Valid values for every `priceMode` prop / localStorage entry in the app. */
export const PRICE_MODES = Object.freeze({ NETO: "neto", BRUTO: "bruto" });

/** localStorage key the inventory toggle writes and other screens mirror. */
export const PRICE_MODE_STORAGE_KEY = "gems_price_mode";

/** Read the user's Neto/Bruto preference, defaulting to Neto when unavailable. */
export const readPriceMode = () => {
  try {
    return localStorage.getItem(PRICE_MODE_STORAGE_KEY) === PRICE_MODES.BRUTO
      ? PRICE_MODES.BRUTO
      : PRICE_MODES.NETO;
  } catch (_) {
    return PRICE_MODES.NETO;
  }
};

/** Persist the Neto/Bruto preference. Silently ignores unavailable storage. */
export const writePriceMode = (mode) => {
  try {
    localStorage.setItem(
      PRICE_MODE_STORAGE_KEY,
      mode === PRICE_MODES.BRUTO ? PRICE_MODES.BRUTO : PRICE_MODES.NETO
    );
  } catch (_) {
    /* storage unavailable — the screen falls back to Neto next load */
  }
};

/* Diamonds, fancies and jewelry are quoted at a single price, so the Bruto
 * toggle must not touch them even when it is switched on globally. */
export const supportsBrutoMode = (stone) => {
  if (!stone) return false;
  if (stone.category === "Jewelry") return false;
  return !getMappedCategories(stone.category).includes("Diamond");
};

/**
 * Display multiplier for one stone on the internal inventory screens.
 * Returns 1 or `BRUTO_MULTIPLIER` — never a fraction.
 */
export const inventoryPriceScale = (stone, priceMode) =>
  supportsBrutoMode(stone) && priceMode === PRICE_MODES.BRUTO
    ? BRUTO_MULTIPLIER
    : 1;

/**
 * Scale one stored price for display on the internal inventory screens.
 * Non-numeric input (null, "", undefined) is passed through untouched so
 * callers keep rendering their own "-" placeholder.
 */
export const scaleInventoryPrice = (value, stone, priceMode) => {
  if (value == null || value === "" || !isFinite(Number(value))) return value;
  return Number(value) * inventoryPriceScale(stone, priceMode);
};

/**
 * Sales-floor price policy. Customers see the supplier's real asking price, so
 * the stored value is shown as-is for every category.
 *
 * This function is deliberately kept as the single hook where a future
 * discount would be applied. If a promotion is ever introduced, change it
 * HERE and nowhere else, and make it explicit which categories it covers.
 */
export const salesPriceScale = () => 1;

/** Apply the sales-floor policy to a stone record, returning a new object. */
export const adjustSalesPrices = (stone) => {
  const scale = salesPriceScale(stone);
  if (scale === 1) return stone;
  const adj = (v) =>
    v != null && v !== "" && isFinite(Number(v)) ? Number(v) * scale : v;
  return { ...stone, pricePerCt: adj(stone.pricePerCt), priceTotal: adj(stone.priceTotal) };
};

/**
 * Consistency check for one stone: the total must equal price-per-carat times
 * weight. A mismatch means the feed row was shifted or mis-parsed, which is
 * exactly the failure mode that silently corrupts prices.
 *
 * Returns null when the stone lacks the data to check, otherwise a report.
 */
export const checkPriceConsistency = (stone, tolerance = 0.01) => {
  const ppc = Number(stone?.pricePerCt);
  const total = Number(stone?.priceTotal);
  const carat = Number(stone?.weightCt);
  if (![ppc, total, carat].every((n) => isFinite(n) && n > 0)) return null;

  const expected = ppc * carat;
  const drift = Math.abs(expected - total) / total;
  return { ok: drift <= tolerance, expected, actual: total, drift };
};
