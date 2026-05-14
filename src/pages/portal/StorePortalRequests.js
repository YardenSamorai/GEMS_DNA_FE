import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import {
  fetchMyMemoRequests,
  fetchMyMemoRequest,
  cancelMyMemoRequest,
} from "../../services/portalApi";

/**
 * StorePortalRequests — store user's request history.
 *
 * Each row reflects the request lifecycle: pending → converted /
 * declined / cancelled. When converted, we link straight to the
 * resulting memo so the store can pick up where the supplier
 * stopped editing.
 */
export default function StorePortalRequests() {
  const { user } = useUser();
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]       = useState(null); // request id

  const reload = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const rows = await fetchMyMemoRequests(user.id);
      setList(Array.isArray(rows) ? rows : []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [user?.id]);

  const stats = useMemo(() => {
    const pending   = list.filter((r) => r.status === "pending").length;
    const converted = list.filter((r) => r.status === "converted").length;
    return { total: list.length, pending, converted };
  }, [list]);

  return (
    <div className="space-y-5 sm:space-y-7">
      <Hero stats={stats} />
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-stone-200 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-stone-900 text-sm sm:text-base">My memo requests</h2>
          <Link to="/store-portal/catalog" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
            + New request
          </Link>
        </div>
        {loading ? (
          <div className="divide-y divide-stone-100">
            {[1,2,3].map((i) => <SkeletonRow key={i} />)}
          </div>
        ) : list.length === 0 ? (
          <Empty />
        ) : (
          <div className="divide-y divide-stone-100">
            {list.map((r) => (
              <RequestRow key={r.id} req={r} onOpen={() => setOpen(r.id)} />
            ))}
          </div>
        )}
      </div>
      {open != null && (
        <RequestDrawer
          id={open}
          onClose={() => setOpen(null)}
          onChanged={() => { setOpen(null); reload(); }}
        />
      )}
    </div>
  );
}

/* --- Hero --- */
function Hero({ stats }) {
  return (
    <section className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-violet-900 to-indigo-900 text-white px-5 sm:px-8 py-6 sm:py-8">
      <div className="absolute inset-0 opacity-30 mix-blend-screen pointer-events-none">
        <div className="absolute -top-16 -left-10 w-64 h-64 bg-violet-400 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -right-10 w-72 h-72 bg-indigo-400 rounded-full blur-3xl" />
      </div>
      <div className="relative">
        <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-indigo-200/90 mb-2">
          Memo requests
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight">Your request inbox</h1>
        <p className="text-sm text-indigo-100/80 mt-2 max-w-xl">
          Track which requests are awaiting your supplier's review and which have already become memos.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Stat label="Total" value={stats.total} />
          <Stat label="Pending" value={stats.pending} accent="bg-amber-400/15 text-amber-200 border-amber-400/30" />
          <Stat label="Converted" value={stats.converted} accent="bg-emerald-400/15 text-emerald-200 border-emerald-400/30" />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, accent = "bg-white/10 text-white border-white/20" }) {
  return (
    <div className={`px-3 py-1.5 rounded-full border ${accent} backdrop-blur flex items-center gap-1.5 text-xs font-semibold`}>
      <span className="opacity-70 text-[10px] uppercase tracking-[0.16em] font-bold">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}

/* --- Row --- */
function RequestRow({ req, onOpen }) {
  const status = STATUS_META[req.status] || STATUS_META.pending;
  const created = req.created_at ? new Date(req.created_at) : null;
  return (
    <button
      onClick={onOpen}
      className="group w-full text-left flex items-start gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 hover:bg-stone-50/70 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${status.color}`}>
            {status.label}
          </span>
          <span className="text-[11px] text-stone-400">#{req.id}</span>
          {created && (
            <span className="text-[11px] text-stone-400">· {created.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
          )}
        </div>
        <div className="font-bold text-stone-900 text-base mt-1 group-hover:text-indigo-700 transition-colors">
          {req.item_count} item{req.item_count === 1 ? "" : "s"} {req.message ? "+ note" : ""}
        </div>
        {req.message && <div className="text-xs text-stone-500 truncate mt-0.5">{req.message}</div>}
      </div>
      <svg className="w-4 h-4 text-stone-300 mt-2 hidden sm:block group-hover:text-indigo-500 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

const STATUS_META = {
  pending:   { label: "Pending review", color: "bg-amber-50 text-amber-700 border-amber-200" },
  converted: { label: "Converted to memo", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  declined:  { label: "Declined", color: "bg-rose-50 text-rose-700 border-rose-200" },
  cancelled: { label: "Cancelled", color: "bg-stone-100 text-stone-600 border-stone-200" },
};

/* --- Drawer --- */
function RequestDrawer({ id, onClose, onChanged }) {
  const { user } = useUser();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.id || id == null) return;
    setLoading(true);
    fetchMyMemoRequest(user.id, id)
      .then(setData)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [user?.id, id]);

  const cancel = async () => {
    if (busy) return;
    if (!window.confirm("Cancel this request?")) return;
    setBusy(true);
    try {
      await cancelMyMemoRequest(user.id, id);
      toast.success("Request cancelled");
      onChanged?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-lg bg-white shadow-2xl flex flex-col animate-in slide-in-from-right">
        <div className="px-5 py-4 border-b border-stone-200 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-stone-400">Request #{id}</div>
            <h3 className="text-lg font-bold text-stone-900 mt-0.5">Memo request details</h3>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading || !data ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 w-1/3 bg-stone-200 rounded" />
              <div className="h-3 w-2/3 bg-stone-100 rounded" />
              <div className="h-32 bg-stone-100 rounded-xl" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${(STATUS_META[data.status] || STATUS_META.pending).color}`}>
                  {(STATUS_META[data.status] || STATUS_META.pending).label}
                </span>
                <span className="text-xs text-stone-500">{new Date(data.created_at).toLocaleString()}</span>
              </div>
              {data.preferred_due_at && (
                <div className="text-xs text-stone-500">
                  Preferred receive date: <span className="font-semibold text-stone-800">{new Date(data.preferred_due_at).toLocaleDateString()}</span>
                </div>
              )}
              {data.message && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-stone-400 mb-1">Notes</div>
                  <div className="rounded-xl bg-stone-50 border border-stone-200 p-3 text-sm text-stone-800 whitespace-pre-wrap">{data.message}</div>
                </div>
              )}
              {data.decline_reason && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-rose-500 mb-1">Decline reason</div>
                  <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-900 whitespace-pre-wrap">{data.decline_reason}</div>
                </div>
              )}
              {data.converted_memo_id && (
                <Link
                  to={`/store-portal/memos/${data.converted_memo_id}`}
                  className="block rounded-xl border border-emerald-200 bg-emerald-50 p-3 hover:bg-emerald-100 transition"
                >
                  <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-emerald-700">View resulting memo</div>
                  <div className="text-sm font-bold text-emerald-900 mt-0.5">Open memo →</div>
                </Link>
              )}
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-stone-400 mb-2">Items · {data.items?.length || 0}</div>
                <div className="rounded-xl border border-stone-200 divide-y divide-stone-100 overflow-hidden">
                  {(data.items || []).map((it) => {
                    const snap = it.snapshot || {};
                    const title = it.item_type === "jewelry"
                      ? (snap.name || it.item_sku)
                      : `${snap.shape || ""} ${snap.weightCt ? `${snap.weightCt} ct` : ""}`.trim() || it.item_sku;
                    return (
                      <div key={it.id} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="w-10 h-10 rounded-lg bg-stone-100 overflow-hidden ring-1 ring-stone-200 shrink-0">
                          {snap.imageUrl ? <img src={snap.imageUrl} alt="" className="w-full h-full object-cover" /> : null}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-stone-900 truncate">{title}</div>
                          <div className="text-[10px] text-stone-400">{it.item_sku}</div>
                        </div>
                        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${it.item_type === "jewelry" ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700"}`}>{it.item_type}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
        {data?.status === "pending" && (
          <div className="px-5 py-3 border-t border-stone-200 flex justify-end bg-stone-50/70">
            <button
              onClick={cancel}
              disabled={busy}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              Cancel request
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="px-6 py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-stone-100 mx-auto flex items-center justify-center mb-3">
        <svg className="w-6 h-6 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <div className="font-semibold text-stone-700 text-sm">No requests yet</div>
      <div className="text-xs text-stone-400 mt-1 max-w-xs mx-auto">
        Browse the catalog to pick pieces, or write a free-text request describing what you need.
      </div>
      <Link
        to="/store-portal/catalog"
        className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800"
      >
        Browse catalog
      </Link>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-start gap-4 px-4 sm:px-5 py-4 animate-pulse">
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-3 w-24 bg-stone-200 rounded" />
        <div className="h-5 w-40 bg-stone-200 rounded" />
        <div className="h-3 w-56 bg-stone-100 rounded" />
      </div>
    </div>
  );
}
