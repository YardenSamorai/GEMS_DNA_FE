import React, { useState, useEffect, createContext, useContext } from "react";
import { BrowserRouter as Router, Route, Routes, useLocation, Link, Navigate, Outlet } from "react-router-dom";
import { SignedIn, SignedOut, UserButton, useAuth, AuthenticateWithRedirectCallback } from "@clerk/clerk-react";
import DiamondCard from "./pages/DiamondCard";
import Dashboard from "./pages/Dashboard";
import JewelryPage from "./pages/JewelryPage";
import OnboardingPage from "./pages/OnboardingPage";
import { Toaster } from "react-hot-toast";
import InventoryHub from "./pages/InventoryHub";
import CustomerSharePage from "./pages/share/CustomerSharePage";
import SignaturePage from "./pages/sign/SignaturePage";
import { SignInPage, SignUpPage } from "./pages/auth/AuthPage";
import LoginSheet from "./components/LoginSheet";
import { motion } from "framer-motion";
import SalesInventory from "./pages/sales/SalesInventory";
import SalesJewelry from "./pages/sales/SalesJewelry";
import StoneDetail from "./pages/sales/StoneDetail";
import JewelryDetail from "./pages/sales/JewelryDetail";
import SalesDashboard from "./pages/sales/SalesDashboard";
import QAPage from "./pages/QAPage";
import CrmLayout from "./pages/crm/CrmLayout";
import CrmContacts from "./pages/crm/CrmContacts";
import CrmCompanies from "./pages/crm/CrmCompanies";
import StoreProfile from "./pages/crm/StoreProfile";
import CrmMemos from "./pages/crm/CrmMemos";
import MemoDetail from "./pages/crm/MemoDetail";
import CrmDocuments from "./pages/crm/CrmDocuments";
import CustomerProfile from "./pages/crm/CustomerProfile";
import CrmDeals from "./pages/crm/CrmDeals";
import CrmTasks from "./pages/crm/CrmTasks";
import CrmSettings from "./pages/crm/CrmSettings";
import CatalogTiers from "./pages/crm/CatalogTiers";
import TeamSettings from "./pages/team/TeamSettings";
import { TeamProvider, useTeam } from "./context/TeamContext";
import { MemoSkusProvider } from "./context/MemoSkusContext";
import { SelectionProvider } from "./context/SelectionContext";
import { sectionForPath, firstAllowedLanding } from "./utils/permissions";
import SelectionFab from "./components/SelectionFab";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import MobileDock from "./components/MobileDock";
import ActivityTracker from "./components/ActivityTracker";
import SpinningGem from "./components/SpinningGem";
import BrandMark from "./components/BrandMark";
import { RouteLoadingProvider } from "./components/RouteLoadingContext";
import RouteTransitionOverlay from "./components/RouteTransitionOverlay";
import StorePortalLayout from "./pages/portal/StorePortalLayout";
import StorePortalMemos from "./pages/portal/StorePortalMemos";
import StorePortalMemoDetail from "./pages/portal/StorePortalMemoDetail";
import StorePortalAccount from "./pages/portal/StorePortalAccount";
import StorePortalCatalog from "./pages/portal/StorePortalCatalog";
import StorePortalRequests from "./pages/portal/StorePortalRequests";
import StorePortalDocuments from "./pages/portal/StorePortalDocuments";

// ---------- Theme Context ----------
const ThemeContext = createContext();
export const useTheme = () => useContext(ThemeContext);

const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved || "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((p) => (p === "light" ? "dark" : "light"));

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
};

// ---------- Logo (used on marketing/landing) ----------
//
// v1.1 brand mark — the emerald brilliant-cut gem (echoing the SpinningGem
// loader), packaged in BrandMark so the marketing header, sidebar and
// loader all share one face. The tile flips with the theme; the gem's
// emerald gradients read on both light and dark.
const DiamondIcon = () => <BrandMark size={32} />;

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label="Toggle theme"
      title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
    >
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
    </button>
  );
};

// ---------- Nav config (used by both Sidebar and TopBar for title) ----------
//
// The Sidebar renders sections (each with optional header label + colored dot).
// The TopBar uses the flattened NAV_ITEMS list to compute the page title.
const NAV_SECTIONS = [
  // Top — no section header
  {
    items: [
      {
        key: "dashboard",
        to: "/dashboard",
        label: "Dashboard",
        matches: (path) => path === "/dashboard",
        icon: (cls) => (
          <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        ),
      },
    ],
  },
  // INVENTORY section — single unified hub. The Sprint 1.B merge folds the
  // legacy /jewelry/items grid into this surface as the second tab.
  {
    label: "INVENTORY",
    dot: "bg-emerald-500",
    items: [
      {
        key: "inventory",
        to: "/inventory",
        label: "Inventory",
        // Match any /inventory URL (with or without ?tab=) and the legacy
        // /jewelry/items / /jewelry-items aliases (which redirect into the
        // unified hub) so the sidebar entry stays highlighted on those URLs
        // mid-redirect.
        matches: (path) =>
          path === "/inventory" ||
          path === "/jewelry" ||
          path === "/jewelry/" ||
          path === "/jewelry/items" ||
          path === "/jewelry-items",
        icon: (cls) => (
          <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        ),
      },
    ],
  },
  // SALES section
  {
    label: "SALES",
    dot: "bg-sky-500",
    items: [
      {
        // /crm itself now redirects to /dashboard?tab=crm, so we send the
        // sidebar straight into the CRM workspace (contacts list — most-used
        // entry point).
        key: "crm",
        to: "/crm/contacts",
        label: "CRM",
        matches: (path) => path.startsWith("/crm"),
        icon: (cls) => (
          <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-7.13a4 4 0 11-8 0 4 4 0 018 0zm6 4a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
      {
        key: "sales",
        to: "/sales/diamonds",
        label: "Sales Inventory",
        // Highlight across the whole sales catalog (incl. the stone/selection
        // sub-routes) — but not /offers, which is its own entry below.
        matches: (path) => path.startsWith("/sales"),
        icon: (cls) => (
          <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7l8-4 8 4-8 4-8-4zm0 0v10l8 4 8-4V7M12 11v10" />
          </svg>
        ),
        // Desktop category switcher — the mobile dock exposes these as tiles,
        // the sidebar lists them as sub-items under Sales Inventory.
        children: [
          { to: "/sales/diamonds", label: "Diamonds", matches: (p) => p.startsWith("/sales/diamonds") },
          { to: "/sales/emeralds", label: "Emeralds", matches: (p) => p.startsWith("/sales/emeralds") },
          {
            to: "/sales/gemstones",
            label: "Gemstones",
            matches: (p) => p.startsWith("/sales/gemstones") || p.startsWith("/sales/inventory"),
          },
          { to: "/sales/jewelry", label: "Jewelry", matches: (p) => p.startsWith("/sales/jewelry") },
        ],
      },
      {
        key: "team",
        to: "/team",
        label: "Team",
        matches: (path) => path.startsWith("/team"),
        icon: (cls) => (
          <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm6 13v-2a4 4 0 00-3-3.87M2 20v-2a4 4 0 014-4h6a4 4 0 014 4v2" />
          </svg>
        ),
      },
    ],
  },
  // TOOLS section — internal QA / data integrity tooling.
  // Renamed from "QUALITY" so the "QA" namespace is free for a future
  // production QC workflow built on top of jewelry_items.status='qc'.
  {
    label: "TOOLS",
    dot: "bg-amber-500",
    items: [
      {
        key: "tools",
        to: "/qa-data",
        label: "Data Quality",
        matches: (path) => path === "/qa-data" || path === "/qa",
        icon: (cls) => (
          <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
    ],
  },
];

// Flattened list (top-level items only) for the TopBar title resolver
const NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

// Roles & permissions — keep only the nav items the member is allowed to see
// (admins pass everything via `can`). Sections with no surviving items are
// dropped so the sidebar + mobile dock render a clean, focused nav.
const navSectionsFor = (sections, can) =>
  sections
    .map((s) => ({
      ...s,
      items: s.items.filter((it) => !it.key || can(it.key)),
    }))
    .filter((s) => s.items.length > 0);

// ---------- App layout: sidebar + topbar + content (for protected app pages) ----------
const AppLayout = () => {
  const { theme } = useTheme();
  const team = useTeam();
  const location = useLocation();
  const { isSignedIn, isLoaded: clerkLoaded } = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "true"; } catch { return false; }
  });

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem("sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  };

  // Render gate. Two problems we're solving here:
  //   1. UX flash. A `store_user` who lands at /dashboard would
  //      briefly see the full admin shell (sidebar, KPI cards,
  //      skeletons) for the few hundred ms it takes /api/team/me to
  //      resolve, before the isStoreUser redirect below fires.
  //   2. Privacy leak. That same flash exposes the admin navigation
  //      structure (and any cached dashboard data from a previous
  //      session) to a user who is not authorised to see it.
  //
  // The fix is to short-circuit to a neutral full-screen loader the
  // moment Clerk says "this person is signed in" until TeamContext
  // confirms what their role is. Signed-out / Clerk-still-loading
  // states fall through so the existing <SignedOut> branch keeps
  // working.
  if (clerkLoaded && isSignedIn && !team?.ready) {
    return <FullScreenLoader />;
  }

  // Hard redirect: store-portal users have no business inside the
  // sidebar app at all. Send them to /store-portal the moment we
  // resolve their role.
  if (team?.ready && team?.isStoreUser) {
    return <Navigate to="/store-portal" replace />;
  }

  // Roles & permissions — non-admins only see the sections the admin granted
  // them. The nav is trimmed to match, and direct deep-links into a forbidden
  // area bounce to their first allowed page. (Data limits are enforced on the
  // BE; this is the UX layer.)
  const gated = team?.ready && !team?.isAdmin && !team?.isStoreUser;
  if (gated) {
    const allowedLanding = firstAllowedLanding(team.can);
    // No access to anything at all — show a neutral notice instead of looping.
    if (!allowedLanding) return <NoAccessScreen />;
    const sec = sectionForPath(location.pathname);
    if (sec && !team.can(sec.key)) {
      return <Navigate to={allowedLanding} replace />;
    }
  }
  const navSections = gated ? navSectionsFor(NAV_SECTIONS, team.can) : NAV_SECTIONS;

  return (
    <>
      <SignedIn>
        {/* Mobile shell is pinned to the viewport (100dvh) and clips its own
            overflow, so the *document* never scrolls — only <main> does.
            This is what keeps the fixed MobileDock rock-solid: iOS Safari
            strands `position: fixed` bars mid-screen during momentum scroll
            of the document, but never when the scroll lives in an inner
            container. Desktop (md+) reverts to the normal document flow. */}
        <div className="flex h-[100dvh] overflow-hidden md:h-auto md:min-h-screen md:overflow-visible">
          <Sidebar
            navSections={navSections}
            collapsed={collapsed}
            onToggleCollapse={toggleCollapse}
          />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <TopBar navItems={NAV_ITEMS} />
            {/* On mobile this is the scroll container; bottom padding clears
                the fixed MobileDock. Desktop falls through to document flow. */}
            <main className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-y-contain pb-28 md:overflow-visible md:pb-0">
              <Outlet />
            </main>
          </div>
          {/* Floating "Selected" button — appears bottom-right once stones are
              picked from any catalog, opens the review page. */}
          <SelectionFab />
          {/* v1.0.5 mobile nav — bottom dock replaces the legacy mobile
              sidebar drawer. Hidden on md+. */}
          <MobileDock navSections={navSections} />
          {/* Invisible — records rep activity + presence heartbeat. */}
          <ActivityTracker />
        </div>
      </SignedIn>
      <SignedOut>
        <div className="min-h-screen flex flex-col">
          <MarketingHeader />
          <main className="flex-1">
            <AuthPrompt message="Please sign in to access this page" />
          </main>
        </div>
      </SignedOut>
    </>
  );
};

/**
 * FullScreenLoader — neutral splash shown while we're resolving who
 * the user is (Clerk -> TeamContext.me). Deliberately minimal: just
 * the brand mark and a subtle spinner. NO admin chrome (sidebar,
 * topbar, dashboard widgets) and NO store-portal chrome — both could
 * leak structure or stale data to a viewer whose role we don't yet
 * know. Both AppLayout and StorePortalLayout render this during the
 * pre-role window.
 */
const FullScreenLoader = () => (
  <div
    role="status"
    aria-live="polite"
    aria-label="Loading workspace"
    className="min-h-screen w-full flex items-center justify-center"
  >
    <div className="flex flex-col items-center gap-6">
      <SpinningGem />
      <div className="flex items-center gap-2 text-app-muted text-[11px] font-medium tracking-[0.14em] uppercase">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-emerald animate-pulse" />
        Loading workspace
      </div>
    </div>
  </div>
);


// Shown to a signed-in member whose admin hasn't granted them any section yet.
// Avoids a redirect loop and tells them what to do.
const NoAccessScreen = () => (
  <div className="min-h-screen flex items-center justify-center px-4">
    <div className="glass-surface-strong rounded-3xl px-8 py-10 max-w-md w-full text-center">
      <div className="relative w-16 h-16 mx-auto rounded-2xl bg-app-ink flex items-center justify-center">
        <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h2 className="text-[22px] font-semibold tracking-tight text-app-ink mt-6">No access yet</h2>
      <p className="text-[14px] text-app-muted mt-2 leading-relaxed">
        Your account doesn't have any sections enabled. Ask your administrator to grant you access in Team settings.
      </p>
    </div>
  </div>
);

// Bottom sheet that slides up to ~50% of the viewport — the gate shown to
// signed-out visitors who land on a protected page. It's pinned to the bottom
// (not dismissible: there's nothing behind to return to) and mirrors the
// LoginSheet's slide-up motion + glass-white chrome.
const AuthPrompt = ({ message }) => (
  <motion.div
    initial={{ y: "100%" }}
    animate={{ y: 0 }}
    transition={{ type: "spring", damping: 30, stiffness: 320 }}
    className="fixed inset-x-0 bottom-0 z-30 flex h-[50vh] flex-col items-center justify-center rounded-t-3xl border-t border-app-line bg-app-surface px-6 text-center shadow-[0_-24px_60px_-30px_rgba(0,0,0,0.5)]"
    role="dialog"
    aria-modal="true"
    aria-label="Access required"
  >
    {/* Decorative grab handle. */}
    <div className="absolute inset-x-0 top-3 flex justify-center">
      <div className="h-1.5 w-10 rounded-full bg-app-line2" />
    </div>

    <div className="relative h-16 w-16 rounded-2xl bg-app-ink flex items-center justify-center shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)]">
      <svg className="h-7 w-7 text-app-canvas" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      <span className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/15 pointer-events-none" aria-hidden />
    </div>
    <h2 className="mt-6 text-[24px] font-semibold tracking-tight text-app-ink">Access Required</h2>
    <p className="mt-2 text-[14px] leading-relaxed text-app-muted">{message}</p>
    <LoginSheet>
      <button className="btn-primary mt-6">Sign In to Continue</button>
    </LoginSheet>
  </motion.div>
);

// ---------- Marketing/landing layout (used by `/`, public pages) ----------
const MarketingHeader = () => {
  const location = useLocation();
  return (
    <header className="sticky top-0 z-40 glass-bar pt-safe">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 safe-x">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3 group">
            <DiamondIcon />
            <div className="flex flex-col leading-tight">
              <span className="text-[17px] font-semibold tracking-tight text-app-ink">GEMS DNA</span>
              <span className="text-[10px] font-medium tracking-[0.14em] uppercase text-app-muted">
                Diamond Network
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <SignedOut>
              <LoginSheet>
                <button className="btn-primary">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Sign In
                </button>
              </LoginSheet>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl={location.pathname} appearance={{ elements: { avatarBox: "w-9 h-9 ring-1 ring-app-line ring-offset-2 ring-offset-transparent" } }} />
            </SignedIn>
          </div>
        </div>
      </div>
    </header>
  );
};

const MarketingLayout = () => (
  <div className="min-h-screen flex flex-col">
    <MarketingHeader />
    <main className="flex-1">
      <Outlet />
    </main>
  </div>
);

// ---------- App root ----------
function App() {
  return (
    <ThemeProvider>
      <TeamProvider>
        {/* MemoSkusProvider exposes the set of SKUs currently sitting on
            an active memo so any inventory view can show an "On memo"
            chip without per-row queries. */}
        <MemoSkusProvider>
          {/* SelectionProvider backs the cross-category stone pick list (the
              floating "Selected" button + review page). */}
          <SelectionProvider>
            <AppContent />
          </SelectionProvider>
        </MemoSkusProvider>
      </TeamProvider>
    </ThemeProvider>
  );
}

function AppContent() {
  const { theme } = useTheme();

  return (
    <>
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            borderRadius: "12px",
            background: theme === "dark" ? "#292524" : "#1c1917",
            color: "#fff",
            fontFamily: "Outfit, sans-serif",
          },
          success: { iconTheme: { primary: "#10b981", secondary: "#fff" } },
        }}
      />
      <Router>
        <RouteLoadingProvider>
          <RouteTransitionOverlay />
          <Routes>
          {/* Marketing / landing */}
          <Route element={<MarketingLayout />}>
            <Route path="/" element={<OnboardingPage />} />
          </Route>

          {/* Protected app routes (sidebar + top bar) */}
          <Route element={<AppLayout />}>
            {/* Sprint 1.A merge — single tabbed dashboard hosting Overview /
                Stones / CRM / Jewelry / Reports. The legacy /jewelry/dashboard,
                /jewelry/reports and /crm landing pages all redirect into the
                matching tab, see below. */}
            <Route path="/dashboard" element={<Dashboard />} />
            {/* Sprint 1.B merge — InventoryHub fans out into Stones / Jewelry tabs. */}
            <Route path="/inventory" element={<InventoryHub />} />

            {/* Jewelry sub-system — the jewelry inventory/workshop surfaces were
                retired; /jewelry now lands on the stones inventory. */}
            <Route path="/jewelry" element={<Navigate to="/inventory" replace />} />
            {/* Back-compat: old jewelry-domain dashboards fold into the global
                Dashboard tabs. */}
            <Route
              path="/jewelry/dashboard"
              element={<Navigate to="/dashboard?tab=jewelry" replace />}
            />
            <Route
              path="/jewelry/reports"
              element={<Navigate to="/dashboard?tab=reports" replace />}
            />
            {/* Back-compat: the legacy jewelry inventory / workshop URLs are
                retired (the jewelry grid + production workflow were removed).
                Anything that still points here lands on the stones inventory. */}
            <Route path="/jewelry/items" element={<Navigate to="/inventory" replace />} />
            <Route path="/jewelry/items/:id" element={<Navigate to="/inventory" replace />} />
            <Route path="/jewelry-items" element={<Navigate to="/inventory" replace />} />
            <Route path="/jewelry-items/:id" element={<Navigate to="/inventory" replace />} />

            <Route path="/qa-data" element={<OwnerOnly section="tools"><QAPage /></OwnerOnly>} />
            {/* Back-compat: old /qa URL still resolves to the same data-quality page. */}
            <Route path="/qa" element={<Navigate to="/qa-data" replace />} />
            {/* Sprint 3 — sales-rep management (admin) + per-rep KPIs. */}
            <Route path="/team" element={<TeamSettings />} />
            {/* Salesperson-focused stone browser (built incrementally). The
                catalog is split into disjoint category surfaces that share the
                same card grid: gemstones (default), diamonds and emeralds. */}
            {/* Sales "Home" — what the rep has sent to clients (WhatsApp shares). */}
            <Route path="/sales/dashboard" element={<SalesDashboard />} />
            <Route path="/sales/inventory" element={<SalesInventory mode="gemstone" />} />
            <Route path="/sales/gemstones" element={<SalesInventory mode="gemstone" />} />
            <Route path="/sales/diamonds" element={<SalesInventory mode="diamond" />} />
            <Route path="/sales/emeralds" element={<SalesInventory mode="emerald" />} />
            {/* Jewelry sales surface — WooCommerce-fed catalog in the same card grid. */}
            <Route path="/sales/jewelry" element={<SalesJewelry />} />
            {/* Per-stone product page behind the catalog cards. */}
            <Route path="/sales/stone/:sku" element={<StoneDetail />} />
            {/* Per-piece jewelry product page — same look as StoneDetail. */}
            <Route path="/sales/jewelry/:sku" element={<JewelryDetail />} />
            {/* Full-page customer profile (no CRM tab chrome) */}
            <Route path="/crm/customers/:id" element={<CustomerProfile />} />
            <Route path="/crm" element={<CrmLayout />}>
              {/* The CRM landing page is now the CRM tab inside the global
                  Dashboard. Sub-pages (contacts/deals/tasks/settings) keep
                  their own URLs and continue to render inside CrmLayout. */}
              <Route index element={<Navigate to="/dashboard?tab=crm" replace />} />
              <Route path="contacts" element={<CrmContacts />} />
              <Route path="contacts/:id" element={<CrmContacts />} />
              <Route path="deals" element={<CrmDeals />} />
              <Route path="tasks" element={<CrmTasks />} />
              <Route path="stores" element={<CrmCompanies />} />
              <Route path="stores/:id" element={<StoreProfile />} />
              <Route path="memos" element={<CrmMemos />} />
              <Route path="memos/:id" element={<MemoDetail />} />
              <Route path="documents" element={<CrmDocuments />} />
              <Route path="catalog" element={<CatalogTiers />} />
              <Route path="settings" element={<CrmSettings />} />
            </Route>
          </Route>

          {/* Sprint 4 / Phase 3 — Store Portal (retail-store users).
              Lives outside <AppLayout> so it gets its own minimal chrome
              (no sidebar / TopBar). The TeamProvider already gates the
              entry: anyone with role='store_user' is bounced here from
              the main app, and anyone else hitting /store-portal sees an
              empty memos list (BE returns 403 on /api/portal/*). */}
          <Route element={<StorePortalLayout />}>
            <Route path="/store-portal" element={<StorePortalMemos historyMode={false} />} />
            <Route path="/store-portal/catalog" element={<StorePortalCatalog />} />
            <Route path="/store-portal/requests" element={<StorePortalRequests />} />
            <Route path="/store-portal/history" element={<StorePortalMemos historyMode={true} />} />
            <Route path="/store-portal/documents" element={<StorePortalDocuments />} />
            <Route path="/store-portal/account" element={<StorePortalAccount />} />
            <Route path="/store-portal/memos/:id" element={<StorePortalMemoDetail />} />
          </Route>

          {/* Short URL aliases */}
          <Route path="/scan" element={<HomeShortcut to="/crm/contacts?action=scan" />} />
          <Route path="/new" element={<HomeShortcut to="/crm/contacts?action=new" />} />

          {/* Fully public pages (no app chrome) */}
          {/* Customer-facing preview & approval — opaque-token URL the
              workshop sends to the buyer. Rendered outside <AppLayout> so
              the customer never sees our sidebar / TopBar / Clerk gates. */}
          <Route path="/share/:token" element={<CustomerSharePage />} />

          {/* Public memo-signature endpoint — token URLs the supplier
              sends to a store over WhatsApp/email when the store doesn't
              have a portal account. Also outside <AppLayout> and outside
              the Clerk gates so the recipient can sign without an account. */}
          <Route path="/sign/:token" element={<SignaturePage />} />

          {/* Standalone auth pages — must be registered BEFORE the catch-all
              `/:stone_id` route below, otherwise Clerk's hosted SignIn/SignUp
              paths get matched as a stone id and the user lands on a blank
              DNA card. The pages also accept an `?email=` query that we
              pre-fill into the form (used by the team-invite emails). Clerk
              uses subpaths under /sign-in and /sign-up for verification
              steps, so we mount them with a trailing /* wildcard. */}
          <Route path="/sign-in/*" element={<SignInPage />} />
          <Route path="/sign-up/*" element={<SignUpPage />} />

          {/* OAuth landing — Clerk finishes the Google handshake here and then
              forwards to redirectUrlComplete (/dashboard). Used by the custom
              LoginSheet's "Continue with Google" flow. */}
          <Route
            path="/sso-callback"
            element={
              <AuthenticateWithRedirectCallback
                signInForceRedirectUrl="/dashboard"
                signUpForceRedirectUrl="/dashboard"
              />
            }
          />

          <Route path="/jewelry/:modelNumber" element={<JewelryPage />} />
          <Route path="/:stone_id" element={<DiamondCard />} />
          </Routes>
        </RouteLoadingProvider>
      </Router>
    </>
  );
}

const HomeShortcut = ({ to }) => <Navigate to={to} replace />;

// Route-level guard for owner-only pages (Production board, Designs, QA
// data, Jewelry settings). Reps that hit these URLs directly land on a
// friendly screen pointing them back to their CRM workspace instead of
// rendering the page (and confusing them with admin-only data).
const OwnerOnly = ({ children, section }) => {
  const team = useTeam();
  if (team.loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-app-muted text-[13px]">
        Loading…
      </div>
    );
  }
  if (team.isOwner) return children;
  // Roles & permissions — a non-admin may still reach this page if the admin
  // explicitly granted them its section (AppLayout already gated direct links).
  if (section && team.can && team.can(section)) return children;
  return (
    <div className="max-w-2xl mx-auto p-8 text-center">
      <div className="glass-surface rounded-3xl px-8 py-10">
        <div className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-white/65 border border-white/70 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
          <svg className="w-6 h-6 text-app-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M12 9v3m0 4h.01M5 19h14a2 2 0 001.7-3L13.7 5a2 2 0 00-3.4 0L3.3 16A2 2 0 005 19z" />
          </svg>
        </div>
        <h2 className="text-[22px] font-semibold tracking-tight text-app-ink mt-4">Workshop admins only</h2>
        <p className="text-[14px] text-app-muted mt-2 leading-relaxed">
          This page manages production / inventory tooling. Your sales workspace lives in
          <Link to="/crm/contacts" className="ml-1 font-medium text-app-ink hover:underline">CRM</Link>
          {" — "}or jump straight to your{" "}
          <Link to="/dashboard?tab=crm" className="font-medium text-app-ink hover:underline">CRM dashboard</Link>.
        </p>
      </div>
    </div>
  );
};

export default App;
