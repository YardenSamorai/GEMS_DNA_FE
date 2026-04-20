import JSZip from "jszip";

/**
 * Template Importer
 * -----------------
 * Accepts a folder (via webkitdirectory) or a ZIP file containing
 * a complete email template (HTML + CSS + media), and returns a
 * single self-contained HTML string suitable for storage and email-client
 * rendering (CSS inlined, images converted to base64 data URIs).
 *
 * Supported folder layouts (typical Outlook / Word HTML exports):
 *
 *   index.html
 *   styles.css                  ← <link rel="stylesheet" href="styles.css">
 *   images/banner.jpg           ← <img src="images/banner.jpg">
 *
 *   newsletter/
 *     newsletter.html
 *     newsletter_files/
 *       image001.png
 *       filelist.xml
 */

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Import a folder selected with <input webkitdirectory>.
 * @param {FileList} fileList
 * @returns {Promise<{name:string,html:string,assetCount:number,sizeKb:number}>}
 */
export async function importFromFolder(fileList) {
  const files = Array.from(fileList || []);
  if (files.length === 0) throw new Error("No files selected");
  const map = new Map();
  for (const f of files) {
    const path = (f.webkitRelativePath || f.name).replace(/\\/g, "/");
    map.set(path.toLowerCase(), f);
  }
  const rootName = (files[0].webkitRelativePath || files[0].name).split("/")[0] || "Imported template";
  return processFileMap(map, rootName);
}

/**
 * Import a ZIP file selected with <input type="file" accept=".zip">.
 * @param {File} zipFile
 */
export async function importFromZip(zipFile) {
  if (!zipFile) throw new Error("No file");
  const zip = await JSZip.loadAsync(zipFile);
  const map = new Map();
  let rootGuess = (zipFile.name || "").replace(/\.zip$/i, "");
  await Promise.all(
    Object.keys(zip.files).map(async (path) => {
      const entry = zip.files[path];
      if (entry.dir) return;
      const blob = await entry.async("blob");
      const file = new File([blob], path.split("/").pop(), { type: blob.type });
      map.set(path.toLowerCase(), file);
    })
  );
  // Root dir if everything sits in one top-level folder
  const top = new Set(Array.from(map.keys()).map((p) => p.split("/")[0]));
  if (top.size === 1) rootGuess = Array.from(top)[0];
  return processFileMap(map, rootGuess || "Imported template");
}

/* ------------------------------------------------------------------ */
/*  Core processing                                                    */
/* ------------------------------------------------------------------ */

const HTML_RE = /\.html?$/i;
const CSS_RE = /\.css$/i;
const IMG_RE = /\.(png|jpe?g|gif|webp|svg)$/i;

async function processFileMap(map, defaultName) {
  // 1. Find main HTML file
  const htmlEntries = Array.from(map.entries()).filter(([k]) => HTML_RE.test(k));
  if (htmlEntries.length === 0) {
    throw new Error("No HTML file found in folder/ZIP");
  }
  // Prefer index.html, then index_parsed.html, then shortest path, then first
  htmlEntries.sort((a, b) => {
    const score = (k) => {
      const name = k.split("/").pop();
      if (name === "index.html") return 0;
      if (name === "index.htm") return 1;
      if (name.startsWith("index")) return 2;
      return 10 + k.length;
    };
    return score(a[0]) - score(b[0]);
  });
  const [htmlPath, htmlFile] = htmlEntries[0];
  const htmlDir = htmlPath.includes("/") ? htmlPath.slice(0, htmlPath.lastIndexOf("/") + 1) : "";
  let html = await htmlFile.text();
  let assetCount = 0;

  // 2. Strip script tags (email-clients reject JS anyway, and prevents XSS in our preview)
  html = html.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  html = html.replace(/\son[a-z]+="[^"]*"/gi, ""); // inline event handlers
  html = html.replace(/\son[a-z]+='[^']*'/gi, "");

  // 3. Extract <body> if it's a full HTML document, but keep <head><style>
  const styleBlocks = [];
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let sm;
  while ((sm = styleRe.exec(html)) !== null) styleBlocks.push(sm[1]);

  // 4. Resolve <link rel="stylesheet" href="..."> → inline as <style>
  const linkRe = /<link\b[^>]*rel=['"]stylesheet['"][^>]*>/gi;
  const linkHrefRe = /href=['"]([^'"]+)['"]/i;
  const linkTags = html.match(linkRe) || [];
  const inlineStyles = [];
  for (const tag of linkTags) {
    const hrefMatch = tag.match(linkHrefRe);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    const cssFile = resolveAsset(map, htmlDir, href);
    if (cssFile && CSS_RE.test(href)) {
      const cssText = await cssFile.text();
      // Resolve url(...) in CSS too
      const cssDir = cssFile._path
        ? cssFile._path.slice(0, cssFile._path.lastIndexOf("/") + 1)
        : htmlDir;
      const resolvedCss = await resolveCssUrls(cssText, map, cssDir);
      inlineStyles.push(resolvedCss);
      assetCount++;
    }
  }
  // Remove <link rel="stylesheet"> tags (we've inlined them)
  html = html.replace(linkRe, "");
  // Inject collected CSS into <head> (or prepend if no head)
  if (inlineStyles.length > 0) {
    const css = `<style type="text/css">\n${inlineStyles.join("\n")}\n</style>`;
    if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, `${css}\n</head>`);
    else html = css + html;
  }

  // 5. Process inline <style> blocks for url(...) too
  html = await replaceAsync(html, styleRe, async (match, body) => {
    const resolved = await resolveCssUrls(body, map, htmlDir);
    return match.replace(body, resolved);
  });

  // 6. Replace <img src="..."> with base64 data URIs
  html = await replaceAsync(html, /<img\b([^>]*?)src=['"]([^'"]+)['"]([^>]*)>/gi, async (m, pre, src, post) => {
    if (/^(https?:|data:|cid:|mailto:)/i.test(src)) return m;
    const file = resolveAsset(map, htmlDir, src);
    if (!file || !IMG_RE.test(src)) return m;
    const dataUri = await fileToDataUri(file);
    assetCount++;
    return `<img${pre}src="${dataUri}"${post}>`;
  });

  // 7. Strip Word/Outlook conditional & xml junk that bloats the file
  html = html
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, "")
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<o:p[\s\S]*?<\/o:p>/gi, "")
    .replace(/<o:p\s*\/?>/gi, "");

  const sizeKb = Math.round(new Blob([html]).size / 1024);
  return { name: defaultName, html, assetCount, sizeKb };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function resolveAsset(map, baseDir, ref) {
  if (!ref) return null;
  // Strip query/hash
  const clean = ref.split(/[?#]/)[0];
  // Possible candidates: as-is, dir + ref, normalized
  const candidates = [
    clean,
    baseDir + clean,
    clean.replace(/^\.\//, ""),
    baseDir + clean.replace(/^\.\//, ""),
  ];
  for (const c of candidates) {
    const norm = normalizePath(c).toLowerCase();
    if (map.has(norm)) {
      const f = map.get(norm);
      f._path = norm;
      return f;
    }
  }
  // Loose match by basename (last resort, useful for Word exports with weird paths)
  const base = clean.split("/").pop().toLowerCase();
  for (const [k, f] of map.entries()) {
    if (k.endsWith("/" + base) || k === base) {
      f._path = k;
      return f;
    }
  }
  return null;
}

function normalizePath(p) {
  const parts = [];
  for (const seg of p.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

async function resolveCssUrls(css, map, baseDir) {
  return await replaceAsync(css, /url\(\s*['"]?([^'")]+)['"]?\s*\)/g, async (match, url) => {
    if (/^(https?:|data:)/i.test(url)) return match;
    const file = resolveAsset(map, baseDir, url);
    if (!file) return match;
    if (!IMG_RE.test(url)) return match;
    const dataUri = await fileToDataUri(file);
    return `url("${dataUri}")`;
  });
}

function fileToDataUri(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Async-aware String.prototype.replace
async function replaceAsync(str, regex, asyncFn) {
  const promises = [];
  str.replace(regex, (match, ...args) => {
    promises.push(asyncFn(match, ...args));
    return match;
  });
  const results = await Promise.all(promises);
  return str.replace(regex, () => results.shift());
}
