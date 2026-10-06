import React, { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";

import HomePage from "./HomePage";              // Stones tab body (the legacy stones dashboard)
import CrmDashboard from "./crm/CrmDashboard";  // CRM tab body
import JewelryDashboard from "./jewelry/JewelryDashboard"; // Jewelry tab body
import Reports from "./jewelry/Reports";        // Reports tab body
import OverviewTab from "../components/dashboard/OverviewTab";
import { useTeam } from "../context/TeamContext";
import "../components/dashboard/dashboard.css";

/* Unified Dashboard — one page hosting the overview and the domain
 * dashboards as tabs. Only the active tab mounts, so a tab's fetches never
 * fire unless it's opened. ?tab= makes every tab bookmarkable; the legacy
 * URLs (/jewelry/dashboard, /jewelry/reports, /crm) redirect into the
 * matching tab — see App.js. */

// `ownerOnly` tabs expose workshop-wide data (every stone, every jewelry item,
// the full revenue report) and are hidden from sales reps.
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "stones", label: "Stones", ownerOnly: true },
  { id: "crm", label: "CRM" },
  { id: "jewelry", label: "Jewelry", ownerOnly: true },
  { id: "reports", label: "Reports", ownerOnly: true },
];

const CrmTabWrapper = () => (
  <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <CrmDashboard />
  </div>
);

const Dashboard = () => {
  const [params] = useSearchParams();
  const team = useTeam();

  // A rep deep-linking into an owner-only tab (an old bookmark) lands on Overview.
  const visibleTabs = useMemo(() => {
    if (team?.isOwner !== false) return TABS;
    return TABS.filter((t) => !t.ownerOnly);
  }, [team?.isOwner]);

  const requested = params.get("tab");
  const tabId = visibleTabs.some((t) => t.id === requested) ? requested : "overview";

  const hrefFor = (id) => {
    const next = new URLSearchParams(params);
    if (id === "overview") next.delete("tab");
    else next.set("tab", id);
    const qs = next.toString();
    return qs ? `/dashboard?${qs}` : "/dashboard";
  };

  return (
    <div className="gd gd-dash">
      {visibleTabs.length > 1 && (
        <div className="gd-dash-bar">
          <nav className="gd-seg" aria-label="Dashboard views">
            {visibleTabs.map((t) => (
              <Link
                key={t.id}
                to={hrefFor(t.id)}
                replace
                className="gd-seg-btn"
                aria-current={tabId === t.id ? "page" : undefined}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {tabId === "overview" && (
        <div className="gd-dash-body">
          <OverviewTab />
        </div>
      )}
      {tabId === "stones" && <HomePage />}
      {tabId === "crm" && <CrmTabWrapper />}
      {tabId === "jewelry" && <JewelryDashboard />}
      {tabId === "reports" && <Reports />}
    </div>
  );
};

export default Dashboard;
