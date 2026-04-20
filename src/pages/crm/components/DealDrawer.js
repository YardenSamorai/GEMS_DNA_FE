import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  fetchDeal,
  updateDeal,
  deleteDeal,
  addDealItems,
  updateDealItem,
  deleteDealItem,
  DEAL_STAGES,
} from "../../../services/crmApi";
import StonePicker from "./StonePicker";

const fmt = (n) => `$${Number(n || 0).toLocaleString()}`;
const timeAgo = (d) => {
  if (!d) return "";
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default function DealDrawer({ dealId, onClose, onChanged }) {
  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      setDeal(await fetchDeal(dealId));
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [dealId]);

  const handleField = async (field, value) => {
    try {
      const updated = await updateDeal(dealId, { [field]: value });
      setDeal((d) => ({ ...d, ...updated }));
      onChanged?.();
    } catch (e) { toast.error(e.message); }
  };

  const handleAddItems = async (stones) => {
    if (!stones?.length) return setShowPicker(false);
    const items = stones.map((s) => ({
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
      },
    }));
    try {
      await addDealItems(dealId, items);
      toast.success(`${items.length} item(s) added`);
      setShowPicker(false);
      reload();
      onChanged?.();
    } catch (e) { toast.error(e.message); }
  };

  const handleItemPrice = async (itemId, price) => {
    try {
      await updateDealItem(itemId, { customPrice: Number(price) || 0 });
      reload();
    } catch (e) { toast.error(e.message); }
  };

  const handleRemoveItem = async (itemId) => {
    try {
      await deleteDealItem(itemId);
      reload();
      onChanged?.();
    } catch (e) { toast.error(e.message); }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this deal?")) return;
    try {
      await deleteDeal(dealId);
      toast.success("Deal deleted");
      onChanged?.();
      onClose();
    } catch (e) { toast.error(e.message); }
  };

  const itemsTotal = deal?.items?.reduce((a, i) => a + Number(i.custom_price || 0) * Number(i.quantity || 1), 0) || 0;

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-stone-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full sm:w-[640px] bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        {loading || !deal ? (
          <div className="flex-1 flex items-center justify-center text-sm text-stone-500">Loading…</div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 py-4 border-b border-stone-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <input
                    value={deal.title}
                    onChange={(e) => setDeal({ ...deal, title: e.target.value })}
                    onBlur={(e) => handleField("title", e.target.value)}
                    className="text-lg font-bold text-stone-900 w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-stone-300 rounded px-1 -ml-1"
                  />
                  <div className="text-sm text-stone-500 mt-1">{deal.contact_name}{deal.contact_company ? ` · ${deal.contact_company}` : ""}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={handleDelete} className="p-2 rounded-lg text-rose-600 hover:bg-rose-50">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>
                  </button>
                  <button onClick={onClose} className="p-2 rounded-lg text-stone-600 hover:bg-stone-100">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              {/* Stage pills */}
              <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
                {DEAL_STAGES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => handleField("stage", s.value)}
                    className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                      deal.stage === s.value ? `${s.color} border-transparent ring-2 ring-stone-900/10` : "bg-white text-stone-500 border-stone-200 hover:bg-stone-50"
                    }`}
                  >{s.label}</button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Numbers */}
              <div className="grid grid-cols-2 gap-3">
                <Card label="Deal value">
                  <div className="flex items-center gap-1">
                    <span className="text-stone-500">$</span>
                    <input
                      type="number" min="0"
                      value={deal.value || 0}
                      onChange={(e) => setDeal({ ...deal, value: e.target.value })}
                      onBlur={(e) => handleField("value", Number(e.target.value) || 0)}
                      className="w-full bg-transparent text-lg font-semibold text-stone-900 focus:outline-none"
                    />
                  </div>
                </Card>
                <Card label="Items total">
                  <div className="text-lg font-semibold text-stone-900">{fmt(itemsTotal)}</div>
                </Card>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Probability (%)">
                  <input type="number" min="0" max="100" value={deal.probability || 0}
                    onChange={(e) => setDeal({ ...deal, probability: e.target.value })}
                    onBlur={(e) => handleField("probability", Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                    className={inputCls} />
                </Field>
                <Field label="Expected close">
                  <input type="date"
                    value={deal.expected_close ? deal.expected_close.slice(0,10) : ""}
                    onChange={(e) => handleField("expectedClose", e.target.value || null)}
                    className={inputCls} />
                </Field>
              </div>

              <Field label="Notes">
                <textarea
                  value={deal.notes || ""}
                  onChange={(e) => setDeal({ ...deal, notes: e.target.value })}
                  onBlur={(e) => handleField("notes", e.target.value)}
                  className={`${inputCls} min-h-[70px]`}
                  placeholder="Internal notes about this deal…"
                />
              </Field>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-stone-900">Items ({deal.items?.length || 0})</h3>
                  <button onClick={() => setShowPicker(true)} className="text-xs font-medium text-stone-700 hover:text-stone-900 inline-flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add from inventory
                  </button>
                </div>
                {deal.items?.length === 0 ? (
                  <div className="text-sm text-stone-500 text-center py-6 bg-stone-50 rounded-lg border border-stone-200 border-dashed">
                    No items linked yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {deal.items.map((it) => (
                      <DealItemRow
                        key={it.id}
                        item={it}
                        onPriceChange={(p) => handleItemPrice(it.id, p)}
                        onRemove={() => handleRemoveItem(it.id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Activity */}
              {deal.interactions?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-stone-900 mb-2">Activity</h3>
                  <ul className="space-y-2">
                    {deal.interactions.map((i) => (
                      <li key={i.id} className="bg-white border border-stone-200 rounded-lg p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-stone-500">{i.type}</span>
                          <span className="text-[11px] text-stone-400">{timeAgo(i.occurred_at)}</span>
                        </div>
                        {i.subject && <div className="font-medium mt-1">{i.subject}</div>}
                        {i.content && <div className="text-stone-700 mt-0.5 whitespace-pre-line">{i.content}</div>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showPicker && (
        <StonePicker onClose={() => setShowPicker(false)} onSelect={handleAddItems} />
      )}
    </div>
  );
}

function DealItemRow({ item, onPriceChange, onRemove }) {
  const snap = item.snapshot || {};
  const [price, setPrice] = useState(item.custom_price || 0);
  const bruto = snap.priceTotal || 0;
  const neto = bruto / 2;

  return (
    <div className="flex items-center gap-3 bg-white border border-stone-200 rounded-lg p-3">
      {snap.imageUrl ? (
        <img src={snap.imageUrl} alt={item.sku} className="w-12 h-12 rounded-md object-cover bg-stone-100 shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-md bg-stone-100 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-stone-900 truncate">{item.sku || "—"}</div>
        <div className="text-xs text-stone-500 truncate">
          {[snap.shape, snap.weightCt && `${snap.weightCt}ct`, snap.color, snap.clarity, snap.lab].filter(Boolean).join(" · ")}
        </div>
        {bruto > 0 && (
          <div className="text-[10px] text-stone-400 mt-0.5">List: {fmt(bruto)} bruto · {fmt(neto)} neto</div>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className="flex items-center gap-1">
          <span className="text-xs text-stone-500">$</span>
          <input
            type="number" min="0" value={price}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={() => onPriceChange(price)}
            className="w-24 px-2 py-1 text-sm text-right rounded-md border border-stone-200 bg-white focus:outline-none focus:border-stone-400"
          />
        </div>
        <button onClick={onRemove} className="text-[11px] text-rose-600 hover:underline mt-1">Remove</button>
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
const Card = ({ label, children }) => (
  <div className="bg-stone-50 border border-stone-200 rounded-lg p-3">
    <div className="text-[10px] uppercase tracking-wider text-stone-500 font-medium">{label}</div>
    {children}
  </div>
);
