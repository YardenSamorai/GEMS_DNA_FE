/* Pure helpers for the Dashboard overview — what to show from
 * GET /api/dashboard/overview and how to word it. */

const num = (n) => Number(n || 0);

export const fmtCount = (n) => num(n).toLocaleString("en-US");

export const fmtMoney = (n) => {
  const v = num(n);
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `$${Math.round(v / 1_000)}k`;
  return `$${Math.round(v).toLocaleString("en-US")}`;
};

const plural = (n, one, many) => `${fmtCount(n)} ${num(n) === 1 ? one : many}`;

export const greeting = (date = new Date()) => {
  const h = date.getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

export const todayLabel = (date = new Date()) =>
  date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

/* Rows for "At a glance". Workshop-wide numbers are for admins only, and the
 * jewelry production figures only appear while something is in them — that
 * workflow was retired, so zeros there would be noise. */
export const buildMetrics = (kpis, { isRep }) => {
  const k = kpis || {};
  const overdue = num(k.tasks_today?.overdue);
  const rows = [
    {
      id: "pipeline",
      label: "Open pipeline",
      value: fmtMoney(k.pipeline?.value),
      detail: plural(k.pipeline?.count, "open deal", "open deals"),
      to: "/crm/deals",
    },
    {
      id: "tasks",
      label: "Tasks due today",
      value: fmtCount(k.tasks_today?.count),
      detail: overdue > 0 ? `${fmtCount(overdue)} overdue` : "None overdue",
      tone: overdue > 0 ? "warn" : undefined,
      to: "/crm/tasks",
    },
    {
      id: "leads",
      label: "New DNA leads",
      value: fmtCount(k.new_leads?.new_7d),
      detail: `Last 7 days · ${fmtCount(k.new_leads?.new_30d)} in 30 days`,
      to: "/crm/contacts?folder=dna",
    },
    {
      id: "occasions",
      label: "Customer occasions today",
      value: fmtCount(k.occasions?.today),
      detail: `${fmtCount(k.occasions?.this_week)} this week`,
      to: "/crm/contacts",
    },
  ];
  if (isRep) return rows;

  rows.push({
    id: "stones",
    label: "Stones in stock",
    value: fmtCount(k.inventory?.count),
    detail: `${fmtMoney(k.inventory?.value)} total value`,
    to: "/inventory",
  });
  if (num(k.wip?.count) > 0) {
    rows.push({
      id: "wip",
      label: "Jewelry in production",
      value: fmtCount(k.wip.count),
      detail: `${fmtMoney(k.wip.value)} work in progress`,
      to: "/dashboard?tab=jewelry",
    });
  }
  if (num(k.items_ready?.count) > 0) {
    rows.push({
      id: "ready",
      label: "Jewelry ready",
      value: fmtCount(k.items_ready.count),
      detail: "Awaiting handoff",
      to: "/dashboard?tab=jewelry",
    });
  }
  if (num(k.sold_mtd?.count) > 0 || num(k.sold_mtd?.value) > 0) {
    rows.push({
      id: "sold",
      label: "Jewelry sold this month",
      value: fmtMoney(k.sold_mtd.value),
      detail: plural(k.sold_mtd.count, "piece", "pieces"),
      to: "/dashboard?tab=reports",
    });
  }
  return rows;
};

export const QUEUE_LIMIT = 8;
export const ACTIVITY_LIMIT = 8;

export const queueMeta = (item) => {
  if (item?.severity === "overdue") return { text: "Overdue", tone: "warn" };
  if (item?.severity === "today" && item?.type === "task") return { text: "Today" };
  return null;
};

/* Latest run per feed, newest first — a jewelry run shouldn't hide the
 * stones status or the other way round. */
export const latestPerFeed = (history) => {
  const out = [];
  const seen = new Set();
  for (const run of history || []) {
    const feed = run.sync_type === "jewelry" ? "jewelry" : "stones";
    if (seen.has(feed)) continue;
    seen.add(feed);
    out.push(run);
    if (seen.size === 2) break;
  }
  return out;
};

export const fmtDuration = (ms) => {
  const s = Math.round(num(ms) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
};

export const fmtWhen = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

export const syncSummary = (run) => {
  const jewelry = run.sync_type === "jewelry";
  const parts = [fmtWhen(run.started_at), run.source === "cron" ? "Automatic" : "Manual"];
  if (!run.success) return { title: jewelry ? "Jewelry" : "Stones", detail: parts.join(" · "), error: run.message || "Sync failed" };
  return {
    title: jewelry ? "Jewelry" : "Stones",
    value: plural(run.stones_count, jewelry ? "item" : "stone", jewelry ? "items" : "stones"),
    detail: [...parts, fmtDuration(run.duration_ms)].join(" · "),
  };
};
