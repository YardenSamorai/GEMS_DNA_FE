import { columnKey, parseBarakMemo, splitLabel, toParagraphs } from "./parseBarakMemo";

// Synthetic layout modelled on the Barak C1Report template; no real data.
const r = (text, x0, y0, size = 9.7, width) => ({
  text,
  x0,
  y0,
  x1: x0 + (width ?? text.length * size * 0.48),
  y1: y0 + size * 1.15,
  size,
});

const header = [
  r("Example Gems Ltd.", 166, 14, 12),
  r("1 Sample Street", 164, 34),
  r("Phone:+000.1", 164, 56),
  r("Mail:office@example.test", 164, 78),
  r("www.example.test", 164, 89),
  r("INVOICE", 223, 132, 18),
  r("INVOICE # : 7", 324, 150, 14.3),
  r("SHIP TO", 103, 172, 12),
  r("BILL TO", 363, 174, 12),
  r("Test Customer SA", 21, 195, 12),
  r("Test Customer SA", 283, 195, 12),
  r("2 Example Road", 21, 210, 11.3),
  r("2 Example Road", 283, 210, 11.3),
  r("Phone: +00 1", 21, 260, 11.3),
  r("Phone: +00 1", 283, 260, 11.3),
  r("Attention :", 23, 285, 11.3),
  r("Attention : Ms Test", 281, 286, 11.3),
];

const page1 = {
  number: 1,
  width: 595,
  height: 842,
  images: [{ x0: 6, y0: 10, x1: 590, y1: 835 }],
  runs: [
    ...header,
    r("Goods are delivered for examination only and remain our property until paid in full by the", 6, 306, 9, 532),
    r("customer.", 6, 316, 9, 40),
    r("“Second statement in a larger size.”", 21, 381, 9.7, 300),
    r("Remarks :", 9, 421, 9),
    r("First remark that wraps onto the", 11, 448, 9.7, 480),
    r("next line.", 11, 459, 9.7, 40),
    r("• Second remark.", 11, 470, 9.7, 90),
    r("Memo #", 40, 554),
    r("Issue Date", 121, 554),
    r("P.O. #", 216, 554),
    r("Salesman", 297, 554),
    r("30-Sep-2026", 117, 569),
    r("12", 54, 569),
    r("A. Seller", 290, 569),
    r("Lot", 17, 588, 12, 18),
    r("No", 18, 602, 12, 15),
    r("Item #", 79, 595, 12, 32),
    r("Description", 199, 595, 12, 59),
    r("Qty", 346, 595, 12, 19),
    r("Carat", 384, 595, 12, 30),
    r("Per Carat", 434, 595, 12, 51),
    r("Total Price", 500, 595, 12, 56),
    r("1", 22, 620, 10, 5),
    r("SKU-A", 80, 620, 10, 30),
    r("Emerald cushion", 160, 620, 10, 80),
    r("1", 352, 620, 10, 5),
    r("1.50", 400, 620, 10, 20),
    r("$ 1,000.00", 440, 620, 10, 45),
    r("$ 1,500.00", 505, 620, 10, 50),
    r("with a continuation line", 160, 632, 10, 110),
    r("Total Carat", 222, 660, 12, 60),
    r("1.50", 404, 661, 12, 21),
    r("$ 1,500.00", 504, 661, 12, 57),
    r("Customer Signature", 11, 700, 12),
    r("Example Gems Ltd.", 6, 730, 12),
    r("123456789", 213, 730, 12),
  ],
};

const page2 = {
  number: 2,
  width: 595,
  height: 842,
  images: [{ x0: 6, y0: 10, x1: 590, y1: 835 }],
  runs: [
    ...header.filter((run) => !/Sample Street|Phone:\+|Mail:|www\./.test(run.text)),
    r("Courier:", 164, 34),
    r("Account Name :", 12, 319, 9),
    r("Example Gems Ltd.", 90, 320, 9),
    r("Banker's Address :", 12, 358, 9),
    r("Branch One", 90, 359, 9),
    r("Test City", 90, 369, 9),
    r("IBAN :", 13, 393, 9),
    r("GB82 WEST 1234 5698 7654 32", 91, 393, 9),
    r("Reamark:", 12, 426, 9),
    r("Customer Signature", 11, 700, 12),
    r("Example Gems Ltd.", 6, 730, 12),
    r("123456789", 213, 730, 12),
  ],
};

const doc = { producer: "ComponentOne C1Report", title: "Main", created: null, pages: [page1, page2] };

describe("parseBarakMemo", () => {
  const record = parseBarakMemo(doc);

  it("reads the title, number and issuer by label", () => {
    expect(record.title).toBe("INVOICE");
    expect(record.documentNumber).toEqual({ label: "INVOICE", value: "7" });
    expect(record.issuer).toMatchObject({
      name: "Example Gems Ltd.",
      addressLines: ["1 Sample Street"],
      phone: "+000.1",
      email: "office@example.test",
      website: "www.example.test",
      courier: null,
    });
  });

  it("splits ship-to and bill-to columns and keeps attention values", () => {
    expect(record.shipTo).toEqual({ name: "Test Customer SA", lines: ["2 Example Road"], phone: "+00 1", fax: null, attention: null });
    expect(record.billTo.attention).toBe("Ms Test");
  });

  it("maps memo information values to their header labels", () => {
    expect(record.info).toEqual([
      { label: "Memo #", value: "12" },
      { label: "Issue Date", value: "30-Sep-2026" },
      { label: "P.O. #", value: null },
      { label: "Salesman", value: "A. Seller" },
    ]);
  });

  it("reads item rows, merges description continuations and the totals row", () => {
    expect(record.columns.map((c) => c.key)).toEqual(["lot", "sku", "description", "qty", "carat", "pricePerCarat", "totalPrice"]);
    expect(record.items).toEqual([
      {
        lot: "1",
        sku: "SKU-A",
        description: "Emerald cushion with a continuation line",
        qty: "1",
        carat: "1.50",
        pricePerCarat: "$ 1,000.00",
        totalPrice: "$ 1,500.00",
      },
    ]);
    expect(record.totals).toEqual({ label: "Total Carat", cells: { carat: "1.50", totalPrice: "$ 1,500.00" } });
  });

  it("separates terms and remarks into paragraphs verbatim", () => {
    expect(record.terms).toEqual([
      "Goods are delivered for examination only and remain our property until paid in full by the customer.",
      "“Second statement in a larger size.”",
    ]);
    expect(record.remarks).toEqual(["First remark that wraps onto the next line.", "• Second remark."]);
  });

  it("reads labelled fields with multi-line values", () => {
    expect(record.fields).toEqual([
      { label: "Account Name", lines: ["Example Gems Ltd."] },
      { label: "Banker's Address", lines: ["Branch One", "Test City"] },
      { label: "IBAN", lines: ["GB82 WEST 1234 5698 7654 32"] },
      { label: "Reamark", lines: [] },
    ]);
  });

  it("accounts for every run and checks repeated pages agree", () => {
    expect(record.signature).toBe("Customer Signature");
    expect(record.footer).toEqual(["Example Gems Ltd.", "123456789"]);
    expect(record.fullPageImageOnEveryPage).toBe(true);
    expect(record.unmapped).toEqual([]);
    expect(record.conflicts).toEqual([]);
  });

  it("reports text it cannot place instead of dropping it", () => {
    const odd = { ...page2, runs: [...page2.runs, r("Stray note", 300, 500)] };
    const out = parseBarakMemo({ ...doc, pages: [page1, odd] });
    expect(out.unmapped).toEqual([{ page: 2, text: "Stray note", x: 300, y: 500 }]);
  });

  it("flags repeated header content that differs between pages", () => {
    const changed = { ...page2, runs: page2.runs.map((run) => (run.text === "INVOICE # : 7" ? { ...run, text: "INVOICE # : 8" } : run)) };
    const out = parseBarakMemo({ ...doc, pages: [page1, changed] });
    expect(out.conflicts).toEqual([{ page: 2, field: "documentNumber" }]);
    expect(out.documentNumber.value).toBe("7");
  });
});

describe("parseBarakMemo · Memo template (MEMO TO, combined item cell)", () => {
  const memoHeader = [
    r("Example Gems Ltd.", 177, 14, 12),
    r("Memo", 235, 132, 18),
    r("Memo # : 100/1", 356, 150, 14.3),
    r("MEMO TO", 373, 172, 12),
    r("SHIP TO", 112, 174, 12),
    r("Test Customer SpA", 31, 196),
    r("Test Customer SpA", 291, 196),
    r("ATT: MR. TEST", 31, 254),
    r("ATT: MR. TEST", 291, 254),
    r("Fax: +00 2", 31, 287),
    r("Fax: +00 2", 291, 287),
  ];
  const tableHeader = (y) => [
    r("Lot", 28, y - 7, 12, 18),
    r("No", 30, y + 7, 12, 14),
    r("Item #", 90, y, 12, 33),
    r("Description", 210, y, 12, 59),
    r("Qty", 357, y, 12, 20),
    r("Carat", 395, y, 12, 30),
    r("Per Carat", 445, y, 12, 51),
    r("Total Price", 511, y, 12, 57),
  ];
  const row = (y, lot, text, carat, ppc, total) => [
    r(lot, 33, y, 12, 7),
    r(text, 73, y, 12, 254),
    r("1", 374, y, 12, 6),
    r(carat, 412, y, 12, 24),
    r(ppc, 453, y, 12, 47),
    r(total, 519, y, 12, 54),
  ];
  const p1 = {
    number: 1,
    width: 595,
    height: 842,
    images: [],
    runs: [
      ...memoHeader,
      r("Goods are delivered for examination only and remain our property until paid in full by the", 17, 306, 8.3, 533),
      r("Remarks :", 20, 421, 9),
      r("Country of Origin Testland", 75, 421),
      r("Memo #", 51, 488),
      r("Issue Date", 132, 488),
      r("100/1", 54, 502),
      r("04-Oct-2026", 129, 502),
      ...tableHeader(525),
      ...row(553, "1", "SKU-1 GRS,EC,10.00-8.00x6.00", "2.00", "1,000.00", "2,000.00"),
      r("Customer Signature", 22, 763, 12),
    ],
  };
  const p2 = {
    number: 2,
    width: 595,
    height: 842,
    images: [],
    runs: [
      ...memoHeader,
      ...tableHeader(313),
      ...row(340, "2", "SKU-2 EC,9.00-7.00x5.00", "1.00", "500.00", "500.00"),
      r("Total Carat on Memo", 207, 363, 12, 112),
      r("2", 369, 364, 12, 12),
      r("3.00", 409, 364, 12, 27),
      r("$ 2,500.00", 509, 364, 12, 63),
      r("IBAN :", 24, 478, 9),
      r("GB82 WEST 1234 5698 7654 32", 103, 479, 9),
      r("Customer Signature", 22, 763, 12),
    ],
  };
  const record = parseBarakMemo({ pages: [p1, p2] });

  it("reads MEMO TO as the recipient with attention and fax", () => {
    expect(record.billToLabel).toBe("MEMO TO");
    expect(record.billTo).toEqual({ name: "Test Customer SpA", lines: [], phone: null, fax: "+00 2", attention: "MR. TEST" });
  });

  it("splits a combined Item # + Description cell on the first word", () => {
    expect(record.items.map((i) => [i.lot, i.sku, i.description, i.carat])).toEqual([
      ["1", "SKU-1", "GRS,EC,10.00-8.00x6.00", "2.00"],
      ["2", "SKU-2", "EC,9.00-7.00x5.00", "1.00"],
    ]);
    expect(record.combinedSkuCells).toBe(2);
  });

  it("stops the table at the totals row and keeps same-line remarks", () => {
    expect(record.totals).toEqual({ label: "Total Carat on Memo", cells: { qty: "2", carat: "3.00", totalPrice: "$ 2,500.00" } });
    expect(record.fields).toEqual([{ label: "IBAN", lines: ["GB82 WEST 1234 5698 7654 32"] }]);
    expect(record.remarks).toEqual(["Country of Origin Testland"]);
    expect(record.unmapped).toEqual([]);
    expect(record.conflicts).toEqual([]);
  });
});

describe("helpers", () => {
  it("splits labels", () => {
    expect(splitLabel("Phone:+972")).toEqual({ label: "Phone", value: "+972" });
    expect(splitLabel("Attention :")).toEqual({ label: "Attention", value: "" });
    expect(splitLabel("No label here")).toBeNull();
  });

  it("maps column labels", () => {
    expect(columnKey("Item #")).toBe("sku");
    expect(columnKey("Per Carat")).toBe("pricePerCarat");
    expect(columnKey("Total Price")).toBe("totalPrice");
    expect(columnKey("Neto")).toBeNull();
  });

  it("keeps a single paragraph together", () => {
    expect(toParagraphs([r("One line", 0, 0)])).toEqual(["One line"]);
  });
});
