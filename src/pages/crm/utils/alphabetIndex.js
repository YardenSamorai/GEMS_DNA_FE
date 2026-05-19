// Helpers for the iOS-style A-Z (and א-ת) jump index on CRM list pages.
// Pure functions only — no React in here so they're easy to unit-test
// and so the bundle stays cheap for pages that don't need the index.

const HEBREW_LETTERS = "אבגדהוזחטיכלמנסעפצקרשת".split("");
const ENGLISH_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// Stable display order: English first (most of our customer base writes
// roman names), then Hebrew, then "#" for everything else (numbers,
// emoji, symbols). Items inside a letter group keep locale-aware order.
const LETTER_ORDER = new Map();
[...ENGLISH_LETTERS, ...HEBREW_LETTERS, "#"].forEach((l, i) =>
  LETTER_ORDER.set(l, i)
);

/**
 * Compute the bucket letter for a name. Trims whitespace and skips any
 * leading punctuation/digits so "  'Cartier" still goes under "C".
 * Returns one of the 26 Latin letters, a Hebrew letter (א..ת), or "#".
 */
export function firstLetter(name) {
  if (!name) return "#";
  const trimmed = String(name)
    .trim()
    // Drop leading quotes / parens / common honorific punctuation /
    // digits, so e.g. `"David"`, `(Mr.) David`, `123 Diamond Ltd`
    // bucket on the first *real* letter.
    .replace(/^[\s"'`([{<.,#:;!?@&\d_\-+*/\\|]+/u, "");
  const ch = trimmed[0];
  if (!ch) return "#";
  const code = ch.charCodeAt(0);
  // Hebrew letter block (א=0x05D0 .. ת=0x05EA)
  if (code >= 0x05d0 && code <= 0x05ea) return ch;
  // Latin A-Z / a-z
  if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) {
    return ch.toUpperCase();
  }
  return "#";
}

/**
 * Compare two bucket letters using the canonical display order
 * (English → Hebrew → #). Used both for sorting items and for
 * deciding the order of section headers.
 */
export function compareByLetter(a, b) {
  const ai = LETTER_ORDER.has(a) ? LETTER_ORDER.get(a) : 999;
  const bi = LETTER_ORDER.has(b) ? LETTER_ORDER.get(b) : 999;
  return ai - bi;
}

/**
 * Decide which alphabets to render in the side index, based on which
 * letters the data actually contains. "auto" mode in the design spec:
 *   - English-only data → only A-Z
 *   - Hebrew-only data  → only א-ת
 *   - Mixed             → A-Z + א-ת (English first)
 * Always include "#" if any item starts with a non-letter.
 * Returns { letters, present } where:
 *   - letters: array in render order
 *   - present: Set of letters that actually have at least 1 item
 */
export function buildAlphabet(items, getName) {
  const present = new Set();
  for (const it of items) {
    present.add(firstLetter(getName(it)));
  }
  const hasEnglish = ENGLISH_LETTERS.some((l) => present.has(l));
  const hasHebrew = HEBREW_LETTERS.some((l) => present.has(l));

  const letters = [];
  // Show English letters if there's any English data, or as a default
  // when the list is empty (so the UI doesn't disappear after filtering
  // everything out).
  if (hasEnglish || (!hasHebrew && items.length === 0)) {
    letters.push(...ENGLISH_LETTERS);
  }
  if (hasHebrew) {
    letters.push(...HEBREW_LETTERS);
  }
  if (present.has("#")) letters.push("#");
  return { letters, present };
}

/**
 * Sort items by their first-letter bucket, then by full name inside the
 * bucket, and emit ordered section groups for rendering.
 */
export function groupByLetter(items, getName) {
  const sorted = [...items].sort((a, b) => {
    const al = firstLetter(getName(a));
    const bl = firstLetter(getName(b));
    const cmp = compareByLetter(al, bl);
    if (cmp !== 0) return cmp;
    return (getName(a) || "").localeCompare(getName(b) || "", undefined, {
      sensitivity: "base",
    });
  });
  const groups = [];
  let current = null;
  for (const it of sorted) {
    const l = firstLetter(getName(it));
    if (!current || current.letter !== l) {
      current = { letter: l, items: [] };
      groups.push(current);
    }
    current.items.push(it);
  }
  return { sorted, groups };
}

/**
 * Scroll the window so that the section header for `letter` lands just
 * below the sticky TopBar. We measure the actual TopBar `<header>` at
 * click time rather than hard-coding 48px so iPhone PWAs (which add
 * env(safe-area-inset-top) to the header) end up with the right offset.
 */
export function scrollToLetter(letter) {
  const el = document.querySelector(`[data-letter-section="${letter}"]`);
  if (!el) return;
  // The global TopBar lives at the very top of the document and is the
  // first <header> with sticky positioning. If we can't find it, fall
  // back to a sane default that still clears the bar.
  let topbarHeight = 48;
  const topbar = document.querySelector("header.sticky, header[class*='sticky']");
  if (topbar) {
    topbarHeight = topbar.getBoundingClientRect().height;
  }
  const breathingRoom = 6;
  const rect = el.getBoundingClientRect();
  const targetY = window.scrollY + rect.top - topbarHeight - breathingRoom;
  window.scrollTo({ top: Math.max(0, targetY), behavior: "smooth" });
}
