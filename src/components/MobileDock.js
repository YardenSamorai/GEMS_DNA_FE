import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTeam } from "../context/TeamContext";
import MemberAvatar from "./team/MemberAvatar";
import { useTheme } from "../App";

/**
 * MobileDock — bottom navigation rail for the GEMS DNA admin shell.
 *
 * Replaces the legacy mobile drawer (which read as a dark slab and was
 * hard to discover behind the hamburger). On phones we surface the four
 * most-used destinations as a thumb-reachable dock, plus a "More" tile
 * that opens a sheet for the longer tail (Team, Data Quality, jewelry
 * sub-items, theme, signed-in actor).
 *
 * Hidden on `md:` and up — desktop keeps the left sidebar.
 *
 * Props:
 *   - navSections: same shape the Sidebar consumes, used to derive the
 *     "More" sheet entries and to highlight the active dock tile.
 */
const PRIMARY_SLOTS = [
  {
    key: "dashboard",
    label: "Dashboard",
    to: "/dashboard",
    matches: (path) => path === "/dashboard" || path.startsWith("/dashboard"),
    icon: (cls) => (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    key: "inventory",
    label: "Inventory",
    to: "/inventory",
    matches: (path) =>
      path === "/inventory" ||
      path.startsWith("/inventory") ||
      path === "/jewelry" ||
      path === "/jewelry/" ||
      path === "/jewelry/items" ||
      path === "/jewelry-items",
    icon: (cls) => (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    key: "production",
    label: "Workshop",
    to: "/jewelry/production",
    matches: (path) => path.startsWith("/jewelry/"),
    icon: (cls) => (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 3l3.057-3 4.886 0L16 3l4 5-8 13L4 8l1-5z" />
      </svg>
    ),
  },
  {
    key: "crm",
    label: "CRM",
    to: "/crm/contacts",
    matches: (path) => path.startsWith("/crm"),
    icon: (cls) => (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-7.13a4 4 0 11-8 0 4 4 0 018 0zm6 4a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const MoreIcon = (cls) => (
  <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const DockTile = ({ active, label, icon, onClick, to }) => {
  const inner = (
    <span
      className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-1.5 transition-colors ${
        active
          ? "bg-app-ink/8 text-app-ink"
          : "text-app-muted hover:text-app-graphite"
      }`}
    >
      {icon("w-[22px] h-[22px]")}
      <span className="text-[10.5px] font-medium tracking-[0.01em] leading-none">{label}</span>
    </span>
  );
  if (to) {
    return (
      <Link to={to} onClick={onClick} className="flex flex-1 justify-center min-w-0">
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className="flex flex-1 justify-center min-w-0">
      {inner}
    </button>
  );
};

const MobileDock = ({ navSections = [] }) => {
  const location = useLocation();
  const team = useTeam();
  const { theme, toggleTheme } = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Close the "More" sheet on route change.
  useEffect(() => { setSheetOpen(false); }, [location.pathname]);

  // The "More" sheet lists everything the dock can't fit. We derive its
  // contents from the same navSections the Sidebar consumes so a single
  // source of truth keeps the two surfaces in sync.
  const moreEntries = (() => {
    const flat = [];
    const dockKeys = new Set(["/dashboard", "/inventory", "/jewelry/production", "/crm/contacts"]);
    for (const section of navSections) {
      for (const item of section.items || []) {
        // Skip items already represented in the primary dock to avoid a
        // duplicate row in the sheet. Jewelry sub-children are still
        // listed under a "Workshop" group below.
        if (item.to && dockKeys.has(item.to)) continue;
        if (item.children && item.children.length) {
          flat.push({ kind: "group", label: item.label, icon: item.icon, children: item.children });
        } else {
          flat.push({ kind: "leaf", label: item.label, icon: item.icon, to: item.to, matches: item.matches });
        }
      }
    }
    return flat;
  })();

  // Workshop sub-routes — surfaced as a quick-jump strip inside the
  // sheet so users can land on Sold / Designs / Settings without going
  // through the Production page first.
  const workshopGroup = (() => {
    for (const section of navSections) {
      for (const item of section.items || []) {
        if (item.to === "/jewelry/production" && item.children) {
          return item.children.filter((c) => c.to !== "/jewelry/production");
        }
      }
    }
    return [];
  })();

  const moreActive = !PRIMARY_SLOTS.some((slot) => slot.matches(location.pathname));

  return (
    <>
      {/* Bottom dock — fixed, glass bar, safe-area padded. Hidden on md+ */}
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-40 glass-bar border-t border-app-line"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        aria-label="Primary navigation"
      >
        <div className="flex items-stretch h-14 px-1.5">
          {PRIMARY_SLOTS.map((slot) => (
            <DockTile
              key={slot.key}
              to={slot.to}
              label={slot.label}
              icon={slot.icon}
              active={slot.matches(location.pathname)}
            />
          ))}
          <DockTile
            label="More"
            icon={MoreIcon}
            active={moreActive || sheetOpen}
            onClick={() => setSheetOpen((s) => !s)}
          />
        </div>
      </nav>

      {/* "More" sheet — bottom sheet with the long tail of nav entries.
          Solid surface (not glass) so the list reads clearly against the
          page content underneath. */}
      <AnimatePresence>
        {sheetOpen && (
          <div className="md:hidden fixed inset-0 z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setSheetOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="absolute inset-x-0 bottom-0 bg-app-surface border-t border-app-line rounded-t-3xl max-h-[85vh] overflow-hidden flex flex-col"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 64px)" }}
              role="dialog"
              aria-label="More navigation"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1.5 bg-app-line2 rounded-full" />
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-4">
                {/* Actor row — who am I, current role, quick path into team mgmt */}
                {team?.ready && team?.me && (
                  <Link
                    to="/team"
                    onClick={() => setSheetOpen(false)}
                    className="flex items-center gap-3 rounded-2xl bg-app-canvas2 border border-app-line px-3 py-2.5 mb-4 active:bg-app-line transition"
                  >
                    <MemberAvatar member={team.me} size="sm" ring={false} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold tracking-tight text-app-ink truncate">
                        {team.me?.name || "You"}
                      </div>
                      <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-app-muted">
                        {team.isOwner ? "Admin" : "Rep"} {team.members?.length > 1 ? `· ${team.members.length} members` : ""}
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-app-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )}

                {/* Workshop sub-routes — quick-jump strip. Only show when
                    something other than the production board exists. */}
                {workshopGroup.length > 0 && (
                  <div className="mb-5">
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-app-line2" />
                      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-app-muted">
                        Workshop
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {workshopGroup.map((child) => {
                        const active = child.matches(location.pathname);
                        return (
                          <Link
                            key={child.to}
                            to={child.to}
                            onClick={() => setSheetOpen(false)}
                            className={`flex flex-col items-center justify-center text-center rounded-2xl border px-2 py-3 transition ${
                              active
                                ? "bg-app-ink text-app-canvas border-app-ink"
                                : "bg-app-canvas2 border-app-line text-app-graphite active:bg-app-line"
                            }`}
                          >
                            <span className="text-[12px] font-medium tracking-tight leading-tight">
                              {child.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Long-tail nav — single-list, solid rows. */}
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-app-line2" />
                    <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-app-muted">
                      All sections
                    </span>
                  </div>
                  <div className="space-y-1">
                    {moreEntries.map((entry) => {
                      if (entry.kind === "leaf") {
                        const active = entry.matches?.(location.pathname);
                        return (
                          <Link
                            key={entry.to}
                            to={entry.to}
                            onClick={() => setSheetOpen(false)}
                            className={`flex items-center gap-3 rounded-2xl border px-3 py-3 transition ${
                              active
                                ? "bg-app-ink text-app-canvas border-app-ink"
                                : "bg-app-canvas2 border-app-line text-app-ink active:bg-app-line"
                            }`}
                          >
                            <span className={active ? "text-app-canvas" : "text-app-graphite"}>
                              {entry.icon("w-5 h-5")}
                            </span>
                            <span className="text-[13.5px] font-medium tracking-tight flex-1 truncate">
                              {entry.label}
                            </span>
                            <svg
                              className={`w-4 h-4 ${active ? "text-app-canvas/70" : "text-app-soft"}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        );
                      }
                      // Group: render parent label + child grid
                      return (
                        <div key={entry.label} className="rounded-2xl bg-app-canvas2 border border-app-line p-2">
                          <div className="flex items-center gap-3 px-1 py-1.5">
                            <span className="text-app-graphite">{entry.icon("w-5 h-5")}</span>
                            <span className="text-[13px] font-semibold tracking-tight text-app-ink flex-1">
                              {entry.label}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 mt-1">
                            {entry.children.map((child) => {
                              const active = child.matches(location.pathname);
                              return (
                                <Link
                                  key={child.to}
                                  to={child.to}
                                  onClick={() => setSheetOpen(false)}
                                  className={`text-[12.5px] font-medium tracking-tight rounded-xl px-2.5 py-2 transition ${
                                    active
                                      ? "bg-app-ink text-app-canvas"
                                      : "bg-app-surface text-app-graphite border border-app-line active:bg-app-canvas2"
                                  }`}
                                >
                                  {child.label}
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Preferences */}
                <div>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-app-line2" />
                    <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-app-muted">
                      Preferences
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { toggleTheme(); }}
                    className="w-full flex items-center gap-3 rounded-2xl border border-app-line bg-app-canvas2 px-3 py-3 text-left active:bg-app-line transition"
                  >
                    <span className="text-app-graphite">
                      {theme === "light" ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                        </svg>
                      )}
                    </span>
                    <div className="flex-1">
                      <div className="text-[13px] font-medium tracking-tight text-app-ink">
                        {theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
                      </div>
                      <div className="text-[10.5px] uppercase tracking-[0.14em] text-app-muted">
                        Current: {theme}
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default MobileDock;
