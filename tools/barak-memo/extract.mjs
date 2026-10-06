/* PDF -> positioned text runs + image placements, top-left origin in PDF
 * points. This is the only format-specific step; the parser in
 * src/memo/barak works from this shape and never sees the PDF itself. */
import { readFile } from "node:fs/promises";

// pdf.js warns about its optional canvas package at import; text and
// operator extraction don't use it.
const { log, warn } = console;
console.log = () => {};
console.warn = () => {};
const { getDocument, OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
Object.assign(console, { log, warn });

// Runs on one baseline further apart than this are separate cells.
const CELL_GAP = 10;
const SAME_LINE = 2;

const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

async function imagePlacements(page, height) {
  const ops = await page.getOperatorList();
  const out = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  ops.fnArray.forEach((fn, i) => {
    const args = ops.argsArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform) ctm = mul(ctm, args);
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintJpegXObject) {
      const xs = [ctm[4], ctm[4] + ctm[0], ctm[4] + ctm[2], ctm[4] + ctm[0] + ctm[2]];
      const ys = [ctm[5], ctm[5] + ctm[1], ctm[5] + ctm[3], ctm[5] + ctm[1] + ctm[3]];
      out.push({
        x0: Math.min(...xs),
        x1: Math.max(...xs),
        y0: height - Math.max(...ys),
        y1: height - Math.min(...ys),
      });
    }
  });
  return out;
}

function runsFromItems(items, height) {
  const glyphs = items
    .filter((it) => it.str && it.str.trim())
    .map((it) => {
      const size = Math.hypot(it.transform[2], it.transform[3]) || it.height;
      const x0 = it.transform[4];
      const base = height - it.transform[5];
      return { text: it.str, x0, x1: x0 + it.width, y0: base - size * 0.8, y1: base + size * 0.2, base, size };
    })
    .sort((a, b) => a.base - b.base);

  // Baselines within SAME_LINE are one line; within a line, left to right.
  const lines = [];
  for (const g of glyphs) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(line.base - g.base) <= SAME_LINE) line.glyphs.push(g);
    else lines.push({ base: g.base, glyphs: [g] });
  }

  const runs = [];
  for (const line of lines) {
    let last = null;
    for (const g of line.glyphs.sort((a, b) => a.x0 - b.x0)) {
      const gap = last ? g.x0 - last.x1 : Infinity;
      if (last && gap >= -2 && gap <= CELL_GAP) {
        last.text += gap > g.size * 0.15 && !last.text.endsWith(" ") && !g.text.startsWith(" ") ? ` ${g.text}` : g.text;
        last.x1 = Math.max(last.x1, g.x1);
        last.y0 = Math.min(last.y0, g.y0);
        last.y1 = Math.max(last.y1, g.y1);
      } else {
        last = { ...g };
        runs.push(last);
      }
    }
  }
  return runs
    .map(({ base, ...r }) => ({ ...r, text: r.text.replace(/\s+/g, " ").trim() }))
    .sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
}

export async function extractPdf(path) {
  const data = new Uint8Array(await readFile(path));
  const pdf = await getDocument({ data, useSystemFonts: false, isEvalSupported: false, verbosity: 0 }).promise;
  const meta = await pdf.getMetadata().catch(() => null);
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n += 1) {
    const page = await pdf.getPage(n);
    const { width, height } = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    pages.push({
      number: n,
      width,
      height,
      runs: runsFromItems(content.items, height),
      images: await imagePlacements(page, height),
    });
  }
  return {
    producer: meta?.info?.Producer || null,
    title: meta?.info?.Title || null,
    created: meta?.info?.CreationDate || null,
    pages,
  };
}
