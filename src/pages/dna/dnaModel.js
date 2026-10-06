import { getMappedCategories } from "../../utils/categoryMap";
import { changeMeasurementsFormat } from "../../utils/helper";
import { getDisplayShape } from "../inventory/helpers/constants";

const BLANKS = new Set(["", "N/A", "NA", "-", "--", "NULL", "UNDEFINED", "NONE GIVEN"]);

// Feeds use "", "N/A" and friends interchangeably for "unknown"; none of them
// should ever render as a label with nothing (or "N/A") next to it.
export const present = (value) => {
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  return text !== "" && !BLANKS.has(text.toUpperCase());
};

export const clean = (value) => (present(value) ? String(value).trim() : null);

const toNumber = (value) => {
  if (!present(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export const formatCarat = (carat) => {
  const n = toNumber(carat);
  return n === null ? null : `${n.toFixed(2)} ct`;
};

const percent = (value) => {
  const n = toNumber(value);
  return n ? `${n}%` : null;
};

// GIA writes these grades as "Fancy Intense", "Fancy Vivid"…; Faint, Very
// Light and Light are written without the prefix.
const FANCY_PREFIXED = new Set(["intense", "vivid", "deep", "dark"]);

export const fancyColorText = (stone) => {
  const color = clean(stone.fancy_color);
  if (!color) return null;
  const color2 = clean(stone.fancy_color_2);
  const overtones = [clean(stone.fancy_overtone), clean(stone.fancy_overtone_2)].filter(Boolean);
  const hue = color2 ? `${color}-${color2}` : color;

  let grade = clean(stone.fancy_intensity);
  if (grade && FANCY_PREFIXED.has(grade.toLowerCase())) grade = `Fancy ${grade}`;
  return [grade, ...overtones, hue].filter(Boolean).join(" ");
};

export const stoneKind = (stone) => {
  const mapped = getMappedCategories(stone?.category);
  if (mapped.includes("Fancy")) return "fancy";
  if (mapped.includes("Diamond")) return "diamond";
  if (mapped.includes("Emerald")) return "emerald";
  return "gemstone";
};

const gemName = (stone) => {
  const mapped = getMappedCategories(stone?.category).filter((c) => c !== "Empty" && c !== "Fancy");
  return mapped.length ? mapped.join(" & ") : null;
};

// "Emerald" is also a gem; as a shape the trade always says "Emerald Cut".
export const shapeName = (stone) => {
  const name = clean(getDisplayShape(clean(stone?.shape) || ""));
  return name === "Emerald" ? "Emerald Cut" : name;
};

export const certificateUrl = (stone, barakURL) =>
  stone.certificate_url
  || (stone.certificate_number ? `${barakURL}/${stone.certificate_number}.pdf` : null);

export const dnaTitle = (stone) => {
  const parts = [formatCarat(stone.carat), shapeName(stone)].filter(Boolean);
  return parts.length ? parts.join(" ") : String(stone.stone_id || "Gemstone");
};

export const dnaSubtitle = (stone) => {
  const kind = stoneKind(stone);
  const origin = clean(stone.origin);
  if (kind === "fancy") {
    const fancy = fancyColorText(stone);
    return fancy ? `${fancy} Diamond` : "Fancy Color Diamond";
  }
  let name = gemName(stone) || "Gemstone";
  // Coloured gems carry their hue in fancy_color ("Blue" sapphire); emeralds
  // and white diamonds don't need it repeated.
  const hue = kind === "gemstone" ? clean(stone.fancy_color) : null;
  if (hue && !name.toLowerCase().includes(hue.toLowerCase())) name = `${hue} ${name}`;
  return origin ? `${name} · ${origin}` : name;
};

const fact = (label, value) => (present(value) ? { label, value: String(value) } : null);

// The three or four things a buyer reads first; the rest lives in the spec sheet.
export const primaryFacts = (stone) => {
  const kind = stoneKind(stone);
  const weight = fact("Weight", formatCarat(stone.carat));
  const lab = fact("Laboratory", clean(stone.lab));
  let facts;
  if (kind === "diamond" || kind === "fancy") {
    facts = [
      weight,
      kind === "diamond" ? fact("Color", clean(stone.color)) : null,
      fact("Clarity", clean(stone.clarity)),
      kind === "fancy" ? fact("Shape", shapeName(stone)) : null,
      lab,
    ];
  } else if (kind === "emerald") {
    facts = [weight, fact("Origin", clean(stone.origin)), fact("Treatment", clean(stone.treatment)), lab];
  } else {
    facts = [weight, fact("Shape", shapeName(stone)), fact("Origin", clean(stone.origin)), lab];
  }
  return facts.filter(Boolean).slice(0, 4);
};

const row = (key, label, value, extra) => (present(value) ? { key, label, value: String(value), ...extra } : null);

/* The complete record, grouped the way a grading report reads. Category
   gating is the same as the page always had: cut grades only for diamonds,
   treatment only for emeralds, location only for staff. */
export const specGroups = (stone, { isSignedIn }) => {
  const kind = stoneKind(stone);
  const isDiamondLike = kind === "diamond" || kind === "fancy";
  const measurements = clean(changeMeasurementsFormat(clean(stone.measurements1)));
  const rap = toNumber(stone.rap_price);

  const groups = [
    {
      id: "identity",
      title: "Identity",
      rows: [
        row("sku", "Stone ID", clean(stone.stone_id)),
        row("type", "Type", gemName(stone)),
        kind === "gemstone" ? row("hue", "Color", clean(stone.fancy_color)) : null,
        row("shape", "Shape", shapeName(stone)),
        row("carat", "Carat weight", formatCarat(stone.carat)),
        row("measurements", "Measurements", measurements && `${measurements} mm`),
        row("ratio", "Ratio", clean(stone.ratio)),
        stone.pair_stone && !stone.pair
          ? row("pair", "Pair stone", clean(stone.pair_stone), { link: `/${clean(stone.pair_stone)}` })
          : null,
      ],
    },
    {
      id: "grading",
      title: kind === "fancy" ? "Color & grading" : "Grading",
      rows: isDiamondLike
        ? [
            row("fancy", "Color", kind === "fancy" ? fancyColorText(stone) : null),
            row("color", "Color", kind === "fancy" ? null : clean(stone.color)),
            row("clarity", "Clarity", clean(stone.clarity)),
            row("cut", "Cut", clean(stone.cut)),
            row("polish", "Polish", clean(stone.polish)),
            row("symmetry", "Symmetry", clean(stone.symmetry)),
            row("fluorescence", "Fluorescence", clean(stone.fluorescence)),
            row("table", "Table", percent(stone.table_percent)),
            row("depth", "Depth", percent(stone.depth_percent)),
            rap ? row("rap", "Rap", `${rap}%`) : null,
          ]
        : [],
    },
    {
      id: "origin",
      title: kind === "emerald" ? "Origin & treatment" : "Origin",
      rows: [
        row("origin", "Origin", clean(stone.origin)),
        kind === "emerald" ? row("treatment", "Treatment", clean(stone.treatment)) : null,
      ],
    },
    {
      id: "lab",
      title: "Laboratory",
      rows: [
        row("lab", "Laboratory", clean(stone.lab)),
        row("report", "Report number", clean(stone.certificate_number), { certificate: true }),
      ],
    },
    {
      id: "staff",
      title: "Inventory",
      rows: isSignedIn ? [row("location", "Location", clean(stone.location))] : [],
    },
  ];

  return groups
    .map((g) => ({ ...g, rows: g.rows.filter(Boolean) }))
    .filter((g) => g.rows.length > 0);
};
