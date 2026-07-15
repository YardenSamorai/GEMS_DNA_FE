import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE =
  process.env.REACT_APP_API_URL || "https://gems-dna-be.onrender.com";

/* ============================================================================
 * SyncHistoryCard — "Inventory sync" panel on the Dashboard Overview tab
 * (admins only).
 *
 * Shows the outcome of every Barak stone sync — both the scheduled Render
 * cron job and manual runs from the Sync button — backed by the BE sync_log
 * table via GET /api/sync/history. The card surfaces the latest runs inline
 * and opens a modal with the full log.
 * ============================================================================ */

const fmtWhen = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const fmtDuration = (ms) => {
  const s = Math.round((Number(ms) || 0) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
};

const SourceBadge = ({ source }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${
      source === "cron"
        ? "bg-sky-500/10 text-sky-700"
        : "bg-app-ink/8 text-app-ink"
    }`}
  >
    {source === "cron" ? (
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ) : (
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5a7 7 0 017 7h2l-3 3-3-3h2a5 5 0 10-5 5v2a7 7 0 010-14z" />
      </svg>
    )}
    {source === "cron" ? "Auto" : "Manual"}
  </span>
);

const StatusDot = ({ ok }) => (
  <span
    className={`inline-flex h-2 w-2 shrink-0 rounded-full ${ok ? "bg-emerald-500" : "bg-rose-500"}`}
    title={ok ? "Success" : "Failed"}
  />
);

const Row = ({ run }) => (
  <div className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-app-surface/55 transition-colors">
    <StatusDot ok={run.success} />
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-medium text-app-ink tabular-nums">
          {fmtWhen(run.started_at)}
        </span>
        <SourceBadge source={run.source} />
      </div>
      <p className="truncate text-[11px] text-app-muted">
        {run.success
          ? `${Number(run.stones_count || 0).toLocaleString()} stones · ${fmtDuration(run.duration_ms)}`
          : run.message || "Sync failed"}
      </p>
    </div>
    {run.success ? (
      <span className="shrink-0 text-[11px] font-semibold tabular-nums text-emerald-700">
        {Number(run.stones_count || 0).toLocaleString()}
      </span>
    ) : (
      <span className="shrink-0 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-700">
        Failed
      </span>
    )}
  </div>
);

const SyncHistoryCard = () => {
  const [history, setHistory] = useState(null);
  const [err, setErr] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/sync/history?limit=100`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Failed (${r.status})`))))
      .then((res) => alive && setHistory(Array.isArray(res.history) ? res.history : []))
      .catch((e) => alive && setErr(e.message));
    return () => { alive = false; };
  }, []);

  const latest = history?.[0] || null;

  return (
    <>
      <div className="rounded-3xl glass-surface p-5 sm:p-6">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-[13px] font-semibold tracking-tight text-app-ink">Inventory sync</h2>
            <p className="text-[11px] text-app-muted">
              Barak stone syncs — automatic (twice a day) and manual runs.
            </p>
          </div>
          {history?.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="text-[11px] font-medium text-app-ink hover:underline"
            >
              View all ({history.length}) →
            </button>
          )}
        </div>

        {err ? (
          <p className="py-4 text-[12px] text-app-muted">Couldn't load sync history: {err}</p>
        ) : history === null ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 rounded-xl bg-app-surface/40 animate-pulse" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <p className="py-4 text-[12px] text-app-muted">
            No syncs recorded yet — the log starts filling up from the next sync run.
          </p>
        ) : (
          <>
            {/* Latest run summary strip */}
            {latest && (
              <div
                className={`mb-3 flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${
                  latest.success
                    ? "border-emerald-500/25 bg-emerald-500/8"
                    : "border-rose-500/25 bg-rose-500/8"
                }`}
              >
                <StatusDot ok={latest.success} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold text-app-ink">
                    {latest.success
                      ? `Last sync: ${Number(latest.stones_count || 0).toLocaleString()} stones`
                      : "Last sync failed"}
                  </p>
                  <p className="truncate text-[11px] text-app-muted">
                    {fmtWhen(latest.started_at)} · {latest.source === "cron" ? "automatic" : "manual"}
                    {latest.success
                      ? ` · took ${fmtDuration(latest.duration_ms)}`
                      : latest.message ? ` · ${latest.message}` : ""}
                  </p>
                </div>
              </div>
            )}
            <div className="space-y-0.5">
              {history.slice(0, 5).map((run) => <Row key={run.id} run={run} />)}
            </div>
          </>
        )}
      </div>

      {/* Full-log modal */}
      <AnimatePresence>
        {showAll && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowAll(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-app-canvas border border-app-line shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-app-line px-5 py-4">
                <div>
                  <h3 className="text-[15px] font-semibold tracking-tight text-app-ink">Sync history</h3>
                  <p className="text-[11px] text-app-muted">
                    Every Barak sync run — newest first.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAll(false)}
                  className="rounded-full p-1.5 text-app-muted hover:bg-app-surface hover:text-app-ink"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
                {(history || []).map((run) => <Row key={run.id} run={run} />)}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SyncHistoryCard;
