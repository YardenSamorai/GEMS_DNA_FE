/**
 * Memo signatures API (Sprint: digital signature workflow).
 *
 * Two-way electronic signature for memos:
 *   - Supplier signs `event='issue'` (hard-gated before status flips draft→out)
 *   - Store signs `event='issue'` to acknowledge receipt
 *   - Either party can sign `event='close'` at end of memo lifecycle
 *
 * Signature data is captured in the FE as a PNG `dataURL` from the canvas
 * pad, sent inline in the JSON body. The BE decodes, uploads to Vercel
 * Blob, freezes a memo snapshot, computes a SHA-256 integrity hash, and
 * inserts the row. UNIQUE(memo_id, event, signer_role) prevents duplicates.
 *
 * Returned signature shape (matches the BE response):
 *   {
 *     id, memo_id, event, signer_role, signer_clerk_id, signer_name,
 *     signer_email, signature_url, consent_text, integrity_hash,
 *     ip_address, user_agent, pdf_url, token_id, signed_at
 *   }
 */

const API_BASE = process.env.REACT_APP_API_URL || "https://gems-dna-be.onrender.com";

const qs = (params) => {
  const cleaned = Object.fromEntries(
    Object.entries(params || {}).filter(
      ([, v]) => v !== undefined && v !== null && v !== ""
    )
  );
  const str = new URLSearchParams(cleaned).toString();
  return str ? `?${str}` : "";
};

const json = async (res) => {
  if (!res.ok) {
    let body = null;
    try { body = await res.json(); } catch (_) {}
    const err = new Error(body?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = body?.code || null;
    err.payload = body || null;
    throw err;
  }
  return res.json();
};

/* The legal-consent text the user explicitly agrees to before submitting.
 * Stored verbatim on the row in `consent_text` so the exact wording at
 * signing time is preserved even if we update the copy later. */
export const CONSENT_TEXT =
  "I confirm that I have reviewed the memo above and agree this constitutes " +
  "my electronic signature for the purposes of acknowledging the contents and " +
  "applicable terms.";

/**
 * Submit a signature.
 *
 * @param {string} userId      - Clerk user id of the signer.
 * @param {number|string} memoId
 * @param {object} payload
 *   event:            'issue' | 'close'
 *   signerRole:       'supplier' | 'store'
 *   signerName:       full legal name typed by the user
 *   signatureDataUrl: PNG data URL from the canvas
 *   consentText:      defaults to CONSENT_TEXT if omitted
 */
export const submitMemoSignature = (userId, memoId, payload) =>
  fetch(`${API_BASE}/api/memos/${memoId}/signatures${qs({ userId })}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      consentText: CONSENT_TEXT,
      ...payload,
    }),
  }).then(json);

/* Map signer_role + event into a short human label for badges/headings. */
export const signatureLabel = (sig) => {
  if (!sig) return "";
  const who = sig.signer_role === "supplier" ? "Supplier" : "Store";
  const when = sig.event === "issue" ? "issuance" : "close";
  return `${who} · ${when}`;
};

/* Find a specific signature on a memo, or null. */
export const findSignature = (memo, event, signerRole) => {
  const list = memo?.signatures || [];
  return list.find((s) => s.event === event && s.signer_role === signerRole) || null;
};

/* Whether the current viewer can still sign as the given role on the
 * given event (no existing row, status appropriate). The caller is
 * expected to also gate on role from useTeam. */
export const canSign = (memo, event, signerRole) => {
  if (!memo) return false;
  if (findSignature(memo, event, signerRole)) return false;
  if (event === "issue") {
    if (signerRole === "supplier") return memo.status === "draft";
    if (signerRole === "store") return memo.status === "out" || memo.status === "partially_returned";
  }
  if (event === "close") {
    return memo.status === "closed";
  }
  return false;
};

/* ─────────── Token-based public signing (Phase 2) ───────────
 *
 * Supplier mints an opaque single-use link for a specific
 * (memo, event, signer_role) tuple. The link is delivered out-of-band
 * (typically WhatsApp) to a counterparty who doesn't have a portal
 * account, and lands on the public /sign/:token page.
 */

/**
 * Mint a signing link. Authenticated as the supplier.
 *
 * @param {string} userId           - Clerk id of the supplier (owner/rep).
 * @param {number|string} memoId
 * @param {object} payload
 *   event:          'issue' | 'close'
 *   signerRole:     'supplier' | 'store'    (typically 'store')
 *   signerEmail?:   optional pre-fill
 *   expiresInDays?: 1-60, default 7
 *
 * Returns the new memo_signature_tokens row, including the raw `token`.
 * The FE composes the public URL as `${origin}/sign/${row.token}`.
 */
export const createMemoSignatureToken = (userId, memoId, payload) =>
  fetch(`${API_BASE}/api/memos/${memoId}/signature-tokens${qs({ userId })}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ...payload }),
  }).then(json);

/* Public: fetch the memo + token metadata for the /sign/:token page.
 * No auth headers. Returns:
 *   { token: { event, signerRole, signerEmail, expiresAt },
 *     memo:  { ...sanitised memo + items[] },
 *     existingSignature: null | { signer_name, signed_at } }
 */
export const fetchSignTokenContext = (token) =>
  fetch(`${API_BASE}/api/sign/${encodeURIComponent(token)}`).then(json);

/* Public: submit a signature against the token. Body mirrors the
 * authenticated POST /signatures, minus event/signerRole (those are
 * fixed by the token on the BE). */
export const submitTokenSignature = (token, payload) =>
  fetch(`${API_BASE}/api/sign/${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      consentText: CONSENT_TEXT,
      ...payload,
    }),
  }).then(json);

/* Compose a wa.me URL for nudging the recipient. `phone` is best-effort —
 * if it doesn't look like a digit string we drop it and rely on the user
 * to pick a contact inside WhatsApp. */
export const buildWhatsAppShareUrl = (phone, message) => {
  const cleaned = String(phone || "").replace(/[^\d]/g, "");
  const text = encodeURIComponent(message || "");
  return cleaned
    ? `https://wa.me/${cleaned}?text=${text}`
    : `https://wa.me/?text=${text}`;
};
