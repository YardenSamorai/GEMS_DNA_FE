import React from "react";
import { Link, useLocation, useSearchParams, Navigate } from "react-router-dom";
import { SignIn, SignUp, SignedIn, SignedOut } from "@clerk/clerk-react";

/**
 * Shared brand chrome for the standalone auth pages (/sign-in, /sign-up).
 *
 * These pages live outside both AppLayout and MarketingLayout because:
 *   1. They must be reachable by signed-out users (the invite email link
 *      drops new sales reps here).
 *   2. They must NOT be eaten by the catch-all `/:stone_id` route at the
 *      bottom of App.js — sign-in is registered before that wildcard.
 */
/**
 * v1.0.5 — Ink monogram shared with the marketing header and sidebar.
 */
const DiamondMark = () => (
  <span className="relative inline-flex w-9 h-9 rounded-[10px] bg-app-ink items-center justify-center shadow-[0_4px_12px_-4px_rgba(0,0,0,0.30)]">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2 9L12 22L22 9L12 2Z" fill="white" />
      <path d="M2 9H22" stroke="rgba(255,255,255,0.45)" strokeWidth="0.6" />
      <path d="M12 2L8 9L12 22L16 9L12 2Z" fill="white" fillOpacity="0.25" />
    </svg>
    <span className="absolute inset-0 rounded-[10px] ring-1 ring-inset ring-white/15 pointer-events-none" aria-hidden />
  </span>
);

const AuthShell = ({ title, subtitle, children, footer }) => (
  <div className="min-h-screen flex flex-col app-canvas">
    <header className="glass-bar">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <DiamondMark />
          <div className="flex flex-col leading-tight">
            <span className="text-[17px] font-semibold tracking-tight text-app-ink">GEMS DNA</span>
            <span className="text-[10px] font-medium tracking-[0.14em] uppercase text-app-muted">
              Diamond Network
            </span>
          </div>
        </Link>
      </div>
    </header>
    <main className="flex-1 flex items-start justify-center px-4 py-10 sm:py-14">
      <div className="w-full max-w-[440px]">
        <div className="text-center mb-8">
          <h1 className="text-[28px] sm:text-[34px] font-semibold tracking-tight text-app-ink">{title}</h1>
          {subtitle ? (
            <p className="mt-2 text-[14px] text-app-muted leading-relaxed">{subtitle}</p>
          ) : null}
        </div>
        <div className="glass-surface-strong rounded-2xl p-3 sm:p-4 flex justify-center">
          {children}
        </div>
        {footer ? (
          <div className="mt-6 text-center text-[13px] text-app-muted">{footer}</div>
        ) : null}
      </div>
    </main>
  </div>
);

// Clerk's SignIn / SignUp components ship with their own theme. We strip
// their default card so they sit cleanly inside our glass shell, and lock
// the primary button to the v1.0.5 ink pill — matching the rest of the
// system's call-to-action buttons.
const clerkAppearance = {
  elements: {
    rootBox: "w-full",
    card: "shadow-none border-0 bg-transparent",
    formButtonPrimary:
      "bg-app-ink hover:bg-app-graphite text-app-canvas text-[13px] font-medium tracking-tight rounded-full px-5 py-2.5",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
  },
};

function useEmailFromQuery() {
  const [params] = useSearchParams();
  const raw = params.get("email") || "";
  // Strip whitespace; Clerk's `initialValues.emailAddress` is fine with an
  // empty string. We also tolerate the `+` -> space decoding the URL spec
  // performs (some email clients do that), and trim either side.
  return raw.trim();
}

export const SignInPage = () => {
  const email = useEmailFromQuery();
  const { search } = useLocation();
  // If they're already signed in, just bounce them straight to /dashboard.
  return (
    <>
      <SignedIn>
        <Navigate to="/dashboard" replace />
      </SignedIn>
      <SignedOut>
        <AuthShell
          title="Welcome back"
          subtitle={
            email
              ? `Sign in as ${email} to access your workshop.`
              : "Sign in to your GEMS DNA workshop."
          }
          footer={
            <>
              New here?{" "}
              <Link
                to={`/sign-up${search}`}
                className="font-medium text-app-ink hover:underline"
              >
                Create an account
              </Link>
            </>
          }
        >
          <SignIn
            appearance={clerkAppearance}
            routing="path"
            path="/sign-in"
            signUpUrl={`/sign-up${search}`}
            forceRedirectUrl="/dashboard"
            fallbackRedirectUrl="/dashboard"
            initialValues={email ? { emailAddress: email } : undefined}
          />
        </AuthShell>
      </SignedOut>
    </>
  );
};

export const SignUpPage = () => {
  const email = useEmailFromQuery();
  const { search } = useLocation();
  return (
    <>
      <SignedIn>
        <Navigate to="/dashboard" replace />
      </SignedIn>
      <SignedOut>
        <AuthShell
          title="Set up your account"
          subtitle={
            email
              ? `You were invited to GEMS DNA. Use ${email} so we can link this account to your team.`
              : "Create your GEMS DNA account to get started."
          }
          footer={
            <>
              Already have an account?{" "}
              <Link
                to={`/sign-in${search}`}
                className="font-medium text-app-ink hover:underline"
              >
                Sign in
              </Link>
            </>
          }
        >
          <SignUp
            appearance={clerkAppearance}
            routing="path"
            path="/sign-up"
            signInUrl={`/sign-in${search}`}
            forceRedirectUrl="/dashboard"
            fallbackRedirectUrl="/dashboard"
            initialValues={email ? { emailAddress: email } : undefined}
          />
        </AuthShell>
      </SignedOut>
    </>
  );
};

export default SignInPage;
