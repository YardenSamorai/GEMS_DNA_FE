const API_BASE = process.env.REACT_APP_API_URL || "https://gems-dna-be.onrender.com";
const BASE = `${API_BASE}/api/presentations`;

const json = async (res) => {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return body;
};

const send = (method, url, payload) =>
  fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  }).then(json);

export const fetchPresentations = () => fetch(BASE).then(json).then((b) => b.presentations || []);

export const fetchPresentation = (id) => fetch(`${BASE}/${encodeURIComponent(id)}`).then(json);

/* { name, items, settings, shared } — items are the showcase's references
 * (a stone SKU, or "j:" and a jewelry model number). */
export const createPresentation = (data) => send("POST", BASE, data);

export const updatePresentation = (id, changes) => send("PATCH", `${BASE}/${encodeURIComponent(id)}`, changes);

export const deletePresentation = (id) => send("DELETE", `${BASE}/${encodeURIComponent(id)}`);
