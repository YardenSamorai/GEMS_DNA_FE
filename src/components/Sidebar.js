import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "../App";

const DiamondLogo = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
    <path d="M12 2L2 9L12 22L22 9L12 2Z" fill="url(#sb-diamond-gradient)" />
    <path d="M2 9H22" stroke="white" strokeWidth="0.5" strokeOpacity="0.5" />
    <path d="M12 2L8 9L12 22L16 9L12 2Z" fill="white" fillOpacity="0.2" />
    <defs>
      <linearGradient id="sb-diamond-gradient" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#34d399" />
        <stop offset="1" stopColor="#059669" />
      </linearGradient>
    </defs>
  </svg>
);

const EXPANDED_KEY = "sidebar-expanded-sections";
const loadExpanded = () => {
  try {
    const raw = localStorage.getItem(EXPANDED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
};
const saveExpanded = (set) => {
  try { localStorage.setItem(EXPANDED_KEY, JSON.stringify(Array.from(set))); } catch {}
};

const Chevron = ({ open, className = "" }) => (
  <svg className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""} ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5l7 7-7 7" />
  </svg>
);

/**
 * Notion-style collapsible sidebar with section headers + optional nested items.
 *
 * navSections is an array of:
 *   {
 *     label?: string,          // section header label (omit for top items with no header)
 *     dot?: string,            // tailwind class for the section's colored dot (e.g. "bg-emerald-500")
 *     items: [
 *       { to, label, icon(cls), matches(path) }                            // leaf
 *       { to?, label, icon(cls), matches(path), children: [ ...leaves ] }  // group
 *     ]
 *   }
 *
 * - Sidebar widths: 240px expanded / 64px collapsed (persisted)
 * - Group expand/collapse state persisted; auto-expanded when current path
 *   matches one of the group's children
 * - When sidebar is collapsed: hovering a group icon shows a flyout to the
 *   right listing its children. Section headers collapse to a thin colored
 *   divider so the section grouping is still visible.
 */
const Sidebar = ({ navSections = [], collapsed, onToggleCollapse, mobileOpen, onMobileClose }) => {
  const location = useLocation();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [expanded, setExpanded] = useState(loadExpanded);

  const toggleSection = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      saveExpanded(next);
      return next;
    });
  };

  // Auto-expand a group whenever a route inside it becomes active
  useEffect(() => {
    let changed = false;
    const next = new Set(expanded);
    for (const section of navSections) {
      for (const item of section.items) {
        if (!item.children) continue;
        const childActive = item.children.some((c) => c.matches(location.pathname));
        if (childActive && !next.has(item.label)) {
          next.add(item.label);
          changed = true;
        }
      }
    }
    if (changed) {
      setExpanded(next);
      saveExpanded(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const linkClasses = (active, extra = "") =>
    `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
      active
        ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/25"
        : isDark
          ? "text-stone-300 hover:bg-stone-800 hover:text-stone-100"
          : "text-stone-700 hover:bg-stone-100 hover:text-stone-900"
    } ${extra}`;

  const childLinkClasses = (active) =>
    `flex items-center gap-2 rounded-md py-1.5 pl-3 pr-2 text-[13px] font-medium transition ${
      active
        ? isDark
          ? "bg-stone-800 text-emerald-400"
          : "bg-emerald-50 text-emerald-700"
        : isDark
          ? "text-stone-400 hover:bg-stone-800 hover:text-stone-100"
          : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
    }`;

  const renderLeaf = (item) => {
    const active = item.matches(location.pathname);
    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={onMobileClose}
        title={collapsed ? item.label : undefined}
        className={linkClasses(active, collapsed ? "md:justify-center md:px-2" : "")}
      >
        <span className="shrink-0">{item.icon("w-5 h-5")}</span>
        <span className={`truncate ${collapsed ? "md:hidden" : ""}`}>{item.label}</span>
        {collapsed && (
          <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-stone-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100 md:block">
            {item.label}
          </span>
        )}
      </Link>
    );
  };

  const renderGroup = (item) => {
    const isOpen = expanded.has(item.label);
    const childActive = item.children.some((c) => c.matches(location.pathname));
    const groupActive = childActive || (item.to ? item.matches(location.pathname) : false);

    return (
      <div key={item.label} className="group/section relative">
        {/* Group header row */}
        <button
          type="button"
          onClick={() => toggleSection(item.label)}
          className={linkClasses(groupActive, `w-full text-left ${collapsed ? "md:justify-center md:px-2" : ""}`)}
        >
          <span className="shrink-0">{item.icon("w-5 h-5")}</span>
          <span className={`flex-1 truncate text-left ${collapsed ? "md:hidden" : ""}`}>{item.label}</span>
          {!collapsed && (
            <Chevron open={isOpen} className={groupActive ? "text-white/80" : isDark ? "text-stone-500" : "text-stone-400"} />
          )}
          {/* Tooltip when collapsed (label only) */}
          {collapsed && (
            <span className="pointer-events-none absolute left-full top-0 ml-2 hidden whitespace-nowrap rounded-md bg-stone-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition md:block group-hover/section:opacity-0" />
          )}
        </button>

        {/* Children when expanded (sidebar wide) */}
        {!collapsed && isOpen && (
          <div className={`mt-1 ml-4 border-l ${isDark ? "border-stone-800" : "border-stone-200"} pl-2 space-y-0.5`}>
            {item.children.map((child) => {
              const active = child.matches(location.pathname);
              return (
                <Link
                  key={child.to}
                  to={child.to}
                  onClick={onMobileClose}
                  className={childLinkClasses(active)}
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-emerald-500" : isDark ? "bg-stone-600" : "bg-stone-300"}`} />
                  <span className="truncate">{child.label}</span>
                </Link>
              );
            })}
          </div>
        )}

        {/* Flyout when sidebar collapsed (desktop) */}
        {collapsed && (
          <div className={`pointer-events-none absolute left-full top-0 z-50 ml-2 hidden w-56 rounded-xl border p-2 opacity-0 shadow-xl transition md:block group-hover/section:pointer-events-auto group-hover/section:opacity-100 ${
            isDark ? "border-stone-800 bg-stone-900" : "border-stone-200 bg-white"
          }`}>
            <div className={`mb-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider ${isDark ? "text-stone-500" : "text-stone-400"}`}>
              {item.label}
            </div>
            <div className="space-y-0.5">
              {item.children.map((child) => {
                const active = child.matches(location.pathname);
                return (
                  <Link
                    key={child.to}
                    to={child.to}
                    onClick={onMobileClose}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium transition ${
                      active
                        ? isDark
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-emerald-50 text-emerald-700"
                        : isDark
                          ? "text-stone-300 hover:bg-stone-800"
                          : "text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-emerald-500" : isDark ? "bg-stone-600" : "bg-stone-300"}`} />
                    <span className="truncate">{child.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const sidebarContent = (
    <>
      <div className={`flex items-center gap-2.5 px-3 pt-4 pb-3 ${collapsed ? "md:justify-center md:px-2" : ""}`}>
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <DiamondLogo />
          <div className={`flex flex-col leading-tight ${collapsed ? "md:hidden" : ""}`}>
            <span className="text-base font-bold text-gradient">GEMS DNA</span>
            <span className={`text-[9px] font-medium tracking-widest uppercase ${isDark ? "text-stone-500" : "text-stone-400"}`}>
              Diamond Network
            </span>
          </div>
        </Link>
      </div>

      <div className={`mx-3 mb-2 border-t ${isDark ? "border-stone-800" : "border-stone-200"}`} />

      <nav className="flex-1 overflow-y-auto overflow-x-visible px-2 py-1">
        {navSections.map((section, idx) => (
          <div key={section.label || `__top-${idx}`} className={idx > 0 ? "mt-1" : ""}>
            {section.label && (
              collapsed ? (
                /* Collapsed: thin colored bar so the section grouping is still visible */
                <div className="my-2 hidden items-center justify-center md:flex">
                  <span className={`h-0.5 w-6 rounded-full ${section.dot || (isDark ? "bg-stone-700" : "bg-stone-200")}`} />
                </div>
              ) : (
                /* Expanded: colored dot + uppercase label + divider line */
                <div className={`mb-1 flex items-center gap-2 px-3 ${idx > 0 ? "mt-3" : "mt-1"}`}>
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${section.dot || (isDark ? "bg-stone-600" : "bg-stone-300")}`} />
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-stone-500" : "text-stone-400"}`}>
                    {section.label}
                  </span>
                  <div className={`h-px flex-1 ${isDark ? "bg-stone-800" : "bg-stone-200"}`} />
                </div>
              )
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (item.children ? renderGroup(item) : renderLeaf(item)))}
            </div>
          </div>
        ))}
      </nav>

      <div className={`mt-auto border-t px-2 py-2 ${isDark ? "border-stone-800" : "border-stone-200"}`}>
        <button
          onClick={onToggleCollapse}
          className={`hidden md:flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${
            isDark ? "text-stone-400 hover:bg-stone-800 hover:text-stone-100" : "text-stone-500 hover:bg-stone-100 hover:text-stone-700"
          } ${collapsed ? "md:justify-center md:px-2" : ""}`}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {collapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            )}
          </svg>
          <span className={collapsed ? "md:hidden" : ""}>Collapse</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar (overflow-x-visible so flyouts can escape) */}
      <aside
        className={`hidden md:flex flex-col shrink-0 border-r transition-[width] duration-200 ease-out ${
          isDark ? "bg-stone-950 border-stone-800" : "bg-white border-stone-200"
        }`}
        style={{ width: collapsed ? 64 : 240, height: "100vh", position: "sticky", top: 0 }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={onMobileClose} />
          <aside
            className={`absolute left-0 top-0 bottom-0 flex w-72 max-w-[85%] flex-col shadow-2xl ${
              isDark ? "bg-stone-950" : "bg-white"
            }`}
            style={{ height: "100dvh", paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};

export default Sidebar;
