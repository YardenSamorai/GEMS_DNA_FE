import React, { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { createMemo } from "../../../services/memosApi";
import { fetchCompany } from "../../../services/companiesApi";
import StonePicker from "./StonePicker";
import CompanyFormModal from "./CompanyFormModal";
import { createCompany } from "../../../services/companiesApi";

/**
 * Compact memo creation flow.
 *
 * One screen with three sections:
 *   1. Recipient   — pick a store (+ optional contact at that store)
 *   2. Items       — opens StonePicker; each row gets an editable memo price
 *   3. Settings    — due date, notes, internal notes
 *
 * The memo is created in 'draft' state. The detail page is where the
 * user reviews + clicks "Issue" to flip it to 'out'.
 */
export default function MemoWizard({ companies: initialCompanies, preselectCompanyId, onClose, onCreated }) {
  const { user } = useUser();
  const [companies, setCompanies] = useState(initialCompanies || []);
  const [companyId, setCompanyId] = useState(preselectCompanyId || (initialCompanies?.[0]?.id || null));
  const [contacts, setContacts] = useState([]);
  const [contactId, setContactId] = useState(null);
  const [defaultDays, setDefaultDays] = useState(30);
  const [items, setItems] = useState([]); // [{ itemType, itemSku, itemId, snapshot, memoPrice, ... }]
  const [showPicker, setShowPicker] = useState(false);
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [dueAt, setDueAt] = useState(() => {
    const d = new Date(Date.now() + 30 * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  // When the chosen company changes, refresh its contact list and adopt
  // its default-memo-days as the new due date so reps don't have to
  // retype it for stores with non-standard terms.
  useEffect(() => {
    if (!user?.id || !companyId) return;
    (async () => {
      try {
        const data = await fetchCompany(user.id, companyId);
        setContacts(data.contacts || []);
        if (data.default_memo_days) {
          setDefaultDays(data.default_memo_days);
          const d = new Date(Date.now() + data.default_memo_days * 86400 * 1000);
          setDueAt(d.toISOString().slice(0, 10));
        }
      } catch (_) { /* swallow — keep prior values */ }
    })();
  }, [companyId, user?.id]);

  const totalValue = useMemo(
    () => items.reduce((a, i) => a + Number(i.memoPrice || 0), 0),
    [items]
  );

  const handlePicked = (picked) => {
    // StonePicker emits both stones (with `id`, `sku`, etc.) and jewelry
    // (with `sku` = model_number, `category` = 'Jewelry'). We map both
    // shapes onto our memo_items contract and seed memoPrice with the
    // standard 50%-of-Bruto neto pricing the system uses elsewhere.
    const fresh = picked.map((s) => {
      const isJewelry = s.category === "Jewelry";
      const bruto = Number(s.priceTotal || 0);
      return {
        itemType: isJewelry ? "jewelry" : "stone",
        itemSku: s.sku,
        itemId: isJewelry ? null : String(s.id || ""),
        memoPrice: bruto ? Math.round(bruto / 2) : null,
        snapshot: {
          shape: s.shape,
          weightCt: s.weightCt,
          color: s.color,
          clarity: s.clarity,
          lab: s.lab,
          certificateNumber: s.certificateNumber,
          imageUrl: s.imageUrl,
          priceTotal: s.priceTotal,
          pricePerCt: s.pricePerCt,
          title: s.title,
          jewelryType: s.jewelryType,
          metalType: s.metalType,
          stoneType: s.stoneType,
          collection: s.collection,
          style: s.style,
          category: s.category,
        },
      };
    });
    setItems((prev) => {
      const seen = new Set(prev.map((p) => `${p.itemType}:${p.itemSku}`));
      const merged = [...prev];
      for (const f of fresh) {
        const key = `${f.itemType}:${f.itemSku}`;
        if (!seen.has(key)) { merged.push(f); seen.add(key); }
      }
      return merged;
    });
    setShowPicker(false);
  };

  const handleSubmit = async () => {
    if (!companyId) return toast.error("Pick a store first");
    if (!items.length) return toast.error("Add at least one item");
    setSubmitting(true);
    try {
      const memo = await createMemo(user.id, {
        companyId,
        contactId: contactId || undefined,
        dueAt,
        notes: notes || undefined,
        internalNotes: internalNotes || undefined,
        items,
      });
      toast.success(`Memo ${memo.memo_number} created as draft`);
      onCreated?.(memo);
    } catch (e) {
      toast.error(e.message);
    } finally { setSubmitting(false); }
  };

  const handleNewCompany = async (data) => {
    try {
      const created = await createCompany(user.id, data);
      setCompanies((p) => [created, ...p]);
      setCompanyId(created.id);
      setShowNewCompany(false);
      toast.success(`Created store "${created.name}"`);
    } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-stone-900/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white w-full sm:max-w-3xl rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-stone-900">New memo</h3>
              <div className="text-xs text-stone-500 mt-0.5">Send stones / jewelry on consignment</div>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-stone-100">
              <svg className="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Recipient */}
            <Section index={1} title="Recipient">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Store *">
                  <div className="flex gap-2">
                    <select
                      value={companyId || ""}
                      onChange={(e) => { setCompanyId(Number(e.target.value)); setContactId(null); }}
                      className={inputCls}
                    >
                      <option value="">Pick a store...</option>
                      {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewCompany(true)}
                      title="Add a new store"
                      className="px-3 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </button>
                  </div>
                </Field>
                {contacts.length > 0 && (
                  <Field label="Contact at store (optional)">
                    <select
                      value={contactId || ""}
                      onChange={(e) => setContactId(e.target.value ? Number(e.target.value) : null)}
                      className={inputCls}
                    >
                      <option value="">—</option>
                      {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.title ? ` (${c.title})` : ""}</option>)}
                    </select>
                  </Field>
                )}
              </div>
            </Section>

            {/* Items */}
            <Section
              index={2}
              title="Items"
              right={
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  disabled={!companyId}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 disabled:opacity-50"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add items
                </button>
              }
            >
              {items.length === 0 ? (
                <div className="text-center py-6 text-xs text-stone-400 border border-dashed border-stone-200 rounded-lg">
                  {companyId ? "No items yet — click \"Add items\" above" : "Pick a store first"}
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((it, i) => (
                    <ItemRow
                      key={`${it.itemType}:${it.itemSku}`}
                      item={it}
                      onPriceChange={(v) => setItems((p) => p.map((x, idx) => idx === i ? { ...x, memoPrice: v } : x))}
                      onRemove={() => setItems((p) => p.filter((_, idx) => idx !== i))}
                    />
                  ))}
                  <div className="flex items-center justify-between pt-2 border-t border-stone-200 text-sm">
                    <span className="font-semibold text-stone-700">{items.length} item{items.length !== 1 ? "s" : ""}</span>
                    <span className="font-bold text-stone-900">Total: ${totalValue.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </Section>

            {/* Settings */}
            <Section index={3} title="Settings">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Due date">
                  <input
                    type="date"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    className={inputCls}
                  />
                  <div className="text-[10px] text-stone-400 mt-1">
                    Default {defaultDays} days from today
                  </div>
                </Field>
                <Field label="Notes (visible to store)">
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={inputCls}
                    placeholder="e.g. Approval memo for Q2"
                  />
                </Field>
                <Field label="Internal notes (not shown to store)" full>
                  <textarea
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    rows={2}
                    className={`${inputCls} resize-none`}
                  />
                </Field>
              </div>
            </Section>
          </div>

          <div className="px-5 py-3 border-t border-stone-200 flex items-center justify-between gap-2">
            <div className="text-xs text-stone-500">
              Will be saved as <span className="font-semibold">draft</span> — issue it from the memo page
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-stone-600 hover:bg-stone-100">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !companyId || !items.length}
                className="px-4 py-2 rounded-lg bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800 disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create memo"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showPicker && <StonePicker onClose={() => setShowPicker(false)} onSelect={handlePicked} />}
      {showNewCompany && (
        <CompanyFormModal initial={null} onClose={() => setShowNewCompany(false)} onSubmit={handleNewCompany} />
      )}
    </>
  );
}

function ItemRow({ item, onPriceChange, onRemove }) {
  const snap = item.snapshot || {};
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg border border-stone-200 bg-stone-50/50">
      {snap.imageUrl ? (
        <img src={snap.imageUrl} alt={item.itemSku} className="w-10 h-10 rounded object-cover bg-stone-100 shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded bg-stone-200 shrink-0 flex items-center justify-center text-stone-400 text-[10px] font-bold">
          {item.itemType === "jewelry" ? "JW" : "ST"}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-stone-900 truncate">{item.itemSku}</div>
        <div className="text-xs text-stone-500 truncate">
          {item.itemType === "jewelry"
            ? [snap.jewelryType, snap.metalType, snap.collection].filter(Boolean).join(" · ")
            : [snap.shape, snap.weightCt && `${snap.weightCt}ct`, snap.color, snap.clarity, snap.lab].filter(Boolean).join(" · ")}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="flex items-center gap-1">
          <span className="text-xs text-stone-500">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={item.memoPrice ?? ""}
            onChange={(e) => onPriceChange(e.target.value === "" ? null : Number(e.target.value))}
            className="w-24 px-2 py-1 text-sm text-right rounded-md border border-stone-200 bg-white focus:outline-none focus:border-stone-400"
            placeholder="Memo price"
          />
        </div>
        <button onClick={onRemove} className="text-[11px] text-rose-600 hover:underline mt-1">
          Remove
        </button>
      </div>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400";

function Section({ index, title, right, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-stone-900 text-white text-[11px] font-bold flex items-center justify-center">
            {index}
          </span>
          <h4 className="text-sm font-semibold text-stone-900">{title}</h4>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Field({ label, full, children }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <div className="text-xs font-medium text-stone-600 mb-1">{label}</div>
      {children}
    </label>
  );
}
