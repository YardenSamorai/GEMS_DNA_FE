import React, { useState } from "react";
import { addJewelryMetal, removeJewelryMetal, recalcJewelryItem } from "../../../services/jewelryApi";

const METAL_TYPES = ["gold", "silver", "platinum", "palladium"];
const PURITIES = ["14k", "18k", "22k", "24k", "925", "950"];
const COLORS = ["yellow", "white", "rose"];

const MetalsPanel = ({ itemId, metals, onChanged }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ metalType: "gold", purity: "18k", color: "yellow", weightGrams: "", pricePerGram: "" });
  const [busy, setBusy] = useState(false);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.weightGrams) return alert("Weight is required");
    setBusy(true);
    try {
      await addJewelryMetal(itemId, {
        metalType: form.metalType,
        purity: form.purity,
        color: form.color,
        weightGrams: Number(form.weightGrams),
        pricePerGram: form.pricePerGram ? Number(form.pricePerGram) : null,
      });
      await recalcJewelryItem(itemId);
      setForm({ metalType: "gold", purity: "18k", color: "yellow", weightGrams: "", pricePerGram: "" });
      setShowAdd(false);
      onChanged && (await onChanged());
    } catch (err) {
      alert(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (m) => {
    if (!window.confirm("Remove this metal entry?")) return;
    try {
      await removeJewelryMetal(itemId, m.id);
      await recalcJewelryItem(itemId);
      onChanged && (await onChanged());
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="rounded-xl glass-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-stone-900">Metals</h2>
        {!showAdd && (
          <button onClick={() => setShowAdd(true)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
            + Add metal
          </button>
        )}
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="mb-4 grid gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3 sm:grid-cols-5">
          <Field label="Metal">
            <select value={form.metalType} onChange={(e) => setForm({ ...form, metalType: e.target.value })} className="input">
              {METAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Purity">
            <select value={form.purity} onChange={(e) => setForm({ ...form, purity: e.target.value })} className="input">
              {PURITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Color">
            <select value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="input">
              {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Weight (g) *">
            <input type="number" step="0.001" value={form.weightGrams} onChange={(e) => setForm({ ...form, weightGrams: e.target.value })} className="input" />
          </Field>
          <Field label="Price/gram ($)">
            <input type="number" step="0.01" value={form.pricePerGram} onChange={(e) => setForm({ ...form, pricePerGram: e.target.value })} className="input" />
          </Field>
          <div className="sm:col-span-5 flex items-center justify-end gap-2">
            <button type="button" onClick={() => setShowAdd(false)} disabled={busy} className="rounded-lg px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100">Cancel</button>
            <button type="submit" disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              {busy ? "Adding..." : "Add metal"}
            </button>
          </div>
          <style>{`.input { width: 100%; border-radius: 0.5rem; border: 1px solid #d6d3d1; padding: 0.375rem 0.75rem; font-size: 0.875rem; }
          .input:focus { outline: none; border-color: #10b981; }`}</style>
        </form>
      )}

      {metals.length === 0 ? (
        <div className="py-8 text-center text-sm text-stone-500">No metals added yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <th className="py-2 pr-3">Metal</th>
                <th className="py-2 pr-3">Purity</th>
                <th className="py-2 pr-3">Color</th>
                <th className="py-2 pr-3">Weight</th>
                <th className="py-2 pr-3">Price/g</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {metals.map((m) => (
                <tr key={m.id} className="border-b border-stone-100 hover:bg-stone-50">
                  <td className="py-2 pr-3 capitalize">{m.metal_type}</td>
                  <td className="py-2 pr-3">{m.purity || "—"}</td>
                  <td className="py-2 pr-3 capitalize">{m.color || "—"}</td>
                  <td className="py-2 pr-3">{m.weight_grams}g</td>
                  <td className="py-2 pr-3">{m.price_per_gram ? `$${Number(m.price_per_gram).toLocaleString()}` : "—"}</td>
                  <td className="py-2 pr-3 font-medium text-emerald-700">{m.total_cost ? `$${Number(m.total_cost).toLocaleString()}` : "—"}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => handleRemove(m)} className="text-xs text-red-600 hover:underline">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const Field = ({ label, children }) => (
  <div>
    <label className="mb-1 block text-xs font-medium text-stone-700">{label}</label>
    {children}
  </div>
);

export default MetalsPanel;
