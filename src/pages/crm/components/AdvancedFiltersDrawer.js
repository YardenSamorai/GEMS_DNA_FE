import React, { useState, useEffect } from "react";
import { CONTACT_TYPES } from "../../../services/crmApi";

export const EMPTY_FILTERS = {
  country: "",
  city: "",
  company: "",
  type: "all",
  tag: "",
  lastContactDays: "",
  createdSince: "",
  createdUntil: "",
  hasEmail: "",
  hasPhone: "",
  hasWebsite: "",
};

export const countActiveFilters = (f) => {
  if (!f) return 0;
  let n = 0;
  for (const k of Object.keys(EMPTY_FILTERS)) {
    if (k === "type" && f.type && f.type !== "all") n++;
    else if (k !== "type" && f[k]) n++;
  }
  return n;
};

export default function AdvancedFiltersDrawer({ initial, tags = [], onClose, onApply }) {
  const [f, setF] = useState({ ...EMPTY_FILTERS, ...(initial || {}) });

  useEffect(() => {
    setF({ ...EMPTY_FILTERS, ...(initial || {}) });
  }, [initial]);

  const set = (k, v) => setF((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="fixed inset-0 z-[55] flex" onClick={onClose}>
      <div className="hidden sm:block flex-1 bg-stone-900/40 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:w-[420px] shadow-2xl flex flex-col h-full ml-auto"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-semibold text-stone-900">Advanced filters</h3>
            <div className="text-xs text-stone-500 mt-0.5">Narrow down your contact list</div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-stone-100">
            <svg className="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <Section title="Type">
            <div className="flex flex-wrap gap-1.5">
              <Pill active={f.type === "all" || !f.type} onClick={() => set("type", "all")}>All</Pill>
              {CONTACT_TYPES.map((t) => (
                <Pill key={t.value} active={f.type === t.value} onClick={() => set("type", t.value)}>
                  {t.label}
                </Pill>
              ))}
            </div>
          </Section>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Country">
              <input value={f.country} onChange={(e) => set("country", e.target.value)} className={inputCls} placeholder="e.g. India" />
            </Field>
            <Field label="City">
              <input value={f.city} onChange={(e) => set("city", e.target.value)} className={inputCls} placeholder="e.g. Mumbai" />
            </Field>
          </div>

          <Field label="Company contains">
            <input value={f.company} onChange={(e) => set("company", e.target.value)} className={inputCls} placeholder="part of company name" />
          </Field>

          {tags.length > 0 && (
            <Field label="Tag">
              <select value={f.tag} onChange={(e) => set("tag", e.target.value)} className={inputCls}>
                <option value="">— Any tag —</option>
                {tags.map((t) => (
                  <option key={t.tag} value={t.tag}>#{t.tag} ({t.count})</option>
                ))}
              </select>
            </Field>
          )}

          <Section title="Activity">
            <Field label="No contact in (days)">
              <select value={f.lastContactDays} onChange={(e) => set("lastContactDays", e.target.value)} className={inputCls}>
                <option value="">— Any —</option>
                <option value="7">7+ days</option>
                <option value="14">14+ days</option>
                <option value="30">30+ days</option>
                <option value="60">60+ days</option>
                <option value="90">90+ days</option>
                <option value="180">180+ days</option>
              </select>
            </Field>
          </Section>

          <Section title="Created">
            <div className="grid grid-cols-2 gap-3">
              <Field label="From">
                <input type="date" value={f.createdSince} onChange={(e) => set("createdSince", e.target.value)} className={inputCls} />
              </Field>
              <Field label="To">
                <input type="date" value={f.createdUntil} onChange={(e) => set("createdUntil", e.target.value)} className={inputCls} />
              </Field>
            </div>
          </Section>

          <Section title="Has data">
            <div className="grid grid-cols-3 gap-2">
              <TriToggle label="Email" value={f.hasEmail} onChange={(v) => set("hasEmail", v)} />
              <TriToggle label="Phone" value={f.hasPhone} onChange={(v) => set("hasPhone", v)} />
              <TriToggle label="Website" value={f.hasWebsite} onChange={(v) => set("hasWebsite", v)} />
            </div>
          </Section>
        </div>

        <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex justify-between gap-2">
          <button
            onClick={() => { setF({ ...EMPTY_FILTERS }); onApply({ ...EMPTY_FILTERS }); onClose(); }}
            className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-200 rounded-lg"
          >
            Clear all
          </button>
          <button
            onClick={() => { onApply(f); onClose(); }}
            className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800"
          >
            Apply filters
          </button>
        </div>
      </div>
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

const Section = ({ title, children }) => (
  <div>
    <div className="text-[10px] uppercase tracking-wider font-semibold text-stone-500 mb-2">{title}</div>
    {children}
  </div>
);

const Pill = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
      active ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-700 border-stone-200 hover:border-stone-400"
    }`}
  >{children}</button>
);

const TriToggle = ({ label, value, onChange }) => (
  <div className="rounded-lg border border-stone-200 overflow-hidden">
    <div className="text-[11px] font-medium text-stone-600 px-2 pt-1.5">{label}</div>
    <div className="flex">
      {[
        { v: "", l: "Any" },
        { v: "true", l: "Yes" },
        { v: "false", l: "No" },
      ].map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`flex-1 py-1.5 text-[11px] font-medium ${value === o.v ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}
        >
          {o.l}
        </button>
      ))}
    </div>
  </div>
);
