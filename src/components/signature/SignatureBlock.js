import React from "react";

/**
 * SignatureBlock — read-only display for one stored memo signature.
 *
 * Designed for the document-style MemoDetail layout: a letterhead-shaped
 * card with the signature image at the top, the typed name + role
 * underneath, and the audit footer (timestamp + IP + integrity hash) in
 * a smaller line for legal traceability.
 */

const fmtDateTime = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_) {
    return iso;
  }
};

const shortHash = (h) => (h && h.length > 12 ? `${h.slice(0, 8)}…${h.slice(-4)}` : h || "");

export default function SignatureBlock({ signature, accent = "store" }) {
  if (!signature) return null;
  const isSupplier = signature.signer_role === "supplier";
  const isClose = signature.event === "close";
  const accentClass =
    accent === "supplier" || isSupplier
      ? "border-stone-900"
      : "border-emerald-500";

  return (
    <div className={`bg-white border-l-4 ${accentClass} border border-stone-200 rounded-xl p-4 print:rounded-none`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-[0.15em] text-stone-400 font-bold">
          {isSupplier ? "Supplier signature" : "Store signature"} · {isClose ? "Close" : "Issuance"}
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M5 13l4 4L19 7" />
          </svg>
          Signed
        </span>
      </div>

      <div className="rounded-lg bg-stone-50 border border-stone-200 p-2 flex items-center justify-center">
        {signature.signature_url ? (
          <img
            src={signature.signature_url}
            alt={`Signature of ${signature.signer_name}`}
            className="max-h-28 object-contain"
            draggable={false}
          />
        ) : (
          <div className="text-xs text-stone-400 italic">Signature image unavailable</div>
        )}
      </div>

      <div className="mt-2 text-sm font-semibold text-stone-900">{signature.signer_name}</div>
      {signature.signer_email && (
        <div className="text-xs text-stone-500 break-all">{signature.signer_email}</div>
      )}

      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-stone-500">
        <div>
          <span className="font-semibold text-stone-600">Signed:</span> {fmtDateTime(signature.signed_at)}
        </div>
        {signature.ip_address && (
          <div className="truncate" title={signature.ip_address}>
            <span className="font-semibold text-stone-600">IP:</span> {signature.ip_address}
          </div>
        )}
        {signature.integrity_hash && (
          <div className="sm:col-span-2 font-mono truncate" title={signature.integrity_hash}>
            <span className="font-semibold text-stone-600 font-sans">Hash:</span> {shortHash(signature.integrity_hash)}
          </div>
        )}
      </div>
    </div>
  );
}
