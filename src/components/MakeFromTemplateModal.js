import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { createJewelryItemFromTemplate } from "../services/jewelryApi";
import { fetchDeals } from "../services/crmApi";
import CustomerPicker from "../pages/jewelry/components/CustomerPicker";

/* Phase E — "Make from this template" modal.
 * Lets a signed-in staffer spin off a workshop job (jewelry_items row) from a
 * catalog product (jewelry_products row). Fields like title, metal, weight,
 * size and cover image are pre-filled by the BE; here we just collect the
 * extra context that doesn't live on the catalog: customer, optional deal,
 * and an optional name override.
 */
const MakeFromTemplateModal = ({ open, onClose, template }) => {
  const { user } = useUser();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [contactId, setContactId] = useState(null);
  const [dealId, setDealId] = useState(null);
  const [deals, setDeals] = useState([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setName(template?.title || "");
      setContactId(null);
      setDealId(null);
      setError(null);
      setSubmitting(false);
    }
  }, [open, template]);

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

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!template?.model_number) {
      setError("Missing template");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await createJewelryItemFromTemplate({
        userId: user?.id,
        location: user?.publicMetadata?.location,
        modelNumber: template.model_number,
        contactId: contactId || null,
        dealId: dealId || null,
        name: name.trim() || null,
      });
      const item = res.item;
      toast.success(`Workshop job ${item.sku} created`);
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
            <h2 className="text-lg font-semibold text-stone-900">Make from this template</h2>
            <p className="mt-1 text-sm text-stone-500">
              Creates a workshop job pre-filled from{" "}
              <span className="font-medium text-stone-700">{template?.model_number}</span>
              {template?.title ? ` — ${template.title}` : ""}.
            </p>
          </div>

          <div className="space-y-4 px-6 py-5">
            {error && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-stone-700">Job name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={template?.title || "Job name"}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <p className="mt-1 text-xs text-stone-400">Defaults to the template title. SKU is generated automatically.</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-stone-700">
                Customer <span className="font-normal text-stone-400">(optional)</span>
              </label>
              <CustomerPicker value={contactId} onChange={(v) => { setContactId(v); setDealId(null); }} />
              <p className="mt-1 text-xs text-stone-400">Leave empty to make a stock job not tied to anyone.</p>
            </div>

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
              {submitting ? "Creating…" : "Create workshop job"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MakeFromTemplateModal;
