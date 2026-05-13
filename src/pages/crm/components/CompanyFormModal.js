import React, { useState } from "react";
import { COMPANY_TYPES } from "../../../services/companiesApi";

/**
 * Quick-create modal for a new store.
 *
 * Intentionally minimal — captures only what's needed to identify the
 * store. Every other field (full address, social, business hours,
 * memo defaults, description, etc.) is filled in inline on the
 * dedicated StoreProfile page right after creation.
 */
export default function CompanyFormModal({ initial, onClose, onSubmit }) {
  const [data, setData] = useState({
    name:           initial?.name           || "",
    type:           initial?.type           || "retail_store",
    primaryContact: initial?.primary_contact|| "",
    email:          initial?.email          || "",
    phone:          initial?.phone          || "",
    city:           initial?.city           || "",
    country:        initial?.country        || "",
  });
  const [submitting, setSubmitting] = useState(false);

  const update = (k, v) => setData((d) => ({ ...d, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!data.name.trim()) return;
    setSubmitting(true);
    try { await onSubmit(data); }
    finally { setSubmitting(false); }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-stone-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-stone-900">
              {initial ? "Edit store" : "New store"}
            </h3>
            <div className="text-xs text-stone-500 mt-0.5">
              Just the essentials — you can fill in the rest on the store page
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-stone-100">
            <svg className="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-3">
          <Field label="Store name *">
            <input
              autoFocus
              value={data.name}
              onChange={(e) => update("name", e.target.value)}
              className={inputCls}
              placeholder="e.g. Diamonds & Co."
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select value={data.type} onChange={(e) => update("type", e.target.value)} className={inputCls}>
                {COMPANY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Primary contact">
              <input
                value={data.primaryContact}
                onChange={(e) => update("primaryContact", e.target.value)}
                className={inputCls}
                placeholder="Owner / manager"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <input
                type="email"
                value={data.email}
                onChange={(e) => update("email", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Phone">
              <input
                value={data.phone}
                onChange={(e) => update("phone", e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <input
                value={data.city}
                onChange={(e) => update("city", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Country">
              <input
                value={data.country}
                onChange={(e) => update("country", e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="rounded-lg bg-stone-50 border border-stone-200 px-3 py-2 text-[11px] text-stone-600 flex items-start gap-2">
            <svg className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              After creating, you'll land on the store profile where you can add a logo, cover image,
              business hours, social links, memo defaults and more.
            </span>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-stone-200 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-stone-600 hover:bg-stone-100">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !data.name.trim()}
            className="px-4 py-2 rounded-lg bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800 disabled:opacity-50"
          >
            {submitting ? "Creating..." : initial ? "Save" : "Create store"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400";

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-stone-600 mb-1">{label}</div>
      {children}
    </label>
  );
}
