import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
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
  stone_view: { label: "Viewed", chip: "bg-cyan-100 text-cyan-700", dot: "bg-cyan-500" },
  category_view: { label: "Browsed", chip: "bg-violet-100 text-violet-700", dot: "bg-violet-500" },
  search: { label: "Searched", chip: "bg-sky-100 text-sky-700", dot: "bg-sky-500" },
  filter_apply: { label: "Filtered", chip: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  share: { label: "Shared", chip: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
};

const eventSummary = (ev) => {
  const meta = ev.meta || {};
  switch (ev.type) {
    case "stone_view":
    case "share":
      return ev.sku ? `${ev.sku}${ev.category ? ` · ${ev.category}` : ""}` : ev.category || "";
    case "category_view":
      return ev.category || "";
    case "search":
      return meta.q ? `"${meta.q}"` : "";
    case "filter_apply":
      return Array.isArray(meta.facets) && meta.facets.length
        ? `${meta.facets.length} filter${meta.facets.length === 1 ? "" : "s"} · ${meta.results ?? "?"} results`
        : `${meta.results ?? ""} results`;
    default:
      return "";
  }
};

const eventLink = (ev) =>
  (ev.type === "stone_view" || ev.type === "share") && ev.sku ? detailPath(ev) : null;

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

const ActivityFeed = ({ events }) => {
  if (!events?.length) {
    return (
      <div className="rounded-2xl glass-surface p-8 text-center text-[13px] text-app-soft">No activity yet.</div>
    );
  }
  return (
    // initial={false} keeps the first paint calm (no cascade on load); items
    // added afterwards — live arrivals — slide in from the top with a fade,
    // while `layout` makes the existing rows ease down to make room.
    <ul className="space-y-1.5">
      <AnimatePresence initial={false}>
        {events.map((ev) => {
          const meta = ACTIVITY_META[ev.type] || { label: ev.type, chip: "bg-stone-100 text-stone-600" };
          const summary = eventSummary(ev);
          const to = eventLink(ev);
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
            "flex items-center gap-2.5 rounded-xl border border-app-line bg-app-surface px-3 py-2.5 transition hover:bg-app-canvas2";
          return (
            <motion.li
              key={ev.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 480, damping: 34 }}
            >
              {to ? (
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

const TeamActivityView = ({ actor }) => {
  const [reps, setReps] = useState([]);
  const [events, setEvents] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [selectedRep, setSelectedRep] = useState(null);
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

      <h2 className="mb-2 mt-7 text-[13px] font-semibold uppercase tracking-[0.1em] text-app-soft">Team members</h2>
      {reps.length === 0 ? (
        <div className="rounded-2xl glass-surface p-8 text-center text-[13px] text-app-soft">
          No team members to track yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {reps.map((rep) => (
            <RepCard key={rep.actor_id || rep.email} rep={rep} onClick={() => setSelectedRep(rep)} />
          ))}
        </div>
      )}

      <h2 className="mb-2 mt-7 text-[13px] font-semibold uppercase tracking-[0.1em] text-app-soft">
        Live feed
        <span className="ml-2 text-[11px] font-normal normal-case tracking-normal text-app-soft">
          (open it on a rep to see their full history)
        </span>
      </h2>
      <ActivityFeed events={events} />
      {cursor && <LoadMore onClick={loadMore} loading={loadingMore} />}
    </>
  );
};

/* --------------------------------------------------------------------- Shell */

const SalesDashboard = () => {
  const { actor, isAdmin, isManager } = useTeam();
  const canSeeTeam = isAdmin || isManager;
  const [tab, setTab] = useState("shares");

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-app-ink">Dashboard</h1>
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
