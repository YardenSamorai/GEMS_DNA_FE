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
  MEMO_STATUSES,
  ITEM_STATUSES,
  isMemoEffectivelyExpired,
} from "../../services/memosApi";
import StonePicker from "./components/StonePicker";
import { Skeleton, SkeletonCard } from "../../components/ui/Skeleton";

/**
 * Memo detail page.
 *
 * Two life-cycle phases:
 *   - DRAFT: every field is editable, can add/remove items, can issue
 *     (which flips status → out and locks edits to per-item actions).
 *   - ISSUED (out / partially_returned / closed / expired): items can
 *     be marked Returned or Sold; header can be force-closed.
 */
export default function MemoDetail() {
  const { id } = useParams();
  const { user } = useUser();
  const navigate = useNavigate();
  const [memo, setMemo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [editingHeader, setEditingHeader] = useState(false);

  const reload = async () => {
    if (!user?.id || !id) return;
    setLoading(true);
    try {
      const data = await fetchMemo(user.id, id);
      setMemo(data);
    } catch (e) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [id, user?.id]);

  const expired = memo && isMemoEffectivelyExpired(memo);
  const effectiveStatus = expired ? "expired" : memo?.status;
  const isDraft  = memo?.status === "draft";
  const isOpen   = memo?.status === "out" || memo?.status === "partially_returned";

  const totals = useMemo(() => {
    if (!memo?.items) return { count: 0, out: 0, returned: 0, sold: 0, value: 0, soldValue: 0 };
    const count = memo.items.length;
    const out = memo.items.filter((i) => i.status === "out").length;
    const returned = memo.items.filter((i) => i.status === "returned").length;
    const sold = memo.items.filter((i) => i.status === "sold").length;
    const value = memo.items.reduce((a, i) => a + Number(i.memo_price || 0), 0);
    const soldValue = memo.items.filter((i) => i.status === "sold").reduce((a, i) => a + Number(i.memo_price || 0), 0);
    return { count, out, returned, sold, value, soldValue };
  }, [memo]);

  const handleAddItems = async (picked) => {
    const items = picked.map((s) => {
      const isJewelry = s.category === "Jewelry";
      const bruto = Number(s.priceTotal || 0);
      return {
        itemType: isJewelry ? "jewelry" : "stone",
        itemSku: s.sku,
        itemId: isJewelry ? null : String(s.id || ""),
        memoPrice: bruto ? Math.round(bruto / 2) : null,
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

  const handleItemStatus = async (item, newStatus) => {
    try {
      await updateMemoItem(user.id, id, item.id, { status: newStatus });
      toast.success(newStatus === "sold" ? "Marked as sold" : newStatus === "returned" ? "Marked returned" : "Updated");
      reload();
    } catch (e) { toast.error(e.message); }
  };

  const handleItemPrice = async (item, price) => {
    try {
      await updateMemoItem(user.id, id, item.id, { memoPrice: price });
      reload();
    } catch (e) { toast.error(e.message); }
  };

  const handleRemoveItem = async (item) => {
    if (!window.confirm(`Remove ${item.item_sku} from this memo?`)) return;
    try {
      await deleteMemoItem(user.id, id, item.id);
      toast.success("Removed");
      reload();
    } catch (e) { toast.error(e.message); }
  };

  const handleIssue = async () => {
    if (!window.confirm("Issue this memo? After issuing, items can no longer be added/removed — only marked returned or sold.")) return;
    try {
      await issueMemo(user.id, id);
      toast.success("Memo issued");
      reload();
    } catch (e) { toast.error(e.message); }
  };

  const handleClose = async () => {
    if (!window.confirm("Force-close this memo? Any items still out will be marked as returned.")) return;
    try {
      await closeMemo(user.id, id);
      toast.success("Memo closed");
      reload();
    } catch (e) { toast.error(e.message); }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this draft memo? This cannot be undone.")) return;
    try {
      await deleteMemo(user.id, id);
      toast.success("Memo deleted");
      navigate("/crm/memos");
    } catch (e) { toast.error(e.message); }
  };

  const handleHeaderSave = async (patch) => {
    try {
      await updateMemo(user.id, id, patch);
      toast.success("Saved");
      setEditingHeader(false);
      reload();
    } catch (e) { toast.error(e.message); }
  };

  const handlePrint = () => window.print();

  if (loading || !memo) {
    return (
      <div className="space-y-3 max-w-4xl mx-auto">
        <Skeleton className="h-12 w-full" />
        <SkeletonCard lines={5} />
        <SkeletonCard lines={4} />
      </div>
    );
  }

  const status = MEMO_STATUSES.find((s) => s.value === effectiveStatus) || MEMO_STATUSES[0];

  return (
    <div className="max-w-4xl mx-auto space-y-4 print:max-w-full print:p-0">
      {/* Top bar with back + actions */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          to={`/crm/memos${memo.company_id ? `?companyId=${memo.company_id}` : ""}`}
          className="inline-flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to memos
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} title="Print / save as PDF" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-50">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Print / PDF
          </button>
          {isDraft && (
            <>
              <button onClick={handleDelete} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-rose-600 text-xs font-semibold hover:bg-rose-50">
                Delete draft
              </button>
              <button
                onClick={handleIssue}
                disabled={totals.count === 0}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                Issue memo
              </button>
            </>
          )}
          {isOpen && (
            <button onClick={handleClose} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800">
              Close memo
            </button>
          )}
        </div>
      </div>

      {/* Header card */}
      <div className="bg-white border border-stone-200 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-stone-900">{memo.memo_number}</h1>
              <span className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full border ${status.color}`}>
                {status.label}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <Info label="Store">
                <div className="font-semibold text-stone-900">{memo.company_name}</div>
                {(memo.company_city || memo.company_country) && (
                  <div className="text-xs text-stone-500">{[memo.company_city, memo.company_country].filter(Boolean).join(", ")}</div>
                )}
              </Info>
              {memo.contact_name && (
                <Info label="Contact at store">
                  <div className="font-semibold text-stone-900">{memo.contact_name}</div>
                  {memo.contact_email && <div className="text-xs text-stone-500">{memo.contact_email}</div>}
                  {memo.contact_phone && <div className="text-xs text-stone-500">{memo.contact_phone}</div>}
                </Info>
              )}
              <Info label="Issued">
                {memo.issued_at ? new Date(memo.issued_at).toLocaleDateString() : <span className="italic text-stone-400">Not yet</span>}
              </Info>
              <Info label="Due">
                <span className={expired ? "text-rose-600 font-semibold" : ""}>
                  {memo.due_at ? new Date(memo.due_at).toLocaleDateString() : "—"}
                </span>
              </Info>
            </div>
          </div>
          {!editingHeader && (isDraft || isOpen) && (
            <button
              onClick={() => setEditingHeader(true)}
              className="text-xs text-stone-600 hover:text-stone-900 underline print:hidden"
            >
              Edit details
            </button>
          )}
        </div>

        {editingHeader && (
          <HeaderEditor memo={memo} onCancel={() => setEditingHeader(false)} onSave={handleHeaderSave} />
        )}

        {/* KPIs */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 border-t border-stone-100">
          <Kpi label="Items" value={totals.count} />
          <Kpi label="Out" value={totals.out} accent="text-blue-600" />
          <Kpi label="Sold" value={totals.sold} accent="text-emerald-600" />
          <Kpi label="Total" value={`$${Number(totals.value).toLocaleString()}`} />
        </div>
      </div>

      {/* Notes */}
      {(memo.notes || memo.internal_notes) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {memo.notes && (
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-1">Notes</div>
              <div className="text-sm text-stone-700 whitespace-pre-wrap">{memo.notes}</div>
            </div>
          )}
          {memo.internal_notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 print:hidden">
              <div className="text-[10px] uppercase tracking-wider font-bold text-amber-700 mb-1">Internal notes (not shown to store)</div>
              <div className="text-sm text-amber-900 whitespace-pre-wrap">{memo.internal_notes}</div>
            </div>
          )}
        </div>
      )}

      {/* Items */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
          <h2 className="font-semibold text-stone-900">Items ({totals.count})</h2>
          {isDraft && (
            <button
              onClick={() => setShowPicker(true)}
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
                onPriceChange={(v) => handleItemPrice(it, v)}
                onSetStatus={(s) => handleItemStatus(it, s)}
                onRemove={() => handleRemoveItem(it)}
              />
            ))}
          </div>
        )}
      </div>

      {showPicker && <StonePicker onClose={() => setShowPicker(false)} onSelect={handleAddItems} />}
    </div>
  );
}

function ItemRow({ item, isDraft, isOpen, onPriceChange, onSetStatus, onRemove }) {
  const [price, setPrice] = useState(item.memo_price ?? "");
  useEffect(() => { setPrice(item.memo_price ?? ""); }, [item.memo_price]);
  const snap = item.snapshot || {};
  const status = ITEM_STATUSES.find((s) => s.value === item.status) || ITEM_STATUSES[0];

  return (
    <div className="flex items-center gap-3 p-3 hover:bg-stone-50 transition-colors">
      {snap.imageUrl ? (
        <img src={snap.imageUrl} alt={item.item_sku} className="w-12 h-12 rounded object-cover bg-stone-100 shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded bg-stone-200 shrink-0 flex items-center justify-center text-stone-400 text-[10px] font-bold">
          {item.item_type === "jewelry" ? "JW" : "ST"}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-stone-900 truncate">{item.item_sku}</span>
          <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${status.color}`}>
            {status.label}
          </span>
          {item.status === "sold" && item.sold_at && (
            <span className="text-[10px] text-stone-400">{new Date(item.sold_at).toLocaleDateString()}</span>
          )}
          {item.status === "returned" && item.returned_at && (
            <span className="text-[10px] text-stone-400">{new Date(item.returned_at).toLocaleDateString()}</span>
          )}
        </div>
        <div className="text-xs text-stone-500 truncate mt-0.5">
          {item.item_type === "jewelry"
            ? [snap.jewelryType, snap.metalType, snap.collection].filter(Boolean).join(" · ")
            : [snap.shape, snap.weightCt && `${snap.weightCt}ct`, snap.color, snap.clarity, snap.lab].filter(Boolean).join(" · ")}
        </div>
      </div>
      <div className="text-right shrink-0 flex items-center gap-2">
        {isDraft ? (
          <div className="flex items-center gap-1">
            <span className="text-xs text-stone-500">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onBlur={() => price !== "" && Number(price) !== Number(item.memo_price) && onPriceChange(Number(price))}
              className="w-24 px-2 py-1 text-sm text-right rounded-md border border-stone-200 bg-white focus:outline-none focus:border-stone-400"
            />
            <button onClick={onRemove} title="Remove" className="p-1 rounded hover:bg-rose-50 text-rose-500 print:hidden">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        ) : (
          <>
            <div className="font-semibold text-stone-900">${Number(item.memo_price || 0).toLocaleString()}</div>
            {isOpen && item.status === "out" && (
              <div className="flex gap-1 print:hidden">
                <button
                  onClick={() => onSetStatus("returned")}
                  className="px-2 py-1 rounded-md bg-stone-100 text-stone-700 text-[11px] font-semibold hover:bg-stone-200"
                >
                  Returned
                </button>
                <button
                  onClick={() => onSetStatus("sold")}
                  className="px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-200"
                >
                  Sold
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function HeaderEditor({ memo, onCancel, onSave }) {
  const [dueAt, setDueAt] = useState(memo.due_at ? new Date(memo.due_at).toISOString().slice(0, 10) : "");
  const [notes, setNotes] = useState(memo.notes || "");
  const [internalNotes, setInternalNotes] = useState(memo.internal_notes || "");
  return (
    <div className="mt-4 pt-4 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label className="block">
        <div className="text-xs font-medium text-stone-600 mb-1">Due date</div>
        <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400" />
      </label>
      <label className="block">
        <div className="text-xs font-medium text-stone-600 mb-1">Notes (visible to store)</div>
        <input value={notes} onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400" />
      </label>
      <label className="block sm:col-span-2">
        <div className="text-xs font-medium text-stone-600 mb-1">Internal notes</div>
        <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={2}
          className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400 resize-none" />
      </label>
      <div className="sm:col-span-2 flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-stone-600 hover:bg-stone-100">Cancel</button>
        <button
          onClick={() => onSave({ dueAt: dueAt || null, notes, internalNotes })}
          className="px-3 py-1.5 rounded-lg bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function Info({ label, children }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-stone-500 font-medium mb-0.5">{label}</div>
      {children}
    </div>
  );
}

function Kpi({ label, value, accent }) {
  return (
    <div className="text-center">
      <div className={`text-lg font-bold ${accent || "text-stone-900"}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-stone-500 font-medium">{label}</div>
    </div>
  );
}
