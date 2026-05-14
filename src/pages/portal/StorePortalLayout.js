import React from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { UserButton, SignedIn, SignedOut } from "@clerk/clerk-react";

/**
 * StorePortalLayout — minimal chrome for retail-store users.
 *
 * Design language is intentionally aligned with the MemoDetail page
 * (white cards on stone-50, stone-900 ink, MEMO-grade status pills,
 * subtle stone-200 borders, rounded-2xl). The portal has NO sidebar
 * and NO TopBar — store users see two tabs (Memos / Account) plus
 * the supplier's mark in the header.
 *
 * Mobile-first:
 *   - Sticky header (no sidebar collapse mechanics)
 *   - Tab strip uses pill chips that wrap to two rows on tiny screens
 *   - Container uses max-w-5xl so the layout never feels cavernous
 */
export default function StorePortalLayout() {
  // Portal users get a different background tone than the main app
  // so it's visually obvious they're in a different surface.
  return (
    <div className="min-h-screen bg-stone-50">
      <SignedIn>
        <PortalHeader />
        <PortalSubNav />
        <main className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
          <Outlet />
        </main>
        <PortalFooter />
      </SignedIn>
      <SignedOut>
        <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-lg mb-4">GD</div>
          <h1 className="text-xl font-bold text-stone-900 mb-1">Consignment Portal</h1>
          <p className="text-sm text-stone-500 mb-6">Please sign in to view your memos.</p>
          <Link to="/sign-in" className="px-5 py-2.5 rounded-lg bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800">
            Sign in
          </Link>
        </div>
      </SignedOut>
    </div>
  );
}

function PortalHeader() {
  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
        <Link to="/store-portal" className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0">GD</div>
          <div className="min-w-0">
            <div className="text-sm sm:text-base font-bold text-stone-900 leading-none truncate">Consignment Portal</div>
            <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.18em] text-stone-400 font-bold leading-none mt-0.5">GEMS DNA</div>
          </div>
        </Link>
        <UserButton
          afterSignOutUrl="/sign-in"
          appearance={{ elements: { avatarBox: "w-9 h-9 ring-2 ring-stone-200 ring-offset-2" } }}
        />
      </div>
    </header>
  );
}

function PortalSubNav() {
  return (
    <nav className="bg-white border-b border-stone-200">
      <div className="max-w-5xl mx-auto px-1 sm:px-6 flex items-center gap-1 overflow-x-auto">
        <PortalTab to="/store-portal" end label="Memos" />
        <PortalTab to="/store-portal/history" label="History" />
        <PortalTab to="/store-portal/account" label="Account" />
      </div>
    </nav>
  );
}

function PortalTab({ to, end, label }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors ${
          isActive
            ? "text-stone-900"
            : "text-stone-500 hover:text-stone-800"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {label}
          {isActive && (
            <span className="absolute left-3 right-3 sm:left-4 sm:right-4 bottom-0 h-0.5 bg-stone-900 rounded-full" />
          )}
        </>
      )}
    </NavLink>
  );
}

function PortalFooter() {
  return (
    <footer className="max-w-5xl mx-auto px-3 sm:px-6 pb-8 pt-12">
      <div className="text-[11px] text-stone-400 text-center">
        © GEMS DNA · Consignment Portal · For partner retail stores
      </div>
    </footer>
  );
}
