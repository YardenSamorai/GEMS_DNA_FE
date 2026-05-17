import React from "react";

/**
 * SignatureRequiredBanner — prominent red banner shown at the top of a
 * memo when the supplier issuance signature is still missing. The
 * presence of this banner is paired with a backend hard-gate that
 * blocks close / approve / decline / portal-request operations until
 * the supplier signs, so users can't silently no-op against a memo
 * that's missing its legally-required signature.
 *
 * Props:
 *   memoNumber - e.g. "MEMO-2026-0003", shown in the headline.
 *   role       - "supplier" | "store". Controls the copy/CTA:
 *                supplier sees a "Sign issuance now" button that opens
 *                the signature modal; store sees informational copy
 *                only (they can't sign on behalf of the supplier).
 *   onSign     - optional click handler for the supplier CTA. When
 *                omitted the button is hidden (e.g. read-only views).
 */
export default function SignatureRequiredBanner({ memoNumber, role, onSign }) {
  const isSupplier = role === "supplier";
  return (
    <div
      role="alert"
      className="bg-rose-50 border-2 border-rose-300 rounded-2xl px-4 sm:px-5 py-3 sm:py-4 shadow-sm print:hidden"
    >
      <div className="flex items-start gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 ring-2 ring-rose-200">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-rose-900 uppercase tracking-wide">
            Action required · Supplier signature missing
          </div>
          <div className="text-xs sm:text-sm text-rose-800 mt-1 leading-relaxed">
            {isSupplier ? (
              <>
                Memo <span className="font-semibold">{memoNumber}</span> has been
                issued but is missing your signature. Until you sign, this memo
                cannot be closed and store requests (sold / return) cannot be
                approved or declined.
              </>
            ) : (
              <>
                Memo <span className="font-semibold">{memoNumber}</span> is
                awaiting the supplier's signature. You will be able to mark
                items as sold or request a return once the supplier signs.
              </>
            )}
          </div>
        </div>
        {isSupplier && typeof onSign === "function" && (
          <button
            type="button"
            onClick={onSign}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 text-white text-xs sm:text-sm font-semibold hover:bg-rose-700 shadow-sm shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Sign issuance now
          </button>
        )}
      </div>
    </div>
  );
}
