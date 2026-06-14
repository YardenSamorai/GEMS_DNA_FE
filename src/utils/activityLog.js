/* ============================================================================
 * activityLog — lightweight, batched rep-activity tracker.
 *
 * The app calls the small track* helpers anywhere (no React context needed).
 * Events are queued and flushed in batches (every few seconds, on a full
 * batch, or on page hide) so logging never adds latency to the UI. A session
 * de-dupes repeated stone views so scrolling/back-and-forth doesn't spam rows.
 *
 * The current actor is injected once via setActivityActor() — see
 * <ActivityTracker/>, which also drives the presence heartbeat.
 * ========================================================================== */

import { sendActivity } from "../services/activityApi";

let _actor = null;
let _queue = [];
let _flushTimer = null;
const _seenStones = new Set(); // session-scoped stone_view de-dupe
let _lastSearchAt = 0;

const FLUSH_MS = 4000;
const MAX_BATCH = 12;

export const setActivityActor = (actor) => {
  _actor = actor || null;
};

const flush = () => {
  if (_flushTimer) {
    clearTimeout(_flushTimer);
    _flushTimer = null;
  }
  if (!_actor?.id || !_queue.length) return;
  const batch = _queue;
  _queue = [];
  sendActivity(_actor, batch);
};

export const flushActivity = () => flush();

const enqueue = (event) => {
  if (!_actor?.id) return; // only track a known, signed-in actor
  _queue.push({ ...event, ts: Date.now() });
  if (_queue.length >= MAX_BATCH) {
    flush();
    return;
  }
  if (!_flushTimer) {
    _flushTimer = setTimeout(() => {
      _flushTimer = null;
      flush();
    }, FLUSH_MS);
  }
};

/* App opened / user signed in. */
export const trackSessionStart = () => enqueue({ type: "session_start" });

/* Viewed a single stone's detail page (once per SKU per session). */
export const trackStoneView = (sku, category) => {
  const key = sku ? String(sku) : "";
  if (!key || _seenStones.has(key)) return;
  _seenStones.add(key);
  enqueue({ type: "stone_view", sku: key, category: category || null });
};

/* Switched catalog category (Diamonds / Emeralds / Gemstones / Jewelry). */
export const trackCategoryView = (category) => {
  if (!category) return;
  enqueue({ type: "category_view", category: String(category) });
};

/* Ran a SKU search (throttled so each keystroke doesn't log). */
export const trackSearch = (query) => {
  const q = String(query || "").trim();
  if (!q) return;
  const now = Date.now();
  if (now - _lastSearchAt < 1500) return;
  _lastSearchAt = now;
  enqueue({ type: "search", meta: { q: q.slice(0, 60) } });
};

/* Applied filters (fire when the filter sheet is confirmed). `meta` is a small
 * summary object of what's active. */
export const trackFilter = (meta) => enqueue({ type: "filter_apply", meta: meta || {} });

/* Shared stone(s) to WhatsApp — mirrored into the activity feed alongside the
 * existing share_events log. */
export const trackShare = (stones) => {
  const arr = (Array.isArray(stones) ? stones : [stones]).filter(Boolean);
  for (const s of arr) {
    enqueue({
      type: "share",
      sku: s?.sku ? String(s.sku) : null,
      category: s?.category || null,
      meta: { kind: s?.kind || null, title: s?.name || s?.title || null },
    });
  }
  flush(); // a share is high-value — send it immediately
};
