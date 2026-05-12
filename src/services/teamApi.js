/**
 * Team / Sales-Rep API helpers (Sprint 3).
 *
 * These wrap the BE /api/team/* endpoints. Every request carries:
 *   - userId: the Clerk id of the signed-in user (treated as the *actor*)
 *   - userEmail: lets the BE link a rep to a pre-created member row by email
 *
 * The BE figures out which workspace the actor belongs to (via team_members)
 * and applies role-based visibility automatically. Callers don't need to
 * worry about owner-vs-rep at the API layer.
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

const authHeaders = (user) => ({
  "Content-Type": "application/json",
  ...(user?.id ? { "x-actor-id": user.id } : {}),
  ...(user?.email ? { "x-actor-email": user.email } : {}),
  ...(user?.name ? { "x-actor-name": user.name } : {}),
});

/* GET /api/team/me — bootstrap call. Returns:
 * { me, members, tenantUserId, actorUserId, role, isOwner } */
export const fetchTeamMe = (user) =>
  fetch(`${API_BASE}/api/team/me${qs({ userId: user?.id, userEmail: user?.email })}`, {
    headers: authHeaders(user),
  }).then(json);

export const fetchTeamMembers = (user) =>
  fetch(`${API_BASE}/api/team/members${qs({ userId: user?.id, userEmail: user?.email })}`, {
    headers: authHeaders(user),
  }).then(json);

export const inviteTeamMember = (user, payload) =>
  fetch(`${API_BASE}/api/team/members${qs({ userId: user?.id, userEmail: user?.email })}`, {
    method: "POST",
    headers: authHeaders(user),
    body: JSON.stringify(payload),
  }).then(json);

export const updateTeamMember = (user, memberId, payload) =>
  fetch(`${API_BASE}/api/team/members/${memberId}${qs({ userId: user?.id, userEmail: user?.email })}`, {
    method: "PUT",
    headers: authHeaders(user),
    body: JSON.stringify(payload),
  }).then(json);

export const removeTeamMember = (user, memberId) =>
  fetch(`${API_BASE}/api/team/members/${memberId}${qs({ userId: user?.id, userEmail: user?.email })}`, {
    method: "DELETE",
    headers: authHeaders(user),
  }).then(json);

/* POST /api/team/members/:id/resend-invite
 * Owner-only. Re-sends the invite email and bumps the row's last_invited_at. */
export const resendTeamInvite = (user, memberId) =>
  fetch(
    `${API_BASE}/api/team/members/${memberId}/resend-invite${qs({ userId: user?.id, userEmail: user?.email })}`,
    {
      method: "POST",
      headers: authHeaders(user),
    }
  ).then(json);

export const fetchTeamLeaderboard = (user) =>
  fetch(`${API_BASE}/api/team/leaderboard${qs({ userId: user?.id, userEmail: user?.email })}`, {
    headers: authHeaders(user),
  }).then(json);

/* Tiny helper used by avatar/filter components — get a deterministic color
 * even before /api/team/me has resolved (e.g. an "unknown" assignee). */
const FALLBACK_PALETTE = [
  "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
];
export const colorFromSeed = (seed) => {
  let h = 0;
  for (const ch of String(seed || "")) h = ((h << 5) - h + ch.charCodeAt(0)) | 0;
  return FALLBACK_PALETTE[Math.abs(h) % FALLBACK_PALETTE.length];
};

/* Initials for an avatar bubble. "John Smith" → "JS", "Liora" → "L". */
export const initialsFromName = (name) => {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0] || "").join("").toUpperCase() || "?";
};
