import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://gems-dna-be.onrender.com";

/* Phase D — Reports.
 * Pulls /api/dashboard/reports once and renders five blocks:
 *   1. Revenue trend (paid invoices over the last N months)
 *   2. Production throughput KPIs
 *   3. Workshop pipeline distribution
 *   4. Top customers (combined deals + jewelry)
 *   5. Recent sold pieces with profit margins
 *
 * Charts are hand-rolled SVG so we don't add a charting dep.
 */
const Reports = () => {
  const { user, isSignedIn } = useUser();
  const [data, setData] = useState(null);
  const [months, setMonths] = useState(12);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!isSignedIn || !user?.id) return;
    let alive = true;
    setLoading(true);
    setErr(null);
    fetch(`${API_BASE}/api/dashboard/reports?userId=${encodeURIComponent(user.id)}&months=${months}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed"))))
      .then((res) => alive && setData(res))
      .catch((e) => alive && setErr(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [isSignedIn, user?.id, months]);

  const fmtMoney = (n) =>
    n == null
      ? "—"
      : n >= 1000000
      ? `$${(n / 1000000).toFixed(2)}M`
      : n >= 1000
      ? `$${(n / 1000).toFixed(1)}k`
      : `$${Math.round(n).toLocaleString()}`;

  const totalRevenue = useMemo(
    () => (data?.revenueByMonth || []).reduce((s, r) => s + Number(r.revenue || 0), 0),
    [data]
  );
  const totalInvoices = useMemo(
    () => (data?.revenueByMonth || []).reduce((s, r) => s + Number(r.invoices || 0), 0),
    [data]
  );
  const profit90d = useMemo(() => {
    const t = data?.throughput || {};
    return Number(t.sold_90d_value || 0) - Number(t.sold_90d_cost || 0);
  }, [data]);
  const margin90d = useMemo(() => {
    const t = data?.throughput || {};
    const v = Number(t.sold_90d_value || 0);
    if (!v) return null;
    return Math.round(((v - Number(t.sold_90d_cost || 0)) / v) * 100);
  }, [data]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Reports</h1>
          <p className="text-sm text-stone-500">
            Production throughput, revenue trend, and where the money lives.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-stone-500">Range:</span>
          {[3, 6, 12, 24].map((n) => (
            <button
              key={n}
              onClick={() => setMonths(n)}
              className={`rounded-lg px-2.5 py-1 font-medium transition ${
                months === n
                  ? "bg-app-ink text-app-canvas"
                  : "glass-surface text-app-graphite hover:bg-app-surface/80"
              }`}
            >
              {n}m
            </button>
          ))}
        </div>
      </header>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load reports: {err}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label={`Revenue · ${months}m`}
          value={fmtMoney(totalRevenue)}
          sub={`${totalInvoices} invoices`}
          loading={loading}
        />
        <KpiCard
          label="Sold (90 days)"
          value={String(data?.throughput?.sold_90d ?? 0)}
          sub={fmtMoney(Number(data?.throughput?.sold_90d_value || 0))}
          loading={loading}
        />
        <KpiCard
          label="Profit (90 days)"
          value={fmtMoney(profit90d)}
          sub={margin90d != null ? `${margin90d}% margin` : "—"}
          loading={loading}
          tone={profit90d >= 0 ? "emerald" : "rose"}
        />
        <KpiCard
          label="Avg lead time"
          value={
            data?.throughput?.avg_days_to_sell != null
              ? `${Math.round(Number(data.throughput.avg_days_to_sell))} d`
              : "—"
          }
          sub="created → sold"
          loading={loading}
        />
      </div>

      {/* Revenue chart */}
      <section className="rounded-xl glass-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-stone-900">Revenue trend</h2>
          <span className="text-xs text-stone-500">paid invoices · last {months} months</span>
        </div>
        {loading ? (
          <div className="h-44 animate-pulse rounded-lg bg-stone-100" />
        ) : (data?.revenueByMonth || []).length === 0 ? (
          <EmptyBlock note="No paid invoices in this window." />
        ) : (
          <RevenueBarChart rows={data.revenueByMonth} />
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Workshop pipeline */}
        <section className="rounded-xl glass-surface p-5">
          <h2 className="mb-3 text-base font-semibold text-stone-900">Workshop pipeline</h2>
          {loading ? (
            <div className="h-40 animate-pulse rounded-lg bg-stone-100" />
          ) : (data?.jewelryByStatus || []).length === 0 ? (
            <EmptyBlock note="No active jewelry items." />
          ) : (
            <StackedRows
              rows={data.jewelryByStatus}
              labelKey="status"
              valueKey="count"
              extra={(r) => `${fmtMoney(Number(r.cost || 0))} cost · ${fmtMoney(Number(r.sale_value || 0))} potential`}
            />
          )}
        </section>

        {/* Sales pipeline */}
        <section className="rounded-xl glass-surface p-5">
          <h2 className="mb-3 text-base font-semibold text-stone-900">Sales pipeline</h2>
          {loading ? (
            <div className="h-40 animate-pulse rounded-lg bg-stone-100" />
          ) : (data?.pipelineByStage || []).length === 0 ? (
            <EmptyBlock note="No deals yet." />
          ) : (
            <StackedRows
              rows={data.pipelineByStage}
              labelKey="stage"
              valueKey="value"
              extra={(r) => `${r.count} deals`}
              fmtValue={fmtMoney}
            />
          )}
        </section>
      </div>

      {/* Top customers */}
      <section className="rounded-xl glass-surface p-5">
        <h2 className="mb-3 text-base font-semibold text-stone-900">Top customers</h2>
        {loading ? (
          <div className="h-40 animate-pulse rounded-lg bg-stone-100" />
        ) : (data?.topCustomers || []).length === 0 ? (
          <EmptyBlock note="No revenue attributed to customers yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-stone-500">
                <tr className="border-b border-stone-200">
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Deals won</th>
                  <th className="py-2 pr-3">Pieces sold</th>
                  <th className="py-2 pr-3 text-right">Total spend</th>
                </tr>
              </thead>
              <tbody>
                {data.topCustomers.map((c) => {
                  const personName = (c.name || "").trim();
                  const company = (c.company || "").trim();
                  const name = c.type === "business"
                    ? company || personName
                    : personName || company;
                  return (
                    <tr key={c.id} className="border-b border-stone-100 hover:bg-stone-50">
                      <td className="py-2 pr-3">
                        <Link to={`/crm/customers/${c.id}`} className="font-medium text-emerald-700 hover:underline">
                          {name || `Contact #${c.id}`}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-stone-700">{c.deals_won}</td>
                      <td className="py-2 pr-3 text-stone-700">{c.jewelry_sold}</td>
                      <td className="py-2 pr-3 text-right font-semibold text-stone-900">
                        {fmtMoney(Number(c.total_value || 0))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent sold pieces with margins */}
      <section className="rounded-xl glass-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-stone-900">Recent sold pieces · profit margin</h2>
          <Link to="/jewelry/sold" className="text-xs font-medium text-emerald-700 hover:underline">
            View all sold →
          </Link>
        </div>
        {loading ? (
          <div className="h-40 animate-pulse rounded-lg bg-stone-100" />
        ) : (data?.recentSales || []).length === 0 ? (
          <EmptyBlock note="Nothing sold yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-stone-500">
                <tr className="border-b border-stone-200">
                  <th className="py-2 pr-3">Piece</th>
                  <th className="py-2 pr-3">Sold</th>
                  <th className="py-2 pr-3 text-right">Sale</th>
                  <th className="py-2 pr-3 text-right">Cost</th>
                  <th className="py-2 pr-3 text-right">Profit</th>
                  <th className="py-2 pr-3 text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {data.recentSales.map((p) => {
                  const margin = p.margin_pct != null ? Number(p.margin_pct) : null;
                  const marginColor =
                    margin == null
                      ? "text-stone-500"
                      : margin >= 50
                      ? "text-emerald-700"
                      : margin >= 25
                      ? "text-amber-700"
                      : margin >= 0
                      ? "text-stone-700"
                      : "text-red-600";
                  return (
                    <tr key={p.id} className="border-b border-stone-100 hover:bg-stone-50">
                      <td className="py-2 pr-3">
                        <Link to={`/jewelry/items/${p.id}`} className="text-emerald-700 hover:underline">
                          <span className="font-mono text-xs">{p.sku}</span>
                          {p.name && <span className="ml-2 text-stone-700">{p.name}</span>}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-stone-500 text-xs">
                        {p.sold_at ? new Date(p.sold_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right text-stone-900">{fmtMoney(Number(p.sale_price || 0))}</td>
                      <td className="py-2 pr-3 text-right text-stone-500">{fmtMoney(Number(p.total_cost || 0))}</td>
                      <td className={`py-2 pr-3 text-right font-medium ${Number(p.profit) >= 0 ? "text-stone-900" : "text-red-600"}`}>
                        {fmtMoney(Number(p.profit || 0))}
                      </td>
                      <td className={`py-2 pr-3 text-right font-semibold ${marginColor}`}>
                        {margin != null ? `${margin}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Stone activity */}
      {data?.stoneActivity && (
        <section className="rounded-xl glass-surface p-5">
          <h2 className="mb-3 text-base font-semibold text-stone-900">Stone consumption</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Currently reserved" value={data.stoneActivity.reserved} tone="amber" />
            <MiniStat label="In setting" value={data.stoneActivity.in_setting} tone="violet" />
            <MiniStat label="Sold" value={data.stoneActivity.sold} tone="stone" />
            <MiniStat label="Total ever consumed" value={data.stoneActivity.consumed_total} tone="emerald" />
          </div>
        </section>
      )}
    </div>
  );
};

const KpiCard = ({ label, value, sub, loading, tone = "stone" }) => (
  <div className="rounded-xl glass-surface p-4">
    <div className="text-[11px] font-medium uppercase tracking-wide text-stone-500">{label}</div>
    <div
      className={`mt-1 text-2xl font-bold ${
        tone === "emerald"
          ? "text-emerald-700"
          : tone === "rose"
          ? "text-rose-700"
          : "text-stone-900"
      }`}
    >
      {loading ? <span className="inline-block h-6 w-20 animate-pulse rounded bg-stone-100" /> : value}
    </div>
    <div className="text-[11px] text-stone-500">{loading ? "" : sub}</div>
  </div>
);

const MiniStat = ({ label, value, tone }) => {
  const cls = {
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    violet: "bg-violet-50 text-violet-800 border-violet-200",
    emerald: "bg-emerald-50 text-emerald-800 border-emerald-200",
    stone: "bg-stone-50 text-stone-800 border-stone-200",
  }[tone] || "bg-stone-50 text-stone-800 border-stone-200";
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="text-2xl font-bold leading-none">{Number(value || 0).toLocaleString()}</div>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-wide opacity-80">{label}</div>
    </div>
  );
};

const EmptyBlock = ({ note }) => (
  <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50 px-4 py-8 text-center text-xs text-stone-500">
    {note}
  </div>
);

const RevenueBarChart = ({ rows }) => {
  const max = Math.max(1, ...rows.map((r) => Number(r.revenue || 0)));
  const fmt = (n) =>
    n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`;
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-full items-end gap-2" style={{ minHeight: 200 }}>
        {rows.map((r) => {
          const v = Number(r.revenue || 0);
          const h = Math.max(4, Math.round((v / max) * 180));
          return (
            <div key={r.month} className="flex flex-1 min-w-[36px] flex-col items-center gap-1">
              <div className="text-[10px] font-medium text-stone-700">{fmt(v)}</div>
              <div
                className="w-full rounded-t bg-gradient-to-t from-emerald-500 to-emerald-400"
                style={{ height: `${h}px` }}
                title={`${r.month}: ${fmt(v)} (${r.invoices} invoices)`}
              />
              <div className="text-[10px] text-stone-500">{r.month?.slice(5)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const StackedRows = ({ rows, labelKey, valueKey, extra, fmtValue }) => {
  const max = Math.max(1, ...rows.map((r) => Number(r[valueKey] || 0)));
  const fmt = fmtValue || ((n) => Number(n).toLocaleString());
  return (
    <div className="space-y-2">
      {rows.map((r, i) => {
        const v = Number(r[valueKey] || 0);
        const pct = (v / max) * 100;
        return (
          <div key={`${r[labelKey]}-${i}`}>
            <div className="mb-0.5 flex items-baseline justify-between text-xs">
              <span className="font-medium capitalize text-stone-800">{r[labelKey]}</span>
              <span className="font-semibold text-stone-900">{fmt(v)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
            {extra && <div className="mt-0.5 text-[10px] text-stone-500">{extra(r)}</div>}
          </div>
        );
      })}
    </div>
  );
};

export default Reports;
