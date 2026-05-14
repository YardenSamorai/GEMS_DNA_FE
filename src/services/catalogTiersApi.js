/**
 * Catalog Tiers API helpers (owner-side).
 *
 * The supplier curates "tiers" (Public, VIP Bridal, Israel Exclusive...),
 * fills them with stones / jewelry SKUs, and subscribes specific stores
 * to each tier. The store-portal catalog endpoint then only exposes
 * SKUs that fall inside at least one tier the requesting store is
 * subscribed to. New SKUs land in zero tiers by default — invisible to
 * every store until the supplier explicitly approves them.
 *
 *   GET    /api/catalog-tiers                     — list with counts
 *   POST   /api/catalog-tiers                     — create
 *   GET    /api/catalog-tiers/:id                 — detail (items + companies)
 *   PUT    /api/catalog-tiers/:id                 — rename / re-color
 *   DELETE /api/catalog-tiers/:id
 *   POST   /api/catalog-tiers/:id/items           — { items: [{type,sku}] }
 *   DELETE /api/catalog-tiers/:id/items           — { items: [{type,sku}] }
 *   POST   /api/catalog-tiers/:id/companies       — { company_ids: [...] }
 *   DELETE /api/catalog-tiers/:id/companies       — { company_ids: [...] }
 *   GET    /api/items/:type/:sku/tiers            — tiers an item is in
 *   PUT    /api/items/:type/:sku/tiers            — { tier_ids: [...] }
 *   GET    /api/companies/:id/tiers               — tiers a store sees
 *   PUT    /api/companies/:id/tiers               — { tier_ids: [...] }
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

const jsonHeaders = { "Content-Type": "application/json" };

/* ─────────────────── Tier CRUD ─────────────────── */

export const fetchCatalogTiers = (userId) =>
  fetch(`${API_BASE}/api/catalog-tiers${qs({ userId })}`).then(json);

export const fetchCatalogTier = (userId, tierId) =>
  fetch(`${API_BASE}/api/catalog-tiers/${tierId}${qs({ userId })}`).then(json);

export const createCatalogTier = (userId, payload) =>
  fetch(`${API_BASE}/api/catalog-tiers${qs({ userId })}`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload || {}),
  }).then(json);

export const updateCatalogTier = (userId, tierId, payload) =>
  fetch(`${API_BASE}/api/catalog-tiers/${tierId}${qs({ userId })}`, {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(payload || {}),
  }).then(json);

export const deleteCatalogTier = (userId, tierId) =>
  fetch(`${API_BASE}/api/catalog-tiers/${tierId}${qs({ userId })}`, {
    method: "DELETE",
  }).then(json);

/* ─────────────────── Items in tier ─────────────────── */

export const addItemsToTier = (userId, tierId, items) =>
  fetch(`${API_BASE}/api/catalog-tiers/${tierId}/items${qs({ userId })}`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ items }),
  }).then(json);

export const removeItemsFromTier = (userId, tierId, items) =>
  fetch(`${API_BASE}/api/catalog-tiers/${tierId}/items${qs({ userId })}`, {
    method: "DELETE",
    headers: jsonHeaders,
    body: JSON.stringify({ items }),
  }).then(json);

/* ─────────────────── Companies in tier ─────────────────── */

export const addCompaniesToTier = (userId, tierId, companyIds) =>
  fetch(`${API_BASE}/api/catalog-tiers/${tierId}/companies${qs({ userId })}`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ company_ids: companyIds }),
  }).then(json);

export const removeCompaniesFromTier = (userId, tierId, companyIds) =>
  fetch(`${API_BASE}/api/catalog-tiers/${tierId}/companies${qs({ userId })}`, {
    method: "DELETE",
    headers: jsonHeaders,
    body: JSON.stringify({ company_ids: companyIds }),
  }).then(json);

/* ─────────────────── Per-item & per-company helpers ─────────────────── */

export const fetchItemTiers = (userId, type, sku) =>
  fetch(`${API_BASE}/api/items/${type}/${encodeURIComponent(sku)}/tiers${qs({ userId })}`).then(json);

export const setItemTiers = (userId, type, sku, tierIds) =>
  fetch(`${API_BASE}/api/items/${type}/${encodeURIComponent(sku)}/tiers${qs({ userId })}`, {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify({ tier_ids: tierIds }),
  }).then(json);

export const fetchCompanyTiers = (userId, companyId) =>
  fetch(`${API_BASE}/api/companies/${companyId}/tiers${qs({ userId })}`).then(json);

export const setCompanyTiers = (userId, companyId, tierIds) =>
  fetch(`${API_BASE}/api/companies/${companyId}/tiers${qs({ userId })}`, {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify({ tier_ids: tierIds }),
  }).then(json);
