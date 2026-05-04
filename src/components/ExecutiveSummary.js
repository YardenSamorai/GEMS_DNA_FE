import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { ensureOccasionTasks } from "../services/crmApi";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://gems-dna-be.onrender.com";

/* Phase B — "Today across the company" strip on the main dashboard.
 * Pulls one combined summary (CRM deals + workshop jewelry + stones inventory
 * + DNA leads + occasions + tasks) so the user can see the whole business at
 * a glance without bouncing between section dashboards. Each card is a link
 * straight to where the action lives.
 */
const ExecutiveSummary = () => {
  const { user, isSignedIn } = useUser();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!isSignedIn || !user?.id) return;
    let alive = true;
    setLoading(true);

    // Fire-and-forget: idempotently materialize tasks for any occasion in the
    // next 30 days. Safe to spam — the BE dedupes by (occasion_id, occurs_on).
    // We don't await it because the dashboard summary itself doesn't depend on
    // it; the next pageview will reflect the new task counts.
    ensureOccasionTasks(user.id).catch(() => {});

    fetch(`${API_BASE}/api/dashboard/exec-summary?userId=${encodeURIComponent(user.id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed"))))
      .then((res) => {
        if (alive) setData(res);
      })
      .catch((e) => alive && setErr(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [isSignedIn, user?.id]);

  if (!isSignedIn) return null;

  const fmtMoney = (n) =>
    n == null
      ? "—"
      : n >= 1000000
      ? `$${(n / 1000000).toFixed(1)}M`
      : n >= 1000
      ? `$${Math.round(n / 1000)}k`
      : `$${Math.round(n).toLocaleString()}`;

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Today across the company</h3>
          <span className="text-[11px] text-muted-foreground">loading…</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/40" />
          ))}
        </div>
      </div>
    );
  }
  if (err) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
        Couldn't load company summary: {err}. The dashboard below still works.
      </div>
    );
  }
  if (!data) return null;

  const cards = [
    {
      label: "Open deals",
      value: data.deals?.open_count ?? 0,
      sub: fmtMoney(Number(data.deals?.open_value || 0)) + " in pipeline",
      to: "/crm/deals",
      tone: "emerald",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h18v4H3zM5 7v13h14V7" />
        </svg>
      ),
    },
    {
      label: "Jewelry in WIP",
      value: data.jewelry?.wip_count ?? 0,
      sub: `${data.jewelry?.ready_count ?? 0} ready · ${data.jewelry?.qc_count ?? 0} in QC`,
      to: "/jewelry/production",
      tone: "violet",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10l9-7 9 7-9 12-9-12z" />
        </svg>
      ),
    },
    {
      label: "Sold this month",
      value: data.jewelry?.sold_month_count ?? 0,
      sub: fmtMoney(Number(data.jewelry?.sold_month_value || 0)) + " gross",
      to: "/jewelry/sold",
      tone: "amber",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    {
      label: "Stones in stock",
      value: data.stones?.total ?? 0,
      sub:
        (data.stones?.active_skus ?? 0) > 0
          ? `${data.stones.active_skus} held by jobs`
          : fmtMoney(Number(data.stones?.total_value || 0)) + " value",
      to: "/inventory",
      tone: "sky",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l9 4-9 16-9-16 9-4z" />
        </svg>
      ),
    },
    {
      label: "New DNA leads (7d)",
      value: data.dna?.new_7d ?? 0,
      sub: `${data.dna?.new_30d ?? 0} in last 30 days`,
      to: "/crm/contacts?folder=dna",
      tone: "rose",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      label: "Upcoming occasions",
      value: data.occasions?.upcoming_30d ?? 0,
      sub:
        (data.tasks?.overdue ?? 0) > 0
          ? `${data.tasks.overdue} overdue tasks`
          : `${data.occasions?.upcoming_7d ?? 0} this week`,
      to: "/crm/tasks",
      tone: "indigo",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  const toneClasses = {
    emerald: "text-emerald-700 bg-emerald-50",
    violet: "text-violet-700 bg-violet-50",
    amber: "text-amber-700 bg-amber-50",
    sky: "text-sky-700 bg-sky-50",
    rose: "text-rose-700 bg-rose-50",
    indigo: "text-indigo-700 bg-indigo-50",
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Today across the company</h3>
          <p className="text-[11px] text-muted-foreground">
            Live snapshot of CRM, workshop, inventory, and DNA — click any card to jump in.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="group relative flex flex-col gap-1 rounded-xl border border-border bg-background p-3 transition-shadow hover:border-foreground/20 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${
                  toneClasses[c.tone]
                }`}
              >
                {c.icon}
              </span>
              <svg
                className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="text-2xl font-bold leading-tight text-foreground">
              {Number(c.value).toLocaleString()}
            </div>
            <div className="text-[11px] font-medium text-muted-foreground">{c.label}</div>
            <div className="text-[10px] text-muted-foreground/80">{c.sub}</div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default ExecutiveSummary;
