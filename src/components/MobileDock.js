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
    key: "sales",
    label: "Sales",
    // Default landing surface for the sales catalog is Emeralds.
    to: "/sales/emeralds",
    matches: (path) => path.startsWith("/sales"),
    icon: (cls) => (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
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

/* Contextual dock used while browsing the sales catalog (/sales/*). Swaps the
 * generic admin rail for category shortcuts: Home, the three catalog surfaces
 * (Diamonds / Emeralds / Gemstones) and Jewelry. The "More" tile still opens
 * the full menu, so nothing is lost. */
const SALES_SLOTS = [
  {
    key: "home",
    label: "Dashboard",
    to: "/sales/dashboard",
    matches: (path) => path.startsWith("/sales/dashboard"),
    icon: (cls) => (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3.5 11.25L12 4l8.5 7.25M5.5 9.6V19a1 1 0 001 1h3.5v-5.75h4V20h3.5a1 1 0 001-1V9.6" />
      </svg>
    ),
  },
  {
    // Side-view brilliant cut — full outline + crown & pavilion facets.
    key: "diamond",
    label: "Diamond",
    to: "/sales/diamonds",
    matches: (path) => path.startsWith("/sales/diamonds"),
    icon: (cls) => (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.3} d="M9 3.5h6L20 9l-8 11.5L4 9l5-5.5zM4 9h16M9 3.5L6.5 9l5.5 11.5L17.5 9 15 3.5M9 3.5L12 9l3-5.5M12 9v11.5" />
      </svg>
    ),
  },
  {
    // Top-view emerald step cut — octagon outline, inner step and corner facets.
    key: "emerald",
    label: "Emeralds",
    to: "/sales/emeralds",
    matches: (path) => path.startsWith("/sales/emeralds"),
    icon: (cls) => (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.3} d="M8 3.5h8L20.5 8v8L16 20.5H8L3.5 16V8L8 3.5zM9.2 6.5h5.6l2.7 2.7v5.6l-2.7 2.7H9.2l-2.7-2.7V9.2l2.7-2.7zM8 3.5l1.2 3M16 3.5l-1.2 3M20.5 8l-3 1.2M20.5 16l-3-1.2M16 20.5l-1.2-3M8 20.5l1.2-3M3.5 16l3-1.2M3.5 8l3 1.2" />
      </svg>
    ),
  },
  {
    // Top-view round brilliant — girdle circle, octagonal table, radial facets.
    key: "gemstones",
    label: "Gemstones",
    to: "/sales/inventory",
    matches: (path) => path.startsWith("/sales/inventory") || path.startsWith("/sales/gemstones"),
    icon: (cls) => (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <circle cx="12" cy="12" r="8.5" strokeWidth={1.3} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.3} d="M12 7.2l3.4 1.4 1.4 3.4-1.4 3.4-3.4 1.4-3.4-1.4-1.4-3.4 1.4-3.4L12 7.2zM12 3.5v3.7M20.5 12h-3.7M12 20.5v-3.7M3.5 12h3.7M18 6l-2.6 2.6M18 18l-2.6-2.6M6 18l2.6-2.6M6 6l2.6 2.6" />
      </svg>
    ),
  },
  {
    // Engagement ring — band with a faceted solitaire on top.
    key: "jewelry",
    label: "Jewelry",
    to: "/sales/jewelry",
    matches: (path) => path.startsWith("/sales/jewelry"),
    icon: (cls) => (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <circle cx="12" cy="15.25" r="5.75" strokeWidth={1.3} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.3} d="M8.8 6.2l1.6-2.7h3.2l1.6 2.7L12 9.5 8.8 6.2zM8.8 6.2h6.4M10.4 3.5L12 6.2l1.6-2.7" />
      </svg>
    ),
  },
];

/* Just the catalog categories (no Home / More) — used by the floating tablet
 * bar that gives iPad users a touch-friendly category switcher, since the
 * full-width phone dock is hidden at md+ where the sidebar takes over. */
const SALES_CATEGORY_SLOTS = SALES_SLOTS.filter((s) =>
  ["diamond", "emerald", "gemstones", "jewelry"].includes(s.key)
);

// Maps a dock tile to the permission section it belongs to, so we can hide
// tiles a member isn't allowed to open. The sales category tiles all live
// under the "sales" section.
const SLOT_SECTION = {
  dashboard: "dashboard",
  home: "sales",
  inventory: "inventory",
  sales: "sales",
  crm: "crm",
  diamond: "sales",
  emerald: "sales",
  gemstones: "sales",
  jewelry: "sales",
};

const MoreIcon = (cls) => (
  <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const DockTile = ({ active, label, icon, onClick, to, compact }) => {
  const inner = (
    <span
      className={`flex flex-col items-center justify-center gap-1 rounded-2xl py-2 transition-colors ${
        compact ? "px-2" : "px-3.5"
      } ${
        active
          ? "bg-emerald-500/10 text-emerald-600"
          : "text-app-graphite hover:text-app-ink"
      }`}
    >
      {icon(compact ? "w-[24px] h-[24px]" : "w-[26px] h-[26px]")}
      <span
        className={`tracking-[0.01em] leading-none ${
          active ? "font-bold" : "font-semibold"
        } ${compact ? "text-[10px]" : "text-[11px]"}`}
      >
        {label}
      </span>
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
  // When a text field is focused the iOS keyboard opens and would shove this
  // `fixed bottom-0` dock up above the keyboard (looks broken). We track field
  // focus and slide the dock out of the way while typing — like a native app.
  const [inputFocused, setInputFocused] = useState(false);

  // Close the "More" sheet on route change.
  useEffect(() => { setSheetOpen(false); }, [location.pathname]);

  // Hide the dock while an editable field has focus (keyboard is open).
  useEffect(() => {
    const isEditable = (el) => {
      if (!el) return false;
      const tag = el.tagName;
      if (tag === "TEXTAREA" || tag === "SELECT") return true;
      if (tag === "INPUT") {
        const type = (el.getAttribute("type") || "text").toLowerCase();
        // Non-text inputs (checkbox, range, etc.) don't open the keyboard.
        return !["checkbox", "radio", "button", "submit", "reset", "range", "color", "file", "image"].includes(type);
      }
      return el.isContentEditable;
    };
    const onFocusIn = (e) => { if (isEditable(e.target)) setInputFocused(true); };
    const onFocusOut = () => {
      // Defer so tabbing field→field doesn't flash the dock between blurs.
      setTimeout(() => {
        if (!isEditable(document.activeElement)) setInputFocused(false);
      }, 0);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  // The "More" sheet lists everything the dock can't fit. We derive its
  // contents from the same navSections the Sidebar consumes so a single
  // source of truth keeps the two surfaces in sync.
  const moreEntries = (() => {
    const flat = [];
    const dockKeys = new Set(["/dashboard", "/inventory", "/sales/inventory", "/crm/contacts"]);
    for (const section of navSections) {
      for (const item of section.items || []) {
        // Skip items already represented in the primary dock to avoid a
        // duplicate row in the sheet. Workshop is not in the dock, so it
        // falls through and renders as a normal group (with its children).
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

  // Roles & permissions — non-admins only get the dock tiles for sections the
  // admin granted them.
  const gated = team?.ready && !team?.isAdmin && !team?.isStoreUser;
  const canSection = (key) => team?.isAdmin || (team?.can ? team.can(key) : true);
  const roleLabel = team?.isAdmin
    ? "Admin"
    : team?.isManager
    ? "Manager"
    : team?.isSalesman
    ? "Salesman"
    : "Member";

  // On the sales catalog, swap the generic rail for category shortcuts.
  const inSales = location.pathname.startsWith("/sales");
  const baseSlots = inSales ? SALES_SLOTS : PRIMARY_SLOTS;
  const slots = gated
    ? baseSlots.filter((s) => {
        const sec = SLOT_SECTION[s.key];
        return !sec || canSection(sec);
      })
    : baseSlots;
  // 5 shortcuts + "More" = 6 tiles, so tighten the layout to fit on phones.
  const compact = slots.length > 4;

  const moreActive = !slots.some((slot) => slot.matches(location.pathname));

  return (
    <>
      {/* Floating tablet category bar — iPad sits at md+ (where the phone dock
          is hidden and the sidebar takes over), so we give it a centered,
          touch-friendly pill to hop between catalog categories. Shown only on
          /sales pages and only in the tablet width band (md → xl). */}
      {inSales && (
        <nav
          className="hidden md:flex xl:hidden fixed left-1/2 z-40 -translate-x-1/2 dock-bar rounded-full border border-app-line shadow-[0_12px_34px_-10px_rgba(0,0,0,0.45)]"
          style={{
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)",
            transform: inputFocused
              ? "translate3d(-50%, 150%, 0)"
              : "translate3d(-50%, 0, 0)",
            transition: "transform 0.2s ease-out",
            willChange: "transform",
            WebkitBackfaceVisibility: "hidden",
            backfaceVisibility: "hidden",
          }}
          aria-label="Sales categories"
        >
          <div className="flex items-center gap-1 px-2 py-1.5">
            {SALES_CATEGORY_SLOTS.map((slot) => {
              const active = slot.matches(location.pathname);
              return (
                <Link
                  key={slot.key}
                  to={slot.to}
                  className={`flex flex-col items-center gap-1 rounded-full px-4 py-2 transition-colors ${
                    active
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "text-app-graphite hover:text-app-ink"
                  }`}
                >
                  {slot.icon("w-6 h-6")}
                  <span className={`text-[11px] leading-none ${active ? "font-bold" : "font-semibold"}`}>
                    {slot.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {/* Bottom dock — fixed, solid bar, safe-area padded. Hidden on md+.
          iOS Safari fails to repaint a thin `position: fixed` bar during
          momentum scroll, leaving it stranded mid-screen until the scroll
          settles. Forcing it onto its own GPU compositor layer (translate3d +
          will-change + backface-visibility) makes Safari keep it pinned. We
          drive the transform inline (instead of Tailwind's 2D translate
          utilities) so the hidden/shown states stay on that same 3D layer. */}
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-40 dock-bar border-t border-app-line"
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          transform: inputFocused ? "translate3d(0, 100%, 0)" : "translate3d(0, 0, 0)",
          transition: "transform 0.2s ease-out",
          willChange: "transform",
          WebkitBackfaceVisibility: "hidden",
          backfaceVisibility: "hidden",
        }}
        aria-label="Primary navigation"
      >
        <div className={`flex items-stretch h-[74px] ${compact ? "px-1" : "px-1.5"}`}>
          {slots.map((slot) => (
            <DockTile
              key={slot.key}
              to={slot.to}
              label={slot.label}
              icon={slot.icon}
              active={slot.matches(location.pathname)}
              compact={compact}
            />
          ))}
          <DockTile
            label="More"
            icon={MoreIcon}
            active={moreActive || sheetOpen}
            onClick={() => setSheetOpen((s) => !s)}
            compact={compact}
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
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 74px)" }}
              role="dialog"
              aria-label="More navigation"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1.5 bg-app-line2 rounded-full" />
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-4">
                {/* Actor row — who am I, current role, quick path into team
                    mgmt. Non-admins can't open /team, so their row is static. */}
                {team?.ready && team?.me && (() => {
                  const canTeam = canSection("team");
                  const RowTag = canTeam ? Link : "div";
                  const rowProps = canTeam
                    ? { to: "/team", onClick: () => setSheetOpen(false) }
                    : {};
                  return (
                    <RowTag
                      {...rowProps}
                      className="flex items-center gap-3 rounded-2xl bg-app-canvas2 border border-app-line px-3 py-2.5 mb-4 active:bg-app-line transition"
                    >
                      <MemberAvatar member={team.me} size="sm" ring={false} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold tracking-tight text-app-ink truncate">
                          {team.me?.name || "You"}
                        </div>
                        <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-app-muted">
                          {roleLabel}
                          {canTeam && team.members?.length > 1 ? ` · ${team.members.length} members` : ""}
                        </div>
                      </div>
                      {canTeam && (
                        <svg className="w-4 h-4 text-app-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </RowTag>
                  );
                })()}

                {/* Long-tail nav — single-list, solid rows for every section
                    that isn't pinned to the bottom dock. */}
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
