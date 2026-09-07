/* Supplier media — pointing hardcoded Barak URLs at our own mirror.
 *
 * Barak's server answers every photo and certificate with
 * `Cross-Origin-Resource-Policy: same-origin`. The browser downloads the
 * file, sees that our page is a different origin, and discards it: a 200
 * response that still paints a broken <img>. The API already rewrites every
 * URL it hands out to point at `/api/barak/` on our own backend (see
 * GEMS_DNA_BE utils/supplierMedia.js), which covers everything that arrives
 * as data.
 *
 * What it cannot cover are the few supplier URLs written directly into this
 * codebase — the "no image" artwork and the certificate folder we append a
 * certificate number to. Those go through here instead.
 *
 * Links a person clicks (the Barak admin deep-link on the QA page, the GRS
 * appendix hyperlink in the Excel export) deliberately stay pointed at the
 * supplier: the header only governs files embedded in a page, so a plain
 * navigation still works and is better off not depending on our server.
 */

const API_BASE = process.env.REACT_APP_API_URL || "https://gems-dna-be.onrender.com";

const SUPPLIER_URL_RE = /^https?:\/\/app\.barakdiamonds\.com\//i;

export const mirrorSupplierUrl = (url) =>
  typeof url === "string" && SUPPLIER_URL_RE.test(url)
    ? url.replace(SUPPLIER_URL_RE, `${API_BASE}/api/barak/`)
    : url;

/* The supplier's own "no photo available" artwork. */
export const SUPPLIER_FALLBACK_IMAGE = mirrorSupplierUrl(
  "https://app.barakdiamonds.com/Gemstones/Output/StoneImages/Eshed_no_image_2.jpg"
);

/* Roughly one photo in thirty is named in the feed but was never uploaded, so
 * the only way to find out is to let the load fail. Falls back to the
 * placeholder rather than leaving a torn-page icon on a public product page.
 * Guarded so a placeholder that is itself unreachable cannot loop. */
export const onImageError = (event) => {
  const img = event.currentTarget;
  if (img.src !== SUPPLIER_FALLBACK_IMAGE) img.src = SUPPLIER_FALLBACK_IMAGE;
};
