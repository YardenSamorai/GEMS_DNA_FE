/**
 * Print stylesheet for the memo (Gemstar's memo design). Colours are the
 * light-theme `--dna-*` tokens (src/styles/gemsdna-tokens.css; kept in sync
 * by memoStyles.test.js). Print differs from screen in two places: hairlines
 * use the visible `faint` grey (the 7% black screen hairline vanishes on
 * paper), and secondary text never goes lighter than text-2 so it survives
 * toner and grayscale.
 */

export const PRINT_TOKENS = {
  text: "#1d1d1f",
  body: "#424245",
  text2: "#6e6e73",
  faint: "#d2d2d7",
  bg: "#f5f5f7",
  accent: "#047857",
  accentDot: "#10b981",
  font: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", "Segoe UI", Arial, sans-serif',
};

const SERIF = '"Times New Roman", Georgia, serif';

/** A CSS string literal for `content:`. */
export const cssString = (value) =>
  `"${String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/</g, "\\3c ")
    .replace(/>/g, "\\3e ")
    .replace(/[\r\n]+/g, " ")}"`;

/**
 * @param running.footerStart   bottom-left text (issuer line), optional
 * @param running.footerEnd     bottom-right prefix, e.g. "Memo 0"
 * @param running.headerEnd     top-right on pages 2+, e.g. "Memo 0 · Customer"
 */
export function memoCss({ footerStart, footerEnd, headerEnd }) {
  const t = PRINT_TOKENS;
  const box = `font-family: ${t.font}; font-size: 7.5pt; color: ${t.text2};`;
  const label = `font-size: 6.75pt; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: ${t.text2};`;
  return `
@page {
  size: A4 portrait;
  margin: 14mm 14mm 16mm;
  ${footerStart ? `@bottom-left { content: ${cssString(footerStart)}; ${box} }` : ""}
  @bottom-right { content: ${cssString(footerEnd ? `${footerEnd} · ` : "")} "Page " counter(page) " of " counter(pages); ${box} font-variant-numeric: tabular-nums; }
  ${headerEnd ? `@top-right { content: ${cssString(headerEnd)}; ${box} }` : ""}
}
@page :first {
  @top-right { content: none; }
}

* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  margin: 0;
  font: 9pt/1.4 ${t.font};
  color: ${t.text};
  -webkit-font-smoothing: antialiased;
}
a { color: inherit; text-decoration: none; }
p { margin: 0; }
dl, dd { margin: 0; }
.num { font-variant-numeric: tabular-nums; white-space: nowrap; }
.r { text-align: right; }
.c { text-align: center; }
.label { ${label} margin: 0 0 1.2mm; }
.empty { color: ${t.text2}; font-weight: 400; }

@media screen {
  html { background: ${t.bg}; }
  body { width: 210mm; min-height: 297mm; margin: 24px auto; padding: 14mm 14mm 16mm; background: #fff; }
}

/* Letterhead */
.letterhead {
  display: flex; justify-content: space-between; align-items: center; gap: 8mm;
  padding-bottom: 4mm; border-bottom: 1px solid ${t.faint};
}
.brand { display: flex; gap: 4mm; align-items: center; min-width: 0; }
.m-logo { display: block; flex: none; overflow: hidden; }
.m-logo img { display: block; max-width: none; }
.wordmark { font: 700 18pt/1 ${SERIF}; letter-spacing: 0.04em; margin: 0 0 1.2mm; }
.brand-sub { color: ${t.body}; font-size: 8pt; line-height: 1.4; overflow-wrap: anywhere; }
.brand-sub strong { color: ${t.text}; font-weight: 600; }
.contact { flex: none; text-align: right; color: ${t.body}; font-size: 8pt; line-height: 1.45; }

/* Title */
.title-row { display: flex; justify-content: space-between; align-items: flex-end; gap: 8mm; margin: 5mm 0 4.5mm; }
.title { display: flex; align-items: center; gap: 3mm; margin: 0 0 1.8mm; }
h1 { font: 700 22pt/1 ${SERIF}; letter-spacing: 0.01em; margin: 0; }
.m-draft {
  font-size: 7pt; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase;
  color: ${t.text}; border: 0.6pt solid ${t.text}; padding: 0.6mm 2mm 0.5mm;
}
.subtitle { font-size: 7pt; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: ${t.body}; }
.memo-no { flex: none; text-align: right; max-width: 70mm; }
.memo-no .value { font-size: 17pt; font-weight: 700; letter-spacing: -0.01em; line-height: 1.05; overflow-wrap: anywhere; }
.memo-no .meta { color: ${t.body}; margin-top: 1mm; }

/* Parties */
.parties { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 4mm; margin-bottom: 3.5mm; break-inside: avoid; }
.party { border: 1px solid ${t.faint}; border-radius: 2mm; padding: 3mm 4mm; min-width: 0; }
.party .name { font-size: 11pt; font-weight: 700; letter-spacing: -0.005em; margin: 0 0 1mm; overflow-wrap: anywhere; }
.party p { color: ${t.body}; overflow-wrap: anywhere; }
.party .name { color: ${t.text}; }
.party .extra { margin-top: 1.5mm; padding-top: 1.5mm; border-top: 1px dashed ${t.faint}; }
.party .extra span { color: ${t.text2}; display: inline-block; min-width: 11mm; }

/* Details strip */
.details {
  display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 2mm 3mm;
  background: ${t.bg}; border-radius: 2mm; padding: 2.5mm 4mm; margin-bottom: 4mm; break-inside: avoid;
}
.details > div { min-width: 0; }
.details .v { font-weight: 600; overflow-wrap: anywhere; }

/* Items */
.m-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.m-table thead { display: table-header-group; }
.m-table th {
  background: ${t.text}; color: #fff; font-size: 6.75pt; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase; text-align: left; padding: 2.4mm 2.5mm; vertical-align: middle;
}
.m-table th.r { text-align: right; }
.m-table th.c { text-align: center; }
.m-table th:first-child { border-radius: 1.5mm 0 0 1.5mm; }
.m-table th:last-child { border-radius: 0 1.5mm 1.5mm 0; }
.m-table tr { break-inside: avoid; page-break-inside: avoid; }
.m-table td { padding: 1.5mm 2.5mm; border-bottom: 1px solid ${t.faint}; vertical-align: middle; }
.m-table tbody tr.m-row:nth-child(even) td { background: color-mix(in srgb, ${t.bg} 50%, #fff); }
.m-table .photo { padding-left: 1.5mm; padding-right: 1mm; }
.thumb {
  position: relative; width: 13mm; height: 13mm; border-radius: 1.5mm; overflow: hidden;
  background: ${t.bg}; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
  display: flex; align-items: center; justify-content: center;
}
.thumb img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
.thumb .none { font-size: 5.5pt; line-height: 1.2; text-align: center; color: ${t.text2}; letter-spacing: 0.02em; }
.m-qr { display: block; width: 12mm; height: 12mm; margin: 0 auto; }
.m-qr svg { width: 12mm; height: 12mm; display: block; }
.lot { color: ${t.text2}; }
.sku { font-weight: 600; overflow-wrap: anywhere; }
.desc { overflow-wrap: anywhere; }
.desc-sub { margin-top: 0.4mm; font-size: 7pt; line-height: 1.35; color: ${t.text2}; }
.desc-sub a { color: ${t.accent}; }

/* Totals */
.m-table tr.m-totals-row { break-before: avoid; page-break-before: avoid; }
.m-table tr.m-totals-row > td { border-bottom: 0; padding: 0; background: none; }
.totals {
  display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 1mm 6mm;
  padding: 3mm 2.5mm 2.5mm; border-bottom: 2px solid ${t.text}; break-inside: avoid; page-break-inside: avoid;
}
.totals .what { font-size: 7pt; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.totals .count { color: ${t.body}; }
.totals .amount { margin-left: auto; font-size: 15pt; font-weight: 700; letter-spacing: -0.01em; }
.totals .amount small { font-size: 9pt; font-weight: 600; color: ${t.body}; margin-right: 1.2mm; letter-spacing: 0; }
.m-summary { margin-top: 2mm; }

/* Legal */
.legal { margin-top: 5mm; display: grid; gap: 3mm; }
.legal section { break-inside: avoid; }
.legal p { color: ${t.body}; font-size: 7.5pt; line-height: 1.45; text-align: justify; hyphens: auto; }
.legal p + p { margin-top: 1.2mm; }
.legal .remarks p { text-align: left; white-space: pre-line; overflow-wrap: anywhere; }

/* Bank + signature */
.bottom { margin-top: 5mm; display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 4mm; break-inside: avoid; }
.bank { border: 1px solid ${t.faint}; border-radius: 2mm; padding: 3mm 4mm; min-width: 0; }
.bank dl { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 0.4mm 4mm; }
.bank dt { color: ${t.text2}; }
.bank dd { font-weight: 500; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.sign { display: grid; grid-template-rows: auto 1fr auto; min-height: 30mm; padding-top: 3mm; }
.sign-lines { grid-row: 3; display: grid; grid-template-columns: 2fr 1fr; gap: 5mm; }
.sign-lines div { border-top: 1px solid ${t.faint}; padding-top: 1.5mm; font-size: 7.5pt; color: ${t.text2}; }
.pay { padding-top: 3mm; min-width: 0; }
.pay p { color: ${t.body}; margin-top: 1.2mm; overflow-wrap: anywhere; }
.pay .due { color: ${t.text}; font-size: 11pt; font-weight: 700; letter-spacing: -0.005em; }`;
}
