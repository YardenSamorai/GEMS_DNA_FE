/**
 * Single-active-session helpers.
 *
 * Called from the login sheet right after authentication completes but before
 * the new session is activated, to enforce "one active session per user":
 * the user is warned if they're already signed in elsewhere and can take over
 * (sign out the other device) or cancel.
 *
 * These run before `setActive`, so there is no Clerk session token yet; the
 * backend authorizes by the freshly-created, still-active session id.
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

/* -> { count, others: [{ id, label }] } */
export const fetchSessionPeers = (sessionId) =>
  post("/api/auth/sessions/peers", { sessionId });

/* Revoke every other active session for this user. -> { ok, revoked } */
export const revokeOtherSessions = (sessionId) =>
  post("/api/auth/sessions/revoke-others", { sessionId });

/* Revoke a single session (used on cancel). -> { ok } */
export const revokeSession = (sessionId) =>
  post("/api/auth/sessions/revoke", { sessionId });
