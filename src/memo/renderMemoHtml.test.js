/**
 * @jest-environment node
 */
import fs from "fs";
import path from "path";
import { buildMemoModel } from "./memoModel";
import { enrichMemo } from "./enrichMemo";
import { PRINT_TOKENS } from "./memoStyles";
import { esc, renderMemoHtml as toHtml } from "./renderMemoHtml";

const record = {
  source: { producer: "test", pageCount: 1 },
  title: "INVOICE",
  issuer: { name: "Example Gems Ltd.", addressLines: ["1 Sample Street"], phone: "+000", fax: null, email: null, website: null, courier: null },
  billTo: { name: "Client <b>& Co</b>", lines: ["רחוב הדוגמה 1"], phone: null, attention: null },
  shipTo: { name: "Warehouse", lines: [], phone: null, attention: null },
  info: [
    { label: "Memo #", value: "12" },
    { label: "Issue Date", value: "30-Sep-2026" },
    { label: "P.O. #", value: null },
  ],
  items: [],
  totals: { label: "Total Carat", cells: { carat: "9.36", totalPrice: "$ 88,000.00" } },
  terms: ["Terms paragraph."],
  remarks: [],
  fields: [{ label: "Reamark", lines: [] }],
  signature: "Customer Signature",
  footer: ["Example Gems Ltd.", "123"],
  fullPageImageOnEveryPage: true,
  unmapped: [],
  conflicts: [],
};

const stone = {
  sku: "SKU-A",
  stone_id: "SKU-A",
  category: "Emerald",
  shape: "CU",
  carat: "1.50",
  origin: "Colombia",
  treatment: "Minor",
  measurements1: "7.00-6.00-4.00",
  lab: "GRS",
  certificate_number: "R-1",
  certificate_url: "https://example.test/r-1.pdf",
  picture: "https://example.test/a.jpg",
};

describe("renderMemoHtml", () => {
  it("escapes source text and keeps non-Latin text", async () => {
    const html = await toHtml(buildMemoModel(record));
    expect(html).toContain("Client &lt;b&gt;&amp; Co&lt;/b&gt;");
    expect(html).toContain("רחוב הדוגמה 1");
    expect(html).not.toContain("<b>& Co");
  });

  it("prints an invoice as a marked copy with payment details instead of a signature", async () => {
    const invoice = {
      ...record,
      kind: "invoice",
      fullPageImageOnEveryPage: false,
      info: [
        { label: "Invoice #", value: "5935" },
        { label: "Issue Date", value: "12-Oct-2026" },
        { label: "Due Date", value: "12-Oct-2026" },
        { label: "Customer No.", value: "1870011" },
        { label: "Memo Ref.", value: "8327" },
      ],
      terms: ["Exempt from tax withholding at source."],
    };
    const html = await toHtml(buildMemoModel(invoice));
    expect(html).toContain("<h1>TAX INVOICE</h1><span class=\"m-draft\">Copy</span>");
    expect(html).toContain("Copy of the original issued by Example Gems Ltd.");
    expect(html).toContain('<div class="label">Invoice No.</div>');
    expect(html).toContain('<div class="label">Bill to</div>');
    expect(html).toMatch(/Payment Due<\/div><div class="v num">12-Oct-2026/);
    expect(html).toMatch(/Customer No\.<\/div><div class="v num">1870011/);
    expect(html).toMatch(/Memo Ref\.<\/div><div class="v num">8327/);
    expect(html.match(/12-Oct-2026/g)).toHaveLength(2);
    expect(html).toContain("Total due");
    expect(html).toContain('<div class="label">Notes</div>');
    expect(html).toContain("Due 12 October 2026");
    expect(html).toContain("Please quote invoice No. 5935 with your payment.");
    expect(html).not.toContain("Received by");
    expect(html).not.toContain("MEMORANDUM");
    expect(html).toContain('"Invoice 5935 · Copy · "');
  });

  it("renders a summary when the source has totals but no items", async () => {
    const html = await toHtml(buildMemoModel(record));
    expect(html).toContain("Summary");
    expect(html).not.toContain("<table");
    expect(html).toContain("9.36 ct");
    expect(html).toContain("<small>USD</small>88,000.00");
    expect(html).not.toContain("$");
  });

  it("prints a dash for empty details and no labels for absent party fields", async () => {
    const html = await toHtml(buildMemoModel(record));
    expect(html).not.toMatch(/<span>Attn|<span>Fax|Courier|Remarks<|undefined|null|N\/A/);
    expect(html).toContain('<div class="label">P.O. #</div><div class="v"><span class="empty">—</span></div>');
    expect(html).toContain("Memo to");
    expect(html).toContain("Ship to");
  });

  it("always prints both party boxes, with attention and phone when present", async () => {
    const html = await toHtml(buildMemoModel({ ...record, shipTo: null, billTo: { ...record.billTo, attention: "A. Buyer", phone: "+1 555" } }));
    expect(html.match(/class="party"/g)).toHaveLength(2);
    expect(html.match(/<span>Attn<\/span>A\. Buyer/g)).toHaveLength(2);
    expect(html.match(/<span>Phone<\/span>\+1 555/g)).toHaveLength(2);
  });

  it("prints the long issue date and the currency code", async () => {
    const html = await toHtml(buildMemoModel(record));
    expect(html).toContain('<div class="meta">30 September 2026 · USD</div>');
    const odd = await toHtml(buildMemoModel({ ...record, info: [{ label: "Issue Date", value: "Q3 2026" }] }));
    expect(odd).toContain('<div class="meta">Q3 2026 · USD</div>');
    const eur = await toHtml(buildMemoModel({ ...record, totals: { cells: { totalPrice: "€ 10.00" } } }));
    expect(eur).toContain("<small>EUR</small>10.00");
  });

  it("marks drafts and puts the memo number in the running footer", async () => {
    const html = await toHtml(buildMemoModel(record));
    expect(html).toContain('class="m-draft"');
    expect(html).toContain('"Draft · Memo 12 · " "Page " counter(page) " of " counter(pages)');
    expect(html).toContain('"Example Gems Ltd. · 123"');
    expect(html).not.toContain("Gems DNA");
  });

  it("renders catalog identity, a verified certificate link and a DNA QR", async () => {
    const model = buildMemoModel({
      ...record,
      items: [{ sku: "SKU-A", description: "Emerald", carat: "1.50", totalPrice: "$ 1,500.00" }, { sku: "SKU-B", carat: "2.00" }],
    });
    const enriched = await enrichMemo(model, {
      lookupStone: async (sku) => (sku === "SKU-A" ? stone : null),
      verifyUrl: async () => true,
    });
    const html = await toHtml(enriched);
    expect(html).toContain('href="https://example.test/r-1.pdf"');
    expect(html).toContain('<a class="m-qr" href="https://gems-dna.com/SKU-A"');
    expect(html.match(/<svg/g)).toHaveLength(1);
    expect(html.match(/<td class="qr"><\/td>/g)).toHaveLength(1);
    expect(html).toContain("Cushion");
    expect(html).toContain("7.00 x 6.00 x 4.00 mm");
    expect(html).toContain("<th class=\"r\">Per Carat (USD)</th>");
  });

  it("shows the photo over a 'No photo' fallback, and the fallback alone without one", async () => {
    const model = buildMemoModel({ ...record, items: [{ sku: "SKU-A", carat: "1.50" }, { sku: "SKU-B", carat: "2.00" }] });
    const html = await toHtml(await enrichMemo(model, { lookupStone: async (sku) => (sku === "SKU-A" ? stone : null) }));
    expect(html).toContain('<div class="thumb"><span class="none">No<br>photo</span><img src="https://example.test/a.jpg" alt="" onerror="this.remove()"></div>');
    expect(html).toContain('<div class="thumb"><span class="none">No<br>photo</span></div>');
  });

  it("builds the description from the catalog and keeps hyphenated codes together", async () => {
    const model = buildMemoModel({ ...record, items: [{ sku: "SKU-A", carat: "1.50" }] });
    const html = await toHtml(await enrichMemo(model, { lookupStone: async () => ({ ...stone, shape: "RD-CAB", measurements1: "0.00-0.00-0.00" }) }));
    expect(html).toContain('<div class="desc">Polished Emerald RD\u2011CAB</div>');
    expect(html).not.toContain("0.00 x 0.00");
    expect(html).not.toMatch(/desc-sub">[^<]*Cabushon/);
  });

  it("prints totals from the model and never re-adds the lines", async () => {
    const model = buildMemoModel({
      ...record,
      items: [
        { sku: "A", qty: "1", carat: "1.00", pricePerCarat: "$ 100.00", totalPrice: "$ 100.00" },
        { sku: "B", qty: "1", carat: "2.00", pricePerCarat: "$ 100.00", totalPrice: "$ 200.00" },
      ],
      totals: { cells: { qty: "1", carat: "9.99", totalPrice: "$ 12,345.67" } },
    });
    const html = await toHtml(model);
    expect(html).toContain("1 stone · 9.99 ct");
    expect(html).not.toContain("1 stones");
    expect(html).toContain("<small>USD</small>12,345.67");
    expect(html).not.toContain("300.00");
  });

  it("pluralises the stone count", async () => {
    const html = await toHtml(buildMemoModel({ ...record, items: [{ sku: "A", carat: "1.00" }], totals: { cells: { qty: "59", carat: "71.13" } } }));
    expect(html).toContain("59 stones · 71.13 ct");
  });
});

describe("enrichMemo", () => {
  const model = buildMemoModel({ ...record, items: [{ sku: "SKU-A", carat: "1.49" }] });

  it("does not link certificates without verification", async () => {
    const out = await enrichMemo(model, { lookupStone: async () => stone });
    expect(out.items[0].catalog.certificateUrl).toBeNull();
    expect(out.items[0].catalog.reportNumber).toBe("R-1");
    expect(out.warnings.map((w) => w.code)).toContain("CATALOG_CARAT_DIFFERS");
    expect(out.items[0].carat.text).toBe("1.49");
  });

  it("ignores a catalog record for a different SKU", async () => {
    const out = await enrichMemo(model, { lookupStone: async () => ({ ...stone, sku: "OTHER", stone_id: "OTHER" }) });
    expect(out.items[0].catalog).toBeNull();
    expect(out.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(["CATALOG_MISMATCH", "NOT_IN_CATALOG"]));
  });
});

describe("print tokens", () => {
  it("match the light theme in gemsdna-tokens.css", () => {
    const css = fs.readFileSync(path.join(__dirname, "../styles/gemsdna-tokens.css"), "utf8");
    const light = css.slice(0, css.indexOf("}"));
    const token = (name) => new RegExp(`--dna-${name}:\\s*([^;]+);`).exec(light)[1].trim();
    expect(PRINT_TOKENS.text).toBe(token("text"));
    expect(PRINT_TOKENS.body).toBe(token("text-body"));
    expect(PRINT_TOKENS.text2).toBe(token("text-2"));
    expect(PRINT_TOKENS.faint).toBe(token("faint"));
    expect(PRINT_TOKENS.bg).toBe(token("bg"));
    expect(PRINT_TOKENS.accent).toBe(token("accent"));
    expect(PRINT_TOKENS.accentDot).toBe(token("accent-dot"));
  });

  it("escapes HTML", () => {
    expect(esc(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});
