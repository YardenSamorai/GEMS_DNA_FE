import { useMemo } from "react";

import { buildSkuIndex, canonicalSku, parseSkuQuery } from "../../utils/skuQuery";

/* =============================================================================
 * Searching the sales catalog for a LIST of SKUs
 * =============================================================================
 *
 * A rep pasting twenty stock numbers out of a customer's mail is asking a
 * different question from a rep typing three characters. The typed prefix is a
 * hunt for one stone and belongs to the category page it was typed on; the
 * pasted list is a fixed set of items the rep already knows exists, and it
 * routinely spans loose stones and finished pieces at once. So the moment the
 * box holds more than one SKU, the page stops behaving like a category filter:
 *
 *   - Matching is exact. A single typed term stays a substring match so
 *     partial typing keeps working, but twenty pasted terms matched loosely
 *     would drag in every stone whose number merely contains another's.
 *   - Every category answers, stones and jewelry alike, because the rep's list
 *     doesn't know about our category pages and splitting the answer across
 *     them would just hide items.
 *   - The other facet filters stand down. Someone who names twenty specific
 *     items wants those twenty, not those twenty minus yesterday's shape
 *     filter, and silently dropping some of them is the worst answer available.
 *   - Results keep the pasted order, so the list can be read straight down
 *     against the one it came from.
 *
 * Parsing itself lives in utils/skuQuery — including the reason a space can't
 * simply be treated as a separator (plenty of real SKUs contain one).
 * ========================================================================== */

/* A stone answers to its own number and to its pair partner's, matching how
 * the single-SKU search has always behaved. */
const keysForStone = (s) => [canonicalSku(s?.sku), canonicalSku(s?.pairSku)].filter(Boolean);

/**
 * Resolve a SKU-list search across the whole sales catalog.
 *
 * @param query    raw text from the search box
 * @param stones   every loose stone in view, any category, already price-adjusted
 * @param jewelry  every jewelry piece in view, already mapped to card shape
 *
 * @returns {{
 *   active: boolean,        // true only for a genuine list (2+ SKUs)
 *   terms: string[],        // canonical SKUs, in the order they were written
 *   items: object[],        // matched stones and pieces, in that same order
 *   missing: string[],      // terms nothing in the catalog answers to
 *   stoneCount: number,
 *   jewelryCount: number,
 * }}
 */
export const useMultiSkuSearch = (query, stones, jewelry) => {
  const skuIndex = useMemo(() => {
    const skus = [];
    for (const s of stones || []) skus.push(s?.sku, s?.pairSku);
    for (const j of jewelry || []) skus.push(j?.sku);
    return buildSkuIndex(skus.filter(Boolean));
  }, [stones, jewelry]);

  const parsed = useMemo(() => parseSkuQuery(query, skuIndex), [query, skuIndex]);

  return useMemo(() => {
    const terms = parsed.terms;

    // The jewelry box doubles as a title search, and a comma in "gold ring,
    // pendant" would otherwise read as a list of two stock numbers that don't
    // exist. A stock number with a space in it is always one we know about —
    // it came out of the index — so an unknown spaced term is prose.
    const isProse = terms.some((t) => t.includes(" ") && !skuIndex.known.has(t));

    if (terms.length < 2 || isProse) {
      return { active: false, terms, items: [], missing: [], stoneCount: 0, jewelryCount: 0 };
    }

    // One pass over the catalog builds the lookup; walking the terms then costs
    // nothing and is what preserves the pasted order.
    const byKey = new Map();
    for (const s of stones || []) {
      for (const key of keysForStone(s)) if (!byKey.has(key)) byKey.set(key, s);
    }
    for (const j of jewelry || []) {
      const key = canonicalSku(j?.sku);
      if (key && !byKey.has(key)) byKey.set(key, j);
    }

    const items = [];
    const missing = [];
    // A stone reached through its pair partner's number would otherwise be
    // listed twice when both halves are in the pasted list.
    const taken = new Set();

    for (const term of terms) {
      const hit = byKey.get(term);
      if (!hit) {
        missing.push(term);
        continue;
      }
      if (taken.has(hit)) continue;
      taken.add(hit);
      items.push(hit);
    }

    const jewelryCount = items.filter((i) => i.kind === "jewelry").length;
    return {
      active: true,
      terms,
      items,
      missing,
      stoneCount: items.length - jewelryCount,
      jewelryCount,
    };
  }, [parsed, skuIndex, stones, jewelry]);
};
