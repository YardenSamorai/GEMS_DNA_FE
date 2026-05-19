import React, { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { useTeam } from "../context/TeamContext";

/**
 * Sidebar monogram — v1.0.5 ink tile. Replaces the legacy emerald-gradient
 * diamond with a calm white-on-ink silhouette matching the rest of the
 * system's brand marks (App.js MarketingHeader, portal "GD", FullScreenLoader).
 */
const DiamondLogo = () => (
  <span className="relative inline-flex w-8 h-8 rounded-[10px] bg-app-ink items-center justify-center shadow-[0_4px_12px_-4px_rgba(0,0,0,0.30)] shrink-0">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2 9L12 22L22 9L12 2Z" fill="white" />
      <path d="M2 9H22" stroke="rgba(255,255,255,0.45)" strokeWidth="0.6" />
      <path d="M12 2L8 9L12 22L16 9L12 2Z" fill="white" fillOpacity="0.25" />
    </svg>
    <span className="absolute inset-0 rounded-[10px] ring-1 ring-inset ring-white/15 pointer-events-none" aria-hidden />
  </span>
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
  const team = useTeam();
  // The sidebar uses theme-aware `app-*` tokens throughout, so we no longer
  // need to branch on theme — every fill, border, and label flips through
  // the `data-theme="dark|light"` CSS variables defined in src/index.css.
  const [expanded, setExpanded] = useState(loadExpanded);

  // Collapsed-sidebar flyout state. We render the flyout into <body> via a
  // portal because the <nav> uses overflow-y: auto for scrolling, and a
  // CSS sibling rule (overflow-y: auto + overflow-x: visible) silently
  // collapses to overflow: hidden on both axes — which clipped the flyout
  // at the 64px sidebar boundary and left only the first letter visible.
  // Using a portal positioned fixed at the button's screen rect avoids
  // the clipping entirely.
  const [flyout, setFlyout] = useState(null); // { label, top, left, children } | null
  const closeTimerRef = useRef(null);
  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    // Small grace period so the cursor can travel from the icon to the
    // flyout panel without the panel disappearing en route.
    closeTimerRef.current = setTimeout(() => setFlyout(null), 140);
  };
  const openFlyout = (item, anchorEl) => {
    if (!collapsed) return;
    cancelClose();
    const rect = anchorEl.getBoundingClientRect();
    setFlyout({
      label: item.label,
      top: rect.top,
      left: rect.right + 8,
      children: item.children,
    });
  };

  // Close the flyout on route change (the user clicked a child link).
  useEffect(() => {
    setFlyout(null);
    cancelClose();
  }, [location.pathname]);

  // Cleanup any pending close timer on unmount.
  useEffect(() => () => cancelClose(), []);

  // Filter out owner-only sections / items for sales reps. We do this here
  // (not in App.js) so the same NAV_SECTIONS list still feeds the TopBar
  // title resolver — reps simply never see the entries in their sidebar.
  // Sections with `ownerOnly: true` are dropped wholesale; individual items
  // can also be flagged `ownerOnly: true` for partial hiding.
  const visibleSections = useMemo(() => {
    if (team?.isOwner !== false) return navSections; // owner / loading / unknown -> show all
    return navSections
      .filter((s) => !s.ownerOnly)
      .map((s) => ({
        ...s,
        items: (s.items || []).filter((it) => !it.ownerOnly),
      }))
      .filter((s) => (s.items || []).length > 0);
  }, [navSections, team?.isOwner]);

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
    for (const section of visibleSections) {
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
    `group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium transition ${
      active
        ? "bg-app-ink text-app-canvas shadow-[0_4px_14px_-6px_rgba(0,0,0,0.45)]"
        : "text-app-graphite hover:bg-app-surface/60 hover:text-app-ink"
    } ${extra}`;

  const childLinkClasses = (active) =>
    `flex items-center gap-2 rounded-lg py-1.5 pl-3 pr-2 text-[12.5px] font-medium transition ${
      active
        ? "bg-app-surface/65 text-app-ink"
        : "text-app-muted hover:bg-app-surface/55 hover:text-app-ink"
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
          <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-lg bg-app-ink px-2 py-1 text-[11px] font-medium text-app-canvas opacity-0 shadow-lg transition group-hover:opacity-100 md:block">
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
      <div
        key={item.label}
        className="relative"
        onMouseEnter={(e) => openFlyout(item, e.currentTarget)}
        onMouseLeave={scheduleClose}
      >
        {/* Group header row */}
        <button
          type="button"
          onClick={() => toggleSection(item.label)}
          className={linkClasses(groupActive, `w-full text-left ${collapsed ? "md:justify-center md:px-2" : ""}`)}
        >
          <span className="shrink-0">{item.icon("w-5 h-5")}</span>
          <span className={`flex-1 truncate text-left ${collapsed ? "md:hidden" : ""}`}>{item.label}</span>
          {!collapsed && (
            <Chevron open={isOpen} className={groupActive ? "text-app-canvas/70" : "text-app-soft"} />
          )}
        </button>

        {/* Children when expanded (sidebar wide) */}
        {!collapsed && isOpen && (
          <div className="mt-1 ml-4 border-l border-app-line pl-2 space-y-0.5">
            {item.children.map((child) => {
              const active = child.matches(location.pathname);
              return (
                <Link
                  key={child.to}
                  to={child.to}
                  onClick={onMobileClose}
                  className={childLinkClasses(active)}
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-brand-emerald" : "bg-app-line2"}`} />
                  <span className="truncate">{child.label}</span>
                </Link>
              );
            })}
          </div>
        )}
        {/* Collapsed-mode flyout is rendered via portal in the Sidebar
            root so it isn't clipped by the scrolling <nav>. See `flyout`
            state at the top of this component. */}
      </div>
    );
  };

  const sidebarContent = (
    <>
      <div className={`flex items-center gap-2.5 px-3 pt-4 pb-3 ${collapsed ? "md:justify-center md:px-2" : ""}`}>
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <DiamondLogo />
          <div className={`flex flex-col leading-tight ${collapsed ? "md:hidden" : ""}`}>
            <span className="text-[14px] font-semibold tracking-tight text-app-ink">GEMS DNA</span>
            <span className="text-[9.5px] font-medium tracking-[0.14em] uppercase text-app-muted">
              Diamond Network
            </span>
          </div>
        </Link>
      </div>

      <div className="mx-3 mb-2 border-t border-app-line" />

      <nav className="flex-1 overflow-y-auto overflow-x-visible px-2 py-1">
        {visibleSections.map((section, idx) => (
          <div key={section.label || `__top-${idx}`} className={idx > 0 ? "mt-1" : ""}>
            {section.label && (
              collapsed ? (
                <div className="my-2 hidden items-center justify-center md:flex">
                  <span className="h-0.5 w-6 rounded-full bg-app-line2" />
                </div>
              ) : (
                <div className={`mb-1 flex items-center gap-2 px-3 ${idx > 0 ? "mt-3" : "mt-1"}`}>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-app-line2" />
                  <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-app-muted">
                    {section.label}
                  </span>
                  <div className="h-px flex-1 bg-app-line" />
                </div>
              )
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (item.children ? renderGroup(item) : renderLeaf(item)))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto border-t border-app-line px-2 py-2">
        <button
          onClick={onToggleCollapse}
          className={`hidden md:flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[11.5px] font-medium transition text-app-muted hover:bg-app-surface/55 hover:text-app-ink ${collapsed ? "md:justify-center md:px-2" : ""}`}
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
      {/* Desktop sidebar — glass aside. The inner <nav> handles vertical
          scrolling, and the collapsed-mode flyout is portaled into <body>
          so it isn't clipped by that overflow. */}
      <aside
        className="hidden md:flex flex-col shrink-0 glass-bar border-r border-app-line transition-[width] duration-200 ease-out"
        style={{ width: collapsed ? 64 : 240, height: "100vh", position: "sticky", top: 0 }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile drawer — frosted-glass sheet */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onMobileClose} />
          <aside
            className="absolute left-0 top-0 bottom-0 flex w-72 max-w-[85%] flex-col glass-surface-strong rounded-r-3xl"
            style={{ height: "100dvh", paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Collapsed-sidebar flyout (portal). Rendered into document.body so
          the parent <nav>'s overflow-y:auto can't clip it horizontally. */}
      {collapsed && flyout && typeof document !== "undefined" &&
        createPortal(
          <div
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            style={{
              position: "fixed",
              top: Math.max(8, flyout.top),
              left: flyout.left,
              zIndex: 70,
            }}
            className="hidden md:block w-56 rounded-2xl glass-surface-strong p-2 shadow-xl"
          >
            <div className="mb-1 px-2 py-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-app-muted">
              {flyout.label}
            </div>
            <div className="space-y-0.5">
              {flyout.children.map((child) => {
                const active = child.matches(location.pathname);
                return (
                  <Link
                    key={child.to}
                    to={child.to}
                    onClick={() => { onMobileClose?.(); setFlyout(null); }}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] font-medium transition ${
                      active
                        ? "bg-app-surface/70 text-app-ink"
                        : "text-app-graphite hover:bg-app-surface/55 hover:text-app-ink"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-brand-emerald" : "bg-app-line2"}`} />
                    <span className="truncate">{child.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>,
          document.body
        )
      }
    </>
  );
};

export default Sidebar;
