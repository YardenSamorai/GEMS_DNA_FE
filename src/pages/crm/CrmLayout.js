import React, { Suspense, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { useUser } from "@clerk/clerk-react";
import { CheckCircle2, FileText, Files, LayoutList, Settings, Store, TrendingUp, Users } from "lucide-react";
import { fetchDnaLeadsUnreadCount, pingApi } from "../../services/crmApi";
import { PageLoading } from "../../components/RouteLoadingContext";
import "./crm.css";

const POLL_MS = 30_000;
const SEEN_KEY = (uid) => `crm.dnaLeadsSeenAt.${uid || "anon"}`;
const TOAST_KEY = (uid) => `crm.dnaLeadsLastToastedLatest.${uid || "anon"}`;

// The CRM "Home" view lives in the global Dashboard (Dashboard → CRM tab),
// so there is deliberately no Dashboard entry here.
const NAV = [
  { to: "/crm/contacts", label: "Contacts", Icon: Users },
  { to: "/crm/deals", label: "Deals", Icon: TrendingUp },
  { to: "/crm/tasks", label: "Tasks", Icon: CheckCircle2 },
  { to: "/crm/stores", label: "Stores", Icon: Store },
  { to: "/crm/memos", label: "Memos", Icon: FileText },
  { to: "/crm/documents", label: "Documents", Icon: Files },
  { to: "/crm/catalog", label: "Catalog", Icon: LayoutList },
  { to: "/crm/settings", label: "Settings", Icon: Settings },
];

export default function CrmLayout() {
  const location = useLocation();
  const { user } = useUser();
  const [unread, setUnread] = useState(0);
  const seenInitial = useRef(false);

  // Wake the BE up the moment the user enters /crm — this masks Render cold-start delay
  useEffect(() => {
    pingApi();
  }, []);

  // Poll for new DNA leads
  useEffect(() => {
    if (!user?.id) return;
    let active = true;

    const since = (() => {
      try {
        return localStorage.getItem(SEEN_KEY(user.id))
          || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } catch (_) {
        return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      }
    })();

    const tick = async () => {
      try {
        const { count, latest } = await fetchDnaLeadsUnreadCount(since);
        if (!active) return;
        setUnread(count || 0);

        // One-shot toast when a new latest lead appears (skip the very first poll)
        if (count > 0 && latest && seenInitial.current) {
          const lastToasted = localStorage.getItem(TOAST_KEY(user.id));
          if (lastToasted !== latest) {
            toast.success(
              count === 1 ? "New lead from DNA page" : `${count} new leads from DNA page`,
              { icon: "💎", duration: 5000 }
            );
            try { localStorage.setItem(TOAST_KEY(user.id), latest); } catch (_) {}
          }
        }
        seenInitial.current = true;
      } catch (_) { /* swallow */ }
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { active = false; clearInterval(id); };
  }, [user?.id]);

  // When the user opens the contacts page, mark all current DNA leads as seen
  useEffect(() => {
    if (!user?.id) return;
    if (location.pathname.startsWith("/crm/contacts")) {
      try {
        localStorage.setItem(SEEN_KEY(user.id), new Date().toISOString());
        setUnread(0);
      } catch (_) {}
    }
  }, [location.pathname, user?.id]);

  return (
    <div className="crm">
      <div className="crm-page">
        <header className="crm-head">
          <h1 className="crm-title">CRM</h1>
          <p className="crm-subtitle">Contacts, deals and follow-ups</p>
        </header>

        {/* Section tabs — the Inventory segmented control. Phones scroll it
            sideways: the app tab bar owns the bottom edge. */}
        <div className="crm-tabs-scroll">
          <nav aria-label="CRM sections" className="crm-tabs">
            {NAV.map(({ to, label, Icon }) => {
              const badge = to === "/crm/contacts" ? unread : 0;
              return (
                <NavLink key={to} to={to} className="crm-tab">
                  <Icon size={15} strokeWidth={1.9} aria-hidden="true" />
                  {label}
                  {badge > 0 && (
                    <span className="crm-badge" aria-label={`${badge} new DNA leads`}>
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <Suspense fallback={<PageLoading />}>
          <Outlet key={location.pathname} />
        </Suspense>
      </div>
    </div>
  );
}
