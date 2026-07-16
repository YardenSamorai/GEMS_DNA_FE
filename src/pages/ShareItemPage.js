import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { buildStoneShareText } from "../utils/shareStones";

/* ============================================================================
 * ShareItemPage — the page behind the SHARE button in the exported catalog
 * PDF. A PDF can't open dialogs, so instead of linking straight to wa.me the
 * button lands here: the item's message is previewed, the price can be
 * adjusted (p/c for stones — total recomputes from the weight; flat price for
 * jewelry), and one tap opens WhatsApp with the final text.
 *
 * The item travels inside the link itself (?d=<base64url JSON>, baked in at
 * PDF export time) — no fetch, no auth, works for whoever holds the PDF. When
 * the catalog was exported without prices the payload carries no price fields
 * and the editor is hidden.
 *
 * UNBRANDED like /media — no logo or company identity, so a forwarded PDF
 * never reveals the seller through this page either.
 * ========================================================================== */

const decodePayload = (s) => {
  try {
    const b64 = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(window.atob(b64))));
  } catch {
    return null;
  }
};

const money = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return "";
  return `$${num.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
};

const ShareItemPage = () => {
  const [params] = useSearchParams();
  const item = useMemo(() => decodePayload(params.get("d")), [params]);
  const withPrice = params.get("p") !== "0";

  const isJewelry = item?.kind === "jewelry";
  const basePpc = Number(item?.pricePerCt);
  const basePrice = Number(isJewelry ? item?.price : item?.priceTotal);
  const wtNum = Number(item?.weightCt);

  // Stones edit the p/c (total recomputes); jewelry edits the flat price.
  const [edit, setEdit] = useState(() => {
    const seed = isJewelry ? basePrice : basePpc;
    return Number.isFinite(seed) && seed > 0 ? String(Math.round(seed * 100) / 100) : "";
  });

  if (!item || !item.sku) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#141414] px-6 text-center">
        <p className="max-w-sm text-[14px] leading-relaxed text-white/60">
          This share link is missing or invalid. Please export a fresh catalog
          and try again.
        </p>
      </div>
    );
  }

  const editNum = parseFloat(String(edit).replace(/[^0-9.]/g, ""));
  const editValid = Number.isFinite(editNum) && editNum > 0;

  const shareItem = (() => {
    if (!withPrice || !editValid) return item;
    if (isJewelry) return { ...item, price: editNum };
    return {
      ...item,
      pricePerCt: editNum,
      priceTotal: Number.isFinite(wtNum) ? editNum * wtNum : item.priceTotal,
    };
  })();

  const text = buildStoneShareText(shareItem, { withPrice });
  const canEdit =
    withPrice && (isJewelry ? Number.isFinite(basePrice) && basePrice > 0 : Number.isFinite(basePpc) && basePpc > 0);
  const sendTotal = isJewelry ? money(shareItem.price) : money(shareItem.priceTotal);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center bg-[#141414] px-4 pb-10 text-white">
      {/* Header — unbranded, like the /media viewer: no logo or company
          identity anywhere on this page. */}
      <header className="flex flex-col items-center pb-2 pt-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50">
          SHARE ON WHATSAPP
        </p>
        <h1 className="mt-1 text-[20px] font-semibold tracking-wide">{item.sku}</h1>
      </header>

      <main className="mt-4 w-full max-w-[480px]">
        {/* Price editor */}
        {canEdit && (
          <div className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3.5">
            <span className="block text-[14px] font-semibold tracking-tight">
              {isJewelry ? "Price" : "Price per carat"}
            </span>
            <span className="block text-[12px] text-white/50">
              {isJewelry
                ? "Adjust before sending"
                : "Adjust before sending — the total updates automatically"}
            </span>
            <div className="mt-2.5 flex items-center gap-3">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-white/50">
                  $
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={edit}
                  onChange={(e) => setEdit(e.target.value)}
                  aria-label={isJewelry ? "Price for the message" : "Price per carat for the message"}
                  className="w-full rounded-xl border border-white/15 bg-black/40 py-2.5 pl-7 pr-3 text-[16px] font-semibold tabular-nums text-white outline-none focus:border-emerald-400"
                />
              </div>
              <div className="shrink-0 text-right">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-white/45">
                  {isJewelry ? "Sends as" : "Total"}
                </span>
                <span className="block text-[17px] font-bold tabular-nums text-emerald-400">
                  {sendTotal || "-"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Send */}
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#25D366] py-3.5 text-[15px] font-semibold text-white transition active:scale-[0.99]"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.8 14.13c-.24.68-1.42 1.32-1.96 1.36-.5.05-.96.23-3.23-.67-2.72-1.07-4.45-3.85-4.59-4.03-.13-.18-1.1-1.46-1.1-2.79 0-1.32.7-1.97.94-2.24.25-.27.54-.34.72-.34l.52.01c.17.01.4-.06.62.47.24.57.81 1.97.88 2.11.07.14.12.31.02.49-.09.18-.14.29-.27.45-.14.16-.29.36-.41.48-.14.14-.28.29-.12.56.16.27.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.21 1.37.27.14.43.12.59-.07.16-.18.68-.79.86-1.06.18-.27.36-.22.61-.13.25.09 1.6.75 1.87.89.27.14.45.2.52.32.07.11.07.66-.17 1.34z" />
          </svg>
          Share on WhatsApp
        </a>

        {/* Preview */}
        <p className="mb-1 mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
          Preview
        </p>
        <pre className="max-h-[45dvh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-3 text-[12.5px] leading-relaxed text-white/80">
          {text}
        </pre>
      </main>

      <div className="mt-auto pb-8" aria-hidden />
    </div>
  );
};

export default ShareItemPage;
