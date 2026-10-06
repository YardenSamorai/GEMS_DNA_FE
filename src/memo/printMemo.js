import { buildMemoModel } from "./memoModel";
import { enrichMemo } from "./enrichMemo";
import { issuerLogo } from "./issuerBrands";
import { renderMemoHtml } from "./renderMemoHtml";

/**
 * Record -> memo HTML for the browser (an Export button's entry point).
 * Image and certificate URLs are used as the catalog returns them; pass
 * `verifyUrl` to link certificates (the strict default shows lab + number).
 */
export async function memoHtmlFromRecord(record, { catalog = true, verifyUrl = null, lookupStone } = {}) {
  let model = buildMemoModel(record);
  if (catalog && model.items.length) model = await enrichMemo(model, { verifyUrl, ...(lookupStone ? { lookupStone } : {}) });
  const logo = issuerLogo(model.issuer?.name);
  const html = await renderMemoHtml(model, { issuerLogo: logo && { ...logo, src: `${window.location.origin}${logo.src}` } });
  return { html, model };
}

/** Opens the system print dialog (Save as PDF) for a rendered memo. */
export function printMemoHtml(html) {
  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
    frame.srcdoc = html;
    frame.onload = async () => {
      const doc = frame.contentDocument;
      const settled = (img) =>
        new Promise((done) => {
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        });
      await Promise.all([...doc.images].filter((img) => !img.complete).map(settled));
      if (doc.fonts?.ready) await doc.fonts.ready;
      const win = frame.contentWindow;
      let done = false;
      const cleanup = () => {
        if (done) return;
        done = true;
        frame.remove();
        resolve();
      };
      win.addEventListener("afterprint", cleanup, { once: true });
      win.focus();
      win.print();
      setTimeout(cleanup, 60_000);
    };
    document.body.appendChild(frame);
  });
}
