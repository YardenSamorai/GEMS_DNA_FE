import React from "react";

/* ============================================================================
 * Sales Inventory — a salesperson-focused stone browser (built step by step).
 *
 * Lives under SALES. Will use the same /api/soap-stones source but with a
 * leaner, sales-oriented UI: tailored filters, per-stone actions (Create
 * offer, multi-select, view DNA, WhatsApp), and the new cost_per_carat /
 * holder fields. Placeholder for now — we flesh it out incrementally.
 * ========================================================================== */

const SalesInventory = () => {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h1 className="text-2xl font-semibold tracking-tight text-app-ink">Sales Inventory</h1>
        <span className="text-sm text-app-muted">Stone browser for salespeople</span>
      </div>
      <p className="mt-1 text-xs text-app-soft">
        We'll build this step by step.
      </p>

      <div className="mt-8 rounded-2xl glass-surface p-10 text-center">
        <p className="text-[14px] font-medium text-app-ink">Coming together soon</p>
        <p className="mt-1 text-[12.5px] text-app-soft">
          This page is intentionally empty for now.
        </p>
      </div>
    </div>
  );
};

export default SalesInventory;
