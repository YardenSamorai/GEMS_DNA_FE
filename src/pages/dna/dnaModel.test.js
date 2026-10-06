import { dnaSubtitle, dnaTitle, fancyColorText, primaryFacts, specGroups, stoneKind } from "./dnaModel";

const fancy = {
  stone_id: "X1", category: "Fancy", shape: "CU", carat: 2.33, clarity: "VS1", color: "", lab: "GIA",
  origin: "", ratio: 1.32, measurements1: "8.58-6.49-4.48", treatment: "", cut: "", polish: "VG",
  symmetry: "G", table_percent: 65, depth_percent: 69.1, fluorescence: "None", rap_price: 0,
  fancy_intensity: "Intense", fancy_color: "Yellow", fancy_overtone: "", certificate_number: "123",
};

const sapphire = {
  stone_id: "X2", category: "Sapphire O", shape: "CAB", carat: 74.66, origin: "Burma Myanmar",
  treatment: "No Heat", fancy_color: "Blue", lab: "GRS", clarity: "", color: "",
};

const emerald = {
  stone_id: "X3", category: "Emerald", shape: "EM", carat: 6.44, origin: "Zambia", treatment: "Minor",
  lab: "AGL", cut: "Excellent", location: "Safe 2",
};

const keys = (groups) => groups.flatMap((g) => g.rows.map((r) => r.key));

test("fancy diamonds read like a grading report", () => {
  expect(stoneKind(fancy)).toBe("fancy");
  expect(fancyColorText(fancy)).toBe("Fancy Intense Yellow");
  expect(dnaTitle(fancy)).toBe("2.33 ct Cushion");
  expect(dnaSubtitle(fancy)).toBe("Fancy Intense Yellow Diamond");
});

test("a coloured gem with fancy_color is not mistaken for a diamond", () => {
  expect(stoneKind(sapphire)).toBe("gemstone");
  expect(dnaSubtitle(sapphire)).toBe("Blue Sapphire · Burma Myanmar");
  expect(keys(specGroups(sapphire, { isSignedIn: false }))).not.toContain("clarity");
});

test("emerald cut is named as a cut, treatment stays emerald-only", () => {
  expect(dnaTitle(emerald)).toBe("6.44 ct Emerald Cut");
  expect(primaryFacts(emerald).map((f) => f.label)).toEqual(["Weight", "Origin", "Treatment", "Laboratory"]);
  const rows = keys(specGroups(emerald, { isSignedIn: false }));
  expect(rows).toContain("treatment");
  expect(rows).not.toContain("cut");
  expect(keys(specGroups(sapphire, { isSignedIn: false }))).not.toContain("treatment");
});

test("blank values never produce rows, Rap 0 is hidden, location is staff-only", () => {
  const rows = keys(specGroups(fancy, { isSignedIn: false }));
  expect(rows).not.toContain("origin");
  expect(rows).not.toContain("cut");
  expect(rows).not.toContain("rap");
  expect(keys(specGroups(emerald, { isSignedIn: false }))).not.toContain("location");
  expect(keys(specGroups(emerald, { isSignedIn: true }))).toContain("location");
  specGroups({ stone_id: "X4", category: "", carat: "N/A" }, { isSignedIn: true }).forEach((g) =>
    g.rows.forEach((r) => expect(r.value).toMatch(/\S/))
  );
});

test("a near-empty record still gets a sensible identity", () => {
  const bare = { stone_id: "X5" };
  expect(dnaTitle(bare)).toBe("X5");
  expect(dnaSubtitle(bare)).toBe("Gemstone");
  expect(primaryFacts(bare)).toEqual([]);
});
