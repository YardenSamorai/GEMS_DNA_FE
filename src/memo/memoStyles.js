/**
 * Print stylesheet for the Gems DNA memo. Colours are the light-theme
 * `--dna-*` tokens (src/styles/gemsdna-tokens.css; kept in sync by
 * memoStyles.test.js). Print differs from screen in two places: hairlines
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
  const box = `font-family: ${t.font}; font-size: 7pt; color: ${t.text2}; letter-spacing: 0.01em;`;
  return `
@page {
  size: A4 portrait;
  margin: 17mm 15mm 18mm;
  ${footerStart ? `@bottom-left { content: ${cssString(footerStart)}; ${box} vertical-align: top; padding-top: 5mm; }` : ""}
  @bottom-right { content: ${cssString(footerEnd ? `${footerEnd} · ` : "")} "Page " counter(page) " of " counter(pages); ${box} vertical-align: top; padding-top: 5mm; font-variant-numeric: tabular-nums; }
  @top-left { content: "Gems DNA"; ${box} font-weight: 600; color: ${t.text}; vertical-align: bottom; padding-bottom: 5mm; }
  ${headerEnd ? `@top-right { content: ${cssString(headerEnd)}; ${box} vertical-align: bottom; padding-bottom: 5mm; }` : ""}
}
@page :first {
  @top-left { content: none; }
  @top-right { content: none; }
}

* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  margin: 0;
  font-family: ${t.font};
  font-size: 8.5pt;
  line-height: 1.45;
  color: ${t.text};
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
a { color: inherit; text-decoration: none; }
p { margin: 0; }
dl, dd { margin: 0; }
.num { font-variant-numeric: tabular-nums; white-space: nowrap; text-align: right; }

@media screen {
  html { background: ${t.bg}; }
  body { width: 210mm; margin: 24px auto; padding: 17mm 15mm 18mm; background: #fff; }
}

/* Header */
.m-top { display: flex; align-items: center; justify-content: space-between; }
.m-brand { display: inline-flex; align-items: center; gap: 2mm; font-size: 10pt; font-weight: 650; letter-spacing: -0.01em; }
.m-dot { width: 2.1mm; height: 2.1mm; border-radius: 50%; background: ${t.accentDot}; }
.m-draft {
  font-size: 7pt; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase;
  color: ${t.text}; border: 0.6pt solid ${t.text}; padding: 0.6mm 2mm 0.5mm;
}
.m-intro { display: grid; grid-template-columns: 1fr 64mm; gap: 10mm; align-items: end; margin-top: 11mm; }
.m-title { margin: 0; font-size: 30pt; line-height: 1; font-weight: 700; letter-spacing: -0.025em; }
.m-subtitle { margin-top: 3mm; font-size: 12pt; line-height: 1.3; font-weight: 500; letter-spacing: -0.01em; color: ${t.text2}; }
.m-facts { border-top: 0.75pt solid ${t.text}; }
.m-facts > div { display: grid; grid-template-columns: 24mm 1fr; gap: 3mm; padding: 1.5mm 0; border-bottom: 0.5pt solid ${t.faint}; }
.m-facts dt { color: ${t.text2}; font-size: 7.5pt; padding-top: 0.3mm; }
.m-facts dd { font-weight: 500; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }

.m-eyebrow {
  margin: 0 0 2.5mm; font-size: 6.8pt; font-weight: 600; letter-spacing: 0.12em;
  text-transform: uppercase; color: ${t.text2};
}
.m-section { margin-top: 10mm; }

/* Parties */
.m-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; break-inside: avoid; }
.m-logo { display: block; overflow: hidden; margin: 0 0 3mm; }
.m-logo img { display: block; max-width: none; }
.m-party-name { font-size: 9.5pt; font-weight: 600; letter-spacing: -0.005em; overflow-wrap: anywhere; }
.m-lines { margin-top: 0.8mm; color: ${t.body}; overflow-wrap: anywhere; }
.m-kv { display: grid; grid-template-columns: auto 1fr; column-gap: 2.5mm; margin-top: 1.2mm; color: ${t.body}; }
.m-kv dt { color: ${t.text2}; }

/* Items */
.m-items-head { display: flex; justify-content: space-between; align-items: baseline; }
.m-items-head .m-count { font-size: 7.5pt; color: ${t.text2}; font-variant-numeric: tabular-nums; }
.m-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.m-table thead { display: table-header-group; }
.m-table th {
  padding: 0 0 2mm; border-bottom: 0.75pt solid ${t.text};
  font-size: 6.8pt; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
  color: ${t.text2}; text-align: left; white-space: nowrap;
}
.m-table th.num { text-align: right; }
.m-table td { padding: 3mm 0; border-bottom: 0.5pt solid ${t.faint}; vertical-align: top; }
.m-table td + td, .m-table th + th { padding-left: 3mm; }
.m-table tr { break-inside: avoid; page-break-inside: avoid; }
.m-table td.num { font-size: 8.5pt; padding-top: 3.2mm; }
.m-lot { color: ${t.text2}; font-variant-numeric: tabular-nums; padding-top: 3.2mm !important; }

.m-item { display: flex; gap: 3.5mm; min-width: 0; }
.m-thumb {
  flex: none; width: 17mm; height: 17mm; border-radius: 1.5mm; background: ${t.bg};
  display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.m-thumb img { width: 100%; height: 100%; object-fit: contain; display: block; }
.m-thumb-slot { flex: none; width: 17mm; }
.m-item-text { min-width: 0; overflow-wrap: anywhere; }
.m-item-head { overflow-wrap: anywhere; }
.m-sku { font-weight: 600; letter-spacing: -0.005em; margin-right: 1.5mm; }
.m-type { color: ${t.text}; }
.m-desc { color: ${t.body}; }
.m-facts-line { color: ${t.text2}; font-size: 7.6pt; }
.m-facts-line span { white-space: nowrap; }
.m-cert { margin-top: 0.6mm; font-size: 7.6pt; color: ${t.text2}; }
.m-cert a, .m-link { color: ${t.accent}; }
.m-extra { margin-top: 0.6mm; font-size: 7.6pt; color: ${t.text2}; }
.m-qr { display: block; width: 11mm; height: 11mm; margin-top: 0.4mm; }
.m-qr svg { width: 11mm; height: 11mm; display: block; }

/* Totals */
.m-totals { display: flex; justify-content: flex-end; break-inside: avoid; break-before: avoid; page-break-before: avoid; }
.m-totals dl { width: 78mm; }
.m-totals dl > div { display: flex; justify-content: space-between; gap: 6mm; padding: 1.6mm 0; border-bottom: 0.5pt solid ${t.faint}; }
.m-totals dt { color: ${t.text2}; }
.m-totals dd { font-variant-numeric: tabular-nums; white-space: nowrap; }
.m-totals .m-grand { border-bottom: 0; padding-top: 2.2mm; }
.m-totals .m-grand dt { color: ${t.text}; font-weight: 600; }
.m-totals .m-grand dd { font-size: 12pt; font-weight: 650; letter-spacing: -0.01em; }
.m-summary .m-totals { justify-content: flex-start; }
.m-summary .m-totals dl { width: 100%; border-top: 0.75pt solid ${t.text}; }
.m-summary .m-totals dl > div { padding: 2.2mm 0; }

/* Back matter */
.m-prose { columns: 2; column-gap: 9mm; }
.m-prose-block { break-inside: avoid-column; margin-bottom: 4mm; }
.m-prose p { font-size: 7.6pt; line-height: 1.5; color: ${t.body}; orphans: 3; widows: 3; }
.m-prose p + p { margin-top: 1.8mm; }
.m-close { display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; break-inside: avoid; }
.m-bank > div { display: grid; grid-template-columns: 26mm 1fr; gap: 3mm; padding: 1.2mm 0; border-bottom: 0.5pt solid ${t.faint}; }
.m-bank > div:first-child { border-top: 0.5pt solid ${t.faint}; }
.m-bank dt { color: ${t.text2}; font-size: 7.6pt; padding-top: 0.2mm; }
.m-bank dd { font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.m-sign-space { height: 20mm; border-bottom: 0.75pt solid ${t.text}; }
.m-sign-label { margin-top: 1.5mm; font-size: 7.6pt; color: ${t.text2}; }`;
}
