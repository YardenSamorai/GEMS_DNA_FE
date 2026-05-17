/**
 * Memos (consignment) API helpers — Sprint 4.
 *
 * A memo is a dated bundle of stones/jewelry sent on consignment to a
 * retail store. The memo as a whole has a status (draft → out → closed),
 * and each line item has its own status (out → returned | sold) so a
 * single memo can be partially closed without affecting the rest.
 *
 * Pricing model: only `memoPrice` is exposed per item — the store never
 * sees Bruto / Neto / cost. That's the price we'd charge them if the
 * item is sold from this memo.
 */
const API_BASE = process.env.REACT_APP_API_URL || "https://gems-dna-be.onrender.com";

const json = async (res) => {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch (_) {}
    throw new Error(message);
  }
  return res.json();
};

const qs = (params) => {
  const cleaned = Object.fromEntries(
    Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );
  const str = new URLSearchParams(cleaned).toString();
  return str ? `?${str}` : "";
};

export const fetchMemos = (userId, filters = {}) =>
  fetch(`${API_BASE}/api/memos${qs({ userId, ...filters })}`).then(json);

export const fetchMemo = (userId, id) =>
  fetch(`${API_BASE}/api/memos/${id}${qs({ userId })}`).then(json);

export const createMemo = (userId, payload) =>
  fetch(`${API_BASE}/api/memos${qs({ userId })}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ...payload }),
  }).then(json);

export const updateMemo = (userId, id, payload) =>
  fetch(`${API_BASE}/api/memos/${id}${qs({ userId })}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ...payload }),
  }).then(json);

export const deleteMemo = (userId, id) =>
  fetch(`${API_BASE}/api/memos/${id}${qs({ userId })}`, {
    method: "DELETE",
  }).then(json);

export const addMemoItems = (userId, memoId, items) =>
  fetch(`${API_BASE}/api/memos/${memoId}/items${qs({ userId })}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, items }),
  }).then(json);

export const updateMemoItem = (userId, memoId, itemId, payload) =>
  fetch(`${API_BASE}/api/memos/${memoId}/items/${itemId}${qs({ userId })}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ...payload }),
  }).then(json);

export const deleteMemoItem = (userId, memoId, itemId) =>
  fetch(`${API_BASE}/api/memos/${memoId}/items/${itemId}${qs({ userId })}`, {
    method: "DELETE",
  }).then(json);

export const issueMemo = (userId, memoId) =>
  fetch(`${API_BASE}/api/memos/${memoId}/issue${qs({ userId })}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  }).then(json);

export const closeMemo = (userId, memoId) =>
  fetch(`${API_BASE}/api/memos/${memoId}/close${qs({ userId })}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  }).then(json);

/* Returns { byStoneSku: { SKU: { memoId, memoNumber, companyId, companyName } }, byJewelrySku: {...} }
 * Used by the inventory page to flag items currently on an active memo. */
export const fetchActiveMemoSkus = (userId) =>
  fetch(`${API_BASE}/api/memos/active-skus${qs({ userId })}`).then(json);

/* Activity feed for a single memo (issued / item sold / item returned / etc.) */
export const fetchMemoActivity = (userId, memoId) =>
  fetch(`${API_BASE}/api/memos/${memoId}/activity${qs({ userId })}`).then(json);

/**
 * Memo statuses, with an optional `portalLabel` override.
 *
 * The DB stores a canonical, supplier-perspective value (`out`) — this
 * is what cron jobs, queries, and the supplier UI rely on. But "Out"
 * is the wrong word from the store's perspective: from the store's
 * point of view the items came IN to their consignment shelf, they
 * didn't go anywhere. So the store portal renders `portalLabel` when
 * defined, falling back to `label` otherwise.
 *
 * Only `out` gets re-labeled — the other states (`partial`, `closed`,
 * `expired`) describe what happened to the memo, not its direction,
 * and read identically from either side.
 */
export const MEMO_STATUSES = [
  { value: "draft",               label: "Draft",                color: "bg-stone-100 text-stone-700 border-stone-200" },
  { value: "out",                 label: "Out",     portalLabel: "In", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "partially_returned",  label: "Partial",              color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "closed",              label: "Closed",               color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "expired",             label: "Expired",              color: "bg-rose-100 text-rose-700 border-rose-200" },
];

export const ITEM_STATUSES = [
  { value: "out",       label: "On memo",   color: "bg-blue-100 text-blue-700" },
  { value: "returned",  label: "Returned",  color: "bg-stone-100 text-stone-700" },
  { value: "sold",      label: "Sold",      color: "bg-emerald-100 text-emerald-700" },
];

/** Treat a memo as "expired-equivalent" if its due_at is past and it's still out. */
export const isMemoEffectivelyExpired = (memo) => {
  if (!memo?.due_at) return false;
  if (memo.status === 'closed' || memo.status === 'expired') return memo.status === 'expired';
  if (memo.status !== 'out' && memo.status !== 'partially_returned') return false;
  return new Date(memo.due_at).getTime() < Date.now();
};
