import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import {
  fetchMemo,
  updateMemo,
  updateMemoItem,
  deleteMemoItem,
  addMemoItems,
  issueMemo,
  closeMemo,
  deleteMemo,
  fetchMemoActivity,
  MEMO_STATUSES,
  ITEM_STATUSES,
  isMemoEffectivelyExpired,
} from "../../services/memosApi";
import { approveMemoItemRequest, declineMemoItemRequest } from "../../services/portalApi";
import StonePicker from "./components/StonePicker";
import { Skeleton, SkeletonCard } from "../../components/ui/Skeleton";

/**
 * MemoDetail — document-style detail page for a single memo.
 *
 * Layout (desktop):
 *   ┌──────────────────────────────────────────────────────┐
 *   │ Top bar: back / actions                              │
 *   ├──────────────────────────────────────────────────────┤
 *   │ Hero: MEMO #, status pill, due-countdown, issuer     │
 *   ├──────────────────────────────────────────────────────┤
 *   │ FROM ────────────────┬──── TO ───────────────────────│
 *   ├──────────────────────────────────────────────────────┤
 *   │ Financial summary with split progress bar            │
 *   ├──────────────────────────────────────────────────────┤
 *   │ Items (rich rows with specs + per-item notes drawer) │
 *   ├──────────────────────────────────────────────────────┤
 *   │ Timeline + Notes (visible / internal)                │
 *   └──────────────────────────────────────────────────────┘
 *
 * The whole page also has a print-only stylesheet so File → Print
 * (or "Print / PDF" in the toolbar) yields a clean letterhead document.
 */

/* ─────────── tiny helpers ─────────── */

const fmtMoney = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
const fmtDateLong = (iso) => iso ? new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "—";
const fmtRelative = (iso) => {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return fmtDate(iso);
};
const initials = (name) => (name || "?").split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
const daysFromNow = (iso) => {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86400_000);
};

/* ─────────── main page ─────────── */

export default function MemoDetail() {
  const { id } = useParams();
  const { user } = useUser();
  const navigate = useNavigate();
  const [memo, setMemo] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);

  const reload = async () => {
    if (!user?.id || !id) return;
    setLoading(true);
    try {
      const [m, a] = await Promise.all([
        fetchMemo(user.id, id),
        fetchMemoActivity(user.id, id).catch(() => []),
      ]);
      setMemo(m);
      setActivity(a);
    } catch (e) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [id, user?.id]);

  const totals = useMemo(() => {
    if (!memo?.items) return { count: 0, out: 0, returned: 0, sold: 0, totalValue: 0, soldValue: 0, returnedValue: 0, outValue: 0 };
    const sumBy = (filter) => memo.items.filter(filter).reduce((a, i) => a + Number(i.memo_price || 0), 0);
    return {
      count: memo.items.length,
      out: memo.items.filter((i) => i.status === "out").length,
      returned: memo.items.filter((i) => i.status === "returned").length,
      sold: memo.items.filter((i) => i.status === "sold").length,
      totalValue: sumBy(() => true),
      outValue: sumBy((i) => i.status === "out"),
      returnedValue: sumBy((i) => i.status === "returned"),
      soldValue: sumBy((i) => i.status === "sold"),
    };
  }, [memo]);

  const expired = memo && isMemoEffectivelyExpired(memo);
  const effectiveStatus = expired ? "expired" : memo?.status;
  const isDraft  = memo?.status === "draft";
  const isOpen   = memo?.status === "out" || memo?.status === "partially_returned";

  /* ── handlers ── */

  const handleAddItems = async (picked) => {
    const items = picked.map((s) => {
      const isJewelry = s.category === "Jewelry";
      const listed = Number(s.priceTotal || 0);
      const defaultPrice = isJewelry ? listed : (listed ? Math.round(listed / 2) : null);
      return {
        itemType: isJewelry ? "jewelry" : "stone",
        itemSku: s.sku, itemId: isJewelry ? null : String(s.id || ""),
        memoPrice: defaultPrice,
        snapshot: {
          shape: s.shape, weightCt: s.weightCt, color: s.color, clarity: s.clarity,
          lab: s.lab, certificateNumber: s.certificateNumber, imageUrl: s.imageUrl,
          priceTotal: s.priceTotal, pricePerCt: s.pricePerCt, title: s.title,
          jewelryType: s.jewelryType, metalType: s.metalType, stoneType: s.stoneType,
          collection: s.collection, style: s.style, category: s.category,
        },
      };
    });
    try {
      await addMemoItems(user.id, id, items);
      toast.success(`Added ${items.length} item${items.length !== 1 ? "s" : ""}`);
      setShowPicker(false);
      reload();
    } catch (e) { toast.error(e.message); }
  };

  const updateItem = async (item, patch, successMsg) => {
    try {
      await updateMemoItem(user.id, id, item.id, patch);
      if (successMsg) toast.success(successMsg);
      reload();
    } catch (e) { toast.error(e.message); }
  };

  const removeItem = async (item) => {
    if (!window.confirm(`Remove ${item.item_sku} from this memo?`)) return;
    try {
      await deleteMemoItem(user.id, id, item.id);
      toast.success("Removed");
      reload();
    } catch (e) { toast.error(e.message); }
  };

  const handleIssue = async () => {
    if (!window.confirm("Issue this memo? After issuing, items can no longer be added/removed — only marked returned or sold.")) return;
    try { await issueMemo(user.id, id); toast.success("Memo issued"); reload(); }
    catch (e) { toast.error(e.message); }
  };

  const handleClose = async () => {
    if (!window.confirm("Force-close this memo? Any items still out will be marked as returned.")) return;
    try { await closeMemo(user.id, id); toast.success("Memo closed"); reload(); }
    catch (e) { toast.error(e.message); }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this draft memo? This cannot be undone.")) return;
    try { await deleteMemo(user.id, id); toast.success("Memo deleted"); navigate("/crm/memos"); }
    catch (e) { toast.error(e.message); }
  };

  const handlePatch = async (patch) => {
    try { await updateMemo(user.id, id, patch); toast.success("Saved"); reload(); }
    catch (e) { toast.error(e.message); }
  };

  // Owner-side approval workflow — confirm / reject the store user's
  // pending request (sold/return) on a single item.
  const approveRequest = async (item) => {
    try {
      await approveMemoItemRequest(user.id, id, item.id);
      toast.success(`Approved · ${item.item_sku} marked ${item.pending_status}`);
      reload();
    } catch (e) { toast.error(e.message); }
  };
  const declineRequest = async (item) => {
    const reason = window.prompt(
      `Decline the store's request to mark ${item.item_sku} as ${item.pending_status}?\n\nOptional reason (sent to your activity log):`,
      ""
    );
    if (reason === null) return;
    try {
      await declineMemoItemRequest(user.id, id, item.id, reason || null);
      toast.success("Request declined");
      reload();
    } catch (e) { toast.error(e.message); }
  };

  if (loading || !memo) {
    return (
      <div className="space-y-3 max-w-5xl mx-auto">
        <Skeleton className="h-12 w-full" />
        <SkeletonCard lines={5} />
        <SkeletonCard lines={4} />
      </div>
    );
  }

  return (
    <div className="memo-doc max-w-5xl mx-auto space-y-4 print:max-w-full print:p-0">
      <PrintStyles />

      {/* Top toolbar */}
      <Toolbar
        memo={memo}
        isDraft={isDraft}
        isOpen={isOpen}
        itemCount={totals.count}
        onPrint={() => window.print()}
        onIssue={handleIssue}
        onClose={handleClose}
        onDelete={handleDelete}
      />

      {/* Document hero */}
      <Hero memo={memo} effectiveStatus={effectiveStatus} expired={expired} />

      {/* From / To strip */}
      <FromToStrip memo={memo} />

      {/* Financial summary with progress bar */}
      <FinancialSummary memo={memo} totals={totals} />

      {/* Items list */}
      <ItemsCard
        memo={memo}
        isDraft={isDraft}
        isOpen={isOpen}
        onAddClick={() => setShowPicker(true)}
        onUpdate={updateItem}
        onRemove={removeItem}
        onApprove={approveRequest}
        onDecline={declineRequest}
      />

      {/* Lower row: timeline + notes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
          <NotesCard memo={memo} onPatch={handlePatch} disabled={memo.status === "closed"} />
        </div>
        <div className="space-y-3 sm:space-y-4">
          <TimelineCard activity={activity} memo={memo} />
        </div>
      </div>

      {showPicker && <StonePicker onClose={() => setShowPicker(false)} onSelect={handleAddItems} />}
    </div>
  );
}

/* ─────────── Toolbar ─────────── */

function Toolbar({ memo, isDraft, isOpen, itemCount, onPrint, onIssue, onClose, onDelete }) {
  return (
    <div className="flex items-center justify-between print:hidden">
      <Link
        to={`/crm/memos${memo.company_id ? `?companyId=${memo.company_id}` : ""}`}
        className="inline-flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to memos
      </Link>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <button onClick={onPrint} title="Print / save as PDF" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-50">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          Print / PDF
        </button>
        {isDraft && (
          <>
            <button onClick={onDelete} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-rose-600 text-xs font-semibold hover:bg-rose-50">
              Delete draft
            </button>
            <button
              onClick={onIssue}
              disabled={itemCount === 0}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
            >
              Issue memo
            </button>
          </>
        )}
        {isOpen && (
          <button onClick={onClose} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800">
            Close memo
          </button>
        )}
      </div>
    </div>
  );
}

/* ─────────── Hero ─────────── */

function Hero({ memo, effectiveStatus, expired }) {
  const status = MEMO_STATUSES.find((s) => s.value === effectiveStatus) || MEMO_STATUSES[0];
  const days = daysFromNow(memo.due_at);
  const issuer = memo.created_by_name || memo.assigned_to_name || "—";

  let countdown = null;
  if (memo.status === "out" || memo.status === "partially_returned") {
    if (days == null) countdown = null;
    else if (days < 0) countdown = { label: `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`, tone: "text-rose-600" };
    else if (days === 0) countdown = { label: "Due today", tone: "text-amber-600" };
    else if (days <= 7) countdown = { label: `${days} day${days === 1 ? "" : "s"} left`, tone: "text-amber-600" };
    else countdown = { label: `${days} days left`, tone: "text-stone-500" };
  }

  return (
    <div className="bg-white border border-stone-200 rounded-2xl px-4 sm:px-6 py-4 sm:py-5 print:rounded-none print:border-0 print:px-0 print:py-2">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-[10px] uppercase tracking-[0.18em] text-stone-400 font-bold print:tracking-widest">Memo</div>
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
            <Meta label="Issued by" value={
              <span className="inline-flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center text-[10px] font-bold">
                  {initials(issuer)}
                </span>
                {issuer}
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

/* ─────────── From / To strip (letterhead-style) ─────────── */

function FromToStrip({ memo }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
      <Party
        kind="From"
        name={memo.owner_name || "Workspace owner"}
        email={memo.owner_email}
        accent="border-stone-300"
      />
      <Party
        kind="To"
        name={memo.company_name}
        email={memo.company_email}
        phone={memo.company_phone}
        address={[memo.company_address, memo.company_city, memo.company_country].filter(Boolean).join(", ")}
        website={memo.company_website}
        taxId={memo.company_tax_id}
        contact={memo.contact_name}
        contactEmail={memo.contact_email}
        contactPhone={memo.contact_phone}
        logoUrl={memo.company_logo}
        link={`/crm/stores/${memo.company_id}`}
        accent="border-stone-900"
      />
    </div>
  );
}

function Party({ kind, name, email, phone, address, website, taxId, contact, contactEmail, contactPhone, logoUrl, link, accent }) {
  return (
    <div className={`bg-white border-l-4 ${accent} border border-stone-200 rounded-xl p-4 print:rounded-none`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-[0.15em] text-stone-400 font-bold">{kind}</div>
        {link && (
          <Link to={link} className="text-[11px] text-stone-500 hover:text-stone-900 font-semibold inline-flex items-center gap-0.5 print:hidden">
            View
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </Link>
        )}
      </div>
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
            {website && (
              <a href={website} target="_blank" rel="noopener noreferrer" className="text-stone-700 hover:text-stone-900 break-all block print:text-stone-600">
                ◷ {website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {taxId && <div>Tax ID: {taxId}</div>}
          </div>
          {(contact || contactEmail || contactPhone) && (
            <div className="mt-2 pt-2 border-t border-stone-100 text-xs">
              <div className="text-[10px] uppercase tracking-wider text-stone-400 font-bold mb-0.5">Attention</div>
              <div className="font-semibold text-stone-700">{contact}</div>
              {contactEmail && <div className="text-stone-500 break-all">{contactEmail}</div>}
              {contactPhone && <div className="text-stone-500">{contactPhone}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Financial summary ─────────── */

function FinancialSummary({ memo, totals }) {
  const total = totals.totalValue || 0;
  const pct = (v) => total > 0 ? (v / total) * 100 : 0;

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 sm:p-5 print:rounded-none">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Stat label="Total" value={fmtMoney(total)} sub={`${totals.count} item${totals.count !== 1 ? "s" : ""}`} />
        <Stat label="Out"      value={fmtMoney(totals.outValue)}      sub={`${totals.out} item${totals.out !== 1 ? "s" : ""}`}      tone="text-blue-600" />
        <Stat label="Returned" value={fmtMoney(totals.returnedValue)} sub={`${totals.returned} item${totals.returned !== 1 ? "s" : ""}`} tone="text-stone-700" />
        <Stat label="Sold"     value={fmtMoney(totals.soldValue)}     sub={`${totals.sold} item${totals.sold !== 1 ? "s" : ""}`}     tone="text-emerald-600" />
      </div>
      {/* Progress bar */}
      {total > 0 && (
        <div className="mt-4">
          <div className="flex h-2 rounded-full overflow-hidden bg-stone-100 print:border print:border-stone-300">
            {totals.outValue > 0      && <div className="bg-blue-500"    style={{ width: `${pct(totals.outValue)}%` }}      title={`Out: ${fmtMoney(totals.outValue)}`} />}
            {totals.returnedValue > 0 && <div className="bg-stone-400"   style={{ width: `${pct(totals.returnedValue)}%` }} title={`Returned: ${fmtMoney(totals.returnedValue)}`} />}
            {totals.soldValue > 0     && <div className="bg-emerald-500" style={{ width: `${pct(totals.soldValue)}%` }}     title={`Sold: ${fmtMoney(totals.soldValue)}`} />}
          </div>
          <div className="flex items-center gap-3 mt-2 text-[10px] uppercase tracking-wider text-stone-500 font-bold flex-wrap">
            <Legend color="bg-blue-500"    label="Out" />
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

function ItemsCard({ memo, isDraft, isOpen, onAddClick, onUpdate, onRemove, onApprove, onDecline }) {
  const pendingCount = memo.items.filter((i) => i.pending_status).length;
  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden print:rounded-none">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-semibold text-stone-900">Items ({memo.items.length})</h2>
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200 print:hidden">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              {pendingCount} store request{pendingCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {isDraft && (
          <button
            onClick={onAddClick}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 print:hidden"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add items
          </button>
        )}
      </div>
      {memo.items.length === 0 ? (
        <div className="p-8 text-center text-sm text-stone-400">No items in this memo</div>
      ) : (
        <div className="divide-y divide-stone-100">
          {memo.items.map((it) => (
            <ItemRow
              key={it.id}
              item={it}
              isDraft={isDraft}
              isOpen={isOpen}
              onUpdate={onUpdate}
              onRemove={() => onRemove(it)}
              onApprove={onApprove}
              onDecline={onDecline}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemRow({ item, isDraft, isOpen, onUpdate, onRemove, onApprove, onDecline }) {
  const [price, setPrice] = useState(item.memo_price ?? "");
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState(item.notes || "");
  useEffect(() => { setPrice(item.memo_price ?? ""); }, [item.memo_price]);
  useEffect(() => { setNotes(item.notes || ""); }, [item.notes]);

  const snap = item.snapshot || {};
  const status = ITEM_STATUSES.find((s) => s.value === item.status) || ITEM_STATUSES[0];
  const isJewelry = item.item_type === "jewelry";

  // Build a human-readable spec line for either category
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
  const isPending = !!item.pending_status;

  return (
    <div className={`transition-colors print:hover:bg-transparent ${isPending ? "bg-amber-50/40 hover:bg-amber-50" : "hover:bg-stone-50"}`}>
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
              <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 print:hidden">
                Store requested · {item.pending_status === "sold" ? "sale" : "return"}
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
            <div className="text-xs text-amber-700 mt-1.5 italic line-clamp-2 break-words print:hidden">
              <span className="font-semibold not-italic">Store note:</span> "{item.pending_note}"
            </div>
          )}
          {item.notes && !notesOpen && (
            <div className="text-xs text-stone-600 mt-1.5 italic line-clamp-2 break-words">"{item.notes}"</div>
          )}
        </div>
        <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
          {isDraft ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-stone-500">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                onBlur={() => price !== "" && Number(price) !== Number(item.memo_price) && onUpdate(item, { memoPrice: Number(price) })}
                className="w-24 px-2 py-1 text-sm text-right rounded-md border border-stone-200 bg-white focus:outline-none focus:border-stone-400"
              />
            </div>
          ) : (
            <div className="text-sm sm:text-base font-bold text-stone-900">{fmtMoney(item.memo_price)}</div>
          )}
          <div className="flex items-center gap-1 print:hidden">
            <button
              onClick={() => setNotesOpen((o) => !o)}
              title="Item notes"
              className={`p-1 rounded-md text-[10px] font-semibold ${item.notes ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "text-stone-500 hover:bg-stone-100"}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
            {isDraft && (
              <button onClick={onRemove} title="Remove" className="p-1 rounded-md hover:bg-rose-50 text-rose-500">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
            {isOpen && item.status === "out" && !isPending && (
              <>
                <button
                  onClick={() => onUpdate(item, { status: "returned" }, "Marked returned")}
                  className="px-2 py-1 rounded-md bg-stone-100 text-stone-700 text-[10px] font-semibold hover:bg-stone-200"
                >
                  Returned
                </button>
                <button
                  onClick={() => onUpdate(item, { status: "sold" }, "Marked as sold")}
                  className="px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-semibold hover:bg-emerald-200"
                >
                  Sold
                </button>
              </>
            )}
            {isPending && onApprove && onDecline && (
              <>
                <button
                  onClick={() => onDecline(item)}
                  title="Decline store request"
                  className="px-2 py-1 rounded-md bg-white border border-stone-300 text-stone-700 text-[10px] font-semibold hover:bg-stone-50"
                >
                  Decline
                </button>
                <button
                  onClick={() => onApprove(item)}
                  title={`Approve · mark ${item.item_sku} as ${item.pending_status}`}
                  className={`px-2 py-1 rounded-md text-white text-[10px] font-semibold ${
                    item.pending_status === "sold"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-stone-700 hover:bg-stone-800"
                  }`}
                >
                  Approve
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Inline notes drawer */}
      {notesOpen && (
        <div className="px-3 sm:px-4 pb-3 print:hidden">
          <div className="bg-stone-50 border border-stone-200 rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wider text-stone-500 font-bold mb-1">Item notes</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Notes about this specific item — color match concerns, sizing requests, customer reactions..."
              className="w-full px-2 py-1.5 text-sm rounded border border-stone-200 bg-white focus:outline-none focus:border-stone-400 resize-none"
            />
            <div className="flex items-center justify-end gap-2 mt-2">
              <button onClick={() => { setNotes(item.notes || ""); setNotesOpen(false); }} className="text-[11px] text-stone-500 hover:text-stone-800 font-semibold">
                Cancel
              </button>
              <button
                onClick={async () => { await onUpdate(item, { notes: notes || null }); setNotesOpen(false); }}
                className="px-2.5 py-1 rounded-md bg-stone-900 text-white text-[11px] font-semibold hover:bg-stone-800"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────── Notes card ─────────── */

function NotesCard({ memo, onPatch, disabled }) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(memo.notes || "");
  const [internalNotes, setInternalNotes] = useState(memo.internal_notes || "");
  const [dueAt, setDueAt] = useState(memo.due_at ? new Date(memo.due_at).toISOString().slice(0, 10) : "");
  useEffect(() => {
    setNotes(memo.notes || "");
    setInternalNotes(memo.internal_notes || "");
    setDueAt(memo.due_at ? new Date(memo.due_at).toISOString().slice(0, 10) : "");
  }, [memo]);

  return (
    <div className="bg-white border border-stone-200 rounded-xl print:rounded-none">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <h3 className="font-semibold text-stone-900 text-sm">Notes</h3>
        {!editing && !disabled && (
          <button onClick={() => setEditing(true)} className="text-xs font-semibold text-stone-600 hover:text-stone-900 print:hidden">
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="p-4 space-y-3">
          <label className="block">
            <div className="text-[10px] uppercase tracking-wider text-stone-500 font-bold mb-1">Visible to store</div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 focus:outline-none focus:border-stone-400 resize-none"
              placeholder="Approval memo for Q2..." />
          </label>
          <label className="block">
            <div className="text-[10px] uppercase tracking-wider text-amber-700 font-bold mb-1">Internal — team only</div>
            <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg border border-amber-200 bg-amber-50/50 focus:outline-none focus:border-amber-400 resize-none"
              placeholder="Watch for return policy, prefers conservative pricing..." />
          </label>
          <label className="block">
            <div className="text-[10px] uppercase tracking-wider text-stone-500 font-bold mb-1">Due date</div>
            <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 focus:outline-none focus:border-stone-400" />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-stone-600 hover:bg-stone-100">
              Cancel
            </button>
            <button
              onClick={async () => { await onPatch({ notes: notes || null, internalNotes: internalNotes || null, dueAt: dueAt || null }); setEditing(false); }}
              className="px-3 py-1.5 rounded-lg bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 sm:gap-3 p-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-stone-500 font-bold mb-1">Visible to store</div>
            {memo.notes ? (
              <div className="text-sm text-stone-700 whitespace-pre-wrap break-words">{memo.notes}</div>
            ) : (
              <div className="text-xs text-stone-400 italic">No notes</div>
            )}
          </div>
          <div className="mt-3 sm:mt-0 print:hidden">
            <div className="text-[10px] uppercase tracking-wider text-amber-700 font-bold mb-1">Internal — team only</div>
            {memo.internal_notes ? (
              <div className="text-sm text-amber-900 whitespace-pre-wrap break-words bg-amber-50 border border-amber-200 rounded p-2">
                {memo.internal_notes}
              </div>
            ) : (
              <div className="text-xs text-stone-400 italic">No internal notes</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────── Timeline card ─────────── */

function TimelineCard({ activity, memo }) {
  // Synthesize a couple of guaranteed entries from the memo itself in
  // case the activity_log is empty or partially backfilled.
  const synthetic = [];
  if (memo.created_at) synthetic.push({ id: "syn-created", action: "created", occurred_at: memo.created_at, summary: `Memo created${memo.created_by_name ? ` by ${memo.created_by_name}` : ""}`, _synthetic: true });
  if (memo.issued_at)  synthetic.push({ id: "syn-issued",  action: "issued",  occurred_at: memo.issued_at,  summary: `Memo issued`, _synthetic: true });
  if (memo.closed_at)  synthetic.push({ id: "syn-closed",  action: "closed",  occurred_at: memo.closed_at,  summary: `Memo closed`, _synthetic: true });

  // Merge: activity log entries take precedence, synthetic fills gaps
  // when a corresponding action isn't yet logged for this memo.
  const seenActions = new Set(activity.map((a) => a.action));
  const merged = [...activity, ...synthetic.filter((s) => !seenActions.has(s.action))];
  merged.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

  return (
    <div className="bg-white border border-stone-200 rounded-xl print:hidden">
      <div className="px-4 py-3 border-b border-stone-100">
        <h3 className="font-semibold text-stone-900 text-sm">Timeline</h3>
      </div>
      {merged.length === 0 ? (
        <div className="p-6 text-center text-sm text-stone-400">No activity yet</div>
      ) : (
        <ol className="p-4 space-y-3">
          {merged.map((a) => <TimelineRow key={a.id} entry={a} />)}
        </ol>
      )}
    </div>
  );
}

function TimelineRow({ entry }) {
  const tones = {
    created: "bg-stone-100 text-stone-700",
    issued: "bg-emerald-100 text-emerald-700",
    closed: "bg-stone-900 text-white",
    item_sold: "bg-emerald-100 text-emerald-700",
    item_returned: "bg-blue-100 text-blue-700",
    deleted: "bg-rose-100 text-rose-700",
    updated: "bg-stone-100 text-stone-600",
  };
  const dotTone = tones[entry.action] || "bg-stone-100 text-stone-700";
  const actor = entry.resolved_actor_name || entry.actor_name;

  return (
    <li className="flex gap-2.5">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold uppercase ${dotTone}`}>
        {entry.action === "issued" ? "→" :
         entry.action === "closed" ? "✓" :
         entry.action === "item_sold" ? "$" :
         entry.action === "item_returned" ? "↺" :
         entry.action === "deleted" ? "×" : "•"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-stone-700 break-words">{entry.summary || entry.action}</div>
        <div className="text-[11px] text-stone-400">
          {fmtRelative(entry.occurred_at)} {actor && <>· {actor}</>}
        </div>
      </div>
    </li>
  );
}

/* ─────────── Print-only stylesheet ─────────── */

function PrintStyles() {
  // Scoped print rules so the page renders as a clean letterhead-style
  // document when the user hits "Print / PDF" or browser print.
  return (
    <style>{`
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
        .memo-doc { padding: 0 !important; max-width: 100% !important; }
        .memo-doc * { box-shadow: none !important; }
        .memo-doc .print\\:rounded-none { border-radius: 0 !important; }
        nav, header, aside, .sidebar { display: none !important; }
        .memo-doc { font-size: 12pt; color: #1c1917; }
        .memo-doc h1 { font-size: 28pt; }
        .memo-doc h2 { font-size: 14pt; }
        @page { margin: 14mm 12mm; }
      }
    `}</style>
  );
}
