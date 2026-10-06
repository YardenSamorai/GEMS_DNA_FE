import { buildMemoModel, formatAmount, ibanIsValid, parseAmount } from "./memoModel";

const base = {
  source: { producer: "test", pageCount: 1 },
  title: "INVOICE",
  documentNumber: { label: "INVOICE", value: "7" },
  issuer: { name: "Example Gems Ltd.", addressLines: ["1 Sample Street"], phone: "+000", fax: null, email: null, website: null, courier: null },
  shipTo: { name: "Test Customer SA", lines: ["2 Example Road"], phone: null, attention: null },
  billTo: { name: "Test Customer SA", lines: ["2 Example Road"], phone: null, attention: null },
  info: [
    { label: "Memo #", value: "12" },
    { label: "Issue Date", value: "30-Sep-2026" },
    { label: "P.O. #", value: null },
    { label: "Salesman", value: "A. Seller" },
  ],
  items: [],
  totals: null,
  terms: [],
  remarks: [],
  fields: [],
  signature: "Customer Signature",
  footer: [],
  fullPageImageOnEveryPage: false,
  unmapped: [],
  conflicts: [],
};

const codes = (model) => model.warnings.map((w) => w.code);

describe("parseAmount / formatAmount", () => {
  it("keeps the source text, currency and decimals", () => {
    expect(parseAmount("$ 88,000.00")).toEqual({ text: "$ 88,000.00", value: 88000, decimals: 2, currency: "$" });
    expect(parseAmount("9.36")).toEqual({ text: "9.36", value: 9.36, decimals: 2, currency: null });
    expect(parseAmount("1,250 USD")).toMatchObject({ value: 1250, currency: "USD", decimals: 0 });
  });

  it("returns null for blanks and keeps unreadable text without a value", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("N/A")).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
    expect(parseAmount("12,34.5")).toMatchObject({ text: "12,34.5", value: null });
    expect(parseAmount("about 3")).toMatchObject({ value: null });
  });

  it("formats with the printed decimals only", () => {
    expect(formatAmount(parseAmount("$ 88,000.00"))).toBe("$88,000.00");
    expect(formatAmount(parseAmount("88000.5"))).toBe("88,000.5");
    expect(formatAmount(parseAmount("1,250 USD"))).toBe("USD 1,250");
    expect(formatAmount(parseAmount("about 3"))).toBe("about 3");
  });
});

describe("ibanIsValid", () => {
  it("validates the ISO 13616 checksum", () => {
    expect(ibanIsValid("GB82 WEST 1234 5698 7654 32")).toBe(true);
    expect(ibanIsValid("GB83 WEST 1234 5698 7654 32")).toBe(false);
    expect(ibanIsValid("not an iban")).toBe(false);
  });
});

describe("buildMemoModel", () => {
  it("names document fields and lists empty source fields as omitted", () => {
    const model = buildMemoModel(base);
    expect(model.document).toMatchObject({ number: "12", issueDate: "30-Sep-2026", poNumber: null, salesman: "A. Seller", draft: false });
    expect(model.partiesIdentical).toBe(true);
    expect(model.omitted).toEqual(expect.arrayContaining(["P.O. #", "Ship to · Attention", "Bill to · Attention", "Courier"]));
  });

  it("warns about a draft, an unnumbered memo and totals without items", () => {
    const model = buildMemoModel({
      ...base,
      info: [{ label: "Memo #", value: "0" }],
      totals: { label: "Total Carat", cells: { carat: "1.00", totalPrice: "$ 10.00" } },
      fullPageImageOnEveryPage: true,
    });
    expect(model.document.draft).toBe(true);
    expect(codes(model)).toEqual(expect.arrayContaining(["NO_ITEMS", "UNNUMBERED", "DRAFT"]));
    expect(buildMemoModel({ ...base, fullPageImageOnEveryPage: true }, { draft: false }).document.draft).toBe(false);
  });

  it("validates items without changing them", () => {
    const model = buildMemoModel({
      ...base,
      items: [
        { sku: "A1", carat: "1.00", pricePerCarat: "$ 100.00", totalPrice: "$ 100.00" },
        { sku: "a1", carat: "2.00", pricePerCarat: "$ 100.00", totalPrice: "$ 250.00" },
        { description: "No number", carat: "abc" },
        { sku: "B2", carat: "1.00", Neto: "0.98" },
      ],
      totals: { label: "Total Carat", cells: { carat: "9.00", totalPrice: "$ 350.00" } },
    });
    expect(codes(model)).toEqual(
      expect.arrayContaining(["DUPLICATE_SKU", "MISSING_SKU", "NOT_NUMERIC", "LINE_TOTAL_MISMATCH", "TOTAL_CARAT_MISMATCH"]),
    );
    expect(model.items[1].totalPrice.text).toBe("$ 250.00");
    expect(model.items[2].carat).toMatchObject({ text: "abc", value: null });
    expect(model.items[3].extra).toEqual([{ label: "Neto", value: "0.98" }]);
  });

  it("maps bank fields, keeps unknown labels and checks the IBAN", () => {
    const model = buildMemoModel({
      ...base,
      fields: [
        { label: "Account Name", lines: ["Example Gems Ltd."] },
        { label: "IBAN", lines: ["GB83 WEST 1234 5698 7654 32"] },
        { label: "Sort Code", lines: ["00-00-00"] },
        { label: "Reamark", lines: [] },
      ],
    });
    expect(model.bank.map((b) => b.label)).toEqual(["Account name", "IBAN"]);
    expect(model.bank[1].lines).toEqual(["GB83 WEST 1234 5698 7654 32"]);
    expect(model.otherFields).toEqual([{ label: "Sort Code", lines: ["00-00-00"] }]);
    expect(model.remark).toBeNull();
    expect(codes(model)).toContain("IBAN_CHECKSUM");
  });

  it("surfaces unmapped text and page conflicts", () => {
    const model = buildMemoModel({ ...base, unmapped: [{ page: 2, text: "Stray", x: 1, y: 1 }], conflicts: [{ page: 2, field: "totals" }] });
    expect(codes(model)).toEqual(expect.arrayContaining(["UNMAPPED_TEXT", "PAGE_CONFLICT"]));
  });
});
