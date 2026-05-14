import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import {
  fetchCatalogTiers,
  fetchItemTiers,
  setItemTiers,
} from "../../services/catalogTiersApi";

/**
 * ItemTierManager — drop-in widget for the supplier-side detail / edit
 * surface of any inventory item (stone or jewelry). It shows which
 * catalog tiers the item is currently in, and lets the supplier add /
 * remove the item from tiers inline.
 *
 * If the item is in zero tiers it shows a loud warning that no store
 * portal user can see this SKU. That's the single most common
 * confusion point with the curated-default model and we want it
 * impossible to miss.
 *
 * Props:
 *   - type: 'stone' | 'jewelry'
 *   - sku:  string (required)
 *   - compact: boolean — render as a single-line compact widget
 *
 * The component fetches its own data; pass a `key` if the parent
 * needs to force a refresh.
 */
export default function ItemTierManager({ type, sku, compact = false }) {
  const { user } = useUser();
  const [allTiers, setAllTiers] = useState([]);
  const [memberIds, setMemberIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const reload = useCallback(async () => {
    if (!user?.id || !sku || !type) return;
    setLoading(true);
    try {
      const [tiers, mine] = await Promise.all([
        fetchCatalogTiers(user.id),
        fetchItemTiers(user.id, type, sku),
      ]);
      setAllTiers(tiers || []);
      setMemberIds(new Set((mine || []).map((t) => t.id)));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id, type, sku]);

  useEffect(() => { reload(); }, [reload]);

  const toggleTier = async (tierId) => {
    if (saving) return;
    const next = memberIds.has(tierId)
      ? new Set([...memberIds].filter((id) => id !== tierId))
      : new Set([...memberIds, tierId]);
    setSaving(true);
    try {
      const updated = await setItemTiers(user.id, type, sku, Array.from(next));
      setMemberIds(new Set((updated || []).map((t) => t.id)));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const memberTiers = useMemo(
    () => allTiers.filter((t) => memberIds.has(t.id)),
    [allTiers, memberIds]
  );

  if (loading) {
    return (
      <div className={compact ? "text-xs text-stone-400" : "text-sm text-stone-500"}>
        Loading visibility…
      </div>
    );
  }

  if (!allTiers.length) {
    return (
      <div className={`rounded-xl border border-amber-200 bg-amber-50 ${compact ? "px-3 py-2" : "p-4"}`}>
        <div className={`font-semibold text-amber-900 ${compact ? "text-xs" : "text-sm"}`}>
          No catalog tiers exist yet
        </div>
        <div className="text-xs text-amber-800 mt-0.5">
          This item is not visible to any store.{" "}
          <Link to="/crm/catalog" className="font-bold underline hover:text-amber-700">
            Create your first tier
          </Link>
        </div>
      </div>
    );
  }

  const isHidden = memberIds.size === 0;

  /* ── Compact pill mode (e.g. inside a row) ── */
  if (compact && !editing) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {isHidden ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[11px] font-bold uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Hidden from stores
          </span>
        ) : (
          memberTiers.slice(0, 3).map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[11px] font-semibold"
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.color || "#94a3b8" }} />
              {t.name}
            </span>
          ))
        )}
        {memberTiers.length > 3 && (
          <span className="text-[11px] text-stone-500 font-medium">
            +{memberTiers.length - 3} more
          </span>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 underline-offset-2 hover:underline"
        >
          Edit
        </button>
      </div>
    );
  }

  /* ── Full editor ── */
  return (
    <div className={`rounded-xl border ${isHidden ? "border-rose-200 bg-rose-50/40" : "border-stone-200 bg-white"} ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm font-bold text-stone-900">Store visibility</div>
            {isHidden ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[11px] font-bold uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Hidden from all stores
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold uppercase tracking-wide">
                In {memberTiers.length} tier{memberTiers.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-stone-600">
            {isHidden
              ? "No store can see this item in the portal. Add it to at least one tier to make it visible."
              : "Stores subscribed to any tier below will see this item in their portal catalog."}
          </p>
        </div>
        {compact && editing && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs text-stone-500 hover:text-stone-800"
          >
            Done
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {allTiers.map((t) => {
          const on = memberIds.has(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggleTier(t.id)}
              disabled={saving}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition disabled:opacity-50 ${
                on
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800 hover:border-emerald-400"
                  : "bg-white border-stone-200 text-stone-600 hover:border-stone-300"
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: t.color || "#94a3b8" }} />
              {t.name}
              {on && (
                <svg className="w-3 h-3 -mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-end">
        <Link
          to="/crm/catalog"
          className="text-xs font-semibold text-stone-500 hover:text-stone-800"
        >
          Manage tiers →
        </Link>
      </div>
    </div>
  );
}
