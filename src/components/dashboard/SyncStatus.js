import React, { useEffect, useState } from "react";
import Sheet from "../../pages/inventory/ui/Sheet";
import { useMediaQuery } from "../../design/hooks";
import { latestPerFeed, syncSummary } from "./overviewModel";

const API_BASE = process.env.REACT_APP_API_URL || "https://gems-dna-be.onrender.com";

/* Barak stone and jewelry syncs (scheduled and manual), from the BE sync_log
 * via GET /api/sync/history. Admins only. */

const SyncRow = ({ run }) => {
  const s = syncSummary(run);
  return (
    <li className="gd-row">
      <span className="gd-status" data-ok={run.success || undefined} aria-hidden="true" />
      <span className="gd-row-main">
        <span className="gd-row-title">
          {s.title}
          <span className="gd-sr">{run.success ? " — succeeded" : " — failed"}</span>
        </span>
        <span className="gd-row-sub">{s.detail}</span>
        {s.error && <span className="gd-row-sub" data-tone="warn">{s.error}</span>}
      </span>
      {s.value && <span className="gd-row-value">{s.value}</span>}
    </li>
  );
};

const SyncStatus = ({ headingId }) => {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const wide = useMediaQuery("(min-width: 768px)");

  useEffect(() => {
    let alive = true;
    setError(null);
    fetch(`${API_BASE}/api/sync/history?limit=100`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Failed (${r.status})`))))
      .then((res) => alive && setHistory(Array.isArray(res.history) ? res.history : []))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [attempt]);

  const latest = latestPerFeed(history);

  return (
    <>
      <div className="gd-sec-head">
        <h2 id={headingId} className="gd-sec-title">Inventory sync</h2>
        {history?.length > 0 && (
          <button type="button" className="gd-sec-link" onClick={() => setOpen(true)} aria-haspopup="dialog">
            History
          </button>
        )}
      </div>

      {error ? (
        <div className="gd-panel gd-empty">
          <p className="gd-empty-sub">Couldn't load sync history.</p>
          <button type="button" className="gd-btn" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
        </div>
      ) : history === null ? (
        <ul className="gd-panel gd-rows" aria-hidden="true">
          {[0, 1].map((i) => (
            <li key={i} className="gd-row gd-row--skeleton">
              <span className="gd-row-main">
                <span className="gd-sk" style={{ width: "40%" }} />
                <span className="gd-sk gd-sk--sub" style={{ width: "62%" }} />
              </span>
            </li>
          ))}
        </ul>
      ) : latest.length === 0 ? (
        <div className="gd-panel gd-empty">
          <p className="gd-empty-sub">No syncs recorded yet.</p>
        </div>
      ) : (
        <ul className="gd-panel gd-rows">
          {latest.map((run) => <SyncRow key={run.id} run={run} />)}
        </ul>
      )}

      <Sheet
        open={open}
        variant={wide ? "side" : "bottom"}
        title="Sync history"
        titleId="gd-sync-history"
        onClose={() => setOpen(false)}
        tall={!wide}
      >
        <div className="gd">
          <ul className="gd-rows gd-rows--sheet">
            {(history || []).map((run) => <SyncRow key={run.id} run={run} />)}
          </ul>
        </div>
      </Sheet>
    </>
  );
};

export default SyncStatus;
