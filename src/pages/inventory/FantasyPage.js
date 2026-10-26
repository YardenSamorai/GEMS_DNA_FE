import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { fetchFantasyOverview, syncFantasy } from "../../services/stonesApi";
import { useTeam } from "../../context/TeamContext";

const KINDS = {
  missing: { label: "Missing in Fantasy", tone: "red", hint: "In Barak's inventory, no Fantasy lot with this name" },
  sold: { label: "Sold in Fantasy", tone: "red", hint: "Invoiced in Fantasy, still in Barak's inventory" },
  deleted: { label: "Deleted in Fantasy", tone: "red", hint: "Deleted in Fantasy, still in Barak's inventory" },
  weight: { label: "Weight differs", tone: "amber", hint: "Carats differ by more than 0.01" },
  price: { label: "Price differs", tone: "amber", hint: "Barak total price vs Fantasy total sale, more than 1% apart" },
  cost: { label: "Cost differs", tone: "muted", hint: "Barak cost × weight vs Fantasy total cost, more than 1% apart" },
  shared: { label: "Shared lot name", tone: "muted", hint: "Several live Fantasy lots carry this name; compared as their sum" },
  fantasy_only: { label: "Only in Fantasy", tone: "muted", hint: "Live in Fantasy, not in Barak's stone or jewelry feed" },
};

const TONE = {
  red: "bg-red-50 text-red-700",
  amber: "bg-amber-50 text-amber-800",
  muted: "bg-app-canvas text-app-muted",
  green: "bg-emerald-50 text-emerald-800",
};

const PAGE = 100;

const money = (n) =>
  Number.isFinite(n) ? `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—";
const carats = (n) => (Number.isFinite(n) ? `${n.toFixed(2)} ct` : "—");
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "—");

const formatWhen = (iso) => {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

const OFFICE_OF_BRANCH = { Israel: "IL", "New York": "NY", "Hong Kong": "HK", "Los Angeles": "LA" };
const officeOf = (it) => {
  if (it.barak?.branch) return OFFICE_OF_BRANCH[it.barak.branch] || it.barak.branch;
  const dept = it.fantasy?.department || "";
  return dept.split(",")[0].replace(/\s*OFFICE$/i, "").trim() || "—";
};

const top = (obj, n) =>
  Object.entries(obj || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);

const Badge = ({ tone, children, title }) => (
  <span title={title} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE[tone] || TONE.muted}`}>
    {children}
  </span>
);

const Stat = ({ label, value, sub, tone }) => (
  <div className="rounded-2xl border border-app-line bg-app-surface px-4 py-3">
    <p className="text-[12px] font-medium text-app-muted">{label}</p>
    <p className={`mt-1 text-[24px] font-semibold tabular-nums tracking-tight ${tone === "red" ? "text-red-700" : "text-app-ink"}`}>
      {value}
    </p>
    {sub && <p className="mt-0.5 text-[12px] text-app-muted">{sub}</p>}
  </div>
);

const Breakdown = ({ title, rows, total }) => (
  <div className="rounded-2xl border border-app-line bg-app-surface px-4 py-3">
    <p className="mb-2 text-[12px] font-semibold text-app-ink">{title}</p>
    <ul className="space-y-1.5">
      {rows.map(([name, count]) => (
        <li key={name} className="text-[12px]">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-app-ink">{name}</span>
            <span className="shrink-0 tabular-nums text-app-muted">{count.toLocaleString("en-US")}</span>
          </div>
          <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-app-canvas">
            <div className="h-full rounded-full bg-emerald-600/70" style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
          </div>
        </li>
      ))}
    </ul>
  </div>
);

/* One side of the Barak ↔ Fantasy comparison; values that disagree are tinted. */
const Side = ({ label, cells }) => (
  <div className="min-w-0">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-app-muted">{label}</p>
    <p className="mt-0.5 flex flex-wrap gap-x-2 text-[12px] leading-relaxed text-app-ink">
      {cells.map(([text, off], i) => (
        <span key={i} className={off ? "rounded bg-amber-50 px-1 font-semibold text-amber-900" : ""}>
          {text}
        </span>
      ))}
    </p>
  </div>
);

const IssueRow = ({ it }) => {
  const b = it.barak;
  const f = it.fantasy;
  const has = (k) => it.kinds.includes(k);
  return (
    <li className="px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {b ? (
          <Link
            to={`/${encodeURIComponent(it.sku)}`}
            className="text-[14px] font-semibold tracking-tight text-app-ink underline-offset-2 hover:underline"
          >
            {it.sku}
          </Link>
        ) : (
          <span className="text-[14px] font-semibold tracking-tight text-app-ink">{it.sku}</span>
        )}
        {it.category && <span className="text-[12px] text-app-muted">{it.category}</span>}
        {it.kinds.map((k) => (
          <Badge key={k} tone={KINDS[k]?.tone} title={KINDS[k]?.hint}>
            {KINDS[k]?.label || k}
          </Badge>
        ))}
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {b ? (
          <Side
            label="Barak"
            cells={[
              [carats(b.weight), has("weight")],
              [money(b.price), has("price")],
              [`cost ${money(b.cost)}`, has("cost")],
              [[b.location, b.holder && `hold: ${b.holder}`].filter(Boolean).join(" · ") || b.branch || "—", false],
            ]}
          />
        ) : (
          <Side label="Barak" cells={[["Not in Barak's feed", false]]} />
        )}
        {f ? (
          <Side
            label={`Fantasy${f.lots > 1 ? ` · ${f.lots} lots` : ""}`}
            cells={[
              [carats(f.weight), has("weight")],
              [money(f.sale), has("price")],
              [`cost ${money(f.cost)}`, has("cost")],
              [f.statuses.join(" / "), has("sold") || has("deleted")],
              [[f.location, f.owner].filter(Boolean).join(" · ") || "—", false],
            ]}
          />
        ) : (
          <Side label="Fantasy" cells={[["No lot with this name", true]]} />
        )}
      </div>
    </li>
  );
};

const JewelryRow = ({ it }) => (
  <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 sm:px-4">
    <span className="text-[14px] font-semibold tracking-tight text-app-ink">{it.sku}</span>
    {it.type && <span className="text-[12px] text-app-muted">{it.type}</span>}
    {it.fantasy ? (
      <Badge tone="green">In Fantasy · {it.fantasy.statuses.join(" / ")}</Badge>
    ) : (
      <Badge tone="red">Not in Fantasy</Badge>
    )}
    <span className="ml-auto text-[12px] text-app-muted">
      {[it.location, money(it.price)].filter(Boolean).join(" · ")}
    </span>
  </li>
);

const toCsv = (rows) => {
  const head = ["SKU", "Issues", "Category", "Office", "Barak ct", "Barak price", "Barak cost", "Barak location",
    "Fantasy lots", "Fantasy status", "Fantasy ct", "Fantasy sale", "Fantasy cost", "Fantasy location", "Fantasy owner"];
  const cell = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((it) => [
    it.sku, it.kinds.map((k) => KINDS[k]?.label || k).join("; "), it.category, officeOf(it),
    it.barak?.weight, it.barak?.price, it.barak?.cost, it.barak?.location,
    it.fantasy?.lots, it.fantasy?.statuses.join("/"), it.fantasy?.weight, it.fantasy?.sale, it.fantasy?.cost,
    it.fantasy?.location, it.fantasy?.owner,
  ].map(cell).join(","));
  return [head.join(","), ...lines].join("\n");
};

const download = (name, text) => {
  const url = URL.createObjectURL(new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const FantasyPage = () => {
  const team = useTeam();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("missing");
  const [office, setOffice] = useState("all");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchFantasyOverview());
    } catch (err) {
      setError(err.message || "Could not load the Fantasy comparison");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (team.ready && team.isAdmin) load();
  }, [team.ready, team.isAdmin, load]);

  useEffect(() => setShown(PAGE), [view, office, query]);

  const issues = useMemo(() => data?.issues || [], [data]);
  const jewelry = useMemo(() => data?.jewelry || [], [data]);
  const summary = data?.summary;

  const offices = useMemo(() => [...new Set(issues.map(officeOf))].filter((o) => o !== "—").sort(), [issues]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (view === "jewelry") {
      return jewelry.filter((j) => !q || [j.sku, j.type, j.location].some((v) => String(v ?? "").toLowerCase().includes(q)));
    }
    return issues.filter((it) => {
      if (!it.kinds.includes(view)) return false;
      if (office !== "all" && officeOf(it) !== office) return false;
      if (!q) return true;
      return [it.sku, it.category, it.barak?.location, it.fantasy?.location, it.fantasy?.owner]
        .some((v) => String(v ?? "").toLowerCase().includes(q));
    });
  }, [issues, jewelry, view, office, query]);

  const syncNow = async () => {
    setBusy(true);
    try {
      const r = await syncFantasy();
      if (r.success) toast.success(`Fantasy synced · ${r.lots.toLocaleString("en-US")} lots`);
      else toast.error(r.message || "Fantasy sync failed", { duration: 8000 });
      await load();
    } catch (err) {
      toast.error(err.message || "Fantasy sync failed");
    } finally {
      setBusy(false);
    }
  };

  if (team.loading) return <div className="p-6 text-sm text-app-muted">Loading…</div>;

  if (!team.isAdmin) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <h2 className="text-[22px] font-semibold tracking-tight text-app-ink">Admins only</h2>
        <p className="mt-2 text-[14px] text-app-muted">The Fantasy comparison is for workshop admins.</p>
      </div>
    );
  }

  const sync = data?.sync;
  const counts = summary?.counts || {};
  const fan = summary?.fantasy;
  const chips = [
    ...Object.keys(KINDS).map((k) => [k, KINDS[k].label, counts[k === "fantasy_only" ? "fantasyOnly" : k] || 0]),
    ["jewelry", "Jewelry", jewelry.length],
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-app-ink">Fantasy</h1>
          <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-app-muted">
            Fantasy is replacing Barak. This page reads every Fantasy lot (twice a day, after the Barak sync) and
            matches it to Barak's inventory by lot name = SKU. Read-only: nothing here changes Fantasy.
          </p>
        </div>
        <button
          type="button"
          className="inv-btn inv-btn--quiet"
          disabled={busy || loading || filtered.length === 0}
          onClick={() => download(`fantasy-${view}.csv`, view === "jewelry"
            ? ["SKU,Type,Location,Price,In Fantasy", ...filtered.map((j) => [j.sku, j.type, j.location, j.price, j.fantasy ? j.fantasy.statuses.join("/") : "no"].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))].join("\n")
            : toCsv(filtered))}
        >
          Export CSV ({filtered.length})
        </button>
      </header>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-app-line bg-app-surface px-4 py-3">
        <p className="min-w-0 text-[13px] leading-relaxed text-app-muted">
          {sync ? (
            <>
              <span className={sync.success ? "font-semibold text-app-ink" : "font-semibold text-red-700"}>
                {sync.success ? "Synced with Fantasy" : "Last sync failed"}
              </span>{" "}
              · {formatWhen(sync.ranAt)}
              {sync.success && sync.lots != null ? ` · ${sync.lots.toLocaleString("en-US")} lots` : ""}
              {!sync.success && sync.message ? ` · ${sync.message}` : ""}
            </>
          ) : (
            "Not synced with Fantasy yet"
          )}
        </p>
        <button type="button" className="inv-btn inv-btn--quiet" disabled={busy || loading} onClick={syncNow}>
          {busy ? "Syncing…" : "Sync now"}
        </button>
      </div>

      {loading && !data ? (
        <p className="text-[14px] text-app-muted">Loading…</p>
      ) : error ? (
        <p className="text-[14px] text-red-600">{error}</p>
      ) : summary ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Live lots in Fantasy"
              value={fan.live.toLocaleString("en-US")}
              sub={`${fan.lots.toLocaleString("en-US")} incl. sold and deleted`}
            />
            <Stat
              label="Barak stones found in Fantasy"
              value={pct(counts.matched, summary.barak.stones)}
              sub={`${counts.matched.toLocaleString("en-US")} of ${summary.barak.stones.toLocaleString("en-US")} · ${counts.ok.toLocaleString("en-US")} fully agree`}
            />
            <Stat
              label="Missing in Fantasy"
              value={(counts.missing + counts.sold + counts.deleted).toLocaleString("en-US")}
              sub={`${counts.missing} no lot · ${counts.sold} sold · ${counts.deleted} deleted`}
              tone={counts.missing ? "red" : undefined}
            />
            <Stat
              label="Barak jewelry in Fantasy"
              value={`${summary.jewelryInFantasy} / ${summary.barak.jewelry}`}
              sub={`Live value: cost ${money(fan.totalCost)} · sale ${money(fan.totalSale)}`}
            />
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Breakdown title="Status (all lots)" rows={top(fan.byStatus, 8)} total={fan.lots} />
            <Breakdown title="Office (live)" rows={top(fan.byDepartment, 6)} total={fan.live} />
            <Breakdown title="Owner (live)" rows={top(fan.byOwner, 6)} total={fan.live} />
            <Breakdown title="Type (live)" rows={top(fan.byType, 6)} total={fan.live} />
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            {chips.map(([k, label, n]) => (
              <button
                key={k}
                type="button"
                title={KINDS[k]?.hint}
                onClick={() => setView(k)}
                className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition ${
                  view === k
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                    : "border-app-line text-app-muted hover:text-app-ink"
                }`}
              >
                {label} <span className="tabular-nums opacity-70">{n.toLocaleString("en-US")}</span>
              </button>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              className="h-10 min-w-[220px] flex-1 rounded-xl border border-app-line bg-app-surface px-3 text-[14px] text-app-ink outline-none focus:border-emerald-500"
              placeholder={view === "jewelry" ? "Search model, type, location" : "Search SKU, category, location, owner"}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {view !== "jewelry" && (
              <select
                className="h-10 rounded-xl border border-app-line bg-app-surface px-3 text-[14px] text-app-ink outline-none focus:border-emerald-500"
                value={office}
                onChange={(e) => setOffice(e.target.value)}
              >
                <option value="all">All offices</option>
                {offices.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            )}
            <span className="text-[12px] text-app-muted">
              {filtered.length.toLocaleString("en-US")} {view === "jewelry" ? "pieces" : "items"}
            </span>
          </div>

          {KINDS[view]?.hint && <p className="mb-3 text-[12px] text-app-muted">{KINDS[view].hint}.</p>}

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-app-line bg-app-surface px-5 py-10 text-center text-[14px] text-app-muted">
              Nothing here.
            </div>
          ) : (
            <>
              <ul className="divide-y divide-app-line overflow-hidden rounded-2xl border border-app-line bg-app-surface">
                {filtered.slice(0, shown).map((it, i) =>
                  view === "jewelry" ? <JewelryRow key={`${it.sku}-${i}`} it={it} /> : <IssueRow key={`${it.sku}-${i}`} it={it} />
                )}
              </ul>
              {filtered.length > shown && (
                <div className="mt-4 text-center">
                  <button type="button" className="inv-btn inv-btn--quiet" onClick={() => setShown((n) => n + PAGE)}>
                    Show more ({(filtered.length - shown).toLocaleString("en-US")} left)
                  </button>
                </div>
              )}
            </>
          )}
        </>
      ) : null}
    </div>
  );
};

export default FantasyPage;
