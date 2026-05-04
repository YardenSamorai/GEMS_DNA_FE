import { mapping } from "./const";

export const encryptPrice = (price) => {
  if (!price) return "N/A";

  const strPrice = Math.round(Number(price)).toString(); // עיגול למספר שלם כדי למנוע בעיות עם נקודה עשרונית
  const trailingEncrypted = [];
  let encrypted = "";
  let i = 0;

  while (i < strPrice.length) {
    if (strPrice[i] === "0") {
      let zeroCount = 0;

      // סופרים כמה אפסים ברצף
      while (strPrice[i + zeroCount] === "0") {
        zeroCount++;
      }

      let encryptedZeros = "";
      let originalZeroCount = zeroCount; // נשמור כמה אפסים ראינו
      let tempI = i;

      if (zeroCount >= 3) {
        encryptedZeros += mapping["000"];
        zeroCount -= 3;
        tempI += 3;
      }

      if (zeroCount >= 2) {
        encryptedZeros += mapping["00"];
        zeroCount -= 2;
        tempI += 2;
      }

      if (zeroCount === 1) {
        encryptedZeros += mapping["0"];
        tempI += 1;
      }

      // אם כל האפסים שראינו היו בסוף המספר – נאחסן את ההצפנה לסוף
      if (tempI >= strPrice.length) {
        trailingEncrypted.push(...encryptedZeros);
        i = tempI;
      } else {
        encrypted += encryptedZeros;
        i = tempI;
      }

      continue;
    }

    encrypted += mapping[strPrice[i]];
    i += 1;
  }

  // סידור אפסים בסוף לפי הסדר I → Y → Z
  const orderedTrailing = [
    ...trailingEncrypted.filter(c => c === "I"),
    ...trailingEncrypted.filter(c => c === "Y"),
    ...trailingEncrypted.filter(c => c === "Z"),
  ];

  return encrypted + orderedTrailing.join('');
};


export const changeMeasurementsFormat = (measurements) => {
  if (measurements === null || measurements === undefined) return "N/A";

  return measurements.replace(/-/g, " x ");
}

export const sanitizeText = (text) => {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/\uFFFD/g, '')
    .replace(/[\u0080-\u009F]/g, '')
    .replace(/\u00EF\u00BF\u00BD/g, '')
    .replace(/[^\x20-\x7E\u00A0-\u024F\u0590-\u05FF\u0600-\u06FF\n\r\t.,;:!?'"()\-–—…$€£¥%@#&*+=/\\[\]{}|<>°×÷]/g, '')
    .replace(/\s{3,}/g, ' ')
    .trim();
};

/* normalizeJewelryCategory
 *
 * The catalog rows from WooCommerce ship with a generic top-level
 * `category` of "Jewelry" while the actual sub-type lives in
 * `jewelry_type` ("Bracelets", "Bangle Bracelet", "Ring", "RINGS"…).
 * Workshop items use a free-text `category` typed by the user, so we
 * also see "Ring", "rings", "Necklace ", etc. all referring to the same
 * thing.
 *
 * To make the inventory filter usable, every source goes through this
 * function so "Bracelets" / "Bangle Bracelet" / "bracelet" all collapse
 * to a single canonical "Bracelet" bucket.
 *
 * Returns null for empty input so callers can chain with || fallbacks.
 */
const CATEGORY_ALIASES = {
  ring: 'Ring',
  rings: 'Ring',
  bracelet: 'Bracelet',
  bracelets: 'Bracelet',
  bangle: 'Bracelet',
  bangles: 'Bracelet',
  'bangle bracelet': 'Bracelet',
  'bangle bracelets': 'Bracelet',
  'tennis bracelet': 'Bracelet',
  necklace: 'Necklace',
  necklaces: 'Necklace',
  pendant: 'Necklace',
  pendants: 'Necklace',
  earring: 'Earring',
  earrings: 'Earring',
  stud: 'Earring',
  studs: 'Earring',
  watch: 'Watch',
  watches: 'Watch',
  brooch: 'Brooch',
  brooches: 'Brooch',
  cufflink: 'Cufflinks',
  cufflinks: 'Cufflinks',
};

export const normalizeJewelryCategory = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  // Exact-key alias match (handles "Bangle Bracelet" → "Bracelet" etc.)
  if (CATEGORY_ALIASES[lower]) return CATEGORY_ALIASES[lower];
  // Generic word fallback: if the value contains any known word, use it.
  // E.g. "Diamond Bracelet" → Bracelet, "Gold Ring" → Ring.
  for (const [key, canonical] of Object.entries(CATEGORY_ALIASES)) {
    // Use whole-word boundary so "rings" doesn't match "earrings"
    if (new RegExp(`\\b${key}\\b`).test(lower)) return canonical;
  }
  // Nothing matched — Title-case the raw value and return as-is so we
  // don't lose data, but at least it's consistently formatted.
  return trimmed
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};