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

  it("renders a summary when the source has totals but no items", async () => {
    const html = await toHtml(buildMemoModel(record));
    expect(html).toContain("Summary");
    expect(html).not.toContain("<table");
    expect(html).toContain("9.36 ct");
    expect(html).toContain("$88,000.00");
  });

  it("never prints labels for empty values", async () => {
    const html = await toHtml(buildMemoModel(record));
    expect(html).not.toMatch(/Attention|P\.O\. no\.|Courier|Remark<|Fax|undefined|null|N\/A/);
    expect(html).toContain("Bill to");
    expect(html).toContain("Ship to");
  });

  it("marks drafts and puts the memo number in the running footer", async () => {
    const html = await toHtml(buildMemoModel(record));
    expect(html).toContain('class="m-draft"');
    expect(html).toContain('"Draft · Memo 12 · " "Page " counter(page) " of " counter(pages)');
    expect(html).toContain('"Example Gems Ltd. · 123"');
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
    expect(html).toContain('href="https://gems-dna.com/SKU-A"');
    expect(html.match(/<svg/g)).toHaveLength(1);
    expect(html).toContain("Cushion");
    expect(html).toContain("7.00 x 6.00 x 4.00 mm");
    expect(html).not.toContain("Per carat");
    expect(html).not.toContain("<th>Lot");
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
