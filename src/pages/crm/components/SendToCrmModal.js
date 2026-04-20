import React, { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import {
  fetchContacts,
  fetchDeals,
  createContact,
  createDeal,
  addDealItems,
  CONTACT_TYPES,
  DEAL_STAGES,
} from "../../../services/crmApi";

const itemFromStone = (s) => ({
  stoneId: String(s.id),
  sku: s.sku,
  category: s.category,
  customPrice: s.priceTotal ? Number(s.priceTotal) / 2 : null,
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
  },
});

export default function SendToCrmModal({ stones, onClose, onSuccess }) {
  const { user } = useUser();
  const [step, setStep] = useState("contact");
  const [contacts, setContacts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [creatingContact, setCreatingContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", type: "buyer", phone: "", email: "" });
  const [dealMode, setDealMode] = useState("new");
  const [selectedDealId, setSelectedDealId] = useState(null);
  const [newDeal, setNewDeal] = useState({ title: "", stage: "negotiation" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    fetchContacts(user.id).then(setContacts).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !selectedContactId) return;
    fetchDeals(user.id, { contactId: selectedContactId }).then(setDeals).catch(() => {});
  }, [user?.id, selectedContactId]);

  const filteredContacts = useMemo(() => {
    const q = contactSearch.toLowerCase().trim();
    if (!q) return contacts;
    return contacts.filter((c) =>
      [c.name, c.company, c.phone, c.email].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [contacts, contactSearch]);

  const totalNeto = useMemo(
    () => stones.reduce((a, s) => a + (s.priceTotal ? Number(s.priceTotal) / 2 : 0), 0),
    [stones]
  );

  const handleCreateContact = async () => {
    if (!newContact.name.trim()) return;
    try {
      const created = await createContact({ userId: user.id, ...newContact });
      setContacts((p) => [created, ...p]);
      setSelectedContactId(created.id);
      setCreatingContact(false);
      setStep("deal");
    } catch (e) { toast.error(e.message); }
  };

  const handleSubmit = async () => {
    if (!selectedContactId) return;
    setSubmitting(true);
    try {
      const items = stones.map(itemFromStone);
      let dealId = selectedDealId;

      if (dealMode === "new") {
        const title = newDeal.title.trim() || `${stones.length} item${stones.length > 1 ? "s" : ""} for ${contacts.find((c) => c.id === selectedContactId)?.name || "client"}`;
        const created = await createDeal({
          userId: user.id,
          contactId: selectedContactId,
          title,
          stage: newDeal.stage,
          value: Math.round(totalNeto),
          items,
        });
        dealId = created.id;
      } else if (dealId) {
        await addDealItems(dealId, items);
      }
      toast.success(`Added ${stones.length} item(s) to deal`);
      onSuccess?.(dealId);
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-stone-900">Send to CRM</h3>
            <div className="text-xs text-stone-500 mt-0.5">{stones.length} item{stones.length > 1 ? "s" : ""} · ${Math.round(totalNeto).toLocaleString()} neto</div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-stone-100">
            <svg className="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Stepper */}
        <div className="px-5 pt-3 flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold">
          <span className={step === "contact" ? "text-stone-900" : "text-stone-400"}>1. Contact</span>
          <span className="text-stone-300">→</span>
          <span className={step === "deal" ? "text-stone-900" : "text-stone-400"}>2. Deal</span>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === "contact" && (
            <>
              {creatingContact ? (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-stone-800 mb-1">New contact</div>
                  <input value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} placeholder="Name *" className={inputCls} autoFocus />
                  <select value={newContact.type} onChange={(e) => setNewContact({ ...newContact, type: e.target.value })} className={inputCls}>
                    {CONTACT_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} placeholder="Phone" className={inputCls} />
                    <input value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} placeholder="Email" type="email" className={inputCls} />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setCreatingContact(false)} className="flex-1 px-3 py-2 text-sm text-stone-700 hover:bg-stone-100 rounded-lg">Back</button>
                    <button onClick={handleCreateContact} disabled={!newContact.name.trim()} className="flex-1 px-3 py-2 text-sm font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50">Create & continue</button>
                  </div>
                </div>
              ) : (
                <>
                  <input
                    value={contactSearch} onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Search contacts…"
                    className={`${inputCls} mb-3`}
                  />
                  <button onClick={() => setCreatingContact(true)} className="w-full mb-3 px-3 py-2 rounded-lg border border-dashed border-stone-300 text-sm text-stone-600 hover:border-stone-500 hover:text-stone-900">
                    + New contact
                  </button>
                  <div className="space-y-1 max-h-72 overflow-y-auto">
                    {filteredContacts.length === 0 && (
                      <div className="text-sm text-stone-500 text-center py-6">No contacts</div>
                    )}
                    {filteredContacts.map((c) => {
                      const isSel = selectedContactId === c.id;
                      const t = CONTACT_TYPES.find((x) => x.value === c.type);
                      return (
                        <button
                          key={c.id}
                          onClick={() => { setSelectedContactId(c.id); setStep("deal"); }}
                          className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                            isSel ? "bg-stone-900 text-white border-stone-900" : "bg-white border-stone-200 hover:border-stone-400"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate">{c.name}</div>
                            {c.company && <div className={`text-xs truncate ${isSel ? "text-stone-300" : "text-stone-500"}`}>{c.company}</div>}
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isSel ? "bg-white/10 text-white" : t?.color}`}>{t?.label || c.type}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {step === "deal" && selectedContactId && (
            <>
              <button onClick={() => setStep("contact")} className="text-xs text-stone-500 hover:text-stone-800 mb-3">← Change contact</button>

              <div className="inline-flex rounded-lg border border-stone-200 bg-white p-0.5 text-xs mb-3">
                <button onClick={() => setDealMode("new")} className={`px-3 py-1.5 rounded-md font-medium ${dealMode === "new" ? "bg-stone-900 text-white" : "text-stone-600"}`}>New deal</button>
                <button onClick={() => setDealMode("existing")} disabled={deals.length === 0} className={`px-3 py-1.5 rounded-md font-medium ${dealMode === "existing" ? "bg-stone-900 text-white" : "text-stone-600 disabled:opacity-40"}`}>Existing ({deals.length})</button>
              </div>

              {dealMode === "new" && (
                <div className="space-y-3">
                  <input
                    value={newDeal.title}
                    onChange={(e) => setNewDeal({ ...newDeal, title: e.target.value })}
                    placeholder="Deal title (auto if empty)"
                    className={inputCls}
                  />
                  <select value={newDeal.stage} onChange={(e) => setNewDeal({ ...newDeal, stage: e.target.value })} className={inputCls}>
                    {DEAL_STAGES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
                  </select>
                  <div className="text-xs text-stone-500">Initial value will be set to ${Math.round(totalNeto).toLocaleString()} (sum of neto prices, editable later).</div>
                </div>
              )}

              {dealMode === "existing" && (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {deals.map((d) => {
                    const s = DEAL_STAGES.find((x) => x.value === d.stage);
                    const isSel = selectedDealId === d.id;
                    return (
                      <button
                        key={d.id} onClick={() => setSelectedDealId(d.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border text-left ${
                          isSel ? "bg-stone-900 text-white border-stone-900" : "bg-white border-stone-200 hover:border-stone-400"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{d.title}</div>
                          <div className={`text-xs ${isSel ? "text-stone-300" : "text-stone-500"}`}>${Number(d.value || 0).toLocaleString()} · {d.items_count || 0} items</div>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isSel ? "bg-white/10 text-white" : s?.color}`}>{s?.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {step === "deal" && (
          <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 rounded-lg">Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedContactId || (dealMode === "existing" && !selectedDealId)}
              className="px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50"
            >{submitting ? "Saving…" : "Add to deal"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-400";
