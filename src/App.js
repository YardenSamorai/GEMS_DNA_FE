import React, { useState, useEffect, createContext, useContext } from "react";
import { BrowserRouter as Router, Route, Routes, useLocation, Link, Navigate, Outlet, useParams } from "react-router-dom";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import DiamondCard from "./pages/DiamondCard";
import HomePage from "./pages/HomePage";
import JewelryPage from "./pages/JewelryPage";
import OnboardingPage from "./pages/OnboardingPage";
import { Toaster } from "react-hot-toast";
import Inventory from "./pages/inventory";
import JewelryItems from "./pages/jewelry";
import JewelryItemDetail from "./pages/jewelry/JewelryItemDetail";
import JewelryDashboard from "./pages/jewelry/JewelryDashboard";
import ProductionBoard from "./pages/jewelry/ProductionBoard";
import JewelrySoldItems from "./pages/jewelry/SoldItems";
import JewelryDesigns from "./pages/jewelry/Designs";
import JewelryReports from "./pages/jewelry/Reports";
import JewelrySettings from "./pages/jewelry/JewelrySettings";
import QAPage from "./pages/QAPage";
import CrmLayout from "./pages/crm/CrmLayout";
import CrmDashboard from "./pages/crm/CrmDashboard";
import CrmContacts from "./pages/crm/CrmContacts";
import CustomerProfile from "./pages/crm/CustomerProfile";
import CrmDeals from "./pages/crm/CrmDeals";
import CrmTasks from "./pages/crm/CrmTasks";
import CrmSettings from "./pages/crm/CrmSettings";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";

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
  // INVENTORY section
  {
    label: "INVENTORY",
    dot: "bg-emerald-500",
    items: [
      {
        to: "/inventory",
        label: "Stones",
        matches: (path) => path === "/inventory",
        icon: (cls) => (
          <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        ),
      },
      {
        to: "/jewelry",
        label: "Jewelry",
        matches: (path) =>
          path === "/jewelry" || path.startsWith("/jewelry/") || path.startsWith("/jewelry-items"),
        icon: (cls) => (
          <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 3l3.057-3 4.886 0L16 3l4 5-8 13L4 8l1-5z" />
          </svg>
        ),
        children: [
          {
            to: "/jewelry/dashboard",
            label: "Dashboard",
            matches: (p) => p === "/jewelry" || p === "/jewelry/" || p === "/jewelry/dashboard",
          },
          {
            to: "/jewelry/items",
            label: "Inventory",
            matches: (p) =>
              p === "/jewelry/items" ||
              p.startsWith("/jewelry/items/") ||
              p === "/jewelry-items" ||
              p.startsWith("/jewelry-items/"),
          },
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
            to: "/jewelry/reports",
            label: "Reports",
            matches: (p) => p === "/jewelry/reports",
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
        to: "/crm",
        label: "CRM",
        matches: (path) => path.startsWith("/crm"),
        icon: (cls) => (
          <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-7.13a4 4 0 11-8 0 4 4 0 018 0zm6 4a3 3 0 11-6 0 3 3 0 016 0z" />
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
      <AppContent />
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
            <Route path="/dashboard" element={<HomePage />} />
            <Route path="/inventory" element={<Inventory />} />

            {/* Jewelry sub-system */}
            <Route path="/jewelry" element={<Navigate to="/jewelry/dashboard" replace />} />
            <Route path="/jewelry/dashboard" element={<JewelryDashboard />} />
            <Route path="/jewelry/items" element={<JewelryItems />} />
            <Route path="/jewelry/items/:id" element={<JewelryItemDetail />} />
            <Route path="/jewelry/production" element={<ProductionBoard />} />
            <Route path="/jewelry/sold" element={<JewelrySoldItems />} />
            <Route path="/jewelry/designs" element={<JewelryDesigns />} />
            <Route path="/jewelry/reports" element={<JewelryReports />} />
            <Route path="/jewelry/settings" element={<JewelrySettings />} />

            {/* Back-compat: old /jewelry-items URLs → new /jewelry/items */}
            <Route path="/jewelry-items" element={<Navigate to="/jewelry/items" replace />} />
            <Route path="/jewelry-items/:id" element={<RedirectJewelryItem />} />

            <Route path="/qa-data" element={<QAPage />} />
            {/* Back-compat: old /qa URL still resolves to the same data-quality page. */}
            <Route path="/qa" element={<Navigate to="/qa-data" replace />} />
            {/* Full-page customer profile (no CRM tab chrome) */}
            <Route path="/crm/customers/:id" element={<CustomerProfile />} />
            <Route path="/crm" element={<CrmLayout />}>
              <Route index element={<CrmDashboard />} />
              <Route path="contacts" element={<CrmContacts />} />
              <Route path="contacts/:id" element={<CrmContacts />} />
              <Route path="deals" element={<CrmDeals />} />
              <Route path="tasks" element={<CrmTasks />} />
              <Route path="settings" element={<CrmSettings />} />
            </Route>
          </Route>

          {/* Short URL aliases */}
          <Route path="/scan" element={<HomeShortcut to="/crm/contacts?action=scan" />} />
          <Route path="/new" element={<HomeShortcut to="/crm/contacts?action=new" />} />

          {/* Fully public pages (no app chrome) */}
          <Route path="/jewelry/:modelNumber" element={<JewelryPage />} />
          <Route path="/:stone_id" element={<DiamondCard />} />
        </Routes>
      </Router>
    </>
  );
}

const HomeShortcut = ({ to }) => <Navigate to={to} replace />;

// Redirect old /jewelry-items/:id → /jewelry/items/:id
const RedirectJewelryItem = () => {
  const { id } = useParams();
  const { search } = useLocation();
  return <Navigate to={`/jewelry/items/${id}${search}`} replace />;
};

export default App;
