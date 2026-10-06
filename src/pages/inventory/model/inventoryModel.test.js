import {
  activeFilterChips,
  applyChipRemoval,
  buildPairGroups,
  buildShapeOptions,
  emptyFilters,
  filterItems,
  itemsForMode,
  normalizeStone,
  parseMeasurements,
  sortItems,
} from "./inventoryModel";
import { buildUrlParams, convertPriceUnits, hasInventoryParams, parseUrlState } from "./inventoryUrl";
import { parseSmartSearch } from "../helpers/constants";
import { buildSkuIndex, parseSkuQuery } from "../../../utils/skuQuery";

const stone = (over) =>
  normalizeStone(
    {
      sku: "T1",
      shape: "CU",
      category: "Emerald",
      weightCt: 2,
      priceTotal: 10000,
      pricePerCt: 5000,
      measurements: "8.10-7.20-4.00",
      lab: "GRS",
      treatment: "Minor",
      location: "New York",
      groupingType: "Single",
      ...over,
    },
    0
  );

const NO_SKU = { terms: [], unknown: [] };
const ctx = (over = {}) => ({
  mode: "gemstones",
  filters: emptyFilters(),
  skuQuery: NO_SKU,
  smartSearch: "",
  parsedSearch: parseSmartSearch(""),
  priceMode: "neto",
  stoneTags: {},
  ...over,
});

describe("normalizeStone", () => {
  it("drops N/A labs and origins and coerces numbers", () => {
    const s = normalizeStone({ sku: "A", lab: "n/a", origin: "N/A", weightCt: "1.5", ratio: "" }, 3);
    expect(s.id).toBe(3);
    expect(s.lab).toBeNull();
    expect(s.origin).toBeNull();
    expect(s.weightCt).toBe(1.5);
    expect(s.ratio).toBeNull();
  });
});

describe("parseMeasurements", () => {
  it("reads length and width", () => {
    expect(parseMeasurements("11.92-7.85-5.60")).toEqual({ length: 11.92, width: 7.85, depth: 5.6 });
    expect(parseMeasurements("")).toEqual({ length: null, width: null, depth: null });
  });
});

describe("itemsForMode", () => {
  it("splits diamonds from gemstones", () => {
    const d = stone({ sku: "D1", category: "Diamond" });
    const e = stone({ sku: "E1" });
    expect(itemsForMode("diamonds", [d, e], []).map((s) => s.sku)).toEqual(["D1"]);
    expect(itemsForMode("gemstones", [d, e], []).map((s) => s.sku)).toEqual(["E1"]);
  });
});

describe("filterItems", () => {
  const a = stone({ sku: "A", weightCt: 1, measurements: "6-5-3", lab: "GIA", location: "Hong Kong" });
  const b = stone({ sku: "B", weightCt: 3, measurements: "10-8-5", lab: "GRS" });
  const items = [a, b];

  it("applies carat ranges", () => {
    const f = { ...emptyFilters(), minCarat: "2" };
    expect(filterItems(items, ctx({ filters: f })).map((s) => s.sku)).toEqual(["B"]);
  });

  it("applies length from measurements", () => {
    const f = { ...emptyFilters(), maxLength: "7" };
    expect(filterItems(items, ctx({ filters: f })).map((s) => s.sku)).toEqual(["A"]);
  });

  it("matches labs case-insensitively", () => {
    const f = { ...emptyFilters(), lab: ["gia"] };
    expect(filterItems(items, ctx({ filters: f })).map((s) => s.sku)).toEqual(["A"]);
  });

  it("matches exact SKUs from a pasted list", () => {
    const skuQuery = parseSkuQuery("b", buildSkuIndex(items.map((s) => s.sku)));
    expect(filterItems(items, ctx({ skuQuery })).map((s) => s.sku)).toEqual(["B"]);
  });

  it("treats 'Empty' grouping as no grouping", () => {
    const c = stone({ sku: "C", groupingType: "" });
    const f = { ...emptyFilters(), groupingType: ["Empty"] };
    expect(filterItems([a, c], ctx({ filters: f })).map((s) => s.sku)).toEqual(["C"]);
  });

  it("filters by client tag", () => {
    const f = { ...emptyFilters(), tag: ["VIP"] };
    const tags = { B: [{ id: 1, name: "VIP" }] };
    expect(filterItems(items, ctx({ filters: f, stoneTags: tags })).map((s) => s.sku)).toEqual(["B"]);
  });

  it("uses smart search terms", () => {
    const parsed = parseSmartSearch("3ct");
    expect(filterItems(items, ctx({ smartSearch: "3ct", parsedSearch: parsed })).map((s) => s.sku)).toEqual(["B"]);
  });
});

describe("sortItems", () => {
  it("puts selected first, then emerald cuts with photos on the default sort", () => {
    const x = stone({ sku: "X", shape: "CU", imageUrl: null });
    const y = stone({ sku: "Y", shape: "EM", imageUrl: null });
    const z = stone({ sku: "Z", shape: "CU", imageUrl: "z.jpg" });
    x.id = "x";
    y.id = "y";
    z.id = "z";
    const out = sortItems([x, y, z], { field: "sku", direction: "asc" }, new Set(["x"]));
    expect(out.map((s) => s.sku)).toEqual(["X", "Y", "Z"]);
  });

  it("sorts numbers by value", () => {
    const light = stone({ sku: "L", weightCt: 1 });
    const heavy = stone({ sku: "H", weightCt: 5 });
    light.id = 1;
    heavy.id = 2;
    expect(sortItems([light, heavy], { field: "weightCt", direction: "desc" }, new Set()).map((s) => s.sku)).toEqual(["H", "L"]);
  });
});

describe("buildPairGroups", () => {
  it("joins partners and keeps a missing partner as null", () => {
    const a = stone({ sku: "P1", pairSku: "P2" });
    const b = stone({ sku: "P2", pairSku: "P1" });
    const c = stone({ sku: "P3", pairSku: "P9" });
    const groups = buildPairGroups([a, b, c], [a, b, c]);
    expect(groups).toHaveLength(2);
    expect(groups[0].stoneB.sku).toBe("P2");
    expect(groups[1].stoneB).toBeNull();
  });
});

describe("buildShapeOptions", () => {
  it("separates main shapes from the rest", () => {
    const opts = buildShapeOptions([stone({ shape: "CU" }), stone({ shape: "TPR" })]);
    expect(opts.main).toContain("Cushion");
    expect(opts.more).toContain("TPR");
  });
});

describe("active filter chips", () => {
  it("creates one chip per value and removes exactly that value", () => {
    const f = { ...emptyFilters(), lab: ["GIA", "GRS"], minCarat: "2", maxCarat: "4" };
    const chips = activeFilterChips(f, { mode: "gemstones", smartSearch: "oval" });
    expect(chips.map((c) => c.label)).toEqual(["“oval”", "GIA", "GRS", "2–4 ct"]);
    const next = applyChipRemoval(f, chips[1].remove);
    expect(next.lab).toEqual(["GRS"]);
    const noRange = applyChipRemoval(f, chips[3].remove);
    expect(noRange.minCarat).toBe("");
    expect(noRange.maxCarat).toBe("");
  });
});

describe("URL state", () => {
  it("round-trips filters, sort and page", () => {
    const filters = {
      ...emptyFilters("T9616"),
      shape: ["Cushion", "Oval"],
      lab: ["GRS"],
      minCarat: "2.5",
      maxPrice: "50000",
      box: "12",
    };
    const params = buildUrlParams({
      mode: "gemstones",
      filters,
      smartSearch: "vivid",
      sort: { field: "priceTotal", direction: "desc" },
      page: 3,
      jewelrySource: "all",
      priceMode: "neto",
    });
    const back = parseUrlState(new URLSearchParams(params.toString()));
    expect(back.mode).toBe("gemstones");
    expect(back.filters).toEqual(filters);
    expect(back.smartSearch).toBe("vivid");
    expect(back.sort).toEqual({ field: "priceTotal", direction: "desc" });
    expect(back.page).toBe(3);
    expect(back.priceUnit).toBe("neto");
  });

  it("omits defaults so a plain view has a short URL", () => {
    const params = buildUrlParams({
      mode: "diamonds",
      filters: emptyFilters(),
      smartSearch: "",
      sort: { field: "sku", direction: "asc" },
      page: 1,
      jewelrySource: "all",
      priceMode: "neto",
    });
    expect(params.toString()).toBe("mode=diamonds");
  });

  it("keeps legacy ?search= links working", () => {
    const state = parseUrlState(new URLSearchParams("search=T9616"));
    expect(state.mode).toBeNull();
    expect(state.filters.sku).toBe("T9616");
    expect(hasInventoryParams(new URLSearchParams("search=T9616"))).toBe(true);
    expect(hasInventoryParams(new URLSearchParams("utm=x"))).toBe(false);
  });

  it("ignores junk values", () => {
    const state = parseUrlState(new URLSearchParams("mode=rubies&ct=abc~3&page=-4&sort=x;y.desc"));
    expect(state.mode).toBeNull();
    expect(state.filters.minCarat).toBe("");
    expect(state.filters.maxCarat).toBe("3");
    expect(state.page).toBe(1);
    expect(state.sort).toEqual({ field: "sku", direction: "asc" });
  });

  it("converts Bruto price thresholds for a Neto viewer", () => {
    const f = { ...emptyFilters(), minPrice: "20000", maxPricePerCt: "9000" };
    const out = convertPriceUnits(f, "bruto", "neto");
    expect(out.minPrice).toBe("10000");
    expect(out.maxPricePerCt).toBe("4500");
  });
});
