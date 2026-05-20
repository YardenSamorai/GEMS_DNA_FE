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
import { fetchJewelryItems, fetchJewelryCatalog } from "../../services/jewelryApi";
import { fetchCompanies } from "../../services/companiesApi";
import { decryptPrice } from "../../utils/decrypt";

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
  // When the supplier launches the picker from a typed chip ("Add
  // jewelry") we open it on the right tab so they don't waste a click
  // hunting for it. Stored alongside the boolean so we keep the trigger
  // explicit and easy to follow.
  const [pickerInitialTab, setPickerInitialTab] = useState("stones");
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

  const onBulkRemoveItems = async (payload) => {
    if (!activeId || !payload?.length) return;
    try {
      const r = await removeItemsFromTier(user.id, activeId, payload);
      toast.success(`Removed ${r.removed ?? payload.length} item${(r.removed ?? payload.length) === 1 ? "" : "s"}`);
      await reloadDetail();
      await reloadTiers();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const openPickerWithTab = (tab) => {
    setPickerInitialTab(tab === "jewelry" ? "jewelry" : "stones");
    setPickingItems(true);
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
                    <div className="mt-1 ml-5">
                      <TierScopeBadge stones={Number(t.stone_count) || 0} jewelry={Number(t.jewelry_count) || 0} />
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
                          <TierScopeBadge
                            stones={Number(detail.stone_count) || (detail.items || []).filter((it) => it.item_type === "stone").length}
                            jewelry={Number(detail.jewelry_count) || (detail.items || []).filter((it) => it.item_type === "jewelry").length}
                          />
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
                      onAdd={() => openPickerWithTab("stones")}
                      onAddTyped={openPickerWithTab}
                      onRemove={onRemoveItem}
                      onBulkRemove={onBulkRemoveItems}
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
          initialTab={pickerInitialTab}
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
        className="btn-primary mt-5"
      >
        Create first tier
      </button>
    </div>
  );
}

const ITEMS_PAGE_SIZE = 100;

function ItemsTab({ items, onAdd, onRemove, onBulkRemove, defaultPickerTab = "stones", onAddTyped }) {
  // Local UI state — type filter ("all" | "stone" | "jewelry"), free-text
  // search, and a bulk-select mode so the supplier can clear out tens of
  // SKUs at once. None of this persists across tier switches (the parent
  // remounts the tab when activeId changes).
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  // Stone advanced filters
  const [weightMin, setWeightMin] = useState("");
  const [weightMax, setWeightMax] = useState("");
  const [colorsF, setColorsF] = useState([]);
  const [claritiesF, setClaritiesF] = useState([]);
  const [labsF, setLabsF] = useState([]);
  const [shapesF, setShapesF] = useState([]);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [ppcMin, setPpcMin] = useState("");
  const [ppcMax, setPpcMax] = useState("");

  // Jewelry advanced filters
  const [sourcesF, setSourcesF] = useState(["workshop", "catalog"]);
  const [categoriesF, setCategoriesF] = useState([]);
  const [metalsF, setMetalsF] = useState([]);

  // Reset selection whenever the underlying item list changes (e.g.
  // after a tier switch or a successful remove). Without this the
  // checked state would stay associated with stale rows.
  useEffect(() => {
    setSelected(new Set());
    setPage(1);
  }, [items]);

  const counts = useMemo(() => {
    let stones = 0;
    let jewelry = 0;
    for (const it of items) {
      if (it.item_type === "stone") stones += 1;
      else if (it.item_type === "jewelry") jewelry += 1;
    }
    return { all: items.length, stones, jewelry };
  }, [items]);

  // Build dropdown options from the actual items in this tier — only
  // show values that exist so the dropdowns never offer dead filters.
  const stoneOptions = useMemo(() => {
    const colors = new Set();
    const clarities = new Set();
    const labs = new Set();
    const shapes = new Set();
    for (const it of items) {
      if (it.item_type !== "stone") continue;
      if (it.stone_color) colors.add(it.stone_color);
      if (it.stone_clarity) clarities.add(it.stone_clarity);
      if (it.stone_lab) labs.add(it.stone_lab);
      if (it.stone_shape) shapes.add(it.stone_shape);
    }
    const sort = (xs) => Array.from(xs).sort((a, b) => a.localeCompare(b));
    return { colors: sort(colors), clarities: sort(clarities), labs: sort(labs), shapes: sort(shapes) };
  }, [items]);

  const jewelryOptions = useMemo(() => {
    const categories = new Set();
    const metals = new Set();
    for (const it of items) {
      if (it.item_type !== "jewelry") continue;
      if (it.jewelry_category) categories.add(it.jewelry_category);
      if (it.jewelry_metal) metals.add(it.jewelry_metal);
    }
    const sort = (xs) => Array.from(xs).sort((a, b) => a.localeCompare(b));
    return { categories: sort(categories), metals: sort(metals) };
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const wmin = parseFloat(weightMin); const wmax = parseFloat(weightMax);
    const pmin = parseFloat(priceMin);  const pmax = parseFloat(priceMax);
    const cmin = parseFloat(ppcMin);    const cmax = parseFloat(ppcMax);
    return items.filter((it) => {
      if (typeFilter !== "all" && it.item_type !== typeFilter) return false;
      if (it.item_type === "stone") {
        if (colorsF.length && !colorsF.includes(it.stone_color)) return false;
        if (claritiesF.length && !claritiesF.includes(it.stone_clarity)) return false;
        if (labsF.length && !labsF.includes(it.stone_lab)) return false;
        if (shapesF.length && !shapesF.includes(it.stone_shape)) return false;
        const w = it.stone_weight != null ? Number(it.stone_weight) : null;
        if (!Number.isNaN(wmin) && (w == null || w < wmin)) return false;
        if (!Number.isNaN(wmax) && (w == null || w > wmax)) return false;
        const tp = it.stone_total_price != null ? Number(it.stone_total_price) : null;
        if (!Number.isNaN(pmin) && (tp == null || tp < pmin)) return false;
        if (!Number.isNaN(pmax) && (tp == null || tp > pmax)) return false;
        const ppc = it.stone_price_per_carat != null ? Number(it.stone_price_per_carat) : null;
        if (!Number.isNaN(cmin) && (ppc == null || ppc < cmin)) return false;
        if (!Number.isNaN(cmax) && (ppc == null || ppc > cmax)) return false;
      } else if (it.item_type === "jewelry") {
        if (sourcesF.length && it.jewelry_source && !sourcesF.includes(it.jewelry_source)) return false;
        if (categoriesF.length && !categoriesF.includes(it.jewelry_category)) return false;
        if (metalsF.length && !metalsF.includes(it.jewelry_metal)) return false;
      }
      if (!q) return true;
      const hay = [it.item_sku, it.title, it.subtitle, it.stone_shape, it.category,
                   it.stone_color, it.stone_clarity, it.stone_lab, it.jewelry_metal, it.jewelry_category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [
    items, typeFilter, search,
    colorsF, claritiesF, labsF, shapesF,
    weightMin, weightMax, priceMin, priceMax, ppcMin, ppcMax,
    sourcesF, categoriesF, metalsF,
  ]);

  // Clamp page when filter results shrink. Without this you can stay on
  // p20 of "All" and then switch to "Jewelry" which only has 1 page.
  useEffect(() => {
    setPage(1);
  }, [typeFilter, search, colorsF, claritiesF, labsF, shapesF,
      weightMin, weightMax, priceMin, priceMax, ppcMin, ppcMax,
      sourcesF, categoriesF, metalsF]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PAGE_SIZE));
  const pageStart = (page - 1) * ITEMS_PAGE_SIZE;
  const pageEnd = Math.min(filtered.length, pageStart + ITEMS_PAGE_SIZE);
  const paginated = filtered.slice(pageStart, pageEnd);

  const resetAdvancedFilters = () => {
    if (typeFilter === "jewelry") {
      setCategoriesF([]); setMetalsF([]);
      setSourcesF(["workshop", "catalog"]);
    } else {
      setColorsF([]); setClaritiesF([]); setLabsF([]); setShapesF([]);
      setWeightMin(""); setWeightMax("");
      setPriceMin(""); setPriceMax("");
      setPpcMin(""); setPpcMax("");
      if (typeFilter === "all") {
        setCategoriesF([]); setMetalsF([]);
        setSourcesF(["workshop", "catalog"]);
      }
    }
  };

  const advancedActiveCount =
    (colorsF.length > 0) + (claritiesF.length > 0) + (labsF.length > 0) + (shapesF.length > 0)
    + (weightMin ? 1 : 0) + (weightMax ? 1 : 0)
    + (priceMin ? 1 : 0) + (priceMax ? 1 : 0)
    + (ppcMin ? 1 : 0) + (ppcMax ? 1 : 0)
    + (categoriesF.length > 0) + (metalsF.length > 0)
    + (sourcesF.length !== 2 ? 1 : 0);

  const toggleOne = (it) => {
    const k = `${it.item_type}::${it.item_sku}`;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };
  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allOnPage = paginated.every((it) => next.has(`${it.item_type}::${it.item_sku}`));
      if (allOnPage) {
        for (const it of paginated) next.delete(`${it.item_type}::${it.item_sku}`);
      } else {
        for (const it of paginated) next.add(`${it.item_type}::${it.item_sku}`);
      }
      return next;
    });
  };
  const exitSelectMode = () => { setSelectMode(false); setSelected(new Set()); };
  const performBulkRemove = async () => {
    if (!selected.size) return;
    const payload = Array.from(selected).map((k) => {
      const [type, sku] = k.split("::");
      return { type, sku };
    });
    if (!window.confirm(`Remove ${payload.length} item${payload.length === 1 ? "" : "s"} from this tier?\n\nThe items themselves stay in inventory — only their visibility to subscribed stores changes.`)) return;
    await onBulkRemove?.(payload);
    exitSelectMode();
  };

  // Show a one-line "scope" summary so the supplier knows at a glance
  // what a store will see when subscribed to this tier.
  const scopeSummary = (() => {
    if (counts.all === 0) return "No items yet — stores in this tier won't see anything.";
    if (counts.jewelry === 0) return `Stones-only tier · ${counts.stones.toLocaleString("en-US")} stone${counts.stones === 1 ? "" : "s"} visible.`;
    if (counts.stones === 0)  return `Jewelry-only tier · ${counts.jewelry.toLocaleString("en-US")} piece${counts.jewelry === 1 ? "" : "s"} visible.`;
    return `Mixed tier · ${counts.stones.toLocaleString("en-US")} stones · ${counts.jewelry.toLocaleString("en-US")} jewelry visible.`;
  })();

  return (
    <div className="p-5 space-y-4">
      {/* Header row with type chips + actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <FilterChip
            label="All"
            count={counts.all}
            active={typeFilter === "all"}
            onClick={() => setTypeFilter("all")}
          />
          <FilterChip
            label="Stones"
            count={counts.stones}
            active={typeFilter === "stone"}
            onClick={() => setTypeFilter("stone")}
            accent="sky"
          />
          <FilterChip
            label="Jewelry"
            count={counts.jewelry}
            active={typeFilter === "jewelry"}
            onClick={() => setTypeFilter("jewelry")}
            accent="purple"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {items.length > 0 && (
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-semibold transition ${
                showFilters
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 8h12M9 12h6M11 16h2" />
              </svg>
              Filters
              {advancedActiveCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
                  {advancedActiveCount}
                </span>
              )}
            </button>
          )}
          {selectMode ? (
            <>
              <span className="text-xs text-slate-500 mr-1">{selected.size} selected</span>
              <button
                onClick={performBulkRemove}
                disabled={!selected.size}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold disabled:opacity-50"
              >
                Remove selected
              </button>
              <button
                onClick={exitSelectMode}
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              {items.length > 0 && (
                <button
                  onClick={() => setSelectMode(true)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium"
                >
                  Select
                </button>
              )}
              <button
                onClick={() => {
                  // Route to the picker on whichever tab matches the
                  // current chip — "Add jewelry" opens on Jewelry, "Add
                  // stones" on Stones, "All" defaults to whatever the
                  // parent prefers (currently stones).
                  const target = typeFilter === "jewelry"
                    ? "jewelry"
                    : typeFilter === "stone"
                      ? "stones"
                      : defaultPickerTab;
                  if (typeof onAddTyped === "function") {
                    onAddTyped(target);
                  } else {
                    onAdd?.();
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold"
              >
                + Add {typeFilter === "jewelry" ? "jewelry" : typeFilter === "stone" ? "stones" : "items"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Scope summary + search */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-slate-500">{scopeSummary}</div>
        {items.length > 0 && (
          <div className="relative w-full sm:w-72">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SKU, shape, name…"
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-sm"
            />
            <svg className="absolute left-2.5 top-2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
          </div>
        )}
      </div>

      {/* Body — optional filter rail on the left, grid on the right */}
      {items.length === 0 ? (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
          Click <strong>Add items</strong> to populate this tier with stones and/or jewelry.
        </div>
      ) : (
        <div className={`grid gap-4 ${showFilters ? "md:grid-cols-[260px_1fr]" : "grid-cols-1"}`}>
          {showFilters && (
            <aside className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4 self-start sticky top-4 max-h-[calc(100vh-4rem)] overflow-y-auto">
              <div className="text-[11px] uppercase tracking-wider font-bold text-slate-500">Refine in-tier view</div>
              {typeFilter !== "jewelry" && counts.stones > 0 && (
                <StoneFiltersPanel
                  options={stoneOptions}
                  weightMin={weightMin} setWeightMin={setWeightMin}
                  weightMax={weightMax} setWeightMax={setWeightMax}
                  colors={colorsF} setColors={setColorsF}
                  clarities={claritiesF} setClarities={setClaritiesF}
                  labs={labsF} setLabs={setLabsF}
                  shapes={shapesF} setShapes={setShapesF}
                  priceMin={priceMin} setPriceMin={setPriceMin}
                  priceMax={priceMax} setPriceMax={setPriceMax}
                  ppcMin={ppcMin} setPpcMin={setPpcMin}
                  ppcMax={ppcMax} setPpcMax={setPpcMax}
                />
              )}
              {typeFilter !== "stone" && counts.jewelry > 0 && (
                <JewelryFiltersPanel
                  options={jewelryOptions}
                  workshopCount={items.filter((it) => it.item_type === "jewelry" && it.jewelry_source === "workshop").length}
                  catalogCount={items.filter((it) => it.item_type === "jewelry" && it.jewelry_source === "catalog").length}
                  jewelrySources={sourcesF} setJewelrySources={setSourcesF}
                  categories={categoriesF} setCategories={setCategoriesF}
                  metals={metalsF} setMetals={setMetalsF}
                />
              )}
              {advancedActiveCount > 0 && (
                <button
                  onClick={resetAdvancedFilters}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium"
                >
                  Clear filters
                </button>
              )}
            </aside>
          )}

          <div className="space-y-3 min-w-0">
            {selectMode && (
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                <label className="inline-flex items-center gap-2 cursor-pointer text-slate-600">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={paginated.length > 0 && paginated.every((it) => selected.has(`${it.item_type}::${it.item_sku}`))}
                    onChange={toggleAllVisible}
                  />
                  Select all {paginated.length} on this page
                </label>
                <span className="text-slate-400">Use Remove selected above to drop them.</span>
              </div>
            )}

            {filtered.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
                No items match the current filters.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {paginated.map((it) => {
                    const key = `${it.item_type}-${it.item_sku}`;
                    const sk = `${it.item_type}::${it.item_sku}`;
                    const isChecked = selected.has(sk);
                    const priceLine = it.item_type === "stone"
                      ? (it.stone_total_price
                          ? `$${Number(it.stone_total_price).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
                            + (it.stone_price_per_carat
                                ? ` · $${Number(it.stone_price_per_carat).toLocaleString("en-US", { maximumFractionDigits: 0 })}/ct`
                                : "")
                          : null)
                      : null;
                    return (
                      <div
                        key={key}
                        className={`border rounded-xl p-3 flex gap-3 transition group bg-white ${
                          isChecked
                            ? "border-emerald-400 ring-1 ring-emerald-200"
                            : "border-slate-200 hover:shadow-sm hover:border-slate-300"
                        } ${selectMode ? "cursor-pointer" : ""}`}
                        onClick={selectMode ? () => toggleOne(it) : undefined}
                      >
                        {selectMode && (
                          <div className={`w-5 h-5 mt-0.5 rounded-md border-2 flex-shrink-0 grid place-items-center ${
                            isChecked ? "border-emerald-500 bg-emerald-500" : "border-slate-300"
                          }`}>
                            {isChecked && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        )}
                        <div className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                          {it.image_url ? (
                            <img src={it.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full grid place-items-center text-slate-300 text-xs">No image</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold ${
                              it.item_type === "stone" ? "bg-sky-100 text-sky-700" : "bg-purple-100 text-purple-700"
                            }`}>
                              {it.item_type}
                            </span>
                            <span className="text-xs font-mono text-slate-500 truncate">{it.item_sku}</span>
                            {it.item_type === "jewelry" && it.jewelry_source === "catalog" && (
                              <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-purple-50 text-purple-700 font-bold">Catalog</span>
                            )}
                            {it.item_type === "jewelry" && it.jewelry_source === "workshop" && (
                              <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-amber-50 text-amber-700 font-bold">Workshop</span>
                            )}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-slate-800 truncate">
                            {it.title || it.item_sku}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {[it.subtitle, it.weight && `${it.weight}${it.item_type === "stone" ? "ct" : "g"}`].filter(Boolean).join(" · ")}
                          </div>
                          {priceLine && (
                            <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums truncate">{priceLine}</div>
                          )}
                        </div>
                        {!selectMode && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onRemove(it); }}
                            className="text-xs text-slate-400 hover:text-rose-600 self-start opacity-0 group-hover:opacity-100 transition"
                            title="Remove from this tier"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <Pagination
                  page={page}
                  totalPages={totalPages}
                  rangeStart={filtered.length === 0 ? 0 : pageStart + 1}
                  rangeEnd={pageEnd}
                  total={filtered.length}
                  onChange={setPage}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Page navigator with first / prev / numbered / next / last buttons.
 * The numbered list is compact (max 7 buttons) with ellipses for
 * long ranges, e.g. 1 … 4 5 [6] 7 8 … 25.
 */
function Pagination({ page, totalPages, rangeStart, rangeEnd, total, onChange }) {
  if (totalPages <= 1) return null;

  const buildList = (current, last) => {
    if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
    const pages = new Set([1, last, current, current - 1, current + 1]);
    if (current <= 4) [2, 3, 4, 5].forEach((p) => pages.add(p));
    if (current >= last - 3) [last - 4, last - 3, last - 2, last - 1].forEach((p) => pages.add(p));
    const sorted = Array.from(pages).filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
    const out = [];
    let prev = 0;
    for (const p of sorted) {
      if (p - prev > 1) out.push("…");
      out.push(p);
      prev = p;
    }
    return out;
  };

  const list = buildList(page, totalPages);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-3 pt-2">
      <div className="text-xs text-slate-500 tabular-nums">
        Showing <span className="font-semibold text-slate-700">{rangeStart.toLocaleString("en-US")}</span>
        {"–"}
        <span className="font-semibold text-slate-700">{rangeEnd.toLocaleString("en-US")}</span>
        {" of "}
        <span className="font-semibold text-slate-700">{total.toLocaleString("en-US")}</span>
        {" · "}
        <span>{ITEMS_PAGE_SIZE} per page</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(1)}
          disabled={!canPrev}
          className="px-2 py-1 rounded-md border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          « First
        </button>
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={!canPrev}
          className="px-2 py-1 rounded-md border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ‹ Prev
        </button>
        {list.map((p, i) => (
          p === "…" ? (
            <span key={`gap-${i}`} className="px-1 text-xs text-slate-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`min-w-[28px] px-2 py-1 rounded-md text-xs font-semibold transition ${
                p === page
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {p}
            </button>
          )
        ))}
        <button
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={!canNext}
          className="px-2 py-1 rounded-md border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next ›
        </button>
        <button
          onClick={() => onChange(totalPages)}
          disabled={!canNext}
          className="px-2 py-1 rounded-md border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Last »
        </button>
      </div>
    </div>
  );
}

/**
 * Compact scope pill that tells the supplier at a glance whether a tier
 * is jewelry-only, stones-only, or mixed — and roughly how big it is.
 * Rendered both in the sidebar (so users can scan their tiers and pick
 * the right one without opening it) and beside the tier title in the
 * detail header.
 */
function TierScopeBadge({ stones = 0, jewelry = 0 }) {
  if (stones === 0 && jewelry === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-semibold uppercase tracking-wider">
        Empty
      </span>
    );
  }
  if (jewelry === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-700 text-[10px] font-semibold uppercase tracking-wider">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
        Stones only
      </span>
    );
  }
  if (stones === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-semibold uppercase tracking-wider">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
        Jewelry only
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold uppercase tracking-wider">
      <span className="inline-flex items-center gap-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
        <span className="tabular-nums">{stones.toLocaleString("en-US")}</span>
      </span>
      <span className="text-slate-300">·</span>
      <span className="inline-flex items-center gap-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
        <span className="tabular-nums">{jewelry.toLocaleString("en-US")}</span>
      </span>
    </span>
  );
}

function FilterChip({ label, count, active, onClick, accent = "slate" }) {
  const palette = {
    slate:  { activeBg: "bg-slate-900",   activeText: "text-white",       idle: "text-slate-600 hover:bg-slate-100" },
    sky:    { activeBg: "bg-sky-500",     activeText: "text-white",       idle: "text-slate-600 hover:bg-sky-50" },
    purple: { activeBg: "bg-purple-500",  activeText: "text-white",       idle: "text-slate-600 hover:bg-purple-50" },
  }[accent] || { activeBg: "bg-slate-900", activeText: "text-white", idle: "text-slate-600 hover:bg-slate-100" };
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition border ${
        active
          ? `${palette.activeBg} ${palette.activeText} border-transparent shadow-sm`
          : `bg-white border-slate-200 ${palette.idle}`
      }`}
    >
      <span>{label}</span>
      <span className={`tabular-nums text-[11px] font-bold ${active ? "opacity-90" : "text-slate-400"}`}>
        {count.toLocaleString("en-US")}
      </span>
    </button>
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

/* ============================================================
   Inventory normalization

   The picker draws from three different shapes:
     - Stones from soap_stones (canonical pricing table)
     - Workshop jewelry from jewelry_items (per-tenant)
     - WooCommerce catalog jewelry from jewelry_products (shared)
   They all flow into a single "row" shape in this picker so the
   filter logic and the grid render don't have to branch every
   line. The original BE rows are kept under `__raw` for debug.
   ============================================================ */
const normalizeStoneRow = (row) => ({
  __kind: "stone",
  __source: "inventory",
  __raw: row,
  sku: row.sku,
  shape: row.shape || "",
  category: row.category || "",
  color: row.color || "",
  clarity: row.clarity || "",
  lab: row.lab || "",
  origin: row.origin || "",
  weight: row.weight != null ? Number(row.weight) : null,
  totalPrice: row.total_price != null ? Number(row.total_price) : null,
  pricePerCarat: row.price_per_carat != null ? Number(row.price_per_carat) : null,
  image: row.image || (row.additional_pictures || "").split(";").map(s => s.trim()).filter(Boolean)[0] || null,
});

const normalizeWorkshopJewelry = (row) => ({
  __kind: "jewelry",
  __source: "workshop",
  __raw: row,
  sku: row.sku,
  name: row.name || row.sku,
  category: row.category || "",
  type: row.type || "",
  metalType: row.metal_summary || "",
  weight: row.weight_grams != null ? Number(row.weight_grams) : null,
  image: row.cover_image_url || row.image_url || null,
});

const normalizeCatalogJewelry = (row) => {
  let price = 0;
  try { price = row.price ? Number(decryptPrice(row.price)) || 0 : 0; } catch (_) {}
  const firstImage = (row.all_pictures_link || "")
    .split(";").map(s => s.trim()).filter(Boolean)[0] || null;
  return {
    __kind: "jewelry",
    __source: "catalog",
    __raw: row,
    sku: row.model_number,
    name: row.title || row.model_number,
    category: row.jewelry_type || row.category || "",
    type: "",
    metalType: row.metal_type || "",
    weight: row.jewelry_weight != null ? Number(row.jewelry_weight) : null,
    totalPrice: price || null,
    image: firstImage,
  };
};

/* ============================================================
   Item picker — wider modal with a filter rail and a grid.

   For stones the supplier can dial in by weight range, colour /
   clarity / lab multi-selects, plus total-price and per-carat
   price ranges (matches what they'd filter on in the inventory
   page). For jewelry there's a source toggle (workshop /
   WooCommerce catalog / both) and category multi-select.
   ============================================================ */
function ItemPickerModal({ alreadyIn, onClose, onConfirm, initialTab = "stones" }) {
  const { user } = useUser();
  const [tab, setTab] = useState(initialTab === "jewelry" ? "jewelry" : "stones");
  const [stones, setStones] = useState([]);
  const [workshopJewelry, setWorkshopJewelry] = useState([]);
  const [catalogJewelry, setCatalogJewelry] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState(new Map());
  const [showFilters, setShowFilters] = useState(true);

  // Stone filters
  const [weightMin, setWeightMin] = useState("");
  const [weightMax, setWeightMax] = useState("");
  const [colors, setColors] = useState([]);
  const [clarities, setClarities] = useState([]);
  const [labs, setLabs] = useState([]);
  const [shapes, setShapes] = useState([]);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [ppcMin, setPpcMin] = useState("");
  const [ppcMax, setPpcMax] = useState("");

  // Jewelry filters
  const [jewelrySources, setJewelrySources] = useState(["workshop", "catalog"]);
  const [categories, setCategories] = useState([]);
  const [metals, setMetals] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Three parallel fetches. The WooCommerce catalog is global so
        // we don't pass userId — it returns one shared list for every
        // tenant. Jewelry items endpoint is tenant-scoped.
        const [stonesRes, workshopRes, catalogRes] = await Promise.all([
          fetchSoapStones(user, { assignedTo: "all" }),
          fetchJewelryItems(user.id).catch(() => ({ items: [] })),
          fetchJewelryCatalog().catch(() => ({ jewelry: [] })),
        ]);
        if (cancelled) return;
        const rawStones = Array.isArray(stonesRes?.stones) ? stonesRes.stones
          : Array.isArray(stonesRes) ? stonesRes : [];
        const rawWorkshop = Array.isArray(workshopRes?.items) ? workshopRes.items
          : Array.isArray(workshopRes) ? workshopRes : [];
        const rawCatalog = Array.isArray(catalogRes?.jewelry) ? catalogRes.jewelry
          : Array.isArray(catalogRes) ? catalogRes : [];
        setStones(rawStones.map(normalizeStoneRow).filter(r => r.sku));
        setWorkshopJewelry(rawWorkshop.map(normalizeWorkshopJewelry).filter(r => r.sku));
        setCatalogJewelry(rawCatalog.map(normalizeCatalogJewelry).filter(r => r.sku));
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

  // Build dropdown options dynamically from the actual inventory so we
  // never offer a value that would return zero matches.
  const stoneOptions = useMemo(() => {
    const colors = new Set();
    const clarities = new Set();
    const labs = new Set();
    const shapes = new Set();
    for (const s of stones) {
      if (s.color) colors.add(s.color);
      if (s.clarity) clarities.add(s.clarity);
      if (s.lab) labs.add(s.lab);
      if (s.shape) shapes.add(s.shape);
    }
    const sort = (xs) => Array.from(xs).sort((a, b) => a.localeCompare(b));
    return {
      colors:    sort(colors),
      clarities: sort(clarities),
      labs:      sort(labs),
      shapes:    sort(shapes),
    };
  }, [stones]);

  const jewelryOptions = useMemo(() => {
    const cats = new Set();
    const metals = new Set();
    for (const j of [...workshopJewelry, ...catalogJewelry]) {
      if (j.category) cats.add(j.category);
      if (j.metalType) metals.add(j.metalType);
    }
    const sort = (xs) => Array.from(xs).sort((a, b) => a.localeCompare(b));
    return { categories: sort(cats), metals: sort(metals) };
  }, [workshopJewelry, catalogJewelry]);

  // Filter pipeline
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const isStone = tab === "stones";
    const list = isStone
      ? stones
      : [
          ...(jewelrySources.includes("workshop") ? workshopJewelry : []),
          ...(jewelrySources.includes("catalog")  ? catalogJewelry  : []),
        ];

    const wmin = parseFloat(weightMin); const wmax = parseFloat(weightMax);
    const pmin = parseFloat(priceMin);  const pmax = parseFloat(priceMax);
    const cmin = parseFloat(ppcMin);    const cmax = parseFloat(ppcMax);

    return list.filter((row) => {
      const sku = row.sku;
      if (!sku) return false;
      if (alreadyIn.has(`${isStone ? "stone" : "jewelry"}::${sku}`)) return false;

      if (isStone) {
        if (colors.length && !colors.includes(row.color)) return false;
        if (clarities.length && !clarities.includes(row.clarity)) return false;
        if (labs.length && !labs.includes(row.lab)) return false;
        if (shapes.length && !shapes.includes(row.shape)) return false;
        if (!Number.isNaN(wmin) && (row.weight == null || row.weight < wmin)) return false;
        if (!Number.isNaN(wmax) && (row.weight == null || row.weight > wmax)) return false;
        if (!Number.isNaN(pmin) && (row.totalPrice == null || row.totalPrice < pmin)) return false;
        if (!Number.isNaN(pmax) && (row.totalPrice == null || row.totalPrice > pmax)) return false;
        if (!Number.isNaN(cmin) && (row.pricePerCarat == null || row.pricePerCarat < cmin)) return false;
        if (!Number.isNaN(cmax) && (row.pricePerCarat == null || row.pricePerCarat > cmax)) return false;
      } else {
        if (categories.length && !categories.includes(row.category)) return false;
        if (metals.length && !metals.includes(row.metalType)) return false;
      }

      if (!q) return true;
      const hay = [
        sku,
        row.shape, row.category, row.color, row.clarity, row.origin, row.lab,
        row.name, row.type, row.metalType,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [
    tab, stones, workshopJewelry, catalogJewelry, search, alreadyIn,
    colors, clarities, labs, shapes, weightMin, weightMax, priceMin, priceMax, ppcMin, ppcMax,
    jewelrySources, categories, metals,
  ]);

  const resetFilters = () => {
    if (tab === "stones") {
      setColors([]); setClarities([]); setLabs([]); setShapes([]);
      setWeightMin(""); setWeightMax("");
      setPriceMin(""); setPriceMax("");
      setPpcMin(""); setPpcMax("");
    } else {
      setCategories([]); setMetals([]);
      setJewelrySources(["workshop", "catalog"]);
    }
  };

  const activeFilterCount = tab === "stones"
    ? (colors.length > 0) + (clarities.length > 0) + (labs.length > 0) + (shapes.length > 0)
      + (weightMin ? 1 : 0) + (weightMax ? 1 : 0)
      + (priceMin ? 1 : 0) + (priceMax ? 1 : 0)
      + (ppcMin ? 1 : 0) + (ppcMax ? 1 : 0)
    : (categories.length > 0) + (metals.length > 0)
      + (jewelrySources.length !== 2 ? 1 : 0);

  const stonesCount = stones.length;
  const jewelryCount = workshopJewelry.length + catalogJewelry.length;

  // Cap rendering at 300 rows for huge inventories so scrolling stays
  // smooth — the supplier almost always narrows with filters first.
  const RENDER_CAP = 300;
  const visible = filtered.slice(0, RENDER_CAP);
  const overflowed = filtered.length - visible.length;

  const selectAllVisible = () => {
    setPicked((prev) => {
      const next = new Map(prev);
      const type = tab === "stones" ? "stone" : "jewelry";
      const allKeys = visible.map((r) => `${type}::${r.sku}`);
      const allIn = allKeys.every((k) => next.has(k));
      if (allIn) {
        allKeys.forEach((k) => next.delete(k));
      } else {
        allKeys.forEach((k) => next.set(k, { type, sku: k.split("::")[1] }));
      }
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[95dvh] sm:h-[90dvh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900">Add items to tier</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Pulling from your inventory — stones from the price book and jewelry from both workshop pieces and the catalog.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none p-2">✕</button>
        </div>

        {/* Type segmented control + search bar */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-100 space-y-3">
          <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100">
            {[
              { id: "stones",  label: "Stones",  count: stonesCount,  accent: "sky" },
              { id: "jewelry", label: "Jewelry", count: jewelryCount, accent: "purple" },
            ].map((t) => {
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`relative flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition ${
                    isActive
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${t.accent === "sky" ? "bg-sky-500" : "bg-purple-500"}`} />
                  <span>{t.label}</span>
                  <span className={`text-[11px] tabular-nums font-bold ${isActive ? "text-slate-500" : "text-slate-400"}`}>
                    {t.count.toLocaleString("en-US")}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tab === "stones" ? "Search SKU, shape, color, clarity, origin…" : "Search SKU, name, category, metal…"}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-sm"
              />
              <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
              </svg>
            </div>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border transition ${
                showFilters
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 8h12M9 12h6M11 16h2" />
              </svg>
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Body: filters rail (collapsible) + items grid */}
        <div className="flex-1 min-h-0 grid md:grid-cols-[280px_1fr] overflow-hidden">
          {showFilters && (
            <aside className="border-b md:border-b-0 md:border-r border-slate-100 overflow-y-auto p-4 space-y-4 max-h-[40vh] md:max-h-none">
              {tab === "stones" ? (
                <StoneFiltersPanel
                  options={stoneOptions}
                  weightMin={weightMin} setWeightMin={setWeightMin}
                  weightMax={weightMax} setWeightMax={setWeightMax}
                  colors={colors} setColors={setColors}
                  clarities={clarities} setClarities={setClarities}
                  labs={labs} setLabs={setLabs}
                  shapes={shapes} setShapes={setShapes}
                  priceMin={priceMin} setPriceMin={setPriceMin}
                  priceMax={priceMax} setPriceMax={setPriceMax}
                  ppcMin={ppcMin} setPpcMin={setPpcMin}
                  ppcMax={ppcMax} setPpcMax={setPpcMax}
                />
              ) : (
                <JewelryFiltersPanel
                  options={jewelryOptions}
                  workshopCount={workshopJewelry.length}
                  catalogCount={catalogJewelry.length}
                  jewelrySources={jewelrySources} setJewelrySources={setJewelrySources}
                  categories={categories} setCategories={setCategories}
                  metals={metals} setMetals={setMetals}
                />
              )}
              {activeFilterCount > 0 && (
                <button
                  onClick={resetFilters}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium"
                >
                  Clear all filters
                </button>
              )}
            </aside>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
            {loading ? (
              <div className="text-center text-slate-400 py-8">Loading inventory…</div>
            ) : filtered.length === 0 ? (
              <div className="text-center text-slate-400 py-8">
                {alreadyIn.size && activeFilterCount === 0 && !search
                  ? "All matching items are already in this tier."
                  : "No items match the current filters."}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3 text-xs text-slate-500">
                  <span>
                    Showing <span className="font-semibold text-slate-700">{visible.length.toLocaleString("en-US")}</span>
                    {overflowed > 0 && (
                      <> of {filtered.length.toLocaleString("en-US")} matches (narrow filters to see more)</>
                    )}
                  </span>
                  <button
                    onClick={selectAllVisible}
                    className="text-emerald-700 hover:text-emerald-800 font-semibold"
                  >
                    {visible.every((r) => picked.has(`${tab === "stones" ? "stone" : "jewelry"}::${r.sku}`))
                      ? "Unselect all visible"
                      : "Select all visible"}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                  {visible.map((row) => {
                    const isStone = tab === "stones";
                    const k = `${isStone ? "stone" : "jewelry"}::${row.sku}`;
                    const checked = picked.has(k);
                    const image = row.image;
                    const title = isStone ? (row.shape || row.sku) : (row.name || row.sku);
                    const subtitle = isStone
                      ? [row.weight && `${row.weight}ct`, row.color, row.clarity, row.lab].filter(Boolean).join(" · ")
                      : [row.category, row.metalType].filter(Boolean).join(" · ");
                    const priceLine = isStone
                      ? (row.totalPrice ? `$${row.totalPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })}` +
                          (row.pricePerCarat ? ` · $${row.pricePerCarat.toLocaleString("en-US", { maximumFractionDigits: 0 })}/ct` : "")
                        : null)
                      : (row.totalPrice ? `$${row.totalPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : null);
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => togglePick(isStone ? "stone" : "jewelry", row.sku)}
                        className={`flex items-center gap-3 p-2 rounded-lg border text-left transition ${
                          checked ? "border-emerald-400 bg-emerald-50" : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className="w-12 h-12 rounded-md bg-slate-100 overflow-hidden flex-shrink-0">
                          {image ? <img src={image} alt="" className="w-full h-full object-cover" /> : null}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono text-slate-500 truncate">{row.sku}</span>
                            {!isStone && row.__source === "catalog" && (
                              <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-purple-50 text-purple-700 font-bold">Catalog</span>
                            )}
                            {!isStone && row.__source === "workshop" && (
                              <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-amber-50 text-amber-700 font-bold">Workshop</span>
                            )}
                          </div>
                          <div className="text-sm font-semibold text-slate-800 truncate">{title}</div>
                          <div className="text-xs text-slate-500 truncate">{subtitle}</div>
                          {priceLine && (
                            <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums truncate">{priceLine}</div>
                          )}
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
              </>
            )}
          </div>
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

/* ───────────────────── Filter sub-components ───────────────────── */

function StoneFiltersPanel({
  options,
  weightMin, setWeightMin, weightMax, setWeightMax,
  colors, setColors, clarities, setClarities,
  labs, setLabs, shapes, setShapes,
  priceMin, setPriceMin, priceMax, setPriceMax,
  ppcMin, setPpcMin, ppcMax, setPpcMax,
}) {
  return (
    <>
      <FilterSection title="Weight (ct)">
        <RangeInputs
          min={weightMin} max={weightMax}
          onMin={setWeightMin} onMax={setWeightMax}
          step="0.01" placeholderMin="0" placeholderMax="∞"
        />
      </FilterSection>

      <FilterSection title="Shape">
        <MultiSelectChips options={options.shapes} value={shapes} onChange={setShapes} />
      </FilterSection>

      <FilterSection title="Color">
        <MultiSelectChips options={options.colors} value={colors} onChange={setColors} />
      </FilterSection>

      <FilterSection title="Clarity">
        <MultiSelectChips options={options.clarities} value={clarities} onChange={setClarities} />
      </FilterSection>

      <FilterSection title="Lab / Certificate">
        <MultiSelectChips options={options.labs} value={labs} onChange={setLabs} />
      </FilterSection>

      <FilterSection title="Total price ($)">
        <RangeInputs
          min={priceMin} max={priceMax}
          onMin={setPriceMin} onMax={setPriceMax}
          step="1" placeholderMin="0" placeholderMax="∞"
        />
      </FilterSection>

      <FilterSection title="Price per carat ($/ct)">
        <RangeInputs
          min={ppcMin} max={ppcMax}
          onMin={setPpcMin} onMax={setPpcMax}
          step="1" placeholderMin="0" placeholderMax="∞"
        />
      </FilterSection>
    </>
  );
}

function JewelryFiltersPanel({
  options, workshopCount, catalogCount,
  jewelrySources, setJewelrySources,
  categories, setCategories,
  metals, setMetals,
}) {
  const toggleSource = (s) => {
    setJewelrySources((prev) => {
      // Don't allow zero sources — clicking the only active one re-enables
      // the other, so the user is never left with an empty pool by accident.
      if (prev.includes(s)) {
        if (prev.length === 1) return ["workshop", "catalog"].filter((x) => x !== s);
        return prev.filter((x) => x !== s);
      }
      return [...prev, s];
    });
  };
  return (
    <>
      <FilterSection title="Source">
        <div className="space-y-1.5">
          <SourceRow
            id="workshop"
            label="Workshop pieces"
            sub={`${workshopCount.toLocaleString("en-US")} item${workshopCount === 1 ? "" : "s"} · custom orders / stock`}
            checked={jewelrySources.includes("workshop")}
            onChange={() => toggleSource("workshop")}
          />
          <SourceRow
            id="catalog"
            label="WooCommerce catalog"
            sub={`${catalogCount.toLocaleString("en-US")} item${catalogCount === 1 ? "" : "s"} · imported model numbers`}
            checked={jewelrySources.includes("catalog")}
            onChange={() => toggleSource("catalog")}
          />
        </div>
      </FilterSection>

      <FilterSection title="Category">
        <MultiSelectChips options={options.categories} value={categories} onChange={setCategories} />
      </FilterSection>

      <FilterSection title="Metal">
        <MultiSelectChips options={options.metals} value={metals} onChange={setMetals} />
      </FilterSection>
    </>
  );
}

function FilterSection({ title, children }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-1.5">{title}</div>
      {children}
    </div>
  );
}

function RangeInputs({ min, max, onMin, onMax, step = "1", placeholderMin = "Min", placeholderMax = "Max" }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={min}
        onChange={(e) => onMin(e.target.value)}
        placeholder={placeholderMin}
        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 focus:border-emerald-500 outline-none text-sm tabular-nums"
      />
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={max}
        onChange={(e) => onMax(e.target.value)}
        placeholder={placeholderMax}
        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 focus:border-emerald-500 outline-none text-sm tabular-nums"
      />
    </div>
  );
}

function MultiSelectChips({ options, value, onChange }) {
  if (!options || options.length === 0) {
    return <div className="text-xs text-slate-400 italic">No values in inventory.</div>;
  }
  const toggle = (v) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => {
        const isOn = value.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition ${
              isOn
                ? "bg-slate-900 border-slate-900 text-white"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function SourceRow({ id, label, sub, checked, onChange }) {
  return (
    <label
      htmlFor={`src-${id}`}
      className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition ${
        checked ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200 hover:bg-slate-50"
      }`}
    >
      <input
        id={`src-${id}`}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-0.5"
      />
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-800">{label}</div>
        <div className="text-[10.5px] text-slate-500 truncate">{sub}</div>
      </div>
    </label>
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
