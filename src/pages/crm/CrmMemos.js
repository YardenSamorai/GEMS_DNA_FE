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
import {
  fetchOwnerMemoRequests,
  fetchOwnerMemoRequest,
  declineMemoRequest,
  convertMemoRequest,
} from "../../services/portalApi";
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
  const [requests, setRequests] = useState([]);
  const [inboxOpen, setInboxOpen] = useState(false);

  const companyId = params.get("companyId") || "";

  const reload = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [m, c, r] = await Promise.all([
        fetchMemos(user.id, { companyId: companyId || undefined }),
        fetchCompanies(user.id),
        fetchOwnerMemoRequests(user.id, { status: "pending" }).catch(() => []),
      ]);
      setMemos(m);
      setCompanies(c);
      setRequests(Array.isArray(r) ? r : []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [user?.id, companyId]);
  const pendingRequestCount = requests.length;

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
          onClick={() => setInboxOpen(true)}
          className={`relative inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition border ${
            pendingRequestCount > 0
              ? "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
              : "bg-white border-stone-200 text-stone-600 hover:border-stone-300"
          }`}
          title={pendingRequestCount > 0 ? `${pendingRequestCount} pending memo request${pendingRequestCount === 1 ? "" : "s"} from stores` : "Memo requests from stores"}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Requests
          {pendingRequestCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white text-[10px] font-bold shadow-sm">
              {pendingRequestCount}
            </span>
          )}
        </button>
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

      {inboxOpen && (
        <RequestsInbox
          onClose={() => setInboxOpen(false)}
          onChanged={reload}
        />
      )}
    </div>
  );
}

/* ============================================================
   RequestsInbox — slide-out panel showing every memo request
   from store-portal users. Owner can convert (→ draft memo) or
   decline. Lives inside CrmMemos so it shares the auth/user
   context that the page already loaded.
   ============================================================ */
function RequestsInbox({ onClose, onChanged }) {
  const { user } = useUser();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState("pending");
  const [openId, setOpenId]     = useState(null);

  const reload = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const rows = await fetchOwnerMemoRequests(user.id, { status: tab === "all" ? undefined : tab });
      setRequests(Array.isArray(rows) ? rows : []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [user?.id, tab]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-xl bg-white shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-stone-200 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-stone-400">Store memo requests</div>
            <h3 className="text-lg font-bold text-stone-900 mt-0.5">Inbox</h3>
            <p className="text-xs text-stone-500 mt-0.5">Pieces stores have asked you to issue a memo for.</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex items-center gap-1 px-5 border-b border-stone-200">
          {[
            { id: "pending", label: "Pending" },
            { id: "converted", label: "Converted" },
            { id: "declined", label: "Declined" },
            { id: "all", label: "All" },
          ].map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative px-3 py-3 text-xs font-semibold whitespace-nowrap transition-colors ${active ? "text-stone-900" : "text-stone-500 hover:text-stone-800"}`}
              >
                {t.label}
                {active && <span className="absolute left-3 right-3 bottom-0 h-0.5 rounded-full bg-stone-900" />}
              </button>
            );
          })}
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-5 space-y-3 animate-pulse">
              {[1,2,3].map((i) => (
                <div key={i} className="h-16 bg-stone-100 rounded-xl" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-stone-100 mx-auto flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="font-semibold text-stone-700 text-sm">No requests {tab !== "all" ? `· ${tab}` : ""}</div>
              <div className="text-xs text-stone-400 mt-1 max-w-xs mx-auto">When a store user requests a memo from the portal, it shows up here.</div>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {requests.map((r) => (
                <RequestRow key={r.id} req={r} onOpen={() => setOpenId(r.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {openId != null && (
        <RequestDetail
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => { setOpenId(null); reload(); onChanged?.(); }}
        />
      )}
    </div>
  );
}

const REQUEST_STATUS = {
  pending:   { label: "Pending review",      color: "bg-amber-50 text-amber-700 border-amber-200" },
  converted: { label: "Converted to memo",   color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  declined:  { label: "Declined",            color: "bg-rose-50 text-rose-700 border-rose-200" },
  cancelled: { label: "Cancelled by store",  color: "bg-stone-100 text-stone-600 border-stone-200" },
};

function RequestRow({ req, onOpen }) {
  const meta = REQUEST_STATUS[req.status] || REQUEST_STATUS.pending;
  return (
    <button
      onClick={onOpen}
      className="group w-full text-left flex items-start gap-3 sm:gap-4 px-5 py-3.5 hover:bg-stone-50/70 transition-colors"
    >
      {req.company_logo ? (
        <img src={req.company_logo} alt="" className="w-10 h-10 rounded-lg object-cover bg-stone-100 ring-1 ring-stone-200 shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
          {(req.company_name || "?").split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${meta.color}`}>
            {meta.label}
          </span>
          <span className="text-[11px] text-stone-400">#{req.id}</span>
          <span className="text-[11px] text-stone-400">· {new Date(req.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        </div>
        <div className="font-bold text-stone-900 text-sm mt-1 truncate group-hover:text-indigo-700">{req.company_name}</div>
        <div className="text-xs text-stone-500 truncate mt-0.5">
          {req.item_count} item{req.item_count === 1 ? "" : "s"}
          {req.requester_name && <> · {req.requester_name}</>}
          {req.message && <> · "{String(req.message).slice(0, 50)}{req.message.length > 50 ? "…" : ""}"</>}
        </div>
      </div>
      <svg className="w-4 h-4 text-stone-300 shrink-0 mt-2 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

/**
 * InboxItemRow — clickable row in the request inbox drawer that
 * deep-links to the full jewelry / stone detail page (in a new tab,
 * to keep the drawer context alive).
 */
function InboxItemRow({ item }) {
  const snap = item.snapshot || {};
  const isJewelry = item.item_type === "jewelry";
  const title = isJewelry
    ? (snap.name || item.item_sku)
    : `${snap.shape || ""} ${snap.weightCt ? `${snap.weightCt} ct` : ""}`.trim() || item.item_sku;

  let href = null;
  if (isJewelry) {
    const jid = snap.id || item.item_id;
    if (jid) href = `/jewelry/items/${jid}`;
  } else if (item.item_sku) {
    href = `/${encodeURIComponent(item.item_sku)}`;
  }

  const body = (
    <>
      <div className="w-10 h-10 rounded-lg bg-stone-100 overflow-hidden ring-1 ring-stone-200 shrink-0">
        {snap.imageUrl ? <img src={snap.imageUrl} alt="" className="w-full h-full object-cover" /> : null}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-stone-900 truncate group-hover:text-indigo-700 transition-colors">{title}</div>
        <div className="text-[10px] text-stone-400 truncate">{item.item_sku}</div>
      </div>
      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${isJewelry ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700"}`}>{item.item_type}</span>
      {href && (
        <svg className="w-3.5 h-3.5 text-stone-300 group-hover:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      )}
    </>
  );

  if (!href) {
    return <div className="flex items-center gap-3 px-3 py-2.5">{body}</div>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 px-3 py-2.5 hover:bg-stone-50 transition-colors cursor-pointer"
    >
      {body}
    </a>
  );
}

function RequestDetail({ id, onClose, onChanged }) {
  const { user } = useUser();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);
  const [declineMode, setDeclineMode] = useState(false);
  const [reason, setReason]   = useState("");

  useEffect(() => {
    if (!user?.id || id == null) return;
    setLoading(true);
    fetchOwnerMemoRequest(user.id, id)
      .then(setData)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [user?.id, id]);

  const convert = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const out = await convertMemoRequest(user.id, id);
      toast.success(`Draft memo created${out?.memo?.memo_number ? `: ${out.memo.memo_number}` : ""}`);
      onChanged?.();
      if (out?.memo?.id) window.location.href = `/crm/memos/${out.memo.id}`;
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await declineMemoRequest(user.id, id, reason.trim() || null);
      toast.success("Request declined");
      onChanged?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-stone-900/60 backdrop-blur-sm">
      <div className="w-full sm:max-w-lg bg-white shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-stone-200 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-stone-400">Request #{id}</div>
            <h3 className="text-lg font-bold text-stone-900 mt-0.5">{data?.company_name || "Loading…"}</h3>
            {data && (
              <div className="text-xs text-stone-500 mt-0.5">
                Submitted {new Date(data.created_at).toLocaleString()}
                {data.requester_name && <> · by {data.requester_name}</>}
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading || !data ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-3 w-1/3 bg-stone-200 rounded" />
              <div className="h-32 bg-stone-100 rounded-xl" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${(REQUEST_STATUS[data.status] || REQUEST_STATUS.pending).color}`}>
                  {(REQUEST_STATUS[data.status] || REQUEST_STATUS.pending).label}
                </span>
                {data.preferred_due_at && (
                  <span className="text-xs text-stone-500">Wants by {new Date(data.preferred_due_at).toLocaleDateString()}</span>
                )}
              </div>
              {data.message && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-stone-400 mb-1">Notes from store</div>
                  <div className="rounded-xl bg-stone-50 border border-stone-200 p-3 text-sm text-stone-800 whitespace-pre-wrap">{data.message}</div>
                </div>
              )}
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-stone-400 mb-2">Items · {data.items?.length || 0}</div>
                <div className="rounded-xl border border-stone-200 divide-y divide-stone-100 overflow-hidden">
                  {(data.items || []).map((it) => (
                    <InboxItemRow key={it.id} item={it} />
                  ))}
                </div>
              </div>
              {data.decline_reason && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-rose-500 mb-1">Decline reason</div>
                  <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-900 whitespace-pre-wrap">{data.decline_reason}</div>
                </div>
              )}
              {declineMode && data.status === "pending" && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-stone-400 mb-1.5">Reason (optional, sent in your records)</div>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="Why is this declined? (Out of stock, customer mismatch, etc.)"
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 placeholder-stone-400 resize-y"
                  />
                </div>
              )}
            </>
          )}
        </div>
        {data?.status === "pending" && (
          <div className="px-5 py-3 border-t border-stone-200 flex items-center justify-between gap-2 bg-stone-50/70">
            {!declineMode ? (
              <>
                <button
                  onClick={() => setDeclineMode(true)}
                  disabled={busy}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >Decline</button>
                <button
                  onClick={convert}
                  disabled={busy}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white text-sm font-bold disabled:opacity-50 hover:opacity-95"
                >
                  {busy ? "Working…" : "Convert to memo →"}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setDeclineMode(false); setReason(""); }}
                  disabled={busy}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-stone-600 hover:bg-stone-200"
                >Back</button>
                <button
                  onClick={decline}
                  disabled={busy}
                  className="px-5 py-2 rounded-lg bg-rose-600 text-white text-sm font-bold disabled:opacity-50 hover:bg-rose-700"
                >
                  {busy ? "Declining…" : "Confirm decline"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
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
