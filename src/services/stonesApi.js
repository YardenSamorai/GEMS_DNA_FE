/* Lightweight client for stone-inventory cross-system endpoints.
 * Most stone reads still go through the inline fetches in inventory/index.js
 * (which talks to /api/soap-stones). This file only wraps the new bridging
 * endpoints so the rest of the app can ask "where is this stone?" cleanly.
 */

const API_BASE =
  process.env.REACT_APP_API_URL || "https://gems-dna-be.onrender.com";

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

/* GET /api/stones/:sku/usage
 *   -> { sku, current_status, jewelry_items[], dna_inquiries[], deals[] }
 *
 * Powers the "Used in / Inquired by" panel on the stone detail and inventory
 * drawer. Resolves to "available" when nothing references the SKU.
 */
export const fetchStoneUsage = (sku) =>
  fetch(`${API_BASE}/api/stones/${encodeURIComponent(sku)}/usage`).then(json);

/* GET /api/stones/inventory-status
 *   -> { statuses: { [sku]: { status, jewelry_item_id, jewelry_sku, ... } } }
 *
 * Bulk lookup. Inventory list calls this once on load and merges with the
 * stones array client-side. SKUs not in the map are treated as 'available'.
 */
export const fetchStoneInventoryStatus = () =>
  fetch(`${API_BASE}/api/stones/inventory-status`).then(json);

/* Display labels for inventory_status values. */
export const STONE_STATUS_LABELS = {
  available: "Available",
  reserved: "Reserved",
  set: "In setting",
  sold: "Sold",
  returned: "Returned",
};

/* Tailwind class hints for status pills (light theme). */
export const STONE_STATUS_PILL = {
  available: "bg-emerald-50 text-emerald-700 border-emerald-200",
  reserved: "bg-amber-50 text-amber-700 border-amber-200",
  set: "bg-violet-50 text-violet-700 border-violet-200",
  sold: "bg-stone-100 text-stone-600 border-stone-300",
  returned: "bg-stone-50 text-stone-500 border-stone-200",
};

/* Auth headers — same convention as services/teamApi.js so the BE can
 * resolve which workshop + role the actor belongs to. Reps see only their
 * own + unassigned stones automatically.
 */
const teamHeaders = (user) => ({
  "Content-Type": "application/json",
  ...(user?.id ? { "x-actor-id": user.id } : {}),
  ...(user?.email ? { "x-actor-email": user.email } : {}),
  ...(user?.name ? { "x-actor-name": user.name } : {}),
});

/* GET /api/soap-stones
 *   ?assignedTo=all|me|unassigned|<clerk_user_id>
 *
 * Returns { stones: [...] } where each stone now carries:
 *   assignedTo, assignedBy, assignmentNotes, assignmentUpdated.
 * Reps are silently scoped to their own + unassigned regardless of the
 * filter, so the UI can always pass the user-selected filter without
 * worrying about leaking other reps' piles.
 */
export const fetchSoapStones = (user, opts = {}) => {
  const params = new URLSearchParams();
  if (user?.id) params.set("userId", user.id);
  if (user?.email) params.set("userEmail", user.email);
  if (opts.assignedTo) params.set("assignedTo", opts.assignedTo);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return fetch(`${API_BASE}/api/soap-stones${qs}`, {
    headers: teamHeaders(user),
  }).then(json);
};

/* POST /api/stones/:sku/assign
 *   body: { assignedTo: <clerk_user_id> | null | "me", notes?: string }
 *
 * Returns { success: true, assignment }. Use null/"" to release a stone
 * back to the unassigned pool. Reps can only claim/release their own.
 */
export const assignStone = (user, sku, payload) =>
  fetch(`${API_BASE}/api/stones/${encodeURIComponent(sku)}/assign`, {
    method: "POST",
    headers: teamHeaders(user),
    body: JSON.stringify({
      assignedTo: payload?.assignedTo === undefined ? null : payload.assignedTo,
      notes:      payload?.notes ?? null,
    }),
  }).then(json);
