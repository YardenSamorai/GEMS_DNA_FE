/* Rep-activity client — talks to the BE tracking endpoints.
 *
 *   sendActivity(user, events) → POST /api/activity-events  (batch, beacon)
 *   sendHeartbeat(user)        → POST /api/heartbeat        (presence ping)
 *   fetchTeamActivity(user)    → GET  /api/team/activity     (manager view)
 *
 * Writes prefer navigator.sendBeacon so they survive page unloads and never
 * block the UI. Beacons can't set headers, so the actor identity is carried in
 * the JSON body (resolveTeamContext on the BE reads userId/userEmail/actorName
 * from the body as a fallback to the x-actor-* headers).
 */

const API_BASE =
  process.env.REACT_APP_API_URL || "https://gems-dna-be.onrender.com";

const teamHeaders = (user) => ({
  "Content-Type": "application/json",
  ...(user?.id ? { "x-actor-id": user.id } : {}),
  ...(user?.email ? { "x-actor-email": user.email } : {}),
  ...(user?.name ? { "x-actor-name": user.name } : {}),
});

const actorBody = (user) => ({
  userId: user?.id || null,
  userEmail: user?.email || null,
  actorName: user?.name || null,
});

/* Fire-and-forget POST with a JSON body. Uses sendBeacon when available so the
 * request still goes out during pagehide/visibilitychange. */
const beaconPost = (url, payload, user) => {
  const body = JSON.stringify(payload);
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      // text/plain is CORS-safelisted → no preflight (beacons can't preflight).
      // The BE parses the JSON string back into an object.
      const blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
      if (navigator.sendBeacon(url, blob)) return;
    }
  } catch (_) {
    /* fall through to fetch */
  }
  try {
    fetch(url, {
      method: "POST",
      headers: teamHeaders(user),
      body,
      keepalive: true,
    }).catch(() => {});
  } catch (_) {
    /* ignore — tracking must never throw */
  }
};

export const sendActivity = (user, events) => {
  const list = (Array.isArray(events) ? events : [events]).filter(Boolean);
  if (!user?.id || !list.length) return;
  beaconPost(`${API_BASE}/api/activity-events`, { ...actorBody(user), events: list }, user);
};

export const sendHeartbeat = (user) => {
  if (!user?.id) return;
  beaconPost(`${API_BASE}/api/heartbeat`, actorBody(user), user);
};

const getJson = (url, user) =>
  fetch(url, { headers: teamHeaders(user) }).then(async (res) => {
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return res.json();
  });

export const fetchTeamActivity = (user, opts = {}) => {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  const qs = params.toString() ? `?${params.toString()}` : "";
  return getJson(`${API_BASE}/api/team/activity${qs}`, user);
};

export const fetchRepActivity = (user, actorId, opts = {}) => {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  const qs = params.toString() ? `?${params.toString()}` : "";
  return getJson(`${API_BASE}/api/team/rep/${encodeURIComponent(actorId)}${qs}`, user);
};
