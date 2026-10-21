import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { fetchStoneOverrideList, patchStoneOverrides } from "../../services/stonesApi";
import { useTeam } from "../../context/TeamContext";

const fmt = (v) => {
  if (v == null || v === "") return "—";
  return String(v);
};

const when = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
};

const StoneOverridesPage = () => {
  const team = useTeam();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchStoneOverrideList();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setError(err.message || "Could not load manual edits");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (team.ready && team.isAdmin) load();
  }, [team.ready, team.isAdmin, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const hay = [it.sku, ...(it.changes || []).flatMap((c) => [c.label, c.value, c.original])]
        .map((v) => String(v ?? "").toLowerCase())
        .join(" ");
      return hay.includes(q);
    });
  }, [items, query]);

  const revert = async (sku, fields) => {
    const key = `${sku}:${Object.keys(fields).join(",")}`;
    setBusy(key);
    try {
      await patchStoneOverrides(sku, fields);
      toast.success(`Reverted ${sku}`);
      setItems((prev) =>
        prev
          .map((it) => {
            if (it.sku !== sku) return it;
            const nextFields = { ...it.fields };
            const nextChanges = (it.changes || []).filter((c) => !Object.prototype.hasOwnProperty.call(fields, c.key));
            for (const k of Object.keys(fields)) delete nextFields[k];
            return { ...it, fields: nextFields, changes: nextChanges };
          })
          .filter((it) => (it.changes || []).length > 0)
      );
    } catch (err) {
      toast.error(err.message || "Could not revert");
    } finally {
      setBusy("");
    }
  };

  if (team.loading) {
    return <div className="p-6 text-sm text-app-muted">Loading…</div>;
  }

  if (!team.isAdmin) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <h2 className="text-[22px] font-semibold tracking-tight text-app-ink">Admins only</h2>
        <p className="mt-2 text-[14px] text-app-muted">Manual catalog edits are visible to workshop admins.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="text-[26px] font-semibold tracking-tight text-app-ink">Manual edits</h1>
        <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-app-muted">
          Every spec an admin changed by hand. Revert sends the stone back to the Barak value
          immediately — you do not have to wait for the next sync.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className="h-10 min-w-[220px] flex-1 rounded-xl border border-app-line bg-app-surface px-3 text-[14px] text-app-ink outline-none focus:border-emerald-500"
          placeholder="Search SKU or field"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="text-[12px] text-app-muted">
          {filtered.length} stone{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {loading ? (
        <p className="text-[14px] text-app-muted">Loading edits…</p>
      ) : error ? (
        <p className="text-[14px] text-red-600">{error}</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-app-line bg-app-surface px-5 py-10 text-center text-[14px] text-app-muted">
          {items.length ? "No matches." : "No manual edits yet."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((it) => (
            <article key={it.sku} className="rounded-2xl border border-app-line bg-app-surface px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/${encodeURIComponent(it.sku)}`}
                      className="text-[16px] font-semibold tracking-tight text-app-ink underline-offset-2 hover:underline"
                    >
                      {it.sku}
                    </Link>
                    {!it.inCatalog && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                        Not in current catalog
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[12px] text-app-muted">{when(it.updatedAt)}</p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-app-line px-3 py-1.5 text-[12px] font-semibold text-app-ink hover:bg-app-canvas disabled:opacity-50"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    const fields = Object.fromEntries((it.changes || []).map((c) => [c.key, null]));
                    revert(it.sku, fields);
                  }}
                >
                  Revert all
                </button>
              </div>

              <ul className="mt-3 divide-y divide-app-line">
                {(it.changes || []).map((c) => (
                  <li key={c.key} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-app-muted">
                        {c.label}
                      </div>
                      <div className="mt-0.5 text-[14px] text-app-ink">
                        <span className="text-app-muted">{fmt(c.original)}</span>
                        <span className="mx-2 text-app-muted">→</span>
                        <span className="font-semibold">{fmt(c.value)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                      disabled={Boolean(busy)}
                      onClick={() => revert(it.sku, { [c.key]: null })}
                    >
                      Revert
                    </button>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default StoneOverridesPage;
