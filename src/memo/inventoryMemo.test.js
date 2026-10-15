/** @jest-environment node */
import { memoDate, memoRecordFromInventory, pairSingle, sharedOrigin, stoneCount, stoneFromInventory } from "./inventoryMemo";
import { buildMemoModel } from "./memoModel";
import { enrichMemo } from "./enrichMemo";
import { GEMSTAR_MEMO_TEMPLATE } from "./gemstarTemplate";
import { CUSTOMER_PROFILES, profileById, profileForCustomer } from "./customerProfiles";

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

  test("counts the stones of a set as the line quantity and sums them", () => {
    const sets = [
      { ...STONES[0], id: 1, stones: 14 },
      { ...STONES[1], id: 2, stones: 45 },
      { ...STONES[1], id: 3, sku: "TEST-003", stones: null },
    ];
    const model = buildMemoModel(memoRecordFromInventory(sets, { 1: 1, 2: 1, 3: 1 }, FORM));
    expect(model.items.map((i) => i.qty.text)).toEqual(["14", "45", "1"]);
    expect(model.totals.qty.text).toBe("60");
    expect(stoneCount({ stones: 0 })).toBe(1);
    expect(stoneCount({})).toBe(1);
  });

  test("carries P.O., ship via, origin and shipment ref into the model", () => {
    const model = buildMemoModel(
      memoRecordFromInventory(STONES, { 1: 1, 2: 1 }, { ...FORM, poNumber: "PO-1", shipVia: "Malca-Amit", origin: "Zambia", shipmentRef: "40393" }),
    );
    expect(model.document).toMatchObject({ poNumber: "PO-1", shipVia: "Malca-Amit", origin: "Zambia", shipmentRef: "40393" });
  });

  test("uses Gemstar's corrected template text, bank order and footer", () => {
    const text = GEMSTAR_MEMO_TEMPLATE.terms.join(" ");
    expect(text).not.toMatch(/Gemsotnes|\s\.|[“”]/);
    expect(GEMSTAR_MEMO_TEMPLATE.bank.map((b) => b.label)).toEqual(["Bank Name", "Branch", "Account Name", "Account No.", "IBAN", "SWIFT"]);
    expect(GEMSTAR_MEMO_TEMPLATE.footer).toEqual(["Gemstar Ltd.", "Company No. 510997646"]);
    const model = buildMemoModel(memoRecordFromInventory(STONES, { 1: 1, 2: 1 }, FORM));
    expect(model.bank.map((b) => b.label)).toEqual(["Bank Name", "Branch", "Account name", "Account No.", "IBAN", "SWIFT"]);
    expect(model.bank.find((b) => b.key === "accountNumber").lines).toEqual(["90801-910025"]);
    expect(model.otherFields).toEqual([]);
    expect(model.warnings.map((w) => w.code)).not.toContain("IBAN_CHECKSUM");
  });

  test("a customer profile replaces the invoice declaration and notes, and adds its terms", () => {
    const form = { ...FORM, kind: "invoice", number: "5904", profile: "cartier" };
    const model = buildMemoModel(memoRecordFromInventory(STONES, { 1: 3000, 2: 15500 }, form));
    expect(model.declarations).toEqual(profileById("cartier").invoice.declarations);
    expect(model.terms).toEqual([]);
    expect(model.document.paymentTerms).toBeNull();

    const withTerms = { ...profileById("cartier"), invoice: { ...profileById("cartier").invoice, paymentTerms: "30 days net" } };
    CUSTOMER_PROFILES.push({ ...withTerms, id: "test-terms" });
    try {
      const termed = buildMemoModel(memoRecordFromInventory(STONES, { 1: 1, 2: 1 }, { ...form, profile: "test-terms" }));
      expect(termed.document.paymentTerms).toBe("30 days net");
    } finally {
      CUSTOMER_PROFILES.pop();
    }
  });

  test("the standard profile and memos keep Gemstar's own wording", () => {
    const invoice = buildMemoModel(memoRecordFromInventory(STONES, { 1: 1, 2: 1 }, { ...FORM, kind: "invoice", number: "1", profile: "standard" }));
    expect(invoice.declarations).toEqual([]);
    expect(invoice.terms).toEqual([GEMSTAR_MEMO_TEMPLATE.terms[1], ...GEMSTAR_MEMO_TEMPLATE.invoiceNotes]);
    const memo = buildMemoModel(memoRecordFromInventory(STONES, { 1: 1, 2: 1 }, { ...FORM, profile: "cartier" }));
    expect(memo.declarations).toEqual([]);
    expect(memo.terms).toEqual(GEMSTAR_MEMO_TEMPLATE.terms);
  });

  test("Cartier's invoice carries P/S from the stone's grouping", () => {
    const grouped = [
      { ...STONES[0], groupingType: "Pair" },
      { ...STONES[1], groupingType: "Single" },
      { ...STONES[1], id: 3, sku: "TEST-003", groupingType: "Parcel" },
      { ...STONES[1], id: 4, sku: "TEST-004", groupingType: "" },
    ];
    const prices = { 1: 1, 2: 1, 3: 1, 4: 1 };
    const cartier = buildMemoModel(memoRecordFromInventory(grouped, prices, { ...FORM, kind: "invoice", number: "1", profile: "cartier" }));
    expect(cartier.extraColumns).toEqual(["pairSingle"]);
    expect(cartier.items.map((i) => i.pairSingle)).toEqual(["P", "S", "Parcel", null]);
    expect(cartier.items.every((i) => i.extra.length === 0)).toBe(true);
    const standard = buildMemoModel(memoRecordFromInventory(grouped, prices, { ...FORM, kind: "invoice", number: "1" }));
    expect(standard.extraColumns).toEqual([]);
    expect(pairSingle({ groupingType: "pair" })).toBe("P");
  });

  test("picks the profile from the customer's name", () => {
    expect(profileForCustomer("Cartier Joaillerie International").id).toBe("cartier");
    expect(profileForCustomer("Example Jewels SA").id).toBe("standard");
    expect(profileForCustomer("").id).toBe("standard");
  });

  test("builds an invoice: SAP's number, payment fields, no consignment terms or signature", () => {
    const form = { ...FORM, kind: "invoice", number: "5935", dueDate: "2026-10-12", customerNo: "1870011", memoRef: "8327" };
    const model = buildMemoModel(memoRecordFromInventory(STONES, { 1: 3000, 2: 15500 }, form));
    expect(model.kind).toBe("invoice");
    expect(model.billToLabel).toBe("Bill to");
    expect(model.document).toMatchObject({ number: "5935", dueDate: "12-Oct-2026", customerNo: "1870011", memoRef: "8327" });
    expect(model.document.extra).toEqual([]);
    expect(model.terms).toEqual([GEMSTAR_MEMO_TEMPLATE.terms[1], ...GEMSTAR_MEMO_TEMPLATE.invoiceNotes]);
    expect(model.signature).toBeNull();
    expect(model.warnings.filter((w) => w.code !== "MISSING_SKU")).toEqual([]);
  });

  test("a memo carries no invoice fields", () => {
    const model = buildMemoModel(memoRecordFromInventory(STONES, { 1: 3000, 2: 15500 }, { ...FORM, dueDate: "2026-10-12", customerNo: "1" }));
    expect(model.kind).toBe("memo");
    expect(model.document).toMatchObject({ dueDate: null, customerNo: null, memoRef: null });
    expect(model.terms).toEqual(GEMSTAR_MEMO_TEMPLATE.terms);
  });

  test("prefills the origin only when every stone shares one", () => {
    expect(sharedOrigin([{ origin: "Zambia" }, { origin: "Zambia" }])).toBe("Zambia");
    expect(sharedOrigin([{ origin: "Zambia" }, { origin: "Colombia" }])).toBe("");
    expect(sharedOrigin([{ origin: "N/A" }, { origin: "" }])).toBe("");
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
