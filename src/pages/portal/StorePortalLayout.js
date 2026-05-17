import React, { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { UserButton, SignedIn, SignedOut, useUser } from "@clerk/clerk-react";
import { fetchPortalMe } from "../../services/portalApi";
import { RequestBasketProvider, useRequestBasket } from "./RequestBasketContext";

/**
 * StorePortalLayout — premium "fintech-grade" chrome for retail-store users.
 *
 * The previous version was minimal but felt like a microsite. This version
 * leans into the brand promise of professionalism + technology + security:
 *
 *   - A dark gradient hero strip that bleeds behind a glass header (the
 *     header itself stays sticky, light, and legible on scroll).
 *   - Crisp two-line brand mark with the supplier name surfaced on every
 *     screen so the store knows "who they're talking to".
 *   - A spec-grade sub-nav with active underline, request-basket badge,
 *     and "Powered by GEMS DNA" trust line.
 *   - Mobile-first: header collapses to icon + brand, sub-nav scrolls
 *     horizontally with snap.
 */
export default function StorePortalLayout() {
  return (
    <RequestBasketProvider>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-stone-50 to-stone-50">
        <SignedIn>
          <BrandRibbon />
          <PortalHeader />
          <PortalSubNav />
          <main className="max-w-6xl mx-auto px-3 sm:px-6 py-5 sm:py-8 relative z-0">
            <Outlet />
          </main>
          <PortalFooter />
        </SignedIn>
        <SignedOut>
          <LockedScreen />
        </SignedOut>
      </div>
    </RequestBasketProvider>
  );
}

/* ============================================================
   Top decorative ribbon — a thin gradient strip that visually
   anchors the surface as a "premium portal" before any content.
   ============================================================ */
function BrandRibbon() {
  return (
    <div className="h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" />
  );
}

/* ============================================================
   Header — supplier mark + secure session pill + UserButton.
   The supplier mark is data-driven (logo + name from /portal/me)
   so the store sees their counterparty's brand front and centre.
   ============================================================ */
function PortalHeader() {
  const { user } = useUser();
  const [me, setMe] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    fetchPortalMe(user.id)
      .then((p) => alive && setMe(p))
      .catch(() => {});
    return () => { alive = false; };
  }, [user?.id]);

  const supplierName = me?.supplier?.name || "GEMS DNA";
  const storeName    = me?.store?.name;

  return (
    <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-stone-200/80">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-[68px] flex items-center justify-between gap-3">
        <Link to="/store-portal" className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="relative w-9 h-9 sm:w-10 sm:h-10 shrink-0">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/20" />
            <div className="relative w-full h-full flex items-center justify-center text-white font-bold text-sm sm:text-base tracking-tight">GD</div>
          </div>
          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="text-sm sm:text-[15px] font-bold text-stone-900 truncate">Consignment Portal</span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-stone-500 font-medium truncate">
              with <span className="text-stone-700 font-semibold">{supplierName}</span>
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <SecurePill />
          {storeName && (
            <div className="hidden md:flex items-center gap-2 pl-3 pr-1 py-1 rounded-full bg-stone-100 border border-stone-200">
              <span className="text-[11px] uppercase tracking-[0.16em] font-bold text-stone-500">Store</span>
              <span className="text-xs font-semibold text-stone-800 max-w-[200px] truncate">{storeName}</span>
            </div>
          )}
          <UserButton
            afterSignOutUrl="/sign-in"
            appearance={{ elements: { avatarBox: "w-9 h-9 ring-2 ring-stone-200 ring-offset-2" } }}
          />
        </div>
      </div>
    </header>
  );
}

function SecurePill() {
  return (
    <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
      <span className="relative flex w-1.5 h-1.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
        <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-emerald-500" />
      </span>
      <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-emerald-700">Secure</span>
    </div>
  );
}

/* ============================================================
   Sub-navigation — active memos, catalog (request memo),
   request history, account.
   ============================================================ */
function PortalSubNav() {
  const { count: basketCount } = useRequestBasket();
  return (
    <nav className="bg-white/70 backdrop-blur border-b border-stone-200/80 sticky top-14 sm:top-[68px] z-20">
      <div className="max-w-6xl mx-auto px-1 sm:px-6 flex items-center gap-0 overflow-x-auto scrollbar-hide">
        <PortalTab to="/store-portal" end label="Memos" />
        <PortalTab to="/store-portal/catalog" label="Catalog" badge={basketCount > 0 ? basketCount : null} accent />
        <PortalTab to="/store-portal/requests" label="My requests" />
        <PortalTab to="/store-portal/documents" label="Documents" />
        <PortalTab to="/store-portal/history" label="History" />
        <PortalTab to="/store-portal/account" label="Account" />
      </div>
    </nav>
  );
}

function PortalTab({ to, end, label, badge, accent }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative px-3 sm:px-4 py-3 text-xs sm:text-[13px] font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
          isActive ? "text-stone-900" : "text-stone-500 hover:text-stone-800"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {label}
          {badge != null && (
            <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
              accent ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/30" : "bg-stone-200 text-stone-700"
            }`}>{badge}</span>
          )}
          {isActive && (
            <span className="absolute left-3 right-3 sm:left-4 sm:right-4 bottom-0 h-0.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 rounded-full" />
          )}
        </>
      )}
    </NavLink>
  );
}

/* ============================================================
   Footer — quiet, with a thin trust line and a "powered by"
   wordmark to convey legitimacy without being noisy.
   ============================================================ */
function PortalFooter() {
  return (
    <footer className="max-w-6xl mx-auto px-3 sm:px-6 pb-10 pt-14">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] text-stone-400">
          <svg className="w-3.5 h-3.5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>Encrypted session · End-to-end secured by Clerk</span>
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-stone-400">
          Powered by <span className="text-stone-600">GEMS DNA</span>
        </div>
      </div>
    </footer>
  );
}

/* ============================================================
   Locked screen — for unauthenticated visitors.
   ============================================================ */
function LockedScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-50 via-stone-50 to-indigo-50/40" />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl -z-10" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl -z-10" />
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-600 text-white flex items-center justify-center font-bold text-lg mb-5 shadow-xl shadow-indigo-500/30">GD</div>
      <h1 className="text-2xl font-bold text-stone-900 mb-1">Consignment Portal</h1>
      <p className="text-sm text-stone-500 mb-6 max-w-sm">
        A secure, partner-only portal for retail stores carrying GEMS DNA inventory.
      </p>
      <Link to="/sign-in" className="px-5 py-2.5 rounded-lg bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800">
        Sign in
      </Link>
    </div>
  );
}
