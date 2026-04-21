import React, { useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { CONTACT_TYPES, fetchFolders } from "../../../services/crmApi";
import { polishContact } from "../utils/smartCase";
import { useGeoSuggestion } from "../../../utils/geoDetect";
import GeoSuggestion from "../../../components/GeoSuggestion";

export default function ContactFormModal({ initial, onClose, onSubmit, title = "New contact" }) {
  const { user } = useUser();
  const [form, setForm] = useState({
    name: "",
    type: "lead",
    title: "",
    company: "",
    phone: "",
    phoneAlt: "",
    email: "",
    website: "",
    country: "",
    city: "",
    address: "",
    source: "",
    notes: "",
    folderId: null,
    ...(initial ? snakeToCamel(initial) : {}),
  });
  const [saving, setSaving] = useState(false);
  const [folders, setFolders] = useState([]);

  useEffect(() => {
    if (!user?.id) return;
    fetchFolders(user.id).then(setFolders).catch(() => {});
  }, [user?.id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Live country/city detection from phone, address, email
  const { suggestion: geo, dismiss: dismissGeo } = useGeoSuggestion({
    phone: form.phone,
    city: form.city,
    address: form.address,
    country: form.country,
    email: form.email,
  });
  const applyGeo = (s) => {
    setForm((f) => ({
      ...f,
      country: f.country || s.country || "",
      city: f.city || s.city || "",
      // If the backend was able to upgrade a bare local-format phone
      // number into international format using the inferred country, take
      // the upgrade. We only swap when we have a valid international
      // representation — otherwise we leave whatever the user typed alone.
      phone: s.formattedPhone?.international || f.phone,
    }));
    dismissGeo();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      // Apply smart-case to name/title/company/etc. Leave email/phone/website to their own normalization.
      const payload = polishContact({ ...form });
      await onSubmit(payload);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-stone-900/50 backdrop-blur-sm" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg shadow-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col"
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
            <Field label="Title">
              <input value={form.title || ""} onChange={(e) => set("title", e.target.value)} className={inputCls} placeholder="CEO, Designer..." />
            </Field>
            <Field label="Type">
              <select value={form.type} onChange={(e) => set("type", e.target.value)} className={inputCls}>
                {CONTACT_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
              </select>
            </Field>
          </div>

          <Field label="Company">
            <input value={form.company || ""} onChange={(e) => set("company", e.target.value)} className={inputCls} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} className={inputCls} placeholder="+972..." />
            </Field>
            <Field label="Alt phone">
              <input value={form.phoneAlt || ""} onChange={(e) => set("phoneAlt", e.target.value)} className={inputCls} placeholder="Office..." />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <input value={form.email || ""} onChange={(e) => set("email", e.target.value)} className={inputCls} type="email" />
            </Field>
            <Field label="Website">
              <input value={form.website || ""} onChange={(e) => set("website", e.target.value)} className={inputCls} placeholder="example.com" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Country">
              <input value={form.country || ""} onChange={(e) => set("country", e.target.value)} className={inputCls} />
            </Field>
            <Field label="City">
              <input value={form.city || ""} onChange={(e) => set("city", e.target.value)} className={inputCls} />
            </Field>
          </div>

          <GeoSuggestion suggestion={geo} onApply={applyGeo} onDismiss={dismissGeo} />

          <Field label="Address">
            <input value={form.address || ""} onChange={(e) => set("address", e.target.value)} className={inputCls} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Source">
              <input value={form.source || ""} onChange={(e) => set("source", e.target.value)} className={inputCls} placeholder="Referral, Show..." />
            </Field>
            <Field label="Folder">
              <select value={form.folderId || ""} onChange={(e) => set("folderId", e.target.value ? Number(e.target.value) : null)} className={inputCls}>
                <option value="">— None —</option>
                {buildFolderOptions(folders).map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Notes">
            <textarea value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} className={`${inputCls} min-h-[80px]`} />
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

// Convert snake_case fields from API to camelCase for the form
function snakeToCamel(obj) {
  const out = {};
  for (const k of Object.keys(obj || {})) {
    const ck = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[ck] = obj[k];
  }
  return out;
}

// Build hierarchical folder options with indentation
function buildFolderOptions(folders) {
  const byParent = new Map();
  for (const f of folders) {
    const key = f.parent_id || 0;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(f);
  }
  const out = [];
  const walk = (parentId, depth) => {
    const list = byParent.get(parentId) || [];
    for (const f of list) {
      out.push({ id: f.id, label: `${"\u00a0\u00a0".repeat(depth)}${f.name}` });
      walk(f.id, depth + 1);
    }
  };
  walk(0, 0);
  return out;
}
