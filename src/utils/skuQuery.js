/* =============================================================================
 * Parsing a SKU search box that accepts a list
 * =============================================================================
 *
 * Reps paste SKUs from anywhere — a WhatsApp message, an Excel column, a mail
 * — so the box has to cope with commas, newlines, tabs and plain spaces
 * between one SKU and the next.
 *
 * Spaces are the hard part, because a SKU can contain one. 198 of the 5,874
 * stones are named things like "BAG SET-0001", "CU PAIR-0001", "EC SET 0002"
 * or "LOT TIK OLD" — and those are exactly the lots and sets people look up.
 * Splitting on whitespace would turn every one of them into two or three
 * fragments that match nothing, quietly making them unsearchable.
 *
 * So whitespace is not treated as a separator by decree. The whole inventory
 * is already in memory, so the parser asks it: it walks the words left to
 * right and always takes the LONGEST run of them that is a real SKU, falling
 * back to a single word when no run matches. "BAG SET-0001 BAG SET-0002" comes
 * out as two SKUs, "LOT TIK OLD MTPS-0298" as a three-word SKU and a plain
 * one, and a stone nobody owns comes out as the word it was.
 *
 * The same box doubles as a title search on the jewelry tab, where "gold ring"
 * is a phrase and not two SKUs. A chunk is therefore only broken up when at
 * least one piece of it turns out to be a real SKU; otherwise it is left whole
 * and behaves exactly as it always did.
 * ========================================================================== */

/* Characters that cannot occur inside a SKU, so they always separate two of
 * them: comma, semicolon, tab, and both halves of a Windows newline. */
const HARD_SEPARATORS = /[,;\n\r\t]+/;

/* Pasted text drags in spaces that only look like spaces — a non-breaking one
 * from Word, a narrow one from a spreadsheet — and a SKU typed with two spaces
 * should still find the one stored with one. */
const EXOTIC_SPACE = /[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g;

/* Quotes and brackets survive a paste out of CSV or JSON. Dots and hyphens are
 * left alone: 232 SKUs contain a dot and 5,042 contain a hyphen. */
const WRAPPERS = /^["'`([{<]+|["'`)\]}>]+$/g;

const normalizeSpace = (value) =>
  String(value ?? "").replace(EXOTIC_SPACE, " ").replace(/\s+/g, " ").trim();

/** The form both sides of a SKU comparison are reduced to before matching. */
export const canonicalSku = (value) => normalizeSpace(value).toLowerCase();

/**
 * Build the lookup the parser consults. `maxWords` comes from the data rather
 * than a guess, so a five-word SKU would start working the day one appears.
 */
export const buildSkuIndex = (skus) => {
  const known = new Set();
  let maxWords = 1;

  for (const sku of skus || []) {
    const key = canonicalSku(sku);
    if (!key) continue;
    known.add(key);
    const words = key.split(" ").length;
    if (words > maxWords) maxWords = words;
  }

  return { known, maxWords };
};

export const EMPTY_SKU_QUERY = { terms: [], unknown: [] };

/* Longest-run-first walk across one chunk's words. Returns the pieces plus
 * whether any of them is a real SKU, which is what decides if the chunk was a
 * list at all. */
const splitChunk = (words, index) => {
  const pieces = [];
  let anyKnown = false;
  let i = 0;

  while (i < words.length) {
    let taken = 0;

    for (let n = Math.min(index.maxWords, words.length - i); n >= 2; n -= 1) {
      const candidate = words.slice(i, i + n).join(" ");
      if (index.known.has(candidate)) {
        pieces.push(candidate);
        anyKnown = true;
        taken = n;
        break;
      }
    }

    if (!taken) {
      const word = words[i];
      if (index.known.has(word)) anyKnown = true;
      pieces.push(word);
      taken = 1;
    }

    i += taken;
  }

  return { pieces, anyKnown };
};

/**
 * Turn the raw box text into the list of terms to match against.
 *
 * @param raw    what the user typed or pasted
 * @param index  buildSkuIndex() over the SKUs currently in view. Without it
 *               the text is only split on the unambiguous separators, which is
 *               how the box behaved before this existed.
 * @returns {{ terms: string[], unknown: string[] }} canonical terms in the
 *          order they were written, deduplicated, plus the ones no stone in
 *          view answers to.
 */
export const parseSkuQuery = (raw, index) => {
  const text = String(raw ?? "");
  if (!text.trim()) return EMPTY_SKU_QUERY;

  const terms = [];
  const unknown = [];
  const seen = new Set();

  const push = (term, checkKnown) => {
    const key = canonicalSku(term);
    if (!key || seen.has(key)) return;
    seen.add(key);
    terms.push(key);
    if (checkKnown && index && !index.known.has(key)) unknown.push(key);
  };

  for (const chunk of text.split(HARD_SEPARATORS)) {
    const line = normalizeSpace(chunk);
    if (!line) continue;

    if (!index) {
      push(line, false);
      continue;
    }

    // A chunk that is a SKU in its own right is never taken apart. This alone
    // is what keeps "BAG SET-0001" findable.
    const key = canonicalSku(line);
    if (index.known.has(key)) {
      push(key, true);
      continue;
    }

    // The walk below looks SKUs up directly, so it works on the canonical form
    // rather than on whatever casing was typed.
    const words = key
      .split(" ")
      .map((w) => w.replace(WRAPPERS, ""))
      .filter(Boolean);
    if (words.length === 0) continue;

    const { pieces, anyKnown } = splitChunk(words, index);

    // Nothing in it is a SKU, so it was never a list — most likely a jewelry
    // title being searched. Kept whole, exactly as before.
    if (!anyKnown) {
      push(words.join(" "), false);
      continue;
    }

    pieces.forEach((piece) => push(piece, true));
  }

  return { terms, unknown };
};
