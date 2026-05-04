import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { sellJewelryItem } from "../../../services/jewelryApi";
import CustomerPicker from "./CustomerPicker";

const SellItemModal = ({ open, onClose, item, onSold }) => {
  const { user } = useUser();
  const [contactId, setContactId] = useState(null);
  const [salePrice, setSalePrice] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setContactId(item?.contact_id || null);
      setSalePrice(item?.sale_price || "");
      setNotes("");
      setError(null);
    }
  }, [open, item]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!contactId) {
      setError("Customer is required");
      return;
    }
    setBusy(true);
    try {
      await sellJewelryItem(item.id, {
        contactId,
        salePrice: salePrice ? Number(salePrice) : undefined,
        notes: notes || null,
        userId: user?.id,
      });
      onClose();
      onSold && (await onSold());
    } catch (err) {
      setError(err.message || "Failed to sell");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
      >
        <div className="border-b border-stone-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-stone-900">Sell jewelry item</h2>
          <p className="mt-1 text-sm text-stone-500">
            Creates a won deal in CRM and marks this item as sold.
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-700">Customer *</label>
            <CustomerPicker value={contactId} onChange={setContactId} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-700">Sale price ($)</label>
            <input
              type="number" step="0.01"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              placeholder={item?.sale_price ? String(item.sale_price) : "0.00"}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-700">Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-stone-200 bg-stone-50 px-6 py-3">
          <button type="button" onClick={onClose} disabled={busy}
            className="rounded-lg px-4 py-2 text-sm text-stone-700 hover:bg-stone-100">Cancel</button>
          <button type="submit" disabled={busy}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            {busy ? "Selling..." : "Confirm sale"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SellItemModal;
