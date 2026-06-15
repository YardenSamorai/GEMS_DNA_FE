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
const _seenPriceViews = new Set(); // session-scoped price_view de-dupe
const _seenMedia = new Set(); // session-scoped media_view de-dupe (sku+kind)
let _lastSearchAt = 0;
let _sessionStartedAt = 0;

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
export const trackSessionStart = () => {
  _sessionStartedAt = Date.now();
  enqueue({ type: "session_start" });
};

/* App closing / tab hidden for good. Records how long the session lasted so the
 * manager view can show real time-in-app. Flushed immediately (beacon). */
export const trackSessionEnd = () => {
  if (!_sessionStartedAt) return;
  const ms = Date.now() - _sessionStartedAt;
  // Ignore sub-second blips (e.g. a quick visibility flicker).
  if (ms < 1500) return;
  enqueue({ type: "session_end", meta: { ms } });
  flush();
};

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

/* Applied filters (fire when the filter sheet is confirmed). `meta` now carries
 * the full search so a manager can replay it:
 *   { mode, facets, criteria, sort, q, results, zeroResults, sample[] }
 * where `criteria` is the human-readable active filter values and `sample` is a
 * compact snapshot of the stones that came back. */
export const trackFilter = (meta) => enqueue({ type: "filter_apply", meta: meta || {} });

/* Changed the sort order on the catalog. */
export const trackSort = (sortBy, mode) => {
  if (!sortBy) return;
  enqueue({ type: "sort", category: mode || null, meta: { sortBy: String(sortBy).slice(0, 60) } });
};

/* A search OR filter returned zero results — a demand signal (what reps look
 * for but we don't have / can't surface). */
export const trackZeroResults = ({ q, criteria, mode } = {}) => {
  enqueue({
    type: "zero_results",
    category: mode || null,
    meta: {
      q: q ? String(q).slice(0, 60) : null,
      criteria: criteria || null,
    },
  });
};

/* Opened a piece of media on a stone (image zoom, video/360 play, certificate /
 * PDF). De-duped per sku+kind per session so a re-open doesn't spam. */
export const trackMedia = (sku, mediaKind, category) => {
  const key = `${sku || ""}|${mediaKind || ""}`;
  if (!mediaKind || _seenMedia.has(key)) return;
  _seenMedia.add(key);
  enqueue({
    type: "media_view",
    sku: sku ? String(sku) : null,
    category: category || null,
    meta: { media: String(mediaKind).slice(0, 24) },
  });
};

/* How long a rep actually studied a stone (ms), fired on leaving the detail
 * page. Sub-2s glances are dropped as noise. */
export const trackStoneDwell = (sku, ms, category) => {
  const dur = Number(ms) || 0;
  if (!sku || dur < 2000) return;
  enqueue({
    type: "stone_dwell",
    sku: String(sku),
    category: category || null,
    meta: { ms: dur },
  });
};

/* A rep saw a price / cost / margin. De-duped per sku per session. `context`
 * distinguishes 'price' (sell price) from 'cost' (internal cost / margin). */
export const trackPriceView = (sku, context = "price", category) => {
  const key = `${sku || ""}|${context}`;
  if (_seenPriceViews.has(key)) return;
  _seenPriceViews.add(key);
  enqueue({
    type: "price_view",
    sku: sku ? String(sku) : null,
    category: category || null,
    meta: { context: String(context).slice(0, 24) },
  });
};

/* Exported / downloaded data (CSV / PDF). */
export const trackExport = (kind, count, extra = {}) => {
  enqueue({
    type: "export",
    meta: { kind: kind ? String(kind).slice(0, 24) : null, count: Number(count) || 0, ...extra },
  });
  flush(); // exports are high-value — send immediately
};

/* A rep tried to open something they're not allowed to (blocked section, gated
 * record). Helps spot over-reaching or mis-scoped permissions. */
export const trackDenied = (resource, extra = {}) => {
  enqueue({
    type: "denied",
    meta: { resource: resource ? String(resource).slice(0, 80) : null, ...extra },
  });
  flush();
};

/* Shared stone(s) to WhatsApp — mirrored into the activity feed alongside the
 * existing share_events log. `opts` enriches the row:
 *   { medium: 'whatsapp'|'email'|'copy_link', priceIncluded: bool } */
export const trackShare = (stones, opts = {}) => {
  const arr = (Array.isArray(stones) ? stones : [stones]).filter(Boolean);
  const medium = opts.medium || "whatsapp";
  const priceIncluded = !!opts.priceIncluded;
  const count = arr.length;
  for (const s of arr) {
    enqueue({
      type: "share",
      sku: s?.sku ? String(s.sku) : null,
      category: s?.category || null,
      meta: {
        kind: s?.kind || null,
        title: s?.name || s?.title || null,
        medium,
        priceIncluded,
        count,
      },
    });
  }
  flush(); // a share is high-value — send it immediately
};
