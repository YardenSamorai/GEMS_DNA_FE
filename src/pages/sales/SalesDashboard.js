import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTeam } from "../../context/TeamContext";
import { fetchShareEvents } from "../../services/stonesApi";

/* ============================================================================
 * SalesDashboard — the sales "Home". Shows what a rep has sent to clients via
 * WhatsApp: how many stones went out and exactly which ones.
 *
 * Scope is decided server-side: a salesman sees only their own sends, while
 * owners (admin) and managers see everyone's. We surface the active scope and,
 * when it's "all", also show who sent each stone.
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

const SalesDashboard = () => {
  const { actor, isAdmin, isManager } = useTeam();
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

  // Distinct reps (only meaningful in the "all" view).
  const repCount = useMemo(() => {
    if (!seesAll) return 0;
    return new Set(events.map((e) => e.actor_id || e.actor_name || "—")).size;
  }, [events, seesAll]);

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-app-ink">Dashboard</h1>
          <p className="mt-0.5 text-[13px] text-app-muted">
            {seesAll ? "Stones shared by the whole team" : "Stones you've shared with clients"}
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className={`mt-5 grid gap-3 ${seesAll ? "grid-cols-3" : "grid-cols-2"}`}>
        <StatCard
          label="Sent"
          value={loading ? "—" : (data?.count ?? 0).toLocaleString()}
          sub="total shares"
        />
        <StatCard
          label="Stones"
          value={loading ? "—" : (data?.uniqueStones ?? 0).toLocaleString()}
          sub="unique pieces"
        />
        {seesAll && (
          <StatCard label="Reps" value={loading ? "—" : repCount.toLocaleString()} sub="who shared" />
        )}
      </div>

      {/* List */}
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
                    <p className="truncate text-[14px] font-semibold text-app-ink">
                      {ev.title || ev.sku || "Stone"}
                    </p>
                    <p className="truncate text-[12px] text-app-muted">
                      {ev.sku}
                      {seesAll && ev.actor_name ? ` · ${ev.actor_name}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] tabular-nums text-app-soft">
                    {relTime(ev.created_at)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default SalesDashboard;
