import React, { useState, cloneElement } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { useSignIn } from "@clerk/clerk-react";

/* ============================================================================
 * LoginSheet — a fully custom sign-in surface.
 *
 * Everything you see here is OURS (v1.0.5 design language); Clerk only powers
 * the logic behind the scenes via the `useSignIn` hook. No Clerk chrome, no
 * "Secured by Clerk", no "Development mode" badge.
 *
 * It slides up from the bottom to ~70% of the viewport and is dismissible with
 * a downward finger drag from the header, exactly like the Filter / Sort sheets
 * in SalesInventory. It's portalled to <body> so it escapes the marketing
 * header's backdrop-filter context.
 *
 * Supported flows:
 *   - Google OAuth (redirect → /sso-callback → /dashboard)
 *   - email/username + password
 *
 * Usage — wrap any trigger element; we attach the open handler via cloneElement
 * so there's no nested <button>:
 *
 *   <LoginSheet>
 *     <button className="btn-primary">Sign In</button>
 *   </LoginSheet>
 * ========================================================================== */

// Multi-colour Google "G".
const GoogleGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
    <path
      fill="#4285F4"
      d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3.01h3.88c2.27-2.09 3.57-5.17 3.57-8.87z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.88-3.01c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09C3.25 21.3 7.31 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.27a12 12 0 0 0 0 10.74l4-3.09z"
    />
    <path
      fill="#EA4335"
      d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.63l4 3.09C6.22 6.88 8.87 4.77 12 4.77z"
    />
  </svg>
);

const Spinner = ({ className = "" }) => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v3a5 5 0 0 0-5 5H4z" />
  </svg>
);

// Pull the friendliest message out of a Clerk error.
const clerkErrorMessage = (err) =>
  err?.errors?.[0]?.longMessage ||
  err?.errors?.[0]?.message ||
  "Something went wrong. Please try again.";

export default function LoginSheet({ children }) {
  const [open, setOpen] = useState(false);
  const drag = useDragControls();
  const navigate = useNavigate();
  const { isLoaded, signIn, setActive } = useSignIn();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const close = () => {
    setOpen(false);
    setError("");
  };

  const trigger = cloneElement(children, {
    onClick: (e) => {
      children.props.onClick?.(e);
      setOpen(true);
    },
  });

  const handleGoogle = async () => {
    if (!isLoaded || googleLoading) return;
    setError("");
    setGoogleLoading(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/dashboard",
      });
    } catch (err) {
      setGoogleLoading(false);
      setError(clerkErrorMessage(err));
    }
  };

  const handlePasskey = async () => {
    if (!isLoaded || passkeyLoading) return;
    setError("");
    setPasskeyLoading(true);
    try {
      const result = await signIn.authenticateWithPasskey({ flow: "discoverable" });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        navigate("/dashboard", { replace: true });
      } else {
        setError("Couldn't complete passkey sign-in — please try another method.");
      }
    } catch (err) {
      setError(clerkErrorMessage(err));
    } finally {
      setPasskeyLoading(false);
    }
  };

  const finishSignIn = async (result) => {
    if (result.status === "complete") {
      await setActive({ session: result.createdSessionId });
      navigate("/dashboard", { replace: true });
      return true;
    }
    return false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLoaded || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      // Step 1 — identify the user and discover which first factors the
      // instance supports for them. Passing `password` here lets Clerk
      // complete in one shot when it can.
      let attempt = await signIn.create({ identifier: identifier.trim(), password });

      if (await finishSignIn(attempt)) return;

      // Step 2 — if Clerk still wants a first factor, explicitly attempt the
      // password strategy (the create call above doesn't always consume it).
      if (attempt.status === "needs_first_factor") {
        const factors = attempt.supportedFirstFactors || [];
        const hasPassword = factors.some((f) => f.strategy === "password");

        if (hasPassword) {
          attempt = await signIn.attemptFirstFactor({ strategy: "password", password });
          if (await finishSignIn(attempt)) return;
        } else {
          // Account has no password (e.g. Google-only). Point them at the
          // right method instead of a dead end.
          const hasGoogle = factors.some((f) => f.strategy === "oauth_google");
          setError(
            hasGoogle
              ? "This account has no password — use \u201CContinue with Google\u201D above."
              : "This account can't sign in with a password. Try another method."
          );
          return;
        }
      }

      // Step 3 — 2FA. We don't render an OTP input in this lightweight sheet.
      if (attempt.status === "needs_second_factor") {
        setError("Two-factor authentication is on for this account — please use the full sign-in page.");
        return;
      }

      // Any other non-complete status.
      setError("Couldn't complete sign-in. Please try again or use another method.");
    } catch (err) {
      setError(clerkErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const sheet = (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60]">
          {/* Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-app-ink/40 backdrop-blur-sm"
            onClick={close}
            aria-hidden
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            drag="y"
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.2 }}
            dragSnapToOrigin
            onDragEnd={(e, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) close();
            }}
            className="absolute inset-x-0 bottom-0 flex max-h-[90vh] flex-col rounded-t-3xl border-t border-app-line bg-app-surface shadow-[0_-24px_60px_-30px_rgba(0,0,0,0.5)]"
            role="dialog"
            aria-modal="true"
            aria-label="Sign in"
          >
            {/* Header — an elegant, centred emblem with a soft ambient glow.
                The whole zone is grabbable (iOS-style); only × opts out. A
                faint top wash gives it a touch of depth. */}
            <div className="relative shrink-0 overflow-hidden">
              {/* Soft gradient wash behind the header. */}
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-app-canvas2/70 to-transparent"
                aria-hidden
              />

              {/* Grab handle. */}
              <div
                onPointerDown={(ev) => drag.start(ev)}
                className="relative flex cursor-grab touch-none justify-center pt-3 pb-1 active:cursor-grabbing"
              >
                <div className="h-1.5 w-10 rounded-full bg-app-line2" />
              </div>

              {/* Floating close. */}
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="absolute right-3.5 top-3.5 z-10 flex h-8 w-8 items-center justify-center rounded-full text-app-muted transition hover:bg-app-canvas2 hover:text-app-ink"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>

              {/* Emblem + title — centred, drag zone. */}
              <div
                onPointerDown={(ev) => drag.start(ev)}
                className="relative flex cursor-grab touch-none flex-col items-center px-6 pb-5 pt-3 text-center active:cursor-grabbing"
              >
                <div className="relative mb-3.5">
                  <span
                    className="absolute -inset-2.5 rounded-[20px] bg-app-ink/10 blur-xl"
                    aria-hidden
                  />
                  <span className="relative inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-app-ink shadow-[0_12px_28px_-10px_rgba(0,0,0,0.55)]">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2L2 9L12 22L22 9L12 2Z" fill="white" />
                      <path d="M2 9H22" stroke="rgba(255,255,255,0.45)" strokeWidth="0.6" />
                      <path d="M12 2L8 9L12 22L16 9L12 2Z" fill="white" fillOpacity="0.25" />
                    </svg>
                    <span className="pointer-events-none absolute inset-0 rounded-[18px] ring-1 ring-inset ring-white/15" aria-hidden />
                  </span>
                </div>
                <h2 className="text-[20px] font-semibold tracking-tight text-app-ink">
                  Sign in to GEMS DNA
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-app-muted">
                  Welcome back — please sign in to continue
                </p>
              </div>
            </div>

            {/* Scrollable body holds the custom form. */}
            <div className="flex-1 overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-1">
              <div className="mx-auto w-full max-w-[400px]">
                {/* Google */}
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={googleLoading || !isLoaded}
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-app-line bg-app-surface py-3 text-[14px] font-medium text-app-ink transition hover:bg-app-canvas2 active:scale-[0.99] disabled:opacity-60"
                >
                  {googleLoading ? <Spinner className="h-4 w-4 text-app-ink" /> : <GoogleGlyph />}
                  Continue with Google
                </button>

                {/* Divider */}
                <div className="my-5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-app-line" />
                  <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-app-soft">
                    or
                  </span>
                  <span className="h-px flex-1 bg-app-line" />
                </div>

                {/* Email / password */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="login-identifier" className="text-[13px] font-medium text-app-graphite">
                      Email address or username
                    </label>
                    <input
                      id="login-identifier"
                      type="text"
                      autoComplete="username"
                      value={identifier}
                      onChange={(ev) => setIdentifier(ev.target.value)}
                      placeholder="Enter email or username"
                      className="w-full rounded-xl border border-app-line bg-app-canvas2 px-3.5 py-3 text-[16px] text-app-ink placeholder:text-app-soft transition focus:border-app-line2 focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="login-password" className="text-[13px] font-medium text-app-graphite">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        value={password}
                        onChange={(ev) => setPassword(ev.target.value)}
                        placeholder="Enter your password"
                        className="w-full rounded-xl border border-app-line bg-app-canvas2 px-3.5 py-3 pr-11 text-[16px] text-app-ink placeholder:text-app-soft transition focus:border-app-line2 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-app-soft transition hover:text-app-ink"
                      >
                        {showPassword ? (
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.5 9.5 0 0112 5c5 0 9 4 9 7a11 11 0 01-2.3 3.2M6.6 6.6A11 11 0 003 12c0 3 4 7 9 7a9.5 9.5 0 003.5-.7" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
                            <circle cx="12" cy="12" r="2.5" strokeWidth={1.6} />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {error ? (
                    <p className="rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-600">
                      {error}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={submitting || !isLoaded}
                    className="mt-1 flex w-full items-center justify-center gap-2 rounded-full bg-app-ink py-3 text-[14.5px] font-semibold tracking-tight text-app-canvas shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)] transition hover:bg-app-graphite active:scale-[0.99] disabled:opacity-60"
                  >
                    {submitting ? <Spinner className="h-4 w-4 text-app-canvas" /> : null}
                    Continue
                  </button>
                </form>

                {/* Passkey */}
                <button
                  type="button"
                  onClick={handlePasskey}
                  disabled={passkeyLoading || !isLoaded}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-app-line bg-app-surface py-2.5 text-[13.5px] font-medium text-app-graphite transition hover:bg-app-canvas2 active:scale-[0.99] disabled:opacity-60"
                >
                  {passkeyLoading ? (
                    <Spinner className="h-4 w-4 text-app-graphite" />
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                      <circle cx="9" cy="8" r="4" strokeWidth={1.6} />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M2.5 20a6.5 6.5 0 0 1 10.5-5.1M19 12.5l3 3-2 2-1-1m0 0-1.6 1.6a2.8 2.8 0 1 1-2-2L17 14.5" />
                    </svg>
                  )}
                  Sign in with a passkey
                </button>

                {/* Footer — access is invite-only; no public sign-up. */}
                <p className="mt-6 text-center text-[13px] text-app-muted">
                  Access is by invitation only. Ask your workshop admin to invite you.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {trigger}
      {createPortal(sheet, document.body)}
    </>
  );
}
