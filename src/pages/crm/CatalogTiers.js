import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  fetchCatalogTiers,
  fetchCatalogTier,
  createCatalogTier,
  updateCatalogTier,
  deleteCatalogTier,
  addItemsToTier,
  removeItemsFromTier,
  addCompaniesToTier,
  removeCompaniesFromTier,
} from "../../services/catalogTiersApi";
import { fetchSoapStones } from "../../services/stonesApi";
import { fetchJewelryItems } from "../../services/jewelryApi";
import { fetchCompanies } from "../../services/companiesApi";

/**
 * Catalog Tiers admin page.
 *
 * The supplier curates "tiers" — buckets of SKUs (stones / jewelry) that
 * a chosen subset of stores can see in the portal. Items in zero tiers
 * are invisible to every store. This is the surface where the supplier
 * controls "who sees what".
 *
 * Layout:
 *   ┌──────────── hero with stats ─────────────┐
 *   │ sidebar: tier list  │  detail: items + stores tabs │
 *   └────────────────────────────────────────────────────┘
 */
export default function CatalogTiers() {
  const { user } = useUser();
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingTier, setEditingTier] = useState(null);
  const [pickingItems, setPickingItems] = useState(false);
  const [pickingStores, setPickingStores] = useState(false);
  const [activeSubtab, setActiveSubtab] = useState("items");

  const reloadTiers = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const rows = await fetchCatalogTiers(user.id);
      setTiers(rows);
      if (rows.length && !activeId) setActiveId(rows[0].id);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id, activeId]);

  const reloadDetail = useCallback(async () => {
    if (!user?.id || !activeId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    try {
      const data = await fetchCatalogTier(user.id, activeId);
      setDetail(data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDetailLoading(false);
    }
  }, [user?.id, activeId]);

  useEffect(() => { reloadTiers(); /* eslint-disable-next-line */ }, [user?.id]);
  useEffect(() => { reloadDetail(); }, [reloadDetail]);

  const totalItems    = useMemo(() => tiers.reduce((acc, t) => acc + Number(t.item_count || 0), 0), [tiers]);
  const totalStones   = useMemo(() => tiers.reduce((acc, t) => acc + Number(t.stone_count || 0), 0), [tiers]);
  const totalJewelry  = useMemo(() => tiers.reduce((acc, t) => acc + Number(t.jewelry_count || 0), 0), [tiers]);
  const totalCompanies = useMemo(() => tiers.reduce((acc, t) => acc + Number(t.company_count || 0), 0), [tiers]);

  /* ─────── handlers ─────── */

  const onCreate = async (payload) => {
    try {
      const created = await createCatalogTier(user.id, payload);
      toast.success(`Tier "${created.name}" created`);
      setCreating(false);
      setActiveId(created.id);
      await reloadTiers();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const onSaveEdit = async (payload) => {
    if (!editingTier) return;
    try {
      const updated = await updateCatalogTier(user.id, editingTier.id, payload);
      toast.success("Tier updated");
      setEditingTier(null);
      setTiers((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      if (activeId === updated.id) await reloadDetail();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const onDelete = async (tier) => {
    if (!window.confirm(`Delete the "${tier.name}" tier?\n\nItems inside it won't be deleted, but stores that only saw items via this tier will lose access.`)) return;
    try {
      await deleteCatalogTier(user.id, tier.id);
      toast.success("Tier deleted");
      setTiers((prev) => prev.filter((t) => t.id !== tier.id));
      if (activeId === tier.id) setActiveId(null);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const onAddItems = async (items) => {
    if (!activeId || !items.length) return;
    try {
      const r = await addItemsToTier(user.id, activeId, items);
      toast.success(`Added ${r.added} item${r.added === 1 ? "" : "s"}`);
      setPickingItems(false);
      await reloadDetail();
      await reloadTiers();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const onRemoveItem = async (item) => {
    if (!activeId) return;
    try {
      await removeItemsFromTier(user.id, activeId, [{ type: item.item_type, sku: item.item_sku }]);
      await reloadDetail();
      await reloadTiers();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const onAddCompanies = async (companyIds) => {
    if (!activeId || !companyIds.length) return;
    try {
      const r = await addCompaniesToTier(user.id, activeId, companyIds);
      toast.success(`Added ${r.added} store${r.added === 1 ? "" : "s"}`);
      setPickingStores(false);
      await reloadDetail();
      await reloadTiers();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const onRemoveCompany = async (companyId) => {
    if (!activeId) return;
    try {
      await removeCompaniesFromTier(user.id, activeId, [companyId]);
      await reloadDetail();
      await reloadTiers();
    } catch (e) {
      toast.error(e.message);
    }
  };

  /* ─────── render ─────── */

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero strip */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 text-white">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(16,185,129,0.4), transparent 40%), radial-gradient(circle at 80% 30%, rgba(56,189,248,0.3), transparent 40%)",
        }} />
        <div className="relative max-w-7xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-emerald-300/80">Catalog control</div>
              <h1 className="mt-1 text-3xl font-bold">Store catalog tiers</h1>
              <p className="mt-2 text-sm text-slate-300 max-w-2xl">
                Curate which inventory each store sees. Group SKUs into tiers (Public, VIP, Bridal…), then subscribe stores to the tiers you want them to access. Items not in any tier stay private.
              </p>
            </div>
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold shadow-lg shadow-emerald-500/30 transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              New tier
            </button>
          </div>

          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCell label="Tiers"       value={tiers.length} />
            <KpiCell label="Items in catalog" value={totalItems} sub={`${totalStones} stones · ${totalJewelry} jewelry`} />
            <KpiCell label="Store ↔ tier links" value={totalCompanies} />
            <KpiCell
              label="Default for new stores"
              value={tiers.find((t) => t.is_default)?.name || "—"}
              sub={tiers.find((t) => t.is_default) ? "auto-applied" : "no default set"}
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-slate-500 text-sm">Loading tiers…</div>
        ) : tiers.length === 0 ? (
          <EmptyState onCreate={() => setCreating(true)} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
            {/* Sidebar */}
            <aside className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-2">All tiers</div>
              <div className="space-y-1">
                {tiers.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setActiveId(t.id); setActiveSubtab("items"); }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition ${
                      activeId === t.id
                        ? "border-emerald-300 bg-emerald-50/70 shadow-sm"
                        : "border-transparent hover:bg-white hover:border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: t.color || "#94a3b8" }}
                      />
                      <span className="font-semibold text-sm text-slate-800 truncate">{t.name}</span>
                      {t.is_default && (
                        <span className="ml-auto text-[10px] uppercase tracking-wider text-emerald-700 font-bold">Default</span>
                      )}
                    </div>
                    <div className="mt-1 ml-5 text-[11px] text-slate-500">
                      {Number(t.item_count) || 0} items · {Number(t.company_count) || 0} stores
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            {/* Detail panel */}
            <main>
              {!detail ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">
                  Select a tier to manage its items and stores.
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  {/* Header */}
                  <div className="px-6 pt-5 pb-4 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ background: detail.color || "#94a3b8" }}
                          />
                          <h2 className="text-xl font-bold text-slate-900">{detail.name}</h2>
                          {detail.is_default && (
                            <span className="text-[10px] uppercase tracking-wider bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded">
                              Default
                            </span>
                          )}
                        </div>
                        {detail.description && (
                          <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">{detail.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingTier(detail)}
                          className="text-sm text-slate-600 hover:text-slate-900 font-medium px-3 py-1.5 rounded-lg hover:bg-slate-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDelete(detail)}
                          className="text-sm text-rose-600 hover:text-rose-700 font-medium px-3 py-1.5 rounded-lg hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Sub-tabs */}
                    <div className="mt-5 flex gap-1 -mb-px">
                      {[
                        { id: "items",  label: `Items (${detail.items?.length || 0})` },
                        { id: "stores", label: `Stores (${detail.companies?.length || 0})` },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveSubtab(tab.id)}
                          className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
                            activeSubtab === tab.id
                              ? "border-emerald-500 text-emerald-700"
                              : "border-transparent text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Body */}
                  {detailLoading ? (
                    <div className="p-8 text-center text-slate-400">Loading…</div>
                  ) : activeSubtab === "items" ? (
                    <ItemsTab
                      items={detail.items || []}
                      onAdd={() => setPickingItems(true)}
                      onRemove={onRemoveItem}
                    />
                  ) : (
                    <StoresTab
                      companies={detail.companies || []}
                      onAdd={() => setPickingStores(true)}
                      onRemove={onRemoveCompany}
                    />
                  )}
                </div>
              )}
            </main>
          </div>
        )}
      </div>

      {/* Modals */}
      {creating && (
        <TierFormModal
          title="Create tier"
          onClose={() => setCreating(false)}
          onSubmit={onCreate}
        />
      )}
      {editingTier && (
        <TierFormModal
          title={`Edit "${editingTier.name}"`}
          initial={editingTier}
          onClose={() => setEditingTier(null)}
          onSubmit={onSaveEdit}
        />
      )}
      {pickingItems && detail && (
        <ItemPickerModal
          alreadyIn={new Set((detail.items || []).map((it) => `${it.item_type}::${it.item_sku}`))}
          onClose={() => setPickingItems(false)}
          onConfirm={onAddItems}
        />
      )}
      {pickingStores && detail && (
        <StorePickerModal
          alreadyIn={new Set((detail.companies || []).map((c) => c.id))}
          onClose={() => setPickingStores(false)}
          onConfirm={onAddCompanies}
        />
      )}
    </div>
  );
}

/* ───────────────────── components ───────────────────── */

function KpiCell({ label, value, sub }) {
  return (
    <div className="bg-white/10 backdrop-blur rounded-xl border border-white/10 px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-300/80">{label}</div>
      <div className="mt-1 text-2xl font-bold text-white truncate">{value}</div>
      {sub && <div className="text-[11px] text-slate-300/80 truncate">{sub}</div>}
    </div>
  );
}

function EmptyState({ onCreate }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
      <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 text-emerald-600 grid place-items-center">
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7h18M3 12h18M3 17h18" />
        </svg>
      </div>
      <h3 className="mt-4 text-lg font-bold text-slate-900">No tiers yet</h3>
      <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto">
        Catalog tiers control which stores see which items. Right now your stores see <strong>nothing</strong> in the portal — create your first tier (e.g. "Public") and add the items every store should see.
      </p>
      <button
        onClick={onCreate}
        className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm"
      >
        Create first tier
      </button>
    </div>
  );
}

function ItemsTab({ items, onAdd, onRemove }) {
  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-slate-500">
          {items.length === 0
            ? "No items in this tier yet — stores in this tier won't see anything."
            : `${items.length} item${items.length === 1 ? "" : "s"} visible to subscribed stores.`}
        </div>
        <button
          onClick={onAdd}
          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold"
        >
          + Add items
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
          Click <strong>Add items</strong> to populate this tier.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((it) => (
            <div key={`${it.item_type}-${it.item_sku}`} className="border border-slate-200 rounded-xl p-3 flex gap-3 hover:shadow-sm hover:border-slate-300 transition group bg-white">
              <div className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                {it.image_url ? (
                  <img src={it.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-slate-300 text-xs">No image</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold ${
                    it.item_type === "stone" ? "bg-sky-100 text-sky-700" : "bg-purple-100 text-purple-700"
                  }`}>
                    {it.item_type}
                  </span>
                  <span className="text-xs font-mono text-slate-500 truncate">{it.item_sku}</span>
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-800 truncate">
                  {it.title || it.item_sku}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {[it.subtitle, it.weight && `${it.weight}${it.item_type === "stone" ? "ct" : "g"}`].filter(Boolean).join(" · ")}
                </div>
              </div>
              <button
                onClick={() => onRemove(it)}
                className="text-xs text-slate-400 hover:text-rose-600 self-start opacity-0 group-hover:opacity-100 transition"
                title="Remove from this tier"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StoresTab({ companies, onAdd, onRemove }) {
  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-slate-500">
          {companies.length === 0
            ? "No stores subscribed yet — items in this tier are visible to nobody."
            : `${companies.length} store${companies.length === 1 ? "" : "s"} can see items in this tier.`}
        </div>
        <button
          onClick={onAdd}
          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold"
        >
          + Add stores
        </button>
      </div>

      {companies.length === 0 ? (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
          Click <strong>Add stores</strong> to choose which retail accounts get access to this tier.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white">
          {companies.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 group">
              <div className="w-10 h-10 rounded-lg bg-slate-100 grid place-items-center overflow-hidden flex-shrink-0">
                {c.logo_url ? <img src={c.logo_url} alt="" className="w-full h-full object-cover" /> : (
                  <span className="text-slate-400 text-sm font-bold">{(c.name || "?").slice(0,1).toUpperCase()}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <Link
                  to={`/crm/stores/${c.id}`}
                  className="text-sm font-semibold text-slate-800 hover:text-emerald-700 truncate block"
                >
                  {c.name}
                </Link>
                <div className="text-xs text-slate-500">
                  {[c.city, c.country].filter(Boolean).join(", ") || "—"}
                </div>
              </div>
              <button
                onClick={() => onRemove(c.id)}
                className="text-xs text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition"
                title="Remove from this tier"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────────────── Tier form modal ───────────────────── */

function TierFormModal({ title, initial, onClose, onSubmit }) {
  const [name, setName]               = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [color, setColor]             = useState(initial?.color || "#0ea5e9");
  const [isDefault, setIsDefault]     = useState(!!initial?.is_default);
  const [saving, setSaving]           = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), description: description.trim() || null, color, is_default: isDefault });
    } finally {
      setSaving(false);
    }
  };

  const SWATCHES = ["#0ea5e9","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#64748b","#0f172a"];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={submit}>
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">{title}</h3>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Public, VIP Bridal, Israel Exclusive"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-sm"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Internal note — what kind of stores or which collection?"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-sm resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Color</label>
              <div className="flex flex-wrap gap-2">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full transition ${color === c ? "ring-2 ring-offset-2 ring-slate-900 scale-110" : "hover:scale-105"}`}
                    style={{ background: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="mt-0.5" />
              <div className="text-xs text-slate-700">
                <strong>Default tier</strong> — pin this as the canonical "all stores see this" tier. (Doesn't auto-subscribe stores; just labels it.)
              </div>
            </label>
          </div>
          <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
              {saving ? "Saving…" : initial ? "Save" : "Create tier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ───────────────────── Item picker modal ───────────────────── */

function ItemPickerModal({ alreadyIn, onClose, onConfirm }) {
  const { user } = useUser();
  const [tab, setTab] = useState("stones");
  const [stones, setStones] = useState([]);
  const [jewelry, setJewelry] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState(new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [stonesRes, jewelryRes] = await Promise.all([
          fetchSoapStones(user, { assignedTo: "all" }),
          fetchJewelryItems(user.id),
        ]);
        if (cancelled) return;
        setStones(Array.isArray(stonesRes?.stones) ? stonesRes.stones : (Array.isArray(stonesRes) ? stonesRes : []));
        setJewelry(Array.isArray(jewelryRes?.items) ? jewelryRes.items : (Array.isArray(jewelryRes) ? jewelryRes : []));
      } catch (e) {
        toast.error(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const togglePick = (type, sku) => {
    const k = `${type}::${sku}`;
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(k)) next.delete(k); else next.set(k, { type, sku });
      return next;
    });
  };

  const confirm = () => {
    if (!picked.size) { toast.error("Select at least one item"); return; }
    onConfirm(Array.from(picked.values()));
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = tab === "stones" ? stones : jewelry;
    return list.filter((row) => {
      const sku = row.sku;
      if (!sku) return false;
      if (alreadyIn.has(`${tab === "stones" ? "stone" : "jewelry"}::${sku}`)) return false;
      if (!q) return true;
      const hay = [
        sku,
        row.shape, row.category, row.color, row.clarity, row.origin, row.lab,
        row.name, row.type, row.metal_summary,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [tab, stones, jewelry, search, alreadyIn]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Add items to tier</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="px-5 pt-4 pb-3 border-b border-slate-100 space-y-3">
          <div className="flex gap-1">
            {[
              { id: "stones",  label: `Stones (${stones.length})` },
              { id: "jewelry", label: `Jewelry (${jewelry.length})` },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                  tab === t.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SKU, shape, color, name…"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-emerald-500 outline-none text-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="text-center text-slate-400 py-8">Loading inventory…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-slate-400 py-8">
              {alreadyIn.size ? "All matching items are already in this tier." : "No matching items."}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filtered.map((row) => {
                const isStone = tab === "stones";
                const sku = row.sku;
                const k = `${isStone ? "stone" : "jewelry"}::${sku}`;
                const checked = picked.has(k);
                const image = isStone
                  ? (row.image || (row.additional_pictures || "").split(";")[0] || null)
                  : (row.cover_image_url || row.image_url || null);
                const title = isStone ? (row.shape || sku) : (row.name || sku);
                const subtitle = isStone
                  ? [row.weight && `${row.weight}ct`, row.color, row.clarity].filter(Boolean).join(" · ")
                  : [row.category, row.metal_summary].filter(Boolean).join(" · ");
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => togglePick(isStone ? "stone" : "jewelry", sku)}
                    className={`flex items-center gap-3 p-2 rounded-lg border text-left transition ${
                      checked ? "border-emerald-400 bg-emerald-50" : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="w-12 h-12 rounded-md bg-slate-100 overflow-hidden flex-shrink-0">
                      {image ? <img src={image} alt="" className="w-full h-full object-cover" /> : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono text-slate-500">{sku}</div>
                      <div className="text-sm font-semibold text-slate-800 truncate">{title}</div>
                      <div className="text-xs text-slate-500 truncate">{subtitle}</div>
                    </div>
                    <div className={`w-5 h-5 rounded-md border-2 flex-shrink-0 grid place-items-center ${
                      checked ? "border-emerald-500 bg-emerald-500" : "border-slate-300"
                    }`}>
                      {checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-2">
          <div className="text-xs text-slate-500">{picked.size} selected</div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={confirm} disabled={!picked.size} className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
              Add {picked.size || ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── Store picker modal ───────────────────── */

function StorePickerModal({ alreadyIn, onClose, onConfirm }) {
  const { user } = useUser();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await fetchCompanies(user.id);
        if (!cancelled) setCompanies(Array.isArray(rows) ? rows : []);
      } catch (e) {
        toast.error(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const togglePick = (id) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return companies.filter((c) => {
      if (alreadyIn.has(c.id)) return false;
      if (!q) return true;
      return [c.name, c.city, c.country].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [companies, search, alreadyIn]);

  const confirm = () => {
    if (!picked.size) { toast.error("Select at least one store"); return; }
    onConfirm(Array.from(picked));
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Add stores to tier</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <div className="px-5 pt-4 pb-3 border-b border-slate-100">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search store name, city…"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-emerald-500 outline-none text-sm"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="text-center text-slate-400 py-8">Loading stores…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-slate-400 py-8">
              {alreadyIn.size ? "All your stores are already in this tier." : "No matching stores."}
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((c) => {
                const checked = picked.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => togglePick(c.id)}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg border text-left transition ${
                      checked ? "border-emerald-400 bg-emerald-50" : "border-transparent hover:bg-slate-50"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-slate-100 grid place-items-center overflow-hidden flex-shrink-0">
                      {c.logo_url ? <img src={c.logo_url} alt="" className="w-full h-full object-cover" /> : (
                        <span className="text-slate-400 text-sm font-bold">{(c.name || "?").slice(0,1).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-800 truncate">{c.name}</div>
                      <div className="text-xs text-slate-500 truncate">{[c.city, c.country].filter(Boolean).join(", ") || "—"}</div>
                    </div>
                    <div className={`w-5 h-5 rounded-md border-2 flex-shrink-0 grid place-items-center ${
                      checked ? "border-emerald-500 bg-emerald-500" : "border-slate-300"
                    }`}>
                      {checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-2">
          <div className="text-xs text-slate-500">{picked.size} selected</div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={confirm} disabled={!picked.size} className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
              Add {picked.size || ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
