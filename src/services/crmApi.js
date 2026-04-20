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

/* ---------- Contacts ---------- */
export const fetchContacts = (userId, filters = {}) =>
  fetch(`${API_BASE}/api/crm/contacts${qs({ userId, ...filters })}`).then(json);

export const fetchContact = (userId, id) =>
  fetch(`${API_BASE}/api/crm/contacts/${id}${qs({ userId })}`).then(json);

export const createContact = (payload) =>
  fetch(`${API_BASE}/api/crm/contacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(json);

export const updateContact = (id, payload) =>
  fetch(`${API_BASE}/api/crm/contacts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(json);

export const deleteContact = (id) =>
  fetch(`${API_BASE}/api/crm/contacts/${id}`, { method: "DELETE" }).then(json);

export const bulkDeleteContacts = (userId, ids) =>
  fetch(`${API_BASE}/api/crm/contacts/bulk-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ids }),
  }).then(json);

export const bulkTagContacts = (userId, ids, tag, action) =>
  fetch(`${API_BASE}/api/crm/contacts/bulk-tag`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ids, tag, action }),
  }).then(json);

export const fetchTags = (userId) =>
  fetch(`${API_BASE}/api/crm/tags${qs({ userId })}`).then(json);

/* ---------- Interactions ---------- */
export const createInteraction = (payload) =>
  fetch(`${API_BASE}/api/crm/interactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(json);

export const deleteInteraction = (id) =>
  fetch(`${API_BASE}/api/crm/interactions/${id}`, { method: "DELETE" }).then(json);

/* ---------- Deals ---------- */
export const fetchDeals = (userId, filters = {}) =>
  fetch(`${API_BASE}/api/crm/deals${qs({ userId, ...filters })}`).then(json);

export const fetchDeal = (id) =>
  fetch(`${API_BASE}/api/crm/deals/${id}`).then(json);

export const createDeal = (payload) =>
  fetch(`${API_BASE}/api/crm/deals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(json);

export const updateDeal = (id, payload) =>
  fetch(`${API_BASE}/api/crm/deals/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(json);

export const deleteDeal = (id) =>
  fetch(`${API_BASE}/api/crm/deals/${id}`, { method: "DELETE" }).then(json);

export const addDealItems = (dealId, items) =>
  fetch(`${API_BASE}/api/crm/deals/${dealId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  }).then(json);

export const updateDealItem = (itemId, payload) =>
  fetch(`${API_BASE}/api/crm/deal-items/${itemId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(json);

export const deleteDealItem = (itemId) =>
  fetch(`${API_BASE}/api/crm/deal-items/${itemId}`, { method: "DELETE" }).then(json);

/* ---------- Tasks ---------- */
export const fetchTasks = (userId, filters = {}) =>
  fetch(`${API_BASE}/api/crm/tasks${qs({ userId, ...filters })}`).then(json);

export const createTask = (payload) =>
  fetch(`${API_BASE}/api/crm/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(json);

export const updateTask = (id, payload) =>
  fetch(`${API_BASE}/api/crm/tasks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(json);

export const deleteTask = (id) =>
  fetch(`${API_BASE}/api/crm/tasks/${id}`, { method: "DELETE" }).then(json);

/* ---------- WhatsApp log ---------- */
export const logWhatsapp = (payload) =>
  fetch(`${API_BASE}/api/crm/whatsapp-log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(json);

export const fetchWhatsappLog = (userId, filters = {}) =>
  fetch(`${API_BASE}/api/crm/whatsapp-log${qs({ userId, ...filters })}`).then(json);

/* ---------- Stats ---------- */
export const fetchCrmStats = (userId) =>
  fetch(`${API_BASE}/api/crm/stats${qs({ userId })}`).then(json);

/* ---------- Business card scanner (one or two sides) ---------- */
export const scanBusinessCard = (userId, imageBase64Front, imageBase64Back = null) =>
  fetch(`${API_BASE}/api/crm/scan-card`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, imageBase64Front, imageBase64Back }),
  }).then(json);

/* ---------- Verify business online ---------- */
export const verifyBusiness = (contact) =>
  fetch(`${API_BASE}/api/crm/verify-business`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contact }),
  }).then(json);

/* ---------- Folders (hierarchical) ---------- */
export const fetchFolders = (userId) =>
  fetch(`${API_BASE}/api/crm/folders${qs({ userId })}`).then(json);

export const createFolder = (payload) =>
  fetch(`${API_BASE}/api/crm/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(json);

export const updateFolder = (id, payload) =>
  fetch(`${API_BASE}/api/crm/folders/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(json);

export const deleteFolder = (id) =>
  fetch(`${API_BASE}/api/crm/folders/${id}`, { method: "DELETE" }).then(json);

export const moveContactsToFolder = (userId, contactIds, folderId) =>
  fetch(`${API_BASE}/api/crm/contacts/move-to-folder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, contactIds, folderId }),
  }).then(json);

/* ---------- Title migration (one-time) ---------- */
export const migrateTitlesFromNotes = (userId, dryRun = false) =>
  fetch(`${API_BASE}/api/crm/contacts/migrate-titles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, dryRun }),
  }).then(json);

/* ---------- Import (CSV/Excel/JSON) ---------- */
export const importContactsPreview = (userId, rows) =>
  fetch(`${API_BASE}/api/crm/contacts/import-preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, rows }),
  }).then(json);

export const importContactsExecute = (userId, rows, defaultFolderId = null) =>
  fetch(`${API_BASE}/api/crm/contacts/import-execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, rows, defaultFolderId }),
  }).then(json);

/* ---------- Email broadcast ---------- */
export const sendEmailBroadcast = (payload) =>
  fetch(`${API_BASE}/api/crm/email/send-broadcast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(json);

export const fetchBroadcastHistory = (userId) =>
  fetch(`${API_BASE}/api/crm/email/broadcasts${qs({ userId })}`).then(json);

/* ---------- Outlook integration ---------- */
export const fetchOutlookStatus = (userId) =>
  fetch(`${API_BASE}/api/crm/outlook/status${qs({ userId })}`).then(json);

export const getOutlookAuthUrl = (userId) =>
  fetch(`${API_BASE}/api/crm/outlook/auth-url${qs({ userId })}`).then(json);

export const disconnectOutlook = (userId) =>
  fetch(`${API_BASE}/api/crm/outlook/disconnect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  }).then(json);

export const syncOutlookContacts = (userId, direction = "two-way") =>
  fetch(`${API_BASE}/api/crm/outlook/sync-contacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, direction }),
  }).then(json);

export const importOutlookEmails = (userId, days = 7) =>
  fetch(`${API_BASE}/api/crm/outlook/import-emails`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, days }),
  }).then(json);

export const sendOutlookEmail = (payload) =>
  fetch(`${API_BASE}/api/crm/outlook/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(json);

/* ---------- Constants ---------- */
export const CONTACT_TYPES = [
  { value: "lead", label: "Lead", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "buyer", label: "Buyer", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "dealer", label: "Dealer", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "designer", label: "Designer", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "supplier", label: "Supplier", color: "bg-stone-100 text-stone-700 border-stone-200" },
];

export const DEAL_STAGES = [
  { value: "lead", label: "Lead", color: "bg-stone-100 text-stone-700", accent: "border-stone-300" },
  { value: "qualified", label: "Qualified", color: "bg-blue-100 text-blue-700", accent: "border-blue-300" },
  { value: "proposal", label: "Proposal", color: "bg-amber-100 text-amber-700", accent: "border-amber-300" },
  { value: "negotiation", label: "Negotiation", color: "bg-orange-100 text-orange-700", accent: "border-orange-300" },
  { value: "won", label: "Won", color: "bg-emerald-100 text-emerald-700", accent: "border-emerald-400" },
  { value: "lost", label: "Lost", color: "bg-rose-100 text-rose-700", accent: "border-rose-300" },
];

export const TASK_PRIORITIES = [
  { value: "low", label: "Low", color: "bg-stone-100 text-stone-600" },
  { value: "normal", label: "Normal", color: "bg-blue-100 text-blue-700" },
  { value: "high", label: "High", color: "bg-amber-100 text-amber-700" },
  { value: "urgent", label: "Urgent", color: "bg-rose-100 text-rose-700" },
];

export const INTERACTION_TYPES = [
  { value: "call", label: "Call", icon: "phone" },
  { value: "meeting", label: "Meeting", icon: "users" },
  { value: "whatsapp", label: "WhatsApp", icon: "chat" },
  { value: "email", label: "Email", icon: "mail" },
  { value: "note", label: "Note", icon: "document" },
];
