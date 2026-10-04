const API_BASE = process.env.REACT_APP_API_URL || "https://gems-dna-be.onrender.com";
const BASE = `${API_BASE}/api/api-keys`;

const json = async (res) => {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return body;
};

export const fetchApiKeys = () => fetch(BASE).then(json);

export const createApiKey = (name) =>
  fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  }).then(json);

export const revokeApiKey = (id) => fetch(`${BASE}/${id}`, { method: "DELETE" }).then(json);
