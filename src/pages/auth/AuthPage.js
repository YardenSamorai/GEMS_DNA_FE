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
const DiamondMark = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L2 9L12 22L22 9L12 2Z" fill="url(#auth-diamond)" />
    <path d="M2 9H22" stroke="white" strokeWidth="0.5" strokeOpacity="0.5" />
    <path d="M12 2L8 9L12 22L16 9L12 2Z" fill="white" fillOpacity="0.2" />
    <defs>
      <linearGradient id="auth-diamond" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#34d399" />
        <stop offset="1" stopColor="#059669" />
      </linearGradient>
    </defs>
  </svg>
);

const AuthShell = ({ title, subtitle, children, footer }) => (
  <div className="min-h-screen flex flex-col bg-stone-50">
    <header className="border-b border-stone-200/70 bg-white/80 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <DiamondMark />
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-bold tracking-tight text-stone-900">GEMS DNA</span>
            <span className="text-[10px] font-medium tracking-widest uppercase text-stone-400">
              Diamond Network
            </span>
          </div>
        </Link>
      </div>
    </header>
    <main className="flex-1 flex items-start justify-center px-4 py-10 sm:py-14">
      <div className="w-full max-w-[440px]">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">{title}</h1>
          {subtitle ? (
            <p className="mt-2 text-sm text-stone-500 leading-relaxed">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex justify-center">{children}</div>
        {footer ? (
          <div className="mt-6 text-center text-sm text-stone-500">{footer}</div>
        ) : null}
      </div>
    </main>
  </div>
);

// Clerk's SignIn / SignUp components ship with their own theme. We just
// soften the rounding to match the GEMS DNA shell. Keeping the rest of the
// styling default keeps the auth flow stable across Clerk version bumps.
const clerkAppearance = {
  elements: {
    rootBox: "w-full",
    card: "shadow-md rounded-2xl border border-stone-200/60",
    formButtonPrimary:
      "bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold tracking-wide",
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
                className="font-semibold text-emerald-700 hover:text-emerald-800"
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
                className="font-semibold text-emerald-700 hover:text-emerald-800"
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
