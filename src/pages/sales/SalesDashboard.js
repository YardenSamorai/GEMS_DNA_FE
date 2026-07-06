import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTeam } from "../../context/TeamContext";
import { fetchShareEvents } from "../../services/stonesApi";
import { fetchTeamActivity, fetchRepActivity } from "../../services/activityApi";

/* ============================================================================
 * SalesDashboard — the sales "Home".
 *
 *   • "My sends" tab: what a rep has shared to clients via WhatsApp (how many
 *     stones, which ones). Salesmen see only their own; owners/managers see all.
 *   • "Team activity" tab (owners + managers only): who's online now / last
 *     seen, per-rep usage rollups, and a live feed of what the team is doing
 *     (logins, stone views, category switches, searches, filters, shares).
 * ========================================================================== */

const KIND_BADGE = {
  diamond: "bg-sky-100 text-sky-700",
  emerald: "bg-emerald-100 text-emerald-700",
  gemstone: "bg-violet-100 text-violet-700",
  jewelry: "bg-amber-100 text-amber-700",
};

const kindOf = (ev) => {
  const k = String(ev.kind || "").toLowerCase();
  if (k) return k;
  const c = String(ev.category || "").toLowerCase();
  if (c.includes("diamond") || c.includes("fancy")) return "diamond";
  if (c.includes("emerald")) return "emerald";
  if (c.includes("jewel")) return "jewelry";
  return "gemstone";
};

const detailPath = (ev) => {
  const sku = encodeURIComponent(ev.sku || "");
  return kindOf(ev) === "jewelry" ? `/sales/jewelry/${sku}` : `/sales/stone/${sku}`;
};

/* "3 min ago" / "2 hr ago" / "Jun 14" */
const relTime = (iso) => {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const StatCard = ({ label, value, sub }) => (
  <div className="flex flex-col rounded-2xl border border-app-line bg-app-surface px-4 py-4">
    <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-app-soft">{label}</span>
    <span className="mt-1 text-[28px] font-semibold leading-none tabular-nums text-app-ink">{value}</span>
    {sub && <span className="mt-1 text-[12px] text-app-muted">{sub}</span>}
  </div>
);

/* ------------------------------------------------------------------ My sends */

const SharesView = ({ actor, isAdmin, isManager }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetchShareEvents(actor, { limit: 1000 });
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [actor?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const events = data?.events || [];
  const seesAll = data?.scope === "all" || isAdmin || isManager;

  const repCount = useMemo(() => {
    if (!seesAll) return 0;
    return new Set(events.map((e) => e.actor_id || e.actor_name || "—")).size;
  }, [events, seesAll]);

  return (
    <>
      <div className={`mt-5 grid gap-3 ${seesAll ? "grid-cols-3" : "grid-cols-2"}`}>
        <StatCard label="Sent" value={loading ? "—" : (data?.count ?? 0).toLocaleString()} sub="total shares" />
        <StatCard label="Stones" value={loading ? "—" : (data?.uniqueStones ?? 0).toLocaleString()} sub="unique pieces" />
        {seesAll && <StatCard label="Reps" value={loading ? "—" : repCount.toLocaleString()} sub="who shared" />}
      </div>

      <h2 className="mb-2 mt-7 text-[13px] font-semibold uppercase tracking-[0.1em] text-app-soft">
        {seesAll ? "Recent sends" : "Your sends"}
      </h2>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 w-full rounded-2xl skeleton" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl glass-surface p-10 text-center">
          <p className="text-[14px] font-medium text-app-ink">{error}</p>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="rounded-2xl glass-surface p-10 text-center">
          <p className="text-[14px] font-medium text-app-ink">No stones sent yet</p>
          <p className="mt-1 text-[13px] text-app-soft">
            Share a stone to WhatsApp from the catalog and it'll show up here.
          </p>
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <ul className="space-y-2">
          {events.map((ev) => {
            const kind = kindOf(ev);
            return (
              <li key={ev.id}>
                <Link
                  to={detailPath(ev)}
                  className="flex items-center gap-3 rounded-2xl border border-app-line bg-app-surface px-4 py-3 transition hover:bg-app-canvas2 active:scale-[0.99]"
                >
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${
                      KIND_BADGE[kind] || KIND_BADGE.gemstone
                    }`}
                  >
                    {kind}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-app-ink">{ev.title || ev.sku || "Stone"}</p>
                    <p className="truncate text-[12px] text-app-muted">
                      {ev.sku}
                      {seesAll && ev.actor_name ? ` · ${ev.actor_name}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] tabular-nums text-app-soft">{relTime(ev.created_at)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
};

/* ------------------------------------------------------------ Team activity */

const ACTIVITY_META = {
  session_start: { label: "Opened the app", chip: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  session_end: { label: "Left the app", chip: "bg-stone-100 text-stone-600", dot: "bg-stone-400" },
  stone_view: { label: "Viewed", chip: "bg-cyan-100 text-cyan-700", dot: "bg-cyan-500" },
  stone_dwell: { label: "Studied", chip: "bg-teal-100 text-teal-700", dot: "bg-teal-500" },
  category_view: { label: "Browsed", chip: "bg-violet-100 text-violet-700", dot: "bg-violet-500" },
  search: { label: "Searched", chip: "bg-sky-100 text-sky-700", dot: "bg-sky-500" },
  filter_apply: { label: "Filtered", chip: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  sort: { label: "Sorted", chip: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-500" },
  zero_results: { label: "No results", chip: "bg-stone-200 text-stone-700", dot: "bg-stone-500" },
  media_view: { label: "Opened media", chip: "bg-fuchsia-100 text-fuchsia-700", dot: "bg-fuchsia-500" },
  price_view: { label: "Viewed price", chip: "bg-yellow-100 text-yellow-800", dot: "bg-yellow-500" },
  export: { label: "Exported", chip: "bg-orange-100 text-orange-700", dot: "bg-orange-500" },
  denied: { label: "Blocked", chip: "bg-red-100 text-red-700", dot: "bg-red-500" },
  share: { label: "Shared", chip: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
};

// "2m 5s" / "45s" / "1h 3m"
const fmtDuration = (ms) => {
  const s = Math.round((Number(ms) || 0) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return rs ? `${m}m ${rs}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
};

const PRETTY_MEDIA = { video_360: "360° video", certificate: "certificate", image: "photo" };
const PRETTY_EXPORT = {
  labels_print: "labels printed",
  label_print: "label printed",
  label_png: "label image",
  labels_png: "label images",
};

const eventSummary = (ev) => {
  const meta = ev.meta || {};
  switch (ev.type) {
    case "stone_view":
    case "share":
      return ev.sku ? `${ev.sku}${ev.category ? ` · ${ev.category}` : ""}` : ev.category || "";
    case "stone_dwell":
      return `${ev.sku || ""}${meta.ms ? ` · ${fmtDuration(meta.ms)}` : ""}`;
    case "category_view":
      return ev.category || "";
    case "search":
      return meta.q ? `"${meta.q}"` : "";
    case "sort":
      return meta.sortBy || "";
    case "zero_results":
      return meta.q ? `"${meta.q}" · no matches` : "no matches";
    case "media_view":
      return `${ev.sku || ""}${meta.media ? ` · ${PRETTY_MEDIA[meta.media] || meta.media}` : ""}`;
    case "price_view":
      return `${ev.sku || ""}${meta.context === "cost" ? " · cost / margin" : ""}`;
    case "export":
      return `${meta.count ?? ""} ${PRETTY_EXPORT[meta.kind] || meta.kind || "items"}`.trim();
    case "session_end":
      return meta.ms ? `${fmtDuration(meta.ms)} in app` : "";
    case "denied":
      return `tried to open ${meta.resource || "a blocked area"}`;
    case "filter_apply": {
      const n = Array.isArray(meta.facets) ? meta.facets.length : 0;
      const head = n ? `${n} filter${n === 1 ? "" : "s"}` : "filtered";
      return `${head} · ${meta.results ?? "?"} results · tap to view`;
    }
    default:
      return "";
  }
};

const eventLink = (ev) =>
  (ev.type === "stone_view" || ev.type === "share" || ev.type === "stone_dwell" ||
    ev.type === "media_view" || ev.type === "price_view") && ev.sku
    ? detailPath(ev)
    : null;

// Events whose full detail (search criteria + result stones) opens in a modal.
const isReplayable = (ev) => ev.type === "filter_apply" || ev.type === "zero_results";

// Human labels for the persisted filter keys (must mirror FILTER_DEFAULTS in
// SalesInventory). Anything unmapped falls back to the raw key.
const FILTER_LABELS = {
  shapeSel: "Shape", sizeFrom: "Min carat", sizeTo: "Max carat", sizeBands: "Carat bands",
  ppcFrom: "Min $/ct", ppcTo: "Max $/ct", ppcBands: "$/ct bands",
  totalFrom: "Min total", totalTo: "Max total", totalBands: "Total bands",
  lenFrom: "Min length", lenTo: "Max length", widthFrom: "Min width", widthTo: "Max width",
  ratioFrom: "Min ratio", ratioTo: "Max ratio", colorMode: "Color mode", colorGrades: "Color",
  fancyIntensity: "Fancy intensity", fancyColor: "Fancy color", claritySel: "Clarity",
  labSel: "Lab", locationSel: "Location", treatmentSel: "Treatment", originSel: "Origin",
  gemColorSel: "Gem color", gemTypeSel: "Gem type", cutSel: "Cut", polishSel: "Polish",
  symmetrySel: "Symmetry", fluorSel: "Fluorescence", parcelSel: "Parcel",
  onlyCert: "Certified only", onlyMedia: "With media", onlyInStock: "In stock only",
};

const fmtCriteriaValue = (v) => {
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
};

const MODE_PATH = {
  diamond: "/sales/diamonds",
  emerald: "/sales/emeralds",
  gemstone: "/sales/gemstones",
};

const RepIdentity = ({ rep, big }) => (
  <div className="flex items-center gap-2.5">
    <span
      className={`relative inline-flex shrink-0 rounded-full ${big ? "h-3 w-3" : "h-2.5 w-2.5"} ${
        rep.online ? "bg-emerald-500" : "bg-stone-300"
      }`}
      title={rep.online ? "Online now" : "Offline"}
    >
      {rep.online && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75" />}
    </span>
    <div className="min-w-0 flex-1">
      <p className={`truncate font-semibold text-app-ink ${big ? "text-[18px]" : "text-[14px]"}`}>
        {rep.name || rep.email || "—"}
      </p>
      <p className="truncate text-[12px] text-app-muted">
        <span className="capitalize">{rep.role || "rep"}</span>
        {" · "}
        {rep.online ? "online now" : rep.last_seen ? `seen ${relTime(rep.last_seen)}` : "never seen"}
      </p>
    </div>
  </div>
);

const RepCard = ({ rep, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full flex-col rounded-2xl border border-app-line bg-app-surface px-4 py-3.5 text-left transition hover:bg-app-canvas2 active:scale-[0.99]"
  >
    <RepIdentity rep={rep} />
    <div className="mt-3 grid grid-cols-4 gap-2 text-center">
      {[
        ["Sessions", rep.sessions_7d],
        ["Views", rep.stone_views_7d],
        ["Shares", rep.shares_7d],
        ["Events", rep.events_7d],
      ].map(([label, value]) => (
        <div key={label} className="rounded-xl bg-app-canvas2 px-1 py-2">
          <div className="text-[16px] font-semibold leading-none tabular-nums text-app-ink">
            {Number(value || 0).toLocaleString()}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wide text-app-soft">{label}</div>
        </div>
      ))}
    </div>
  </button>
);

/* Detail sheet for a logged search/filter — shows the exact criteria the rep
 * used, the result count, the snapshot of stones they got back, and a button
 * to re-run the same search live in the catalog. */
const SearchDetailModal = ({ ev, onClose }) => {
  const navigate = useNavigate();
  const meta = ev?.meta || {};
  const criteria = meta.criteria && typeof meta.criteria === "object" ? meta.criteria : {};
  const criteriaKeys = Object.keys(criteria);
  const sample = Array.isArray(meta.sample) ? meta.sample : [];
  const sort = Array.isArray(meta.sort) ? meta.sort : [];
  // Older events only stored the facet *names* (not values) — show them as a
  // read-only fallback so the row isn't blank.
  const facetNames = Array.isArray(meta.facets) ? meta.facets : [];
  // Can we actually replay this search? Only when we captured real values.
  const canReplay = criteriaKeys.length > 0 || !!meta.q;
  const isZero = ev.type === "zero_results" || meta.results === 0;

  const reRun = () => {
    const modePath = MODE_PATH[meta.mode] || "/sales/gemstones";
    navigate(modePath, {
      state: {
        replayFilters: { ...criteria, sortBy: sort, skuQuery: meta.q || "" },
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 320 }}
        className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[85vh] w-full max-w-[680px] flex-col rounded-t-3xl border-t border-app-line bg-app-canvas"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
        role="dialog"
        aria-label="Search detail"
      >
        <div className="flex justify-center pt-3" aria-hidden>
          <span className="h-1.5 w-10 rounded-full bg-app-line" />
        </div>
        <div className="flex items-center justify-between px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold tracking-tight text-app-ink">
              {ev.type === "zero_results" ? "Search — no results" : "Search detail"}
            </h2>
            <p className="truncate text-[12px] text-app-soft">
              {ev.actor_name || "Someone"} · {relTime(ev.created_at)}
              {meta.mode ? ` · ${meta.mode}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-app-soft transition hover:bg-app-canvas2 hover:text-app-ink"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-2">
          {/* What they searched */}
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-app-muted">
            What they searched
          </p>
          {meta.q ? (
            <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-app-line bg-app-surface px-3 py-2">
              <span className="text-[12px] text-app-soft">Search text</span>
              <span className="truncate text-[13px] font-semibold text-app-ink">"{meta.q}"</span>
            </div>
          ) : null}
          {criteriaKeys.length ? (
            <div className="divide-y divide-app-line/60 rounded-xl border border-app-line bg-app-surface px-3">
              {criteriaKeys.map((k) => (
                <div key={k} className="flex items-baseline justify-between gap-4 py-2">
                  <span className="shrink-0 text-[12px] text-app-soft">{FILTER_LABELS[k] || k}</span>
                  <span className="min-w-0 text-right text-[13px] font-semibold text-app-ink">
                    {fmtCriteriaValue(criteria[k])}
                  </span>
                </div>
              ))}
            </div>
          ) : facetNames.length ? (
            // Older log — only the facet names were stored, not their values.
            <div className="rounded-xl border border-app-line bg-app-surface px-3 py-2.5">
              <p className="text-[13px] text-app-ink">
                {facetNames.map((k) => FILTER_LABELS[k] || k).join(", ")}
              </p>
              <p className="mt-1 text-[11.5px] text-app-soft">
                Older log — exact filter values weren't recorded.
              </p>
            </div>
          ) : !meta.q ? (
            <p className="text-[13px] text-app-soft">No specific filters — browsed the full catalog.</p>
          ) : null}
          {sort.length ? (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-app-line bg-app-surface px-3 py-2">
              <span className="text-[12px] text-app-soft">Sorted by</span>
              <span className="truncate text-[13px] font-semibold text-app-ink">
                {sort
                  .map((s) => `${s.key} ${s.dir === "asc" ? "↑" : "↓"}`)
                  .join(", ")}
              </span>
            </div>
          ) : null}

          {/* What they got back */}
          <div className="mb-2 mt-5 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-app-muted">
              Stones returned
            </p>
            <span className="text-[12px] font-semibold text-app-ink">{meta.results ?? sample.length}</span>
          </div>
          {sample.length ? (
            <ul className="space-y-1.5">
              {sample.map((s, i) => {
                const line = [
                  s.wt != null ? `${Number(s.wt).toFixed?.(2) ?? s.wt}ct` : null,
                  s.shape,
                  s.color,
                  s.clarity,
                  s.lab,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li key={`${s.sku || i}`}>
                    <Link
                      to={`/sales/stone/${encodeURIComponent(s.sku || "")}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-app-line bg-app-surface px-3 py-2 transition hover:bg-app-canvas2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-app-ink">{s.sku || "—"}</p>
                        {line ? <p className="truncate text-[11.5px] text-app-muted">{line}</p> : null}
                      </div>
                      {s.total != null && (
                        <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-app-ink">
                          ${Number(s.total).toLocaleString()}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
              {meta.results > sample.length && (
                <li className="px-1 pt-1 text-[12px] text-app-soft">
                  + {meta.results - sample.length} more — re-run to see all
                </li>
              )}
            </ul>
          ) : isZero ? (
            <p className="text-[13px] text-app-soft">No stones matched this search.</p>
          ) : (
            // results > 0 but no snapshot → an older log from before snapshots.
            <p className="text-[13px] text-app-soft">
              This older log didn't capture the stone list. Tap Re-run to see the current matches.
            </p>
          )}
        </div>

        {/* Re-run — only meaningful when we captured real criteria; otherwise it
            just opens the catalog, so label it honestly. */}
        <div className="border-t border-app-line px-5 pt-3">
          <button
            type="button"
            onClick={reRun}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-app-ink py-3 text-[14px] font-semibold text-app-canvas transition active:scale-[0.99]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v6h6M20 20v-6h-6M20 8a8 8 0 00-14.9-2M4 16a8 8 0 0014.9 2" />
            </svg>
            {canReplay ? "Re-run this search live" : `Open ${meta.mode || "catalog"} catalog`}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

/* "Today" / "Yesterday" / "Jul 3" — calendar-day headers for the feed. */
const dayLabel = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const ActivityFeed = ({ events, emptyText = "No activity yet." }) => {
  const [detailEv, setDetailEv] = useState(null);
  if (!events?.length) {
    return (
      <div className="rounded-2xl glass-surface p-8 text-center text-[13px] text-app-soft">{emptyText}</div>
    );
  }
  // Break the flat list into calendar days so the feed reads as a timeline
  // instead of one endless list.
  const items = [];
  let lastDay = null;
  for (const ev of events) {
    const day = dayLabel(ev.created_at);
    if (day && day !== lastDay) {
      items.push({ header: true, id: `day-${day}`, label: day });
      lastDay = day;
    }
    items.push({ header: false, id: ev.id, ev });
  }
  return (
    // initial={false} keeps the first paint calm (no cascade on load); items
    // added afterwards — live arrivals — slide in from the top with a fade,
    // while `layout` makes the existing rows ease down to make room.
    <ul className="space-y-1.5">
      <AnimatePresence initial={false}>
        {items.map((item) => {
          if (item.header) {
            return (
              <motion.li
                key={item.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 pt-2 first:pt-0"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-app-muted">
                  {item.label}
                </span>
                <span className="h-px flex-1 bg-app-line" />
              </motion.li>
            );
          }
          const ev = item.ev;
          const meta = ACTIVITY_META[ev.type] || { label: ev.type, chip: "bg-stone-100 text-stone-600" };
          const summary = eventSummary(ev);
          const to = eventLink(ev);
          const replayable = isReplayable(ev);
          const Row = (
            <>
              <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10.5px] font-semibold ${meta.chip}`}>
                {meta.label}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-app-ink">
                  <span className="font-semibold">{ev.actor_name || "Someone"}</span>
                  {summary ? <span className="text-app-muted"> · {summary}</span> : null}
                </p>
              </div>
              <span className="shrink-0 text-[11.5px] tabular-nums text-app-soft">{relTime(ev.created_at)}</span>
            </>
          );
          const rowClass =
            "flex w-full items-center gap-2.5 rounded-xl border border-app-line bg-app-surface px-3 py-2.5 text-left transition hover:bg-app-canvas2";
          return (
            <motion.li
              key={ev.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 480, damping: 34 }}
            >
              {replayable ? (
                <button type="button" onClick={() => setDetailEv(ev)} className={rowClass}>
                  {Row}
                </button>
              ) : to ? (
                <Link to={to} className={rowClass}>
                  {Row}
                </Link>
              ) : (
                <div className={rowClass}>{Row}</div>
              )}
            </motion.li>
          );
        })}
      </AnimatePresence>
      <AnimatePresence>
        {detailEv && <SearchDetailModal ev={detailEv} onClose={() => setDetailEv(null)} />}
      </AnimatePresence>
    </ul>
  );
};

/* Page size for the activity feeds — keeps each request + the rendered list
 * small no matter how big rep_activity grows. "Load more" walks older pages via
 * keyset cursor (nextCursor), so it never slows down as you go deeper. */
const FEED_PAGE = 50;

const LoadMore = ({ onClick, loading }) => (
  <div className="mt-3 flex justify-center">
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="rounded-xl border border-app-line bg-app-surface px-5 py-2.5 text-[13px] font-semibold text-app-graphite transition hover:bg-app-canvas2 disabled:opacity-50"
    >
      {loading ? "Loading…" : "Load more"}
    </button>
  </div>
);

const RepDetail = ({ actor, repId, fallbackRep, onBack }) => {
  const [rep, setRep] = useState(fallbackRep || null);
  const [breakdown, setBreakdown] = useState([]);
  const [events, setEvents] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetchRepActivity(actor, repId, { limit: FEED_PAGE });
        if (!alive) return;
        if (res.rep) setRep(res.rep);
        setBreakdown(res.breakdown || []);
        setEvents(res.events || []);
        setCursor(res.nextCursor || null);
      } catch (err) {
        if (alive) setError(err.message || "Failed to load rep history");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [actor?.id, repId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchRepActivity(actor, repId, { limit: FEED_PAGE, before: cursor });
      setEvents((prev) => [...prev, ...(res.events || [])]);
      setCursor(res.nextCursor || null);
    } catch (_) {
      /* keep what we have */
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-app-graphite transition hover:text-app-ink"
      >
        <span aria-hidden>←</span> Back to team
      </button>

      <div className="rounded-2xl border border-app-line bg-app-surface px-4 py-4">
        <RepIdentity rep={rep || {}} big />
      </div>

      {error && (
        <div className="mt-4 rounded-2xl glass-surface p-6 text-center text-[13px] text-app-ink">{error}</div>
      )}

      {!error && breakdown.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-[13px] font-semibold uppercase tracking-[0.1em] text-app-soft">
            Last 30 days
          </h2>
          <div className="flex flex-wrap gap-2">
            {breakdown
              .slice()
              .sort((a, b) => b.count - a.count)
              .map((b) => {
                const m = ACTIVITY_META[b.type] || { label: b.type, chip: "bg-stone-100 text-stone-600" };
                return (
                  <span
                    key={b.type}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold ${m.chip}`}
                  >
                    {m.label}
                    <span className="tabular-nums opacity-80">{b.count}</span>
                  </span>
                );
              })}
          </div>
        </>
      )}

      <h2 className="mb-2 mt-6 text-[13px] font-semibold uppercase tracking-[0.1em] text-app-soft">History</h2>
      {loading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-11 w-full rounded-xl skeleton" />
          ))}
        </div>
      ) : (
        <>
          <ActivityFeed events={events} />
          {cursor && <LoadMore onClick={loadMore} loading={loadingMore} />}
        </>
      )}
    </div>
  );
};

/* ---- Team members table (desktop) --------------------------------------- */

const TEAM_COLUMNS = [
  { key: "name", label: "Member", align: "left" },
  { key: "last_seen", label: "Last seen", align: "left" },
  { key: "sessions_7d", label: "Sessions" },
  { key: "stone_views_7d", label: "Views" },
  { key: "shares_7d", label: "Shares" },
  { key: "events_7d", label: "Events" },
];

const repSortValue = (rep, key) => {
  if (key === "name") return String(rep.name || rep.email || "").toLowerCase();
  if (key === "last_seen") {
    // Online now outranks any historical timestamp.
    if (rep.online) return Number.MAX_SAFE_INTEGER;
    const t = new Date(rep.last_seen || 0).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  return Number(rep[key] || 0);
};

const TeamTable = ({ reps, sort, onSort, onSelect }) => (
  <div className="hidden overflow-hidden rounded-2xl border border-app-line bg-app-surface md:block">
    <table className="w-full">
      <thead>
        <tr className="border-b border-app-line bg-app-canvas2/60">
          {TEAM_COLUMNS.map((col) => {
            const active = sort.key === col.key;
            return (
              <th
                key={col.key}
                className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-app-soft ${
                  col.align === "left" ? "text-left" : "text-right"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSort(col.key)}
                  className={`inline-flex items-center gap-1 transition hover:text-app-ink ${
                    active ? "text-app-ink" : ""
                  }`}
                >
                  {col.label}
                  {active && <span aria-hidden>{sort.dir === "asc" ? "↑" : "↓"}</span>}
                </button>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {reps.map((rep) => (
          <tr
            key={rep.actor_id || rep.email}
            onClick={() => onSelect(rep)}
            className="cursor-pointer border-b border-app-line/60 transition last:border-0 hover:bg-app-canvas2"
          >
            <td className="px-4 py-3">
              <RepIdentity rep={rep} />
            </td>
            <td className="px-4 py-3 text-[12.5px] text-app-muted">
              {rep.online ? (
                <span className="font-semibold text-emerald-600">Online now</span>
              ) : rep.last_seen ? (
                relTime(rep.last_seen)
              ) : (
                "—"
              )}
            </td>
            {["sessions_7d", "stone_views_7d", "shares_7d", "events_7d"].map((k) => (
              <td key={k} className="px-4 py-3 text-right text-[13.5px] font-semibold tabular-nums text-app-ink">
                {Number(rep[k] || 0).toLocaleString()}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/* ---- Live feed filters --------------------------------------------------- */

const FEED_TYPE_GROUPS = [
  { key: "all", label: "All" },
  { key: "views", label: "Views", types: ["stone_view", "stone_dwell", "media_view", "price_view", "category_view"] },
  { key: "searches", label: "Searches", types: ["search", "filter_apply", "sort", "zero_results"] },
  { key: "shares", label: "Shares", types: ["share"] },
  { key: "sessions", label: "Sessions", types: ["session_start", "session_end"] },
  { key: "exports", label: "Exports", types: ["export"] },
  { key: "blocked", label: "Blocked", types: ["denied"] },
];

const TeamActivityView = ({ actor }) => {
  const [reps, setReps] = useState([]);
  const [events, setEvents] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [selectedRep, setSelectedRep] = useState(null);
  // Table sort — default: most recently active on top.
  const [teamSort, setTeamSort] = useState({ key: "last_seen", dir: "desc" });
  // Live-feed filters: activity-type group + a specific person ("" = everyone).
  const [feedType, setFeedType] = useState("all");
  const [feedRep, setFeedRep] = useState("");
  // Newest loaded event id — lets the live poll ask for "only newer than this"
  // without stale closures.
  const latestIdRef = useRef(0);
  useEffect(() => {
    latestIdRef.current = events[0]?.id || 0;
  }, [events]);

  // First load: newest page of events + the per-rep rollup.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetchTeamActivity(actor, { limit: FEED_PAGE });
        if (!alive) return;
        setReps(res.reps || []);
        setEvents(res.events || []);
        setCursor(res.nextCursor || null);
      } catch (err) {
        if (alive) setError(err.message || "Failed to load team activity");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [actor?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live updates without a manual refresh:
  //   • feed poll (~6s) pulls ONLY events newer than what we have (tiny payload)
  //     and prepends them — loaded "Load more" pages stay put.
  //   • presence poll (~12s) refreshes just the online/last-seen rollup.
  useEffect(() => {
    if (loading) return undefined;
    let alive = true;

    const pollFeed = async () => {
      try {
        const sinceId = latestIdRef.current;
        const res = await fetchTeamActivity(
          actor,
          sinceId ? { after: sinceId, limit: FEED_PAGE } : { limit: FEED_PAGE }
        );
        if (!alive || !res.events?.length) return;
        setEvents((prev) => {
          const topId = prev[0]?.id || 0;
          const fresh = res.events.filter((e) => e.id > topId);
          return fresh.length ? [...fresh, ...prev] : prev;
        });
      } catch (_) {
        /* transient — keep current view */
      }
    };

    const pollPresence = async () => {
      try {
        const res = await fetchTeamActivity(actor, { repsOnly: 1 });
        if (alive && res.reps) setReps(res.reps);
      } catch (_) {
        /* transient */
      }
    };

    const feedTimer = setInterval(pollFeed, 6000);
    const presenceTimer = setInterval(pollPresence, 12000);
    return () => {
      alive = false;
      clearInterval(feedTimer);
      clearInterval(presenceTimer);
    };
  }, [actor?.id, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchTeamActivity(actor, { limit: FEED_PAGE, before: cursor });
      setEvents((prev) => [...prev, ...(res.events || [])]);
      setCursor(res.nextCursor || null);
    } catch (_) {
      /* keep what we have */
    } finally {
      setLoadingMore(false);
    }
  };

  const onlineCount = reps.filter((r) => r.online).length;

  const sortedReps = useMemo(() => {
    const dir = teamSort.dir === "asc" ? 1 : -1;
    return [...reps].sort((a, b) => {
      const va = repSortValue(a, teamSort.key);
      const vb = repSortValue(b, teamSort.key);
      if (typeof va === "string" || typeof vb === "string") {
        return String(va).localeCompare(String(vb)) * dir;
      }
      return (va - vb) * dir;
    });
  }, [reps, teamSort]);

  const onTeamSort = (key) => {
    setTeamSort((s) => {
      if (s.key !== key) {
        // Text columns start ascending; numeric/recency start descending.
        return { key, dir: key === "name" ? "asc" : "desc" };
      }
      return { key, dir: s.dir === "asc" ? "desc" : "asc" };
    });
  };

  const filteredEvents = useMemo(() => {
    const group = FEED_TYPE_GROUPS.find((g) => g.key === feedType);
    return events.filter((ev) => {
      if (feedRep && String(ev.actor_id || "") !== feedRep) return false;
      if (group?.types && !group.types.includes(ev.type)) return false;
      return true;
    });
  }, [events, feedType, feedRep]);

  const feedIsFiltered = feedType !== "all" || !!feedRep;

  if (selectedRep) {
    return (
      <RepDetail
        actor={actor}
        repId={selectedRep.actor_id}
        fallbackRep={selectedRep}
        onBack={() => setSelectedRep(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="mt-5 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 w-full rounded-2xl skeleton" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-5 rounded-2xl glass-surface p-10 text-center">
        <p className="text-[14px] font-medium text-app-ink">{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Online" value={onlineCount.toLocaleString()} sub="right now" />
        <StatCard label="Team" value={reps.length.toLocaleString()} sub="members" />
        <StatCard
          label="Events"
          value={reps.reduce((a, r) => a + Number(r.events_7d || 0), 0).toLocaleString()}
          sub="last 7 days"
        />
      </div>

      <h2 className="mb-2 mt-7 text-[13px] font-semibold uppercase tracking-[0.1em] text-app-soft">
        Team members
        <span className="ml-2 hidden text-[11px] font-normal normal-case tracking-normal text-app-soft md:inline">
          (click a column to sort · click a member for their full history)
        </span>
      </h2>
      {reps.length === 0 ? (
        <div className="rounded-2xl glass-surface p-8 text-center text-[13px] text-app-soft">
          No team members to track yet.
        </div>
      ) : (
        <>
          {/* Desktop: sortable table. Mobile: the compact cards. */}
          <TeamTable reps={sortedReps} sort={teamSort} onSort={onTeamSort} onSelect={setSelectedRep} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden">
            {sortedReps.map((rep) => (
              <RepCard key={rep.actor_id || rep.email} rep={rep} onClick={() => setSelectedRep(rep)} />
            ))}
          </div>
        </>
      )}

      <h2 className="mb-2 mt-7 text-[13px] font-semibold uppercase tracking-[0.1em] text-app-soft">
        Live feed
        <span className="ml-2 text-[11px] font-normal normal-case tracking-normal text-app-soft">
          (open it on a rep to see their full history)
        </span>
      </h2>

      {/* Feed filters: activity-type chips + person picker. Filtering is applied
          to the loaded pages — Load more keeps pulling older events, which then
          pass through the same filters. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FEED_TYPE_GROUPS.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => setFeedType(g.key)}
              className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition ${
                feedType === g.key
                  ? "border-app-ink bg-app-ink text-app-canvas"
                  : "border-app-line bg-app-surface text-app-graphite hover:bg-app-canvas2"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
        <select
          value={feedRep}
          onChange={(e) => setFeedRep(e.target.value)}
          className="ml-auto rounded-xl border border-app-line bg-app-surface px-3 py-1.5 text-[12.5px] font-semibold text-app-graphite focus:border-app-ink focus:outline-none"
          aria-label="Filter feed by member"
        >
          <option value="">Everyone</option>
          {reps.map((r) => (
            <option key={r.actor_id || r.email} value={String(r.actor_id || "")}>
              {r.name || r.email || "—"}
            </option>
          ))}
        </select>
      </div>

      <ActivityFeed
        events={filteredEvents}
        emptyText={
          feedIsFiltered
            ? "Nothing matches these filters in the loaded events — try Load more or clear the filters."
            : "No activity yet."
        }
      />
      {cursor && <LoadMore onClick={loadMore} loading={loadingMore} />}
    </>
  );
};

/* --------------------------------------------------------------------- Shell */

const SalesDashboard = () => {
  const { actor, isAdmin, isManager } = useTeam();
  const canSeeTeam = isAdmin || isManager;
  const [tab, setTab] = useState("shares");

  const firstName = (actor?.name || "").trim().split(/\s+/)[0] || "";

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[22px] font-semibold tracking-tight text-app-ink">
            <span>Hi{firstName ? ` ${firstName}` : ""}</span>
            <span className="animate-wave" aria-hidden>👋</span>
          </h1>
          <p className="mt-0.5 text-[13px] text-app-muted">
            {tab === "team"
              ? "Who's active and what the team is doing"
              : canSeeTeam
              ? "Stones shared by the whole team"
              : "Stones you've shared with clients"}
          </p>
        </div>
      </div>

      {canSeeTeam && (
        <div className="mt-4 inline-flex rounded-xl border border-app-line bg-app-surface p-1">
          {[
            ["shares", "Shares"],
            ["team", "Team activity"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition ${
                tab === id ? "bg-app-ink text-app-canvas" : "text-app-graphite hover:bg-app-canvas2"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === "team" && canSeeTeam ? (
        <TeamActivityView actor={actor} />
      ) : (
        <SharesView actor={actor} isAdmin={isAdmin} isManager={isManager} />
      )}
    </div>
  );
};

export default SalesDashboard;
