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
    <div className="space-y-5 sm:space-y-7">
      {!historyMode && <PortalEditorialHero me={me} loading={loading} kpis={kpis} />}
      {historyMode && <PortalHistoryHero me={me} loading={loading} memoCount={memos.length} />}

      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-stone-200 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-stone-900 text-sm sm:text-base flex items-center gap-2">
            {historyMode ? "Past memos" : "Active memos"}
            <span className="text-[11px] font-bold text-stone-400">{filtered.length}</span>
          </h2>
          <div className="relative w-40 sm:w-72">
            <svg className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.85-5.65a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search memo number or notes…"
              className="w-full pl-8 pr-3 py-2 text-xs sm:text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 bg-white placeholder-stone-400"
            />
          </div>
        </div>

        {loading ? (
          <div className="divide-y divide-stone-100">
            {[1, 2, 3].map((i) => <SkeletonRow key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState historyMode={historyMode} hasMemos={memos.length > 0} />
        ) : (
          <div className="divide-y divide-stone-100">
            {filtered.map((m) => <MemoRow key={m.id} memo={m} />)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Editorial hero (active mode)
   Dark gradient panel + glass info card overlapping it from below.
   Kpi strip lives inside the glass card so the page has a clear
   "command centre" feel above the list.
   ============================================================ */
function PortalEditorialHero({ me, loading, kpis }) {
  const supplierName = me?.supplier?.name || "your supplier";
  const storeName    = me?.store?.name    || "Your store";
  const storeLogo    = me?.store?.logo_url;

  return (
    <section className="relative">
      <div className="rounded-3xl overflow-hidden relative bg-gradient-to-br from-slate-900 via-indigo-900 to-violet-900 text-white pt-6 sm:pt-9 pb-20 sm:pb-24 px-5 sm:px-9">
        <div className="absolute inset-0 opacity-30 mix-blend-screen pointer-events-none">
          <div className="absolute -top-20 -right-10 w-72 h-72 bg-indigo-400 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-blue-500 rounded-full blur-3xl" />
        </div>
        <div className="relative">
          <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-indigo-200/90 mb-2">
            Active consignment
          </div>
          <h1 className="text-[26px] sm:text-4xl font-bold leading-tight tracking-tight max-w-2xl">
            Welcome back, <span className="bg-gradient-to-r from-blue-200 via-white to-violet-200 bg-clip-text text-transparent">{storeName}</span>
          </h1>
          <p className="text-sm sm:text-base text-indigo-100/80 mt-2 max-w-xl">
            On consignment from <span className="text-white font-semibold">{supplierName}</span>. Track every memo, action items, and request new pieces — all from one secure portal.
          </p>
          <div className="mt-5 sm:mt-6 flex flex-wrap items-center gap-2">
            <Link
              to="/store-portal/catalog"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-stone-900 text-sm font-semibold shadow-sm hover:bg-stone-100 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              Request a memo
            </Link>
            <Link
              to="/store-portal/requests"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-semibold ring-1 ring-white/20 hover:bg-white/20 transition"
            >
              View my requests
            </Link>
          </div>
        </div>
      </div>

      {/* Floating KPI panel that overlaps the dark hero */}
      <div className="relative -mt-14 sm:-mt-16 mx-2 sm:mx-4 rounded-2xl bg-white border border-stone-200 shadow-[0_8px_30px_rgba(15,23,42,0.08)] p-4 sm:p-5">
        <div className="flex items-start gap-4">
          {storeLogo ? (
            <img src={storeLogo} alt={storeName} className="hidden sm:block w-14 h-14 rounded-xl object-cover bg-stone-100 ring-1 ring-stone-200 shrink-0" />
          ) : (
            <div className="hidden sm:flex w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-600 text-white items-center justify-center font-bold text-base shrink-0">
              {(storeName || "?").split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase()}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 flex-1">
            <KpiStat label="Active memos" value={loading ? "…" : kpis.activeCount} accent="from-blue-500 to-indigo-600" />
            <KpiStat label="Items on memo" value={loading ? "…" : kpis.totalItemsOut} accent="from-indigo-500 to-violet-600" />
            <KpiStat label="Pending actions" value={loading ? "…" : kpis.pendingItems} accent="from-amber-500 to-orange-600" tone={kpis.pendingItems > 0 ? "amber" : null} />
            <KpiStat
              label="Next due"
              value={loading ? "…" : (kpis.due ? kpis.due.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—")}
              accent="from-emerald-500 to-teal-600"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* History hero — quieter (no big gradient) since this is a records view. */
function PortalHistoryHero({ me, loading, memoCount }) {
  const storeName    = me?.store?.name    || "Your store";
  const supplierName = me?.supplier?.name || "your supplier";
  const storeLogo    = me?.store?.logo_url;
  return (
    <div className="bg-white border border-stone-200 rounded-2xl px-4 sm:px-6 py-4 sm:py-5">
      <div className="flex items-start gap-3 sm:gap-4">
        {storeLogo ? (
          <img src={storeLogo} alt={storeName} className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover bg-stone-100 ring-1 ring-stone-200 shrink-0" />
        ) : (
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-stone-700 to-stone-900 text-white flex items-center justify-center font-bold text-base shrink-0">
            {(storeName || "?").split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.18em] text-stone-400 font-bold">Memo history</div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 truncate mt-0.5">{storeName}</h1>
          <div className="text-xs sm:text-sm text-stone-500 mt-0.5 truncate">
            {loading ? "Loading…" : <>Records from <span className="text-stone-700 font-medium">{supplierName}</span> · <span className="text-stone-700 font-medium">{memoCount} memo{memoCount === 1 ? "" : "s"}</span></>}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiStat({ label, value, accent = "from-stone-400 to-stone-600", tone = null }) {
  const toneText = tone === "amber" ? "text-amber-600" : "text-stone-900";
  return (
    <div className="relative">
      <div className={`absolute -left-3 top-1 bottom-1 w-0.5 rounded-full bg-gradient-to-b ${accent}`} />
      <div className="pl-1">
        <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-stone-400">{label}</div>
        <div className={`text-lg sm:text-2xl font-bold mt-0.5 leading-none ${toneText} truncate`}>{value}</div>
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
    if (days != null && days < 0)        countdown = { label: `Expired ${Math.abs(days)}d ago`, tone: "text-rose-600" };
    else if (days === 0)                  countdown = { label: "Due today",                       tone: "text-amber-600" };
    else if (days != null && days <= 7)   countdown = { label: `${days}d left`,                   tone: "text-amber-600" };
    else if (days != null)                countdown = { label: `${days}d left`,                   tone: "text-stone-500" };
  }

  return (
    <Link
      to={`/store-portal/memos/${memo.id}`}
      className="group flex items-start gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 hover:bg-stone-50/70 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${status.color}`}>
            {statusLabel}
          </span>
          {countdown && <span className={`text-[11px] font-semibold ${countdown.tone}`}>· {countdown.label}</span>}
          {memo.items_pending > 0 && (
            <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
              {memo.items_pending} pending
            </span>
          )}
        </div>
        <div className="font-bold text-stone-900 text-base sm:text-lg mt-0.5 break-all group-hover:text-indigo-700 transition-colors">{memo.memo_number}</div>
        <div className="text-[11px] sm:text-xs text-stone-500 mt-0.5 truncate">
          {memo.item_count} {memo.item_count === 1 ? "item" : "items"}
          {memo.items_out > 0 && <> · {memo.items_out} on memo</>}
          {memo.supplier_name && <> · from {memo.supplier_name}</>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-base sm:text-lg font-bold text-stone-900 whitespace-nowrap">
          ${Number(memo.total_value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
        <div className="text-[11px] text-stone-400">
          {memo.issued_at ? new Date(memo.issued_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Not issued"}
        </div>
      </div>
      <svg className="w-4 h-4 text-stone-300 shrink-0 mt-2 hidden sm:block group-hover:text-indigo-500 group-hover:translate-x-0.5 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

/* --- Empty / skeleton --------------------------------------- */

function EmptyState({ historyMode, hasMemos }) {
  return (
    <div className="px-6 py-12 sm:py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-stone-100 mx-auto flex items-center justify-center mb-3">
        <svg className="w-6 h-6 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      <div className="font-semibold text-stone-700 text-sm">
        {historyMode ? "No past memos yet" : "No active memos"}
      </div>
      <div className="text-xs text-stone-400 mt-1 max-w-xs mx-auto">
        {historyMode
          ? "Closed memos will show up here for your records."
          : hasMemos
            ? "Try a different search."
            : "When your supplier issues a memo to you, it'll appear here. In the meantime, browse the catalog and request the pieces you'd like to see."}
      </div>
      {!historyMode && !hasMemos && (
        <Link
          to="/store-portal/catalog"
          className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800"
        >
          Browse catalog
        </Link>
      )}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-start gap-4 px-4 sm:px-5 py-4 animate-pulse">
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-3 w-20 bg-stone-200 rounded" />
        <div className="h-5 w-32 bg-stone-200 rounded" />
        <div className="h-3 w-40 bg-stone-100 rounded" />
      </div>
      <div className="text-right space-y-2">
        <div className="h-5 w-16 bg-stone-200 rounded" />
        <div className="h-3 w-12 bg-stone-100 rounded" />
      </div>
    </div>
  );
}
