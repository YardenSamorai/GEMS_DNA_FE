import React, { useState, useEffect, createContext, useContext } from "react";
import { BrowserRouter as Router, Route, Routes, useLocation, Link, Navigate, Outlet, useParams } from "react-router-dom";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import DiamondCard from "./pages/DiamondCard";
import Dashboard from "./pages/Dashboard";
import JewelryPage from "./pages/JewelryPage";
import OnboardingPage from "./pages/OnboardingPage";
import { Toaster } from "react-hot-toast";
import InventoryHub from "./pages/InventoryHub";
import JewelryItemDetail from "./pages/jewelry/JewelryItemDetail";
import CustomerSharePage from "./pages/share/CustomerSharePage";
import { SignInPage, SignUpPage } from "./pages/auth/AuthPage";
import ProductionBoard from "./pages/jewelry/ProductionBoard";
import JewelrySoldItems from "./pages/jewelry/SoldItems";
import JewelryDesigns from "./pages/jewelry/Designs";
import JewelrySettings from "./pages/jewelry/JewelrySettings";
import QAPage from "./pages/QAPage";
import CrmLayout from "./pages/crm/CrmLayout";
import CrmContacts from "./pages/crm/CrmContacts";
import CrmCompanies from "./pages/crm/CrmCompanies";
import StoreProfile from "./pages/crm/StoreProfile";
import CrmMemos from "./pages/crm/CrmMemos";
import MemoDetail from "./pages/crm/MemoDetail";
import CustomerProfile from "./pages/crm/CustomerProfile";
import CrmDeals from "./pages/crm/CrmDeals";
import CrmTasks from "./pages/crm/CrmTasks";
import CrmSettings from "./pages/crm/CrmSettings";
import CatalogTiers from "./pages/crm/CatalogTiers";
import TeamSettings from "./pages/team/TeamSettings";
import { TeamProvider, useTeam } from "./context/TeamContext";
import { MemoSkusProvider } from "./context/MemoSkusContext";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import StorePortalLayout from "./pages/portal/StorePortalLayout";
import StorePortalMemos from "./pages/portal/StorePortalMemos";
import StorePortalMemoDetail from "./pages/portal/StorePortalMemoDetail";
import StorePortalAccount from "./pages/portal/StorePortalAccount";
import StorePortalCatalog from "./pages/portal/StorePortalCatalog";
import StorePortalRequests from "./pages/portal/StorePortalRequests";

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
const DiamondIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L2 9L12 22L22 9L12 2Z" fill="url(#diamond-gradient)" />
    <path d="M2 9H22" stroke="white" strokeWidth="0.5" strokeOpacity="0.5" />
    <path d="M12 2L8 9L12 22L16 9L12 2Z" fill="white" fillOpacity="0.2" />
    <defs>
      <linearGradient id="diamond-gradient" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#34d399" />
        <stop offset="1" stopColor="#059669" />
      </linearGradient>
    </defs>
  </svg>
);

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

// ---------- Nav config (used by both Sidebar and TopBar for title) ----------
//
// The Sidebar renders sections (each with optional header label + colored dot).
// The TopBar uses the flattened NAV_ITEMS list to compute the page title.
const NAV_SECTIONS = [
  // Top — no section header
  {
    items: [
      {
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
  // JEWELRY section — workflow surfaces only. Inventory moved up to the
  // unified hub (Sprint 1.B), Dashboard + Reports moved into /dashboard tabs
  // (Sprint 1.A). This section is now the workshop's working space.
  {
    label: "JEWELRY",
    dot: "bg-pink-500",
    items: [
      {
        to: "/jewelry/production",
        label: "Production",
        matches: (path) =>
          path === "/jewelry/production" ||
          path === "/jewelry/sold" ||
          path === "/jewelry/designs" ||
          path === "/jewelry/settings" ||
          path.startsWith("/jewelry/items/"),
        icon: (cls) => (
          <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 3l3.057-3 4.886 0L16 3l4 5-8 13L4 8l1-5z" />
          </svg>
        ),
        children: [
          {
            to: "/jewelry/production",
            label: "Production Board",
            matches: (p) => p === "/jewelry/production",
          },
          {
            to: "/jewelry/sold",
            label: "Sold Items",
            matches: (p) => p === "/jewelry/sold",
          },
          {
            to: "/jewelry/designs",
            label: "Designs",
            matches: (p) => p === "/jewelry/designs",
          },
          {
            to: "/jewelry/settings",
            label: "Settings",
            matches: (p) => p === "/jewelry/settings",
          },
        ],
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

// ---------- App layout: sidebar + topbar + content (for protected app pages) ----------
const AppLayout = () => {
  const { theme } = useTheme();
  const team = useTeam();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "true"; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem("sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  };

  // Close the mobile drawer on navigation
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Hard redirect: store-portal users have no business inside the
  // sidebar app at all. Send them to /store-portal the moment we
  // resolve their role.
  if (team?.ready && team?.isStoreUser) {
    return <Navigate to="/store-portal" replace />;
  }

  return (
    <>
      <SignedIn>
        <div className={`flex min-h-screen ${theme === "dark" ? "bg-stone-950" : "bg-stone-50"}`}>
          <Sidebar
            navSections={NAV_SECTIONS}
            collapsed={collapsed}
            onToggleCollapse={toggleCollapse}
            mobileOpen={mobileOpen}
            onMobileClose={() => setMobileOpen(false)}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar navItems={NAV_ITEMS} onOpenMobileMenu={() => setMobileOpen(true)} />
            <main className="flex-1 min-w-0">
              <Outlet />
            </main>
          </div>
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

const AuthPrompt = ({ message }) => {
  const { theme } = useTheme();
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6 px-4">
      <div className="relative">
        <div className="absolute inset-0 bg-primary-500/20 rounded-full blur-3xl"></div>
        <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-glow">
          <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
      </div>
      <div className="text-center">
        <h2 className={`text-2xl font-bold mb-2 ${theme === "dark" ? "text-stone-100" : "text-stone-800"}`}>Access Required</h2>
        <p className={`mb-6 ${theme === "dark" ? "text-stone-400" : "text-stone-500"}`}>{message}</p>
        <SignInButton mode="modal">
          <button className="btn-primary text-base">Sign In to Continue</button>
        </SignInButton>
      </div>
    </div>
  );
};

// ---------- Marketing/landing layout (used by `/`, public pages) ----------
const MarketingHeader = () => {
  const location = useLocation();
  const { theme } = useTheme();
  return (
    <header className="sticky top-0 z-40 glass border-b border-stone-200/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-primary-500/20 rounded-xl blur-lg group-hover:bg-primary-500/30 transition-all duration-300"></div>
              <div className="relative">
                <DiamondIcon />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold text-gradient tracking-tight">GEMS DNA</span>
              <span className={`text-[10px] font-medium tracking-widest uppercase ${theme === "dark" ? "text-stone-500" : "text-stone-400"}`}>
                Diamond Network
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <SignedOut>
              <SignInButton mode="modal">
                <button className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl={location.pathname} appearance={{ elements: { avatarBox: "w-9 h-9 ring-2 ring-primary-500/20 ring-offset-2" } }} />
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
          <AppContent />
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

            {/* Jewelry sub-system */}
            <Route path="/jewelry" element={<Navigate to="/inventory?tab=jewelry" replace />} />
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
            {/* Back-compat: the jewelry inventory grid moved into the unified
                /inventory?tab=jewelry surface, but /jewelry/items/:id (single
                item detail page) keeps its own dedicated route. */}
            <Route path="/jewelry/items" element={<Navigate to="/inventory?tab=jewelry" replace />} />
            <Route path="/jewelry/items/:id" element={<JewelryItemDetail />} />
            <Route path="/jewelry/production" element={<OwnerOnly><ProductionBoard /></OwnerOnly>} />
            <Route path="/jewelry/sold" element={<OwnerOnly><JewelrySoldItems /></OwnerOnly>} />
            <Route path="/jewelry/designs" element={<OwnerOnly><JewelryDesigns /></OwnerOnly>} />
            <Route path="/jewelry/settings" element={<OwnerOnly><JewelrySettings /></OwnerOnly>} />

            {/* Back-compat: old /jewelry-items URLs → new unified inventory */}
            <Route path="/jewelry-items" element={<Navigate to="/inventory?tab=jewelry" replace />} />
            <Route path="/jewelry-items/:id" element={<RedirectJewelryItem />} />

            <Route path="/qa-data" element={<OwnerOnly><QAPage /></OwnerOnly>} />
            {/* Back-compat: old /qa URL still resolves to the same data-quality page. */}
            <Route path="/qa" element={<Navigate to="/qa-data" replace />} />
            {/* Sprint 3 — sales-rep management (admin) + per-rep KPIs. */}
            <Route path="/team" element={<TeamSettings />} />
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

          {/* Standalone auth pages — must be registered BEFORE the catch-all
              `/:stone_id` route below, otherwise Clerk's hosted SignIn/SignUp
              paths get matched as a stone id and the user lands on a blank
              DNA card. The pages also accept an `?email=` query that we
              pre-fill into the form (used by the team-invite emails). Clerk
              uses subpaths under /sign-in and /sign-up for verification
              steps, so we mount them with a trailing /* wildcard. */}
          <Route path="/sign-in/*" element={<SignInPage />} />
          <Route path="/sign-up/*" element={<SignUpPage />} />

          <Route path="/jewelry/:modelNumber" element={<JewelryPage />} />
          <Route path="/:stone_id" element={<DiamondCard />} />
        </Routes>
      </Router>
    </>
  );
}

const HomeShortcut = ({ to }) => <Navigate to={to} replace />;

// Route-level guard for owner-only pages (Production board, Designs, QA
// data, Jewelry settings). Reps that hit these URLs directly land on a
// friendly screen pointing them back to their CRM workspace instead of
// rendering the page (and confusing them with admin-only data).
const OwnerOnly = ({ children }) => {
  const team = useTeam();
  const { theme } = useTheme();
  if (team.loading) {
    return (
      <div className={`flex min-h-[60vh] items-center justify-center ${theme === "dark" ? "text-stone-400" : "text-stone-500"}`}>
        Loading…
      </div>
    );
  }
  if (team.isOwner) return children;
  return (
    <div className="max-w-2xl mx-auto p-8 text-center">
      <div className="inline-flex w-16 h-16 items-center justify-center rounded-full bg-amber-50 mb-4">
        <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M12 9v3m0 4h.01M5 19h14a2 2 0 001.7-3L13.7 5a2 2 0 00-3.4 0L3.3 16A2 2 0 005 19z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-stone-800">Workshop admins only</h2>
      <p className="text-stone-500 mt-2">
        This page manages production / inventory tooling. Your sales workspace lives in
        <Link to="/crm/contacts" className="ml-1 font-semibold text-emerald-700 hover:text-emerald-800">CRM</Link>
        {" — "}or jump straight to your{" "}
        <Link to="/dashboard?tab=crm" className="font-semibold text-emerald-700 hover:text-emerald-800">CRM dashboard</Link>.
      </p>
    </div>
  );
};

// Redirect old /jewelry-items/:id → /jewelry/items/:id
const RedirectJewelryItem = () => {
  const { id } = useParams();
  const { search } = useLocation();
  return <Navigate to={`/jewelry/items/${id}${search}`} replace />;
};

export default App;
