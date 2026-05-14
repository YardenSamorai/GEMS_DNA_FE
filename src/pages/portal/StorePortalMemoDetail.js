import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import {
  fetchPortalMemo,
  requestMemoItemAction,
  cancelMemoItemRequest,
} from "../../services/portalApi";
import {
  MEMO_STATUSES,
  ITEM_STATUSES,
  isMemoEffectivelyExpired,
} from "../../services/memosApi";

/**
 * StorePortalMemoDetail — single-memo view for retail-store users.
 *
 * Same document-style language as the supplier's MemoDetail:
 *   - Hero with memo number + status pill + due-countdown
 *   - From / To strip (here flipped: TO is the supplier, FROM is the store)
 *   - Financial summary (Total / Out / Returned / Sold) + split bar
 *   - Items list with rich rows + per-item action drawer
 *
 * Differences from the supplier view:
 *   - No add/remove items, no edit price.
 *   - Action buttons per item are "Mark sold" / "Request return"
 *     and they go into pending_status until the supplier approves.
 *   - Internal notes / cost / Bruto are never sent over the portal.
 */

/* ─── tiny helpers (copied from MemoDetail to keep look identical) ─── */
const fmtMoney = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
const fmtDateLong = (iso) => iso ? new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "—";
const initials = (name) => (name || "?").split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
const daysFromNow = (iso) => {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86400_000);
};

export default function StorePortalMemoDetail() {
  const { id } = useParams();
  const { user } = useUser();
  const navigate = useNavigate();
  const [memo, setMemo] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    if (!user?.id || !id) return;
    setLoading(true);
    try {
      const m = await fetchPortalMemo(user.id, id);
      setMemo(m);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [id, user?.id]);

  const totals = useMemo(() => {
    if (!memo?.items) return { count: 0, out: 0, returned: 0, sold: 0, totalValue: 0, soldValue: 0, returnedValue: 0, outValue: 0, pending: 0 };
    const sumBy = (filter) => memo.items.filter(filter).reduce((a, i) => a + Number(i.memo_price || 0), 0);
    return {
      count: memo.items.length,
      out: memo.items.filter((i) => i.status === "out").length,
      returned: memo.items.filter((i) => i.status === "returned").length,
      sold: memo.items.filter((i) => i.status === "sold").length,
      pending: memo.items.filter((i) => i.pending_status).length,
      totalValue: sumBy(() => true),
      outValue: sumBy((i) => i.status === "out"),
      returnedValue: sumBy((i) => i.status === "returned"),
      soldValue: sumBy((i) => i.status === "sold"),
    };
  }, [memo]);

  if (loading && !memo) return <DetailSkeleton />;
  if (!memo) return null;

  const expired = isMemoEffectivelyExpired(memo);
  const effectiveStatus = expired ? "expired" : memo.status;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-stone-500 hover:text-stone-900"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">Back</span>
        </button>
        {totals.pending > 0 && (
          <div className="text-[10px] sm:text-xs uppercase tracking-wider font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            {totals.pending} request{totals.pending !== 1 ? "s" : ""} pending
          </div>
        )}
      </div>

      <Hero memo={memo} effectiveStatus={effectiveStatus} expired={expired} />
      <FromToStrip memo={memo} />
      <FinancialSummary totals={totals} />
      <ItemsCard memo={memo} reload={reload} userId={user?.id} />

      {memo.notes && (
        <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-stone-400 font-bold mb-1.5">Notes from supplier</div>
          <div className="text-sm text-stone-700 whitespace-pre-wrap break-words">{memo.notes}</div>
        </div>
      )}
    </div>
  );
}

/* ─────────── Hero ─────────── */

function Hero({ memo, effectiveStatus, expired }) {
  const status = MEMO_STATUSES.find((s) => s.value === effectiveStatus) || MEMO_STATUSES[0];
  const days = daysFromNow(memo.due_at);

  let countdown = null;
  if (memo.status === "out" || memo.status === "partially_returned") {
    if (days == null) countdown = null;
    else if (days < 0)  countdown = { label: `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`, tone: "text-rose-600" };
    else if (days === 0) countdown = { label: "Due today",        tone: "text-amber-600" };
    else if (days <= 7)  countdown = { label: `${days} day${days === 1 ? "" : "s"} left`, tone: "text-amber-600" };
    else                  countdown = { label: `${days} days left`, tone: "text-stone-500" };
  }

  const supplier = memo.supplier_name || "Supplier";

  return (
    <div className="bg-white border border-stone-200 rounded-2xl px-4 sm:px-6 py-4 sm:py-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-[10px] uppercase tracking-[0.18em] text-stone-400 font-bold">Memo</div>
            <span className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${status.color}`}>
              {status.label}
            </span>
            {countdown && (
              <span className={`text-[11px] font-semibold ${countdown.tone}`}>· {countdown.label}</span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 mt-0.5 break-all">{memo.memo_number}</h1>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
            <Meta label="Issued" value={memo.issued_at ? fmtDateLong(memo.issued_at) : <span className="italic text-stone-400">Not yet</span>} />
            <Meta label="Due" value={<span className={expired ? "text-rose-600 font-semibold" : ""}>{fmtDateLong(memo.due_at)}</span>} />
            <Meta label="From" value={
              <span className="inline-flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center text-[10px] font-bold">
                  {initials(supplier)}
                </span>
                {supplier}
              </span>
            } />
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-stone-500 font-medium mb-0.5">{label}</div>
      <div className="text-stone-800">{value}</div>
    </div>
  );
}

/* ─────────── From / To strip ─────────── */

function FromToStrip({ memo }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
      <Party
        kind="From (Supplier)"
        name={memo.supplier_name || "Supplier"}
        email={memo.supplier_email}
        accent="border-stone-300"
      />
      <Party
        kind="To (You)"
        name={memo.company_name}
        email={memo.company_email}
        phone={memo.company_phone}
        address={[memo.company_address, memo.company_city, memo.company_country].filter(Boolean).join(", ")}
        logoUrl={memo.company_logo}
        accent="border-stone-900"
      />
    </div>
  );
}

function Party({ kind, name, email, phone, address, logoUrl, accent }) {
  return (
    <div className={`bg-white border-l-4 ${accent} border border-stone-200 rounded-xl p-4`}>
      <div className="text-[10px] uppercase tracking-[0.15em] text-stone-400 font-bold mb-2">{kind}</div>
      <div className="flex items-start gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt={name} className="w-10 h-10 rounded-lg object-cover bg-stone-100 ring-1 ring-stone-200 shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-stone-700 to-stone-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
            {initials(name)}
          </div>
        )}
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-semibold text-stone-900 truncate">{name}</div>
          {address && <div className="text-xs text-stone-500 break-words">{address}</div>}
          <div className="mt-1.5 space-y-0.5 text-xs text-stone-600">
            {email && <div className="break-all">✉ {email}</div>}
            {phone && <div>☎ {phone}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Financial summary ─────────── */

function FinancialSummary({ totals }) {
  const total = totals.totalValue || 0;
  const pct = (v) => total > 0 ? (v / total) * 100 : 0;

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 sm:p-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Stat label="Total"    value={fmtMoney(total)}             sub={`${totals.count} item${totals.count !== 1 ? "s" : ""}`} />
        <Stat label="On memo"  value={fmtMoney(totals.outValue)}   sub={`${totals.out} item${totals.out !== 1 ? "s" : ""}`}     tone="text-blue-600" />
        <Stat label="Returned" value={fmtMoney(totals.returnedValue)} sub={`${totals.returned} item${totals.returned !== 1 ? "s" : ""}`} tone="text-stone-700" />
        <Stat label="Sold"     value={fmtMoney(totals.soldValue)}  sub={`${totals.sold} item${totals.sold !== 1 ? "s" : ""}`}    tone="text-emerald-600" />
      </div>
      {total > 0 && (
        <div className="mt-4">
          <div className="flex h-2 rounded-full overflow-hidden bg-stone-100">
            {totals.outValue > 0      && <div className="bg-blue-500"    style={{ width: `${pct(totals.outValue)}%` }} />}
            {totals.returnedValue > 0 && <div className="bg-stone-400"   style={{ width: `${pct(totals.returnedValue)}%` }} />}
            {totals.soldValue > 0     && <div className="bg-emerald-500" style={{ width: `${pct(totals.soldValue)}%` }} />}
          </div>
          <div className="flex items-center gap-3 mt-2 text-[10px] uppercase tracking-wider text-stone-500 font-bold flex-wrap">
            <Legend color="bg-blue-500"    label="On memo" />
            <Legend color="bg-stone-400"   label="Returned" />
            <Legend color="bg-emerald-500" label="Sold" />
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone = "text-stone-900" }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">{label}</div>
      <div className={`text-xl sm:text-2xl font-bold ${tone}`}>{value}</div>
      {sub && <div className="text-[11px] text-stone-400">{sub}</div>}
    </div>
  );
}

function Legend({ color, label }) {
  return <span className="inline-flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${color}`} />{label}</span>;
}

/* ─────────── Items card ─────────── */

function ItemsCard({ memo, reload, userId }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
        <h2 className="font-semibold text-stone-900">Items ({memo.items.length})</h2>
        <div className="text-[11px] text-stone-400">Tap an item to mark sold or request return</div>
      </div>
      {memo.items.length === 0 ? (
        <div className="p-8 text-center text-sm text-stone-400">No items in this memo</div>
      ) : (
        <div className="divide-y divide-stone-100">
          {memo.items.map((it) => (
            <ItemRow key={it.id} item={it} memoId={memo.id} reload={reload} userId={userId} />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemRow({ item, memoId, reload, userId }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const snap = item.snapshot || {};
  const status = ITEM_STATUSES.find((s) => s.value === item.status) || ITEM_STATUSES[0];
  const isJewelry = item.item_type === "jewelry";
  const isOut = item.status === "out";
  const isPending = !!item.pending_status;
  const pendingByMe = isPending && item.pending_by === userId;

  const specLine = isJewelry
    ? [snap.jewelryType, snap.metalType, snap.collection, snap.style].filter(Boolean).join(" · ")
    : [
        snap.shape && `${snap.shape}`,
        snap.weightCt && `${snap.weightCt}ct`,
        snap.color, snap.clarity, snap.lab,
      ].filter(Boolean).join(" · ");

  const subSpec = isJewelry
    ? snap.stoneType ? `Stones: ${snap.stoneType}` : null
    : snap.certificateNumber ? `Cert: ${snap.certificateNumber}` : null;

  const title = snap.title || (isJewelry ? snap.jewelryType : snap.shape) || item.item_sku;

  const submitRequest = async (kind) => {
    if (!userId || busy) return;
    setBusy(true);
    try {
      await requestMemoItemAction(userId, memoId, item.id, kind, note || null);
      toast.success(kind === "sold" ? "Marked sold — pending supplier approval" : "Return requested — pending supplier approval");
      setOpen(false);
      setNote("");
      await reload();
    } catch (e) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  const cancelRequest = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await cancelMemoItemRequest(userId, memoId, item.id);
      toast.success("Request cancelled");
      setOpen(false);
      await reload();
    } catch (e) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className={`hover:bg-stone-50 transition-colors ${isPending ? "bg-amber-50/40" : ""}`}>
      <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4">
        {snap.imageUrl ? (
          <img src={snap.imageUrl} alt={item.item_sku} className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover bg-stone-100 ring-1 ring-stone-200 shrink-0" />
        ) : (
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-stone-200 shrink-0 flex items-center justify-center text-stone-400 text-[10px] font-bold">
            {isJewelry ? "JW" : "ST"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[11px] font-semibold text-stone-500">{item.item_sku}</span>
            <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${status.color}`}>
              {status.label}
            </span>
            {isPending && (
              <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                Pending {item.pending_status === "sold" ? "sale" : "return"}
              </span>
            )}
            {item.status === "sold" && item.sold_at && (
              <span className="text-[10px] text-stone-400">{fmtDate(item.sold_at)}</span>
            )}
            {item.status === "returned" && item.returned_at && (
              <span className="text-[10px] text-stone-400">{fmtDate(item.returned_at)}</span>
            )}
          </div>
          <div className="text-sm font-semibold text-stone-900 mt-0.5 truncate">{title}</div>
          {specLine && <div className="text-xs text-stone-500 mt-0.5 truncate">{specLine}</div>}
          {subSpec && <div className="text-[11px] text-stone-400 mt-0.5 truncate">{subSpec}</div>}
          {isPending && item.pending_note && (
            <div className="text-xs text-amber-700 mt-1.5 italic line-clamp-2 break-words">"{item.pending_note}"</div>
          )}
        </div>
        <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
          <div className="text-base sm:text-lg font-bold text-stone-900">
            {item.memo_price ? fmtMoney(item.memo_price) : <span className="text-stone-300 text-sm">—</span>}
          </div>
          {(isOut || pendingByMe) && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="text-[11px] font-semibold text-stone-500 hover:text-stone-900 inline-flex items-center gap-0.5"
            >
              {open ? "Close" : (isPending ? "Manage" : "Action")}
              <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {open && (isOut || pendingByMe) && (
        <div className="px-3 sm:px-4 pb-4 -mt-1">
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 sm:p-4">
            {isPending && pendingByMe ? (
              <>
                <div className="text-xs text-stone-600 mb-3">
                  You requested to mark this item as <span className="font-semibold text-stone-900">{item.pending_status}</span>.
                  The supplier will review and confirm.
                </div>
                <button
                  onClick={cancelRequest}
                  disabled={busy}
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-stone-300 text-stone-700 hover:border-stone-500 disabled:opacity-50"
                >
                  Cancel request
                </button>
              </>
            ) : (
              <>
                <label className="block text-[11px] uppercase tracking-wider text-stone-500 font-bold mb-1.5">
                  Note for supplier (optional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="e.g. customer purchased today / size adjustment needed"
                  className="w-full text-sm border border-stone-200 rounded-lg p-2 focus:outline-none focus:border-stone-400 resize-none"
                />
                <div className="flex flex-col sm:flex-row gap-2 mt-3">
                  <button
                    onClick={() => submitRequest("sold")}
                    disabled={busy}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Mark as sold
                  </button>
                  <button
                    onClick={() => submitRequest("returned")}
                    disabled={busy}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-white border border-stone-300 text-stone-700 text-sm font-semibold hover:border-stone-500 disabled:opacity-50"
                  >
                    Request return
                  </button>
                </div>
                <div className="text-[11px] text-stone-400 mt-2">
                  Your request goes to the supplier for approval before it's applied.
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────── Skeleton ─────────── */

function DetailSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-24 bg-white border border-stone-200 rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="h-28 bg-white border border-stone-200 rounded-xl" />
        <div className="h-28 bg-white border border-stone-200 rounded-xl" />
      </div>
      <div className="h-28 bg-white border border-stone-200 rounded-xl" />
      <div className="h-72 bg-white border border-stone-200 rounded-xl" />
    </div>
  );
}
