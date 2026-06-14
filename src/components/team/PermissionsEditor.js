import React from "react";
import { SECTION_OPTIONS, LOCATION_VIEW_OPTIONS } from "./teamUtils";

/**
 * PermissionsEditor — section checkboxes + stone-location visibility radio.
 * Shared by the invite form and the per-member detail editor.
 */
const PermissionsEditor = ({
  sections,
  locationView,
  canViewCost,
  onToggleSection,
  onLocationView,
  onToggleCost,
}) => (
  <div className="space-y-3">
    <div>
      <span className="block text-[11px] uppercase tracking-wider font-medium text-stone-500 mb-1.5">
        Visible sections
      </span>
      <div className="grid grid-cols-2 gap-1.5">
        {SECTION_OPTIONS.map((s) => {
          const on = sections.includes(s.key);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onToggleSection(s.key)}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[12.5px] transition ${
                on
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
              }`}
            >
              <span
                className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded ${
                  on ? "bg-emerald-600 text-white" : "bg-stone-200 text-transparent"
                }`}
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </span>
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
    <div>
      <span className="block text-[11px] uppercase tracking-wider font-medium text-stone-500 mb-1.5">
        Stone location visibility
      </span>
      <div className="flex flex-col gap-1.5">
        {LOCATION_VIEW_OPTIONS.map((o) => {
          const on = locationView === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onLocationView(o.value)}
              className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-left transition ${
                on ? "border-sky-300 bg-sky-50" : "border-stone-200 bg-white hover:bg-stone-50"
              }`}
            >
              <span
                className={`mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                  on ? "border-sky-600" : "border-stone-300"
                }`}
              >
                {on && <span className="h-2 w-2 rounded-full bg-sky-600" />}
              </span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-medium text-stone-800">{o.label}</span>
                <span className="block text-[11px] text-stone-500 leading-tight">{o.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
    {onToggleCost && (
      <div>
        <span className="block text-[11px] uppercase tracking-wider font-medium text-stone-500 mb-1.5">
          Sensitive data
        </span>
        <button
          type="button"
          onClick={() => onToggleCost(!canViewCost)}
          className={`flex w-full items-center justify-between gap-3 rounded-lg border px-2.5 py-2 text-left transition ${
            canViewCost ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-white hover:bg-stone-50"
          }`}
        >
          <span className="min-w-0">
            <span className="block text-[12.5px] font-medium text-stone-800">Internal cost & margin</span>
            <span className="block text-[11px] text-stone-500 leading-tight">
              {canViewCost ? "Can see cost per ct and profit" : "Cost & margin hidden — sees price only"}
            </span>
          </span>
          <span
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
              canViewCost ? "bg-amber-500" : "bg-stone-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                canViewCost ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </span>
        </button>
      </div>
    )}
  </div>
);

export default PermissionsEditor;
