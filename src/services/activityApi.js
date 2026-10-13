/* Rep-activity client — talks to the BE tracking endpoints.
 *
 *   sendActivity(user, events) → POST /api/activity-events  (batch, beacon)
 *   sendHeartbeat(user)        → POST /api/heartbeat        (presence ping)
 *   fetchTeamActivity(user)    → GET  /api/team/activity     (manager view)
 *
 * Writes are fire-and-forget keepalive fetches, so they survive page unloads
 * and never block the UI. The BE identifies the rep only from the verified
 * session token, which the global fetch wrapper attaches — sendBeacon can't
 * carry it, so it isn't used.
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

/* Fire-and-forget POST with a JSON body. keepalive lets it finish during
 * pagehide/visibilitychange. */
const beaconPost = (url, payload, user) => {
  try {
    fetch(url, {
      method: "POST",
      headers: teamHeaders(user),
      body: JSON.stringify(payload),
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

/* opts: { limit, before, after }
 *   before → older page (Load more), after → only newer events (incremental). */
export const fetchTeamActivity = (user, opts = {}) => {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.before != null) params.set("before", String(opts.before));
  if (opts.after != null) params.set("after", String(opts.after));
  if (opts.repsOnly) params.set("repsOnly", "1");
  const qs = params.toString() ? `?${params.toString()}` : "";
  return getJson(`${API_BASE}/api/team/activity${qs}`, user);
};

/* opts: { limit, before } — before fetches the next older page. */
export const fetchRepActivity = (user, actorId, opts = {}) => {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.before != null) params.set("before", String(opts.before));
  const qs = params.toString() ? `?${params.toString()}` : "";
  return getJson(`${API_BASE}/api/team/rep/${encodeURIComponent(actorId)}${qs}`, user);
};
