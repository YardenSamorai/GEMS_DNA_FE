#!/usr/bin/env node
/**
 * Barak memo -> Gems DNA memo PDF.
 *
 *   node tools/barak-memo/cli.mjs <memo.pdf | record.json> [options]
 *
 *   --out <dir>        output folder (default: next to the input)
 *   --name <base>      output file name without extension
 *   --no-catalog       don't look stones up in the DNA catalog
 *   --draft yes|no     override draft detection (default: from the source)
 *   --browser <path>   Chrome/Edge executable (or CHROME_PATH)
 *
 * Writes <base>.json (model + warnings), <base>.html and <base>.pdf.
 * A .json input is a raw record in the parseBarakMemo shape.
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import jpeg from "jpeg-js";
import "./register.mjs";
import { extractPdf } from "./extract.mjs";

// The app modules use extensionless imports; load them after the hook.
const { parseBarakMemo } = await import("../../src/memo/barak/parseBarakMemo.js");
const { buildMemoModel } = await import("../../src/memo/memoModel.js");
const { enrichMemo, fetchStone } = await import("../../src/memo/enrichMemo.js");
const { issuerLogo } = await import("../../src/memo/issuerBrands.js");
const { renderMemoHtml } = await import("../../src/memo/renderMemoHtml.js");

const run = promisify(execFile);
const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const THUMB_PX = 420;

function parseArgs(argv) {
  const args = { input: null, out: null, name: null, catalog: true, draft: undefined, browser: process.env.CHROME_PATH || null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--out") args.out = argv[++i];
    else if (a === "--name") args.name = argv[++i];
    else if (a === "--no-catalog") args.catalog = false;
    else if (a === "--draft") args.draft = { yes: true, no: false }[argv[++i]];
    else if (a === "--browser") args.browser = argv[++i];
    else if (!a.startsWith("--")) args.input = a;
    else throw new Error(`Unknown option ${a}`);
  }
  if (!args.input) throw new Error("Usage: cli.mjs <memo.pdf | record.json> [--out dir] [--no-catalog] [--draft yes|no]");
  return args;
}

function findBrowser(explicit) {
  const env = process.env;
  const candidates = [
    explicit,
    join(env["ProgramFiles(x86)"] || "", "Microsoft/Edge/Application/msedge.exe"),
    join(env.ProgramFiles || "", "Microsoft/Edge/Application/msedge.exe"),
    join(env.ProgramFiles || "", "Google/Chrome/Application/chrome.exe"),
    join(env["ProgramFiles(x86)"] || "", "Google/Chrome/Application/chrome.exe"),
    join(env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe"),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const hit = candidates.find((p) => existsSync(p));
  if (!hit) throw new Error("No Chrome/Edge found; pass --browser or set CHROME_PATH.");
  return hit;
}

/** Box-filter downscale; thumbnails print at 17 mm, ~420 px is plenty. */
function downscaleJpeg(buffer) {
  const src = jpeg.decode(buffer, { useTArray: true, maxMemoryUsageInMB: 1024 });
  const scale = Math.min(1, THUMB_PX / Math.max(src.width, src.height));
  if (scale === 1) return buffer;
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    const sy0 = Math.floor(y / scale);
    const sy1 = Math.min(src.height, Math.floor((y + 1) / scale));
    for (let x = 0; x < w; x += 1) {
      const sx0 = Math.floor(x / scale);
      const sx1 = Math.min(src.width, Math.floor((x + 1) / scale));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let sy = sy0; sy < sy1; sy += 1) {
        for (let sx = sx0; sx < sx1; sx += 1) {
          const i = (sy * src.width + sx) * 4;
          r += src.data[i];
          g += src.data[i + 1];
          b += src.data[i + 2];
          n += 1;
        }
      }
      const o = (y * w + x) * 4;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
      out[o + 3] = 255;
    }
  }
  return jpeg.encode({ data: out, width: w, height: h }, 85).data;
}

async function loadImage(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const type = (res.headers.get("content-type") || "").split(";")[0].trim();
  const bytes = Buffer.from(await res.arrayBuffer());
  if (!type.startsWith("image/") || bytes.length === 0) return null;
  if (type === "image/jpeg") return `data:image/jpeg;base64,${downscaleJpeg(bytes).toString("base64")}`;
  return bytes.length <= 400_000 ? `data:${type};base64,${bytes.toString("base64")}` : null;
}

async function verifyUrl(url) {
  for (const method of ["HEAD", "GET"]) {
    try {
      const res = await fetch(url, { method, redirect: "follow" });
      if (res.ok) return true;
    } catch {
      /* try GET */
    }
  }
  return false;
}

async function logoFor(issuerName) {
  const logo = issuerLogo(issuerName);
  if (!logo) return null;
  const svg = await readFile(join(APP_ROOT, logo.file));
  return { ...logo, src: `data:image/svg+xml;base64,${svg.toString("base64")}` };
}

async function printPdf(browser, htmlPath, pdfPath) {
  const profile = await mkdtemp(join(tmpdir(), "barak-memo-"));
  try {
    await run(
      browser,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-pdf-header-footer",
        `--user-data-dir=${profile}`,
        `--print-to-pdf=${pdfPath}`,
        pathToFileURL(htmlPath).href,
      ],
      { timeout: 120_000 },
    );
  } finally {
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
  if (!existsSync(pdfPath)) throw new Error("The browser did not write the PDF.");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = resolve(args.input);
  const outDir = resolve(args.out || dirname(input));
  const base = args.name || `${basename(input, extname(input)).replace(/[^\w.-]+/g, "_").slice(0, 60)}.gemsdna`;
  await mkdir(outDir, { recursive: true });

  const record =
    extname(input).toLowerCase() === ".json" ? JSON.parse(await readFile(input, "utf8")) : parseBarakMemo(await extractPdf(input));
  let model = buildMemoModel(record, { draft: args.draft });
  if (args.catalog && model.items.length) {
    model = await enrichMemo(model, { lookupStone: (sku) => fetchStone(sku), verifyUrl, loadImage });
  }

  const html = await renderMemoHtml(model, { issuerLogo: await logoFor(model.issuer?.name) });
  const paths = { json: join(outDir, `${base}.json`), html: join(outDir, `${base}.html`), pdf: join(outDir, `${base}.pdf`) };
  const stripImages = (key, value) => (key === "image" && typeof value === "string" && value.startsWith("data:") ? "[inline image]" : value);
  await writeFile(paths.json, JSON.stringify({ record, model }, stripImages, 2));
  await writeFile(paths.html, html);
  await printPdf(findBrowser(args.browser), paths.html, paths.pdf);

  console.log(`PDF   ${paths.pdf}`);
  console.log(`HTML  ${paths.html}`);
  console.log(`Model ${paths.json}`);
  if (model.warnings.length) {
    console.log(`\n${model.warnings.length} warning(s) for the operator (not printed on the memo):`);
    model.warnings.forEach((w) => console.log(`  [${w.code}] ${w.message}`));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
