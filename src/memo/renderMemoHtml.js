import QRCode from "qrcode";
import { DECLARATION, formatAmount } from "./memoModel";
import { memoCss, PRINT_TOKENS } from "./memoStyles";

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ESCAPES[ch]);

/**
 * Escaped text that won't break inside a hyphenated code such as "RD-CAB",
 * but may break after a comma ("GRS,EC,FVG,…" is one word otherwise).
 */
const nobreak = (value) =>
  esc(value)
    .replace(/(\w)-(?=\w)/g, "$1\u2011")
    .replace(/,(?=\S)/g, ",\u200B");

const names = (text, term) =>
  Boolean(term) && new RegExp(`(^|[^\\w-])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\w-])`, "i").test(text);

const LOGO_HEIGHT_MM = 17;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "05-Oct-2026" / "2026-10-05" -> "05 October 2026"; anything else as printed. */
export function longDate(text) {
  if (!text) return null;
  let m = /^(\d{1,2})[-\s/]([A-Za-z]{3})[A-Za-z]*\.?[-\s/](\d{4})$/.exec(text.trim());
  if (m) {
    const month = MONTHS.findIndex((name) => name.slice(0, 3).toLowerCase() === m[2].toLowerCase());
    if (month >= 0) return `${m[1].padStart(2, "0")} ${MONTHS[month]} ${m[3]}`;
  }
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
  return text;
}

const CURRENCY_CODES = { $: "USD", US$: "USD", USD: "USD", "€": "EUR", EUR: "EUR", "£": "GBP", GBP: "GBP", "₪": "ILS", ILS: "ILS" };

/** The memo's currency as a code for labels; amounts print without a symbol. */
export function currencyCode(model) {
  const symbol = [model.totals?.totalPrice, ...model.items.flatMap((i) => [i.totalPrice, i.pricePerCarat])].find((a) => a?.currency)?.currency;
  if (!symbol) return "USD";
  return CURRENCY_CODES[symbol.toUpperCase()] || CURRENCY_CODES[symbol] || symbol.toUpperCase();
}

const plain = (a) => (a ? esc(formatAmount(a, { withCurrency: false })) : "");
const field = (value) => (value ? esc(value) : '<span class="empty">—</span>');

function logoHtml(logo) {
  if (!logo?.src) return "";
  const [x, y, w, h] = logo.crop || [0, 0, logo.width, logo.height];
  const scale = LOGO_HEIGHT_MM / h;
  const mm = (n) => `${(n * scale).toFixed(2)}mm`;
  return `<div class="m-logo" style="width:${mm(w)};height:${mm(h)}"><img src="${esc(logo.src)}" alt="${esc(logo.alt || "")}" style="width:${mm(logo.width)};height:${mm(logo.height)};margin:-${mm(y)} 0 0 -${mm(x)}"></div>`;
}

function letterheadHtml(issuer, logo) {
  if (!issuer && !logo) return "";
  // The logo artwork already carries the wordmark; without one, set the name in its place.
  const wordmark = !logo && issuer?.name ? `<div class="wordmark">${esc(issuer.name.replace(/[\s,]+(ltd|inc|llc|s\.?a)\.?$/i, "").toUpperCase())}</div>` : "";
  const sub = issuer
    ? `<div class="brand-sub">${[issuer.name ? `<strong>${esc(issuer.name)}</strong>` : "", ...issuer.addressLines.map(esc)].filter(Boolean).join("<br>")}</div>`
    : "";
  const contact = issuer
    ? [issuer.phone && `Tel ${esc(issuer.phone)}`, issuer.fax && `Fax ${esc(issuer.fax)}`, issuer.email && esc(issuer.email), issuer.website && esc(issuer.website)].filter(Boolean)
    : [];
  return `<header class="letterhead">
  <div class="brand">${logoHtml(logo)}<div>${wordmark}${sub}</div></div>
  ${contact.length ? `<div class="contact">${contact.join("<br>")}</div>` : ""}
</header>`;
}

function partyHtml(label, party) {
  const p = party || { name: null, lines: [] };
  const extra = [
    p.attention && `<p><span>Attn</span>${esc(p.attention)}</p>`,
    p.phone && `<p><span>Phone</span>${esc(p.phone)}</p>`,
    p.fax && `<p><span>Fax</span>${esc(p.fax)}</p>`,
  ].filter(Boolean);
  return `<section class="party">
    <div class="label">${esc(label)}</div>
    ${p.name ? `<p class="name">${esc(p.name)}</p>` : ""}
    ${p.lines.map((line) => `<p>${esc(line)}</p>`).join("")}
    ${extra.length ? `<div class="extra">${extra.join("")}</div>` : ""}
  </section>`;
}

function detailsHtml(d, invoice) {
  const fixed = invoice
    ? [
        ["Issue Date", d.issueDate, true],
        ["Payment Due", d.dueDate, true],
        ["Customer No.", d.customerNo, true],
        ["Memo Ref.", d.memoRef, true],
        ["P.O. #", d.poNumber],
        ["Origin", d.origin],
      ]
    : [
        ["Issue Date", d.issueDate, true],
        ["P.O. #", d.poNumber],
        ["Salesman", d.salesman],
        ["Ship Via", d.shipVia],
        ["Origin", d.origin],
        ["Shipment Ref.", d.shipmentRef],
      ];
  const shown = new Set(fixed.map(([label]) => label));
  // Anything else the source printed follows the fixed six instead of being dropped.
  const more = [
    ["Salesman", d.salesman],
    ["Ship Via", d.shipVia],
    ["Shipment Ref.", d.shipmentRef],
    ["Due Date", d.dueDate, true],
    ["Customer No.", d.customerNo, true],
    ["Memo Ref.", d.memoRef, true],
    ["Terms", d.paymentTerms],
    ["Courier", d.courier],
    ...d.extra.map((e) => [e.label, e.value]),
  ].filter(([label, value]) => value && !shown.has(label) && !(invoice && (label === "Due Date" || label === "Terms")));
  const cells = [...fixed, ...more];
  return `<div class="details">${cells
    .map(([label, value, numeric]) => `<div><div class="label">${esc(label)}</div><div class="v${numeric ? " num" : ""}">${field(value)}</div></div>`)
    .join("")}</div>`;
}

async function qrSvg(url) {
  const svg = await QRCode.toString(url, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: PRINT_TOKENS.text, light: "#0000" },
  });
  return svg.replace(/<\?xml[^>]*>/, "");
}

/** Thumbnail with "No photo" underneath: a missing or broken image leaves the text showing. */
function thumbHtml(src) {
  const img = src ? `<img src="${esc(src)}" alt="" onerror="this.remove()">` : "";
  return `<div class="thumb"><span class="none">No<br>photo</span>${img}</div>`;
}

function descriptionHtml(item) {
  const c = item.catalog;
  const description = item.description || c?.description || null;
  // No shape line under a description that already names the shape (e.g. "… RD-CAB").
  const shapeNamed = description && c && (names(description, c.shapeCode) || names(description, c.shape));
  const facts = [...(c?.facts || []).filter((f) => !(shapeNamed && f === c.shape)), ...(c?.grading || [])];
  const cert =
    c && (c.lab || c.reportNumber)
      ? [c.lab, c.reportNumber ? (c.certificateUrl ? `<a href="${esc(c.certificateUrl)}">${esc(c.reportNumber)}</a>` : esc(c.reportNumber)) : null]
          .filter(Boolean)
          .join(" ")
      : null;
  const sub = [...facts.map(esc), cert, ...item.extra.map((e) => `${esc(e.label)} ${esc(e.value)}`)].filter(Boolean);
  return `${description ? `<div class="desc">${nobreak(description)}</div>` : ""}${sub.length ? `<div class="desc-sub">${sub.join(" · ")}</div>` : ""}`;
}

const stonesLabel = (qty) => {
  if (!qty) return null;
  const word = qty.value === 1 ? "stone" : "stones";
  return `${esc(formatAmount(qty, { withCurrency: false }))} ${word}`;
};

/** Totals exactly as the model carries them (the source's own figures), never re-added here. */
function totalsHtml(totals, currency, invoice) {
  if (!totals) return "";
  const count = [stonesLabel(totals.qty), totals.carat ? `${plain(totals.carat)} ct` : null].filter(Boolean).join(" · ");
  return `<div class="totals">
    <div><span class="what">${invoice ? "Total due" : "Total on memo"}</span>${count ? `&nbsp;&nbsp;<span class="count num">${count}</span>` : ""}</div>
    ${totals.totalPrice ? `<div class="amount num"><small>${esc(currency)}</small>${plain(totals.totalPrice)}</div>` : ""}
  </div>`;
}

const COLUMNS = [
  ["Photo", "17mm", "photo"],
  ["Lot", "9mm", "c"],
  ["Item #", "23mm", ""],
  ["Description", null, ""],
  ["DNA", "17mm", "c"],
  ["Qty", "11mm", "r"],
  ["Carat", "16mm", "r"],
  ["Per Carat ({cur})", "21mm", "r"],
  ["Total ({cur})", "27mm", "r"],
];

async function itemsHtml(model, currency) {
  const { items, totals } = model;
  const invoice = model.kind === "invoice";
  if (!items.length) {
    const block = totalsHtml(totals, currency, invoice);
    return block ? `<section class="m-summary"><div class="label">Summary</div>${block}</section>` : "";
  }
  const qrs = await Promise.all(items.map((i) => (i.catalog?.dnaUrl ? qrSvg(i.catalog.dnaUrl) : null)));
  const cols = COLUMNS.map(([, width]) => `<col${width ? ` style="width:${width}"` : ""}>`).join("");
  const head = COLUMNS.map(([title, , cls]) => `<th${cls ? ` class="${cls}"` : ""}>${esc(title.replace("{cur}", currency))}</th>`).join("");
  const body = items
    .map((item, i) => {
      const qr = qrs[i] ? `<a class="m-qr" href="${esc(item.catalog.dnaUrl)}" title="${esc(item.catalog.dnaUrl)}">${qrs[i]}</a>` : "";
      return `<tr class="m-row">
        <td class="photo">${thumbHtml(item.catalog?.image)}</td>
        <td class="lot c num">${esc(item.lot || item.index)}</td>
        <td class="sku">${esc(item.sku || "")}</td>
        <td>${descriptionHtml(item)}</td>
        <td class="qr">${qr}</td>
        <td class="r num">${plain(item.qty)}</td>
        <td class="r num">${plain(item.carat)}</td>
        <td class="r num">${plain(item.pricePerCarat)}</td>
        <td class="r num">${plain(item.totalPrice)}</td>
      </tr>`;
    })
    .join("");
  const block = totalsHtml(totals, currency, invoice);
  // Totals ride in the table's last row so they can't split or start a page alone.
  const totalsRow = block ? `<tr class="m-totals-row"><td colspan="${COLUMNS.length}">${block}</td></tr>` : "";
  return `<table class="m-table"><colgroup>${cols}</colgroup><thead><tr>${head}</tr></thead><tbody>${body}${totalsRow}</tbody></table>`;
}

function legalHtml(model) {
  const terms = model.terms.filter((p) => !DECLARATION.test(p));
  const declaration = [...model.terms.filter((p) => DECLARATION.test(p)), ...(model.declarations || [])];
  const remarks = [...model.remarks, ...(model.remark ? [model.remark] : [])];
  const blocks = [
    [model.kind === "invoice" ? "Notes" : "Terms of delivery", terms, ""],
    ["Gemstone declaration", declaration, ""],
    ["Remarks", remarks, "remarks"],
  ].filter(([, paragraphs]) => paragraphs.length);
  if (!blocks.length) return "";
  return `<div class="legal">${blocks
    .map(
      ([title, paragraphs, cls]) =>
        `<section${cls ? ` class="${cls}"` : ""}><div class="label">${esc(title)}</div>${paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}</section>`,
    )
    .join("")}</div>`;
}

const BANK_ORDER = ["bankName", "branch", "bankAddress", "accountName", "accountNumber", "iban", "swift"];

/** Accreditation marks (e.g. RJC), sized by height so each keeps its proportions. */
function marksHtml(marks) {
  if (!marks?.length) return "";
  return `<div class="m-marks">${marks.map((m) => `<img src="${esc(m.src)}" alt="${esc(m.alt || "")}">`).join("")}</div>`;
}

function bottomHtml(model, marks) {
  const bank = [...model.bank].sort((a, b) => BANK_ORDER.indexOf(a.key) - BANK_ORDER.indexOf(b.key));
  const rows = [...bank, ...model.otherFields];
  const bankBox = rows.length
    ? `<section class="bank"><div class="label">Bank details</div><dl>${rows
        .map((f) => `<dt>${esc(f.label)}</dt><dd>${f.lines.map(esc).join("<br>")}</dd>`)
        .join("")}</dl></section>`
    : "";
  const d = model.document;
  const side =
    model.kind === "invoice"
      ? `<section class="pay">
    <div class="label">Payment</div>
    <div>
      ${d.dueDate ? `<p class="due">Due ${esc(longDate(d.dueDate))}</p>` : ""}
      ${d.paymentTerms ? `<p class="terms"><span>Terms of payment</span>${esc(d.paymentTerms)}</p>` : ""}
      ${d.number ? `<p>Please quote invoice No. ${esc(d.number)} with your payment.</p>` : ""}
    </div>
    ${model.issuer?.name ? `<div class="sign-lines sign-lines--one"><div>For ${esc(model.issuer.name)}</div></div>` : ""}
  </section>`
      : `<section class="sign">
    <div class="label">Received by</div>
    <div class="sign-lines"><div>Customer signature / name</div><div>Date</div></div>
  </section>`;
  return `<div class="bottom">
  <div class="bottom-start">${bankBox}${marksHtml(marks)}</div>
  ${side}
</div>`;
}

/**
 * Memo model -> self-contained, print-ready HTML (A4).
 * @param options.issuerLogo { src, width, height, crop, alt } (issuerBrands.js)
 * @param options.marks      [{ src, alt }] accreditation marks printed by the bank details
 */
export async function renderMemoHtml(model, { issuerLogo = null, marks = [] } = {}) {
  const d = model.document;
  const invoice = model.kind === "invoice";
  const noun = invoice ? "Invoice" : "Memo";
  const customer = model.billTo?.name || model.shipTo?.name || null;
  const memoLabel = d.number ? `${noun} ${d.number}` : noun;
  const currency = currencyCode(model);
  const memoTo = model.billTo || model.shipTo;
  const shipTo = model.shipTo || model.billTo;
  const meta = [longDate(d.issueDate), currency].filter(Boolean).map(esc).join(" · ");
  // The legal original is the tax invoice issued in SAP; this document says it is a copy of it.
  const title = invoice
    ? `<div class="title"><h1>TAX INVOICE</h1><span class="m-draft">Copy</span>${d.draft ? `<span class="m-draft">Draft</span>` : ""}</div>
    <div class="subtitle">Copy of the original${model.issuer?.name ? ` issued by ${esc(model.issuer.name)}` : ""}</div>`
    : `<div class="title"><h1>MEMORANDUM</h1>${d.draft ? `<span class="m-draft">Draft</span>` : ""}</div>
    <div class="subtitle">For examination and inspection only</div>`;

  const css = memoCss({
    footerStart: model.footer.length ? model.footer.join(" · ") : null,
    footerEnd: [d.draft ? "Draft" : null, memoLabel, invoice ? "Copy" : null].filter(Boolean).join(" · "),
    headerEnd: [memoLabel, customer].filter(Boolean).join(" · "),
  });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc([memoLabel, customer].filter(Boolean).join(" · "))}</title>
<style>${css}</style>
</head>
<body>
${letterheadHtml(model.issuer, issuerLogo)}
<div class="title-row">
  <div>
    ${title}
  </div>
  <div class="memo-no">
    <div class="label">${noun} No.</div>
    <div class="value num">${field(d.number)}</div>
    <div class="meta">${meta}</div>
  </div>
</div>
<div class="parties">${partyHtml(invoice ? "Bill to" : "Memo to", memoTo)}${partyHtml("Ship to", shipTo)}</div>
${detailsHtml(d, invoice)}
${await itemsHtml(model, currency)}
${legalHtml(model)}
${bottomHtml(model, marks)}
</body>
</html>`;
}
