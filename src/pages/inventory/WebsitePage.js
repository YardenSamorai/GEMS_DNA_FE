import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  addWebListings,
  downloadEtradeCsv,
  fetchWebListings,
  removeWebListings,
  syncWebListings,
} from "../../services/stonesApi";
import { useTeam } from "../../context/TeamContext";

const WARNINGS = {
  not_in_inventory: { label: "Not in inventory", tone: "red" },
  half_pair: { label: "Half pair", tone: "red" },
  memo_category: { label: "Memo category", tone: "amber" },
  no_image: { label: "No image", tone: "amber" },
  no_certificate: { label: "No certificate", tone: "amber" },
  no_video: { label: "No video", tone: "muted" },
};

const TONE = {
  red: "bg-red-50 text-red-700",
  amber: "bg-amber-50 text-amber-800",
  muted: "bg-app-canvas text-app-muted",
};

const ATTENTION = ["not_in_inventory", "half_pair", "memo_category", "no_image", "no_certificate"];

const PAGE = 100;

const money = (n) =>
  Number.isFinite(n) && n > 0 ? `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—";

const specLine = (it) =>
  [
    Number.isFinite(it.weightCt) ? `${it.weightCt.toFixed(2)} ct` : "",
    it.shape,
    it.color,
    it.clarity,
    it.lab,
  ]
    .filter(Boolean)
    .join(" · ");

const formatWhen = (iso) => {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

const parseSkus = (text) =>
  String(text || "")
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

const WebsitePage = () => {
  const team = useTeam();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [shown, setShown] = useState(PAGE);
  const [addText, setAddText] = useState("");
  const [busy, setBusy] = useState("");
  const [sync, setSync] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchWebListings();
      setItems(Array.isArray(data.items) ? data.items : []);
      setSync(data.sync || null);
    } catch (err) {
      setError(err.message || "Could not load the website list");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (team.ready && team.isAdmin) load();
  }, [team.ready, team.isAdmin, load]);

  const counts = useMemo(() => {
    const c = { all: items.length, attention: 0 };
    for (const it of items) {
      if (it.warnings.some((w) => ATTENTION.includes(w))) c.attention++;
      for (const w of it.warnings) c[w] = (c[w] || 0) + 1;
    }
    return c;
  }, [items]);

  const exportable = items.length - (counts.not_in_inventory || 0);
  const barakCount = items.filter((it) => it.source === "barak").length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (filter === "attention" && !it.warnings.some((w) => ATTENTION.includes(w))) return false;
      if (filter !== "all" && filter !== "attention" && !it.warnings.includes(filter)) return false;
      if (!q) return true;
      return [it.sku, it.category, it.shape, it.branch, it.pairSku]
        .map((v) => String(v ?? "").toLowerCase())
        .some((v) => v.includes(q));
    });
  }, [items, query, filter]);

  useEffect(() => setShown(PAGE), [query, filter]);

  const add = async () => {
    const skus = parseSkus(addText);
    if (!skus.length) return;
    setBusy("add");
    try {
      const { added = [], skus: accepted = [] } = await addWebListings(skus);
      const unknown = skus.filter((s) => !accepted.includes(s));
      const partners = added.filter((s) => !skus.includes(s));
      if (added.length) {
        toast.success(
          `Added ${added.length} stone${added.length === 1 ? "" : "s"}` +
            (partners.length ? ` (pair partner${partners.length === 1 ? "" : "s"} ${partners.join(", ")})` : "")
        );
      } else if (accepted.length) {
        toast("Already on the website");
      }
      if (unknown.length) toast.error(`Not in inventory: ${unknown.slice(0, 10).join(", ")}`);
      setAddText("");
      await load();
    } catch (err) {
      toast.error(err.message || "Could not add stones");
    } finally {
      setBusy("");
    }
  };

  const remove = async (sku) => {
    setBusy(sku);
    try {
      const { removed = [], managed = [] } = await removeWebListings([sku]);
      const partners = removed.filter((s) => s !== sku);
      if (removed.length) {
        toast.success(`Removed ${sku}${partners.length ? ` and its pair ${partners.join(", ")}` : ""}`);
      }
      if (managed.length) toast(`${managed.join(", ")} comes from Barak — take it off in Barak's eTrade`);
      setItems((prev) => prev.filter((it) => !removed.includes(it.sku)));
    } catch (err) {
      toast.error(err.message || "Could not remove");
    } finally {
      setBusy("");
    }
  };

  const syncNow = async () => {
    setBusy("sync");
    try {
      const r = await syncWebListings();
      if (r.success) {
        toast.success(
          `${r.fileName} · +${r.added?.length || 0} −${r.removed?.length || 0}`
        );
      } else {
        toast.error(r.message || "Sync failed", { duration: 8000 });
      }
      await load();
    } catch (err) {
      toast.error(err.message || "Sync failed");
    } finally {
      setBusy("");
    }
  };

  const download = async () => {
    setBusy("download");
    try {
      const { name, count } = await downloadEtradeCsv();
      toast.success(`${name} · ${count} stone${count === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(err.message || "Could not create the file");
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
        <p className="mt-2 text-[14px] text-app-muted">The website list is managed by workshop admins.</p>
      </div>
    );
  }

  const chips = [
    ["all", "All"],
    ["attention", "Needs attention"],
    ...Object.entries(WARNINGS).map(([k, v]) => [k, v.label]),
  ].filter(([k]) => k === "all" || counts[k]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-app-ink">Website</h1>
          <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-app-muted">
            Stones published on Eshed.com. The list follows Barak's eTrade file, checked every 3 hours.
            Stones you add here or from Inventory (select, then Actions) stay until you remove them.
            Pairs are always added and removed together.
          </p>
        </div>
        <button
          type="button"
          className="inv-btn inv-btn--primary"
          disabled={busy === "download" || exportable === 0}
          onClick={download}
        >
          {busy === "download" ? "Preparing…" : `Download eTrade CSV (${exportable})`}
        </button>
      </header>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-app-line bg-app-surface px-4 py-3">
        <p className="min-w-0 text-[13px] leading-relaxed text-app-muted">
          {sync ? (
            <>
              <span className={sync.success ? "font-semibold text-app-ink" : "font-semibold text-red-700"}>
                {sync.success ? "Synced with Barak" : "Last sync failed"}
              </span>{" "}
              · {formatWhen(sync.ranAt)}
              {sync.fileName ? ` · ${sync.fileName}` : ""}
              {sync.success && sync.stones != null ? ` · ${sync.stones} stones` : ""}
              {!sync.success && sync.message ? ` · ${sync.message}` : ""}
            </>
          ) : (
            "Not synced with Barak yet"
          )}
          <span className="ml-1">· {barakCount} from Barak, {items.length - barakCount} added in DNA</span>
        </p>
        <button
          type="button"
          className="inv-btn inv-btn--quiet"
          disabled={Boolean(busy) || loading}
          onClick={syncNow}
        >
          {busy === "sync" ? "Syncing…" : "Sync now"}
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-app-line bg-app-surface p-3">
        <input
          className="h-10 min-w-[240px] flex-1 rounded-xl border border-app-line bg-app-surface px-3 text-[14px] text-app-ink outline-none focus:border-emerald-500"
          placeholder="Add SKUs (paste one or many, separated by spaces or commas)"
          value={addText}
          onChange={(e) => setAddText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button
          type="button"
          className="inv-btn inv-btn--quiet"
          disabled={busy === "add" || !parseSkus(addText).length}
          onClick={add}
        >
          {busy === "add" ? "Adding…" : "Add to website"}
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {chips.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition ${
              filter === k
                ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                : "border-app-line text-app-muted hover:text-app-ink"
            }`}
          >
            {label} <span className="tabular-nums opacity-70">{counts[k] || 0}</span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className="h-10 min-w-[220px] flex-1 rounded-xl border border-app-line bg-app-surface px-3 text-[14px] text-app-ink outline-none focus:border-emerald-500"
          placeholder="Search SKU, category, branch"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="text-[12px] text-app-muted">
          {filtered.length} stone{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {loading ? (
        <p className="text-[14px] text-app-muted">Loading…</p>
      ) : error ? (
        <p className="text-[14px] text-red-600">{error}</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-app-line bg-app-surface px-5 py-10 text-center text-[14px] text-app-muted">
          {items.length
            ? "No matches."
            : "Nothing on the website list yet. Press Sync now to pull Barak's eTrade file, or add SKUs above."}
        </div>
      ) : (
        <>
          <ul className="divide-y divide-app-line overflow-hidden rounded-2xl border border-app-line bg-app-surface">
            {filtered.slice(0, shown).map((it) => (
              <li key={it.sku} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-app-canvas">
                  {it.image && !/\/$/.test(it.image) && (
                    <img src={it.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link
                      to={`/${encodeURIComponent(it.sku)}`}
                      className="text-[14px] font-semibold tracking-tight text-app-ink underline-offset-2 hover:underline"
                    >
                      {it.sku}
                    </Link>
                    {it.category && <span className="text-[12px] text-app-muted">{it.category}</span>}
                    {it.pairSku && <span className="text-[12px] text-app-muted">Pair: {it.pairSku}</span>}
                    {it.homePage && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                        {it.homePage}
                      </span>
                    )}
                    {it.warnings.map((w) => (
                      <span
                        key={w}
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE[WARNINGS[w]?.tone || "muted"]}`}
                      >
                        {WARNINGS[w]?.label || w}
                      </span>
                    ))}
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-app-muted">
                    {[specLine(it), it.branch].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="hidden shrink-0 text-right text-[13px] font-semibold tabular-nums text-app-ink sm:block">
                  {money(it.priceTotal)}
                </div>
                {it.source === "barak" ? (
                  <span
                    className="shrink-0 px-3 py-1.5 text-[12px] font-medium text-app-muted"
                    title="Listed in Barak's eTrade. Take it off there and it leaves at the next sync."
                  >
                    Barak
                  </span>
                ) : (
                  <button
                    type="button"
                    className="shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    disabled={Boolean(busy)}
                    onClick={() => remove(it.sku)}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          {filtered.length > shown && (
            <div className="mt-4 text-center">
              <button type="button" className="inv-btn inv-btn--quiet" onClick={() => setShown((n) => n + PAGE)}>
                Show more ({filtered.length - shown} left)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default WebsitePage;
