import React, { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { UserButton, SignedIn, SignedOut, useUser } from "@clerk/clerk-react";
import { fetchPortalMe } from "../../services/portalApi";
import { RequestBasketProvider, useRequestBasket } from "./RequestBasketContext";

/**
 * StorePortalLayout — modern "Liquid Glass" chrome for retail-store users.
 *
 * Design language is a calm, Apple-inspired surface:
 *
 *   - A soft tonal canvas (radial warm + cool washes baked into
 *     index.css via the .portal-canvas helper) gives glass surfaces
 *     something to refract over.
 *   - Header and sub-nav are sticky glass bars with backdrop-blur.
 *   - Hero / list / drawer surfaces are translucent white cards
 *     with a lit inner edge (1px white/55 inset) and a soft
 *     elevation shadow — the .glass-surface utility.
 *   - Typography is Inter only, weighted (500 / 600 / 700) instead
 *     of a serif. Tracking is tight on big titles.
 *   - Accent colour is kept neutral; champagne survives only as a
 *     semantic positive-state tint inside specific badges / dots.
 */
export default function StorePortalLayout() {
  return (
    <RequestBasketProvider>
      <div className="min-h-screen portal-canvas text-glass-ink">
        <SignedIn>
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
    <header className="sticky top-0 z-30 glass-bar">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 sm:h-[68px] flex items-center justify-between gap-4">
        <Link to="/store-portal" className="flex items-center gap-3 min-w-0 group">
          {/* Monogram mark — rounded ink tile, slightly lifted with a
              soft elevation. Reads like an Apple-style app icon. */}
          <div className="relative w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-[10px] bg-glass-ink flex items-center justify-center shadow-[0_4px_12px_-4px_rgba(20,22,28,0.30)] group-hover:shadow-[0_6px_16px_-4px_rgba(20,22,28,0.36)] transition-shadow">
            <span className="text-white text-[14px] sm:text-[15px] font-semibold leading-none tracking-tight">GD</span>
            <span className="absolute inset-0 rounded-[10px] ring-1 ring-inset ring-white/15 pointer-events-none" aria-hidden />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="text-[10px] tracking-[0.14em] uppercase text-glass-muted font-medium">
              Consignment Portal
            </div>
            <div className="text-[15px] sm:text-[16px] font-semibold text-glass-ink truncate tracking-tight mt-0.5">
              {supplierName}
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-3 sm:gap-4">
          <SecurePill />
          {storeName && (
            <div className="hidden md:flex items-center gap-2 pl-3 border-l border-glass-line">
              <span className="text-[10px] tracking-[0.14em] uppercase text-glass-muted font-medium">Store</span>
              <span className="text-[13px] text-glass-ink font-medium max-w-[200px] truncate">{storeName}</span>
            </div>
          )}
          <UserButton
            afterSignOutUrl="/sign-in"
            appearance={{ elements: { avatarBox: "w-9 h-9 ring-1 ring-glass-line ring-offset-2 ring-offset-transparent" } }}
          />
        </div>
      </div>
    </header>
  );
}

function SecurePill() {
  return (
    <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/55 backdrop-blur-md border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
      <span className="relative flex w-1.5 h-1.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500/60 opacity-60 animate-ping" />
        <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-emerald-500" />
      </span>
      <span className="text-[10.5px] tracking-[0.12em] uppercase text-glass-graphite font-medium">Encrypted</span>
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
    <nav className="sticky top-16 sm:top-[68px] z-20">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 pt-3 pb-3">
        {/* A floating glass pill housing the section tabs. Pill itself
            scrolls horizontally on small screens; vertical overflow is
            clipped so the active-segment chip never leaks a scrollbar. */}
        <div className="inline-flex p-1 rounded-full glass-surface-strong overflow-x-auto overflow-y-hidden scrollbar-hide max-w-full">
          <PortalTab to="/store-portal" end label="Memos" />
          <PortalTab to="/store-portal/catalog" label="Inventory" badge={basketCount > 0 ? basketCount : null} />
          <PortalTab to="/store-portal/requests" label="Requests" />
          <PortalTab to="/store-portal/documents" label="Documents" />
          <PortalTab to="/store-portal/history" label="History" />
          <PortalTab to="/store-portal/account" label="Account" />
        </div>
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
        `relative px-3.5 sm:px-4 py-2 rounded-full text-[12px] sm:text-[13px] whitespace-nowrap transition-all flex items-center gap-2 font-medium ${
          isActive
            ? "bg-glass-ink text-white shadow-[0_4px_14px_-6px_rgba(20,22,28,0.45)]"
            : "text-glass-muted hover:text-glass-ink"
        }`
      }
    >
      {label}
      {badge != null && (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-white/85 text-glass-ink text-[10.5px] tabular-nums font-semibold">
          {badge}
        </span>
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
    <footer className="max-w-6xl mx-auto px-3 sm:px-6 pb-12 pt-16 mt-16">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-glass-line">
        <div className="flex items-center gap-2 text-[11px] text-glass-muted">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>End-to-end encrypted session</span>
        </div>
        <div className="text-[11px] text-glass-muted">
          Powered by <span className="text-glass-graphite font-medium">GEMS DNA</span>
        </div>
      </div>
    </footer>
  );
}

/* ============================================================
   Locked screen — Apple-style sign-in card floated over the
   tonal canvas. A single ink monogram, clean headline, pill CTA.
   ============================================================ */
function LockedScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center portal-canvas">
      <div className="w-full max-w-md glass-surface-strong rounded-3xl px-8 py-12">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-glass-ink flex items-center justify-center shadow-[0_8px_24px_-8px_rgba(20,22,28,0.45)] relative">
          <span className="text-white text-[20px] font-semibold leading-none tracking-tight">GD</span>
          <span className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/15 pointer-events-none" aria-hidden />
        </div>
        <div className="text-[10px] tracking-[0.18em] uppercase text-glass-muted mt-6 font-medium">
          Consignment Portal
        </div>
        <h1 className="text-[28px] sm:text-[32px] font-semibold tracking-tight text-glass-ink mt-2 leading-[1.15]">
          A private surface for our retail partners
        </h1>
        <p className="text-[14px] text-glass-muted mt-4 leading-relaxed">
          Access is reserved for retail stores carrying GEMS DNA inventory.
        </p>
        <Link
          to="/sign-in"
          className="mt-8 inline-flex items-center justify-center px-7 py-3 rounded-full bg-glass-ink text-white text-[14px] font-medium hover:bg-glass-graphite transition-colors shadow-[0_8px_20px_-8px_rgba(20,22,28,0.45)]"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
