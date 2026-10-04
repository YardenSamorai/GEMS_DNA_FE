import React, { useCallback, useEffect, useState } from "react";
import { createApiKey, fetchApiKeys, revokeApiKey } from "../../services/apiKeysApi";

const PLACEHOLDER = "YOUR_API_KEY";

const LOCATION_LABELS = {
  full: "full location detail",
  memo_branch: "branch, memo and holder",
  branch_only: "branch only",
  status_only: "memo / hold status only",
  hidden: "no location",
};

const when = (iso) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

const CopyButton = ({ text, label = "Copy" }) => {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      window.prompt("Copy:", text);
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-lg border border-app-line bg-app-surface px-3 py-1.5 text-xs font-semibold text-app-ink hover:bg-app-canvas2"
    >
      {done ? "Copied" : label}
    </button>
  );
};

const Code = ({ children }) => (
  <div className="flex items-start gap-2 rounded-xl bg-app-canvas2 p-3">
    <code className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-xs text-app-ink" dir="ltr">
      {children}
    </code>
    <CopyButton text={children} />
  </div>
);

const Step = ({ n, children }) => (
  <li className="flex gap-3">
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-emerald text-xs font-bold text-white">
      {n}
    </span>
    <div className="min-w-0 flex-1 space-y-2 text-sm text-app-graphite">{children}</div>
  </li>
);

const GUIDES = [
  { key: "gpt", label: "ChatGPT (Custom GPT)" },
  { key: "mcp", label: "Claude / ChatGPT connector (MCP)" },
  { key: "code", label: "Code & Excel" },
];

const Guide = ({ baseUrl, apiKey }) => {
  const [tab, setTab] = useState("gpt");
  const key = apiKey || PLACEHOLDER;
  return (
    <section className="rounded-2xl border border-app-line bg-app-surface p-5 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-app-ink">Connect</h2>
        <p className="text-sm text-app-muted">
          {apiKey
            ? "Your new key is filled in below — copy what you need before leaving this page."
            : `Replace ${PLACEHOLDER} with one of your keys.`}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {GUIDES.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => setTab(g.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              tab === g.key ? "bg-app-ink text-app-surface" : "bg-app-canvas2 text-app-graphite"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {tab === "gpt" && (
        <ol className="space-y-4">
          <Step n={1}>In ChatGPT open <b>Explore GPTs → Create</b>, then the <b>Configure</b> tab.</Step>
          <Step n={2}>
            Under <b>Actions</b> choose <b>Create new action → Import from URL</b> and paste:
            <Code>{`${baseUrl}/api/v1/openapi.json`}</Code>
          </Step>
          <Step n={3}>
            Set <b>Authentication</b> to <b>API Key</b>, auth type <b>Bearer</b>, and paste the key:
            <Code>{key}</Code>
          </Step>
          <Step n={4}>
            Optional instructions for the GPT:
            <Code>
              {"You answer questions about the GEMS DNA inventory. Call getCatalogMeta first to learn the filter values. " +
                "Use summarizeStones / summarizeJewelry for breakdowns and totals, searchStones / searchJewelry for lists, " +
                "and createExcelExport when the user wants a spreadsheet — then give them the link. Prices are USD."}
            </Code>
          </Step>
        </ol>
      )}

      {tab === "mcp" && (
        <ol className="space-y-4">
          <Step n={1}>
            For connectors that only take a URL (ChatGPT connectors, Claude custom connectors) use this address — the
            key is part of it, so treat the whole URL as a password:
            <Code>{`${baseUrl}/mcp/${key}`}</Code>
          </Step>
          <Step n={2}>
            For clients that can send headers (Claude Desktop, Cursor, scripts) use
            <Code>{`${baseUrl}/mcp`}</Code>
            with the header
            <Code>{`Authorization: Bearer ${key}`}</Code>
          </Step>
          <Step n={3}>
            Tools offered: catalog_overview, search_stones, get_stone, summarize_stones, search_jewelry, get_jewelry,
            summarize_jewelry, export_excel, search, fetch. All read-only.
          </Step>
        </ol>
      )}

      {tab === "code" && (
        <ol className="space-y-4">
          <Step n={1}>
            Search stones (filters, sort and paging):
            <Code>{`curl -H "Authorization: Bearer ${key}" "${baseUrl}/api/v1/stones?type=emerald&minCt=2&sort=price&limit=50"`}</Code>
          </Step>
          <Step n={2}>
            Break the inventory down (one or two dimensions):
            <Code>{`curl -H "Authorization: Bearer ${key}" "${baseUrl}/api/v1/stones/summary?groupBy=gem,branch"`}</Code>
          </Step>
          <Step n={3}>
            Download an Excel file of everything matching the filters:
            <Code>{`curl -H "Authorization: Bearer ${key}" -o stones.xlsx "${baseUrl}/api/v1/export?dataset=stones&type=diamond&minCt=1"`}</Code>
          </Step>
          <Step n={4}>
            Other endpoints: <span dir="ltr">/api/v1/meta</span>, <span dir="ltr">/api/v1/stones/&#123;sku&#125;</span>,{" "}
            <span dir="ltr">/api/v1/jewelry</span>, <span dir="ltr">/api/v1/jewelry/summary</span>,{" "}
            <span dir="ltr">/api/v1/jewelry/&#123;model&#125;</span>, <span dir="ltr">/api/v1/export-link</span>. Full
            reference:
            <Code>{`${baseUrl}/api/v1/openapi.json`}</Code>
          </Step>
        </ol>
      )}
    </section>
  );
};

const ApiAccess = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchApiKeys());
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await createApiKey(name.trim());
      setCreated(res.key);
      setName("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (k) => {
    if (!window.confirm(`Revoke "${k.name}"? Anything using it stops working immediately.`)) return;
    try {
      await revokeApiKey(k.id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const keys = data?.keys || [];
  const showOwner = keys.some((k) => !k.mine);
  const access = data?.access;

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-black text-app-ink">API Access</h1>
        <p className="text-sm text-app-graphite">
          A key lets ChatGPT, Claude, a script or a spreadsheet read the stones and jewelry inventory, search it, break
          it down and export it to Excel. Keys are read-only and see exactly what you see
          {access
            ? ` — ${access.canSeeCost ? "including" : "without"} cost, with ${
                LOCATION_LABELS[access.locationView] || access.locationView
              }.`
            : "."}
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
      )}

      {created && (
        <section className="space-y-2 rounded-2xl border-2 border-brand-emerald bg-app-surface p-5">
          <h2 className="text-lg font-bold text-app-ink">Your new key</h2>
          <p className="text-sm text-app-graphite">
            Copy it now — for your security it won't be shown again. Anyone holding it can read the inventory as you,
            so keep it private and revoke it if it leaks.
          </p>
          <Code>{created}</Code>
          <button type="button" onClick={() => setCreated(null)} className="text-sm font-semibold text-app-muted underline">
            I saved it, hide it
          </button>
        </section>
      )}

      <section className="space-y-4 rounded-2xl border border-app-line bg-app-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-bold text-app-ink">Keys</h2>
          {data?.canCreate && (
            <form onSubmit={create} className="flex w-full gap-2 sm:w-auto">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='Name, e.g. "ChatGPT"'
                maxLength={80}
                className="min-w-0 flex-1 rounded-xl border border-app-line bg-app-canvas2 px-3 py-2 text-sm text-app-ink sm:w-56"
              />
              <button
                type="submit"
                disabled={busy || !name.trim()}
                className="rounded-xl bg-brand-emerald px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy ? "Creating…" : "Create key"}
              </button>
            </form>
          )}
        </div>

        {data && !data.canCreate && (
          <p className="text-sm text-app-muted">Your account has no inventory access, so it can't create keys.</p>
        )}
        {!data && !error && <p className="text-sm text-app-muted">Loading…</p>}
        {data && keys.length === 0 && <p className="text-sm text-app-muted">No keys yet.</p>}

        {keys.length > 0 && (
          <div className="divide-y divide-app-line">
            {keys.map((k) => (
              <div key={k.id} className={`flex flex-wrap items-center gap-3 py-3 ${k.revokedAt ? "opacity-50" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-app-ink">
                    {k.name}
                    {showOwner && k.owner && <span className="font-normal text-app-muted"> · {k.owner}</span>}
                  </div>
                  <div className="text-xs text-app-muted">
                    <span className="font-mono" dir="ltr">{k.prefix}…</span> · created {when(k.createdAt)} · last used{" "}
                    {when(k.lastUsedAt)} · {k.useCount} calls
                  </div>
                </div>
                {k.revokedAt ? (
                  <span className="text-xs font-semibold text-app-muted">Revoked {when(k.revokedAt)}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => revoke(k)}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {data?.baseUrl && <Guide baseUrl={data.baseUrl} apiKey={created} />}
    </div>
  );
};

export default ApiAccess;
