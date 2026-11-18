import { saveAs } from "file-saver";
import { mirrorSupplierUrl } from "../../../utils/supplierMedia";
import { loadPdfJs } from "../../present/certPage";
import { isJewelryItem } from "../model/inventoryModel";

const API_BASE = process.env.REACT_APP_API_URL || "https://gems-dna-be.onrender.com";

/* ---------------------------------------------------------------- GRS appendix */

export const grsCertName = (stone) => {
  if (!stone.lab || stone.lab.toUpperCase() !== "GRS" || !stone.certificateUrl) return null;
  const m = stone.certificateUrl.match(/\/([^/]+)\.pdf$/i);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
};

/* Barak names GRS appendices inconsistently ("<cert>-ap.pdf" mostly, newer
 * ones "<cert> ap.pdf", many have none), so the server checks which file
 * exists. Answers { cert: url | null }; a cert that could not be checked is
 * left out. */
export const findAppendices = async (certs) => {
  const unique = [...new Set(certs.filter(Boolean))];
  const found = {};
  for (let i = 0; i < unique.length; i += 150) {
    const batch = unique.slice(i, i + 150).join(",");
    const r = await fetch(`${API_BASE}/api/barak-appendix?certs=${encodeURIComponent(batch)}`);
    if (r.ok) Object.assign(found, (await r.json()).appendix);
  }
  return found;
};

/* ---------------------------------------------------------------- plan */

const lastSegment = (url) => {
  const tail = String(url).split(/[?#]/)[0].split("/").pop() || "";
  try {
    return decodeURIComponent(tail);
  } catch {
    return tail;
  }
};

const extensionOf = (url) => (lastSegment(url).match(/\.([a-z0-9]{2,4})$/i)?.[1] || "pdf").toLowerCase();

const safeName = (s) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();

/* "GRS 2017-118049", or just the number when it already carries the lab
 * ("SIG26050208"). */
export const certLabel = (stone) => {
  const number = lastSegment(stone.certificateUrl).replace(/\.[a-z0-9]{2,4}$/i, "");
  const lab = (stone.lab || "").trim();
  return safeName(lab && !number.toUpperCase().startsWith(lab.toUpperCase()) ? `${lab} ${number}` : number);
};

/* One entry per certificate file, in selection order. A pair that shares one
 * certificate is downloaded once, under both SKUs. */
export const planCertificates = (items) => {
  const certificates = [];
  const byUrl = new Map();
  const missing = [];
  let jewelry = 0;
  for (const item of items) {
    if (isJewelryItem(item)) {
      jewelry += 1;
      continue;
    }
    if (!item.certificateUrl) {
      missing.push(item.sku);
      continue;
    }
    const known = byUrl.get(item.certificateUrl);
    if (known) {
      if (!known.skus.includes(item.sku)) known.skus.push(item.sku);
      continue;
    }
    const entry = {
      url: item.certificateUrl,
      skus: [item.sku],
      label: certLabel(item),
      ext: extensionOf(item.certificateUrl),
      grsCert: grsCertName(item),
    };
    byUrl.set(item.certificateUrl, entry);
    certificates.push(entry);
  }
  return { certificates, missing, jewelry };
};

/* The files to fetch, each appendix right after its certificate. */
export const certificateFiles = (certificates, appendices = {}) =>
  certificates.flatMap((c) => {
    const base = safeName(`${c.skus.join(" + ")} - ${c.label}`);
    const files = [{ url: c.url, name: `${base}.${c.ext}`, skus: c.skus }];
    const appendix = c.grsCert && appendices[c.grsCert];
    if (appendix) files.push({ url: appendix, name: `${base} appendix.pdf`, skus: c.skus, appendix: true });
    return files;
  });

/* ---------------------------------------------------------------- fetch */

const fetchFile = async (file) => {
  const r = await fetch(mirrorSupplierUrl(file.url));
  if (!r.ok) throw new Error(r.status === 404 ? "Not on Barak's server" : `HTTP ${r.status}`);
  const type = r.headers.get("content-type") || "";
  return { ...file, type, bytes: new Uint8Array(await r.arrayBuffer()) };
};

/* In order, a few at a time. Failures stay in place as { error }. */
const fetchAll = async (files, onProgress) => {
  const results = new Array(files.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < files.length) {
      const i = next++;
      try {
        results[i] = await fetchFile(files[i]);
      } catch (err) {
        results[i] = { ...files[i], error: err.message || "Download failed" };
      }
      done += 1;
      onProgress?.({ done, total: files.length });
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, files.length) }, worker));
  return results;
};

/* ---------------------------------------------------------------- one PDF */

const isPdf = (file) => /pdf/i.test(file.type) || (!file.type && file.name.endsWith(".pdf"));

const canvasJpeg = async (canvas) => {
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the page"))), "image/jpeg", 0.9)
  );
  return new Uint8Array(await blob.arrayBuffer());
};

/* A4's long side, in points. A scanned certificate is thousands of pixels
 * wide; taken as points, it would print a page the size of a poster. */
const A4_LONG = 842;

const photoSize = (image) => {
  const scale = A4_LONG / Math.max(image.width, image.height);
  return [image.width * scale, image.height * scale];
};

const drawPage = (out, image, [width, height]) => {
  out.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
};

const addImagePage = async (out, bytes, size) => {
  const image = await out.embedJpg(bytes);
  drawPage(out, image, size || photoSize(image));
};

/* Some labs (ICA) encrypt their PDFs. Copied as-is the pages arrive blank,
 * because their content is still encrypted, so they are drawn as images at
 * print resolution instead, keeping the original page size. */
const addRenderedPdf = async (out, bytes) => {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  try {
    for (let n = 1; n <= doc.numPages; n += 1) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(200 / 72, 2400 / base.width) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      await addImagePage(out, await canvasJpeg(canvas), [base.width, base.height]);
    }
  } finally {
    doc.destroy();
  }
};

/* pdf-lib only embeds baseline JPEG and PNG; anything else is redrawn. */
const addPhoto = async (out, file) => {
  try {
    if (/png/i.test(file.type)) {
      const image = await out.embedPng(file.bytes);
      drawPage(out, image, photoSize(image));
    } else {
      await addImagePage(out, file.bytes);
    }
  } catch {
    const bitmap = await createImageBitmap(new Blob([file.bytes], { type: file.type }));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0);
    await addImagePage(out, await canvasJpeg(canvas));
  }
};

const buildPdf = async (files) => {
  const { PDFDocument } = await import("pdf-lib");
  const out = await PDFDocument.create();
  out.setTitle("Certificates");
  const failed = [];
  for (const file of files) {
    try {
      if (!isPdf(file)) {
        await addPhoto(out, file);
        continue;
      }
      const src = await PDFDocument.load(file.bytes, { ignoreEncryption: true });
      if (src.isEncrypted) {
        await addRenderedPdf(out, file.bytes);
        continue;
      }
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    } catch {
      failed.push({ ...file, error: "Couldn't read the file" });
    }
  }
  return { blob: new Blob([await out.save()], { type: "application/pdf" }), failed };
};

/* ---------------------------------------------------------------- ZIP */

const uniqueName = (taken, name) => {
  if (!taken.has(name)) return name;
  const dot = name.lastIndexOf(".");
  for (let n = 2; ; n += 1) {
    const candidate = `${name.slice(0, dot)} (${n})${name.slice(dot)}`;
    if (!taken.has(candidate)) return candidate;
  }
};

const buildZip = async (files) => {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const taken = new Set();
  for (const file of files) {
    const name = uniqueName(taken, file.name);
    taken.add(name);
    // Certificates are already compressed; deflating them again only costs time.
    zip.file(name, file.bytes, { binary: true, compression: "STORE" });
  }
  return { blob: await zip.generateAsync({ type: "blob" }), failed: [] };
};

/* ---------------------------------------------------------------- export */

/**
 * Downloads the certificates of the given stones (GRS appendices after their
 * certificate) as one ZIP of separate files or one merged PDF.
 * Reports { certificates, appendices, failed: [{ name, skus, error }],
 * appendixUnchecked }, counting what made it into the file.
 */
export const exportCertificates = async (stones, { format, onProgress } = {}) => {
  const { certificates } = planCertificates(stones);
  const report = { certificates: 0, appendices: 0, failed: [], appendixUnchecked: false };
  if (!certificates.length) return report;

  let appendices = {};
  const grs = certificates.map((c) => c.grsCert).filter(Boolean);
  if (grs.length) {
    onProgress?.({ stage: "appendix" });
    try {
      appendices = await findAppendices(grs);
    } catch {
      // Unreachable server: the certificates still go out, without appendices.
    }
    report.appendixUnchecked = grs.some((cert) => !(cert in appendices));
  }

  const files = certificateFiles(certificates, appendices);
  const fetched = await fetchAll(files, ({ done, total }) => onProgress?.({ stage: "fetch", done, total }));
  const ok = fetched.filter((f) => !f.error);
  report.failed = fetched.filter((f) => f.error);
  if (!ok.length) return report;

  onProgress?.({ stage: "build" });
  const built = format === "pdf" ? await buildPdf(ok) : await buildZip(ok);
  report.failed.push(...built.failed);
  const unreadable = new Set(built.failed.map((f) => f.name));
  const saved = ok.filter((f) => !unreadable.has(f.name));
  if (!saved.length) return report;

  const date = new Date().toISOString().split("T")[0];
  saveAs(built.blob, `Certificates_${date}.${format === "pdf" ? "pdf" : "zip"}`);
  report.certificates = saved.filter((f) => !f.appendix).length;
  report.appendices = saved.filter((f) => f.appendix).length;
  return report;
};
