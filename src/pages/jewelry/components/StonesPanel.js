import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { addJewelryStone, removeJewelryStone, recalcJewelryItem } from "../../../services/jewelryApi";
import { STONE_STATUS_LABELS, STONE_STATUS_PILL } from "../../../services/stonesApi";

const API_BASE = process.env.REACT_APP_API_URL || "https://gems-dna-be.onrender.com";

const ROLE_OPTIONS = [
  { value: "center", label: "Center" },
  { value: "side", label: "Side" },
  { value: "accent", label: "Accent" },
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

const StonesPanel = ({ itemId, stones, onChanged }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    stoneSku: "",
    role: "center",
    quantity: 1,
    snapshotPrice: "",
    snapshotShape: "",
    snapshotWeight: "",
    notes: "",
    consumeFromInventory: true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const handleAdd = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const snapshot = {};
      if (form.snapshotPrice) snapshot.price = Number(form.snapshotPrice);
      if (form.snapshotShape) snapshot.shape = form.snapshotShape;
      if (form.snapshotWeight) snapshot.weight = Number(form.snapshotWeight);
      await addJewelryStone(itemId, {
        stoneSku: form.stoneSku || null,
        role: form.role,
        quantity: Number(form.quantity || 1),
        snapshot: Object.keys(snapshot).length ? snapshot : null,
        notes: form.notes || null,
        consumeFromInventory: !!form.consumeFromInventory,
      });
      await recalcJewelryItem(itemId);
      setForm({
        stoneSku: "",
        role: "center",
        quantity: 1,
        snapshotPrice: "",
        snapshotShape: "",
        snapshotWeight: "",
        notes: "",
        consumeFromInventory: true,
      });
      setShowAdd(false);
      onChanged && (await onChanged());
    } catch (error) {
      setErr(error.message || "Failed to add stone");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (s) => {
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
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-stone-900">Stones in this piece</h2>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
          >
            + Add stone
          </button>
        )}
      </div>

      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="mb-4 grid gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3 sm:grid-cols-3"
        >
          <div className="sm:col-span-3">
            <StoneAutocomplete
              value={form.stoneSku}
              onPick={(stone) => {
                // Field names match the /api/soap-stones response shape
                // (weightCt + priceTotal/pricePerCt, not weight/bruto_price).
                const w = stone?.weightCt ?? stone?.weight;
                const total = stone?.priceTotal;
                const perCt = stone?.pricePerCt;
                const price = total != null
                  ? total
                  : (perCt != null && w != null ? perCt * w : null);
                setForm((f) => ({
                  ...f,
                  stoneSku: stone?.sku || "",
                  snapshotShape: stone?.shape || f.snapshotShape,
                  snapshotWeight: w != null ? w : f.snapshotWeight,
                  snapshotPrice: price != null ? price : f.snapshotPrice,
                }));
              }}
              onClear={() => setForm((f) => ({ ...f, stoneSku: "" }))}
            />
          </div>

          <Select label="Role" value={form.role} options={ROLE_OPTIONS} onChange={(v) => setForm({ ...form, role: v })} />
          <Input label="Qty" type="number" value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} />
          <Input label="Shape" value={form.snapshotShape} onChange={(v) => setForm({ ...form, snapshotShape: v })} placeholder="Emerald" />
          <Input label="Weight (ct)" type="number" step="0.01" value={form.snapshotWeight} onChange={(v) => setForm({ ...form, snapshotWeight: v })} />
          <Input label="Price ($)" type="number" step="0.01" value={form.snapshotPrice} onChange={(v) => setForm({ ...form, snapshotPrice: v })} />
          <Input label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />

          <label className="sm:col-span-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <input
              type="checkbox"
              checked={form.consumeFromInventory}
              onChange={(e) => setForm({ ...form, consumeFromInventory: e.target.checked })}
              className="h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
            />
            <span>
              <strong>Consume from inventory</strong> &nbsp;
              <span className="text-amber-800">
                — reserve the stone now and mark it sold when this piece sells. Uncheck for snapshot-only (e.g. customer-supplied stone).
              </span>
            </span>
          </label>

          {err && (
            <div className="sm:col-span-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {err}
            </div>
          )}

          <div className="sm:col-span-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAdd(false);
                setErr(null);
              }}
              disabled={busy}
              className="rounded-lg px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? "Adding…" : "Add stone"}
            </button>
          </div>
        </form>
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
                <th className="py-2 pr-3">Shape</th>
                <th className="py-2 pr-3">Weight</th>
                <th className="py-2 pr-3">Price</th>
                <th className="py-2 pr-3">Notes</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {stones.map((s) => {
                const status = s.consume_from_inventory ? s.inventory_status || "reserved" : null;
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
                    <td className="py-2 pr-3">{s.quantity}</td>
                    <td className="py-2 pr-3">{s.snapshot?.shape || "—"}</td>
                    <td className="py-2 pr-3">{s.snapshot?.weight ? `${s.snapshot.weight}ct` : "—"}</td>
                    <td className="py-2 pr-3">{fmtPrice(s.snapshot?.price)}</td>
                    <td className="py-2 pr-3 text-stone-500">{s.notes || ""}</td>
                    <td className="py-2 text-right">
                      <button onClick={() => handleRemove(s)} className="text-xs text-red-600 hover:underline">
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

/* ----- Stone autocomplete (queries soap_stones once, filters in-memory) -----
 *
 * UX:
 *   - Always opens on focus, even with no query — shows the most recent
 *     stones so user can browse.
 *   - Live filter on every keystroke against sku/shape/color/clarity/lab.
 *   - Keyboard nav: ArrowDown/Up to highlight, Enter/Tab to pick, Esc closes.
 *   - Loading + error states are visible (instead of silent empty dropdown
 *     which made it look like the field was broken).
 *   - "No matches" state explicitly says so + offers a retry on errors.
 *
 * Field names map to the /api/soap-stones response shape: weightCt,
 * priceTotal, pricePerCt — NOT weight/bruto_price/net_price.
 */
const StoneAutocomplete = ({ value, onPick, onClear }) => {
  const [stones, setStones] = useState([]);
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [highlight, setHighlight] = useState(0);
  const wrap = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

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
        const fields = [s.sku, s.shape, s.color, s.clarity, s.category, s.lab, s.location]
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
    setQuery(s.sku);
    setOpen(false);
    onPick && onPick(s);
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
    } else if (e.key === "Tab" && matches[highlight] && open) {
      // Tab also picks the highlighted match — convenient when typing exact SKU
      handlePick(matches[highlight]);
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
      <label className="mb-1 block text-xs font-medium text-stone-700">
        Stone SKU{" "}
        {loading && <span className="text-stone-400">(loading inventory…)</span>}
        {!loading && !loadError && stones.length > 0 && (
          <span className="text-stone-400">({stones.length} in stock)</span>
        )}
      </label>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={loading ? "Loading inventory…" : "Search SKU, shape, color…"}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value) onClear && onClear();
          }}
          className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              onClear && onClear();
              inputRef.current?.focus();
            }}
            className="rounded-lg px-2 py-1 text-xs text-stone-500 hover:bg-stone-100"
          >
            Clear
          </button>
        )}
      </div>

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
                    ].filter(Boolean).join(" · ") || s.category || "—"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-stone-700">{fmtPrice(total)}</div>
                  {s.location && <div className="text-[10px] text-stone-400">{s.location}</div>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Input = ({ label, value, onChange, type = "text", step, placeholder }) => (
  <div>
    <label className="mb-1 block text-xs font-medium text-stone-700">{label}</label>
    <input
      type={type}
      step={step}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
    />
  </div>
);

const Select = ({ label, value, onChange, options }) => (
  <div>
    <label className="mb-1 block text-xs font-medium text-stone-700">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </div>
);

export default StonesPanel;
