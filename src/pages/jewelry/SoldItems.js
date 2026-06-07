import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { useRouteLoading } from "../../components/RouteLoadingContext";
import { fetchJewelryItems } from "../../services/jewelryApi";

/* ============================================================================
 * Sold Items — history of every workshop piece marked `status='sold'`.
 *
 * Selling a jewelry item (SellItemModal → /sell) stamps the row with
 * `sale_price`, `sold_at`, `contact_id`/`contact_name` and links the won
 * `deal_id`/`deal_title`. This page is the dedicated ledger of that history:
 * KPIs across the selected window, search + sort, and a row per piece with
 * deep links back to the item, the buyer and the CRM deal.
 * ========================================================================== */

const fmtMoney = (n) => `$${Math.round(Number(n) || 0).toLocaleString()}`;

const fmtMoneyCompact = (n) => {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${Math.round(v).toLocaleString()}`;
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

// Gross margin on revenue: (price − cost) / price. Null when no price.
const marginPct = (item) => {
  const price = Number(item.sale_price) || 0;
  const cost = Number(item.total_cost) || 0;
  if (!price) return null;
  return Math.round(((price - cost) / price) * 100);
};

const marginColor = (m) =>
  m == null
    ? "text-app-soft"
    : m >= 50
    ? "text-emerald-600"
    : m >= 25
    ? "text-amber-600"
    : m >= 0
    ? "text-app-graphite"
    : "text-red-500";

const RANGES = [
  { id: "all", label: "All time", days: null },
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "90", label: "Last 90 days", days: 90 },
  { id: "365", label: "Last 12 months", days: 365 },
];

const SORTS = [
  { id: "recent", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "price_desc", label: "Highest price" },
  { id: "price_asc", label: "Lowest price" },
  { id: "margin_desc", label: "Best margin" },
];

/* ---------- Small presentational bits ---------- */

const Kpi = ({ label, value, sub, accent }) => (
  <div className="rounded-2xl glass-surface p-4">
    <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-app-soft">{label}</div>
    <div className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums ${accent || "text-app-ink"}`}>
      {value}
    </div>
    {sub && <div className="mt-0.5 text-[11.5px] text-app-muted">{sub}</div>}
  </div>
);

const Thumb = ({ src, alt }) =>
  src ? (
    <img src={src} alt={alt} loading="lazy" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
  ) : (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-app-canvas-2 text-app-soft">
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3l3.057-3 4.886 0L16 3l4 5-8 13L4 8l1-5z" />
      </svg>
    </div>
  );

/* ---------- Page ---------- */

const SoldItems = () => {
  const { user } = useUser();
  const userId = user?.id;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  useRouteLoading(initialLoading);

  const [search, setSearch] = useState("");
  const [range, setRange] = useState("all");
  const [sort, setSort] = useState("recent");

  const load = useCallback(() => {
    if (!userId) return;
    setLoading(true);
    fetchJewelryItems(userId, {})
      .then((res) => {
        const all = res.items || [];
        setItems(all.filter((i) => i.status === "sold"));
      })
      .catch((err) => toast.error(err.message || "Failed to load sold items"))
      .finally(() => {
        setLoading(false);
        setInitialLoading(false);
      });
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Window filter (by sold_at), then search, then sort.
  const visible = useMemo(() => {
    const cutoff = (() => {
      const r = RANGES.find((x) => x.id === range);
      if (!r?.days) return null;
      const d = new Date();
      d.setDate(d.getDate() - r.days);
      return d.getTime();
    })();

    const q = search.trim().toLowerCase();

    let rows = items.filter((it) => {
      if (cutoff != null) {
        if (!it.sold_at) return false;
        if (new Date(it.sold_at).getTime() < cutoff) return false;
      }
      if (q) {
        const hay = `${it.name || ""} ${it.sku || ""} ${it.contact_name || ""} ${it.category || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const byDate = (a, b) => new Date(b.sold_at || 0) - new Date(a.sold_at || 0);
    rows = rows.sort((a, b) => {
      switch (sort) {
        case "oldest": return -byDate(a, b);
        case "price_desc": return (Number(b.sale_price) || 0) - (Number(a.sale_price) || 0);
        case "price_asc": return (Number(a.sale_price) || 0) - (Number(b.sale_price) || 0);
        case "margin_desc": return (marginPct(b) ?? -Infinity) - (marginPct(a) ?? -Infinity);
        default: return byDate(a, b);
      }
    });
    return rows;
  }, [items, range, search, sort]);

  // KPIs computed over the windowed set (ignores the text search so the
  // headline numbers reflect the period, not the current query).
  const stats = useMemo(() => {
    const cutoff = (() => {
      const r = RANGES.find((x) => x.id === range);
      if (!r?.days) return null;
      const d = new Date();
      d.setDate(d.getDate() - r.days);
      return d.getTime();
    })();
    const windowed = items.filter((it) => {
      if (cutoff == null) return true;
      if (!it.sold_at) return false;
      return new Date(it.sold_at).getTime() >= cutoff;
    });
    const revenue = windowed.reduce((a, b) => a + (Number(b.sale_price) || 0), 0);
    const cost = windowed.reduce((a, b) => a + (Number(b.total_cost) || 0), 0);
    const profit = revenue - cost;
    const avgMargin = revenue > 0 ? Math.round((profit / revenue) * 100) : null;
    return { count: windowed.length, revenue, profit, avgMargin };
  }, [items, range]);

  const selectCls =
    "h-9 rounded-lg border border-app-line bg-app-canvas-2 px-3 text-[13px] text-app-ink focus:border-app-line-2 focus:outline-none";

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h1 className="text-2xl font-semibold tracking-tight text-app-ink">Sold Items</h1>
            <span className="text-sm text-app-muted">History &amp; performance</span>
          </div>
          <p className="mt-1 text-xs text-app-soft">
            Every piece you've sold, with buyer and deal links.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={range} onChange={(e) => setRange(e.target.value)} className={selectCls} aria-label="Time range">
            {RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Pieces sold" value={loading ? "—" : stats.count.toLocaleString()} />
        <Kpi label="Revenue" value={loading ? "—" : fmtMoneyCompact(stats.revenue)} sub={loading ? "" : fmtMoney(stats.revenue)} />
        <Kpi
          label="Profit"
          value={loading ? "—" : fmtMoneyCompact(stats.profit)}
          sub={loading ? "" : fmtMoney(stats.profit)}
          accent={stats.profit >= 0 ? "text-emerald-600" : "text-red-500"}
        />
        <Kpi label="Avg margin" value={loading ? "—" : stats.avgMargin == null ? "—" : `${stats.avgMargin}%`} accent={marginColor(stats.avgMargin)} />
      </div>

      {/* Controls */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by piece, SKU, buyer…"
            className="h-9 w-full rounded-lg border border-app-line bg-app-canvas-2 pl-9 pr-3 text-[13px] text-app-ink placeholder:text-app-soft focus:border-app-line-2 focus:outline-none"
          />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className={selectCls} aria-label="Sort">
          {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      {/* Body */}
      <div className="mt-4 overflow-hidden rounded-2xl glass-surface">
        {loading ? (
          <div className="divide-y divide-app-line">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <div className="h-10 w-10 animate-pulse rounded-lg bg-app-canvas-2" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 animate-pulse rounded bg-app-canvas-2" />
                  <div className="h-2.5 w-24 animate-pulse rounded bg-app-canvas-2" />
                </div>
                <div className="h-3 w-16 animate-pulse rounded bg-app-canvas-2" />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-app-canvas-2 text-app-soft">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="mt-3 text-[15px] font-semibold text-app-ink">
              {items.length === 0 ? "No sold pieces yet" : "Nothing matches your filters"}
            </h3>
            <p className="mt-1 max-w-sm text-[13px] text-app-muted">
              {items.length === 0
                ? "When you mark a workshop piece as sold it will appear here with the buyer and deal."
                : "Try a wider time range or clear the search."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-app-line text-[11px] uppercase tracking-[0.06em] text-app-soft">
                  <th className="px-4 py-3 font-medium">Piece</th>
                  <th className="px-3 py-3 font-medium">Buyer</th>
                  <th className="px-3 py-3 font-medium">Sold</th>
                  <th className="px-3 py-3 text-right font-medium">Price</th>
                  <th className="px-3 py-3 text-right font-medium">Cost</th>
                  <th className="px-3 py-3 text-right font-medium">Profit</th>
                  <th className="px-3 py-3 text-right font-medium">Margin</th>
                  <th className="px-4 py-3 text-right font-medium">Deal</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((it) => {
                  const m = marginPct(it);
                  const profit = (Number(it.sale_price) || 0) - (Number(it.total_cost) || 0);
                  return (
                    <tr key={it.id} className="border-b border-app-line/70 transition-colors hover:bg-app-canvas-2/60">
                      <td className="px-4 py-3">
                        <Link to={`/jewelry/items/${it.id}`} className="flex items-center gap-3 group">
                          <Thumb src={it.cover_image_url} alt={it.name} />
                          <div className="min-w-0">
                            <div className="truncate font-medium text-app-ink group-hover:underline" title={it.name}>
                              {it.name || "Untitled"}
                            </div>
                            <div className="truncate font-mono text-[11.5px] text-app-soft">
                              {it.sku || "—"}{it.category ? ` · ${it.category}` : ""}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        {it.contact_id ? (
                          <Link to={`/crm/customers/${it.contact_id}`} className="text-app-graphite hover:text-app-ink hover:underline">
                            {it.contact_name || `Contact #${it.contact_id}`}
                          </Link>
                        ) : (
                          <span className="text-app-soft">{it.contact_name || "—"}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-app-muted">{fmtDate(it.sold_at)}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-app-ink">{fmtMoney(it.sale_price)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-app-muted">{fmtMoney(it.total_cost)}</td>
                      <td className={`px-3 py-3 text-right font-medium tabular-nums ${profit >= 0 ? "text-app-ink" : "text-red-500"}`}>
                        {fmtMoney(profit)}
                      </td>
                      <td className={`px-3 py-3 text-right font-semibold tabular-nums ${marginColor(m)}`}>
                        {m == null ? "—" : `${m}%`}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {it.deal_id ? (
                          <Link to={`/crm/deals?focus=${it.deal_id}`} className="text-[12.5px] font-medium text-emerald-600 hover:underline">
                            View →
                          </Link>
                        ) : (
                          <span className="text-app-soft">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && visible.length > 0 && (
        <div className="mt-3 text-[11.5px] text-app-soft">
          Showing {visible.length} of {items.length} sold {items.length === 1 ? "piece" : "pieces"}
        </div>
      )}
    </div>
  );
};

export default SoldItems;
