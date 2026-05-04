import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import {
  createJewelryItem,
  JEWELRY_TYPES,
  JEWELRY_CATEGORIES,
} from "../../../services/jewelryApi";
import { fetchDeals } from "../../../services/crmApi";
import CustomerPicker from "./CustomerPicker";

const NewJewelryItemModal = ({ open, onClose, onCreated, initialContactId = null, initialDealId = null }) => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [type, setType] = useState("custom");
  const [category, setCategory] = useState("Ring");
  const [contactId, setContactId] = useState(initialContactId);
  const [dealId, setDealId] = useState(initialDealId);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Deals for the currently-picked customer (so user can attach this job to one)
  const [deals, setDeals] = useState([]);
  const [dealsLoading, setDealsLoading] = useState(false);

  // Re-sync when modal is reopened with a different contact pre-filled
  useEffect(() => {
    if (open) {
      setContactId(initialContactId);
      setDealId(initialDealId);
    }
  }, [open, initialContactId, initialDealId]);

  // Whenever a customer is picked, load their open deals so we can offer to attach
  useEffect(() => {
    if (!contactId || !user?.id) { setDeals([]); return; }
    let cancelled = false;
    setDealsLoading(true);
    fetchDeals(user.id, { contactId })
      .then((rows) => { if (!cancelled) setDeals(rows || []); })
      .catch(() => { if (!cancelled) setDeals([]); })
      .finally(() => { if (!cancelled) setDealsLoading(false); });
    return () => { cancelled = true; };
  }, [contactId, user?.id]);

  if (!open) return null;

  const reset = () => {
    setName(""); setType("custom"); setCategory("Ring");
    setContactId(initialContactId); setDealId(initialDealId);
    setDescription("");
    setError(null); setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    if (type === "custom" && !contactId) {
      setError("Customer is required for custom orders");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await createJewelryItem({
        userId: user?.id,
        location: user?.publicMetadata?.location,
        name: name.trim(),
        type,
        category,
        contactId,
        dealId: dealId || null,
        description: description.trim() || null,
      });
      const item = res.item;
      reset();
      if (onCreated) onCreated(item);
      onClose();
      navigate(`/jewelry/items/${item.id}`);
    } catch (err) {
      setError(err.message || "Failed to create");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={handleClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="border-b border-stone-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-stone-900">New Jewelry Item</h2>
            <p className="mt-1 text-sm text-stone-500">SKU is generated automatically</p>
          </div>

          <div className="space-y-4 px-6 py-5">
            {error && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-stone-700">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                placeholder="e.g. Diamond Engagement Ring"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-700">Type *</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {JEWELRY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-700">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {JEWELRY_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-stone-700">
                Customer {type === "custom" && "*"}
              </label>
              <CustomerPicker value={contactId} onChange={(v) => { setContactId(v); setDealId(null); }} />
              {type === "stock" && (
                <p className="mt-1 text-xs text-stone-400">Optional for stock items</p>
              )}
            </div>

            {/* Optional: attach this job to one of the customer's existing deals */}
            {contactId && (
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-700">
                  Link to deal <span className="font-normal text-stone-400">(optional)</span>
                </label>
                <select
                  value={dealId || ""}
                  onChange={(e) => setDealId(e.target.value ? Number(e.target.value) : null)}
                  disabled={dealsLoading}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-stone-50"
                >
                  <option value="">{dealsLoading ? "Loading deals…" : "— No linked deal —"}</option>
                  {deals.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} · {d.stage}{d.value ? ` · $${Number(d.value).toLocaleString()}` : ""}
                    </option>
                  ))}
                </select>
                {!dealsLoading && deals.length === 0 && (
                  <p className="mt-1 text-xs text-stone-400">This customer has no deals yet.</p>
                )}
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-stone-700">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Design notes, customer requests..."
                className="w-full resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-stone-200 bg-stone-50 px-6 py-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="rounded-lg px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewJewelryItemModal;
