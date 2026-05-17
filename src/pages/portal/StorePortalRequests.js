import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
    <div className="space-y-6 sm:space-y-8">
      <Hero stats={stats} />
      <section className="glass-surface rounded-2xl sm:rounded-[28px] overflow-hidden">
        <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-glass-line/70 flex items-center justify-between gap-3">
          <h2 className="text-[15px] sm:text-[16px] font-semibold text-glass-ink tracking-tight">
            My memo requests
          </h2>
          <Link
            to="/store-portal/catalog"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/65 border border-white/70 backdrop-blur-md text-[12.5px] font-medium text-glass-ink hover:bg-white/85 transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New request
          </Link>
        </div>
        {loading ? (
          <div className="divide-y divide-glass-line/70">
            {[1,2,3].map((i) => <SkeletonRow key={i} />)}
          </div>
        ) : list.length === 0 ? (
          <Empty />
        ) : (
          <div className="divide-y divide-glass-line/70">
            {list.map((r) => (
              <RequestRow key={r.id} req={r} onOpen={() => setOpen(r.id)} />
            ))}
          </div>
        )}
      </section>
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

/* --- Hero — glass card with title + three KPI tiles --- */
function Hero({ stats }) {
  return (
    <section className="glass-surface rounded-2xl sm:rounded-[28px] overflow-hidden">
      <div className="px-6 sm:px-9 pt-7 sm:pt-10 pb-7 sm:pb-9">
        <div className="text-[10.5px] tracking-[0.14em] uppercase text-glass-muted font-medium mb-3">
          Memo requests
        </div>
        <h1 className="text-[28px] sm:text-[36px] leading-[1.1] text-glass-ink font-semibold tracking-tight">
          Your request inbox
        </h1>
        <p className="text-[14px] sm:text-[15px] text-glass-muted mt-4 max-w-xl leading-relaxed">
          Track which requests are awaiting your supplier's review and which have already been converted into formal memos.
        </p>
      </div>
      <div className="border-t border-glass-line/70">
        <div className="grid grid-cols-3 divide-x divide-glass-line/70">
          <Stat label="Total"     value={stats.total} />
          <Stat label="Pending"   value={stats.pending}   highlight={stats.pending > 0} />
          <Stat label="Converted" value={stats.converted} />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, highlight = false }) {
  return (
    <div className="px-5 sm:px-7 py-5">
      <div className="text-[10.5px] tracking-[0.14em] uppercase text-glass-muted font-medium">{label}</div>
      <div className="text-[26px] sm:text-[30px] font-semibold tracking-tight mt-1.5 leading-none tabular-nums text-glass-ink">
        {value}
      </div>
      {highlight && value > 0 && (
        <div className="mt-1.5 inline-flex items-center gap-1.5 text-[10.5px] text-portal-champagne2 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-portal-champagne" />
          Awaiting review
        </div>
      )}
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
      className="group w-full text-left flex items-start gap-4 sm:gap-5 px-5 sm:px-7 py-5 hover:bg-white/45 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className={`inline-flex items-center text-[10.5px] font-medium px-2 py-0.5 rounded-full ${status.color}`}>
            {status.label}
          </span>
          <span className="text-[11.5px] text-glass-soft tabular-nums">#{req.id}</span>
          {created && (
            <span className="text-[11.5px] text-glass-soft">
              {created.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
        <div className="text-[16px] sm:text-[17px] font-semibold text-glass-ink mt-2 group-hover:text-black transition-colors tracking-tight">
          {req.item_count} item{req.item_count === 1 ? "" : "s"}{req.message ? " · with note" : ""}
        </div>
        {req.message && <div className="text-[12.5px] text-glass-muted truncate mt-1 leading-relaxed">{req.message}</div>}
      </div>
      <svg className="w-4 h-4 text-glass-soft mt-2 hidden sm:block group-hover:text-glass-ink group-hover:translate-x-1 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

// Status metadata — soft-tinted, frosted pill colours. Champagne reads
// as success (converted); a neutral ink chip handles pending; a quiet
// warm rose covers declined; soft gray covers cancelled.
const STATUS_META = {
  pending:   { label: "Pending review",     color: "bg-white/65 text-glass-ink border border-white/70 backdrop-blur-md" },
  converted: { label: "Converted to memo",  color: "bg-portal-champagne/12 text-portal-champagne2 border border-portal-champagne/30" },
  declined:  { label: "Declined",           color: "bg-rose-50/70 text-rose-700 border border-rose-100" },
  cancelled: { label: "Cancelled",          color: "bg-white/55 text-glass-soft border border-white/60 backdrop-blur-md" },
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

  // Render through a portal to document.body. The portal's <main> has
  // `relative z-0` which creates a stacking context, so without the portal
  // the drawer (z-50) would still get trapped *under* the layout header
  // (z-30 at the document level) and the close button would be hidden
  // behind the sticky header / sub-nav strip.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end bg-glass-ink/35 backdrop-blur-md">
      <div className="w-full sm:max-w-lg glass-surface-strong sm:rounded-l-3xl flex flex-col animate-in slide-in-from-right">
        <div className="px-6 py-5 border-b border-glass-line/70 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10.5px] tracking-[0.14em] uppercase text-glass-muted font-medium">
              Request #{id}
            </div>
            <h3 className="text-[22px] font-semibold tracking-tight text-glass-ink mt-1 leading-tight">
              Request details
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 inline-flex items-center justify-center rounded-full text-glass-muted hover:text-glass-ink hover:bg-white/55 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {loading || !data ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 w-1/3 rounded bg-glass-canvas2" />
              <div className="h-3 w-2/3 rounded bg-glass-canvas2" />
              <div className="h-32 rounded-2xl bg-glass-canvas2" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`inline-flex items-center text-[10.5px] font-medium px-2 py-0.5 rounded-full ${(STATUS_META[data.status] || STATUS_META.pending).color}`}>
                  {(STATUS_META[data.status] || STATUS_META.pending).label}
                </span>
                <span className="text-[11.5px] text-glass-soft">{new Date(data.created_at).toLocaleString()}</span>
              </div>
              {data.preferred_due_at && (
                <div className="text-[13px] text-glass-graphite">
                  <span className="text-[11px] text-glass-muted mr-2">Preferred receive date</span>
                  <span className="text-glass-ink font-medium">{new Date(data.preferred_due_at).toLocaleDateString()}</span>
                </div>
              )}
              {data.message && (
                <div>
                  <div className="text-[11px] text-glass-muted font-medium mb-2">Notes</div>
                  <div className="rounded-2xl bg-white/55 border border-white/65 backdrop-blur-md px-4 py-3 text-[13px] text-glass-graphite whitespace-pre-wrap leading-relaxed shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
                    {data.message}
                  </div>
                </div>
              )}
              {data.decline_reason && (
                <div>
                  <div className="text-[11px] text-rose-700 font-medium mb-2">Decline reason</div>
                  <div className="rounded-2xl border border-rose-100 bg-rose-50/70 backdrop-blur-md p-4 text-[13px] text-rose-900 whitespace-pre-wrap leading-relaxed">
                    {data.decline_reason}
                  </div>
                </div>
              )}
              {data.converted_memo_id && (
                <Link
                  to={`/store-portal/memos/${data.converted_memo_id}`}
                  className="block rounded-2xl border border-portal-champagne/30 bg-portal-champagne/8 p-4 hover:bg-portal-champagne/14 transition-colors"
                >
                  <div className="text-[11px] text-portal-champagne2 font-medium">View resulting memo</div>
                  <div className="text-[15px] font-semibold text-glass-ink mt-0.5 flex items-center gap-1.5">
                    Open memo
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </div>
                </Link>
              )}
              <div>
                <div className="text-[11px] text-glass-muted font-medium mb-2.5">
                  Items · {data.items?.length || 0}
                </div>
                <div className="rounded-2xl bg-white/45 border border-white/55 backdrop-blur-md divide-y divide-glass-line/70 overflow-hidden">
                  {(data.items || []).map((it) => {
                    const snap = it.snapshot || {};
                    const title = it.item_type === "jewelry"
                      ? (snap.name || it.item_sku)
                      : `${snap.shape || ""} ${snap.weightCt ? `${snap.weightCt} ct` : ""}`.trim() || it.item_sku;
                    return (
                      <div key={it.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="w-10 h-10 rounded-lg bg-glass-canvas2 border border-glass-line overflow-hidden shrink-0">
                          {snap.imageUrl ? <img src={snap.imageUrl} alt="" className="w-full h-full object-cover" /> : null}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] text-glass-ink truncate font-medium">{title}</div>
                          <div className="text-[11px] text-glass-soft tabular-nums mt-0.5">{it.item_sku}</div>
                        </div>
                        <span className="text-[10.5px] text-glass-muted font-medium capitalize">
                          {it.item_type}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
        {data?.status === "pending" && (
          <div className="px-6 py-4 border-t border-glass-line/70 flex justify-end bg-white/30 backdrop-blur-md">
            <button
              onClick={cancel}
              disabled={busy}
              className="px-5 py-2.5 rounded-full text-[13px] text-rose-700 hover:text-rose-800 hover:bg-rose-50/70 font-medium transition-colors disabled:opacity-40"
            >
              Cancel request
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function Empty() {
  return (
    <div className="px-6 py-16 sm:py-20 text-center">
      <div className="w-12 h-12 mx-auto rounded-2xl bg-white/60 border border-white/65 backdrop-blur-md flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
        <svg className="w-5 h-5 text-glass-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 8h6m-6 4h6m2 5H7a2 2 0 01-2-2V7a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2z" />
        </svg>
      </div>
      <div className="text-[18px] font-semibold tracking-tight text-glass-ink mt-5">No requests yet</div>
      <div className="text-[13px] text-glass-muted mt-2 max-w-sm mx-auto leading-relaxed">
        Browse the inventory to mark pieces, or write a free-text request describing what you need.
      </div>
      <Link
        to="/store-portal/catalog"
        className="inline-flex items-center mt-6 px-5 py-2.5 rounded-full bg-glass-ink text-white text-[13.5px] font-medium hover:bg-glass-graphite transition-colors shadow-[0_6px_18px_-8px_rgba(20,22,28,0.45)]"
      >
        Browse inventory
      </Link>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-start gap-5 px-5 sm:px-7 py-5 animate-pulse">
      <div className="flex-1 min-w-0 space-y-2.5">
        <div className="h-3 w-32 rounded bg-glass-canvas2" />
        <div className="h-5 w-48 rounded bg-glass-canvas2" />
        <div className="h-3 w-64 rounded bg-glass-canvas2" />
      </div>
    </div>
  );
}
