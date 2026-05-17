import React, { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { UserButton, SignedIn, SignedOut, useUser } from "@clerk/clerk-react";
import { fetchPortalMe } from "../../services/portalApi";
import { RequestBasketProvider, useRequestBasket } from "./RequestBasketContext";

/**
 * StorePortalLayout — restrained "luxury trade tool" chrome.
 *
 * Design language: bone background, graphite ink, hairline rules,
 * a single antique-champagne accent applied sparingly. The portal
 * services high-end jewellery retailers (Cartier, Tiffany, Hermès,
 * LV etc.), so the surface must read as a private, instrument-grade
 * tool rather than a consumer SaaS app. Hence:
 *
 *   - Zero gradients. Zero saturated brand colours.
 *   - Letter-spaced uppercase eyebrows; Cormorant serif for display.
 *   - 1px hairlines instead of shadows; soft champagne for active states.
 *   - Bleached "bone" canvas (#FAF8F2) with white cards for hierarchy.
 *   - Sticky, legible header carrying the supplier mark on every page.
 */
export default function StorePortalLayout() {
  return (
    <RequestBasketProvider>
      <div className="min-h-screen bg-portal-bone text-portal-ink">
        <SignedIn>
          <BrandRibbon />
          <PortalHeader />
          <PortalSubNav />
          <main className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-10 relative z-0">
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
   Top hairline — a single 1px antique-champagne rule anchors
   the surface and signals "premium portal" without noise.
   ============================================================ */
function BrandRibbon() {
  return <div className="h-px bg-portal-champagne/70" />;
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
    <header className="sticky top-0 z-30 bg-portal-bone/90 backdrop-blur-md border-b border-portal-line">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 sm:h-[72px] flex items-center justify-between gap-4">
        <Link to="/store-portal" className="flex items-center gap-3 sm:gap-4 min-w-0">
          {/* Monogram mark — flat graphite square with hairline,
              serif italic "GD". Replaces the previous gradient tile. */}
          <div className="relative w-10 h-10 sm:w-11 sm:h-11 shrink-0 bg-portal-ink flex items-center justify-center">
            <span className="font-serif-display italic text-portal-bone text-[18px] leading-none tracking-tight">GD</span>
            <span className="absolute -bottom-px left-1.5 right-1.5 h-px bg-portal-champagne/80" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="text-[9px] tracking-[0.28em] uppercase text-portal-soft font-medium">
              Consignment Portal
            </div>
            <div className="font-serif-display text-[17px] sm:text-[19px] text-portal-ink truncate mt-0.5">
              {supplierName}
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-3 sm:gap-4">
          <SecurePill />
          {storeName && (
            <div className="hidden md:flex items-baseline gap-2 pl-3 pr-2 py-1 border-l border-portal-line2">
              <span className="text-[9px] tracking-[0.24em] uppercase text-portal-soft">Store</span>
              <span className="text-[12.5px] text-portal-ink max-w-[200px] truncate">{storeName}</span>
            </div>
          )}
          <UserButton
            afterSignOutUrl="/sign-in"
            appearance={{ elements: { avatarBox: "w-9 h-9 ring-1 ring-portal-line2 ring-offset-2 ring-offset-portal-bone" } }}
          />
        </div>
      </div>
    </header>
  );
}

function SecurePill() {
  return (
    <div className="hidden sm:flex items-center gap-2">
      <span className="relative flex w-1.5 h-1.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-portal-champagne opacity-50 animate-ping" />
        <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-portal-champagne" />
      </span>
      <span className="text-[9px] tracking-[0.28em] uppercase text-portal-muted font-medium">Encrypted session</span>
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
    <nav className="bg-portal-bone/80 backdrop-blur border-b border-portal-line sticky top-16 sm:top-[72px] z-20">
      {/* overflow-y is explicitly clipped: the absolute-positioned
          champagne under-bar on the active tab sits at -bottom-px, and
          Tailwind's `overflow-x-auto` implicitly enables overflow-y,
          which would surface that 1px sliver as a vertical scrollbar. */}
      <div className="max-w-6xl mx-auto px-1 sm:px-6 flex items-center gap-1 sm:gap-3 overflow-x-auto overflow-y-hidden scrollbar-hide">
        <PortalTab to="/store-portal" end label="Memos" />
        <PortalTab to="/store-portal/catalog" label="Inventory" badge={basketCount > 0 ? basketCount : null} />
        <PortalTab to="/store-portal/requests" label="Requests" />
        <PortalTab to="/store-portal/documents" label="Documents" />
        <PortalTab to="/store-portal/history" label="History" />
        <PortalTab to="/store-portal/account" label="Account" />
      </div>
    </nav>
  );
}

function PortalTab({ to, end, label, badge }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative px-3 sm:px-4 py-3.5 text-[11px] sm:text-[12px] tracking-[0.22em] uppercase whitespace-nowrap transition-colors flex items-center gap-2 ${
          isActive ? "text-portal-ink" : "text-portal-muted hover:text-portal-ink"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className="font-medium">{label}</span>
          {badge != null && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] tabular-nums tracking-normal bg-portal-ink text-portal-bone">{badge}</span>
          )}
          {isActive && (
            <span className="absolute left-3 right-3 sm:left-4 sm:right-4 -bottom-px h-px bg-portal-champagne" />
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
    <footer className="max-w-6xl mx-auto px-3 sm:px-6 pb-12 pt-16 border-t border-portal-line mt-16">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 text-[10px] tracking-[0.22em] uppercase text-portal-soft">
          <svg className="w-3 h-3 text-portal-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>End-to-end encrypted session</span>
        </div>
        <div className="text-[10px] tracking-[0.28em] uppercase text-portal-soft">
          Powered by <span className="text-portal-graphite font-medium">GEMS DNA</span>
        </div>
      </div>
    </footer>
  );
}

/* ============================================================
   Locked screen — restrained "vault" page for unauthenticated
   visitors. Bone canvas, single champagne hairline, serif title.
   ============================================================ */
function LockedScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-portal-bone">
      <div className="h-px w-16 bg-portal-champagne mb-8" />
      <div className="w-14 h-14 bg-portal-ink flex items-center justify-center mb-6">
        <span className="font-serif-display italic text-portal-bone text-[22px] leading-none tracking-tight">GD</span>
      </div>
      <div className="text-[10px] tracking-[0.32em] uppercase text-portal-soft mb-3">
        Consignment Portal
      </div>
      <h1 className="font-serif-display text-[34px] sm:text-[40px] leading-tight text-portal-ink max-w-md">
        A private surface for our retail partners.
      </h1>
      <p className="text-[13px] text-portal-muted mt-4 max-w-sm leading-relaxed">
        Access is reserved for retail stores carrying GEMS DNA inventory.
      </p>
      <Link
        to="/sign-in"
        className="mt-10 inline-flex items-center px-8 py-3 bg-portal-ink text-portal-bone text-[11px] tracking-[0.28em] uppercase hover:bg-portal-graphite transition-colors"
      >
        Sign in
      </Link>
    </div>
  );
}
