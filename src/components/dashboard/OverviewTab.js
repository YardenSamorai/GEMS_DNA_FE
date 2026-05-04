import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { ensureOccasionTasks } from "../../services/crmApi";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://gems-dna-be.onrender.com";

/* ============================================================================
 * Overview tab — Sprint 1.F.
 *
 * The Overview tab on /dashboard answers a single question:
 *   "What do I need to know about the business right now?"
 *
 * It is intentionally NOT a fifth dashboard. The deep-dive lives in the other
 * four tabs (Stones / CRM / Jewelry / Reports). This view is the *pulse*:
 *   1. KPI strip       — 8 cross-system numbers, all click-throughs
 *   2. Today's queue   — items demanding action TODAY
 *   3. Live activity   — recent significant events across the company
 *                        (proxy feed today; replaced by activity_log in Sprint 2)
 *   4. Drill cards     — one-tap entry into each domain tab
 *
 * Powered by GET /api/dashboard/overview which returns all three blocks in
 * one round-trip.
 * ============================================================================ */

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Formatting helpers
 * ───────────────────────────────────────────────────────────────────────── */
const fmtMoney = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}k`;
  return `$${Math.round(v).toLocaleString()}`;
};
const fmtCount = (n) => Number(n || 0).toLocaleString();

const timeAgo = (iso) => {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Card primitives
 * ───────────────────────────────────────────────────────────────────────── */
const KpiCard = ({ to, label, value, sub, tone, icon, badge }) => {
  const toneClasses = {
    emerald: "text-emerald-700 bg-emerald-50",
    violet:  "text-violet-700 bg-violet-50",
    amber:   "text-amber-700 bg-amber-50",
    sky:     "text-sky-700 bg-sky-50",
    rose:    "text-rose-700 bg-rose-50",
    indigo:  "text-indigo-700 bg-indigo-50",
    pink:    "text-pink-700 bg-pink-50",
    slate:   "text-slate-700 bg-slate-100",
  };
  return (
    <Link
      to={to}
      className="group relative flex flex-col gap-1 rounded-xl border border-stone-200 bg-white p-3 transition hover:border-stone-300 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${toneClasses[tone] || toneClasses.slate}`}>
          {icon}
        </span>
        {badge ? (
          <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
            {badge}
          </span>
        ) : (
          <svg
            className="h-3.5 w-3.5 text-stone-400 opacity-0 transition-opacity group-hover:opacity-100"
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </div>
      <div className="text-2xl font-bold leading-tight text-stone-900">{value}</div>
      <div className="text-[11px] font-medium text-stone-500">{label}</div>
      <div className="text-[10px] text-stone-400">{sub}</div>
    </Link>
  );
};

const SectionHeader = ({ title, hint, action }) => (
  <div className="flex items-end justify-between mb-2">
    <div>
      <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
      {hint && <p className="text-[11px] text-stone-500">{hint}</p>}
    </div>
    {action}
  </div>
);

const QueueIcon = ({ type }) => {
  const map = {
    task: { color: "text-amber-600 bg-amber-50",  d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
    occasion: { color: "text-pink-600 bg-pink-50",  d: "M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0A2.704 2.704 0 003 15.546V19a2 2 0 002 2h14a2 2 0 002-2v-3.454zM3 7.5l1.5 1.5L9 4.5 13.5 9 18 4.5l3 3v4L18 14.5l-4.5-4.5L9 14.5 4.5 10 3 11.5v-4z" },
    ready_item: { color: "text-emerald-600 bg-emerald-50", d: "M5 13l4 4L19 7" },
    stale_deal: { color: "text-rose-600 bg-rose-50",  d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
    new_lead: { color: "text-sky-600 bg-sky-50",   d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  };
  const cfg = map[type] || map.task;
  return (
    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${cfg.color}`}>
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={cfg.d} />
      </svg>
    </span>
  );
};

const ActivityIcon = ({ type }) => {
  const map = {
    deal_update: { color: "bg-emerald-500", letter: "D" },
    jewelry_update: { color: "bg-violet-500", letter: "J" },
    new_lead: { color: "bg-sky-500", letter: "L" },
    jewelry_sold: { color: "bg-amber-500", letter: "$" },
  };
  const cfg = map[type] || { color: "bg-stone-400", letter: "·" };
  return (
    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ${cfg.color}`}>
      {cfg.letter}
    </span>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
 * Main component
 * ───────────────────────────────────────────────────────────────────────── */
const OverviewTab = ({ onJumpTab, drillTabs }) => {
  const { user, isSignedIn } = useUser();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!isSignedIn || !user?.id) return;
    let alive = true;
    setLoading(true);
    setErr(null);

    // Fire-and-forget: idempotently materialize tasks for any occasion in the
    // next 30 days. Safe to spam — the BE dedupes by (occasion_id, occurs_on).
    ensureOccasionTasks(user.id).catch(() => {});

    fetch(`${API_BASE}/api/dashboard/overview?userId=${encodeURIComponent(user.id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Failed (${r.status})`))))
      .then((res) => alive && setData(res))
      .catch((e) => alive && setErr(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [isSignedIn, user?.id]);

  if (!isSignedIn) return null;

  /* ─── Cards definition (driven by API response) ─────────── */
  const k = data?.kpis || {};
  const kpiCards = [
    {
      to: "/dashboard?tab=crm",
      label: "Pipeline",
      value: fmtMoney(k.pipeline?.value),
      sub: `${fmtCount(k.pipeline?.count)} open deals`,
      tone: "emerald",
      icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>,
    },
    {
      to: "/dashboard?tab=jewelry",
      label: "WIP value",
      value: fmtMoney(k.wip?.value),
      sub: `${fmtCount(k.wip?.count)} jewelry items in production`,
      tone: "violet",
      icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10l9-7 9 7-9 12-9-12z"/></svg>,
    },
    {
      to: "/inventory",
      label: "Stones value",
      value: fmtMoney(k.inventory?.value),
      sub: `${fmtCount(k.inventory?.count)} stones in stock`,
      tone: "sky",
      icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l9 4-9 16-9-16 9-4z"/></svg>,
    },
    {
      to: "/dashboard?tab=reports",
      label: "Sold MTD",
      value: fmtMoney(k.sold_mtd?.value),
      sub: `${fmtCount(k.sold_mtd?.count)} pieces this month`,
      tone: "amber",
      icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>,
    },
    {
      to: "/crm/tasks",
      label: "Tasks today",
      value: fmtCount(k.tasks_today?.count),
      sub: (k.tasks_today?.overdue || 0) > 0 ? `${k.tasks_today.overdue} overdue` : "all on schedule",
      tone: (k.tasks_today?.overdue || 0) > 0 ? "rose" : "emerald",
      icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"/></svg>,
      badge: (k.tasks_today?.overdue || 0) > 0 ? k.tasks_today.overdue : null,
    },
    {
      to: "/jewelry/production",
      label: "Items ready",
      value: fmtCount(k.items_ready?.count),
      sub: "awaiting handoff",
      tone: "indigo",
      icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
    },
    {
      to: "/crm/contacts?folder=dna",
      label: "New leads (7d)",
      value: fmtCount(k.new_leads?.new_7d),
      sub: `${fmtCount(k.new_leads?.new_30d)} in last 30 days`,
      tone: "rose",
      icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>,
    },
    {
      to: "/crm/contacts",
      label: "Occasions today",
      value: fmtCount(k.occasions?.today),
      sub: `${fmtCount(k.occasions?.this_week)} this week`,
      tone: "pink",
      icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.5V19a2 2 0 01-2 2H5a2 2 0 01-2-2v-3.5M3 7.5l1.5 1.5L9 4.5 13.5 9 18 4.5l3 3v4L18 14.5l-4.5-4.5L9 14.5 4.5 10 3 11.5v-4z"/></svg>,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* ─── Greeting ─── */}
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">
          {greeting()}{user?.firstName ? `, ${user.firstName}` : ""}
        </h1>
        <p className="mt-0.5 text-sm text-stone-500">
          A live snapshot across CRM, workshop, stones, DNA leads, and customer occasions.
        </p>
      </header>

      {/* ─── Error banner (non-blocking) ─── */}
      {err && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Couldn't load company summary: {err}. Try again in a moment.
        </div>
      )}

      {/* ─── KPI strip (8 cards) ─── */}
      <section>
        <SectionHeader
          title="Today across the company"
          hint="Click any card to jump straight to where the action lives."
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-[112px] rounded-xl border border-stone-200 bg-white animate-pulse" />
              ))
            : kpiCards.map((c) => <KpiCard key={c.label} {...c} />)}
        </div>
      </section>

      {/* ─── Two columns: Today's queue + Live activity ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's queue */}
        <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
          <SectionHeader
            title="Today's queue"
            hint="What needs you in the next few hours."
            action={
              <Link to="/crm/tasks" className="text-[11px] font-medium text-emerald-700 hover:underline">
                Open tasks →
              </Link>
            }
          />
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-stone-100 animate-pulse" />
            ))}</div>
          ) : (data?.queue?.length || 0) === 0 ? (
            <div className="py-8 text-center">
              <div className="mx-auto h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
                <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-emerald-800">Inbox zero</p>
              <p className="text-xs text-stone-500 mt-0.5">No tasks, occasions, or stale deals need attention right now.</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {data.queue.slice(0, 12).map((q) => (
                <li key={q.id}>
                  <Link
                    to={q.link}
                    className="flex items-start gap-3 rounded-lg p-2 hover:bg-stone-50 transition-colors group"
                  >
                    <QueueIcon type={q.type} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-stone-900 truncate group-hover:text-emerald-700">
                          {q.title}
                        </p>
                        {q.severity === "overdue" && (
                          <span className="rounded-full bg-rose-100 px-1.5 py-0 text-[9px] font-bold uppercase text-rose-700">
                            Overdue
                          </span>
                        )}
                        {q.severity === "today" && q.type === "task" && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0 text-[9px] font-bold uppercase text-amber-700">
                            Today
                          </span>
                        )}
                      </div>
                      {q.sub && <p className="text-[11px] text-stone-500 truncate">{q.sub}</p>}
                    </div>
                    <svg className="h-4 w-4 text-stone-300 group-hover:text-stone-500 mt-1.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Live activity */}
        <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
          <SectionHeader
            title="What just happened"
            hint="Recent activity across CRM and the workshop."
            action={
              <span className="text-[10px] font-medium text-stone-400" title="Real-time updates land in Sprint 3 (SSE)">
                proxy feed · live in Sprint 3
              </span>
            }
          />
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-stone-100 animate-pulse" />
            ))}</div>
          ) : (data?.activity?.length || 0) === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-stone-500">No recent activity in the last 14 days.</p>
            </div>
          ) : (
            <ol className="space-y-1">
              {data.activity.map((a) => (
                <li key={a.id}>
                  <Link
                    to={a.link}
                    className="flex items-start gap-3 rounded-lg p-2 hover:bg-stone-50 transition-colors group"
                  >
                    <ActivityIcon type={a.type} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-stone-900 truncate group-hover:text-emerald-700">
                        {a.label}
                      </p>
                      {a.sub && <p className="text-[11px] text-stone-500 truncate">{a.sub}</p>}
                    </div>
                    <span className="text-[10px] text-stone-400 mt-1.5 shrink-0">{timeAgo(a.ts)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {/* ─── Drill into a domain ─── */}
      {Array.isArray(drillTabs) && drillTabs.length > 0 && (
        <section>
          <SectionHeader title="Drill into a domain" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {drillTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => onJumpTab && onJumpTab(t.id)}
                className="text-left rounded-xl border border-stone-200 bg-white p-4 hover:border-emerald-400 hover:shadow-sm transition group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-stone-900">{t.label}</span>
                  <svg className="h-4 w-4 text-stone-400 group-hover:text-emerald-600 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <p className="mt-1 text-xs text-stone-500">{t.description}</p>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default OverviewTab;
