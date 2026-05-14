import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { fetchPortalMe, fetchPortalMemos } from "../../services/portalApi";
import { MEMO_STATUSES, isMemoEffectivelyExpired } from "../../services/memosApi";

/**
 * StorePortalMemos — list view shown to retail-store users.
 * Mirrors the look-and-feel of the supplier's MemoDetail/CrmMemos
 * (cards on stone-50, status pills, stone-900 numerals, subtle
 * stone-200 borders, document-flavour metadata strip).
 *
 * Two presets:
 *   - /store-portal           — only active memos (out / partial)
 *   - /store-portal/history   — closed / fully-returned / expired
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

  return (
    <div className="space-y-4 sm:space-y-5">
      <PortalHero me={me} loading={loading} historyMode={historyMode} memoCount={memos.length} />

      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-stone-200 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-stone-900 text-sm sm:text-base">
            {historyMode ? "Past memos" : "Active memos"}
          </h2>
          <div className="relative w-40 sm:w-64">
            <svg className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.85-5.65a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
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

/* --- Hero strip — supplier mark + store pill ----------------- */

function PortalHero({ me, loading, historyMode, memoCount }) {
  const supplierName = me?.supplier?.name || "Your supplier";
  const storeName = me?.store?.name || "Your store";
  const storeLogo = me?.store?.logo_url;

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
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[10px] uppercase tracking-[0.18em] text-stone-400 font-bold">
              {historyMode ? "Memo history" : "Active consignment"}
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 truncate mt-0.5">{storeName}</h1>
          <div className="text-xs sm:text-sm text-stone-500 mt-0.5 truncate">
            {loading ? "Loading…" : (
              <>
                On consignment from <span className="text-stone-700 font-medium">{supplierName}</span>
                {!historyMode && memoCount > 0 && (
                  <> · <span className="text-stone-700 font-medium">{memoCount} active</span></>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- One memo row ------------------------------------------- */

function MemoRow({ memo }) {
  const expired = isMemoEffectivelyExpired(memo);
  const effectiveStatus = expired ? "expired" : memo.status;
  const status = MEMO_STATUSES.find((s) => s.value === effectiveStatus) || MEMO_STATUSES[0];

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
      className="flex items-start gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 hover:bg-stone-50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${status.color}`}>
            {status.label}
          </span>
          {countdown && <span className={`text-[11px] font-semibold ${countdown.tone}`}>· {countdown.label}</span>}
          {memo.items_pending > 0 && (
            <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
              {memo.items_pending} pending
            </span>
          )}
        </div>
        <div className="font-bold text-stone-900 text-base sm:text-lg mt-0.5 break-all">{memo.memo_number}</div>
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
      <svg className="w-4 h-4 text-stone-300 shrink-0 mt-2 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      <div className="text-xs text-stone-400 mt-1">
        {historyMode
          ? "Closed memos will show up here for your records."
          : hasMemos
            ? "Try a different search."
            : "When your supplier issues a memo to you, it'll appear here."}
      </div>
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
