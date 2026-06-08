// Stone Offers API — anonymous, salesperson-curated stone selections shared
// with a buyer via an opaque link. Mirrors the conventions in jewelryApi.js:
// `userId` is passed through query/body and the BE resolves the actor/team
// context from it. The public helpers (fetchPublicOffer / respondToOffer /
// trackOffer) hit the unauthenticated /api/public/offer endpoints consumed by
// the buyer-facing /o/:token page — never the app.

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

/* ---------- Authenticated (salesperson) ---------- */

// payload: { userId, alias, contactPhone, buyerLabel, title, showCertificate,
//            hideSku, expiresAt, items: [{ sku, price, priceMode, availability }] }
export const createOffer = (payload) =>
  fetch(`${API_BASE}/api/offers`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  }).then(json);

export const fetchOffers = (userId) =>
  fetch(`${API_BASE}/api/offers${qs({ userId })}`).then(json);

export const fetchOffer = (id, userId) =>
  fetch(`${API_BASE}/api/offers/${id}${qs({ userId })}`).then(json);

// payload: { userId, ...offerFields, items?: [{ id, price, priceMode, availability, position }] }
export const updateOffer = (id, payload) =>
  fetch(`${API_BASE}/api/offers/${id}`, {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  }).then(json);

export const revokeOffer = (id, userId) =>
  fetch(`${API_BASE}/api/offers/${id}/revoke`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ userId }),
  }).then(json);

/* ---------- Public (no auth) — consumed by /o/:token ---------- */

export const fetchPublicOffer = (token) =>
  fetch(`${API_BASE}/api/public/offer/${token}`).then(json);

export const respondToOffer = (token, payload) =>
  fetch(`${API_BASE}/api/public/offer/${token}/respond`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  }).then(json);

// Fire-and-forget view analytics. Never throws — tracking must not break the page.
export const trackOffer = (token, type, offerItemId = null) => {
  try {
    fetch(`${API_BASE}/api/public/offer/${token}/track`, {
      method: "POST",
      headers: jsonHeaders,
      keepalive: true,
      body: JSON.stringify({ type, offerItemId }),
    }).catch(() => {});
  } catch (_) {}
};

// The public buyer link for an offer token. Currently a clean path on the app
// host; swap to a neutral domain here when one is provisioned (phase 2).
export const offerPublicUrl = (token) =>
  `${window.location.origin}/o/${token}`;
