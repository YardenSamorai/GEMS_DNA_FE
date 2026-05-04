import React from "react";
import { useSearchParams, Link } from "react-router-dom";

import HomePage from "./HomePage";              // Stones tab body (the legacy stones dashboard)
import CrmDashboard from "./crm/CrmDashboard";  // CRM tab body
import JewelryDashboard from "./jewelry/JewelryDashboard"; // Jewelry tab body
import Reports from "./jewelry/Reports";        // Reports tab body
import OverviewTab from "../components/dashboard/OverviewTab";

/* ============================================================================
 * Unified Dashboard — Sprint 1.A of the Unified System Spine roadmap.
 *
 * Before this merge the app shipped FOUR separate dashboards:
 *   /dashboard            — stones-only (HomePage)
 *   /crm                  — CrmDashboard
 *   /jewelry/dashboard    — JewelryDashboard
 *   /jewelry/reports      — Reports
 *
 * The user had to bounce between four URLs to get a single view of the
 * business. This page is a thin tabbed shell that mounts the existing
 * dashboards as tabs, so we don't rewrite anything and don't duplicate
 * data fetching. The conditional `{tabId === 'x' && <Component />}` means
 * each underlying page only mounts when its tab is active — no upfront
 * cost for tabs the user never opens.
 *
 * Deep-linking works through ?tab=… so /dashboard?tab=jewelry is bookmarkable
 * and the back/forward buttons navigate between tabs naturally.
 *
 * The legacy URLs (/jewelry/dashboard, /jewelry/reports, /crm) redirect into
 * the corresponding tab — see the routes in App.js.
 * ============================================================================ */

const TABS = [
  {
    id: "overview",
    label: "Overview",
    description: "Today across the company",
  },
  {
    id: "stones",
    label: "Stones",
    description: "Inventory, distribution & QA",
  },
  {
    id: "crm",
    label: "CRM",
    description: "Contacts, deals & follow-ups",
  },
  {
    id: "jewelry",
    label: "Jewelry",
    description: "Production, sales & items",
  },
  {
    id: "reports",
    label: "Reports",
    description: "Revenue & performance",
  },
];

const isValidTab = (id) => TABS.some((t) => t.id === id);

/* ─────────────────────────────────────────────────────────────────────────────
 * Wrapper that ensures CrmDashboard renders within the same outer padding
 * as the other tabs (its original container lived inside CrmLayout which
 * provided that padding).
 * ───────────────────────────────────────────────────────────────────────── */
const CrmTabWrapper = () => (
  <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <CrmDashboard />
  </div>
);

/* ───────────────────────────────────────────────────────────────────────── */

const Dashboard = () => {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tabId = isValidTab(requested) ? requested : "overview";

  const setTab = (id) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id === "overview") {
          next.delete("tab"); // keep the URL clean for the default tab
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
      {/* Tab strip — sticky so that long pages still let the user switch
          tabs without scrolling back to the top. Sits just under the global
          TopBar (which is also sticky), so we offset by its height. */}
      <div className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1 overflow-x-auto" aria-label="Dashboard sections">
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
              </button>
            ))}
            {/* Right-side hint: how to deep-link */}
            <span className="ml-auto self-center hidden md:inline text-[11px] text-stone-400 pr-1">
              <Link to="/dashboard" className="hover:text-stone-600">
                Bookmark any tab — URL updates as you switch
              </Link>
            </span>
          </nav>
        </div>
      </div>

      {/* Body — only the active tab is mounted, so the heavy stones-dashboard
          fetch never fires unless the user actually clicks "Stones". */}
      <div>
        {tabId === "overview" && (
          <OverviewTab
            onJumpTab={setTab}
            drillTabs={TABS.filter((t) => t.id !== "overview")}
          />
        )}
        {tabId === "stones" && <HomePage />}
        {tabId === "crm" && <CrmTabWrapper />}
        {tabId === "jewelry" && <JewelryDashboard />}
        {tabId === "reports" && <Reports />}
      </div>
    </div>
  );
};

export default Dashboard;
