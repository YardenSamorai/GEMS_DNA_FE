import React, { useState, useEffect, createContext, useContext } from "react";
import { BrowserRouter as Router, Route, Routes, useLocation, Link } from "react-router-dom";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import { AnimatePresence, motion } from "framer-motion";
import DiamondCard from "./pages/DiamondCard";
import HomePage from "./pages/HomePage";
import JewelryPage from "./pages/JewelryPage";
import OnboardingPage from "./pages/OnboardingPage";
import { Toaster } from "react-hot-toast";
import Inventory from "./pages/inventory";
import QAPage from "./pages/QAPage";
import CrmLayout from "./pages/crm/CrmLayout";
import CrmDashboard from "./pages/crm/CrmDashboard";
import CrmContacts from "./pages/crm/CrmContacts";
import CrmDeals from "./pages/crm/CrmDeals";
import CrmTasks from "./pages/crm/CrmTasks";

// Theme Context
const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

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
    <button
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label="Toggle theme"
    >
      <div className="theme-toggle-knob">
        {theme === 'light' ? (
          <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
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

const NAV_ITEMS = [
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
  {
    to: "/inventory",
    label: "Inventory",
    matches: (path) => path === "/inventory",
    icon: (cls) => (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    to: "/qa",
    label: "QA",
    matches: (path) => path === "/qa",
    icon: (cls) => (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
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
];

const Header = () => {
  const location = useLocation();
  const currentPath = location.pathname;
  const { theme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path) => currentPath === path;

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [currentPath]);

  // Lock body scroll while menu open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  return (
    <header className="sticky top-0 z-50 glass border-b border-stone-200/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-primary-500/20 rounded-xl blur-lg group-hover:bg-primary-500/30 transition-all duration-300"></div>
              <div className="relative">
                <DiamondIcon />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold text-gradient tracking-tight">GEMS DNA</span>
              <span className={`text-[10px] font-medium tracking-widest uppercase ${theme === 'dark' ? 'text-stone-500' : 'text-stone-400'}`}>Diamond Network</span>
            </div>
          </Link>

          {/* Navigation - Desktop */}
          <nav className="hidden md:flex items-center gap-1">
            <SignedIn>
              <NavLink to="/dashboard" active={isActive('/dashboard')}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                Dashboard
              </NavLink>
              <NavLink to="/inventory" active={isActive('/inventory')}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Inventory
              </NavLink>
              <NavLink to="/qa" active={isActive('/qa')}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                QA
              </NavLink>
              <NavLink to="/crm" active={currentPath.startsWith('/crm')}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-7.13a4 4 0 11-8 0 4 4 0 018 0zm6 4a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                CRM
              </NavLink>
            </SignedIn>
          </nav>

          {/* Auth Section */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
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
              <div className="flex items-center gap-3">
                {/* Hamburger - mobile only */}
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Open menu"
                  className={`md:hidden p-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-stone-300 hover:bg-stone-800' : 'text-stone-700 hover:bg-stone-100'}`}
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <div className={`h-8 w-px hidden sm:block ${theme === 'dark' ? 'bg-stone-700' : 'bg-stone-200'}`}></div>
                <UserButton
                  afterSignOutUrl={currentPath}
                  appearance={{
                    elements: {
                      avatarBox: "w-9 h-9 ring-2 ring-primary-500/20 ring-offset-2"
                    }
                  }}
                />
              </div>
            </SignedIn>
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      <SignedIn>
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              key="mobile-menu"
              className="md:hidden fixed inset-0 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
                onClick={() => setMobileMenuOpen(false)}
              />
              {/* Drawer */}
              <motion.aside
                role="dialog"
                aria-modal="true"
                className={`absolute right-0 top-0 bottom-0 w-72 max-w-[85%] shadow-2xl flex flex-col ${theme === 'dark' ? 'bg-stone-900' : 'bg-white'}`}
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 280 }}
              >
                {/* Drawer header */}
                <div className={`flex items-center justify-between px-4 h-16 border-b ${theme === 'dark' ? 'border-stone-800' : 'border-stone-200'}`}>
                  <div className="flex items-center gap-2.5">
                    <DiamondIcon />
                    <div className="flex flex-col leading-tight">
                      <span className="text-base font-bold text-gradient">GEMS DNA</span>
                      <span className={`text-[10px] font-medium tracking-widest uppercase ${theme === 'dark' ? 'text-stone-500' : 'text-stone-400'}`}>Menu</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    aria-label="Close menu"
                    className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-stone-400 hover:bg-stone-800' : 'text-stone-500 hover:bg-stone-100'}`}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Nav items */}
                <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                  {NAV_ITEMS.map((item) => {
                    const active = item.matches(currentPath);
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] font-medium transition-all ${
                          active
                            ? 'bg-primary-500 text-white shadow-md shadow-primary-500/25'
                            : theme === 'dark'
                              ? 'text-stone-200 hover:bg-stone-800'
                              : 'text-stone-700 hover:bg-stone-100'
                        }`}
                      >
                        {item.icon("w-5 h-5")}
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>

                {/* Footer */}
                <div className={`p-4 border-t flex items-center justify-between ${theme === 'dark' ? 'border-stone-800' : 'border-stone-200'}`}>
                  <span className={`text-xs ${theme === 'dark' ? 'text-stone-500' : 'text-stone-400'}`}>Theme</span>
                  <ThemeToggle />
                </div>
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>
      </SignedIn>
    </header>
  );
};

const NavLink = ({ to, active, children }) => {
  const { theme } = useTheme();
  
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
        active
          ? 'bg-primary-500 text-white shadow-md shadow-primary-500/25'
          : theme === 'dark' 
            ? 'text-stone-300 hover:bg-stone-800 hover:text-stone-100'
            : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
      }`}
    >
      {children}
    </Link>
  );
};

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
            borderRadius: '12px',
            background: theme === 'dark' ? '#292524' : '#1c1917',
            color: '#fff',
            fontFamily: 'Outfit, sans-serif',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
        }}
      />
      <Router>
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-1">
            <Routes>
              {/* Landing/Onboarding Page */}
              <Route path="/" element={<OnboardingPage />} />

              <Route
                path="/dashboard"
                element={
                  <>
                    <SignedIn>
                      <HomePage />
                    </SignedIn>
                    <SignedOut>
                      <AuthPrompt message="Please sign in to access the dashboard" />
                    </SignedOut>
                  </>
                }
              />

              <Route
                path="/inventory"
                element={
                  <>
                    <SignedIn>
                      <Inventory />
                    </SignedIn>
                    <SignedOut>
                      <AuthPrompt message="Please sign in to access the inventory" />
                    </SignedOut>
                  </>
                }
              />

              <Route
                path="/qa"
                element={
                  <>
                    <SignedIn>
                      <QAPage />
                    </SignedIn>
                    <SignedOut>
                      <AuthPrompt message="Please sign in to access QA" />
                    </SignedOut>
                  </>
                }
              />

              <Route
                path="/crm"
                element={
                  <>
                    <SignedIn>
                      <CrmLayout />
                    </SignedIn>
                    <SignedOut>
                      <AuthPrompt message="Please sign in to access CRM" />
                    </SignedOut>
                  </>
                }
              >
                <Route index element={<CrmDashboard />} />
                <Route path="contacts" element={<CrmContacts />} />
                <Route path="contacts/:id" element={<CrmContacts />} />
                <Route path="deals" element={<CrmDeals />} />
                <Route path="tasks" element={<CrmTasks />} />
              </Route>

              {/* Public pages */}
              <Route path="/jewelry/:modelNumber" element={<JewelryPage />} />
              <Route path="/:stone_id" element={<DiamondCard />} />
            </Routes>
          </main>
        </div>
      </Router>
    </>
  );
}

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
        <h2 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-stone-100' : 'text-stone-800'}`}>Access Required</h2>
        <p className={`mb-6 ${theme === 'dark' ? 'text-stone-400' : 'text-stone-500'}`}>{message}</p>
        <SignInButton mode="modal">
          <button className="btn-primary text-base">
            Sign In to Continue
          </button>
        </SignInButton>
      </div>
    </div>
  );
};

export default App;
