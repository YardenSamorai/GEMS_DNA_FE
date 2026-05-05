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

const qs = (params) => {
  const cleaned = Object.fromEntries(
    Object.entries(params || {}).filter(
      ([, v]) => v !== undefined && v !== null && v !== ""
    )
  );
  const str = new URLSearchParams(cleaned).toString();
  return str ? `?${str}` : "";
};

const jsonHeaders = { "Content-Type": "application/json" };

/* ---------- Jewelry Items ---------- */

export const fetchJewelryItems = (userId, filters = {}) =>
  fetch(`${API_BASE}/api/jewelry-items${qs({ userId, ...filters })}`).then(json);

export const fetchJewelryItem = (id) =>
  fetch(`${API_BASE}/api/jewelry-items/${id}`).then(json);

export const createJewelryItem = (payload) =>
  fetch(`${API_BASE}/api/jewelry-items`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  }).then(json);

export const createJewelryItemFromTemplate = (payload) =>
  fetch(`${API_BASE}/api/jewelry-items/from-template`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  }).then(json);

// Public catalog (jewelry_products table populated from WooCommerce). Returns
// a `{ jewelry: [...] }` shape; rows have `model_number`, `title`, `price`
// (encrypted), `all_pictures_link`, etc.
export const fetchJewelryCatalog = () =>
  fetch(`${API_BASE}/api/jewelry`).then(json);

export const updateJewelryItem = (id, payload) =>
  fetch(`${API_BASE}/api/jewelry-items/${id}`, {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  }).then(json);

export const deleteJewelryItem = (id) =>
  fetch(`${API_BASE}/api/jewelry-items/${id}`, { method: "DELETE" }).then(json);

export const changeJewelryStatus = (id, payload) =>
  fetch(`${API_BASE}/api/jewelry-items/${id}/status`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  }).then(json);

/* ---------- Files ---------- */

export const registerJewelryFile = (id, payload) =>
  fetch(`${API_BASE}/api/jewelry-items/${id}/files`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  }).then(json);

export const deleteJewelryFile = (id, fileId) =>
  fetch(`${API_BASE}/api/jewelry-items/${id}/files/${fileId}`, {
    method: "DELETE",
  }).then(json);

export const uploadBlob = (file, folder = "jewelry") => {
  const fd = new FormData();
  fd.append("file", file);
  return fetch(`${API_BASE}/api/blob/upload?folder=${folder}`, {
    method: "POST",
    body: fd,
  }).then(json);
};

/* ---------- Stones / Metals / Costs ---------- */

export const addJewelryStone = (id, payload) =>
  fetch(`${API_BASE}/api/jewelry-items/${id}/stones`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  }).then(json);

// Batch add — wraps the same endpoint with a `stones: [...]` payload so the
// queue UI in StonesPanel can submit several picks (and same-SKU splits) in a
// single round trip. The BE inserts atomically: any conflict aborts the batch.
export const addJewelryStones = (id, stones) =>
  fetch(`${API_BASE}/api/jewelry-items/${id}/stones`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ stones }),
  }).then(json);

export const removeJewelryStone = (id, stoneId) =>
  fetch(`${API_BASE}/api/jewelry-items/${id}/stones/${stoneId}`, {
    method: "DELETE",
  }).then(json);

export const addJewelryMetal = (id, payload) =>
  fetch(`${API_BASE}/api/jewelry-items/${id}/metals`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  }).then(json);

export const removeJewelryMetal = (id, metalId) =>
  fetch(`${API_BASE}/api/jewelry-items/${id}/metals/${metalId}`, {
    method: "DELETE",
  }).then(json);

export const addJewelryCost = (id, payload) =>
  fetch(`${API_BASE}/api/jewelry-items/${id}/costs`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  }).then(json);

export const removeJewelryCost = (id, costId) =>
  fetch(`${API_BASE}/api/jewelry-items/${id}/costs/${costId}`, {
    method: "DELETE",
  }).then(json);

export const recalcJewelryItem = (id) =>
  fetch(`${API_BASE}/api/jewelry-items/${id}/recalc`, {
    method: "POST",
    headers: jsonHeaders,
  }).then(json);

export const sellJewelryItem = (id, payload) =>
  fetch(`${API_BASE}/api/jewelry-items/${id}/sell`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  }).then(json);

/* ---------- Customer Preview: Shares + AI Mockups ----------
 * The 3D-Preview tab has been retired in favour of a customer-facing flow:
 *   - Share links: workshop generates a public URL with an opaque token
 *     so the client can view the piece + approve / request changes /
 *     comment, without ever signing in.
 *   - AI mockups: prompt-driven photoreal renders via OpenAI's gpt-image-1,
 *     stored on the item exactly like any uploaded photo.
 * The public-side helpers (fetchPublicShare, respondToShare) hit the BE
 * without auth headers — they're consumed by /share/:token, not the app.
 */

export const listJewelryShares = (id) =>
  fetch(`${API_BASE}/api/jewelry-items/${id}/shares`).then(json);

export const createJewelryShare = (id, payload = {}) =>
  fetch(`${API_BASE}/api/jewelry-items/${id}/shares`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  }).then(json);

export const revokeJewelryShare = (id, shareId) =>
  fetch(`${API_BASE}/api/jewelry-items/${id}/shares/${shareId}`, {
    method: "DELETE",
  }).then(json);

export const listJewelryShareResponses = (id) =>
  fetch(`${API_BASE}/api/jewelry-items/${id}/share-responses`).then(json);

export const generateAiMockup = (id, payload) =>
  fetch(`${API_BASE}/api/jewelry-items/${id}/ai-mockup`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  }).then(json);

// Public-side helpers used by the unauthenticated /share/:token page.
export const fetchPublicShare = (token) =>
  fetch(`${API_BASE}/api/share/${token}`).then(json);

export const respondToShare = (token, payload) =>
  fetch(`${API_BASE}/api/share/${token}/respond`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  }).then(json);

/* ---------- Constants ---------- */

export const JEWELRY_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "design", label: "Design" },
  { value: "cad", label: "CAD" },
  { value: "wax", label: "Wax / Mold" },
  { value: "casting", label: "Casting" },
  { value: "setting", label: "Stone Setting" },
  { value: "polishing", label: "Polishing" },
  { value: "qc", label: "QC" },
  { value: "ready", label: "Ready" },
  { value: "sold", label: "Sold" },
  { value: "archived", label: "Archived" },
];

export const JEWELRY_TYPES = [
  { value: "custom", label: "Custom Order" },
  { value: "stock", label: "Stock" },
];

export const JEWELRY_CATEGORIES = [
  "Ring",
  "Necklace",
  "Earrings",
  "Bracelet",
  "Pendant",
  "Brooch",
  "Cufflinks",
  "Other",
];

export const FILE_KINDS = [
  { value: "sketch", label: "Sketch" },
  { value: "cad", label: "CAD" },
  { value: "ai_mockup", label: "AI mockup" },
  { value: "progress", label: "Progress photo" },
  { value: "final", label: "Final photo" },
  { value: "video", label: "Video" },
  { value: "cert", label: "Certificate" },
];
