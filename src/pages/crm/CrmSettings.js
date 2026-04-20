import React, { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/clerk-react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  fetchOutlookStatus,
  getOutlookAuthUrl,
  disconnectOutlook,
  syncOutlookContacts,
  importOutlookEmails,
  migrateTitlesFromNotes,
} from "../../services/crmApi";

const Card = ({ title, description, children, icon }) => (
  <section className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-6 shadow-sm">
    <div className="flex items-start gap-3 mb-4">
      {icon && (
        <div className="shrink-0 w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center text-stone-700">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <h2 className="text-base sm:text-lg font-semibold text-stone-900">{title}</h2>
        {description && <p className="text-sm text-stone-500 mt-0.5">{description}</p>}
      </div>
    </div>
    {children}
  </section>
);

const Button = ({ variant = "default", className = "", children, ...rest }) => {
  const base =
    "inline-flex items-center justify-center gap-2 text-sm font-medium rounded-lg px-3.5 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    default: "bg-stone-900 text-white hover:bg-stone-800",
    outline: "border border-stone-300 text-stone-800 hover:bg-stone-50",
    danger: "border border-red-200 text-red-700 hover:bg-red-50",
    ghost: "text-stone-700 hover:bg-stone-100",
  };
  return (
    <button className={`${base} ${variants[variant] || variants.default} ${className}`} {...rest}>
      {children}
    </button>
  );
};

const StatusDot = ({ ok }) => (
  <span
    className={`inline-block w-2 h-2 rounded-full ${ok ? "bg-emerald-500" : "bg-stone-300"}`}
  />
);

const OutlookIcon = (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M3 6.5l9-1.5v13l-9-1.5V6.5zm10-1.5h7a1 1 0 011 1v12a1 1 0 01-1 1h-7V5z" />
  </svg>
);

export default function CrmSettings() {
  const { user } = useUser();
  const location = useLocation();
  const navigate = useNavigate();

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [importDays, setImportDays] = useState(7);

  const reload = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const s = await fetchOutlookStatus(user.id);
      setStatus(s);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Handle ?outlook=connected|error redirect from OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const outlookStatus = params.get("outlook");
    if (!outlookStatus) return;
    const msg = params.get("msg");
    if (outlookStatus === "connected") {
      toast.success(`Outlook connected${msg ? `: ${msg}` : ""}`);
    } else if (outlookStatus === "error") {
      toast.error(`Outlook error: ${msg || "unknown"}`);
    }
    navigate(location.pathname, { replace: true });
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = async () => {
    if (!user?.id) return;
    setBusy("connect");
    try {
      const { url } = await getOutlookAuthUrl(user.id);
      window.location.href = url;
    } catch (e) {
      toast.error(e.message);
      setBusy(null);
    }
  };

  const handleDisconnect = async () => {
    if (!user?.id) return;
    if (!window.confirm("Disconnect Outlook account?")) return;
    setBusy("disconnect");
    try {
      await disconnectOutlook(user.id);
      toast.success("Outlook disconnected");
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const handleSync = async (direction) => {
    if (!user?.id) return;
    setBusy(`sync-${direction}`);
    try {
      const r = await syncOutlookContacts(user.id, direction);
      toast.success(
        `Sync done: ${r.pulledNew || 0} new, ${r.pulledUpdated || 0} updated, ${r.pushedNew || 0} pushed, ${r.pushedUpdated || 0} updated to Outlook`
      );
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const handleImportEmails = async () => {
    if (!user?.id) return;
    setBusy("import-emails");
    try {
      const r = await importOutlookEmails(user.id, importDays);
      toast.success(
        `Imported ${r.imported || 0} emails (scanned ${r.scanned || 0}) from the last ${r.lookbackDays} days`
      );
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const handleMigrateTitles = async (dryRun) => {
    if (!user?.id) return;
    setBusy("migrate-titles");
    try {
      const r = await migrateTitlesFromNotes(user.id, dryRun);
      if (dryRun) {
        toast.success(`Dry run: would update ${r.found || 0} contacts`);
      } else {
        toast.success(`Migrated ${r.updated || 0} titles from notes`);
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const connected = !!status?.connected;
  const configured = status?.configured !== false; // default true if unknown

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="hidden sm:block mb-2">
        <h1 className="text-xl font-semibold text-stone-900">Settings</h1>
        <p className="text-sm text-stone-500">Integrations and CRM utilities</p>
      </div>

      {/* Outlook integration */}
      <Card
        icon={OutlookIcon}
        title="Microsoft Outlook"
        description="Two-way contact sync, send emails through your Outlook account, and import recent inbox / sent emails as activity."
      >
        {loading ? (
          <div className="text-sm text-stone-500">Loading…</div>
        ) : !configured ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3">
            Outlook is not configured on the server. Ask your administrator to set
            <code className="mx-1 px-1 rounded bg-amber-100">OUTLOOK_CLIENT_ID</code>,
            <code className="mx-1 px-1 rounded bg-amber-100">OUTLOOK_CLIENT_SECRET</code> and
            <code className="mx-1 px-1 rounded bg-amber-100">OUTLOOK_REDIRECT_URI</code>.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-stone-50 border border-stone-200">
              <div className="flex items-center gap-2 min-w-0">
                <StatusDot ok={connected} />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-stone-900">
                    {connected ? "Connected" : "Not connected"}
                  </div>
                  {connected && (
                    <div className="text-xs text-stone-500 truncate">
                      {status.accountName} · {status.accountEmail}
                    </div>
                  )}
                </div>
              </div>
              {connected ? (
                <Button
                  variant="danger"
                  onClick={handleDisconnect}
                  disabled={busy === "disconnect"}
                >
                  {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
                </Button>
              ) : (
                <Button onClick={handleConnect} disabled={busy === "connect"}>
                  {busy === "connect" ? "Redirecting…" : "Connect Outlook"}
                </Button>
              )}
            </div>

            {connected && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleSync("two-way")}
                    disabled={!!busy}
                  >
                    {busy === "sync-two-way" ? "Syncing…" : "Two-way sync"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleSync("pull")}
                    disabled={!!busy}
                  >
                    {busy === "sync-pull" ? "Pulling…" : "Pull from Outlook"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleSync("push")}
                    disabled={!!busy}
                  >
                    {busy === "sync-push" ? "Pushing…" : "Push to Outlook"}
                  </Button>
                </div>

                <div className="rounded-lg border border-stone-200 p-3">
                  <div className="text-sm font-medium text-stone-900 mb-1">
                    Import recent emails as activity
                  </div>
                  <p className="text-xs text-stone-500 mb-2">
                    Scans your inbox and sent items, then logs each email exchanged with a known
                    contact as an activity (skipping duplicates).
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs text-stone-600">Look back</label>
                    <select
                      value={importDays}
                      onChange={(e) => setImportDays(parseInt(e.target.value, 10))}
                      className="text-sm border border-stone-300 rounded-md px-2 py-1.5"
                    >
                      <option value={3}>3 days</option>
                      <option value={7}>7 days</option>
                      <option value={14}>14 days</option>
                      <option value={30}>30 days</option>
                      <option value={90}>90 days</option>
                    </select>
                    <Button
                      variant="outline"
                      onClick={handleImportEmails}
                      disabled={!!busy}
                    >
                      {busy === "import-emails" ? "Importing…" : "Import now"}
                    </Button>
                  </div>
                </div>

                {status.lastSyncAt && (
                  <div className="text-xs text-stone-500">
                    Last sync: {new Date(status.lastSyncAt).toLocaleString()}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Card>

      {/* Title migration utility */}
      <Card
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        }
        title="Extract job titles from notes"
        description="One-time utility: scan existing contact notes for likely job titles (e.g. 'CEO', 'Owner', 'Designer') and move them into the dedicated Title field."
      >
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => handleMigrateTitles(true)}
            disabled={!!busy}
          >
            {busy === "migrate-titles" ? "Working…" : "Preview (dry run)"}
          </Button>
          <Button
            onClick={() => {
              if (window.confirm("Run title migration on all your contacts?")) {
                handleMigrateTitles(false);
              }
            }}
            disabled={!!busy}
          >
            Run migration
          </Button>
        </div>
      </Card>
    </div>
  );
}
