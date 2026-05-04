import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import {
  fetchContact,
  updateContact,
  deleteContact,
  fetchDeals,
  fetchInvoices,
  fetchOccasions,
  createOccasion,
  deleteOccasion,
  fetchInteractions,
  createInteraction,
  deleteInteraction,
  fetchTasks,
  CONTACT_TYPES,
  DEAL_STAGES,
  INVOICE_STATUSES,
  OCCASION_KINDS,
} from "../../services/crmApi";
import { fetchJewelryItems } from "../../services/jewelryApi";
import NewJewelryItemModal from "../jewelry/components/NewJewelryItemModal";

/* ---------------- Helpers ---------------- */

const fmtMoney = (n, currency = "USD") => {
  const sign = currency === "USD" ? "$" : "";
  return `${sign}${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

const fmtRelative = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return `about ${h} hour${h === 1 ? "" : "s"} ago`;
  }
  if (diff < 86400 * 30) {
    const dd = Math.floor(diff / 86400);
    return `${dd} day${dd === 1 ? "" : "s"} ago`;
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
};

/* ---------------- Icons ---------------- */
// Tiny, thin-stroke icons matching the rest of the app.
const Icon = ({ d, className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const ChevronLeft = (p) => <Icon {...p} d="M15 19l-7-7 7-7" />;
const Pencil       = (p) => <Icon {...p} d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.4-9.4a2 2 0 1 1 2.8 2.8L11.8 15.8 8 17l1.2-3.8 9.4-9.4z" />;
const Plus         = (p) => <Icon {...p} d="M12 5v14m7-7H5" />;
const Phone        = (p) => <Icon {...p} d="M3 5a2 2 0 0 1 2-2h2.3a1 1 0 0 1 1 .8l1 4a1 1 0 0 1-.3 1l-2 2a16 16 0 0 0 6 6l2-2a1 1 0 0 1 1-.3l4 1a1 1 0 0 1 .8 1V19a2 2 0 0 1-2 2A18 18 0 0 1 3 5z" />;
const Mail         = (p) => <Icon {...p} d="M3 8l9 6 9-6m-18 0v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8m-18 0a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2" />;
const Trash        = (p) => <Icon {...p} d="M19 7l-1 12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 7m5 4v6m4-6v6M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3M4 7h16" />;
const Cart         = (p) => <Icon {...p} d="M3 3h2l1 13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2l1-9H6m4 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm10 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />;
const Dollar       = (p) => <Icon {...p} d="M12 4v16m4-12a3 3 0 0 0-3-3h-2a3 3 0 0 0 0 6h2a3 3 0 0 1 0 6h-2a3 3 0 0 1-3-3" />;
const FileDoc      = (p) => <Icon {...p} d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6zM14 3v6h6M9 14h6m-6 3h4" />;
const Gear         = (p) => <Icon {...p} d="M10.3 3.5h3.4l.5 2.4 2 1.2 2.4-.5L20.3 9l-1.6 1.9.4 2.3-1.6 1 .5 2.3-3 1.4-1.7-1.7-2.3.4-1.4 1.6-2.7-1.4.4-2.3-1.6-1.6.4-2.3L4 11l1.5-3 2.4.5 2-1.2.4-2.3z M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />;
const Clock        = (p) => <Icon {...p} d="M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />;
const Calendar     = (p) => <Icon {...p} d="M8 3v3m8-3v3M3 8h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />;
const Note         = (p) => <Icon {...p} d="M8 5h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8m0 0l3-3h0v3H5z M9 12h7m-7 3h5" />;
const X            = (p) => <Icon {...p} d="M6 6l12 12M6 18L18 6" />;
const Tag          = (p) => <Icon {...p} d="M7 7h.01M11 3l9 9-8 8-9-9V3h8z" />;
const User         = (p) => <Icon {...p} d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4 0-8 2-8 6v1h16v-1c0-4-4-6-8-6z" />;
const MapPin       = (p) => <Icon {...p} d="M12 21s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />;
const Sparkle      = (p) => <Icon {...p} d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6l2.1-2.1" />;

/* ---------------- Small UI atoms ---------------- */

const ActionBtn = ({ icon, label, onClick, accent = "stone", href, disabled }) => {
  const accentMap = {
    stone:   "border-stone-200 text-stone-600 hover:bg-stone-50 hover:text-stone-900",
    rose:    "border-rose-200 text-rose-600 hover:bg-rose-50",
    emerald: "border-emerald-200 text-emerald-600 hover:bg-emerald-50",
  };
  const cls = `inline-flex items-center justify-center w-9 h-9 rounded-lg border bg-white transition-colors disabled:opacity-40 ${accentMap[accent] || accentMap.stone}`;
  if (href) {
    return (
      <a href={href} title={label} className={cls}>
        {icon}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} className={cls}>
      {icon}
    </button>
  );
};

const KpiCard = ({ label, value, icon, accent = "emerald" }) => {
  const accentMap = {
    sky:     { bg: "bg-sky-50",     icon: "text-sky-600" },
    emerald: { bg: "bg-emerald-50", icon: "text-emerald-600" },
    amber:   { bg: "bg-amber-50",   icon: "text-amber-600" },
    violet:  { bg: "bg-violet-50",  icon: "text-violet-600" },
  };
  const a = accentMap[accent] || accentMap.emerald;
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3.5">
      <div className="flex items-center gap-3">
        <div className={`shrink-0 w-9 h-9 rounded-lg ${a.bg} flex items-center justify-center ${a.icon}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">{label}</div>
          <div className="text-xl font-bold text-stone-900 leading-tight mt-0.5 truncate">{value}</div>
        </div>
      </div>
    </div>
  );
};

const TabPill = ({ active, onClick, label, icon, count }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
      active ? "border-emerald-500 text-stone-900" : "border-transparent text-stone-500 hover:text-stone-900"
    }`}
  >
    {icon}
    <span>{label}</span>
    {count != null && count > 0 && (
      <span className={`text-[11px] rounded-full px-1.5 py-0.5 ${active ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-600"}`}>
        {count}
      </span>
    )}
  </button>
);

const SectionCard = ({ title, action, children, padded = true }) => (
  <div className="rounded-xl border border-stone-200 bg-white">
    {(title || action) && (
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
        {title && <h3 className="text-sm font-semibold text-stone-900">{title}</h3>}
        {action}
      </div>
    )}
    <div className={padded ? "p-4" : ""}>{children}</div>
  </div>
);

const Empty = ({ icon, label, action }) => (
  <div className="text-center py-10 text-stone-400">
    <div className="inline-flex w-10 h-10 rounded-full bg-stone-100 items-center justify-center text-stone-400 mb-2">
      {icon}
    </div>
    <div className="text-sm">{label}</div>
    {action && <div className="mt-3">{action}</div>}
  </div>
);

/* ---------------- Tab content ---------------- */

const ActivityTab = ({ items, filter, setFilter, counts }) => {
  const filters = [
    { value: "all",        label: "All",        count: counts.all },
    { value: "order",      label: "Order",      count: counts.order },
    { value: "invoice",    label: "Invoice",    count: counts.invoice },
    { value: "job",        label: "Job",        count: counts.job },
    { value: "production", label: "Production", count: counts.production },
    { value: "task",       label: "Task",       count: counts.task },
    { value: "note",       label: "Note",       count: counts.note },
  ];
  return (
    <SectionCard
      title="Activity Timeline"
      padded={false}
      action={
        <div className="flex gap-1 overflow-x-auto -mr-1">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors whitespace-nowrap ${
                filter === f.value
                  ? "bg-emerald-600 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      }
    >
      {items.length === 0 ? (
        <Empty icon={<Clock />} label="No activity yet" />
      ) : (
        <ul className="divide-y divide-stone-100">
          {items.map((it) => (
            <li key={it.id} className="flex items-start gap-3 px-4 py-3 hover:bg-stone-50/60">
              <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${it.color}`}>
                {it.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-stone-900 truncate">{it.title}</div>
                {it.subtitle && (
                  <div className="text-xs text-stone-500 truncate mt-0.5">{it.subtitle}</div>
                )}
                <div className="text-[11px] text-stone-400 mt-0.5">
                  {fmtRelative(it.date)}
                  {it.date && (
                    <span className="ml-2">· {fmtDate(it.date)}</span>
                  )}
                </div>
              </div>
              {it.amount != null && Number(it.amount) > 0 && (
                <div className="shrink-0 text-sm font-semibold text-stone-900">
                  {fmtMoney(it.amount)}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
};

const OrdersTab = ({ deals, navigate, contactId }) => (
  <SectionCard
    title="Orders"
    padded={false}
    action={
      <button
        type="button"
        onClick={() => navigate(`/crm/deals?new=1&contactId=${contactId}`)}
        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
      >
        <Plus className="w-3.5 h-3.5" /> New order
      </button>
    }
  >
    {deals.length === 0 ? (
      <Empty
        icon={<Cart />}
        label="No orders yet"
        action={
          <button
            type="button"
            onClick={() => navigate(`/crm/deals?new=1&contactId=${contactId}`)}
            className="text-xs font-medium text-emerald-600 hover:underline"
          >
            Create the first order →
          </button>
        }
      />
    ) : (
      <ul className="divide-y divide-stone-100">
        {deals.map((d) => {
          const stage = DEAL_STAGES.find((s) => s.value === d.stage);
          return (
            <li key={d.id} className="px-4 py-3 hover:bg-stone-50/60 cursor-pointer" onClick={() => navigate(`/crm/deals?focus=${d.id}`)}>
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-9 h-9 rounded-full bg-sky-50 flex items-center justify-center text-sky-600">
                  <Cart />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-stone-900 truncate">{d.title}</div>
                  <div className="text-xs text-stone-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    {stage && (
                      <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ${stage.color}`}>{stage.label}</span>
                    )}
                    <span>{fmtRelative(d.created_at)}</span>
                    <span>· {fmtDate(d.created_at)}</span>
                  </div>
                </div>
                <div className="shrink-0 text-sm font-semibold text-stone-900">{fmtMoney(d.value)}</div>
              </div>
            </li>
          );
        })}
      </ul>
    )}
  </SectionCard>
);

const CallsTab = ({ calls, onAdd, onDelete }) => (
  <SectionCard
    title="Call History"
    padded={false}
    action={
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
      >
        <Plus className="w-3.5 h-3.5" /> Log call
      </button>
    }
  >
    {calls.length === 0 ? (
      <Empty icon={<Phone />} label="No call history yet" action={
        <button type="button" onClick={onAdd} className="text-xs font-medium text-emerald-600 hover:underline">
          Log your first call →
        </button>
      } />
    ) : (
      <ul className="divide-y divide-stone-100">
        {calls.map((c) => (
          <li key={c.id} className="px-4 py-3 flex items-start gap-3 hover:bg-stone-50/60">
            <div className="shrink-0 w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Phone />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-stone-900">
                {c.subject || (c.direction === "incoming" ? "Inbound call" : "Outbound call")}
              </div>
              {c.content && (
                <div className="text-xs text-stone-600 mt-0.5 whitespace-pre-wrap">{c.content}</div>
              )}
              <div className="text-[11px] text-stone-400 mt-1">
                {fmtRelative(c.occurred_at)} · {fmtDate(c.occurred_at)}
                {c.metadata?.duration && <span> · {c.metadata.duration} min</span>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onDelete(c.id)}
              className="shrink-0 text-stone-400 hover:text-rose-600 p-1"
              title="Delete"
            >
              <Trash className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>
    )}
  </SectionCard>
);

const OccasionsTab = ({ occasions, onAdd, onDelete }) => {
  const sorted = [...occasions].sort((a, b) => {
    const dateA = new Date(a.occurs_on);
    const dateB = new Date(b.occurs_on);
    return dateA.getMonth() * 32 + dateA.getDate() - (dateB.getMonth() * 32 + dateB.getDate());
  });
  return (
    <SectionCard
      title="Occasions"
      padded={false}
      action={
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
        >
          <Plus className="w-3.5 h-3.5" /> Add occasion
        </button>
      }
    >
      {sorted.length === 0 ? (
        <Empty icon={<Calendar />} label="No occasions tracked" action={
          <button type="button" onClick={onAdd} className="text-xs font-medium text-emerald-600 hover:underline">
            Add a birthday or anniversary →
          </button>
        } />
      ) : (
        <ul className="divide-y divide-stone-100">
          {sorted.map((o) => {
            const meta = OCCASION_KINDS.find((k) => k.value === o.kind) || { label: o.kind, emoji: "📅" };
            return (
              <li key={o.id} className="px-4 py-3 flex items-start gap-3 hover:bg-stone-50/60">
                <div className="shrink-0 w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center text-base">
                  {meta.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-stone-900">
                    {o.label || meta.label}
                    {o.recurring_yearly && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-emerald-600 font-semibold">Yearly</span>
                    )}
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5">
                    {fmtDate(o.occurs_on)}
                  </div>
                  {o.notes && (
                    <div className="text-xs text-stone-600 mt-0.5 whitespace-pre-wrap">{o.notes}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(o.id)}
                  className="shrink-0 text-stone-400 hover:text-rose-600 p-1"
                  title="Delete"
                >
                  <Trash className="w-4 h-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
};

const NotesTab = ({ contact, notes, onSaveNotes }) => {
  const [draft, setDraft] = useState(contact.notes || "");
  const [saving, setSaving] = useState(false);
  const dirty = draft !== (contact.notes || "");
  const save = async () => {
    setSaving(true);
    try { await onSaveNotes(draft); } finally { setSaving(false); }
  };
  return (
    <div className="space-y-4">
      <SectionCard title="Customer Notes" action={
        dirty ? (
          <button type="button" onClick={save} disabled={saving}
            className="px-3 py-1 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        ) : null
      }>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          placeholder="Add notes about this customer — preferences, sizes, family details, anything you want to remember…"
          className="w-full text-sm text-stone-800 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:border-emerald-400"
        />
      </SectionCard>
      {notes.length > 0 && (
        <SectionCard title="Pinned Notes" padded={false}>
          <ul className="divide-y divide-stone-100">
            {notes.map((n) => (
              <li key={n.id} className="px-4 py-3">
                <div className="text-sm text-stone-800 whitespace-pre-wrap">{n.content}</div>
                <div className="text-[11px] text-stone-400 mt-1">{fmtRelative(n.occurred_at)} · {fmtDate(n.occurred_at)}</div>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
};

/* ---------------- Sidebar cards ---------------- */

/* Phase D — Preferences editor.
 * Stored in crm_contacts.preferences (JSONB). The shape is:
 *   {
 *     categories: ["Ring","Necklace",…],
 *     metals: ["Yellow Gold","Platinum",…],
 *     stoneTypes: ["Diamond","Emerald",…],
 *     budgetMin: number, budgetMax: number,
 *     notifyReady: bool, notifyOccasions: bool
 *   }
 * Used for: filtering inventory suggestions, controlling notification opt-in,
 * and informing the salesperson about taste at a glance.
 */
const CATEGORY_OPTIONS = ["Ring", "Necklace", "Earrings", "Bracelet", "Pendant", "Brooch", "Cufflinks"];
const METAL_OPTIONS    = ["Yellow Gold", "White Gold", "Rose Gold", "Platinum", "Silver"];
const STONE_OPTIONS    = ["Diamond", "Emerald", "Ruby", "Sapphire", "Pearl", "Opal", "Other"];

const PreferencesCard = ({ contact, onUpdate }) => {
  const initial = contact.preferences && typeof contact.preferences === "object" ? contact.preferences : {};
  const [prefs, setPrefs] = useState({
    categories: Array.isArray(initial.categories) ? initial.categories : [],
    metals:     Array.isArray(initial.metals)     ? initial.metals     : [],
    stoneTypes: Array.isArray(initial.stoneTypes) ? initial.stoneTypes : [],
    budgetMin:  initial.budgetMin ?? "",
    budgetMax:  initial.budgetMax ?? "",
    notifyReady:     initial.notifyReady !== false,
    notifyOccasions: initial.notifyOccasions !== false,
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const togglePill = (field, value) => {
    setPrefs((p) => {
      const has = (p[field] || []).includes(value);
      return {
        ...p,
        [field]: has ? p[field].filter((v) => v !== value) : [...(p[field] || []), value],
      };
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...prefs,
        budgetMin: prefs.budgetMin === "" ? null : Number(prefs.budgetMin),
        budgetMax: prefs.budgetMax === "" ? null : Number(prefs.budgetMax),
      };
      await updateContact(contact.id, { preferences: payload });
      toast.success("Preferences saved");
      setDirty(false);
      onUpdate?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      title={
        <div className="flex w-full items-center justify-between">
          <span className="inline-flex items-center gap-2">
            <Sparkle className="w-4 h-4 text-violet-600" /> Preferences
          </span>
          {dirty && (
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-md bg-violet-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        <PrefGroup label="Likes">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_OPTIONS.map((c) => (
              <PrefPill
                key={c}
                active={prefs.categories.includes(c)}
                onClick={() => togglePill("categories", c)}
                tone="violet"
              >
                {c}
              </PrefPill>
            ))}
          </div>
        </PrefGroup>

        <PrefGroup label="Metals">
          <div className="flex flex-wrap gap-1.5">
            {METAL_OPTIONS.map((m) => (
              <PrefPill
                key={m}
                active={prefs.metals.includes(m)}
                onClick={() => togglePill("metals", m)}
                tone="amber"
              >
                {m}
              </PrefPill>
            ))}
          </div>
        </PrefGroup>

        <PrefGroup label="Stone types">
          <div className="flex flex-wrap gap-1.5">
            {STONE_OPTIONS.map((s) => (
              <PrefPill
                key={s}
                active={prefs.stoneTypes.includes(s)}
                onClick={() => togglePill("stoneTypes", s)}
                tone="emerald"
              >
                {s}
              </PrefPill>
            ))}
          </div>
        </PrefGroup>

        <PrefGroup label="Budget range (USD)">
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Min"
              value={prefs.budgetMin}
              onChange={(e) => { setPrefs({ ...prefs, budgetMin: e.target.value }); setDirty(true); }}
              className="w-24 rounded-md border border-stone-300 px-2 py-1 text-xs focus:border-violet-400 focus:outline-none"
            />
            <span className="text-stone-400">—</span>
            <input
              type="number"
              placeholder="Max"
              value={prefs.budgetMax}
              onChange={(e) => { setPrefs({ ...prefs, budgetMax: e.target.value }); setDirty(true); }}
              className="w-24 rounded-md border border-stone-300 px-2 py-1 text-xs focus:border-violet-400 focus:outline-none"
            />
          </div>
        </PrefGroup>

        <PrefGroup label="Notifications">
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.notifyReady}
                onChange={(e) => { setPrefs({ ...prefs, notifyReady: e.target.checked }); setDirty(true); }}
                className="h-3.5 w-3.5 rounded border-stone-300 text-violet-600 focus:ring-violet-500"
              />
              Notify when their piece is ready
            </label>
            <label className="flex items-center gap-2 text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.notifyOccasions}
                onChange={(e) => { setPrefs({ ...prefs, notifyOccasions: e.target.checked }); setDirty(true); }}
                className="h-3.5 w-3.5 rounded border-stone-300 text-violet-600 focus:ring-violet-500"
              />
              Remind me of their occasions
            </label>
          </div>
        </PrefGroup>
      </div>
    </SectionCard>
  );
};

const PrefGroup = ({ label, children }) => (
  <div>
    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-stone-500">{label}</div>
    {children}
  </div>
);

const PrefPill = ({ active, onClick, children, tone = "violet" }) => {
  const tones = {
    violet:  active ? "bg-violet-600 text-white border-violet-600"   : "bg-white text-stone-600 border-stone-300 hover:border-violet-400",
    amber:   active ? "bg-amber-500 text-white border-amber-500"     : "bg-white text-stone-600 border-stone-300 hover:border-amber-400",
    emerald: active ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-stone-600 border-stone-300 hover:border-emerald-400",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${tones[tone] || tones.violet}`}
    >
      {children}
    </button>
  );
};

const TagsCard = ({ contact, onUpdate }) => {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const tags = Array.isArray(contact.tags) ? contact.tags : [];
  const addTag = async (e) => {
    e?.preventDefault();
    const tag = draft.trim();
    if (!tag) return;
    if (tags.includes(tag)) { setDraft(""); setAdding(false); return; }
    setSaving(true);
    try {
      await updateContact(contact.id, { tags: [...tags, tag] });
      setDraft("");
      setAdding(false);
      onUpdate?.();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };
  const removeTag = async (tag) => {
    setSaving(true);
    try {
      await updateContact(contact.id, { tags: tags.filter((t) => t !== tag) });
      onUpdate?.();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };
  return (
    <SectionCard title={
      <span className="inline-flex items-center gap-2"><Tag className="w-4 h-4 text-emerald-600" /> Tags</span>
    }>
      {tags.length === 0 && !adding && (
        <div className="text-xs text-stone-400 mb-2">No tags yet</div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs border border-emerald-200">
            {t}
            <button type="button" onClick={() => removeTag(t)} disabled={saving}
              className="text-emerald-500 hover:text-rose-600 ml-0.5">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {adding ? (
          <form onSubmit={addTag} className="inline-flex">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => { if (!draft.trim()) setAdding(false); }}
              placeholder="Tag name"
              className="px-2 py-1 text-xs rounded-full border border-stone-300 focus:outline-none focus:border-emerald-400 w-24"
            />
          </form>
        ) : (
          <button type="button" onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-dashed border-stone-300 text-xs text-stone-500 hover:text-emerald-600 hover:border-emerald-400">
            <Plus className="w-3 h-3" /> Add Tag
          </button>
        )}
      </div>
    </SectionCard>
  );
};

const DetailsCard = ({ contact }) => {
  const location = [contact.city, contact.country].filter(Boolean).join(", ");
  return (
    <SectionCard title={
      <span className="inline-flex items-center gap-2"><User className="w-4 h-4 text-sky-600" /> Details</span>
    }>
      <dl className="space-y-2.5 text-sm">
        {location && (
          <div className="flex items-start gap-2 text-stone-700">
            <MapPin className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
            <span>{location}</span>
          </div>
        )}
        {contact.address && (
          <div className="text-stone-600 text-xs pl-6">{contact.address}</div>
        )}
        {contact.source && (
          <div className="flex items-start gap-2 text-stone-700">
            <User className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
            <span>Source: {contact.source}</span>
          </div>
        )}
        {contact.website && (
          <div className="flex items-start gap-2 text-stone-700">
            <FileDoc className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
            <a href={contact.website} target="_blank" rel="noreferrer" className="hover:text-emerald-600 truncate">{contact.website}</a>
          </div>
        )}
      </dl>
      <div className="mt-3 pt-3 border-t border-stone-100 text-[11px] text-stone-400 flex items-center justify-between">
        <span>Created {fmtDate(contact.created_at)}</span>
        <span>Updated {fmtDate(contact.updated_at)}</span>
      </div>
    </SectionCard>
  );
};

/* ---------------- Modals ---------------- */

const ModalShell = ({ title, onClose, children, footer }) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/50 backdrop-blur-sm" onClick={onClose}>
    <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl">
      <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
        <h3 className="font-semibold text-stone-900">{title}</h3>
        <button type="button" onClick={onClose} className="p-1 rounded hover:bg-stone-100"><X className="w-5 h-5 text-stone-500" /></button>
      </div>
      <div className="p-5 space-y-3">{children}</div>
      {footer && <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex justify-end gap-2">{footer}</div>}
    </div>
  </div>
);

const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-emerald-400";
const fieldLabel = "block text-xs font-medium text-stone-600 mb-1";

const AddOccasionModal = ({ onClose, onSubmit }) => {
  const [kind, setKind] = useState("birthday");
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  const [recurring, setRecurring] = useState(true);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!date) return;
    setSaving(true);
    try {
      await onSubmit({ kind, label: label.trim() || null, occursOn: date, recurringYearly: recurring, notes: notes.trim() || null });
    } finally { setSaving(false); }
  };
  return (
    <form onSubmit={submit}>
      <ModalShell
        title="Add occasion"
        onClose={onClose}
        footer={
          <>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving || !date} className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
          </>
        }
      >
        <div>
          <label className={fieldLabel}>Type</label>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>
            {OCCASION_KINDS.map((k) => (<option key={k.value} value={k.value}>{k.emoji} {k.label}</option>))}
          </select>
        </div>
        <div>
          <label className={fieldLabel}>Label (optional)</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Daughter's birthday" className={inputCls} />
        </div>
        <div>
          <label className={fieldLabel}>Date *</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-400" />
          Recurs yearly
        </label>
        <div>
          <label className={fieldLabel}>Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
        </div>
      </ModalShell>
    </form>
  );
};

const LogCallModal = ({ onClose, onSubmit }) => {
  const [subject, setSubject] = useState("");
  const [direction, setDirection] = useState("outgoing");
  const [content, setContent] = useState("");
  const [duration, setDuration] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        direction,
        subject: subject.trim() || null,
        content: content.trim() || null,
        metadata: duration ? { duration: Number(duration) } : {},
      });
    } finally { setSaving(false); }
  };
  return (
    <form onSubmit={submit}>
      <ModalShell
        title="Log a call"
        onClose={onClose}
        footer={
          <>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={fieldLabel}>Direction</label>
            <select value={direction} onChange={(e) => setDirection(e.target.value)} className={inputCls}>
              <option value="outgoing">Outbound</option>
              <option value="incoming">Inbound</option>
            </select>
          </div>
          <div>
            <label className={fieldLabel}>Duration (min)</label>
            <input type="number" min="0" value={duration} onChange={(e) => setDuration(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={fieldLabel}>Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Discussed engagement ring options" className={inputCls} />
        </div>
        <div>
          <label className={fieldLabel}>Notes</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} placeholder="What was discussed, next steps…" className={inputCls} />
        </div>
      </ModalShell>
    </form>
  );
};

/* ---------------- Main page ---------------- */

export default function CustomerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const userId = user?.id;

  const [contact, setContact]           = useState(null);
  const [deals, setDeals]               = useState([]);
  const [invoices, setInvoices]         = useState([]);
  const [occasions, setOccasions]       = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [jewelryItems, setJewelryItems] = useState([]);
  const [tasks, setTasks]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState("activity");
  const [activityFilter, setActivityFilter] = useState("all");
  const [showAddOccasion, setShowAddOccasion] = useState(false);
  const [showLogCall, setShowLogCall]         = useState(false);
  const [showStartJob, setShowStartJob]       = useState(false);

  const reloadContact = () => {
    if (!userId || !id) return;
    fetchContact(userId, id).then(setContact).catch((e) => toast.error(e.message));
  };

  useEffect(() => {
    if (!userId || !id) return;
    setLoading(true);
    Promise.all([
      fetchContact(userId, id).catch(() => null),
      fetchDeals(userId, { contactId: id }).catch(() => []),
      fetchInvoices(userId, { contactId: id }).catch(() => []),
      fetchOccasions(userId, { contactId: id }).catch(() => []),
      fetchInteractions(userId, { contactId: id }).catch(() => []),
      fetchJewelryItems(userId, { contactId: id }).catch(() => []),
      fetchTasks(userId, { contactId: id }).catch(() => []),
    ])
      .then(([c, d, inv, occ, intr, jw, tk]) => {
        setContact(c);
        setDeals(d || []);
        setInvoices(inv || []);
        setOccasions(occ || []);
        setInteractions(intr || []);
        setJewelryItems(jw || []);
        setTasks(tk || []);
      })
      .finally(() => setLoading(false));
  }, [userId, id]);

  const kpis = useMemo(() => {
    const revenue = deals
      .filter((d) => d.stage === "won")
      .reduce((sum, d) => sum + Number(d.value || 0), 0);
    return {
      orders: deals.length,
      revenue,
      invoices: invoices.length,
      jobs: jewelryItems.length,
    };
  }, [deals, invoices, jewelryItems]);

  const calls = useMemo(() => interactions.filter((i) => i.type === "call"), [interactions]);
  const noteInteractions = useMemo(() => interactions.filter((i) => i.type === "note"), [interactions]);

  const activity = useMemo(() => {
    // Fold every event into a single chronological feed.
    const items = [];
    deals.forEach((d) => {
      const stage = DEAL_STAGES.find((s) => s.value === d.stage);
      items.push({
        kind: "order",
        id: `deal-${d.id}`,
        title: `Order ${d.title}`,
        subtitle: `Status: ${stage?.label || d.stage}`,
        amount: d.value,
        date: d.created_at,
        icon: <Cart />,
        color: "bg-sky-50 text-sky-600",
      });
    });
    invoices.forEach((i) => {
      const status = INVOICE_STATUSES.find((s) => s.value === i.status);
      items.push({
        kind: "invoice",
        id: `inv-${i.id}`,
        title: `Invoice ${i.invoice_number}`,
        subtitle: `Status: ${status?.label || i.status}`,
        amount: i.total,
        date: i.issued_at || i.created_at,
        icon: <FileDoc />,
        color: "bg-amber-50 text-amber-600",
      });
    });
    jewelryItems.forEach((j) => {
      items.push({
        kind: "job",
        id: `jw-${j.id}`,
        title: `Job ${j.sku || j.name || `#${j.id}`}`,
        subtitle: `Status: ${j.status}`,
        amount: j.price,
        date: j.created_at,
        icon: <Gear />,
        color: "bg-violet-50 text-violet-600",
      });
    });
    tasks.forEach((t) => {
      items.push({
        kind: "task",
        id: `task-${t.id}`,
        title: t.title,
        subtitle: `Task · ${t.status}`,
        date: t.created_at,
        icon: <Clock />,
        color: "bg-emerald-50 text-emerald-600",
      });
    });
    interactions.filter((i) => i.type !== "call" && i.type !== "note").forEach((intr) => {
      // production_update events come from the jewelry workshop status hook —
      // they deserve their own visual treatment so the timeline reads like a workflow.
      const isProd = intr.type === "production_update";
      items.push({
        kind: isProd ? "production" : intr.type,
        id: `intr-${intr.id}`,
        title: intr.subject || intr.type,
        subtitle: (intr.content || "").slice(0, 100) || (isProd && intr.metadata
          ? `${intr.metadata.from_status || "—"} → ${intr.metadata.to_status || "—"}`
          : ""),
        date: intr.occurred_at,
        icon: isProd ? <Gear /> : <Note />,
        color: isProd ? "bg-emerald-50 text-emerald-600" : "bg-stone-50 text-stone-600",
      });
    });
    interactions.filter((i) => i.type === "note").forEach((n) => {
      items.push({
        kind: "note",
        id: `note-${n.id}`,
        title: "Note",
        subtitle: (n.content || "").slice(0, 120),
        date: n.occurred_at,
        icon: <Note />,
        color: "bg-stone-50 text-stone-600",
      });
    });
    return items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [deals, invoices, jewelryItems, tasks, interactions]);

  const productionUpdates = useMemo(
    () => interactions.filter((i) => i.type === "production_update"),
    [interactions]
  );

  const filteredActivity = useMemo(() => {
    if (activityFilter === "all") return activity;
    return activity.filter((a) => a.kind === activityFilter);
  }, [activity, activityFilter]);

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${contact?.name}? This will also remove all linked deals, tasks, invoices, and occasions.`)) return;
    try {
      await deleteContact(id);
      toast.success("Customer deleted");
      navigate("/crm/contacts");
    } catch (e) { toast.error(e.message); }
  };

  if (loading && !contact) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-stone-500">Loading customer…</div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center">
          <div className="text-stone-900 font-medium">Customer not found</div>
          <Link to="/crm/contacts" className="mt-3 inline-flex text-sm text-emerald-600 hover:underline">← Back to Customers</Link>
        </div>
      </div>
    );
  }

  const phone    = contact.phone || contact.phone_alt;
  const email    = contact.email;
  const typeMeta = CONTACT_TYPES.find((t) => t.value === contact.type);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header card */}
      <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6">
          {/* Top row: back link + actions */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <Link to="/crm/contacts" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900">
              <ChevronLeft /> Customers
            </Link>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <ActionBtn icon={<Pencil />}  label="Edit"           onClick={() => navigate(`/crm/contacts/${id}`)} />
              <ActionBtn icon={<Plus />}    label="Add note/task"  onClick={() => setShowLogCall(true)} accent="emerald" />
              {phone && <ActionBtn icon={<Phone />} label={`Call ${phone}`} href={`tel:${phone}`} />}
              {email && <ActionBtn icon={<Mail />}  label={`Email ${email}`} href={`mailto:${email}`} />}
              <ActionBtn icon={<Trash />}   label="Delete"         onClick={handleDelete} accent="rose" />
              <button
                type="button"
                onClick={() => setShowStartJob(true)}
                className="ml-1 inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 shadow-sm"
                title="Start a new jewelry production job for this customer"
              >
                <Gear className="w-4 h-4" /> Start a Job
              </button>
              <button
                type="button"
                onClick={() => navigate(`/crm/deals?new=1&contactId=${id}`)}
                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 shadow-sm"
              >
                <Cart className="w-4 h-4" /> Create Order
              </button>
            </div>
          </div>

          {/* Identity */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center text-stone-700 font-semibold text-xl shrink-0">
              {getInitials(contact.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-stone-900 truncate">{contact.name}</h1>
                {typeMeta && (
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${typeMeta.color}`}>
                    {typeMeta.label}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-3 text-sm text-stone-500 flex-wrap">
                {email && (
                  <a href={`mailto:${email}`} className="inline-flex items-center gap-1 hover:text-stone-900 truncate max-w-xs">
                    <Mail className="w-3.5 h-3.5" /> {email}
                  </a>
                )}
                {phone && (
                  <a href={`tel:${phone}`} className="inline-flex items-center gap-1 hover:text-stone-900">
                    <Phone className="w-3.5 h-3.5" /> {phone}
                  </a>
                )}
                {contact.company && <span className="text-stone-600">· {contact.company}</span>}
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <KpiCard label="Orders"   value={kpis.orders}                 icon={<Cart className="w-5 h-5" />}    accent="sky" />
            <KpiCard label="Revenue"  value={fmtMoney(kpis.revenue)}      icon={<Dollar className="w-5 h-5" />}  accent="emerald" />
            <KpiCard label="Invoices" value={kpis.invoices}               icon={<FileDoc className="w-5 h-5" />} accent="amber" />
            <KpiCard label="Jobs"     value={kpis.jobs}                   icon={<Gear className="w-5 h-5" />}    accent="violet" />
          </div>
        </div>
      </div>

      {/* Body: tabs + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Tabs */}
          <div className="border-b border-stone-200">
            <div className="flex gap-1 overflow-x-auto scrollbar-hide">
              <TabPill label="Orders"    icon={<Cart    className="w-4 h-4" />} count={deals.length}            active={tab === "orders"}    onClick={() => setTab("orders")} />
              <TabPill label="Activity"  icon={<Clock   className="w-4 h-4" />}                                 active={tab === "activity"}  onClick={() => setTab("activity")} />
              <TabPill label="Calls"     icon={<Phone   className="w-4 h-4" />} count={calls.length}            active={tab === "calls"}     onClick={() => setTab("calls")} />
              <TabPill label="Occasions" icon={<Calendar className="w-4 h-4" />} count={occasions.length}        active={tab === "occasions"} onClick={() => setTab("occasions")} />
              <TabPill label="Notes"     icon={<Note    className="w-4 h-4" />} count={noteInteractions.length} active={tab === "notes"}     onClick={() => setTab("notes")} />
            </div>
          </div>

          {/* Tab content */}
          {tab === "orders" && (
            <OrdersTab deals={deals} navigate={navigate} contactId={id} />
          )}
          {tab === "activity" && (
            <ActivityTab
              items={filteredActivity}
              filter={activityFilter}
              setFilter={setActivityFilter}
              counts={{
                all: activity.length,
                order: deals.length,
                invoice: invoices.length,
                job: jewelryItems.length,
                production: productionUpdates.length,
                task: tasks.length,
                note: noteInteractions.length,
              }}
            />
          )}
          {tab === "calls" && (
            <CallsTab
              calls={calls}
              onAdd={() => setShowLogCall(true)}
              onDelete={async (cid) => {
                try {
                  await deleteInteraction(cid);
                  setInteractions((p) => p.filter((x) => x.id !== cid));
                  toast.success("Call deleted");
                } catch (e) { toast.error(e.message); }
              }}
            />
          )}
          {tab === "occasions" && (
            <OccasionsTab
              occasions={occasions}
              onAdd={() => setShowAddOccasion(true)}
              onDelete={async (oid) => {
                try {
                  await deleteOccasion(oid);
                  setOccasions((p) => p.filter((x) => x.id !== oid));
                  toast.success("Occasion deleted");
                } catch (e) { toast.error(e.message); }
              }}
            />
          )}
          {tab === "notes" && (
            <NotesTab
              contact={contact}
              notes={noteInteractions}
              onSaveNotes={async (text) => {
                try {
                  await updateContact(id, { notes: text });
                  reloadContact();
                  toast.success("Notes saved");
                } catch (e) { toast.error(e.message); throw e; }
              }}
            />
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <TagsCard contact={contact} onUpdate={reloadContact} />
          <PreferencesCard contact={contact} onUpdate={reloadContact} />
          <DetailsCard contact={contact} />
        </div>
      </div>

      {/* Modals */}
      {showAddOccasion && (
        <AddOccasionModal
          onClose={() => setShowAddOccasion(false)}
          onSubmit={async (payload) => {
            try {
              const created = await createOccasion({ userId, contactId: id, ...payload });
              setOccasions((p) => [...p, created]);
              setShowAddOccasion(false);
              toast.success("Occasion added");
            } catch (e) { toast.error(e.message); }
          }}
        />
      )}
      {showLogCall && (
        <LogCallModal
          onClose={() => setShowLogCall(false)}
          onSubmit={async (payload) => {
            try {
              const created = await createInteraction({ userId, contactId: id, type: "call", ...payload });
              setInteractions((p) => [created, ...p]);
              setShowLogCall(false);
              toast.success("Call logged");
            } catch (e) { toast.error(e.message); }
          }}
        />
      )}
      {/* Start a new jewelry production job, pre-filled to this customer */}
      <NewJewelryItemModal
        open={showStartJob}
        onClose={() => setShowStartJob(false)}
        initialContactId={Number(id)}
        onCreated={(item) => {
          // Optimistic: bump Jobs KPI without re-fetching everything.
          setJewelryItems((p) => [item, ...p]);
          toast.success(`Job ${item.sku || item.name} created`);
        }}
      />
    </div>
  );
}
