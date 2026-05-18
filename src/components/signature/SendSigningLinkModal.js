import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  createMemoSignatureToken,
  buildWhatsAppShareUrl,
} from "../../services/signaturesApi";

/**
 * SendSigningLinkModal — supplier-side helper for sharing a public
 * signing link with a counterparty.
 *
 * On open the modal POSTs to /api/memos/:id/signature-tokens to mint a
 * single-use opaque token, then renders:
 *   - the shareable `/sign/:token` URL with a copy button
 *   - an "Open WhatsApp" button that prefills a courteous message and
 *     opens wa.me with the store's contact phone (or with no recipient
 *     if we don't have a phone on file)
 *   - the expiry date
 *
 * The token is created server-side once per modal open. If the user
 * dismisses without sending, the link is still valid until expiry —
 * they can re-open the awaiting slot and a fresh token will be minted.
 * The slot itself can hold only one signature, so multiple outstanding
 * tokens for the same slot are harmless (whichever gets redeemed first
 * wins, the rest hit the duplicate-signature 409).
 */
export default function SendSigningLinkModal({
  open,
  onClose,
  userId,
  memo,
  event,
  signerRole,
}) {
  const [status, setStatus] = useState("idle"); // idle | creating | ready | error
  const [tokenRow, setTokenRow] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Build the public signing URL using the FE origin so it works in
  // dev (localhost) and prod without an extra env var.
  const url = tokenRow ? `${window.location.origin}/sign/${tokenRow.token}` : "";

  const isClose = event === "close";
  const recipientLabel = signerRole === "supplier" ? "supplier" : "store";

  const waMessage = url
    ? (isClose
        ? `Hi ${memo?.contact_name || memo?.company_name || ""}, please sign the return acknowledgment for memo ${memo?.memo_number}: ${url}`
        : `Hi ${memo?.contact_name || memo?.company_name || ""}, please confirm receipt of memo ${memo?.memo_number} by signing here: ${url}`).trim()
    : "";

  // Mint the token the moment the modal opens (and rebuild on re-open).
  useEffect(() => {
    if (!open || !userId || !memo?.id || !event || !signerRole) return;
    let cancelled = false;
    setStatus("creating");
    setTokenRow(null);
    setError(null);
    setCopied(false);
    createMemoSignatureToken(userId, memo.id, { event, signerRole })
      .then((row) => {
        if (cancelled) return;
        setTokenRow(row);
        setStatus("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || "Failed to create signing link");
        setStatus("error");
      });
    return () => { cancelled = true; };
  }, [open, userId, memo?.id, event, signerRole]);

  // Body scroll lock + ESC handler (same pattern as SignatureModal).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      window.setTimeout(() => setCopied(false), 2500);
    } catch (_) {
      toast.error("Could not copy automatically — long-press to copy");
    }
  };

  const handleOpenWhatsApp = () => {
    if (!url) return;
    const phone = memo?.contact_phone || memo?.company_phone || "";
    const wa = buildWhatsAppShareUrl(phone, waMessage);
    window.open(wa, "_blank", "noopener,noreferrer");
  };

  const expiry = tokenRow?.expires_at
    ? new Date(tokenRow.expires_at).toLocaleString(undefined, {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
              Send signing link · {isClose ? "Return" : "Issuance"}
            </div>
            <h2 className="mt-0.5 text-base font-semibold text-stone-900">
              Memo {memo?.memo_number}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            title="Close (Esc)"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <p className="text-sm text-stone-600">
            Share this single-use link with the {recipientLabel}. They can sign without a portal account; the link expires automatically and can only be used once.
          </p>

          {status === "creating" && (
            <div className="rounded-lg bg-stone-50 border border-stone-200 p-4 text-sm text-stone-500">
              Creating link…
            </div>
          )}

          {status === "error" && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700">
              {error || "Failed to create signing link"}
            </div>
          )}

          {status === "ready" && tokenRow && (
            <>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  Signing link
                </label>
                <div className="flex items-stretch gap-2">
                  <input
                    type="text"
                    value={url}
                    readOnly
                    onFocus={(e) => e.target.select()}
                    className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-mono text-stone-700"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-white border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700 hover:border-stone-500"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                {expiry && (
                  <div className="mt-1.5 text-[11px] text-stone-400">
                    Expires {expiry}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  Suggested WhatsApp message
                </label>
                <textarea
                  readOnly
                  value={waMessage}
                  rows={3}
                  onFocus={(e) => e.target.select()}
                  className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700 resize-none"
                />
              </div>

              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="btn-primary w-full"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20.52 3.48A11.78 11.78 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.11.55 4.17 1.6 5.99L0 24l6.18-1.62A11.93 11.93 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.2-1.25-6.21-3.48-8.52ZM12 21.82c-1.91 0-3.78-.51-5.41-1.48l-.39-.23-3.67.96.98-3.58-.25-.41A9.79 9.79 0 1 1 12 21.82Zm5.41-7.34c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.66.15-.2.3-.76.97-.93 1.17-.17.2-.34.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.34.45-.5.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.66-1.6-.91-2.18-.24-.57-.49-.5-.66-.51l-.56-.01c-.2 0-.5.07-.76.37-.27.3-1 1-1 2.45s1.03 2.84 1.17 3.04c.15.2 2.03 3.1 4.91 4.34.69.3 1.22.48 1.64.61.69.22 1.32.19 1.81.12.55-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
                </svg>
                Open WhatsApp
              </button>

              <div className="text-[11px] text-stone-400 leading-relaxed">
                You can also copy the link above and send it through any other channel (email, SMS, Telegram).
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-stone-200 bg-stone-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center rounded-lg bg-white border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:border-stone-500"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
