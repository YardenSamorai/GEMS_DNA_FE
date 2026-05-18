import React, { useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";

import HomePage from "./HomePage";              // Stones tab body (the legacy stones dashboard)
import CrmDashboard from "./crm/CrmDashboard";  // CRM tab body
import JewelryDashboard from "./jewelry/JewelryDashboard"; // Jewelry tab body
import Reports from "./jewelry/Reports";        // Reports tab body
import OverviewTab from "../components/dashboard/OverviewTab";
import { useTeam } from "../context/TeamContext";

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

// `ownerOnly` tabs are hidden from sales reps — they expose workshop-wide
// data (every stone in inventory, every jewelry item in production, the
// full revenue report) that reps shouldn't see. Reps still get Overview
// (their own KPIs) and CRM (their own contacts/deals/tasks) tabs.
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
    ownerOnly: true,
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
    ownerOnly: true,
  },
  {
    id: "reports",
    label: "Reports",
    description: "Revenue & performance",
    ownerOnly: true,
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
  const team = useTeam();

  // Reps only see Overview + CRM. If a rep deep-links into one of the
  // owner-only tabs (e.g. /dashboard?tab=stones from an old bookmark) we
  // silently coerce them back to the safe Overview tab.
  const visibleTabs = useMemo(() => {
    if (team?.isOwner !== false) return TABS;
    return TABS.filter((t) => !t.ownerOnly);
  }, [team?.isOwner]);

  const requested = params.get("tab");
  const tabIsAllowed = visibleTabs.some((t) => t.id === requested);
  const tabId = tabIsAllowed ? requested : "overview";

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
    <div className="min-h-screen">
      {/* Tab strip — segmented glass control, sticky so long pages can still
          switch tabs without scrolling back up. Inactive items are quiet
          glass; the active tab gets the ink fill (same idiom as the portal
          sub-nav). The bookmark hint sits to the right at md+. */}
      <div className="sticky top-12 z-20 glass-bar">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2.5 flex items-center gap-3">
          <nav
            className="flex gap-1 overflow-x-auto scrollbar-hide rounded-full glass-surface px-1.5 py-1"
            aria-label="Dashboard sections"
          >
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tabId === t.id ? "page" : undefined}
                className={`relative px-3.5 py-1.5 text-[12.5px] font-medium whitespace-nowrap rounded-full transition-colors ${
                  tabId === t.id
                    ? "bg-app-ink text-app-canvas shadow-[0_4px_14px_-6px_rgba(0,0,0,0.45)]"
                    : "text-app-graphite hover:text-app-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <span className="ml-auto self-center hidden md:inline text-[10.5px] text-app-soft">
            <Link to="/dashboard" className="hover:text-app-graphite">
              Bookmark any tab — URL updates as you switch
            </Link>
          </span>
        </div>
      </div>

      {/* Body — only the active tab is mounted, so the heavy stones-dashboard
          fetch never fires unless the user actually clicks "Stones". */}
      <div>
        {tabId === "overview" && (
          <OverviewTab
            onJumpTab={setTab}
            // Drill-down chips on Overview should only point at tabs the
            // current actor can actually open.
            drillTabs={visibleTabs.filter((t) => t.id !== "overview")}
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
