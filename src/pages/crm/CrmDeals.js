import React, { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import {
  fetchDeals,
  createDeal,
  updateDeal,
  fetchContacts,
  DEAL_STAGES,
} from "../../services/crmApi";
import DealDrawer from "./components/DealDrawer";

const fmt = (n) => `$${Number(n || 0).toLocaleString()}`;

export default function CrmDeals() {
  const { user } = useUser();
  const [deals, setDeals] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(() => (typeof window !== "undefined" && window.innerWidth < 640 ? "list" : "kanban"));
  const [showForm, setShowForm] = useState(false);
  const [drawerId, setDrawerId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [stageFilter, setStageFilter] = useState("all");

  const reload = () => {
    if (!user?.id) return;
    setLoading(true);
    fetchDeals(user.id)
      .then(setDeals)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!user?.id) return;
    reload();
    fetchContacts(user.id).then(setContacts).catch(() => {});
    // eslint-disable-next-line
  }, [user?.id]);

  const grouped = useMemo(() => {
    const out = Object.fromEntries(DEAL_STAGES.map((s) => [s.value, []]));
    deals.forEach((d) => {
      if (out[d.stage]) out[d.stage].push(d);
    });
    return out;
  }, [deals]);

  const stageTotals = useMemo(() => {
    const out = {};
    DEAL_STAGES.forEach((s) => {
      out[s.value] = grouped[s.value]?.reduce((a, d) => a + Number(d.value || 0), 0) || 0;
    });
    return out;
  }, [grouped]);

  const filteredList = useMemo(
    () => (stageFilter === "all" ? deals : deals.filter((d) => d.stage === stageFilter)),
    [deals, stageFilter]
  );

  const handleStageChange = async (deal, newStage) => {
    if (deal.stage === newStage) return;
    setDeals((prev) => prev.map((d) => (d.id === deal.id ? { ...d, stage: newStage } : d)));
    try {
      await updateDeal(deal.id, { stage: newStage });
      toast.success(`Moved to ${DEAL_STAGES.find((s) => s.value === newStage)?.label}`);
    } catch (e) {
      toast.error(e.message);
      reload();
    }
  };

  const handleDrop = (newStage, dealId) => {
    const deal = deals.find((d) => d.id === Number(dealId));
    if (deal) handleStageChange(deal, newStage);
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden sm:inline-flex rounded-lg border border-stone-200 bg-white p-0.5 text-xs">
          <ToggleBtn active={view === "kanban"} onClick={() => setView("kanban")}>Pipeline</ToggleBtn>
          <ToggleBtn active={view === "list"} onClick={() => setView("list")}>List</ToggleBtn>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg bg-stone-900 text-white text-sm font-medium hover:bg-stone-800"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          <span>New deal</span>
        </button>
      </div>

      {/* Stage chip filter (mobile-only quick switcher) */}
      <div className="sm:hidden flex gap-1.5 overflow-x-auto -mx-3 px-3 pb-1 scrollbar-hide">
        <button
          onClick={() => setStageFilter("all")}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${
            stageFilter === "all" ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-700 border-stone-200"
          }`}
        >
          All ({deals.length})
        </button>
        {DEAL_STAGES.map((s) => (
          <button
            key={s.value}
            onClick={() => setStageFilter(s.value)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              stageFilter === s.value ? "bg-stone-900 text-white border-stone-900" : `${s.color} hover:opacity-80`
            }`}
          >
            {s.label} ({grouped[s.value]?.length || 0})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-500 text-sm">Loading…</div>
      ) : (
        <>
          {/* Mobile: stacked stage list with chip filter */}
          <div className="sm:hidden">
            {filteredList.length === 0 ? (
              <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-500 text-sm">No deals here</div>
            ) : (
              <div className="space-y-2">
                {filteredList.map((d) => {
                  const s = DEAL_STAGES.find((x) => x.value === d.stage);
                  return (
                    <button
                      key={d.id}
                      onClick={() => setDrawerId(String(d.id))}
                      className="block w-full text-left bg-white rounded-xl border border-stone-200 p-3 active:bg-stone-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-stone-900 truncate">{d.title}</div>
                          <div className="text-xs text-stone-500 truncate mt-0.5">{d.contact_name || "No contact"}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold text-stone-900">{fmt(d.value)}</div>
                          {d.items_count > 0 && (
                            <div className="text-[10px] text-stone-500 mt-0.5">{d.items_count} items</div>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <select
                          value={d.stage}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => { e.stopPropagation(); handleStageChange(d, e.target.value); }}
                          className={`text-[11px] font-medium rounded-full px-2 py-1 border-0 ${s?.color || ""}`}
                        >
                          {DEAL_STAGES.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Desktop: Kanban / list */}
          <div className="hidden sm:block">
            {view === "kanban" ? (
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <div className="flex gap-3 min-w-max pb-2">
                  {DEAL_STAGES.map((stage) => (
                    <div
                      key={stage.value}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData("text/plain");
                        handleDrop(stage.value, id);
                        setDraggingId(null);
                      }}
                      className={`w-72 shrink-0 rounded-xl border-2 ${stage.accent} bg-stone-50/50`}
                    >
                      <div className="p-3 border-b border-stone-200/70 flex items-center justify-between">
                        <div>
                          <div className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${stage.color}`}>{stage.label}</div>
                          <div className="text-xs text-stone-500 mt-1">{grouped[stage.value]?.length || 0} · {fmt(stageTotals[stage.value])}</div>
                        </div>
                      </div>
                      <div className="p-2 space-y-2 min-h-[200px]">
                        {grouped[stage.value]?.map((d) => (
                          <div
                            key={d.id}
                            draggable
                            onDragStart={(e) => { e.dataTransfer.setData("text/plain", d.id); setDraggingId(d.id); }}
                            onDragEnd={() => setDraggingId(null)}
                            onClick={() => setDrawerId(String(d.id))}
                            className={`bg-white rounded-lg border border-stone-200 p-3 cursor-pointer hover:border-stone-400 hover:shadow-sm ${
                              draggingId === d.id ? "opacity-50" : ""
                            }`}
                          >
                            <div className="font-medium text-sm text-stone-900 truncate">{d.title}</div>
                            <div className="text-xs text-stone-500 truncate mt-0.5">{d.contact_name || "No contact"}</div>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-sm font-semibold text-stone-900">{fmt(d.value)}</span>
                              {d.items_count > 0 && (
                                <span className="text-[10px] text-stone-500">{d.items_count} items</span>
                              )}
                            </div>
                          </div>
                        ))}
                        {grouped[stage.value]?.length === 0 && (
                          <div className="text-center text-xs text-stone-400 py-6">No deals</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-stone-500 bg-stone-50 border-b border-stone-200">
                      <th className="py-3 px-4 font-medium">Title</th>
                      <th className="py-3 px-4 font-medium">Contact</th>
                      <th className="py-3 px-4 font-medium">Stage</th>
                      <th className="py-3 px-4 font-medium">Items</th>
                      <th className="py-3 px-4 font-medium text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deals.length === 0 ? (
                      <tr><td colSpan={5} className="py-12 text-center text-stone-500">No deals yet</td></tr>
                    ) : deals.map((d) => {
                      const s = DEAL_STAGES.find((x) => x.value === d.stage);
                      return (
                        <tr key={d.id} onClick={() => setDrawerId(String(d.id))} className="border-b border-stone-100 last:border-0 hover:bg-stone-50 cursor-pointer">
                          <td className="py-3 px-4 font-medium text-stone-900">{d.title}</td>
                          <td className="py-3 px-4 text-stone-700">{d.contact_name || "—"}</td>
                          <td className="py-3 px-4"><span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${s?.color}`}>{s?.label || d.stage}</span></td>
                          <td className="py-3 px-4 text-stone-700">{d.items_count || 0}</td>
                          <td className="py-3 px-4 text-right font-semibold text-stone-900">{fmt(d.value)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {showForm && (
        <NewDealModal
          contacts={contacts}
          onClose={() => setShowForm(false)}
          onSubmit={async (payload) => {
            try {
              const created = await createDeal({ userId: user.id, ...payload });
              toast.success("Deal created");
              setShowForm(false);
              reload();
              setDrawerId(String(created.id));
            } catch (e) { toast.error(e.message); }
          }}
        />
      )}

      {drawerId && (
        <DealDrawer dealId={drawerId} onClose={() => setDrawerId(null)} onChanged={reload} />
      )}
    </div>
  );
}

const ToggleBtn = ({ active, onClick, children }) => (
  <button onClick={onClick} className={`px-3 py-1.5 rounded-md font-medium ${active ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}>{children}</button>
);

function NewDealModal({ contacts, onClose, onSubmit }) {
  const [form, setForm] = useState({ contactId: "", title: "", value: "", stage: "lead", expectedClose: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handle = async (e) => {
    e.preventDefault();
    if (!form.contactId || !form.title.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        contactId: Number(form.contactId),
        title: form.title.trim(),
        value: Number(form.value || 0),
        stage: form.stage,
        expectedClose: form.expectedClose || null,
      });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/50 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={handle} onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <h3 className="font-semibold text-stone-900">New deal</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-stone-100">
            <svg className="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5 space-y-3">
          <Field label="Contact *">
            <select value={form.contactId} onChange={(e) => set("contactId", e.target.value)} className={inputCls} required>
              <option value="">Choose contact…</option>
              {contacts.map((c) => (<option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</option>))}
            </select>
          </Field>
          <Field label="Title *">
            <input value={form.title} onChange={(e) => set("title", e.target.value)} className={inputCls} required placeholder="3ct emerald-cut sale" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Value (USD)">
              <input value={form.value} onChange={(e) => set("value", e.target.value)} type="number" min="0" className={inputCls} />
            </Field>
            <Field label="Stage">
              <select value={form.stage} onChange={(e) => set("stage", e.target.value)} className={inputCls}>
                {DEAL_STAGES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
              </select>
            </Field>
          </div>
          <Field label="Expected close">
            <input type="date" value={form.expectedClose} onChange={(e) => set("expectedClose", e.target.value)} className={inputCls} />
          </Field>
        </div>
        <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 rounded-lg">Cancel</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50">{saving ? "Creating…" : "Create"}</button>
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
