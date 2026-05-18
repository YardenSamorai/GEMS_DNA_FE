import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { fetchJewelryItems, fetchJewelryCatalog } from "../../services/jewelryApi";
import { fetchDeals, fetchContacts, fetchTasks, updateTask, DEAL_STAGES } from "../../services/crmApi";
import { decryptPrice } from "../../utils/decrypt";
import { normalizeJewelryCategory } from "../../utils/helper";

/* The Jewelry Inventory page already merges workshop jobs (jewelry_items)
 * with catalog products (jewelry_products). The dashboard had been counting
 * only workshop, so a tenant with 241 catalog pieces and 1 in-progress job
 * saw "Items: 1" and an inventory value of $1,800. We now pull both and let
 * the existing aggregators see one combined list — catalog rows have
 * status:null which is correctly treated as "in stock, not sold" by every
 * downstream filter. */
const mapCatalogToItem = (row) => {
  let price = 0;
  try { price = row.price ? Number(decryptPrice(row.price)) || 0 : 0; } catch (_) {}
  // Same normalization as the inventory grid: prefer the specific
  // jewelry_type, normalize plurals/variants to a single bucket.
  const category =
    normalizeJewelryCategory(row.jewelry_type) ||
    normalizeJewelryCategory(row.style) ||
    normalizeJewelryCategory(row.category) ||
    "Uncategorized";
  return {
    id: `cat_${row.model_number}`,
    __source: "catalog",
    sku: row.model_number || "",
    name: row.title || row.model_number || "Untitled",
    category,
    status: null,            // catalog rows aren't WIP/ready/sold
    sold_at: null,
    sale_price: price || 0,
    // Catalog items don't have a tracked production cost, so for value
    // calculations we fall back to sale price below.
    total_cost: 0,
  };
};

/* ---------- formatters ---------- */
const fmtMoney = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(n) || 0);
const fmtMoneyShort = (n) => {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
};
const fmtNumber = (n) => new Intl.NumberFormat("en-US").format(Number(n) || 0);
const pctChange = (prev, curr) => {
  if (!prev) return curr > 0 ? 100 : 0;
  return ((curr - prev) / Math.abs(prev)) * 100;
};

/* ---------- Reusable card shell ---------- */
const Card = ({ className = "", children }) => (
  <div className={`rounded-2xl glass-surface p-5 ${className}`}>
    {children}
  </div>
);

/* ---------- KPI card ---------- */
const StatCard = ({ label, value, delta, deltaSuffix = "vs last month", icon, accent = "emerald" }) => {
  const pos = delta != null && delta >= 0;
  const tones = {
    emerald: "bg-emerald-50 text-emerald-600",
    sky: "bg-sky-50 text-sky-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
  }[accent];
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-stone-500">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${tones}`}>
          {icon}
        </div>
      </div>
      <div className="mt-2 text-2xl font-bold text-stone-900">{value}</div>
      {delta != null ? (
        <div className="mt-1 flex items-center gap-1 text-xs">
          <span className={`inline-flex items-center gap-0.5 font-semibold ${pos ? "text-emerald-600" : "text-rose-600"}`}>
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              {pos ? (
                <path fillRule="evenodd" d="M10 17a1 1 0 01-1-1V5.41L5.7 8.7a1 1 0 11-1.4-1.4l5-5a1 1 0 011.4 0l5 5a1 1 0 01-1.4 1.4L11 5.41V16a1 1 0 01-1 1z" clipRule="evenodd" />
              ) : (
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v10.59l3.3-3.3a1 1 0 011.4 1.42l-5 5a1 1 0 01-1.4 0l-5-5a1 1 0 011.4-1.42L9 14.59V4a1 1 0 011-1z" clipRule="evenodd" />
              )}
            </svg>
            {Math.abs(delta).toFixed(0)}%
          </span>
          <span className="text-stone-400">{deltaSuffix}</span>
        </div>
      ) : (
        <div className="mt-1 h-3" />
      )}
    </Card>
  );
};

/* ---------- Revenue bar chart with window toggle ---------- */
const RevenueChart = ({ items }) => {
  const [windowDays, setWindowDays] = useState(7);

  const data = useMemo(() => {
    const now = new Date();
    const buckets = [];
    for (let i = windowDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      buckets.push({ date: d, value: 0 });
    }
    const cutoff = new Date(buckets[0].date);
    items.forEach((it) => {
      if (!it.sold_at) return;
      const sold = new Date(it.sold_at);
      if (sold < cutoff) return;
      const dayIdx = Math.floor((sold - cutoff) / (1000 * 60 * 60 * 24));
      if (dayIdx >= 0 && dayIdx < buckets.length) {
        buckets[dayIdx].value += Number(it.sale_price || 0);
      }
    });
    const total = buckets.reduce((a, b) => a + b.value, 0);
    const max = Math.max(...buckets.map((b) => b.value), 1);

    // Previous period for delta
    const prevStart = new Date(cutoff);
    prevStart.setDate(cutoff.getDate() - windowDays);
    const prevTotal = items
      .filter((it) => it.sold_at && new Date(it.sold_at) >= prevStart && new Date(it.sold_at) < cutoff)
      .reduce((a, b) => a + Number(b.sale_price || 0), 0);

    return { buckets, total, max, prevTotal };
  }, [items, windowDays]);

  const delta = pctChange(data.prevTotal, data.total);
  const deltaPos = delta >= 0;

  // Day labels (shortened for narrow cards)
  const dayLabel = (d) => {
    if (windowDays <= 7) return ["S", "M", "T", "W", "T", "F", "S"][d.getDay()];
    if (windowDays <= 30) return d.getDate() % 5 === 0 || d.getDate() === 1 ? String(d.getDate()) : "";
    return d.getDate() === 1 ? d.toLocaleString("en", { month: "short" }) : "";
  };

  const winOptions = [
    { v: 7, l: "7D" },
    { v: 30, l: "30D" },
    { v: 90, l: "90D" },
  ];

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-stone-500">Revenue</div>
          <div className="mt-0.5 text-2xl font-bold text-stone-900">{fmtMoney(data.total)}</div>
          <div className={`mt-0.5 inline-flex items-center gap-0.5 text-xs font-semibold ${deltaPos ? "text-emerald-600" : "text-rose-600"}`}>
            {deltaPos ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}%
          </div>
        </div>
        <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-0.5">
          {winOptions.map((opt) => (
            <button
              key={opt.v}
              onClick={() => setWindowDays(opt.v)}
              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                windowDays === opt.v ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"
              }`}
            >
              {opt.l}
            </button>
          ))}
        </div>
      </div>

      {/* Bars */}
      <div className="mt-4 flex h-32 items-end gap-1">
        {data.buckets.map((b, i) => {
          const h = (b.value / data.max) * 100;
          return (
            <div key={i} className="group relative flex flex-1 flex-col items-center justify-end">
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-emerald-300 to-emerald-500 transition-all hover:from-emerald-400 hover:to-emerald-600"
                style={{ height: `${Math.max(h, 1)}%` }}
                title={`${b.date.toLocaleDateString()} — ${fmtMoney(b.value)}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1">
        {data.buckets.map((b, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-stone-400">
            {dayLabel(b.date)}
          </div>
        ))}
      </div>
    </Card>
  );
};

/* ---------- Sales by Category donut ---------- */
const PALETTE = ["#10b981", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ec4899", "#f43f5e", "#84cc16", "#64748b"];

const SalesByCategoryCard = ({ items }) => {
  const { segments: segs, total } = useMemo(() => {
    const sold = items.filter((i) => i.status === "sold");
    const grouped = {};
    sold.forEach((i) => {
      const k = i.category || "Uncategorized";
      grouped[k] = (grouped[k] || 0) + Number(i.sale_price || 0);
    });
    const arr = Object.entries(grouped)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
    const sum = arr.reduce((a, b) => a + b.value, 0);
    let acc = 0;
    const segments = arr.map((s, idx) => {
      const start = sum > 0 ? acc / sum : 0;
      acc += s.value;
      const end = sum > 0 ? acc / sum : 0;
      return { ...s, color: PALETTE[idx % PALETTE.length], start, end };
    });
    return { segments, total: sum };
  }, [items]);

  const R = 60;
  const C = 2 * Math.PI * R;

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="text-base font-semibold text-stone-900">Sales by Category</div>
        <svg className="h-5 w-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 3.05A9 9 0 1020.95 13H11V3.05z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 8a8 8 0 00-8-8v8h8z" />
        </svg>
      </div>

      {segs.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-stone-400">No sales yet</div>
      ) : (
        <div className="mt-3 flex items-center gap-4">
          {/* Donut */}
          <div className="relative h-36 w-36 shrink-0">
            <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
              <circle cx="80" cy="80" r={R} fill="none" stroke="#f5f5f4" strokeWidth="22" />
              {segs.map((s, idx) => {
                const len = (s.end - s.start) * C;
                const offset = -s.start * C;
                return (
                  <circle
                    key={idx}
                    cx="80" cy="80" r={R}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="22"
                    strokeDasharray={`${len} ${C - len}`}
                    strokeDashoffset={offset}
                  />
                );
              })}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase tracking-wider text-stone-400">Total</span>
              <span className="text-base font-bold text-stone-900">{fmtMoneyShort(total)}</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-1.5 text-sm">
            {segs.slice(0, 5).map((s, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="truncate text-stone-700">{s.label}</span>
                </div>
                <span className="font-medium tabular-nums text-stone-900">{fmtMoney(s.value)}</span>
              </div>
            ))}
            {segs.length > 5 && (
              <div className="text-xs text-stone-400">+ {segs.length - 5} more</div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};

/* ---------- Sales Pipeline ---------- */
const PIPELINE_STAGES = ["lead", "qualified", "proposal", "negotiation"];

const SalesPipelineCard = ({ deals }) => {
  const rows = useMemo(() => {
    const grouped = {};
    PIPELINE_STAGES.forEach((s) => (grouped[s] = { stage: s, total: 0, count: 0 }));
    (deals || []).forEach((d) => {
      if (!grouped[d.stage]) return;
      grouped[d.stage].count += 1;
      grouped[d.stage].total += Number(d.value || 0);
    });
    return PIPELINE_STAGES.map((s) => grouped[s]);
  }, [deals]);

  const grand = rows.reduce((a, r) => a + r.total, 0);
  const max = Math.max(...rows.map((r) => r.total), 1);

  const stageColor = {
    lead: "bg-stone-400",
    qualified: "bg-sky-500",
    proposal: "bg-amber-500",
    negotiation: "bg-orange-500",
  };
  const stageLabel = (v) => DEAL_STAGES.find((s) => s.value === v)?.label || v;

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="text-base font-semibold text-stone-900">Sales Pipeline</div>
        <div className="text-base font-bold text-emerald-600 tabular-nums">{fmtMoney(grand)}</div>
      </div>

      <div className="mt-3 space-y-2.5">
        {rows.map((r) => {
          const w = (r.total / max) * 100;
          return (
            <div key={r.stage} className="text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${stageColor[r.stage]}`} />
                  <span className="text-stone-700">{stageLabel(r.stage)}</span>
                </div>
                <div className="flex items-center gap-2 text-stone-700">
                  <span className="font-medium tabular-nums">{fmtMoney(r.total)}</span>
                  <span className="text-stone-400">({r.count})</span>
                </div>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                <div className={`h-full ${stageColor[r.stage]}`} style={{ width: `${w}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <Link to="/crm/deals" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700">
        View pipeline
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </Card>
  );
};

/* ---------- Monthly Goals (localStorage-backed) ---------- */
const GOALS_KEY = "jewelry.dashboard.goals";
const DEFAULT_GOALS = { revenue: 50000, orders: 10, newCustomers: 5 };
const loadGoals = () => {
  try {
    const raw = localStorage.getItem(GOALS_KEY);
    return raw ? { ...DEFAULT_GOALS, ...JSON.parse(raw) } : DEFAULT_GOALS;
  } catch { return DEFAULT_GOALS; }
};
const saveGoals = (g) => {
  try { localStorage.setItem(GOALS_KEY, JSON.stringify(g)); } catch {}
};

const GoalRow = ({ label, value, goal, format }) => {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  const fmt = format || ((v) => fmtNumber(v));
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-stone-700">{label}</span>
        <span className="tabular-nums text-stone-700">
          <span className="font-semibold text-stone-900">{fmt(value)}</span>
          <span className="text-stone-400"> / {fmt(goal)}</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const MonthlyGoalsCard = ({ revenue, orders, newCustomers }) => {
  const [goals, setGoals] = useState(loadGoals);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(goals);

  useEffect(() => { setForm(goals); }, [goals]);

  const monthLabel = new Date().toLocaleString("en", { month: "long", year: "numeric" });

  const submit = () => {
    const next = {
      revenue: Number(form.revenue) || 0,
      orders: Number(form.orders) || 0,
      newCustomers: Number(form.newCustomers) || 0,
    };
    setGoals(next);
    saveGoals(next);
    setEditing(false);
    toast.success("Goals updated");
  };

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-base font-semibold text-stone-900">Monthly Goals</div>
          <div className="text-xs text-stone-500">{monthLabel}</div>
        </div>
        <button
          onClick={() => setEditing((e) => !e)}
          className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          title="Edit goals"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </div>

      {editing ? (
        <div className="mt-4 space-y-2.5">
          {[
            { k: "revenue", l: "Monthly Revenue ($)" },
            { k: "orders", l: "Orders" },
            { k: "newCustomers", l: "New Customers" },
          ].map((row) => (
            <div key={row.k}>
              <label className="text-xs font-medium text-stone-500">{row.l}</label>
              <input
                type="number"
                value={form[row.k]}
                onChange={(e) => setForm({ ...form, [row.k]: e.target.value })}
                className="mt-0.5 w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => { setForm(goals); setEditing(false); }} className="rounded-md px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-100">Cancel</button>
            <button onClick={submit} className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Save</button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <GoalRow label="Monthly Revenue" value={revenue} goal={goals.revenue} format={fmtMoney} />
          <GoalRow label="Orders" value={orders} goal={goals.orders} />
          <GoalRow label="New Customers" value={newCustomers} goal={goals.newCustomers} />
        </div>
      )}
    </Card>
  );
};

/* ---------- Inventory Value ---------- */
const InventoryValueCard = ({ items }) => {
  const data = useMemo(() => {
    const inStock = items.filter((i) => i.status !== "sold" && i.status !== "archived");
    // For workshop pieces we prefer sale_price (what we'd get on the
    // market); falling back to total_cost (production cost) when no sale
    // price is set. For catalog rows, only sale_price exists.
    const valueOf = (i) => Number(i.sale_price || i.total_cost || 0);
    const total = inStock.reduce((a, b) => a + valueOf(b), 0);
    const grouped = {};
    inStock.forEach((i) => {
      const k = i.category || "Other";
      if (!grouped[k]) grouped[k] = { count: 0, total: 0 };
      grouped[k].count += 1;
      grouped[k].total += valueOf(i);
    });
    const breakdown = Object.entries(grouped)
      .map(([k, v]) => ({ label: k, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);
    return { total, count: inStock.length, breakdown };
  }, [items]);

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="text-base font-semibold text-stone-900">Inventory Value</div>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
      </div>

      <div className="mt-3">
        <div className="text-3xl font-bold text-stone-900">{fmtMoney(data.total)}</div>
        <div className="text-xs text-stone-500">{fmtNumber(data.count)} items in stock</div>
      </div>

      <div className="mt-4 space-y-1.5 text-sm">
        {data.breakdown.length === 0 ? (
          <div className="text-xs text-stone-400">No items in stock yet.</div>
        ) : (
          data.breakdown.map((b, idx) => (
            <div key={b.label} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: PALETTE[idx % PALETTE.length] }} />
                <span className="text-stone-700">{b.label}</span>
              </div>
              <div className="flex items-center gap-2 text-stone-700">
                <span className="tabular-nums">{fmtMoney(b.total)}</span>
                <span className="text-stone-400">({b.count})</span>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};

/* ---------- Upcoming Tasks ---------- */
const UpcomingTasksCard = ({ tasks, onChanged }) => {
  const data = useMemo(() => {
    const open = (tasks || []).filter((t) => t.status !== "done");
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const overdue = open.filter((t) => t.due_date && t.due_date.slice(0, 10) < todayStr).length;
    open.sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });
    return { items: open.slice(0, 5), overdue, todayStr };
  }, [tasks]);

  const toggle = async (task) => {
    try {
      await updateTask(task.id, { status: task.status === "done" ? "pending" : "done" });
      onChanged?.();
    } catch (e) {
      toast.error(e.message || "Failed to update task");
    }
  };

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-base font-semibold text-stone-900">Upcoming Tasks</div>
          {data.overdue > 0 && (
            <div className="text-xs font-semibold text-rose-600">{data.overdue} overdue</div>
          )}
        </div>
        <Link to="/crm/tasks" className="text-stone-400 hover:text-stone-700" title="View all tasks">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      <div className="mt-3 space-y-1.5">
        {data.items.length === 0 ? (
          <div className="py-6 text-center text-sm text-stone-400">No open tasks.</div>
        ) : (
          data.items.map((t) => {
            const isOverdue = t.due_date && t.due_date.slice(0, 10) < data.todayStr;
            return (
              <div key={t.id} className="group flex items-center justify-between gap-2 rounded-lg px-1.5 py-1.5 hover:bg-stone-50">
                <button
                  onClick={() => toggle(t)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-stone-300 transition group-hover:border-emerald-500" />
                  <span className="truncate text-sm text-stone-700">{t.title}</span>
                </button>
                {isOverdue && (
                  <span className="shrink-0 rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                    Overdue
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};

/* ---------- Page ---------- */
const JewelryDashboard = () => {
  const { user } = useUser();
  const userId = user?.id;
  const [items, setItems] = useState([]);
  const [deals, setDeals] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const reloadTasks = () => {
    if (!userId) return;
    fetchTasks(userId, { status: "pending" }).then(setTasks).catch(() => {});
  };

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.allSettled([
      fetchJewelryItems(userId, {}),
      fetchJewelryCatalog(),
      fetchDeals(userId),
      fetchContacts(userId),
      fetchTasks(userId, { status: "pending" }),
    ])
      .then(([itemsR, catalogR, dealsR, contactsR, tasksR]) => {
        const workshop = itemsR.status === "fulfilled"
          ? (itemsR.value.items || []).map((i) => ({
              ...i,
              __source: "workshop",
              category: normalizeJewelryCategory(i.category) || i.category,
            }))
          : [];
        const catalog = catalogR.status === "fulfilled"
          ? (catalogR.value?.jewelry || []).map(mapCatalogToItem)
          : [];
        // Single combined list — all KPIs/cards downstream just see "items".
        setItems([...workshop, ...catalog]);
        if (dealsR.status === "fulfilled") setDeals(Array.isArray(dealsR.value) ? dealsR.value : (dealsR.value?.deals || []));
        if (contactsR.status === "fulfilled") setContacts(Array.isArray(contactsR.value) ? contactsR.value : (contactsR.value?.contacts || []));
        if (tasksR.status === "fulfilled") setTasks(Array.isArray(tasksR.value) ? tasksR.value : (tasksR.value?.tasks || []));
      })
      .finally(() => setLoading(false));
  }, [userId]);

  /* ---- KPI computations (this month vs last month) ---- */
  const kpis = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const soldThis = items.filter((i) => i.sold_at && new Date(i.sold_at) >= monthStart);
    const soldLast = items.filter((i) => i.sold_at && new Date(i.sold_at) >= lastMonthStart && new Date(i.sold_at) < monthStart);

    const newCustomersThis = contacts.filter((c) => c.created_at && new Date(c.created_at) >= monthStart).length;
    const newCustomersLast = contacts.filter((c) => c.created_at && new Date(c.created_at) >= lastMonthStart && new Date(c.created_at) < monthStart).length;

    const itemsActive = items.filter((i) => i.status !== "archived").length;

    const revThis = soldThis.reduce((a, b) => a + Number(b.sale_price || 0), 0);
    const revLast = soldLast.reduce((a, b) => a + Number(b.sale_price || 0), 0);

    return {
      revenue: { value: revThis, delta: pctChange(revLast, revThis) },
      orders: { value: soldThis.length, delta: pctChange(soldLast.length, soldThis.length) },
      customers: { value: newCustomersThis, delta: pctChange(newCustomersLast, newCustomersThis) },
      items: { value: itemsActive, delta: null },
    };
  }, [items, contacts]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Jewelry Dashboard</h1>
        <p className="mt-0.5 text-sm text-stone-500">
          Overview of production, sales, and inventory.
        </p>
      </div>

      {loading && (
        <div className="mb-4 text-sm text-stone-400">Loading dashboard…</div>
      )}

      {/* Row 1: KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Revenue (MTD)"
          value={fmtMoney(kpis.revenue.value)}
          delta={kpis.revenue.delta}
          accent="emerald"
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V4m0 12v2m0 0c-3 0-6-1.5-6-4M6 8a6 6 0 1112 0" /></svg>}
        />
        <StatCard
          label="Orders"
          value={fmtNumber(kpis.orders.value)}
          delta={kpis.orders.delta}
          accent="sky"
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
        />
        <StatCard
          label="Customers"
          value={fmtNumber(kpis.customers.value)}
          delta={kpis.customers.delta}
          accent="amber"
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-7.13a4 4 0 11-8 0 4 4 0 018 0zm6 4a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
        />
        <StatCard
          label="Items"
          value={fmtNumber(kpis.items.value)}
          delta={kpis.items.delta}
          accent="violet"
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
        />
      </div>

      {/* Row 2: Revenue chart + Sales by Category + Sales Pipeline */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <RevenueChart items={items} />
        <SalesByCategoryCard items={items} />
        <SalesPipelineCard deals={deals} />
      </div>

      {/* Row 3: Monthly Goals + Inventory Value + Upcoming Tasks */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MonthlyGoalsCard
          revenue={kpis.revenue.value}
          orders={kpis.orders.value}
          newCustomers={kpis.customers.value}
        />
        <InventoryValueCard items={items} />
        <UpcomingTasksCard tasks={tasks} onChanged={reloadTasks} />
      </div>
    </div>
  );
};

export default JewelryDashboard;
