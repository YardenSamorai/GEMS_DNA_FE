import React, { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { useUser } from "@clerk/clerk-react";
import { fetchDnaLeadsUnreadCount, pingApi } from "../../services/crmApi";

const POLL_MS = 30_000;
const SEEN_KEY = (uid) => `crm.dnaLeadsSeenAt.${uid || "anon"}`;
const TOAST_KEY = (uid) => `crm.dnaLeadsLastToastedLatest.${uid || "anon"}`;

const NAV = [
  // After Sprint 1.A the CRM "Home" view lives in the global Dashboard
  // (Dashboard → CRM tab). We intentionally do NOT add a "Dashboard" entry
  // here because clicking it just bounces the user out of the CRM section,
  // which is confusing. Users reach the CRM dashboard via the sidebar.
  {
    to: "/crm/contacts",
    label: "Contacts",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-7.13a4 4 0 11-8 0 4 4 0 018 0zm6 4a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    to: "/crm/deals",
    label: "Deals",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    to: "/crm/tasks",
    label: "Tasks",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    to: "/crm/stores",
    label: "Stores",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 21h18M3 7v14m18-14v14M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" />
      </svg>
    ),
  },
  {
    to: "/crm/memos",
    label: "Memos",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    to: "/crm/catalog",
    label: "Catalog",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 10h16M4 14h10M4 18h7" />
      </svg>
    ),
  },
  {
    to: "/crm/settings",
    label: "Settings",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
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

  // Inject badge counts into the nav definition
  const navWithBadges = NAV.map((item) =>
    item.to === "/crm/contacts" ? { ...item, badge: unread } : item
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-stone-50 pb-20 sm:pb-12">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-stone-900 tracking-tight">CRM</h1>
            <p className="hidden sm:block text-sm text-stone-500">
              Manage contacts, deals and follow-ups
            </p>
          </div>
        </div>

        {/* Tabs - Desktop */}
        <div className="hidden sm:block border-b border-stone-200 mb-6 overflow-x-auto">
          <nav className="flex gap-1 min-w-max">
            {navWithBadges.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? "border-stone-900 text-stone-900"
                      : "border-transparent text-stone-500 hover:text-stone-800 hover:border-stone-300"
                  }`
                }
              >
                {item.icon}
                {item.label}
                {item.badge > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Page content */}
        <Outlet key={location.pathname} />
      </div>

      {/* Mobile bottom tab bar — uses CSS grid with `repeat(N,1fr)` so it
          stays balanced as we add tabs (Stores + Memos pushed us from 4
          to 6 items). On very narrow screens this still fits because
          each cell is just an icon + tiny label. */}
      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-stone-200 grid"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 0px)",
          gridTemplateColumns: `repeat(${navWithBadges.length}, minmax(0, 1fr))`,
        }}
      >
        {navWithBadges.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                isActive ? "text-stone-900" : "text-stone-400 hover:text-stone-700"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`relative p-1 rounded-lg ${isActive ? "bg-stone-900 text-white" : ""}`}>
                  {item.icon}
                  {item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-emerald-500 text-white text-[9px] font-bold">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </div>
                <span className="truncate max-w-full">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
