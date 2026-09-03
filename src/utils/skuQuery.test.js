import { buildSkuIndex, canonicalSku, parseSkuQuery } from "./skuQuery";

/* SKUs shaped like the real ones, including the spaced lots that make a plain
 * whitespace split wrong. */
const index = buildSkuIndex([
  "MTPS-0298",
  "MTPS-0299",
  "T9548",
  "MT94-.0108",
  "BAG SET-0001",
  "BAG SET-0002",
  "CU PAIR-0001",
  "EC SET 0002",
  "LOT TIK OLD",
  "LOT PS",
]);

const termsOf = (raw) => parseSkuQuery(raw, index).terms;

describe("parseSkuQuery", () => {
  it("splits on spaces when the pieces are real SKUs", () => {
    expect(termsOf("MTPS-0298 MTPS-0299")).toEqual(["mtps-0298", "mtps-0299"]);
  });

  it("keeps a SKU that contains a space in one piece", () => {
    expect(termsOf("BAG SET-0001")).toEqual(["bag set-0001"]);
    expect(termsOf("EC SET 0002")).toEqual(["ec set 0002"]);
    expect(termsOf("LOT TIK OLD")).toEqual(["lot tik old"]);
  });

  it("separates two spaced SKUs written back to back", () => {
    expect(termsOf("BAG SET-0001 BAG SET-0002")).toEqual([
      "bag set-0001",
      "bag set-0002",
    ]);
  });

  it("mixes spaced and plain SKUs in one line", () => {
    expect(termsOf("LOT TIK OLD MTPS-0298 CU PAIR-0001")).toEqual([
      "lot tik old",
      "mtps-0298",
      "cu pair-0001",
    ]);
  });

  it("prefers the longer SKU when a shorter one is a prefix of it", () => {
    // "LOT PS" exists too, so the walk must not stop early on "LOT TIK OLD".
    expect(termsOf("LOT PS LOT TIK OLD")).toEqual(["lot ps", "lot tik old"]);
  });

  it("still honours commas, newlines, tabs and semicolons", () => {
    expect(termsOf("MTPS-0298, MTPS-0299")).toEqual(["mtps-0298", "mtps-0299"]);
    expect(termsOf("MTPS-0298\r\nT9548")).toEqual(["mtps-0298", "t9548"]);
    expect(termsOf("MTPS-0298\tT9548")).toEqual(["mtps-0298", "t9548"]);
    expect(termsOf("MTPS-0298; T9548")).toEqual(["mtps-0298", "t9548"]);
  });

  it("keeps a free-text phrase whole when none of it is a SKU", () => {
    // The jewelry tab searches titles through this same box.
    expect(termsOf("gold ring")).toEqual(["gold ring"]);
  });

  it("keeps the valid SKUs when the pasted list has a bad one", () => {
    expect(termsOf("MTPS-0298 NOSUCHSKU T9548")).toEqual([
      "mtps-0298",
      "nosuchsku",
      "t9548",
    ]);
    expect(parseSkuQuery("MTPS-0298 NOSUCHSKU", index).unknown).toEqual([
      "nosuchsku",
    ]);
  });

  it("survives a messy paste", () => {
    const pasted = '  "MTPS-0298" ,\n\t(T9548)\u00A0MT94-.0108  ';
    expect(termsOf(pasted)).toEqual(["mtps-0298", "t9548", "mt94-.0108"]);
  });

  it("does not strip the dots and hyphens SKUs are built from", () => {
    expect(termsOf("MT94-.0108")).toEqual(["mt94-.0108"]);
  });

  it("counts a SKU pasted twice once", () => {
    expect(termsOf("MTPS-0298, mtps-0298, MTPS-0298")).toEqual(["mtps-0298"]);
  });

  it("returns nothing for blank input", () => {
    expect(termsOf("")).toEqual([]);
    expect(termsOf("   \n\t ")).toEqual([]);
  });

  it("falls back to separator-only splitting before the inventory loads", () => {
    // No index yet: a space must not be allowed to break a SKU apart.
    expect(parseSkuQuery("BAG SET-0001", null).terms).toEqual(["bag set-0001"]);
    expect(parseSkuQuery("MTPS-0298, T9548", null).terms).toEqual([
      "mtps-0298",
      "t9548",
    ]);
  });
});

describe("buildSkuIndex", () => {
  it("learns the longest SKU length from the data", () => {
    expect(index.maxWords).toBe(3);
    expect(buildSkuIndex(["T9548"]).maxWords).toBe(1);
  });

  it("ignores blank and missing SKUs", () => {
    expect(buildSkuIndex([null, "", "  ", "T9548"]).known.size).toBe(1);
  });
});

describe("canonicalSku", () => {
  it("matches the same SKU written with odd spacing or case", () => {
    expect(canonicalSku("  Bag   SET-0001 ")).toBe("bag set-0001");
    expect(canonicalSku("EC\u00A0SET\u00A00002")).toBe("ec set 0002");
  });
});
