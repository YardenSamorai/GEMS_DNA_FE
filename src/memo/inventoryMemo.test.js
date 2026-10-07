/** @jest-environment node */
import { memoDate, memoRecordFromInventory, stoneFromInventory } from "./inventoryMemo";
import { buildMemoModel } from "./memoModel";
import { enrichMemo } from "./enrichMemo";
import { GEMSTAR_MEMO_TEMPLATE } from "./gemstarTemplate";

const STONES = [
  {
    id: 1,
    sku: "TEST-001",
    category: "Emerald",
    shape: "EM",
    weightCt: 3.07,
    pricePerCt: 2500,
    priceTotal: 7675,
    imageUrl: "https://example.test/StoneImages/TEST-001_Main1.jpg",
    certificateUrl: "https://example.test/Certificates/1234567890.pdf",
    certificateNumber: "",
    lab: "GIA",
    origin: "N/A",
    treatment: "Minor",
    measurements: "8.61-8.22-6.21",
  },
  {
    id: 2,
    sku: "TEST-002",
    category: "Fancy",
    shape: "OV",
    weightCt: 1.8,
    pricePerCt: 15500,
    priceTotal: 27900,
    imageUrl: "https://example.test/StoneImages/Eshed_no_image_wh.jpg",
    certificateUrl: "",
    lab: "GIA",
    fancyIntensity: "Vivid",
    fancyColor: "Yellow",
  },
];

const FORM = {
  memoTo: { name: "Example Jewels SA", address: "1 Sample Street\n1000 Testville", attention: "A. Buyer", phone: "+00 000" },
  shipTo: null,
  number: "100/1",
  issueDate: "2026-10-07",
  salesman: "Test Rep",
  remarks: "Line one\nLine two",
  includeBank: true,
};

describe("inventory memo", () => {
  test("formats the issue date like Barak", () => {
    expect(memoDate("2026-10-07")).toBe("07-Oct-2026");
  });

  test("builds a record the memo model accepts without data warnings", () => {
    const record = memoRecordFromInventory(STONES, { 1: 3000, 2: 15500 }, FORM);
    const model = buildMemoModel(record);

    expect(model.document.number).toBe("100/1");
    expect(model.document.issueDate).toBe("07-Oct-2026");
    expect(model.document.salesman).toBe("Test Rep");
    expect(model.billToLabel).toBe("Memo to");
    expect(model.billTo.lines).toEqual(["1 Sample Street", "1000 Testville"]);
    expect(model.partiesIdentical).toBe(true);
    expect(model.items.map((i) => [i.sku, i.carat.text, i.pricePerCarat.text, i.totalPrice.text])).toEqual([
      ["TEST-001", "3.07", "3,000.00", "9,210.00"],
      ["TEST-002", "1.80", "15,500.00", "27,900.00"],
    ]);
    expect(model.totals.carat.text).toBe("4.87");
    expect(model.totals.totalPrice.text).toBe("$ 37,110.00");
    expect(model.terms).toEqual(GEMSTAR_MEMO_TEMPLATE.terms);
    expect(model.remarks).toEqual(["Line one", "Line two"]);
    expect(model.bank.length).toBe(GEMSTAR_MEMO_TEMPLATE.bank.length);
    const codes = model.warnings.map((w) => w.code);
    for (const code of ["LINE_TOTAL_MISMATCH", "TOTAL_CARAT_MISMATCH", "TOTAL_PRICE_MISMATCH", "NOT_NUMERIC", "UNNUMBERED"]) {
      expect(codes).not.toContain(code);
    }
  });

  test("leaves out bank details and keeps a separate ship-to on request", () => {
    const record = memoRecordFromInventory(STONES, { 1: 3000, 2: 15500 }, {
      ...FORM,
      includeBank: false,
      shipTo: { name: "Example Logistics", address: "Dock 4" },
    });
    const model = buildMemoModel(record);
    expect(model.bank).toEqual([]);
    expect(model.partiesIdentical).toBe(false);
    expect(model.shipTo.name).toBe("Example Logistics");
  });

  test("maps inventory rows to catalog stones without inventing data", () => {
    const [emerald, fancy] = STONES.map(stoneFromInventory);
    expect(emerald.certificate_number).toBe("1234567890");
    expect(emerald.measurements1).toBe("8.61-8.22-6.21");
    expect(emerald.origin).toBe("N/A");
    expect(fancy.picture).toBeNull();
    expect(fancy.certificate_number).toBeNull();
  });

  test("enriches from the selection itself and skips Barak's placeholder photo", async () => {
    const record = memoRecordFromInventory(STONES, { 1: 3000, 2: 15500 }, FORM);
    const bySku = new Map(STONES.map((s) => [s.sku, stoneFromInventory(s)]));
    const model = await enrichMemo(buildMemoModel(record), { lookupStone: async (sku) => bySku.get(sku) || null });
    expect(model.items[0].catalog.image).toBe(STONES[0].imageUrl);
    expect(model.items[0].catalog.reportNumber).toBe("1234567890");
    expect(model.items[1].catalog.image).toBeNull();
    expect(model.warnings.filter((w) => w.code === "MISSING_IMAGE").map((w) => w.item)).toEqual([model.items[1].index]);
  });
});
