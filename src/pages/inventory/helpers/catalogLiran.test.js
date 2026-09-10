/*
 * The catalog is drawn straight onto a jsPDF document, so the only way to see
 * what it actually prints is to record the writes. jsPDF is replaced with a
 * recorder that no-ops everything except text(), which it collects.
 *
 * Fonts, logos, product photos and the dead-link check all go over the
 * network; none of that exists here, and every one of those calls is already
 * wrapped in a fallback, so they fail quietly and the drawing carries on.
 *
 * The recorder is a plain function rather than a jest.fn on purpose: this app
 * runs jest with resetMocks, which would wipe a mock implementation before
 * every test and hand the code an empty document.
 */

var mockDrawn = [];
var mockSaved = { name: null };

jest.mock("jspdf", () => {
  const doc = {
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    text: (str) => {
      mockDrawn.push(...(Array.isArray(str) ? str : [String(str)]));
    },
    textWithLink: (str) => mockDrawn.push(String(str)),
    splitTextToSize: (str) => [String(str)],
    getTextWidth: () => 10,
    save: (name) => {
      mockSaved.name = name;
    },
    addPage: () => {},
    addImage: () => {},
    getImageProperties: () => ({ width: 100, height: 100 }),
    addFileToVFS: () => {},
    addFont: () => {},
    setFont: () => {},
    setFontSize: () => {},
    setTextColor: () => {},
    setDrawColor: () => {},
    setFillColor: () => {},
    setLineWidth: () => {},
    line: () => {},
    rect: () => {},
  };
  return function jsPDF() {
    return doc;
  };
});

const { exportCatalogLiran } = require("./catalogLiran");

// jsdom never loads an <img>, so without this the cover-image lookup would
// hang forever instead of failing and falling back to a plain dark cover.
// fetch is stubbed too, so the font load and the dead-link check give up here
// rather than reaching out to the real API.
beforeAll(() => {
  global.Image = class {
    set src(_value) {
      setTimeout(() => this.onerror && this.onerror(new Error("no network in tests")), 0);
    }
  };
  global.fetch = () => Promise.reject(new Error("no network in tests"));
  // Those failures are the point of the stubs above, so their warnings are
  // just noise here. Assigned rather than spied on: this app runs jest with
  // resetMocks, which would restore console.warn before each test.
  console.warn = () => {};
});

const items = [
  { id: 1, sku: "RI-NY-018", category: "Jewelry", jewelryType: "Ring", priceTotal: 420000, imageUrl: null },
  { id: 2, sku: "PD-ONE-003", category: "Jewelry", jewelryType: "Pendant", priceTotal: 15000, imageUrl: null },
  // A piece nobody has priced yet — the catalog must still lay out around it.
  { id: 3, sku: "NO-PRICE-1", category: "Jewelry", jewelryType: "Ring", priceTotal: 0, imageUrl: null },
];

const run = async (options) => {
  mockDrawn.length = 0;
  mockSaved.name = null;
  await exportCatalogLiran(items, options);
  return { text: [...mockDrawn], filename: mockSaved.name };
};

describe("exportCatalogLiran prices", () => {
  it("prints no price at all by default", async () => {
    const { text } = await run({});
    expect(text.some((t) => t.includes("$"))).toBe(false);
  });

  it("prints each item's asking price when asked", async () => {
    const { text } = await run({ showPrices: true });
    expect(text).toContain("$420,000");
    expect(text).toContain("$15,000");
  });

  it("leaves the line blank rather than printing $0", async () => {
    const { text } = await run({ showPrices: true });
    expect(text).not.toContain("$0");
  });

  it("still prints every SKU either way", async () => {
    for (const options of [{}, { showPrices: true }]) {
      const { text } = await run(options);
      expect(text).toEqual(expect.arrayContaining(["RI-NY-018", "PD-ONE-003", "NO-PRICE-1"]));
    }
  });

  it("names the priced file differently so the two can't be confused", async () => {
    expect((await run({})).filename).toMatch(/^ESHED_Jewelry_Catalog_\d{4}-\d{2}-\d{2}_3pcs\.pdf$/);
    expect((await run({ showPrices: true })).filename).toMatch(
      /^ESHED_Jewelry_Catalog_Priced_\d{4}-\d{2}-\d{2}_3pcs\.pdf$/
    );
  });
});
