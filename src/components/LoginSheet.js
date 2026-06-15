import React, { useState, useEffect, cloneElement } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { useSignIn, useSignUp } from "@clerk/clerk-react";
import { fetchSessionPeers, revokeOtherSessions, revokeSession } from "../services/sessionApi";

/* ============================================================================
 * LoginSheet — a fully custom auth surface with two views: Sign in & Create
 * account. Both slide up from the bottom (~70% of the viewport) and share the
 * exact same design language; Clerk only powers the logic behind the scenes
 * via the `useSignIn` / `useSignUp` hooks. No Clerk chrome.
 *
 * Access is invite-only (Clerk "Restricted mode"):
 *   - Invited users arrive via an email link carrying `__clerk_ticket`. We
 *     detect it, auto-open in the Create-account view, and complete sign-up
 *     with the ticket (their email is pre-verified — they only set a password).
 *   - Anyone without an invitation who tries to create an account gets a clear
 *     "invitation only" message from Clerk.
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

// Eye / eye-off toggle used by the password inputs.
const EyeToggle = ({ shown, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={shown ? "Hide password" : "Show password"}
    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-app-soft transition hover:text-app-ink"
  >
    {shown ? (
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
);

// Pull the friendliest message out of a Clerk error.
const clerkErrorMessage = (err) =>
  err?.errors?.[0]?.longMessage ||
  err?.errors?.[0]?.message ||
  "Something went wrong. Please try again.";

// Sign-up errors get a tailored message when Clerk blocks an uninvited user
// (Restricted mode), so the dead-end reads as policy, not a bug.
const signUpErrorMessage = (err) => {
  const e0 = err?.errors?.[0];
  const code = (e0?.code || "").toLowerCase();
  const msg = (e0?.longMessage || e0?.message || "").toLowerCase();
  // Account already exists → they should sign in, not sign up.
  if (code.includes("identifier_exists") || msg.includes("already exists") || msg.includes("taken")) {
    return "This email already has an account. Use \u201CSign in\u201D below instead.";
  }
  // Stale / revoked / expired invitation ticket.
  if (code.includes("ticket") || code.includes("invitation") || msg.includes("ticket")) {
    return "This invitation link is no longer valid or has expired. Ask your workshop admin to resend the invite.";
  }
  // Restricted mode blocked an uninvited sign-up.
  if (
    code.includes("not_allowed") ||
    code.includes("restricted") ||
    msg.includes("not allowed") ||
    msg.includes("restricted")
  ) {
    return "Sign-up is by invitation only. Ask your workshop admin to invite you, then open the link in your email.";
  }
  return clerkErrorMessage(err);
};

export default function LoginSheet({ children, initialView = "signin", initialEmail = "" }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(initialView); // "signin" | "signup"
  const drag = useDragControls();
  const navigate = useNavigate();
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setSignUpActive } = useSignUp();

  // Shared
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Sign-in
  const [identifier, setIdentifier] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  // Single-active-session takeover. When sign-in succeeds but the user already
  // has live sessions on other devices, we hold the new (not-yet-activated)
  // session here and ask them to confirm signing out elsewhere.
  const [pendingTakeover, setPendingTakeover] = useState(null); // { sessionId, others }

  // Sign-up
  const [suEmail, setSuEmail] = useState(initialEmail);
  const [suUsername, setSuUsername] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suCode, setSuCode] = useState("");
  const [pendingCode, setPendingCode] = useState(false);
  const [ticket, setTicket] = useState(null);

  // Invitation links land here with `__clerk_ticket` (and usually `email`) in
  // the query — open the sheet straight into the Create-account view, prefill
  // the invited email, and complete sign-up with the ticket. This gives invited
  // users the same polished surface instead of Clerk's hosted page.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("__clerk_ticket");
    const e = params.get("email");
    if (e) {
      setSuEmail(e);
      setIdentifier(e);
    }
    if (t) {
      setTicket(t);
      setView("signup");
      setOpen(true);
    }
  }, []);

  const close = () => {
    setOpen(false);
    setError("");
    setPendingCode(false);
    setPendingTakeover(null);
  };

  const switchTo = (next) => {
    setError("");
    setPendingCode(false);
    setShowPassword(false);
    setView(next);
  };

  const trigger = cloneElement(children, {
    onClick: (e) => {
      children.props.onClick?.(e);
      // Open in the caller's intended view (e.g. the invitation page opens
      // straight into "Create account"), prefilling the invited email.
      setView(initialView);
      if (initialEmail) {
        setSuEmail((v) => v || initialEmail);
        setIdentifier((v) => v || initialEmail);
      }
      setOpen(true);
    },
  });

  // OAuth handles both sign-in and sign-up (Clerk auto-creates when allowed;
  // Restricted mode blocks uninvited new accounts).
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
      if (!(await finishSignIn(result))) {
        setError("Couldn't complete passkey sign-in — please try another method.");
      }
    } catch (err) {
      setError(clerkErrorMessage(err));
    } finally {
      setPasskeyLoading(false);
    }
  };

  // Activate a Clerk session and route into the app.
  const activateSession = async (sessionId) => {
    await setActive({ session: sessionId });
    navigate("/dashboard", { replace: true });
  };

  // Completes a sign-in attempt. Enforces the single-active-session policy:
  // if the user is already signed in on another device, we pause and ask them
  // to confirm the takeover instead of activating right away.
  const finishSignIn = async (result) => {
    if (result.status !== "complete") return false;
    const sessionId = result.createdSessionId;
    try {
      const peers = await fetchSessionPeers(sessionId);
      if (peers && peers.count > 0) {
        setPendingTakeover({ sessionId, others: peers.others || [] });
        return true; // handled — show the confirmation step
      }
    } catch (_) {
      // Don't block sign-in if the session check fails.
    }
    await activateSession(sessionId);
    return true;
  };

  // User confirmed: sign out the other device(s), then continue here.
  const confirmTakeover = async () => {
    if (!pendingTakeover || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      await revokeOtherSessions(pendingTakeover.sessionId);
      await activateSession(pendingTakeover.sessionId);
      setPendingTakeover(null);
    } catch (err) {
      setError("Couldn't switch sessions. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // User cancelled: drop the just-created session and stay on the sign-in form.
  const cancelTakeover = async () => {
    const sid = pendingTakeover?.sessionId;
    setPendingTakeover(null);
    setPassword("");
    setError("You're still signed in on your other device. This sign-in was cancelled.");
    if (sid) {
      try { await revokeSession(sid); } catch (_) {}
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLoaded || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      let attempt = await signIn.create({ identifier: identifier.trim(), password });
      if (await finishSignIn(attempt)) return;

      if (attempt.status === "needs_first_factor") {
        const factors = attempt.supportedFirstFactors || [];
        const hasPassword = factors.some((f) => f.strategy === "password");

        if (hasPassword) {
          attempt = await signIn.attemptFirstFactor({ strategy: "password", password });
          if (await finishSignIn(attempt)) return;
        } else {
          const hasGoogle = factors.some((f) => f.strategy === "oauth_google");
          setError(
            hasGoogle
              ? "This account has no password — use \u201CContinue with Google\u201D above."
              : "This account can't sign in with a password. Try another method."
          );
          return;
        }
      }

      if (attempt.status === "needs_second_factor") {
        setError("Two-factor authentication is on for this account — please use the full sign-in page.");
        return;
      }

      setError("Couldn't complete sign-in. Please try again or use another method.");
    } catch (err) {
      setError(clerkErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Create account. Two paths:
  //   - With a ticket (invited): consume the invitation, set a password, done.
  //   - Without a ticket: email + password, then an email-code verification.
  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!signUpLoaded || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      if (ticket) {
        // Accept the invitation (email comes pre-verified from the ticket).
        let res = await signUp.create({ strategy: "ticket", ticket });

        // Fulfill whatever the instance still requires.
        const missingFields = () => res.missingFields || [];
        const unverified = () => res.unverifiedFields || [];

        // Password (most common requirement).
        if (res.status !== "complete" && suPassword && missingFields().includes("password")) {
          res = await signUp.update({ password: suPassword });
        }

        // A username is required by the instance → use the one the invitee
        // chose in the form.
        if (res.status !== "complete" && missingFields().includes("username")) {
          const uname = suUsername.trim();
          if (!uname) {
            setError("Please choose a username to finish setting up your account.");
            return;
          }
          res = await signUp.update({ username: uname });
        }

        // Email somehow still unverified → fall back to an email code.
        if (res.status !== "complete" && unverified().includes("email_address")) {
          await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
          setPendingCode(true);
          return;
        }

        if (res.status === "complete") {
          await setSignUpActive({ session: res.createdSessionId });
          navigate("/dashboard", { replace: true });
          return;
        }

        // Still incomplete — surface exactly what's missing so we can fix it.
        // eslint-disable-next-line no-console
        console.warn("[signup ticket] incomplete:", res.status, "missing:", res.missingFields, "unverified:", res.unverifiedFields);
        const needs = [...missingFields(), ...unverified().map((f) => `${f} (unverified)`)];
        setError(
          needs.length
            ? `Couldn't finish — your workshop's Clerk settings still require: ${needs.join(", ")}.`
            : `Couldn't finish setting up your account (status: ${res.status}).`
        );
        return;
      }

      await signUp.create({
        emailAddress: suEmail.trim(),
        password: suPassword,
        ...(suUsername.trim() ? { username: suUsername.trim() } : {}),
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingCode(true);
    } catch (err) {
      setError(signUpErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!signUpLoaded || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await signUp.attemptEmailAddressVerification({ code: suCode.trim() });
      if (res.status === "complete") {
        await setSignUpActive({ session: res.createdSessionId });
        navigate("/dashboard", { replace: true });
        return;
      }
      setError("That code didn't work. Please check it and try again.");
    } catch (err) {
      setError(clerkErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const isSignUp = view === "signup";
  const title = pendingTakeover
    ? "You're already signed in"
    : isSignUp
      ? ticket
        ? "Accept your invitation"
        : "Create your account"
      : "Sign in to GEMS DNA";
  const subtitle = pendingTakeover
    ? "Your account is active on another device"
    : isSignUp
      ? pendingCode
        ? "Enter the verification code we just emailed you"
        : ticket
          ? "Set a password to finish setting up your account"
          : "Create your GEMS DNA account to get started"
      : "Welcome back — please sign in to continue";

  const errorBox = error ? (
    <p className="rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-600">{error}</p>
  ) : null;

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
            aria-label={isSignUp ? "Create account" : "Sign in"}
          >
            {/* Header */}
            <div className="relative shrink-0 overflow-hidden">
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

              {/* Emblem + title. */}
              <div
                onPointerDown={(ev) => drag.start(ev)}
                className="relative flex cursor-grab touch-none flex-col items-center px-6 pb-5 pt-3 text-center active:cursor-grabbing"
              >
                <div className="relative mb-3.5">
                  <span className="absolute -inset-2.5 rounded-[20px] bg-app-ink/10 blur-xl" aria-hidden />
                  <span className="relative inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-app-ink shadow-[0_12px_28px_-10px_rgba(0,0,0,0.55)]">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2L2 9L12 22L22 9L12 2Z" fill="rgb(var(--app-canvas))" />
                      <path d="M2 9H22" stroke="rgba(255,255,255,0.45)" strokeWidth="0.6" />
                      <path d="M12 2L8 9L12 22L16 9L12 2Z" fill="rgb(var(--app-canvas))" fillOpacity="0.25" />
                    </svg>
                    <span className="pointer-events-none absolute inset-0 rounded-[18px] ring-1 ring-inset ring-white/15" aria-hidden />
                  </span>
                </div>
                <h2 className="text-[20px] font-semibold tracking-tight text-app-ink">{title}</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-app-muted">{subtitle}</p>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-1">
              <div className="mx-auto w-full max-w-[400px]">
                {pendingTakeover ? (
                  /* ----------------------- SESSION TAKEOVER ------------------------ */
                  <div className="flex flex-col gap-4">
                    <div className="rounded-xl border border-app-line bg-app-canvas2 px-4 py-3.5">
                      <p className="text-[13.5px] leading-relaxed text-app-graphite">
                        This account is currently signed in on another device
                        {pendingTakeover.others?.[0]?.label ? (
                          <>
                            {" "}(
                            <span className="font-medium text-app-ink">
                              {pendingTakeover.others[0].label}
                            </span>
                            )
                          </>
                        ) : null}
                        . Only one active session is allowed at a time.
                      </p>
                      <p className="mt-2 text-[13.5px] leading-relaxed text-app-graphite">
                        Continue here and we&apos;ll sign you out on the other device.
                      </p>
                    </div>

                    {errorBox}

                    <button
                      type="button"
                      onClick={confirmTakeover}
                      disabled={submitting}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-app-ink py-3 text-[14.5px] font-semibold tracking-tight text-app-canvas shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)] transition hover:bg-app-graphite active:scale-[0.99] disabled:opacity-60"
                    >
                      {submitting ? <Spinner className="h-4 w-4 text-app-canvas" /> : null}
                      Continue here &amp; sign out the other device
                    </button>
                    <button
                      type="button"
                      onClick={cancelTakeover}
                      disabled={submitting}
                      className="flex w-full items-center justify-center rounded-xl border border-app-line bg-app-surface py-2.5 text-[13.5px] font-medium text-app-graphite transition hover:bg-app-canvas2 active:scale-[0.99] disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                ) : !isSignUp ? (
                  /* ---------------------------- SIGN IN ---------------------------- */
                  <>
                    <button
                      type="button"
                      onClick={handleGoogle}
                      disabled={googleLoading || !isLoaded}
                      className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-app-line bg-app-surface py-3 text-[14px] font-medium text-app-ink transition hover:bg-app-canvas2 active:scale-[0.99] disabled:opacity-60"
                    >
                      {googleLoading ? <Spinner className="h-4 w-4 text-app-ink" /> : <GoogleGlyph />}
                      Continue with Google
                    </button>

                    <div className="my-5 flex items-center gap-3">
                      <span className="h-px flex-1 bg-app-line" />
                      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-app-soft">or</span>
                      <span className="h-px flex-1 bg-app-line" />
                    </div>

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
                          <EyeToggle shown={showPassword} onToggle={() => setShowPassword((s) => !s)} />
                        </div>
                      </div>

                      {errorBox}

                      <button
                        type="submit"
                        disabled={submitting || !isLoaded}
                        className="mt-1 flex w-full items-center justify-center gap-2 rounded-full bg-app-ink py-3 text-[14.5px] font-semibold tracking-tight text-app-canvas shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)] transition hover:bg-app-graphite active:scale-[0.99] disabled:opacity-60"
                      >
                        {submitting ? <Spinner className="h-4 w-4 text-app-canvas" /> : null}
                        Continue
                      </button>
                    </form>

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

                    <p className="mt-6 text-center text-[13px] text-app-muted">
                      Have an invitation?{" "}
                      <button
                        type="button"
                        onClick={() => switchTo("signup")}
                        className="font-semibold text-app-ink hover:underline"
                      >
                        Create your account
                      </button>
                    </p>
                  </>
                ) : pendingCode ? (
                  /* ------------------------ VERIFY EMAIL CODE ----------------------- */
                  <form onSubmit={handleVerify} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="signup-code" className="text-[13px] font-medium text-app-graphite">
                        Verification code
                      </label>
                      <input
                        id="signup-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={suCode}
                        onChange={(ev) => setSuCode(ev.target.value)}
                        placeholder="Enter the 6-digit code"
                        className="w-full rounded-xl border border-app-line bg-app-canvas2 px-3.5 py-3 text-center text-[18px] tracking-[0.3em] text-app-ink placeholder:tracking-normal placeholder:text-app-soft transition focus:border-app-line2 focus:outline-none"
                      />
                    </div>

                    {errorBox}

                    <button
                      type="submit"
                      disabled={submitting || !signUpLoaded}
                      className="mt-1 flex w-full items-center justify-center gap-2 rounded-full bg-app-ink py-3 text-[14.5px] font-semibold tracking-tight text-app-canvas shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)] transition hover:bg-app-graphite active:scale-[0.99] disabled:opacity-60"
                    >
                      {submitting ? <Spinner className="h-4 w-4 text-app-canvas" /> : null}
                      Verify &amp; continue
                    </button>

                    <p className="mt-2 text-center text-[13px] text-app-muted">
                      <button
                        type="button"
                        onClick={() => switchTo("signup")}
                        className="font-semibold text-app-ink hover:underline"
                      >
                        Back
                      </button>
                    </p>
                  </form>
                ) : (
                  /* ---------------------------- CREATE ACCOUNT ---------------------- */
                  <>
                    {!ticket && (
                      <>
                        <button
                          type="button"
                          onClick={handleGoogle}
                          disabled={googleLoading || !isLoaded}
                          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-app-line bg-app-surface py-3 text-[14px] font-medium text-app-ink transition hover:bg-app-canvas2 active:scale-[0.99] disabled:opacity-60"
                        >
                          {googleLoading ? <Spinner className="h-4 w-4 text-app-ink" /> : <GoogleGlyph />}
                          Continue with Google
                        </button>

                        <div className="my-5 flex items-center gap-3">
                          <span className="h-px flex-1 bg-app-line" />
                          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-app-soft">or</span>
                          <span className="h-px flex-1 bg-app-line" />
                        </div>
                      </>
                    )}

                    <form onSubmit={handleSignUp} className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="signup-email" className="text-[13px] font-medium text-app-graphite">
                          Email address
                        </label>
                        <input
                          id="signup-email"
                          type="email"
                          autoComplete="email"
                          value={suEmail}
                          onChange={(ev) => setSuEmail(ev.target.value)}
                          readOnly={!!ticket}
                          placeholder="you@example.com"
                          className={`w-full rounded-xl border border-app-line bg-app-canvas2 px-3.5 py-3 text-[16px] text-app-ink placeholder:text-app-soft transition focus:border-app-line2 focus:outline-none${
                            ticket ? " cursor-not-allowed opacity-70" : ""
                          }`}
                        />
                        {ticket ? (
                          <p className="text-[12px] text-app-soft">
                            This is the email your invitation was sent to.
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="signup-username" className="text-[13px] font-medium text-app-graphite">
                          Username
                        </label>
                        <input
                          id="signup-username"
                          type="text"
                          autoComplete="username"
                          value={suUsername}
                          onChange={(ev) => setSuUsername(ev.target.value)}
                          placeholder="Choose a username"
                          className="w-full rounded-xl border border-app-line bg-app-canvas2 px-3.5 py-3 text-[16px] text-app-ink placeholder:text-app-soft transition focus:border-app-line2 focus:outline-none"
                        />
                        <p className="text-[12px] text-app-soft">
                          At least 4 characters — letters, numbers or underscores.
                        </p>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="signup-password" className="text-[13px] font-medium text-app-graphite">
                          {ticket ? "Choose a password" : "Password"}
                        </label>
                        <div className="relative">
                          <input
                            id="signup-password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="new-password"
                            value={suPassword}
                            onChange={(ev) => setSuPassword(ev.target.value)}
                            placeholder="Create a password"
                            className="w-full rounded-xl border border-app-line bg-app-canvas2 px-3.5 py-3 pr-11 text-[16px] text-app-ink placeholder:text-app-soft transition focus:border-app-line2 focus:outline-none"
                          />
                          <EyeToggle shown={showPassword} onToggle={() => setShowPassword((s) => !s)} />
                        </div>
                      </div>

                      {errorBox}

                      {/* Clerk Smart CAPTCHA (bot protection) renders here.
                          Required for custom sign-up flows — without this
                          element Clerk falls back to an invisible CAPTCHA that
                          can fail to load ("Error loading CAPTCHA"). */}
                      <div id="clerk-captcha" className="flex justify-center empty:hidden" />

                      <button
                        type="submit"
                        disabled={submitting || !signUpLoaded}
                        className="mt-1 flex w-full items-center justify-center gap-2 rounded-full bg-app-ink py-3 text-[14.5px] font-semibold tracking-tight text-app-canvas shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)] transition hover:bg-app-graphite active:scale-[0.99] disabled:opacity-60"
                      >
                        {submitting ? <Spinner className="h-4 w-4 text-app-canvas" /> : null}
                        Continue
                      </button>
                    </form>

                    <p className="mt-6 text-center text-[13px] text-app-muted">
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => switchTo("signin")}
                        className="font-semibold text-app-ink hover:underline"
                      >
                        Sign in
                      </button>
                    </p>
                  </>
                )}
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
