import { getMappedCategories } from "../../../utils/categoryMap";
import { getDisplayColor, getDisplayShape } from "../helpers/constants";
import { formatCarat, formatMoney, isJewelryItem, scaledPrice } from "../model/inventoryModel";

const clean = (v) => {
  const s = String(v ?? "").trim();
  return s && s.toUpperCase() !== "N/A" ? s : "";
};

export const isDiamondLike = (stone) => {
  const mapped = getMappedCategories(stone.category);
  return mapped.includes("Diamond") || mapped.includes("Fancy");
};

const gemName = (stone) => {
  const mapped = getMappedCategories(stone.category).filter((c) => c !== "Empty" && c !== "Diamond" && c !== "Fancy");
  return mapped[0] || "";
};

// "Emerald" is also a gem; as a shape it reads "Emerald Cut", as on the DNA page.
const shapeName = (shape) => {
  const name = clean(getDisplayShape(clean(shape)));
  return name === "Emerald" ? "Emerald Cut" : name;
};

/* "2.33 ct Cushion" for diamonds, "2.33 ct Cushion Emerald" for coloured
 * stones — what the stone is, before any grade. */
export const itemTitle = (item) => {
  if (isJewelryItem(item)) return clean(item.title) || clean(item.jewelryType) || item.sku || "Jewelry";
  const parts = [formatCarat(item.weightCt), shapeName(item.shape)];
  if (!isDiamondLike(item)) parts.push(gemName(item));
  return parts.filter(Boolean).join(" ") || item.sku;
};

/* Grading: colour · clarity · lab for diamonds; clarity (treatment) · origin ·
 * lab for coloured stones; type · metal · stone for jewelry. */
export const gradingLine = (item) => {
  if (isJewelryItem(item)) {
    return [clean(item.jewelryType), clean(item.metalType), clean(item.stoneType)].filter(Boolean).join(" · ");
  }
  if (isDiamondLike(item)) {
    return [clean(getDisplayColor(item)), clean(item.clarity), clean(item.lab)].filter(Boolean).join(" · ");
  }
  return [clean(item.treatment), clean(item.origin), clean(item.lab)].filter(Boolean).join(" · ");
};

export const priceTotalText = (item, priceMode) => {
  const v = scaledPrice(item, "priceTotal", priceMode);
  return v ? formatMoney(v, item.currency) : "";
};

export const pricePerCtText = (item, priceMode) => {
  if (isJewelryItem(item)) return "";
  const v = scaledPrice(item, "pricePerCt", priceMode);
  return v ? `${formatMoney(v)}/ct` : "";
};

export const cleanValue = clean;
