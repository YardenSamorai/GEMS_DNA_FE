import React, { useState } from "react";
import { CONTACT_TYPES } from "../../../services/crmApi";

export default function ContactFormModal({ initial, onClose, onSubmit, title = "New contact" }) {
  const [form, setForm] = useState({
    name: "",
    type: "lead",
    company: "",
    phone: "",
    email: "",
    country: "",
    city: "",
    address: "",
    source: "",
    notes: "",
    ...(initial || {}),
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <h3 className="font-semibold text-stone-900">{title}</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-stone-100">
            <svg className="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 overflow-y-auto">
          <Field label="Name *" required>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} required autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select value={form.type} onChange={(e) => set("type", e.target.value)} className={inputCls}>
                {CONTACT_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
              </select>
            </Field>
            <Field label="Company">
              <input value={form.company} onChange={(e) => set("company", e.target.value)} className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} placeholder="+972…" />
            </Field>
            <Field label="Email">
              <input value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} type="email" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Country">
              <input value={form.country} onChange={(e) => set("country", e.target.value)} className={inputCls} />
            </Field>
            <Field label="City">
              <input value={form.city} onChange={(e) => set("city", e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Address">
            <input value={form.address} onChange={(e) => set("address", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Source">
            <input value={form.source} onChange={(e) => set("source", e.target.value)} className={inputCls} placeholder="Referral, Instagram, Show…" />
          </Field>
          <Field label="Notes">
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} className={`${inputCls} min-h-[80px]`} />
          </Field>
        </div>

        <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 rounded-lg">Cancel</button>
          <button type="submit" disabled={saving || !form.name.trim()} className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-lg disabled:opacity-50 hover:bg-stone-800">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400";

const Field = ({ label, children }) => (
  <label className="block">
    <div className="text-xs font-medium text-stone-600 mb-1">{label}</div>
    {children}
  </label>
);
