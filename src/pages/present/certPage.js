/* Certificates arrive as PDFs, which an <img> can't show and an iframe shows
 * as a toolbar-wrapped viewer (or a single blurry page on iPad). pdf.js draws
 * the first page to a JPEG instead, sized for a retina stage, so the stage can
 * treat it like any photo. pdf.js loads only when a certificate is opened; the
 * worker is served from /public so a show-floor connection never depends on a
 * CDN. Keep the worker file name in step with the pdfjs-dist version. */
const WORKER_SRC = "/pdfjs/pdf.worker-3.11.174.min.js";
const RENDER_WIDTH = 1800;
const MAX_SCALE = 4;

let libPromise = null;
const loadPdfJs = () => {
  if (!libPromise) {
    libPromise = import("pdfjs-dist/legacy/build/pdf").then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = WORKER_SRC;
      return lib;
    });
  }
  return libPromise;
};

const renderFirstPage = async (url) => {
  const pdfjs = await loadPdfJs();
  // isEvalSupported:false closes the font-compilation eval path (CVE-2024-4367).
  const doc = await pdfjs.getDocument({ url, isEvalSupported: false }).promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(RENDER_WIDTH / base.width, MAX_SCALE) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the page"))), "image/jpeg", 0.92)
    );
    return URL.createObjectURL(blob);
  } finally {
    doc.destroy();
  }
};

const pages = new Map(); // pdf url -> Promise<object URL of page 1>

/* Resolves to an image URL of the certificate's first page; a failed render
 * is forgotten so the next visit tries again. */
export const certPageImage = (url) => {
  if (!pages.has(url)) {
    pages.set(
      url,
      renderFirstPage(url).catch((err) => {
        pages.delete(url);
        throw err;
      })
    );
  }
  return pages.get(url);
};
