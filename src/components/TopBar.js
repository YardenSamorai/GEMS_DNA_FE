import React from "react";
import { Link, useLocation } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import { useTheme } from "../App";
import { useTeam } from "../context/TeamContext";
// ThemeToggle still uses `useTheme` (light/dark switcher). All other
// chrome (header bar, page title, rep badge, dividers) is now driven
// by the theme-aware `app-*` tokens so we no longer branch on theme.
import MemberAvatar from "./team/MemberAvatar";

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme">
      <div className="theme-toggle-knob">
        {theme === "light" ? (
          <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd"
              d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
              clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-indigo-300" fill="currentColor" viewBox="0 0 20 20">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        )}
      </div>
    </button>
  );
};

/**
 * Computes a friendly page title from the current pathname.
 *
 * Strategy:
 *   1. Walk navItems (and their children) for the deepest match.
 *      Group + child both matching: prefer "Parent · Child".
 *   2. Special-case detail pages we care about.
 *   3. Fallback: empty string.
 */
const getPageTitle = (pathname, navItems) => {
  // Detail pages
  if (pathname.startsWith("/jewelry/items/") && pathname !== "/jewelry/items") {
    return "Jewelry · Item Details";
  }
  if (pathname.startsWith("/jewelry-items/") && pathname !== "/jewelry-items") {
    return "Jewelry · Item Details";
  }

  for (const item of navItems) {
    if (item.children && item.children.length > 0) {
      const child = item.children.find((c) => c.matches(pathname));
      if (child) return `${item.label} · ${child.label}`;
      if (item.matches(pathname)) return item.label;
    } else if (item.matches(pathname)) {
      return item.label;
    }
  }

  // CRM internal sub-routes (CrmLayout still owns its tabs)
  if (pathname.startsWith("/crm/customers/")) return "CRM · Customer";
  if (pathname.startsWith("/crm/contacts")) return "CRM · Contacts";
  if (pathname.startsWith("/crm/deals")) return "CRM · Deals";
  if (pathname.startsWith("/crm/tasks")) return "CRM · Tasks";
  if (pathname.startsWith("/crm/settings")) return "CRM · Settings";

  return "";
};

const TopBar = ({ navItems }) => {
  const location = useLocation();
  const team = useTeam();
  const title = getPageTitle(location.pathname, navItems);
  const showActorBadge = team.ready && team.me && (team.members || []).length > 1;

  return (
    // The outer header carries the glass background and the iOS
    // safe-area top padding, so when installed as a PWA the glass
    // bar extends up under the notch but the inner 48px row sits
    // safely below the clock / battery glyphs.
    <header className="sticky top-0 z-30 glass-bar pt-safe safe-x">
      <div className="flex h-12 items-center justify-between px-3 sm:px-5">
        <div className="flex items-center gap-2 min-w-0">
          {/* On mobile the bottom dock owns navigation, so the TopBar no
              longer carries a hamburger — it now just renders the page
              title. Desktop is unchanged. */}
          <h1 className="truncate text-[13.5px] font-medium tracking-tight text-app-ink">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {showActorBadge && (
            <Link
              to="/team"
              title={team.isOwner ? "Manage team" : "View team"}
              className="hidden sm:inline-flex items-center gap-2 rounded-full pl-1 pr-2.5 py-0.5 text-[11.5px] font-medium transition bg-app-surface/55 hover:bg-app-surface/80 text-app-graphite border border-white/55 backdrop-blur-md"
            >
              <MemberAvatar member={team.me} size="xs" ring={false} />
              <span className="truncate max-w-[120px] text-app-ink">{team.me?.name || "You"}</span>
              <span className="text-[9px] uppercase tracking-[0.14em] text-app-muted">
                {team.isOwner ? "Admin" : "Rep"}
              </span>
            </Link>
          )}
          <ThemeToggle />
          <div className="h-6 w-px hidden sm:block bg-app-line" />
          <UserButton
            afterSignOutUrl={location.pathname}
            appearance={{
              elements: {
                avatarBox: "w-8 h-8 ring-1 ring-app-line ring-offset-2 ring-offset-transparent",
              },
            }}
          />
        </div>
      </div>
    </header>
  );
};

export default TopBar;
