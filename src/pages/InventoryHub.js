import React from "react";
import { useSearchParams } from "react-router-dom";

import StonesInventory from "./inventory";        // /pages/inventory/index.js — the legacy stones grid
import JewelryInventory from "./jewelry";         // /pages/jewelry/index.js — the jewelry grid

/* ============================================================================
 * Unified Inventory — Sprint 1.B of the Unified System Spine roadmap.
 *
 * Before this merge the app shipped two parallel "things you own" surfaces:
 *   /inventory      — every stone (StonesInventory)
 *   /jewelry/items  — every jewelry workshop + catalog item (JewelryInventory)
 *
 * They were structurally identical (search + filters + grid + pagination),
 * just for different entity types. This wrapper hosts both as tabs under
 * one URL so the user has a single mental model: "Inventory = stuff we own".
 *
 * Implementation notes:
 *   - Tab switch is via ?tab=jewelry / ?tab=stones (default: stones).
 *   - Each child page is mounted only when its tab is active. The two
 *     legacy pages own a lot of state (filters, pagination, dialogs) and
 *     aren't built to coexist; conditional rendering is the safest path.
 *   - All other query params (search/mode/...) are preserved across tab
 *     switches so the user's deep-link state isn't dropped.
 *   - Legacy /jewelry/items URLs redirect to /inventory?tab=jewelry — see
 *     the route table in App.js.
 * ============================================================================ */

const TABS = [
  { id: "stones", label: "Stones", description: "Loose gemstones & diamonds" },
  { id: "jewelry", label: "Jewelry", description: "Workshop & catalog pieces" },
];

const isValidTab = (id) => TABS.some((t) => t.id === id);

const InventoryHub = () => {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tabId = isValidTab(requested) ? requested : "stones";

  const setTab = (id) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id === "stones") {
          next.delete("tab"); // keep the default URL clean (/inventory)
        } else {
          next.set("tab", id);
        }
        return next;
      },
      { replace: true }
    );
  };

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Tab strip — same visual language as the merged Dashboard so the
          two unified hubs feel like siblings. Sticks under the global TopBar. */}
      <div className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 overflow-x-auto" aria-label="Inventory sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tabId === t.id ? "page" : undefined}
                className={`relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                  tabId === t.id
                    ? "border-emerald-600 text-stone-900"
                    : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
              >
                {t.label}
                <span className="ml-2 hidden sm:inline text-[11px] font-normal text-stone-400">
                  {t.description}
                </span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div>
        {tabId === "stones" && <StonesInventory />}
        {tabId === "jewelry" && <JewelryInventory />}
      </div>
    </div>
  );
};

export default InventoryHub;
