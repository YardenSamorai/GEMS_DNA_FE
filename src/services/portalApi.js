/**
 * Store Portal API helpers — Sprint 4 / Phase 3.
 *
 * The portal is the read-mostly surface that retail-store users
 * (role = 'store_user') see when they log in. It is intentionally
 * narrow:
 *
 *   /api/portal/me                                       — who am I + my store
 *   /api/portal/memos                                    — every memo this store has
 *   /api/portal/memos/:id                                — full memo + items
 *   /api/portal/memos/:id/items/:itemId/request          — request sold / return
 *   /api/portal/memos/:id/items/:itemId/cancel-request   — retract a pending request
 *
 * The store user's bearer userId is sent through Clerk; that's the
 * only credential — the BE resolveTeamContext maps it to a
 * team_members row and from there to a single company.
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

export const fetchPortalMe = (userId) =>
  fetch(`${API_BASE}/api/portal/me${qs({ userId })}`).then(json);

export const fetchPortalMemos = (userId, filters = {}) =>
  fetch(`${API_BASE}/api/portal/memos${qs({ userId, ...filters })}`).then(json);

export const fetchPortalMemo = (userId, memoId) =>
  fetch(`${API_BASE}/api/portal/memos/${memoId}${qs({ userId })}`).then(json);

/** Stage a 'sold' or 'returned' request on a memo item.
 *  The owner approves or declines from the main app.
 *  kind: 'sold' | 'returned' */
export const requestMemoItemAction = (userId, memoId, itemId, kind, note = null) =>
  fetch(`${API_BASE}/api/portal/memos/${memoId}/items/${itemId}/request${qs({ userId })}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, kind, note }),
  }).then(json);

/** Retract a pending request before the owner has acted on it. */
export const cancelMemoItemRequest = (userId, memoId, itemId) =>
  fetch(`${API_BASE}/api/portal/memos/${memoId}/items/${itemId}/cancel-request${qs({ userId })}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  }).then(json);

/* --- owner-side approval helpers (live on /api/memos/:id/items/:itemId/...) --- */

export const approveMemoItemRequest = (userId, memoId, itemId) =>
  fetch(`${API_BASE}/api/memos/${memoId}/items/${itemId}/approve${qs({ userId })}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  }).then(json);

export const declineMemoItemRequest = (userId, memoId, itemId, reason = null) =>
  fetch(`${API_BASE}/api/memos/${memoId}/items/${itemId}/decline${qs({ userId })}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, reason }),
  }).then(json);
