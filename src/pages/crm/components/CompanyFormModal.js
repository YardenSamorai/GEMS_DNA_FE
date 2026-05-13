import React, { useState } from "react";
import { COMPANY_TYPES, PAYMENT_TERMS } from "../../../services/companiesApi";

/**
 * Create / edit a company (retail store, wholesaler, etc.).
 * Used from CrmCompanies and from the memo wizard's "Quick add store"
 * shortcut so reps don't have to leave the wizard mid-flow.
 */
export default function CompanyFormModal({ initial, onClose, onSubmit }) {
  const [data, setData] = useState({
    name:              initial?.name              || "",
    type:              initial?.type              || "retail_store",
    primaryContact:    initial?.primary_contact   || "",
    email:             initial?.email             || "",
    phone:             initial?.phone             || "",
    website:           initial?.website           || "",
    country:           initial?.country           || "",
    city:              initial?.city              || "",
    address:           initial?.address           || "",
    taxId:             initial?.tax_id            || "",
    notes:             initial?.notes             || "",
    defaultMemoDays:   initial?.default_memo_days || 30,
    paymentTerms:      initial?.payment_terms     || "",
    creditLimit:       initial?.credit_limit      || "",
    logoUrl:           initial?.logo_url          || "",
  });
  const [submitting, setSubmitting] = useState(false);

  const update = (k, v) => setData((d) => ({ ...d, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!data.name.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        ...data,
        defaultMemoDays: Number(data.defaultMemoDays) || 30,
        creditLimit: data.creditLimit !== "" ? Number(data.creditLimit) : null,
      });
    } finally { setSubmitting(false); }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-stone-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-stone-900">
              {initial ? "Edit store" : "New store"}
            </h3>
            <div className="text-xs text-stone-500 mt-0.5">
              Retail stores and wholesale partners that can hold consignment memos
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-stone-100">
            <svg className="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Identity */}
          <Section title="Identity">
            <Field label="Store name *">
              <input
                value={data.name}
                onChange={(e) => update("name", e.target.value)}
                className={inputCls}
                placeholder="Diamonds & Co."
                required
              />
            </Field>
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
                placeholder="Owner / store manager"
              />
            </Field>
            <Field label="Tax ID / VAT">
              <input
                value={data.taxId}
                onChange={(e) => update("taxId", e.target.value)}
                className={inputCls}
              />
            </Field>
          </Section>

          {/* Contact */}
          <Section title="Contact">
            <Field label="Email">
              <input
                type="email"
                value={data.email}
                onChange={(e) => update("email", e.target.value)}
                className={inputCls}
                placeholder="info@store.com"
              />
            </Field>
            <Field label="Phone">
              <input
                value={data.phone}
                onChange={(e) => update("phone", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Website" full>
              <input
                value={data.website}
                onChange={(e) => update("website", e.target.value)}
                className={inputCls}
                placeholder="https://"
              />
            </Field>
          </Section>

          {/* Location */}
          <Section title="Location">
            <Field label="Country">
              <input
                value={data.country}
                onChange={(e) => update("country", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="City">
              <input
                value={data.city}
                onChange={(e) => update("city", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Address" full>
              <input
                value={data.address}
                onChange={(e) => update("address", e.target.value)}
                className={inputCls}
              />
            </Field>
          </Section>

          {/* Memo defaults */}
          <Section title="Memo defaults" hint="Used as the starting values when issuing a new memo to this store">
            <Field label="Default memo length (days)">
              <input
                type="number"
                min="1"
                max="365"
                value={data.defaultMemoDays}
                onChange={(e) => update("defaultMemoDays", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Payment terms">
              <select value={data.paymentTerms} onChange={(e) => update("paymentTerms", e.target.value)} className={inputCls}>
                <option value="">—</option>
                {PAYMENT_TERMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Credit limit (USD)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={data.creditLimit}
                onChange={(e) => update("creditLimit", e.target.value)}
                className={inputCls}
                placeholder="No limit"
              />
            </Field>
            <Field label="Logo URL">
              <input
                value={data.logoUrl}
                onChange={(e) => update("logoUrl", e.target.value)}
                className={inputCls}
                placeholder="https://..."
              />
            </Field>
          </Section>

          {/* Notes */}
          <Section title="Notes">
            <Field label="Internal notes" full>
              <textarea
                value={data.notes}
                onChange={(e) => update("notes", e.target.value)}
                rows={3}
                className={`${inputCls} resize-none`}
                placeholder="Anything the team should know about this store..."
              />
            </Field>
          </Section>
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
            {submitting ? "Saving..." : initial ? "Save changes" : "Create store"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400";

function Section({ title, hint, children }) {
  return (
    <div>
      <div className="mb-2">
        <h4 className="text-[11px] uppercase tracking-wider font-bold text-stone-500">{title}</h4>
        {hint && <div className="text-[11px] text-stone-400 mt-0.5">{hint}</div>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
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
