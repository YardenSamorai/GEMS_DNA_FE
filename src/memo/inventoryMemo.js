/**
 * Inventory selection -> raw memo record (the same shape parseBarakMemo
 * produces), so memos created in Gems DNA go through the same model,
 * validation and renderer as memos imported from Barak.
 */
import { clean } from "../pages/dna/dnaModel";
import { GEMSTAR_MEMO_TEMPLATE } from "./gemstarTemplate";
import { DECLARATION } from "./memoModel";
import { profileById } from "./customerProfiles";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-07" -> "07-Oct-2026" (Barak's date style). */
export function memoDate(isoDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || "");
  if (!m) return clean(isoDate);
  return `${m[3]}-${MONTHS[Number(m[2]) - 1]}-${m[1]}`;
}

const fixed = (n, decimals = 2) =>
  Number(n).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const round2 = (n) => Math.round(n * 100) / 100;

const NO_IMAGE = /no_image/i;

/** Inventory row (camelCase feed) -> catalog stone (the DNA page's shape). */
export function stoneFromInventory(item) {
  const certificateUrl = clean(item.certificateUrl);
  // Same rule as the DNA endpoint: the report number is the certificate's file name.
  const reportFromUrl = certificateUrl ? (/\/([^/]+)\.pdf$/i.exec(certificateUrl) || [])[1] || null : null;
  const picture = clean(item.imageUrl);
  return {
    sku: item.sku,
    stone_id: item.sku,
    category: item.category,
    shape: item.shape,
    carat: item.weightCt,
    color: item.color,
    clarity: item.clarity,
    lab: item.lab,
    origin: item.origin,
    treatment: item.treatment,
    measurements1: item.measurements,
    cut: item.cut,
    polish: item.polish,
    symmetry: item.symmetry,
    fluorescence: item.fluorescence,
    fancy_intensity: item.fancyIntensity,
    fancy_color: item.fancyColor,
    fancy_overtone: item.fancyOvertone,
    fancy_color_2: item.fancyColor2,
    fancy_overtone_2: item.fancyOvertone2,
    picture: picture && !NO_IMAGE.test(picture) ? picture : null,
    certificate_number: clean(item.certificateNumber) || reportFromUrl,
    certificate_url: certificateUrl,
  };
}

const splitLines = (text) =>
  String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

function party(p) {
  if (!p || !clean(p.name)) return null;
  return {
    name: clean(p.name),
    lines: splitLines(p.address),
    phone: clean(p.phone),
    fax: null,
    attention: clean(p.attention),
  };
}

/** Stones in one line: a set counts its stones, a single stone is 1. */
export const stoneCount = (stone) => {
  const n = Number(stone?.stones);
  return Number.isInteger(n) && n > 0 ? n : 1;
};

/** The catalog origin every selected stone shares, or "" when they differ or none is known. */
export function sharedOrigin(stones) {
  const origins = new Set(stones.map((s) => clean(s.origin)));
  if (origins.size !== 1) return "";
  return [...origins][0] || "";
}

/** The P/S cell: "P" for a pair, "S" for a single, other groupings (Set, Parcel…) as named. */
export function pairSingle(stone) {
  const grouping = clean(stone?.groupingType);
  if (!grouping) return null;
  if (/^pair$/i.test(grouping)) return "P";
  if (/^single$/i.test(grouping)) return "S";
  return grouping;
}

/**
 * @param stones   inventory rows, in memo order
 * @param prices   { [stone.id]: pricePerCarat } as quoted on this memo
 * @param form     { kind? ("memo" | "invoice"), memoTo, shipTo?, number, issueDate (yyyy-mm-dd),
 *                   salesman, poNumber?, shipVia?, origin?, shipmentRef?, remarks, includeBank,
 *                   profile? (customerProfiles.js id),
 *                   invoice only: dueDate? (yyyy-mm-dd), customerNo?, memoRef? }
 *                 An invoice is a copy of the tax invoice issued in SAP: `number` is SAP's.
 */
export function memoRecordFromInventory(stones, prices, form) {
  const t = GEMSTAR_MEMO_TEMPLATE;
  const invoice = form.kind === "invoice";
  const custom = invoice ? profileById(form.profile).invoice || {} : {};
  const title = invoice ? "Invoice" : "Memo";
  const items = stones.map((stone, i) => {
    const carat = round2(Number(stone.weightCt) || 0);
    const ppc = Number(prices[stone.id]);
    const total = Number.isFinite(ppc) ? round2(ppc * carat) : null;
    return {
      lot: String(i + 1),
      sku: stone.sku,
      qty: String(stoneCount(stone)),
      carat: carat ? fixed(carat) : null,
      pricePerCarat: Number.isFinite(ppc) ? fixed(ppc) : null,
      totalPrice: total !== null ? fixed(total) : null,
      ...(custom.pairSingle ? { pairSingle: pairSingle(stone) } : {}),
    };
  });
  const caratSum = stones.reduce((sum, s) => sum + round2(Number(s.weightCt) || 0), 0);
  const priceSum = items.reduce((sum, it) => sum + (it.totalPrice ? Number(it.totalPrice.replace(/,/g, "")) : 0), 0);
  const memoTo = party(form.memoTo);
  const shipTo = form.shipTo ? party(form.shipTo) : memoTo;

  return {
    kind: invoice ? "invoice" : "memo",
    source: { producer: "Gems DNA", title, created: new Date().toISOString(), pageCount: null },
    title,
    documentNumber: clean(form.number) ? { label: title, value: clean(form.number) } : null,
    issuer: { ...t.issuer },
    billTo: memoTo,
    billToLabel: invoice ? "BILL TO" : "MEMO TO",
    shipTo,
    combinedSkuCells: 0,
    info: [
      { label: `${title} #`, value: clean(form.number) },
      { label: "Issue Date", value: memoDate(form.issueDate) },
      ...(invoice
        ? [
            { label: "Due Date", value: memoDate(form.dueDate) },
            { label: "Customer No.", value: clean(form.customerNo) },
            { label: "Memo Ref.", value: clean(form.memoRef) },
            { label: "Terms", value: clean(custom.paymentTerms) },
          ]
        : []),
      { label: "Salesman", value: clean(form.salesman) },
      { label: "P.O. #", value: clean(form.poNumber) },
      { label: "Ship Via", value: clean(form.shipVia) },
      { label: "Country of Origin", value: clean(form.origin) },
      { label: "Shipment Ref.", value: clean(form.shipmentRef) },
    ],
    columns: [],
    extraColumns: custom.pairSingle ? ["pairSingle"] : [],
    items,
    totals: items.length
      ? {
          label: invoice ? "Total" : "Total Carat on Memo",
          cells: { qty: String(stones.reduce((sum, s) => sum + stoneCount(s), 0)), carat: fixed(round2(caratSum)), totalPrice: `$ ${fixed(round2(priceSum))}` },
        }
      : null,
    // An invoice drops the consignment terms; the declaration still applies to a sale.
    terms: invoice ? [...(custom.declarations ? [] : t.terms.filter((p) => DECLARATION.test(p))), ...(custom.notes ?? t.invoiceNotes)] : [...t.terms],
    declarations: custom.declarations ? [...custom.declarations] : [],
    remarks: splitLines(form.remarks),
    fields: form.includeBank === false ? [] : t.bank.map((f) => ({ ...f, lines: [...f.lines] })),
    signature: invoice ? null : t.signature,
    footer: [...t.footer],
    fullPageImageOnEveryPage: false,
    unmapped: [],
    conflicts: [],
  };
}
