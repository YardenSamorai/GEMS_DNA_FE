import { renderHook } from "@testing-library/react";

import { useMultiSkuSearch } from "./multiSkuSearch";

const stones = [
  { id: 1, sku: "MTPS-0298" },
  { id: 2, sku: "T9548" },
  { id: 3, sku: "BAG SET-0001" },
  // A pair: either half answers to the same stone.
  { id: 4, sku: "CU-100", pairSku: "CU-101" },
];

const jewelry = [
  { id: "RI-NY-018", sku: "RI-NY-018", kind: "jewelry" },
  { id: "PD-ONE-003", sku: "PD-ONE-003", kind: "jewelry" },
];

const search = (query) =>
  renderHook(() => useMultiSkuSearch(query, stones, jewelry)).result.current;

describe("useMultiSkuSearch", () => {
  it("stays out of the way for a single SKU", () => {
    expect(search("MTPS-0298").active).toBe(false);
    expect(search("").active).toBe(false);
  });

  it("stays out of the way for a title being typed", () => {
    expect(search("gold ring").active).toBe(false);
  });

  it("reads a comma'd phrase as a title search, not as two stock numbers", () => {
    expect(search("gold ring, pendant").active).toBe(false);
  });

  it("answers a list across stones and jewelry at once", () => {
    const { active, items, stoneCount, jewelryCount } = search("MTPS-0298, RI-NY-018, T9548");
    expect(active).toBe(true);
    expect(items.map((i) => i.sku)).toEqual(["MTPS-0298", "RI-NY-018", "T9548"]);
    expect(stoneCount).toBe(2);
    expect(jewelryCount).toBe(1);
  });

  it("keeps the pasted order rather than a catalog order", () => {
    expect(search("T9548\nMTPS-0298").items.map((i) => i.sku)).toEqual(["T9548", "MTPS-0298"]);
  });

  it("reports the SKUs nothing answers to", () => {
    const { items, missing } = search("MTPS-0298, NOSUCHSKU, PD-ONE-003");
    expect(items.map((i) => i.sku)).toEqual(["MTPS-0298", "PD-ONE-003"]);
    expect(missing).toEqual(["nosuchsku"]);
  });

  it("finds a SKU that contains a space", () => {
    expect(search("BAG SET-0001, T9548").items.map((i) => i.sku)).toEqual([
      "BAG SET-0001",
      "T9548",
    ]);
  });

  it("lists a pair once when both halves were pasted", () => {
    const { items, missing } = search("CU-100, CU-101");
    expect(items.map((i) => i.id)).toEqual([4]);
    expect(missing).toEqual([]);
  });

  it("matches a list exactly, so a partial number pulls in nothing", () => {
    // "MTPS" is a prefix of a real SKU — as a typed query it would match, but
    // in a list it names an item that does not exist.
    const { items, missing } = search("MTPS, T9548");
    expect(items.map((i) => i.sku)).toEqual(["T9548"]);
    expect(missing).toEqual(["mtps"]);
  });

  it("takes a plain space as a separator once the pieces are real SKUs", () => {
    expect(search("RI-NY-018 PD-ONE-003").items.map((i) => i.sku)).toEqual([
      "RI-NY-018",
      "PD-ONE-003",
    ]);
  });

  it("separates on a space even when one of the pair is not in stock", () => {
    const { items, missing } = search("RI-NY-018 GONE-999");
    expect(items.map((i) => i.sku)).toEqual(["RI-NY-018"]);
    expect(missing).toEqual(["gone-999"]);
  });

  it("needs a comma when NONE of the pasted SKUs are in stock", () => {
    // Nothing in "GONE-1 GONE-2" is a stock number we know, so a space alone
    // leaves it as one phrase — the same rule that protects a title search.
    expect(search("GONE-1 GONE-2").active).toBe(false);
    expect(search("GONE-1, GONE-2").missing).toEqual(["gone-1", "gone-2"]);
  });

  it("survives an empty catalog while it is still loading", () => {
    const { result } = renderHook(() => useMultiSkuSearch("A, B", [], []));
    expect(result.current.active).toBe(true);
    expect(result.current.items).toEqual([]);
    expect(result.current.missing).toEqual(["a", "b"]);
  });
});
