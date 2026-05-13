/**
 * Companies (retail-store / wholesale partner) API helpers — Sprint 4.
 *
 * A "company" is the parent entity for a retail store. Several CRM
 * contacts can belong to the same company (owner / manager / staff),
 * and memos are issued to a company, not a single person.
 *
 * Every endpoint forwards `userId` so the BE can resolve the workspace
 * owner and apply rep-vs-owner visibility rules consistently.
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

export const fetchCompanies = (userId, filters = {}) =>
  fetch(`${API_BASE}/api/crm/companies${qs({ userId, ...filters })}`).then(json);

export const fetchCompany = (userId, id) =>
  fetch(`${API_BASE}/api/crm/companies/${id}${qs({ userId })}`).then(json);

export const createCompany = (userId, payload) =>
  fetch(`${API_BASE}/api/crm/companies${qs({ userId })}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ...payload }),
  }).then(json);

export const updateCompany = (userId, id, payload) =>
  fetch(`${API_BASE}/api/crm/companies/${id}${qs({ userId })}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ...payload }),
  }).then(json);

export const deleteCompany = (userId, id) =>
  fetch(`${API_BASE}/api/crm/companies/${id}${qs({ userId })}`, {
    method: "DELETE",
  }).then(json);

export const COMPANY_TYPES = [
  { value: "retail_store", label: "Retail Store",  color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "wholesaler",   label: "Wholesaler",    color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "partner",      label: "Partner",       color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "online",       label: "Online",        color: "bg-amber-100 text-amber-700 border-amber-200" },
];

export const PAYMENT_TERMS = [
  { value: "on_delivery", label: "On delivery" },
  { value: "net_15",      label: "Net 15" },
  { value: "net_30",      label: "Net 30" },
  { value: "net_60",      label: "Net 60" },
  { value: "consignment", label: "Consignment only" },
];
