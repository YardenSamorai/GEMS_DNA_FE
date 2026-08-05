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

/**
 * Ask the inventory assistant for a filter.
 *
 * Only the question, the prior turns and the list of values that exist in the
 * caller's inventory are sent — never stone rows. The backend answers with a
 * validated filter object that the inventory page applies locally, so prices,
 * cost and location never leave the browser.
 *
 * Auth is attached globally by utils/apiAuthFetch.js.
 *
 * @param {object} payload
 * @param {string} payload.message        the user's question
 * @param {Array}  payload.history        prior [{ role, content }] turns
 * @param {string} payload.inventoryMode  diamonds | gemstones | jewelry
 * @param {object} payload.vocabulary     { [filterField]: string[] } from live stock
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ filters: object, inventoryMode: string|null, reply: string|null,
 *                     needsClarification: boolean, dropped: string[] }>}
 */
export const askAssistant = ({ message, history = [], inventoryMode, vocabulary }, signal) =>
  fetch(`${API_BASE}/api/assistant/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, inventoryMode, vocabulary }),
    signal,
  }).then(json);
