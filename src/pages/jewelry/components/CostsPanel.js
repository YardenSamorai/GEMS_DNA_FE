import React, { useState } from "react";
import {
  addJewelryCost,
  removeJewelryCost,
  recalcJewelryItem,
  updateJewelryItem,
} from "../../../services/jewelryApi";

const CATEGORIES = [
  { value: "labor",    label: "Labor" },
  { value: "material", label: "Material" },
  { value: "external", label: "External service" },
  { value: "other",    label: "Other" },
];

const CostsPanel = ({ itemId, costs, item, onChanged }) => {
  const [form, setForm] = useState({ label: "", category: "labor", amount: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [markup, setMarkup] = useState(item?.markup_percent || 0);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.label || !form.amount) return alert("Label and amount are required");
    setBusy(true);
    try {
      await addJewelryCost(itemId, {
        label: form.label,
        category: form.category,
        amount: Number(form.amount),
        notes: form.notes || null,
      });
      await recalcJewelryItem(itemId);
      setForm({ label: "", category: "labor", amount: "", notes: "" });
      onChanged && (await onChanged());
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (c) => {
    if (!window.confirm("Remove this cost entry?")) return;
    try {
      await removeJewelryCost(itemId, c.id);
      await recalcJewelryItem(itemId);
      onChanged && (await onChanged());
    } catch (err) {
      alert(err.message);
    }
  };

  const saveMarkup = async () => {
    try {
      await updateJewelryItem(itemId, { markupPercent: Number(markup) });
      await recalcJewelryItem(itemId);
      onChanged && (await onChanged());
    } catch (err) {
      alert(err.message);
    }
  };

  const total = costs.reduce((sum, c) => sum + Number(c.amount || 0), 0);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-stone-900">Add cost entry</h2>
          <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Label>Label *</Label>
              <input className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Casting, Setting labor, Polishing..." />
            </div>
            <div>
              <Label>Category</Label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Amount ($) *</Label>
              <input type="number" step="0.01" className="input" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="sm:col-span-4">
              <Label>Notes</Label>
              <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="sm:col-span-4 flex items-center justify-end">
              <button type="submit" disabled={busy}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                {busy ? "Adding..." : "Add cost"}
              </button>
            </div>
            <style>{`.input { width: 100%; border-radius: 0.5rem; border: 1px solid #d6d3d1; padding: 0.5rem 0.75rem; font-size: 0.875rem; }
            .input:focus { outline: none; border-color: #10b981; }`}</style>
          </form>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-stone-900">Cost entries</h2>
          {costs.length === 0 ? (
            <div className="py-6 text-center text-sm text-stone-500">No costs added yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                  <th className="py-2 pr-3">Label</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3 text-right">Amount</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {costs.map((c) => (
                  <tr key={c.id} className="border-b border-stone-100 hover:bg-stone-50">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{c.label}</div>
                      {c.notes && <div className="text-xs text-stone-500">{c.notes}</div>}
                    </td>
                    <td className="py-2 pr-3 capitalize text-stone-600">{c.category || "—"}</td>
                    <td className="py-2 pr-3 text-right font-medium">${Number(c.amount).toLocaleString()}</td>
                    <td className="py-2 text-right">
                      <button onClick={() => handleRemove(c)} className="text-xs text-red-600 hover:underline">Remove</button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-stone-50 font-semibold">
                  <td className="py-2 pr-3">Subtotal (costs only)</td>
                  <td></td>
                  <td className="py-2 pr-3 text-right">${total.toLocaleString()}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-stone-900">Pricing</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Total cost" value={item?.total_cost} bold />
            <div className="border-t border-stone-100 pt-2">
              <Label>Markup %</Label>
              <div className="flex gap-2">
                <input type="number" step="0.1" value={markup}
                  onChange={(e) => setMarkup(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm" />
                <button onClick={saveMarkup}
                  className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800">
                  Apply
                </button>
              </div>
            </div>
            <Row label="Sale price" value={item?.sale_price} highlight />
          </dl>
        </div>
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-xs text-stone-600">
          Total cost is auto-calculated from <strong>Stones</strong> snapshots + <strong>Metals</strong> totals + <strong>Costs</strong> entries.
          Sale price = total cost × (1 + markup%).
        </div>
      </div>
    </div>
  );
};

const Label = ({ children }) => <label className="mb-1 block text-xs font-medium text-stone-700">{children}</label>;

const Row = ({ label, value, bold, highlight }) => {
  const formatted = typeof value === "number" || (value != null && !isNaN(Number(value)))
    ? `$${Number(value).toLocaleString()}`
    : <span className="text-stone-300">—</span>;
  return (
    <div className="flex items-center justify-between">
      <dt className="text-stone-500">{label}</dt>
      <dd className={`${bold ? "font-semibold" : ""} ${highlight ? "text-emerald-700 text-base font-bold" : "text-stone-900"}`}>
        {formatted}
      </dd>
    </div>
  );
};

export default CostsPanel;
