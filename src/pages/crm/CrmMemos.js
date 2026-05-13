import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import {
  fetchMemos,
  MEMO_STATUSES,
  isMemoEffectivelyExpired,
} from "../../services/memosApi";
import { fetchCompanies } from "../../services/companiesApi";
import { Skeleton, SkeletonCard } from "../../components/ui/Skeleton";
import MemoWizard from "./components/MemoWizard";

/**
 * CRM → Memos list.
 *
 * Each memo lives in one of five buckets: draft / out / partial /
 * closed / expired. The toolbar lets the user filter by store and by
 * status. URL ?companyId=N pre-filters when arriving from a store card.
 */
export default function CrmMemos() {
  const { user } = useUser();
  const [params, setParams] = useSearchParams();
  const [memos, setMemos] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const companyId = params.get("companyId") || "";

  const reload = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [m, c] = await Promise.all([
        fetchMemos(user.id, { companyId: companyId || undefined }),
        fetchCompanies(user.id),
      ]);
      setMemos(m);
      setCompanies(c);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [user?.id, companyId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return memos.filter((m) => {
      if (statusFilter === "expired") {
        if (m.status !== "expired" && !isMemoEffectivelyExpired(m)) return false;
      } else if (statusFilter !== "all") {
        if (m.status !== statusFilter) return false;
      }
      if (!q) return true;
      return [m.memo_number, m.company_name, m.contact_name, m.notes]
        .filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [memos, statusFilter, search]);

  // Counts per status for the segmented filter
  const counts = useMemo(() => {
    const out = { all: memos.length, draft: 0, out: 0, partially_returned: 0, closed: 0, expired: 0 };
    for (const m of memos) {
      out[m.status] = (out[m.status] || 0) + 1;
      if (m.status !== "expired" && isMemoEffectivelyExpired(m)) out.expired += 1;
    }
    return out;
  }, [memos]);

  const focusedCompany = companyId ? companies.find((c) => String(c.id) === String(companyId)) : null;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Pre-filter banner when arriving from a specific store */}
      {focusedCompany && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
          <div className="text-sm text-emerald-800">
            Showing memos for <strong>{focusedCompany.name}</strong>
          </div>
          <button
            onClick={() => { params.delete("companyId"); setParams(params, { replace: true }); }}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search memo #, store, contact..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400"
          />
        </div>
        <button
          onClick={() => setCreating(true)}
          disabled={companies.length === 0}
          title={companies.length === 0 ? "Add a store first" : ""}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New memo
        </button>
      </div>

      {/* Status segmented filter */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
        {[{ value: "all", label: "All" }, ...MEMO_STATUSES].map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              statusFilter === s.value
                ? "bg-stone-900 text-white"
                : "bg-white border border-stone-200 text-stone-600 hover:border-stone-300"
            }`}
          >
            {s.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusFilter === s.value ? "bg-white/20 text-white" : "bg-stone-100 text-stone-500"}`}>
              {counts[s.value] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} lines={3} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          hasFilter={statusFilter !== "all" || !!search || !!companyId}
          hasCompanies={companies.length > 0}
          onCreate={() => setCreating(true)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((m) => <MemoCard key={m.id} memo={m} />)}
        </div>
      )}

      {creating && (
        <MemoWizard
          companies={companies}
          preselectCompanyId={companyId ? Number(companyId) : null}
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); reload(); }}
        />
      )}
    </div>
  );
}

function MemoCard({ memo }) {
  const expired = memo.status === "expired" || isMemoEffectivelyExpired(memo);
  const effectiveStatus = expired ? "expired" : memo.status;
  const status = MEMO_STATUSES.find((s) => s.value === effectiveStatus) || MEMO_STATUSES[0];
  return (
    <Link
      to={`/crm/memos/${memo.id}`}
      className="bg-white border border-stone-200 rounded-xl p-4 hover:shadow-md transition-shadow flex flex-col"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
            {memo.memo_number}
          </div>
          <h3 className="font-semibold text-stone-900 truncate mt-0.5">{memo.company_name}</h3>
          {memo.contact_name && (
            <div className="text-xs text-stone-500 truncate">via {memo.contact_name}</div>
          )}
        </div>
        <span className={`shrink-0 inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full border ${status.color}`}>
          {status.label}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-stone-600 mt-2">
        <div>
          <span className="font-semibold">{memo.item_count || 0}</span> item{memo.item_count !== 1 ? "s" : ""}
          {memo.items_out > 0 && memo.items_out < memo.item_count && (
            <span className="text-amber-600 ml-1">({memo.items_out} out)</span>
          )}
        </div>
        <div className="font-semibold text-stone-900">
          ${Number(memo.total_value || 0).toLocaleString()}
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-stone-500 mt-2 pt-2 border-t border-stone-100">
        {memo.issued_at ? (
          <span>Issued {new Date(memo.issued_at).toLocaleDateString()}</span>
        ) : (
          <span className="italic">Not issued</span>
        )}
        {memo.due_at && (
          <span className={expired ? "text-rose-600 font-semibold" : ""}>
            Due {new Date(memo.due_at).toLocaleDateString()}
          </span>
        )}
      </div>
    </Link>
  );
}

function EmptyState({ hasFilter, hasCompanies, onCreate }) {
  return (
    <div className="bg-white border border-dashed border-stone-300 rounded-xl p-10 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mb-3">
        <svg className="w-6 h-6 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-stone-900 mb-1">
        {hasFilter ? "No matching memos" : "No memos yet"}
      </h3>
      <p className="text-xs text-stone-500 mb-4">
        {!hasCompanies
          ? "You need a store before you can issue a memo."
          : hasFilter
          ? "Try clearing filters or searching differently."
          : "Send stones or jewelry on consignment to a retail store."}
      </p>
      {!hasFilter && (
        hasCompanies ? (
          <button
            onClick={onCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Create first memo
          </button>
        ) : (
          <Link
            to="/crm/stores"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800"
          >
            Add a store
          </Link>
        )
      )}
    </div>
  );
}
