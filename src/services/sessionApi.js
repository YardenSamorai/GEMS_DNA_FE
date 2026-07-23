/**
 * Concurrent-session helpers (max 2 active Clerk sessions per user).
 *
 * Called from the login sheet right after authentication completes but before
 * the new session is activated, and again from a signed-in guard (covers
 * Google OAuth which skips the login sheet). Excess oldest sessions are
 * revoked automatically so phone + computer can both stay signed in.
 *
 * Pre-activate calls have no Clerk session token yet; the backend authorizes
 * by the freshly-created, still-active session id. Post-activate calls also
 * send a Bearer JWT via the global fetch interceptor.
 */
const API_BASE =
  process.env.REACT_APP_API_URL || "https://gems-dna-be.onrender.com";

const post = async (path, body) => {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
};

/* -> { count, others: [{ id, label }], max } */
export const fetchSessionPeers = (sessionId) =>
  post("/api/auth/sessions/peers", { sessionId });

/* Enforce max-2 policy: revoke oldest excess. -> { ok, revoked, kept, max } */
export const enforceSessionLimit = (sessionId) =>
  post("/api/auth/sessions/enforce-limit", { sessionId });

/* Legacy: revoke every other active session. -> { ok, revoked } */
export const revokeOtherSessions = (sessionId) =>
  post("/api/auth/sessions/revoke-others", { sessionId });

/* Revoke a single session. -> { ok } */
export const revokeSession = (sessionId) =>
  post("/api/auth/sessions/revoke", { sessionId });
