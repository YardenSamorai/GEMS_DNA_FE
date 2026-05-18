import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import SignaturePad from "./SignaturePad";
import {
  submitMemoSignature,
  submitPortalMemoSignature,
  CONSENT_TEXT,
} from "../../services/signaturesApi";

/**
 * SignatureModal — captures and submits one signature on a memo.
 *
 * The modal owns the pad + the typed name + the consent checkbox and
 * handles the network call itself. Parent passes:
 *
 *   open        - controls visibility
 *   onClose()   - dismiss without signing
 *   onSigned(sig, memoId)
 *               - fires after a successful POST. The parent typically
 *                 reloads the memo so the new signature appears in the
 *                 list, and (when applicable) chains a follow-up action
 *                 like `issueMemo`. The created row is passed back as a
 *                 convenience, but the source of truth remains the
 *                 reloaded memo payload.
 *
 *   userId      - Clerk id of the signer (used as ?userId= for the API)
 *   memoId      - which memo we're signing on
 *   event       - 'issue' | 'close'
 *   signerRole  - 'supplier' | 'store'
 *   title       - heading shown at the top of the modal (e.g. "Sign & issue memo")
 *   defaultName - pre-fill for the typed-name field (defaults to "")
 *   actionLabel - submit button label (e.g. "Sign & issue", "Acknowledge")
 *   portal      - when true, POSTs to /api/portal/memos/:id/signatures
 *                 instead of the supplier-facing /api/memos/:id/signatures.
 *                 Required for store_user callers because the BE blocks
 *                 that role from non-portal paths.
 *
 * Mobile note: the pad uses touch-action:none so drawing doesn't scroll
 * the page; the modal locks body scroll while open to match the existing
 * dialog patterns elsewhere in the app.
 */
export default function SignatureModal({
  open,
  onClose,
  onSigned,
  userId,
  memoId,
  event,
  signerRole,
  title,
  defaultName = "",
  actionLabel = "Sign",
  portal = false,
}) {
  const padRef = useRef(null);
  const [dataUrl, setDataUrl] = useState(null);
  const [name, setName] = useState(defaultName);
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset state every time the modal opens fresh, so two consecutive
  // sign flows don't carry over a stale signature/name.
  useEffect(() => {
    if (open) {
      setDataUrl(null);
      setName(defaultName);
      setConsented(false);
      padRef.current?.clear();
    }
  }, [open, defaultName]);

  // Lock background scroll while open (matches JewelryItemDialog pattern).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // ESC to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape" && !submitting) onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, submitting]);

  if (!open) return null;

  const trimmedName = name.trim();
  const canSubmit = !!dataUrl && !!trimmedName && consented && !submitting;

  const handleClear = () => {
    padRef.current?.clear();
    setDataUrl(null);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!userId) {
      toast.error("Not signed in");
      return;
    }
    setSubmitting(true);
    try {
      const submit = portal ? submitPortalMemoSignature : submitMemoSignature;
      const sig = await submit(userId, memoId, {
        event,
        signerRole,
        signerName: trimmedName,
        signatureDataUrl: dataUrl,
      });
      toast.success("Signature recorded");
      onSigned?.(sig, memoId);
    } catch (e) {
      toast.error(e.message || "Failed to record signature");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 sm:p-6"
      onClick={() => { if (!submitting) onClose?.(); }}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
              {signerRole === "supplier" ? "Supplier signature" : "Store signature"} · {event === "issue" ? "Issuance" : "Close"}
            </div>
            {title && <h2 className="mt-0.5 truncate text-base font-semibold text-stone-900">{title}</h2>}
          </div>
          <button
            type="button"
            onClick={() => { if (!submitting) onClose?.(); }}
            disabled={submitting}
            className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50"
            title="Close (Esc)"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {/* Signature pad */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                Draw your signature
              </label>
              <button
                type="button"
                onClick={handleClear}
                disabled={submitting || !dataUrl}
                className="text-[11px] font-semibold text-stone-500 hover:text-stone-900 disabled:opacity-30"
              >
                Clear
              </button>
            </div>
            <SignaturePad
              ref={padRef}
              onChange={setDataUrl}
              disabled={submitting}
              height={180}
            />
          </div>

          {/* Typed full name */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              Full legal name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              placeholder="As it should appear on the signed memo"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:border-stone-400 disabled:opacity-50"
              autoComplete="name"
            />
          </div>

          {/* Consent — exact text is stored on the row */}
          <label className="flex items-start gap-2.5 rounded-lg bg-stone-50 px-3 py-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
              disabled={submitting}
              className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-xs text-stone-700 leading-relaxed">{CONSENT_TEXT}</span>
          </label>

          <div className="text-[11px] text-stone-400 leading-relaxed">
            This is an electronic signature. Your IP address, browser, and a timestamp
            will be recorded on the signed memo for audit purposes.
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-stone-200 bg-stone-50 px-5 py-3">
          <button
            type="button"
            onClick={() => { if (!submitting) onClose?.(); }}
            disabled={submitting}
            className="inline-flex items-center rounded-lg bg-white border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:border-stone-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="btn-primary disabled:opacity-50"
          >
            {submitting ? "Saving…" : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
