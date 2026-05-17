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
    <div className="space-y-10 sm:space-y-12">
      {!historyMode && <PortalEditorialHero me={me} loading={loading} kpis={kpis} />}
      {historyMode && <PortalHistoryHero me={me} loading={loading} memoCount={memos.length} />}

      <section className="bg-portal-canvas border border-portal-line">
        <div className="px-5 sm:px-7 py-5 border-b border-portal-line flex items-center justify-between gap-3">
          <h2 className="flex items-baseline gap-2.5">
            <span className="text-[10px] tracking-[0.28em] uppercase text-portal-soft font-medium">
              {historyMode ? "Past memos" : "Active memos"}
            </span>
            <span className="text-[10px] text-portal-soft tabular-nums">{filtered.length}</span>
          </h2>
          <div className="relative w-44 sm:w-72">
            <svg className="w-3.5 h-3.5 absolute left-0 top-1/2 -translate-y-1/2 text-portal-soft pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-4.35-4.35m1.85-5.65a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search memo number or notes"
              className="w-full pl-6 pr-3 py-2 text-[12.5px] bg-transparent border-b border-portal-line2 focus:outline-none focus:border-portal-ink placeholder:text-portal-soft text-portal-ink tracking-wide"
            />
          </div>
        </div>

        {loading ? (
          <div className="divide-y divide-portal-line">
            {[1, 2, 3].map((i) => <SkeletonRow key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState historyMode={historyMode} hasMemos={memos.length > 0} />
        ) : (
          <div className="divide-y divide-portal-line">
            {filtered.map((m) => <MemoRow key={m.id} memo={m} />)}
          </div>
        )}
      </section>
    </div>
  );
}

/* ============================================================
   Editorial hero (active mode) — restrained "command centre".
     · Champagne hairline + eyebrow up top.
     · Cormorant display title with the store name in italic.
     · Quiet supplier line in graphite.
     · Two text-only CTAs: primary ink-on-bone, secondary underline.
     · KPI strip below in a single hairline-separated row, no
       coloured accent bars, value rendered in Cormorant.
   ============================================================ */
function PortalEditorialHero({ me, loading, kpis }) {
  const supplierName = me?.supplier?.name || "your supplier";
  const storeName    = me?.store?.name    || "your store";

  return (
    <section className="border-t border-portal-champagne/60">
      <div className="pt-8 sm:pt-12 pb-8 sm:pb-10">
        <div className="text-[10px] tracking-[0.32em] uppercase text-portal-champagne font-medium mb-4">
          Active consignment
        </div>
        <h1 className="font-serif-display text-[32px] sm:text-[44px] leading-[1.05] text-portal-ink tracking-tight max-w-2xl">
          Welcome back,{" "}
          <span className="italic">{storeName}</span>
        </h1>
        <p className="text-[13.5px] sm:text-[14px] text-portal-graphite mt-5 max-w-xl leading-relaxed">
          On consignment from <span className="text-portal-ink">{supplierName}</span>. Track every memo, attend to pending action items, and request new pieces — all from one secure surface.
        </p>
        <div className="mt-7 sm:mt-9 flex flex-wrap items-center gap-5">
          <Link
            to="/store-portal/catalog"
            className="inline-flex items-center px-7 py-3 bg-portal-ink text-portal-bone text-[11px] tracking-[0.28em] uppercase font-medium hover:bg-portal-graphite transition-colors"
          >
            Request a memo
          </Link>
          <Link
            to="/store-portal/requests"
            className="inline-flex items-center text-[11px] tracking-[0.28em] uppercase font-medium text-portal-ink hover:text-portal-champagne transition-colors border-b border-portal-line2 hover:border-portal-champagne pb-1"
          >
            View my requests
          </Link>
        </div>
      </div>

      {/* KPI strip — single horizontal row with hairline dividers. */}
      <div className="border-t border-portal-line">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-portal-line">
          <KpiStat label="Active memos"    value={loading ? null : kpis.activeCount} />
          <KpiStat label="Items on memo"   value={loading ? null : kpis.totalItemsOut} />
          <KpiStat
            label="Pending actions"
            value={loading ? null : kpis.pendingItems}
            highlight={kpis.pendingItems > 0}
          />
          <KpiStat
            label="Next due"
            value={loading ? null : (kpis.due ? kpis.due.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—")}
          />
        </div>
      </div>
    </section>
  );
}

/* History hero — quieter records view. */
function PortalHistoryHero({ me, loading, memoCount }) {
  const storeName    = me?.store?.name    || "your store";
  const supplierName = me?.supplier?.name || "your supplier";
  return (
    <section className="border-t border-portal-champagne/60 pt-8 sm:pt-12 pb-6">
      <div className="text-[10px] tracking-[0.32em] uppercase text-portal-champagne font-medium mb-4">
        Memo history
      </div>
      <h1 className="font-serif-display text-[30px] sm:text-[38px] leading-[1.1] text-portal-ink tracking-tight">
        <span className="italic">{storeName}</span>
      </h1>
      <div className="text-[13px] text-portal-graphite mt-4 leading-relaxed">
        {loading
          ? "Loading"
          : <>Records from <span className="text-portal-ink">{supplierName}</span> · <span className="text-portal-ink tabular-nums">{memoCount}</span> memo{memoCount === 1 ? "" : "s"} on file.</>
        }
      </div>
    </section>
  );
}

function KpiStat({ label, value, highlight = false }) {
  return (
    <div className="px-5 sm:px-7 py-5 sm:py-6">
      <div className="text-[10px] tracking-[0.28em] uppercase text-portal-soft font-medium">{label}</div>
      <div className={`font-serif-display text-[28px] sm:text-[32px] mt-2 leading-none tabular-nums truncate ${
        highlight ? "text-portal-champagne2" : "text-portal-ink"
      }`}>
        {value === null ? <span className="inline-block w-10 h-7 bg-portal-pearl align-bottom" /> : value}
      </div>
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
    // Tones use the portal palette so countdown urgency is signalled
    // without saturated rose/amber breaking the mood.
    if (days != null && days < 0)        countdown = { label: `Expired ${Math.abs(days)}d ago`, tone: "text-portal-champagne2" };
    else if (days === 0)                  countdown = { label: "Due today",                       tone: "text-portal-champagne2" };
    else if (days != null && days <= 7)   countdown = { label: `${days}d left`,                   tone: "text-portal-champagne" };
    else if (days != null)                countdown = { label: `${days}d left`,                   tone: "text-portal-muted" };
  }

  return (
    <Link
      to={`/store-portal/memos/${memo.id}`}
      className="group flex items-start gap-4 sm:gap-5 px-5 sm:px-7 py-5 hover:bg-portal-bone/60 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`inline-block text-[10px] uppercase tracking-[0.22em] font-medium px-2 py-0.5 border ${status.color}`}>
            {statusLabel}
          </span>
          {countdown && <span className={`text-[10.5px] tracking-[0.18em] uppercase font-medium ${countdown.tone}`}>{countdown.label}</span>}
          {memo.items_pending > 0 && (
            <span className="text-[10px] uppercase tracking-[0.22em] font-medium px-2 py-0.5 border border-portal-champagne/60 text-portal-champagne2">
              {memo.items_pending} pending
            </span>
          )}
        </div>
        <div className="font-serif-display text-portal-ink text-[20px] sm:text-[22px] mt-2 break-all group-hover:text-portal-champagne2 transition-colors leading-tight">
          {memo.memo_number}
        </div>
        <div className="text-[11.5px] text-portal-muted mt-2 truncate tracking-wide">
          {memo.item_count} {memo.item_count === 1 ? "item" : "items"}
          {memo.items_out > 0 && <> · {memo.items_out} on memo</>}
          {memo.supplier_name && <> · from {memo.supplier_name}</>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-serif-display text-[22px] sm:text-[24px] text-portal-ink whitespace-nowrap leading-none tabular-nums">
          ${Number(memo.total_value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
        <div className="text-[10px] tracking-[0.22em] uppercase text-portal-soft mt-2">
          {memo.issued_at ? new Date(memo.issued_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Not issued"}
        </div>
      </div>
      <svg className="w-3.5 h-3.5 text-portal-soft shrink-0 mt-3 hidden sm:block group-hover:text-portal-champagne group-hover:translate-x-1 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

/* --- Empty / skeleton --------------------------------------- */

function EmptyState({ historyMode, hasMemos }) {
  return (
    <div className="px-6 py-16 sm:py-20 text-center">
      <div className="h-px w-12 bg-portal-champagne mx-auto mb-6" />
      <div className="font-serif-display text-[22px] text-portal-ink">
        {historyMode ? "No past memos yet" : "No active memos"}
      </div>
      <div className="text-[12.5px] text-portal-muted mt-3 max-w-sm mx-auto leading-relaxed">
        {historyMode
          ? "Closed memos will show up here for your records."
          : hasMemos
            ? "Try a different search."
            : "When your supplier issues a memo to you, it'll appear here. In the meantime, browse the inventory and request the pieces you'd like to see."}
      </div>
      {!historyMode && !hasMemos && (
        <Link
          to="/store-portal/catalog"
          className="inline-flex items-center mt-8 px-7 py-3 bg-portal-ink text-portal-bone text-[11px] tracking-[0.28em] uppercase font-medium hover:bg-portal-graphite transition-colors"
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
      <div className="flex-1 min-w-0 space-y-3">
        <div className="h-3 w-20 bg-portal-pearl" />
        <div className="h-6 w-40 bg-portal-pearl" />
        <div className="h-3 w-48 bg-portal-pearl" />
      </div>
      <div className="text-right space-y-3">
        <div className="h-6 w-20 bg-portal-pearl ml-auto" />
        <div className="h-3 w-14 bg-portal-pearl ml-auto" />
      </div>
    </div>
  );
}
