import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { addJewelryStones, removeJewelryStone, recalcJewelryItem } from "../../../services/jewelryApi";
import { STONE_STATUS_LABELS, STONE_STATUS_PILL } from "../../../services/stonesApi";

const API_BASE = process.env.REACT_APP_API_URL || "https://gems-dna-be.onrender.com";

const ROLE_OPTIONS = [
  { value: "center", label: "Center" },
  { value: "side", label: "Side" },
  { value: "accent", label: "Accent" },
  { value: "halo", label: "Halo" },
  { value: "melee", label: "Melee" },
];

/* Lightweight in-module cache so opening the form on multiple items
 * doesn't re-download the whole stones list each time. We expose load
 * errors instead of swallowing them — the autocomplete uses them to show
 * a "Failed to load — retry" affordance, otherwise the user sees an
 * empty dropdown with no idea why nothing is matching. */
let _stoneCache = null;
let _stoneCachePromise = null;
const loadStones = (force = false) => {
  if (force) { _stoneCache = null; _stoneCachePromise = null; }
  if (_stoneCache) return Promise.resolve(_stoneCache);
  if (_stoneCachePromise) return _stoneCachePromise;
  _stoneCachePromise = fetch(`${API_BASE}/api/soap-stones`)
    .then(async (r) => {
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(`API ${r.status}${text ? `: ${text.slice(0, 80)}` : ""}`);
      }
      return r.json();
    })
    .then((payload) => {
      // /api/soap-stones currently returns { stones: [...] }, but earlier
      // versions returned a bare array. Be tolerant of both so this keeps
      // working if the BE ever changes back.
      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.stones)
          ? payload.stones
          : [];
      _stoneCache = rows;
      return _stoneCache;
    })
    .catch((err) => {
      _stoneCachePromise = null; // allow retry on next call
      throw err;
    });
  return _stoneCachePromise;
};

const fmtPrice = (n) => (n != null && !isNaN(n) ? `$${Number(n).toLocaleString()}` : "—");

/* Build the "draft row" we keep in local state while the user is queuing
 * picks. Captures the inventory snapshot eagerly so the queue can show
 * dimensions/specs without re-querying, then forwards the same payload to
 * the batch endpoint on submit. */
const draftFromInventoryStone = (s) => {
  const w = s?.weightCt ?? s?.weight ?? null;
  const total = s?.priceTotal != null
    ? s.priceTotal
    : (s?.pricePerCt != null && w != null ? s.pricePerCt * w : null);
  return {
    // Stable key so we can edit / remove individual rows.
    key: `${s.sku}-${Math.random().toString(36).slice(2, 8)}`,
    stoneSku: s.sku || "",
    role: "center",
    quantity: 1,
    notes: "",
    consumeFromInventory: true,
    // Local snapshot used only for displaying the draft row. The BE will
    // re-snapshot on submit so authoritative numbers always come from
    // soap_stones, not the cached client list.
    preview: {
      shape:        s.shape || null,
      weight:       w,
      color:        s.color || null,
      clarity:      s.clarity || null,
      lab:          s.lab || null,
      origin:       s.origin || null,
      category:     s.category || null,
      measurements: s.measurements || null,
      ratio:        s.ratio != null ? Number(s.ratio) : null,
      cut:          s.cut || null,
      polish:       s.polish || null,
      symmetry:     s.symmetry || null,
      tablePercent: s.tablePercent != null ? Number(s.tablePercent) : null,
      depthPercent: s.depthPercent != null ? Number(s.depthPercent) : null,
      fluorescence: s.fluorescence || null,
      treatment:    s.treatment || null,
      certificateNumber: s.certificateNumber || null,
      certificateUrl:    s.certificateUrl || null,
      videoUrl:     s.videoUrl || null,
      fancyIntensity: s.fancyIntensity || null,
      fancyColor:     s.fancyColor || null,
      fancyOvertone:  s.fancyOvertone || null,
      pairSku:        s.pairSku || null,
      sourcedFrom:    s.location || null,
      price:        total,
      imageUrl:     s.imageUrl || s.image || null,
      // Inventory-side hints we display but never write back.
      inventoryParcelQty: s.stones != null ? Number(s.stones) : null,
    },
  };
};

const draftSnapshotOnly = () => ({
  key: `manual-${Math.random().toString(36).slice(2, 8)}`,
  stoneSku: "",
  role: "center",
  quantity: 1,
  notes: "",
  consumeFromInventory: false,
  preview: {
    shape: "",
    weight: "",
    measurements: "",
    price: "",
  },
  manual: true, // marker so we render an editable spec block instead of read-only
});

const StonesPanel = ({ itemId, stones, onChanged }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const reset = () => {
    setDrafts([]);
    setErr(null);
    setShowAdd(false);
  };

  const handlePickInventory = (s) => {
    setDrafts((d) => [...d, draftFromInventoryStone(s)]);
  };

  // "Split" = clone an existing draft so the same SKU can be allocated to a
  // different role (e.g. 12 sides + 8 accents from one parcel). We default
  // qty to 1 on the new row so the user starts the split from a clean number.
  const handleSplit = (key) => {
    setDrafts((d) => {
      const idx = d.findIndex((x) => x.key === key);
      if (idx < 0) return d;
      const clone = {
        ...d[idx],
        key: `${d[idx].stoneSku || 'manual'}-${Math.random().toString(36).slice(2, 8)}`,
        quantity: 1,
        role: d[idx].role === "center" ? "side" : d[idx].role,
      };
      const next = [...d];
      next.splice(idx + 1, 0, clone);
      return next;
    });
  };

  const handleRemoveDraft = (key) => {
    setDrafts((d) => d.filter((x) => x.key !== key));
  };

  const handleUpdateDraft = (key, patch) => {
    setDrafts((d) => d.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  };

  // For each SKU, surface "you've allocated N out of M in inventory" so the
  // user can tell when they've over-committed a parcel. M comes from the
  // inventory hint we cached at pick time; rows without a hint are skipped.
  const allocationHints = useMemo(() => {
    const out = {};
    drafts.forEach((d) => {
      if (!d.stoneSku) return;
      const cap = d.preview?.inventoryParcelQty;
      if (!cap || cap < 2) return;
      out[d.stoneSku] = out[d.stoneSku] || { allocated: 0, cap, label: d.stoneSku };
      out[d.stoneSku].allocated += Number(d.quantity || 0);
    });
    return out;
  }, [drafts]);

  const handleSubmit = async () => {
    if (drafts.length === 0) return;
    // Block submit if any manual row is missing the bare minimum.
    const bad = drafts.find((d) => !d.stoneSku && !d.manual);
    if (bad) {
      setErr("Each queued row needs either a picked SKU or to be marked as manual.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const payload = drafts.map((d) => {
        // Manual rows: forward whatever the user typed into the snapshot so
        // it persists on jewelry_item_stones.snapshot.
        let snapshot = null;
        if (d.manual) {
          const s = {};
          if (d.preview.shape) s.shape = d.preview.shape;
          if (d.preview.weight !== "" && d.preview.weight != null) s.weight = Number(d.preview.weight);
          if (d.preview.measurements) s.measurements = d.preview.measurements;
          if (d.preview.price !== "" && d.preview.price != null) s.price = Number(d.preview.price);
          if (Object.keys(s).length) snapshot = s;
        }
        return {
          stoneSku: d.stoneSku || null,
          role: d.role,
          quantity: Number(d.quantity || 1),
          notes: d.notes || null,
          consumeFromInventory: !!d.consumeFromInventory,
          snapshot,
        };
      });
      await addJewelryStones(itemId, payload);
      await recalcJewelryItem(itemId);
      reset();
      onChanged && (await onChanged());
    } catch (error) {
      setErr(error.message || "Failed to add stones");
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveExisting = async (s) => {
    const note = s.consume_from_inventory
      ? "Remove this stone? It will be released back to available inventory."
      : "Remove this stone from the piece?";
    if (!window.confirm(note)) return;
    try {
      await removeJewelryStone(itemId, s.id);
      await recalcJewelryItem(itemId);
      onChanged && (await onChanged());
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="rounded-xl glass-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-stone-900">Stones in this piece</h2>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
          >
            + Add stones
          </button>
        )}
      </div>

      {showAdd && (
        <div className="mb-4 rounded-lg border border-stone-200 bg-stone-50 p-3">
          <StoneAutocomplete
            onPick={handlePickInventory}
            onAddManual={() => setDrafts((d) => [...d, draftSnapshotOnly()])}
          />

          {drafts.length === 0 ? (
            <div className="mt-3 rounded-md border border-dashed border-stone-300 bg-white py-6 text-center text-xs text-stone-500">
              Pick stones from inventory above — they queue up here. You can split a parcel across multiple roles before saving.
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {drafts.map((d) => (
                <DraftRow
                  key={d.key}
                  draft={d}
                  hint={d.stoneSku ? allocationHints[d.stoneSku] : null}
                  onUpdate={(patch) => handleUpdateDraft(d.key, patch)}
                  onSplit={() => handleSplit(d.key)}
                  onRemove={() => handleRemoveDraft(d.key)}
                />
              ))}
            </ul>
          )}

          {err && (
            <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>
          )}

          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-[11px] text-stone-500">
              {drafts.length === 0
                ? "Nothing queued yet."
                : `${drafts.length} row${drafts.length === 1 ? "" : "s"} ready — they'll be added in a single batch.`}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={reset}
                disabled={busy}
                className="rounded-lg px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={busy || drafts.length === 0}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : `Add ${drafts.length || ""} stone${drafts.length === 1 ? "" : "s"}`.trim()}
              </button>
            </div>
          </div>
        </div>
      )}

      {stones.length === 0 ? (
        <div className="py-8 text-center text-sm text-stone-500">No stones added yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <th className="py-2 pr-3">SKU</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Qty</th>
                <th className="py-2 pr-3">Specs</th>
                <th className="py-2 pr-3">Dimensions</th>
                <th className="py-2 pr-3">Weight</th>
                <th className="py-2 pr-3">Price</th>
                <th className="py-2 pr-3">Notes</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {stones.map((s) => {
                const status = s.consume_from_inventory ? s.inventory_status || "reserved" : null;
                const snap = s.snapshot || {};
                // Build the "specs" cell from a handful of fields without
                // overflowing — full detail lives on the linked stone page.
                const specBits = [
                  snap.color,
                  snap.clarity,
                  snap.cut,
                  snap.fluorescence && snap.fluorescence !== "None" ? `Fluo ${snap.fluorescence}` : null,
                  snap.lab && snap.lab !== "N/A" ? snap.lab : null,
                ].filter(Boolean);
                const dimensionsLabel = snap.measurements
                  ? snap.measurements
                  : (snap.tablePercent || snap.depthPercent
                      ? [snap.tablePercent ? `T ${snap.tablePercent}%` : null, snap.depthPercent ? `D ${snap.depthPercent}%` : null].filter(Boolean).join(" · ")
                      : "—");
                return (
                  <tr key={s.id} className="border-b border-stone-100 hover:bg-stone-50">
                    <td className="py-2 pr-3 font-mono text-xs">
                      {s.stone_sku ? (
                        <Link
                          to={`/${s.stone_sku}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-700 hover:underline"
                          title="Open stone DNA page in new tab"
                        >
                          {s.stone_sku}
                        </Link>
                      ) : (
                        "—"
                      )}
                      {snap.shape && (
                        <div className="text-[10px] uppercase tracking-wide text-stone-400">{snap.shape}</div>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {s.consume_from_inventory ? (
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                            STONE_STATUS_PILL[status] || STONE_STATUS_PILL.reserved
                          }`}
                        >
                          {STONE_STATUS_LABELS[status] || "Reserved"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                          Snapshot only
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 capitalize">{s.role || "—"}</td>
                    <td className="py-2 pr-3 tabular-nums">{s.quantity}</td>
                    <td className="py-2 pr-3 text-xs text-stone-600">
                      {specBits.length ? specBits.join(" · ") : "—"}
                      {snap.certificateNumber && (
                        <div className="text-[10px] text-stone-400">Cert {snap.certificateNumber}</div>
                      )}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{dimensionsLabel}</td>
                    <td className="py-2 pr-3">{snap.weight ? `${snap.weight}ct` : "—"}</td>
                    <td className="py-2 pr-3">{fmtPrice(snap.price)}</td>
                    <td className="py-2 pr-3 text-stone-500">{s.notes || ""}</td>
                    <td className="py-2 text-right">
                      <button onClick={() => handleRemoveExisting(s)} className="text-xs text-red-600 hover:underline">
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/* ----- Single draft row inside the queue. -----
 * Renders different layouts for inventory vs manual draft so the user
 * sees a read-only spec block when they picked from inventory (the BE
 * will re-snapshot on submit) and editable inputs when they're entering
 * a customer-supplied stone by hand. */
const DraftRow = ({ draft, hint, onUpdate, onSplit, onRemove }) => {
  const isInventory = !draft.manual;
  const p = draft.preview || {};
  const overAllocated = hint && hint.allocated > hint.cap;

  return (
    <li className="rounded-lg glass-surface p-2.5">
      <div className="flex items-start gap-3">
        {isInventory && (p.imageUrl ? (
          <img
            src={p.imageUrl}
            alt=""
            className="h-12 w-12 flex-none rounded object-cover"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <div className="h-12 w-12 flex-none rounded bg-stone-100" />
        ))}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <div className="font-mono text-sm font-semibold text-stone-900">
              {draft.stoneSku || (
                <span className="italic text-stone-400">Manual entry</span>
              )}
            </div>
            {isInventory && (
              <div className="truncate text-xs text-stone-500">
                {[p.shape, p.weight ? `${p.weight}ct` : null, p.color, p.clarity, p.lab && p.lab !== "N/A" ? p.lab : null]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </div>
            )}
            {p.price != null && (
              <div className="ml-auto text-sm font-semibold text-stone-700">{fmtPrice(p.price)}</div>
            )}
          </div>

          {isInventory && (
            <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-stone-500">
              {p.measurements && <span><span className="font-medium text-stone-700">Dim</span> {p.measurements}</span>}
              {p.cut && <span><span className="font-medium text-stone-700">Cut</span> {p.cut}</span>}
              {p.polish && <span><span className="font-medium text-stone-700">Pol</span> {p.polish}</span>}
              {p.symmetry && <span><span className="font-medium text-stone-700">Sym</span> {p.symmetry}</span>}
              {p.tablePercent != null && <span><span className="font-medium text-stone-700">T</span> {p.tablePercent}%</span>}
              {p.depthPercent != null && <span><span className="font-medium text-stone-700">D</span> {p.depthPercent}%</span>}
              {p.fluorescence && p.fluorescence !== "None" && <span><span className="font-medium text-stone-700">Fluo</span> {p.fluorescence}</span>}
              {p.certificateNumber && <span><span className="font-medium text-stone-700">Cert</span> {p.certificateNumber}</span>}
              {p.treatment && <span><span className="font-medium text-stone-700">Treat</span> {p.treatment}</span>}
              {p.fancyIntensity && <span><span className="font-medium text-stone-700">Fancy</span> {[p.fancyIntensity, p.fancyColor].filter(Boolean).join(" ")}</span>}
            </div>
          )}

          {hint && (
            <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
              overAllocated ? "bg-rose-100 text-rose-700" : "bg-stone-100 text-stone-600"
            }`}>
              Allocated {hint.allocated}/{hint.cap} from this parcel
              {overAllocated && " — over capacity"}
            </div>
          )}

          <div className="mt-2 grid gap-2 sm:grid-cols-12">
            <div className="sm:col-span-3">
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-stone-500">Role</label>
              <select
                value={draft.role}
                onChange={(e) => onUpdate({ role: e.target.value })}
                className="w-full rounded-md border border-stone-300 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none"
              >
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-stone-500">Qty</label>
              <input
                type="number"
                min="1"
                value={draft.quantity}
                onChange={(e) => onUpdate({ quantity: e.target.value })}
                className="w-full rounded-md border border-stone-300 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none"
              />
            </div>
            {!isInventory && (
              <>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-stone-500">Shape</label>
                  <input
                    value={draft.preview.shape}
                    onChange={(e) => onUpdate({ preview: { ...draft.preview, shape: e.target.value } })}
                    placeholder="Emerald"
                    className="w-full rounded-md border border-stone-300 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-stone-500">Weight (ct)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={draft.preview.weight}
                    onChange={(e) => onUpdate({ preview: { ...draft.preview, weight: e.target.value } })}
                    className="w-full rounded-md border border-stone-300 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-stone-500">Dimensions</label>
                  <input
                    value={draft.preview.measurements}
                    onChange={(e) => onUpdate({ preview: { ...draft.preview, measurements: e.target.value } })}
                    placeholder="8.5 × 6.2 × 4.1 mm"
                    className="w-full rounded-md border border-stone-300 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-stone-500">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={draft.preview.price}
                    onChange={(e) => onUpdate({ preview: { ...draft.preview, price: e.target.value } })}
                    className="w-full rounded-md border border-stone-300 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </>
            )}
            <div className={isInventory ? "sm:col-span-7" : "sm:col-span-12"}>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-stone-500">Notes</label>
              <input
                value={draft.notes}
                onChange={(e) => onUpdate({ notes: e.target.value })}
                placeholder="optional"
                className="w-full rounded-md border border-stone-300 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {isInventory && (
            <label className="mt-2 inline-flex items-center gap-2 text-[11px] text-amber-900">
              <input
                type="checkbox"
                checked={draft.consumeFromInventory}
                onChange={(e) => onUpdate({ consumeFromInventory: e.target.checked })}
                className="h-3.5 w-3.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
              />
              Consume from inventory (reserve now, mark sold when piece sells)
            </label>
          )}
        </div>

        <div className="flex flex-none flex-col items-end gap-1">
          <button
            type="button"
            onClick={onSplit}
            className="rounded px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50"
            title="Duplicate this row to allocate the same SKU to another role"
          >
            + Split
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded px-2 py-0.5 text-[11px] font-medium text-red-600 hover:bg-red-50"
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  );
};

/* ----- Stone autocomplete (queries soap_stones once, filters in-memory) -----
 *
 * UX:
 *   - Always opens on focus, even with no query — shows the most recent
 *     stones so user can browse.
 *   - Live filter on every keystroke against sku/shape/color/clarity/lab.
 *   - Keyboard nav: ArrowDown/Up to highlight, Enter/Tab to pick, Esc closes.
 *   - "Add manual entry" link below the list lets the user queue a
 *     customer-supplied stone (no SKU, edits the spec inline in the draft).
 *
 * Field names map to the /api/soap-stones response shape: weightCt,
 * priceTotal, pricePerCt — NOT weight/bruto_price/net_price.
 */
const StoneAutocomplete = ({ onPick, onAddManual }) => {
  const [stones, setStones] = useState([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [highlight, setHighlight] = useState(0);
  const wrap = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const fetchInventory = (force = false) => {
    setLoading(true);
    setLoadError(null);
    loadStones(force)
      .then((rows) => setStones(rows))
      .catch((err) => setLoadError(err.message || "Failed to load inventory"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchInventory(); }, []);

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrap.current && !wrap.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const matches = useMemo(() => {
    if (!query) return stones.slice(0, 20);
    const q = query.toLowerCase().trim();
    return stones
      .filter((s) => {
        const fields = [s.sku, s.shape, s.color, s.clarity, s.category, s.lab, s.location, s.measurements]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return fields.includes(q);
      })
      .slice(0, 30);
  }, [stones, query]);

  // Keep highlight inside the visible matches range whenever the list changes
  useEffect(() => { setHighlight(0); }, [query, stones.length]);

  const handlePick = (s) => {
    if (!s) return;
    onPick && onPick(s);
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(matches.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      if (matches[highlight]) {
        e.preventDefault();
        handlePick(matches[highlight]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Scroll highlighted row into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${highlight}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  return (
    <div ref={wrap} className="relative">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-xs font-medium text-stone-700">
          Pick stones from inventory{" "}
          {loading && <span className="text-stone-400">(loading inventory…)</span>}
          {!loading && !loadError && stones.length > 0 && (
            <span className="text-stone-400">({stones.length} in stock)</span>
          )}
        </label>
        {onAddManual && (
          <button
            type="button"
            onClick={onAddManual}
            className="rounded px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50"
          >
            + Manual entry
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder={loading ? "Loading inventory…" : "Search SKU, shape, color, dimensions…"}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
      />

      {open && (
        <div
          ref={listRef}
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-stone-200 bg-white shadow-lg"
        >
          {loadError && (
            <div className="flex items-center justify-between gap-2 border-b border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
              <span>Couldn't load inventory: {loadError}</span>
              <button
                type="button"
                onClick={() => fetchInventory(true)}
                className="rounded px-2 py-0.5 font-medium text-red-700 hover:bg-red-100"
              >
                Retry
              </button>
            </div>
          )}

          {!loadError && matches.length === 0 && (
            <div className="px-3 py-3 text-center text-xs text-stone-500">
              {loading ? "Loading…"
                : query
                  ? <>No stones matching "<span className="font-mono">{query}</span>"</>
                  : "No stones available"}
            </div>
          )}

          {matches.map((s, idx) => {
            const isActive = idx === highlight;
            const total = s.priceTotal != null
              ? s.priceTotal
              : (s.pricePerCt != null && s.weightCt != null ? s.pricePerCt * s.weightCt : null);
            return (
              <button
                type="button"
                key={s.sku}
                data-idx={idx}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => handlePick(s)}
                className={`flex w-full items-center gap-3 border-b border-stone-100 px-3 py-2 text-left text-xs last:border-b-0 ${
                  isActive ? "bg-emerald-50" : "hover:bg-emerald-50"
                }`}
              >
                {s.imageUrl || s.image ? (
                  <img
                    src={s.imageUrl || s.image}
                    alt=""
                    className="h-10 w-10 flex-none rounded object-cover"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                ) : (
                  <div className="h-10 w-10 flex-none rounded bg-stone-100" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-mono font-semibold text-stone-900">{s.sku}</div>
                  <div className="truncate text-stone-500">
                    {[
                      s.shape,
                      s.weightCt ? `${s.weightCt}ct` : null,
                      s.color,
                      s.clarity,
                      s.lab && s.lab !== "N/A" ? s.lab : null,
                      s.measurements,
                    ].filter(Boolean).join(" · ") || s.category || "—"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-stone-700">{fmtPrice(total)}</div>
                  {s.location && <div className="text-[10px] text-stone-400">{s.location}</div>}
                  {s.stones != null && Number(s.stones) > 1 && (
                    <div className="text-[10px] text-emerald-600">parcel · {s.stones}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StonesPanel;
