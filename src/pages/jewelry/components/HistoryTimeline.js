import React from "react";
import StatusBadge from "./StatusBadge";

const HistoryTimeline = ({ history = [] }) => {
  if (!history.length) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-center text-sm text-stone-500">
        No history yet.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <ol className="space-y-4">
        {history.map((h) => (
          <li key={h.id} className="relative flex gap-3 pl-2">
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {h.from_status && (
                  <>
                    <StatusBadge status={h.from_status} size="sm" />
                    <svg className="h-3 w-3 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
                <StatusBadge status={h.to_status} size="sm" />
              </div>
              {h.notes && <div className="mt-1 text-sm text-stone-700">{h.notes}</div>}
              <div className="mt-1 text-xs text-stone-400">
                {new Date(h.changed_at).toLocaleString()}
                {h.changed_by && ` · by ${h.changed_by}`}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};

export default HistoryTimeline;
