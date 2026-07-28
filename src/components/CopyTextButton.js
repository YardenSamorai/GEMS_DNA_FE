import React from "react";

/* Small "Copy" pill that sits beside a message preview. Flips to a green
 * "Copied" state for a moment after a successful copy. The parent owns the
 * clipboard call and the `copied` flag so it can decide what text to copy. */
const CopyTextButton = ({ copied, onCopy, label = "Copy" }) => (
  <button
    type="button"
    onClick={onCopy}
    aria-label={`${label} message text`}
    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition active:scale-[0.97] ${
      copied
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-app-line bg-app-surface text-app-graphite hover:bg-app-canvas2"
    }`}
  >
    {copied ? (
      <>
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
        </svg>
        Copied
      </>
    ) : (
      <>
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M8 7V5a2 2 0 012-2h7a2 2 0 012 2v9a2 2 0 01-2 2h-2M5 9h9a2 2 0 012 2v8a2 2 0 01-2 2H7a2 2 0 01-2-2v-8a2 2 0 012-2z"
          />
        </svg>
        {label}
      </>
    )}
  </button>
);

export default CopyTextButton;
