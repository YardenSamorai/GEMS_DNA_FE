import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { fetchPortalMe, fetchPortalMemos } from "../../services/portalApi";
import { MEMO_STATUSES, isMemoEffectivelyExpired } from "../../services/memosApi";

/**
 * StorePortalMemos — premium home + history surface.
 *
 * Layout:
 *   1. Editorial hero — big supplier handshake, KPI strip (active /
 *      pending / total value / next due) and a primary CTA pointing
 *      to the catalog ("Request a memo").
 *   2. Active / past memo list with the same row design we already
 *      had, but cards are now a touch glassier and the row hover
 *      treatment is more refined.
 */
export default function StorePortalMemos({ historyMode = false }) {
  const { user } = useUser();
  const [me, setMe] = useState(null);
  const [memos, setMemos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    setLoading(true);
    Promise.all([
      fetchPortalMe(user.id),
      fetchPortalMemos(user.id, { status: historyMode ? "closed" : "active" }),
    ])
      .then(([profile, list]) => {
        if (!active) return;
        setMe(profile);
        setMemos(Array.isArray(list) ? list : []);
      })
      .catch((e) => active && toast.error(e.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [user?.id, historyMode]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return memos;
    return memos.filter((m) =>
      m.memo_number?.toLowerCase().includes(q) ||
      m.notes?.toLowerCase().includes(q)
    );
  }, [memos, search]);

  /* --- KPI math (active mode only) --- */
  const kpis = useMemo(() => {
    const active = memos.filter((m) => ["out", "partially_returned"].includes(m.status));
    const totalValue = active.reduce((s, m) => s + Number(m.total_value || 0), 0);
    const pendingItems = active.reduce((s, m) => s + Number(m.items_pending || 0), 0);
    const totalItemsOut = active.reduce((s, m) => s + Number(m.items_out || 0), 0);
    const due = active
      .map((m) => (m.due_at ? new Date(m.due_at) : null))
      .filter(Boolean)
      .sort((a, b) => a - b)[0];
    return { activeCount: active.length, totalValue, pendingItems, totalItemsOut, due };
  }, [memos]);

  return (
    <div className="space-y-6 sm:space-y-8">
      {!historyMode && <PortalEditorialHero me={me} loading={loading} kpis={kpis} />}
      {historyMode && <PortalHistoryHero me={me} loading={loading} memoCount={memos.length} />}

      <section className="glass-surface rounded-2xl sm:rounded-[28px] overflow-hidden">
        <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-glass-line/70 flex items-center justify-between gap-3">
          <h2 className="flex items-baseline gap-2.5">
            <span className="text-[15px] sm:text-[16px] font-semibold text-glass-ink tracking-tight">
              {historyMode ? "Past memos" : "Active memos"}
            </span>
            <span className="text-[12px] text-glass-soft tabular-nums">{filtered.length}</span>
          </h2>
          <div className="relative w-44 sm:w-72">
            <svg className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-glass-soft pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-4.35-4.35m1.85-5.65a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search memo number or notes"
              className="w-full pl-9 pr-3 py-2 rounded-full text-[13px] bg-white/55 border border-white/60 focus:outline-none focus:border-glass-line2 placeholder:text-glass-soft text-glass-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
            />
          </div>
        </div>

        {loading ? (
          <div className="divide-y divide-glass-line/70">
            {[1, 2, 3].map((i) => <SkeletonRow key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState historyMode={historyMode} hasMemos={memos.length > 0} />
        ) : (
          <div className="divide-y divide-glass-line/70">
            {filtered.map((m) => <MemoRow key={m.id} memo={m} />)}
          </div>
        )}
      </section>
    </div>
  );
}

/* ============================================================
   Glass hero (active mode) — Apple-style command centre.
     · Translucent glass card on the tonal canvas, soft inner edge.
     · Mid-weight Inter headline (no serif), tracking-tight.
     · Two pill CTAs: ink primary, glass secondary.
     · KPI strip lives inside the same glass surface; the values use
       Inter at a heavy weight with tabular-nums so the row reads as
       a single, calm dashboard.
   ============================================================ */
function PortalEditorialHero({ me, loading, kpis }) {
  const supplierName = me?.supplier?.name || "your supplier";
  const storeName    = me?.store?.name    || "your store";

  return (
    <section className="glass-surface rounded-2xl sm:rounded-[28px] overflow-hidden">
      <div className="px-6 sm:px-9 pt-7 sm:pt-10 pb-8 sm:pb-10">
        <div className="text-[10.5px] tracking-[0.14em] uppercase text-glass-muted font-medium mb-3">
          Active consignment
        </div>
        <h1 className="text-[28px] sm:text-[36px] leading-[1.1] text-glass-ink font-semibold tracking-tight max-w-2xl">
          Welcome back, {storeName}.
        </h1>
        <p className="text-[14px] sm:text-[15px] text-glass-muted mt-4 max-w-xl leading-relaxed">
          On consignment from <span className="text-glass-ink font-medium">{supplierName}</span>. Track every memo, attend to pending action items, and request new pieces — all from one secure surface.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link
            to="/store-portal/catalog"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-glass-ink text-white text-[13.5px] font-medium hover:bg-glass-graphite transition-colors shadow-[0_6px_18px_-8px_rgba(20,22,28,0.45)]"
          >
            Request a memo
            <svg className="w-3.5 h-3.5 -mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            to="/store-portal/requests"
            className="inline-flex items-center px-5 py-2.5 rounded-full bg-white/55 backdrop-blur-md border border-white/65 text-glass-ink text-[13.5px] font-medium hover:bg-white/75 transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]"
          >
            View my requests
          </Link>
        </div>
      </div>

      {/* KPI strip — same glass card, separated by a soft hairline. */}
      <div className="border-t border-glass-line/70">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-glass-line/70">
          <KpiStat label="Active memos"    value={loading ? null : kpis.activeCount} />
          <KpiStat label="Items on memo"   value={loading ? null : kpis.totalItemsOut} />
          <KpiStat
            label="Pending actions"
            value={loading ? null : kpis.pendingItems}
            highlight={kpis.pendingItems > 0}
          />
          <KpiStat
            label="Next due"
            value={loading ? null : (kpis.due ? kpis.due.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—")}
          />
        </div>
      </div>
    </section>
  );
}

/* History hero — quieter records view, same glass language. */
function PortalHistoryHero({ me, loading, memoCount }) {
  const storeName    = me?.store?.name    || "your store";
  const supplierName = me?.supplier?.name || "your supplier";
  return (
    <section className="glass-surface rounded-2xl sm:rounded-[28px] px-6 sm:px-9 py-7 sm:py-9">
      <div className="text-[10.5px] tracking-[0.14em] uppercase text-glass-muted font-medium mb-3">
        Memo history
      </div>
      <h1 className="text-[26px] sm:text-[32px] leading-[1.12] text-glass-ink font-semibold tracking-tight">
        {storeName}
      </h1>
      <div className="text-[14px] text-glass-muted mt-3 leading-relaxed">
        {loading
          ? "Loading…"
          : <>Records from <span className="text-glass-ink font-medium">{supplierName}</span> · <span className="text-glass-ink tabular-nums font-medium">{memoCount}</span> memo{memoCount === 1 ? "" : "s"} on file.</>
        }
      </div>
    </section>
  );
}

function KpiStat({ label, value, highlight = false }) {
  return (
    <div className="px-5 sm:px-7 py-5">
      <div className="text-[10.5px] tracking-[0.14em] uppercase text-glass-muted font-medium">{label}</div>
      <div className={`text-[26px] sm:text-[30px] font-semibold tracking-tight mt-1.5 leading-none tabular-nums truncate ${
        highlight ? "text-glass-ink" : "text-glass-ink"
      }`}>
        {value === null ? <span className="inline-block w-10 h-7 rounded bg-glass-canvas2 align-bottom" /> : value}
      </div>
      {highlight && value > 0 && (
        <div className="mt-1.5 inline-flex items-center gap-1.5 text-[10.5px] text-portal-champagne2 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-portal-champagne" />
          Action required
        </div>
      )}
    </div>
  );
}

/* --- One memo row ------------------------------------------- */

function MemoRow({ memo }) {
  const expired = isMemoEffectivelyExpired(memo);
  const effectiveStatus = expired ? "expired" : memo.status;
  const status = MEMO_STATUSES.find((s) => s.value === effectiveStatus) || MEMO_STATUSES[0];
  // Portal-specific label override — see MEMO_STATUSES doc-comment.
  // From the store's perspective `out` means "in our shop on memo",
  // so the pill reads "IN" instead of "OUT".
  const statusLabel = status.portalLabel || status.label;

  const days = memo.due_at
    ? Math.ceil((new Date(memo.due_at).getTime() - Date.now()) / 86400_000)
    : null;
  let countdown = null;
  if (memo.status === "out" || memo.status === "partially_returned") {
    if (days != null && days < 0)        countdown = { label: `Expired ${Math.abs(days)}d ago`, tone: "text-portal-champagne2" };
    else if (days === 0)                 countdown = { label: "Due today",                       tone: "text-portal-champagne2" };
    else if (days != null && days <= 7)  countdown = { label: `${days}d left`,                   tone: "text-portal-champagne" };
    else if (days != null)               countdown = { label: `${days}d left`,                   tone: "text-glass-muted" };
  }

  return (
    <Link
      to={`/store-portal/memos/${memo.id}`}
      className="group flex items-start gap-4 sm:gap-5 px-5 sm:px-7 py-5 hover:bg-white/45 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className={`inline-flex items-center text-[10.5px] font-medium px-2 py-0.5 rounded-full border ${status.color}`}>
            {statusLabel}
          </span>
          {countdown && <span className={`text-[11.5px] font-medium ${countdown.tone}`}>{countdown.label}</span>}
          {memo.items_pending > 0 && (
            <span className="inline-flex items-center text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-portal-champagne/12 text-portal-champagne2">
              {memo.items_pending} pending
            </span>
          )}
        </div>
        <div className="text-glass-ink text-[16px] sm:text-[17px] font-semibold mt-2 break-all group-hover:text-black transition-colors tracking-tight">
          {memo.memo_number}
        </div>
        <div className="text-[12.5px] text-glass-muted mt-1 truncate">
          {memo.item_count} {memo.item_count === 1 ? "item" : "items"}
          {memo.items_out > 0 && <> · {memo.items_out} on memo</>}
          {memo.supplier_name && <> · from {memo.supplier_name}</>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[18px] sm:text-[20px] text-glass-ink font-semibold whitespace-nowrap leading-none tabular-nums tracking-tight">
          ${Number(memo.total_value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </div>
        <div className="text-[11.5px] text-glass-soft mt-2">
          {memo.issued_at ? new Date(memo.issued_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Not issued"}
        </div>
      </div>
      <svg className="w-4 h-4 text-glass-soft shrink-0 mt-2 hidden sm:block group-hover:text-glass-ink group-hover:translate-x-1 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

/* --- Empty / skeleton --------------------------------------- */

function EmptyState({ historyMode, hasMemos }) {
  return (
    <div className="px-6 py-16 sm:py-20 text-center">
      <div className="w-12 h-12 mx-auto rounded-2xl bg-white/60 border border-white/65 backdrop-blur-md flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
        <svg className="w-5 h-5 text-glass-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      <div className="text-[18px] font-semibold tracking-tight text-glass-ink mt-5">
        {historyMode ? "No past memos yet" : "No active memos"}
      </div>
      <div className="text-[13px] text-glass-muted mt-2 max-w-sm mx-auto leading-relaxed">
        {historyMode
          ? "Closed memos will show up here for your records."
          : hasMemos
            ? "Try a different search."
            : "When your supplier issues a memo to you, it'll appear here. In the meantime, browse the inventory and request the pieces you'd like to see."}
      </div>
      {!historyMode && !hasMemos && (
        <Link
          to="/store-portal/catalog"
          className="inline-flex items-center mt-6 px-5 py-2.5 rounded-full bg-glass-ink text-white text-[13.5px] font-medium hover:bg-glass-graphite transition-colors shadow-[0_6px_18px_-8px_rgba(20,22,28,0.45)]"
        >
          Browse inventory
        </Link>
      )}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-start gap-5 px-5 sm:px-7 py-5 animate-pulse">
      <div className="flex-1 min-w-0 space-y-2.5">
        <div className="h-3 w-20 rounded bg-glass-canvas2" />
        <div className="h-5 w-40 rounded bg-glass-canvas2" />
        <div className="h-3 w-48 rounded bg-glass-canvas2" />
      </div>
      <div className="text-right space-y-2.5">
        <div className="h-5 w-20 rounded bg-glass-canvas2 ml-auto" />
        <div className="h-3 w-14 rounded bg-glass-canvas2 ml-auto" />
      </div>
    </div>
  );
}
