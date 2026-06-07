import { JEWELRY_CATEGORIES, JEWELRY_STATUSES } from "./jewelryApi";

/**
 * Jewelry workshop settings.
 *
 * NOTE ON PERSISTENCE:
 * The GEMS DNA backend (gems-dna-be) does not yet expose a jewelry-settings
 * endpoint, so this layer persists to the browser's localStorage. It is written
 * as a small async-friendly abstraction so swapping to the real API later is a
 * one-file change — replace the bodies of `getJewelrySettings` /
 * `saveJewelrySettings` with `fetch` calls and every consumer keeps working.
 *
 * Suggested backend contract (when you open the BE repo):
 *   GET  /api/jewelry-settings            -> { defaultMarkupPercent, customCategories: string[], customFields: [{ id, label, type }] }
 *   PUT  /api/jewelry-settings            <- same shape (full object)  -> updated object
 *   (scoped to the authenticated owner / workspace, like the other endpoints)
 */

const STORAGE_KEY = "gemsdna.jewelry.settings.v1";

export const SETTINGS_CHANGED_EVENT = "jewelry-settings-changed";

const DEFAULTS = {
  // Starting markup applied to brand-new items that have no markup yet.
  defaultMarkupPercent: 0,
  // Extra categories the user adds on top of the built-in JEWELRY_CATEGORIES.
  customCategories: [],
  // Definitions only for now (display + future BE wiring), e.g.
  // { id, label, type: "text" | "number" | "date" }.
  customFields: [],
};

function readRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Current settings, merged over the defaults so missing keys are always safe. */
export function getJewelrySettings() {
  const stored = readRaw();
  return {
    ...DEFAULTS,
    ...stored,
    customCategories: Array.isArray(stored.customCategories)
      ? stored.customCategories
      : DEFAULTS.customCategories,
    customFields: Array.isArray(stored.customFields)
      ? stored.customFields
      : DEFAULTS.customFields,
  };
}

/**
 * Persist a partial patch over the current settings and notify listeners so
 * open screens (e.g. the New Item modal) can pick up changes without a reload.
 */
export function saveJewelrySettings(patch) {
  const next = { ...getJewelrySettings(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(
      new CustomEvent(SETTINGS_CHANGED_EVENT, { detail: next })
    );
  } catch {
    /* storage full / unavailable — keep the in-memory value, fail silently */
  }
  return next;
}

/** Numeric default markup %, clamped to a finite >= 0 value. */
export function getDefaultMarkupPercent() {
  const v = Number(getJewelrySettings().defaultMarkupPercent);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

/**
 * Built-in categories followed by the user's custom ones, de-duplicated
 * (case-insensitive) and order-preserving. This is the list dropdowns should
 * render so custom categories show up everywhere new items are created.
 */
export function getAllJewelryCategories() {
  const custom = getJewelrySettings().customCategories || [];
  const seen = new Set();
  const out = [];
  for (const raw of [...JEWELRY_CATEGORIES, ...custom]) {
    const value = String(raw || "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/** Re-exported for convenience so the Settings page has one import. */
export { JEWELRY_CATEGORIES, JEWELRY_STATUSES };
