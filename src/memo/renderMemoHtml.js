import QRCode from "qrcode";
import { formatAmount } from "./memoModel";
import { memoCss, PRINT_TOKENS } from "./memoStyles";

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ESCAPES[ch]);

const LOGO_HEIGHT_MM = 13;

function logoHtml(logo) {
  if (!logo?.src) return "";
  const [x, y, w, h] = logo.crop || [0, 0, logo.width, logo.height];
  const scale = LOGO_HEIGHT_MM / h;
  const mm = (n) => `${(n * scale).toFixed(2)}mm`;
  return `<div class="m-logo" style="width:${mm(w)};height:${mm(h)}"><img src="${esc(logo.src)}" alt="${esc(logo.alt || "")}" style="width:${mm(logo.width)};height:${mm(logo.height)};margin:-${mm(y)} 0 0 -${mm(x)}"></div>`;
}

const lines = (values) => values.map(esc).join("<br>");

function kv(rows) {
  const present = rows.filter(([, value]) => value);
  if (!present.length) return "";
  return `<dl class="m-kv">${present.map(([label, value]) => `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>`).join("")}</dl>`;
}

function partyHtml(eyebrow, party) {
  return `<div>
    <p class="m-eyebrow">${esc(eyebrow)}</p>
    ${party.name ? `<p class="m-party-name">${esc(party.name)}</p>` : ""}
    ${party.lines.length ? `<p class="m-lines">${lines(party.lines)}</p>` : ""}
    ${kv([["Phone", party.phone], ["Attention", party.attention]])}
  </div>`;
}

function issuerHtml(issuer, logo) {
  return `<div>
    <p class="m-eyebrow">From</p>
    ${logoHtml(logo)}
    ${issuer.name ? `<p class="m-party-name">${esc(issuer.name)}</p>` : ""}
    ${issuer.addressLines.length ? `<p class="m-lines">${lines(issuer.addressLines)}</p>` : ""}
    ${kv([["Phone", issuer.phone], ["Fax", issuer.fax], ["Email", issuer.email], ["Web", issuer.website]])}
  </div>`;
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

const factsLine = (facts) =>
  facts?.length ? `<p class="m-facts-line">${facts.map((f) => `<span>${esc(f)}</span>`).join(" · ")}</p>` : "";

function itemCell(item, { thumbs }) {
  const c = item.catalog;
  const thumb = !thumbs ? "" : c?.image
    ? `<div class="m-thumb"><img src="${esc(c.image)}" alt=""></div>`
    : `<div class="m-thumb-slot"></div>`;
  const cert = c && (c.lab || c.reportNumber)
    ? `<p class="m-cert">${esc([c.lab, c.reportNumber ? "report" : null].filter(Boolean).join(" "))} ${
        c.reportNumber ? (c.certificateUrl ? `<a href="${esc(c.certificateUrl)}">${esc(c.reportNumber)}</a>` : esc(c.reportNumber)) : ""
      }</p>`
    : "";
  const extra = item.extra.length
    ? `<p class="m-extra">${item.extra.map((e) => `${esc(e.label)} ${esc(e.value)}`).join(" · ")}</p>`
    : "";
  const head = [item.sku ? `<span class="m-sku">${esc(item.sku)}</span>` : "", c?.type ? `<span class="m-type">${esc(c.type)}</span>` : ""]
    .filter(Boolean)
    .join(" ");
  return `<div class="m-item">${thumb}<div class="m-item-text">
    ${head ? `<p class="m-item-head">${head}</p>` : ""}
    ${item.description ? `<p class="m-desc">${esc(item.description)}</p>` : ""}
    ${factsLine(c?.facts)}${factsLine(c?.grading)}
    ${cert}${extra}
  </div></div>`;
}

const amount = (a) => (a ? esc(formatAmount(a)) : "");
const carat = (a) => (a ? `${esc(formatAmount(a))}${a.value !== null ? " ct" : ""}` : "");

function totalsHtml(totals) {
  if (!totals) return "";
  const rows = [
    totals.qty ? `<div><dt>Total quantity</dt><dd>${amount(totals.qty)}</dd></div>` : "",
    totals.carat ? `<div><dt>Total carat</dt><dd>${carat(totals.carat)}</dd></div>` : "",
    totals.totalPrice ? `<div class="m-grand"><dt>Total price</dt><dd>${amount(totals.totalPrice)}</dd></div>` : "",
  ].join("");
  return rows ? `<div class="m-totals"><dl>${rows}</dl></div>` : "";
}

async function itemsHtml(model) {
  const { items, totals } = model;
  if (!items.length) {
    const block = totalsHtml(totals);
    return block ? `<section class="m-section m-summary"><p class="m-eyebrow">Summary</p>${block}</section>` : "";
  }
  const has = (fn) => items.some(fn);
  const cols = {
    lot: has((i) => i.lot),
    thumbs: has((i) => i.catalog?.image),
    qr: has((i) => i.catalog?.dnaUrl),
    qty: has((i) => i.qty),
    perCarat: has((i) => i.pricePerCarat),
  };
  const qrs = await Promise.all(items.map((i) => (i.catalog?.dnaUrl ? qrSvg(i.catalog.dnaUrl) : null)));

  const head = [
    cols.lot ? `<th style="width:11mm">Lot</th>` : "",
    `<th>Item</th>`,
    cols.qr ? `<th style="width:15mm">DNA</th>` : "",
    cols.qty ? `<th class="num" style="width:12mm">Qty</th>` : "",
    `<th class="num" style="width:18mm">Carat</th>`,
    cols.perCarat ? `<th class="num" style="width:24mm">Per carat</th>` : "",
    `<th class="num" style="width:28mm">Total</th>`,
  ].join("");

  const body = items
    .map((item, i) => {
      const qr = qrs[i]
        ? `<a class="m-qr" href="${esc(item.catalog.dnaUrl)}" title="${esc(item.catalog.dnaUrl)}">${qrs[i]}</a>`
        : "";
      return `<tr>
        ${cols.lot ? `<td class="m-lot">${esc(item.lot || "")}</td>` : ""}
        <td>${itemCell(item, cols)}</td>
        ${cols.qr ? `<td>${qr}</td>` : ""}
        ${cols.qty ? `<td class="num">${amount(item.qty)}</td>` : ""}
        <td class="num">${carat(item.carat)}</td>
        ${cols.perCarat ? `<td class="num">${amount(item.pricePerCarat)}</td>` : ""}
        <td class="num">${amount(item.totalPrice)}</td>
      </tr>`;
    })
    .join("");

  const count = `${items.length} ${items.length === 1 ? "item" : "items"}`;
  return `<section class="m-section">
    <div class="m-items-head"><p class="m-eyebrow">Items</p><span class="m-count">${count}</span></div>
    <table class="m-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    ${totalsHtml(totals)}
  </section>`;
}

function proseHtml(model) {
  const blocks = [
    ["Terms", model.terms],
    ["Remarks", [...model.remarks, ...(model.remark ? [model.remark] : [])]],
  ].filter(([, paragraphs]) => paragraphs.length);
  if (!blocks.length) return "";
  return `<section class="m-section m-prose">${blocks
    .map(
      ([title, paragraphs]) =>
        `<div class="m-prose-block"><p class="m-eyebrow">${esc(title)}</p>${paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}</div>`,
    )
    .join("")}</section>`;
}

function closingHtml(model) {
  const fields = [...model.bank, ...model.otherFields];
  const bank = fields.length
    ? `<div><p class="m-eyebrow">Bank details</p><dl class="m-bank">${fields
        .map((f) => `<div><dt>${esc(f.label)}</dt><dd>${lines(f.lines)}</dd></div>`)
        .join("")}</dl></div>`
    : "";
  const signLabel = model.signature && /^customer signature$/i.test(model.signature) ? "Customer signature" : model.signature;
  const sign = signLabel
    ? `<div><p class="m-eyebrow">Acceptance</p><div class="m-sign-space"></div><p class="m-sign-label">${esc(signLabel)}</p></div>`
    : "";
  if (!bank && !sign) return "";
  return `<section class="m-section m-close">${bank || "<div></div>"}${sign}</section>`;
}

/**
 * Memo model -> self-contained, print-ready HTML (A4).
 * @param options.issuerLogo { src, width, height, crop, alt } (issuerBrands.js)
 */
export async function renderMemoHtml(model, { issuerLogo = null } = {}) {
  const d = model.document;
  const customer = model.billTo?.name || model.shipTo?.name || null;
  const memoLabel = d.number ? `Memo ${d.number}` : "Memo";
  const facts = [
    ["Memo no.", d.number],
    ["Issue date", d.issueDate],
    ["Due date", d.dueDate],
    ["Salesman", d.salesman],
    ["P.O. no.", d.poNumber],
    ["Ship via", d.shipVia],
    ["Courier", d.courier],
    ["Terms", d.paymentTerms],
    ...d.extra.map((e) => [e.label, e.value]),
  ].filter(([, value]) => value);

  const parties = [];
  if (model.issuer) parties.push(issuerHtml(model.issuer, issuerLogo));
  if (model.partiesIdentical) parties.push(partyHtml("Bill to · Ship to", model.billTo));
  else {
    if (model.billTo) parties.push(partyHtml("Bill to", model.billTo));
    if (model.shipTo) parties.push(partyHtml("Ship to", model.shipTo));
  }

  const css = memoCss({
    footerStart: model.footer.length ? model.footer.join(" · ") : null,
    footerEnd: [d.draft ? "Draft" : null, memoLabel].filter(Boolean).join(" · "),
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
<header>
  <div class="m-top">
    <span class="m-brand"><span class="m-dot"></span>Gems DNA</span>
    ${d.draft ? `<span class="m-draft">Draft</span>` : ""}
  </div>
  <div class="m-intro">
    <div>
      <h1 class="m-title">Memo</h1>
      ${customer ? `<p class="m-subtitle">${esc(customer)}</p>` : ""}
    </div>
    ${facts.length ? `<dl class="m-facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""}
  </div>
</header>
${parties.length ? `<section class="m-section m-parties" style="grid-template-columns:repeat(${parties.length}, 1fr)">${parties.join("")}</section>` : ""}
${await itemsHtml(model)}
${proseHtml(model)}
${closingHtml(model)}
</body>
</html>`;
}
