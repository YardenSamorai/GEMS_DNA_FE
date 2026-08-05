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

const post = (path, payload, signal) =>
  fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  }).then(json);

/**
 * Phase 1 — turn the question into a filter, a sort order, or a page to open.
 *
 * Only the question, the prior turns, the values that exist in this user's
 * inventory and the pages they may open are sent. No stone data.
 *
 * Auth is attached globally by utils/apiAuthFetch.js.
 *
 * @returns {Promise<{ filters: object, inventoryMode: string|null, sort: object|null,
 *                     navigateTo: {path: string, label: string}|null,
 *                     wantsRecommendation: boolean, reply: string|null,
 *                     needsClarification: boolean, dropped: string[] }>}
 */
export const askAssistant = (
  { message, history = [], inventoryMode, vocabulary, navTargets },
  signal
) =>
  post("/api/assistant/query", { message, history, inventoryMode, vocabulary, navTargets }, signal);

/**
 * Phase 2 — ask it to choose between the stones now on screen.
 *
 * Called only when phase 1 set wantsRecommendation. The rows come from what
 * the browser is already displaying, which the API masked for this viewer, so
 * the assistant can never discuss a price or branch its user cannot see.
 *
 * @returns {Promise<{ reply: string, skus: string[] }>}
 */
export const askAssistantAdvice = ({ message, history = [], shortlist, totalCount }, signal) =>
  post("/api/assistant/advise", { message, history, shortlist, totalCount }, signal);
