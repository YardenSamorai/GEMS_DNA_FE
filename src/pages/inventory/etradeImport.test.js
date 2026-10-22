import { planImport, skusFromEtradeCsv } from "./etradeImport";

const HEADER =
  "Category,SKU,Shape,Weight,Color,Clarity,Lab,Fluorescence,Price Per Carat,Rap Price % ,Rap. Price,Total Price,Comment";

test("reads SKUs from Barak's eTrade file, quoted comments and CRLF included", () => {
  const csv = [
    HEADER,
    'Fancy,P7961,BRIO,9.90,,VS2,GIA,Faint,7500,0.00,,74250.00,"""Additional clouds, not shown."""',
    'Emerald,E100,OV,1.20,,,GRS,,100,,,120,"line one\r\nline two"',
    "Emerald,E100,OV,1.20,,,GRS,,100,,,120,",
    "",
  ].join("\r\n");
  expect(skusFromEtradeCsv("\uFEFF" + csv)).toEqual(["P7961", "E100"]);
});

test("rejects a file without a SKU column", () => {
  expect(() => skusFromEtradeCsv("Name,Price\r\nRing,10\r\n")).toThrow(/SKU column/);
});

test("splits the file against the current list", () => {
  expect(planImport(["A", "B", "C"], ["B", "D"])).toEqual({
    toAdd: ["A", "C"],
    already: ["B"],
    notInFile: ["D"],
  });
});
