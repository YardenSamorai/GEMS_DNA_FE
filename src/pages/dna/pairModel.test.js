import { comparisonGroups, orderPair, pairFacts, pairSubtitle, pairTitle, pairWeight } from "./pairModel";

const a = {
  stone_id: "MG-1", category: "Emerald", shape: "CU", carat: 3.45, lab: "GRS", origin: "Zambia",
  ratio: 1.23, measurements1: "10.79-8.74-5.55", treatment: "Insignificant", certificate_number: "2024-1",
};
const b = {
  stone_id: "MT-2", category: "Emerald", shape: "CU", carat: 3.57, lab: "GRS", origin: "Zambia",
  ratio: 1.23, measurements1: "10.80-8.76-6.16", treatment: "Minor", certificate_number: "",
};

const rowOf = (groups, key) => groups.flatMap((g) => g.rows).find((r) => r.key === key);

test("pair order is stable whichever stone the QR opened", () => {
  expect(orderPair(b, a)[0].stone_id).toBe("MG-1");
  expect(orderPair(a, b)[0].stone_id).toBe("MG-1");
});

test("pair identity is built only from values both stones share", () => {
  expect(pairTitle(a, b)).toBe("7.02 ct Cushion Pair");
  expect(pairSubtitle(a, b)).toBe("Emerald · Zambia");
  expect(pairTitle(a, { ...b, shape: "OV" })).toBe("7.02 ct Matched Pair");
  expect(pairSubtitle(a, { ...b, origin: "Brazil" })).toBe("Emerald");
  expect(pairFacts(a, { ...b, origin: "Brazil" }).map((f) => f.label)).toEqual(["Total weight", "Stone 1", "Stone 2", "Laboratory"]);
});

test("no combined weight is shown when either weight is missing", () => {
  expect(pairWeight(a, { ...b, carat: null })).toBeNull();
  expect(pairTitle(a, { ...b, carat: null })).toBe("Cushion Pair");
  expect(pairFacts(a, { ...b, carat: null }).map((f) => f.label)).not.toContain("Total weight");
});

test("comparison keeps one-sided rows, drops empty ones, marks matches", () => {
  const groups = comparisonGroups(a, b, { isSignedIn: false });
  expect(rowOf(groups, "origin").same).toBe(true);
  expect(rowOf(groups, "treatment").same).toBe(false);
  const report = rowOf(groups, "report");
  expect(report.a.value).toBe("2024-1");
  expect(report.b).toBeNull();
  expect(rowOf(groups, "sku")).toBeUndefined();
  expect(rowOf(groups, "cut")).toBeUndefined();
  groups.forEach((g) => g.rows.forEach((r) => expect(r.a || r.b).toBeTruthy()));
});
