import { sortCatalogItems } from "./catalogOrder";

const stone = (sku, weightCt, priceTotal, extra = {}) => ({
  sku,
  weightCt,
  priceTotal,
  pricePerCt: weightCt && priceTotal ? priceTotal / weightCt : null,
  ...extra,
});

const skus = (list) => list.map((s) => s.sku);

describe("sortCatalogItems", () => {
  const a = stone("A", 1.0, 5000);
  const b = stone("B", 3.0, 9000);
  const c = stone("C", 2.0, 20000);
  const noPrice = stone("D", 5.0, null);

  it("keeps the picked order by default", () => {
    expect(skus(sortCatalogItems([c, a, b], { key: "picked" }))).toEqual(["C", "A", "B"]);
  });

  it("sorts by size and flips direction", () => {
    expect(skus(sortCatalogItems([a, b, c], { key: "weight", dir: "desc" }))).toEqual(["B", "C", "A"]);
    expect(skus(sortCatalogItems([a, b, c], { key: "weight", dir: "asc" }))).toEqual(["A", "C", "B"]);
  });

  it("sorts by total price and price per carat", () => {
    expect(skus(sortCatalogItems([a, b, c], { key: "total", dir: "desc" }))).toEqual(["C", "B", "A"]);
    expect(skus(sortCatalogItems([a, b, c], { key: "ppc", dir: "desc" }))).toEqual(["C", "A", "B"]);
  });

  it("puts items without the value last in both directions", () => {
    expect(skus(sortCatalogItems([noPrice, a, c], { key: "total", dir: "desc" }))).toEqual(["C", "A", "D"]);
    expect(skus(sortCatalogItems([noPrice, a, c], { key: "total", dir: "asc" }))).toEqual(["A", "C", "D"]);
  });

  it("ranks a pair by its combined figures and keeps its halves together", () => {
    const p1 = stone("P1", 1.5, 6000, { pairSku: "P2" });
    const p2 = stone("P2", 1.5, 6000, { pairSku: "P1" });
    expect(skus(sortCatalogItems([a, p1, b, p2], { key: "weight", dir: "desc" }))).toEqual(["P1", "P2", "B", "A"]);
    expect(skus(sortCatalogItems([a, p1, b, p2], { key: "total", dir: "desc" }))).toEqual(["P1", "P2", "B", "A"]);
  });

  it("sorts jewelry by its own price", () => {
    const ring = { kind: "jewelry", sku: "R1", price: 15000 };
    expect(skus(sortCatalogItems([a, ring, c], { key: "total", dir: "desc" }))).toEqual(["C", "R1", "A"]);
  });
});
