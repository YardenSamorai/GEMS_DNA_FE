import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { createOffer, offerPublicUrl } from "../../../services/offersApi";
import { getDefaultMarkupPercent } from "../../../services/jewelrySettingsApi";

/* Create an anonymous stone offer from the current inventory selection.
 *
 * Two steps:
 *   1) Configure — alias, WhatsApp number, privacy toggles, expiry, and a
 *      per-stone price row (auto-filled from inventory price + default markup,
 *      each stone independently "show price" or "on request").
 *   2) Link — the opaque /o/:token URL with quick share buttons.
 */

const EXPIRY_OPTIONS = [
  { id: "none", label: "No expiry", days: null },
  { id: "7", label: "7 days", days: 7 },
  { id: "14", label: "14 days", days: 14 },
  { id: "30", label: "30 days", days: 30 },
];

const money = (v) =>
  v == null || v === "" ? "" : `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const CreateOfferModal = ({ open, onClose, stones = [], userId, defaultAlias = "", defaultPhone = "" }) => {
  const markup = useMemo(() => getDefaultMarkupPercent(), []);

  const [alias, setAlias] = useState(defaultAlias);
  const [phone, setPhone] = useState(defaultPhone);
  const [buyerLabel, setBuyerLabel] = useState("");
  const [title, setTitle] = useState("");
  const [showCertificate, setShowCertificate] = useState(false);
  const [hideSku, setHideSku] = useState(false);
  const [expiry, setExpiry] = useState("none");

  // Per-stone price config, keyed by stone id. Pre-fill price from inventory
  // total × (1 + markup); default mode is "on request" (safer for anonymity).
  const [rows, setRows] = useState(() => {
    const map = {};
    for (const s of stones) {
      const base = Number(s.priceTotal) || 0;
      const withMarkup = base ? Math.round(base * (1 + markup / 100)) : "";
      map[s.id] = { price: withMarkup, mode: "on_request" };
    }
    return map;
  });

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { token, url }

  if (!open) return null;

  const setRow = (id, patch) =>
    setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));

  const expiresAt = () => {
    const opt = EXPIRY_OPTIONS.find((o) => o.id === expiry);
    if (!opt?.days) return null;
    return new Date(Date.now() + opt.days * 86400000).toISOString();
  };

  const handleCreate = async () => {
    if (submitting) return;
    if (!stones.length) return toast.error("No stones selected");
    setSubmitting(true);
    try {
      const items = stones.map((s) => {
        const row = rows[s.id] || {};
        return {
          sku: s.sku,
          priceMode: row.mode === "show" ? "show" : "on_request",
          price: row.mode === "show" ? Number(row.price) || null : null,
        };
      });
      const res = await createOffer({
        userId,
        alias: alias.trim() || null,
        contactPhone: phone.trim() || null,
        buyerLabel: buyerLabel.trim() || null,
        title: title.trim() || null,
        showCertificate,
        hideSku,
        expiresAt: expiresAt(),
        items,
      });
      const token = res?.offer?.token;
      setResult({ token, url: offerPublicUrl(token) });
    } catch (err) {
      toast.error(err.message || "Couldn't create offer");
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(result.url);
      toast.success("Link copied");
    } catch (_) {
      toast.error("Copy failed");
    }
  };

  const waShare = () => {
    const text = `${title ? title + " — " : ""}${stones.length} stone${stones.length === 1 ? "" : "s"} for you:\n${result.url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-app-canvas p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {!result ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-semibold tracking-tight text-app-ink">Create offer</h2>
                <p className="mt-0.5 text-[12.5px] text-app-soft">
                  {stones.length} stone{stones.length === 1 ? "" : "s"} · an anonymous link to send a buyer
                </p>
              </div>
              <button type="button" onClick={onClose} className="text-app-soft hover:text-app-ink" aria-label="Close">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Identity */}
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Your display name (alias)">
                <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="e.g. David" className="input-modern" />
              </Field>
              <Field label="WhatsApp number (for buyer CTA)">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" className="input-modern" />
              </Field>
              <Field label="Title (optional, shown to buyer)">
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Cushion options 3–5ct" className="input-modern" />
              </Field>
              <Field label="Buyer label (internal only)">
                <input value={buyerLabel} onChange={(e) => setBuyerLabel(e.target.value)} placeholder="e.g. John @ NYC" className="input-modern" />
              </Field>
            </div>

            {/* Toggles + expiry */}
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <Toggle checked={showCertificate} onChange={setShowCertificate} label="Show certificate" />
              <Toggle checked={hideSku} onChange={setHideSku} label="Hide SKU (use temp ref)" />
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] text-app-muted">Expires</span>
                <select value={expiry} onChange={(e) => setExpiry(e.target.value)} className="input-modern !h-9 !w-auto !py-1">
                  {EXPIRY_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {/* Per-stone pricing */}
            <div className="mt-5">
              <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-app-soft">
                Stones &amp; pricing {markup > 0 && <span className="normal-case text-app-soft">· prefilled at +{markup}% markup</span>}
              </div>
              <div className="space-y-2">
                {stones.map((s) => {
                  const row = rows[s.id] || {};
                  return (
                    <div key={s.id} className="flex items-center gap-3 rounded-xl border border-app-line bg-app-canvas-2 p-2">
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-app-canvas">
                        {s.imageUrl ? (
                          <img src={s.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-app-ink">
                          {[s.shape, s.weightCt ? `${Number(s.weightCt).toFixed(2)}ct` : null].filter(Boolean).join(" · ") || s.sku}
                        </div>
                        <div className="truncate font-mono text-[11px] text-app-soft">{s.sku}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRow(s.id, { mode: row.mode === "show" ? "on_request" : "show" })}
                        className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium transition ${
                          row.mode === "show"
                            ? "bg-emerald-500/12 text-emerald-600"
                            : "bg-app-canvas text-app-soft ring-1 ring-app-line"
                        }`}
                      >
                        {row.mode === "show" ? "Show price" : "On request"}
                      </button>
                      <input
                        type="number"
                        value={row.mode === "show" ? row.price : ""}
                        onChange={(e) => setRow(s.id, { price: e.target.value })}
                        disabled={row.mode !== "show"}
                        placeholder={money(s.priceTotal) || "$"}
                        className="input-modern !w-28 disabled:opacity-40"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button type="button" onClick={handleCreate} disabled={submitting} className="btn-primary">
                {submitting ? "Creating…" : "Create link"}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-600">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-[18px] font-semibold tracking-tight text-app-ink">Offer ready</h2>
            <p className="mt-1 text-[12.5px] text-app-soft">Share this anonymous link with your buyer.</p>

            <div className="mt-4 flex items-center gap-2 rounded-xl border border-app-line bg-app-canvas-2 p-2">
              <input readOnly value={result.url} className="input-modern flex-1 !bg-transparent !border-0" />
              <button type="button" onClick={copyLink} className="btn-secondary shrink-0">Copy</button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={waShare} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/12 px-3 py-2 text-[13px] font-medium text-emerald-600 hover:bg-emerald-500/20">
                Share via WhatsApp
              </button>
              <a href={result.url} target="_blank" rel="noopener noreferrer" className="btn-secondary inline-flex items-center justify-center">
                Preview
              </a>
            </div>

            <button type="button" onClick={onClose} className="mt-5 text-[12.5px] font-medium text-app-muted underline hover:text-app-ink">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const Field = ({ label, children }) => (
  <div>
    <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.06em] text-app-soft">{label}</label>
    {children}
  </div>
);

const Toggle = ({ checked, onChange, label }) => (
  <button type="button" onClick={() => onChange(!checked)} className="inline-flex items-center gap-2">
    <span className={`relative h-5 w-9 rounded-full transition ${checked ? "bg-emerald-500" : "bg-app-line"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${checked ? "left-[18px]" : "left-0.5"}`} />
    </span>
    <span className="text-[12.5px] text-app-ink">{label}</span>
  </button>
);

export default CreateOfferModal;
