import {
  BRUTO_MULTIPLIER,
  PRICE_MODES,
  adjustSalesPrices,
  checkPriceConsistency,
  inventoryPriceScale,
  scaleInventoryPrice,
  supportsBrutoMode,
} from "./pricing";

const sapphire = { category: "Sapphire", pricePerCt: 60000, priceTotal: 605400, weightCt: 10.09 };
const emerald = { category: "Emerald O", pricePerCt: 2750, priceTotal: 5500, weightCt: 2 };
const diamond = { category: "Diamond", pricePerCt: 5590, priceTotal: 11180, weightCt: 2 };
const fancy = { category: "Fancy", pricePerCt: 11500, priceTotal: 23000, weightCt: 2 };
const jewelry = { category: "Jewelry", priceTotal: 4000 };

describe("supportsBrutoMode", () => {
  it("allows a Bruto figure for coloured stones", () => {
    expect(supportsBrutoMode(sapphire)).toBe(true);
    expect(supportsBrutoMode(emerald)).toBe(true);
  });

  it("never applies to diamonds, fancies or jewelry", () => {
    expect(supportsBrutoMode(diamond)).toBe(false);
    expect(supportsBrutoMode(fancy)).toBe(false);
    expect(supportsBrutoMode(jewelry)).toBe(false);
  });
});

describe("inventoryPriceScale", () => {
  it("shows the stored price untouched in Neto mode", () => {
    expect(inventoryPriceScale(sapphire, PRICE_MODES.NETO)).toBe(1);
    expect(inventoryPriceScale(diamond, PRICE_MODES.NETO)).toBe(1);
  });

  it("doubles coloured stones in Bruto mode and leaves diamonds alone", () => {
    expect(inventoryPriceScale(sapphire, PRICE_MODES.BRUTO)).toBe(BRUTO_MULTIPLIER);
    expect(inventoryPriceScale(diamond, PRICE_MODES.BRUTO)).toBe(1);
    expect(inventoryPriceScale(jewelry, PRICE_MODES.BRUTO)).toBe(1);
  });

  // Diamonds and jewelry are always quoted Neto, so the Bruto toggle must be a
  // no-op for them no matter how the rest of the app moves the mode around.
  it("gives diamonds and jewelry one single price in every mode", () => {
    for (const stone of [diamond, fancy, jewelry]) {
      const modes = Object.values(PRICE_MODES).map((m) =>
        scaleInventoryPrice(1000, stone, m)
      );
      expect(new Set(modes).size).toBe(1);
      expect(modes[0]).toBe(1000);
    }
  });

  // The bug this module exists to prevent was a second, inverted definition of
  // "Neto" (stored / 2) living in other files. Scaling must never shrink.
  it("never returns a fraction", () => {
    for (const stone of [sapphire, emerald, diamond, fancy, jewelry]) {
      for (const mode of Object.values(PRICE_MODES)) {
        expect(inventoryPriceScale(stone, mode)).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe("scaleInventoryPrice", () => {
  it("scales numbers and passes non-numeric values straight through", () => {
    expect(scaleInventoryPrice(60000, sapphire, PRICE_MODES.NETO)).toBe(60000);
    expect(scaleInventoryPrice(60000, sapphire, PRICE_MODES.BRUTO)).toBe(120000);
    expect(scaleInventoryPrice(null, sapphire, PRICE_MODES.BRUTO)).toBeNull();
    expect(scaleInventoryPrice("", sapphire, PRICE_MODES.BRUTO)).toBe("");
    expect(scaleInventoryPrice("N/A", sapphire, PRICE_MODES.BRUTO)).toBe("N/A");
  });
});

describe("adjustSalesPrices", () => {
  // Regression test for the live incident: ME505 is a 10.09ct sapphire stored
  // at $60,000/ct. The sales floor was halving coloured stones on top of a
  // database that already held the real price, so customers saw $30,000/ct.
  it("shows ME505 at its real stored price", () => {
    const adjusted = adjustSalesPrices(sapphire);
    expect(adjusted.pricePerCt).toBe(60000);
    expect(adjusted.priceTotal).toBe(605400);
  });

  it("treats every category identically", () => {
    for (const stone of [sapphire, emerald, diamond, fancy]) {
      const adjusted = adjustSalesPrices(stone);
      expect(adjusted.pricePerCt).toBe(stone.pricePerCt);
      expect(adjusted.priceTotal).toBe(stone.priceTotal);
    }
  });

  it("agrees with the inventory screen in Neto mode", () => {
    for (const stone of [sapphire, emerald, diamond, fancy]) {
      expect(adjustSalesPrices(stone).priceTotal).toBe(
        scaleInventoryPrice(stone.priceTotal, stone, PRICE_MODES.NETO)
      );
    }
  });
});

describe("checkPriceConsistency", () => {
  it("accepts a stone whose total matches carat x price per carat", () => {
    expect(checkPriceConsistency(sapphire).ok).toBe(true);
  });

  it("rejects a stone whose total was scaled independently", () => {
    const broken = { ...sapphire, priceTotal: sapphire.priceTotal / 2 };
    expect(checkPriceConsistency(broken).ok).toBe(false);
  });

  it("returns null when there is not enough data to judge", () => {
    expect(checkPriceConsistency({ category: "Sapphire" })).toBeNull();
    expect(checkPriceConsistency(jewelry)).toBeNull();
  });
});
