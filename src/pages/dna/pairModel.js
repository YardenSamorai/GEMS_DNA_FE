import { decryptPrice } from "../../utils/decrypt";
import { encryptPrice } from "../../utils/helper";
import { readPriceMode, scaleInventoryPrice } from "../../utils/pricing";
import { clean, dnaSubtitle, formatCarat, shapeName, specGroups } from "./dnaModel";

/* Either stone's URL can be the way in, so the two are put in a fixed order
 * by SKU. Without this, Stone 1 and the order of the switcher would swap
 * depending on which half of the pair you happened to open. */
export const orderPair = (x, y) =>
  String(x?.stone_id ?? "").localeCompare(String(y?.stone_id ?? "")) <= 0 ? [x, y] : [y, x];

const num = (v) => (v == null || v === "" || !isFinite(Number(v)) ? null : Number(v));

/* Both stones are priced individually; a pair is quoted as the sum. Each is
 * scaled on its own terms before adding — scaling the sum would be wrong the
 * moment a pair ever mixes categories. Returns raw alongside scaled so the
 * caller can tell whether a Bruto figure is being shown. */
const sumPrices = (stones, field, priceMode) => {
  let raw = 0;
  let scaled = 0;
  let found = false;

  for (const stone of stones) {
    const value = num(decryptPrice(stone?.[field]));
    if (value == null) continue;
    found = true;
    raw += value;
    scaled += scaleInventoryPrice(value, stone, priceMode);
  }

  return found ? { raw, scaled } : null;
};

const priceCode = (totals) => {
  if (!totals) return "N/A";
  const code = encryptPrice(totals.scaled);
  if (code === "N/A") return code;
  return totals.scaled !== totals.raw ? `B${code}` : code;
};

export const pairPriceCodes = (a, b) => {
  const priceMode = readPriceMode();
  const totalCarat = (num(a.carat) || 0) + (num(b.carat) || 0);
  const totals = sumPrices([a, b], "total_price", priceMode);
  // Price per carat is a rate, so the pair's figure is the combined price over
  // the combined weight. Adding the two stones' rates together would inflate
  // it to roughly double.
  const blendedPpc =
    totals && totalCarat
      ? { raw: totals.raw / totalCarat, scaled: totals.scaled / totalCarat }
      : null;
  return { total: priceCode(totals), perCarat: priceCode(blendedPpc) };
};

// The sum of the two recorded weights — only when both are recorded.
export const pairWeight = (a, b) => {
  const x = num(a.carat);
  const y = num(b.carat);
  return x != null && y != null ? formatCarat(x + y) : null;
};

const shared = (a, b, get) => {
  const x = clean(get(a));
  const y = clean(get(b));
  return x && y && x === y ? x : null;
};

export const pairTitle = (a, b) => {
  const shape = shared(a, b, shapeName);
  const weight = pairWeight(a, b);
  const name = shape ? `${shape} Pair` : "Matched Pair";
  return weight ? `${weight} ${name}` : name;
};

export const pairSubtitle = (a, b) => shared(a, b, dnaSubtitle) || shared(a, b, (s) => dnaSubtitle({ ...s, origin: null }));

export const pairFacts = (a, b) => {
  const facts = [
    { label: "Total weight", value: pairWeight(a, b) },
    { label: "Stone 1", value: formatCarat(a.carat) },
    { label: "Stone 2", value: formatCarat(b.carat) },
    { label: "Origin", value: shared(a, b, (s) => s.origin) },
    { label: "Laboratory", value: shared(a, b, (s) => s.lab) },
  ];
  return facts.filter((f) => f.value).slice(0, 4);
};

const SKIP = new Set(["sku", "pair"]);

/* The two spec sheets laid side by side, built from the same rows (and the
   same category gating) as a single stone's page. A row exists when at least
   one stone has the value. */
export const comparisonGroups = (a, b, opts) => {
  const ga = specGroups(a, opts);
  const gb = specGroups(b, opts);
  const order = [...ga, ...gb.filter((g) => !ga.some((x) => x.id === g.id))];

  return order
    .map((group) => {
      const rowsA = ga.find((g) => g.id === group.id)?.rows || [];
      const rowsB = gb.find((g) => g.id === group.id)?.rows || [];
      const keys = [...rowsA.map((r) => r.key), ...rowsB.map((r) => r.key).filter((k) => !rowsA.some((r) => r.key === k))];
      const rows = keys
        .filter((k) => !SKIP.has(k))
        .map((key) => {
          const ra = rowsA.find((r) => r.key === key) || null;
          const rb = rowsB.find((r) => r.key === key) || null;
          return {
            key,
            label: (ra || rb).label,
            a: ra,
            b: rb,
            same: Boolean(ra && rb && ra.value === rb.value && !ra.certificate),
          };
        });
      return { id: group.id, title: group.title, rows };
    })
    .filter((g) => g.rows.length > 0);
};
