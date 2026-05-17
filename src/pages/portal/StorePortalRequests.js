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
    <div className="space-y-10 sm:space-y-12">
      <Hero stats={stats} />
      <section className="bg-portal-canvas border border-portal-line">
        <div className="px-5 sm:px-7 py-5 border-b border-portal-line flex items-center justify-between gap-3">
          <h2 className="text-[10px] tracking-[0.28em] uppercase text-portal-soft font-medium">
            My memo requests
          </h2>
          <Link
            to="/store-portal/catalog"
            className="text-[10px] tracking-[0.28em] uppercase font-medium text-portal-ink hover:text-portal-champagne transition-colors border-b border-portal-line2 hover:border-portal-champagne pb-0.5"
          >
            New request
          </Link>
        </div>
        {loading ? (
          <div className="divide-y divide-portal-line">
            {[1,2,3].map((i) => <SkeletonRow key={i} />)}
          </div>
        ) : list.length === 0 ? (
          <Empty />
        ) : (
          <div className="divide-y divide-portal-line">
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

/* --- Hero — editorial section, champagne eyebrow, Cormorant
       headline, three quiet stat tiles separated by hairlines. --- */
function Hero({ stats }) {
  return (
    <section className="border-t border-portal-champagne/60">
      <div className="pt-8 sm:pt-12 pb-8 sm:pb-10">
        <div className="text-[10px] tracking-[0.32em] uppercase text-portal-champagne font-medium mb-4">
          Memo requests
        </div>
        <h1 className="font-serif-display text-[32px] sm:text-[44px] leading-[1.05] text-portal-ink tracking-tight">
          Your request inbox
        </h1>
        <p className="text-[13.5px] sm:text-[14px] text-portal-graphite mt-5 max-w-xl leading-relaxed">
          Track which requests are awaiting your supplier's review and which have already been converted into formal memos.
        </p>
      </div>
      <div className="border-t border-portal-line">
        <div className="grid grid-cols-3 divide-x divide-portal-line">
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
    <div className="px-5 sm:px-7 py-5 sm:py-6">
      <div className="text-[10px] tracking-[0.28em] uppercase text-portal-soft font-medium">{label}</div>
      <div className={`font-serif-display text-[28px] sm:text-[32px] mt-2 leading-none tabular-nums ${
        highlight ? "text-portal-champagne2" : "text-portal-ink"
      }`}>
        {value}
      </div>
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
      className="group w-full text-left flex items-start gap-4 sm:gap-5 px-5 sm:px-7 py-5 hover:bg-portal-bone/60 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`inline-block text-[10px] uppercase tracking-[0.22em] font-medium px-2 py-0.5 border ${status.color}`}>
            {status.label}
          </span>
          <span className="text-[10px] tracking-[0.22em] uppercase text-portal-soft tabular-nums">#{req.id}</span>
          {created && (
            <span className="text-[10px] tracking-[0.22em] uppercase text-portal-soft">
              {created.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
        <div className="font-serif-display text-[20px] sm:text-[22px] text-portal-ink mt-2 group-hover:text-portal-champagne2 transition-colors leading-tight">
          {req.item_count} item{req.item_count === 1 ? "" : "s"}{req.message ? " · with note" : ""}
        </div>
        {req.message && <div className="text-[12px] text-portal-muted truncate mt-1.5 leading-relaxed">{req.message}</div>}
      </div>
      <svg className="w-3.5 h-3.5 text-portal-soft mt-3 hidden sm:block group-hover:text-portal-champagne group-hover:translate-x-1 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

// Status metadata — uses the portal palette so requests don't break the
// editorial mood with saturated amber/emerald/rose state pills. Champagne
// signals positive resolution (converted); muted ink covers pending and
// cancelled; declined uses a restrained warm tone instead of bright rose.
const STATUS_META = {
  pending:   { label: "Pending review",     color: "bg-transparent text-portal-muted border-portal-line2" },
  converted: { label: "Converted to memo",  color: "bg-transparent text-portal-champagne2 border-portal-champagne/70" },
  declined:  { label: "Declined",           color: "bg-transparent text-[#7a3f3f] border-[#cdb0a8]" },
  cancelled: { label: "Cancelled",          color: "bg-transparent text-portal-soft border-portal-line" },
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
    <div className="fixed inset-0 z-[100] flex justify-end bg-portal-ink/55 backdrop-blur-sm">
      <div className="w-full sm:max-w-lg bg-portal-canvas border-l border-portal-line2 shadow-[0_0_60px_rgba(20,18,15,0.25)] flex flex-col animate-in slide-in-from-right">
        <div className="px-6 py-5 border-b border-portal-line flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] tracking-[0.32em] uppercase text-portal-champagne font-medium">
              Request #{id}
            </div>
            <h3 className="font-serif-display text-[24px] leading-tight text-portal-ink mt-2">
              Request details
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-portal-muted hover:text-portal-ink transition-colors -mt-1 -mr-1 p-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loading || !data ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 w-1/3 bg-portal-pearl" />
              <div className="h-3 w-2/3 bg-portal-pearl" />
              <div className="h-32 bg-portal-pearl" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`inline-block text-[10px] uppercase tracking-[0.22em] font-medium px-2 py-0.5 border ${(STATUS_META[data.status] || STATUS_META.pending).color}`}>
                  {(STATUS_META[data.status] || STATUS_META.pending).label}
                </span>
                <span className="text-[11px] text-portal-soft tracking-wide">{new Date(data.created_at).toLocaleString()}</span>
              </div>
              {data.preferred_due_at && (
                <div className="text-[12px] text-portal-graphite">
                  <span className="text-[10px] tracking-[0.22em] uppercase text-portal-soft mr-2">Preferred receive date</span>
                  <span className="text-portal-ink">{new Date(data.preferred_due_at).toLocaleDateString()}</span>
                </div>
              )}
              {data.message && (
                <div>
                  <div className="text-[10px] tracking-[0.28em] uppercase text-portal-soft font-medium mb-2">Notes</div>
                  <div className="border-l-2 border-portal-line2 pl-4 py-1 text-[13px] text-portal-graphite whitespace-pre-wrap leading-relaxed">
                    {data.message}
                  </div>
                </div>
              )}
              {data.decline_reason && (
                <div>
                  <div className="text-[10px] tracking-[0.28em] uppercase text-[#7a3f3f] font-medium mb-2">Decline reason</div>
                  <div className="border border-[#cdb0a8] bg-[#f7eeea] p-4 text-[13px] text-[#5d2d2d] whitespace-pre-wrap leading-relaxed">
                    {data.decline_reason}
                  </div>
                </div>
              )}
              {data.converted_memo_id && (
                <Link
                  to={`/store-portal/memos/${data.converted_memo_id}`}
                  className="block border border-portal-champagne/70 p-4 hover:bg-portal-bone transition-colors"
                >
                  <div className="text-[10px] tracking-[0.28em] uppercase text-portal-champagne font-medium">View resulting memo</div>
                  <div className="font-serif-display text-[18px] text-portal-ink mt-1.5">Open memo →</div>
                </Link>
              )}
              <div>
                <div className="text-[10px] tracking-[0.28em] uppercase text-portal-soft font-medium mb-3">
                  Items · {data.items?.length || 0}
                </div>
                <div className="border border-portal-line divide-y divide-portal-line">
                  {(data.items || []).map((it) => {
                    const snap = it.snapshot || {};
                    const title = it.item_type === "jewelry"
                      ? (snap.name || it.item_sku)
                      : `${snap.shape || ""} ${snap.weightCt ? `${snap.weightCt} ct` : ""}`.trim() || it.item_sku;
                    return (
                      <div key={it.id} className="flex items-center gap-3 px-3.5 py-2.5">
                        <div className="w-10 h-10 bg-portal-pearl border border-portal-line overflow-hidden shrink-0">
                          {snap.imageUrl ? <img src={snap.imageUrl} alt="" className="w-full h-full object-cover" /> : null}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12.5px] text-portal-ink truncate">{title}</div>
                          <div className="text-[9.5px] tracking-[0.22em] uppercase text-portal-soft mt-0.5">{it.item_sku}</div>
                        </div>
                        <span className="text-[9px] tracking-[0.28em] uppercase text-portal-muted font-medium">
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
          <div className="px-6 py-4 border-t border-portal-line flex justify-end bg-portal-bone">
            <button
              onClick={cancel}
              disabled={busy}
              className="text-[10px] tracking-[0.28em] uppercase text-[#7a3f3f] hover:text-[#5d2d2d] font-medium transition-colors disabled:opacity-40 px-2 py-2"
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
      <div className="h-px w-12 bg-portal-champagne mx-auto mb-6" />
      <div className="font-serif-display text-[22px] text-portal-ink">No requests yet</div>
      <div className="text-[12.5px] text-portal-muted mt-3 max-w-sm mx-auto leading-relaxed">
        Browse the inventory to mark pieces, or write a free-text request describing what you need.
      </div>
      <Link
        to="/store-portal/catalog"
        className="inline-flex items-center mt-8 px-7 py-3 bg-portal-ink text-portal-bone text-[11px] tracking-[0.28em] uppercase font-medium hover:bg-portal-graphite transition-colors"
      >
        Browse inventory
      </Link>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-start gap-5 px-5 sm:px-7 py-5 animate-pulse">
      <div className="flex-1 min-w-0 space-y-3">
        <div className="h-3 w-32 bg-portal-pearl" />
        <div className="h-6 w-48 bg-portal-pearl" />
        <div className="h-3 w-64 bg-portal-pearl" />
      </div>
    </div>
  );
}
