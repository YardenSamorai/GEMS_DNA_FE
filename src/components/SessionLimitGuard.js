import { useEffect, useRef } from "react";
import { useAuth, useSession } from "@clerk/clerk-react";
import { enforceSessionLimit } from "../services/sessionApi";

/**
 * Runs once per active Clerk session after sign-in. Enforces the max-2
 * concurrent session policy (covers Google OAuth, which bypasses LoginSheet).
 * Excess oldest sessions are revoked on the backend; this device stays signed in.
 */
const SessionLimitGuard = () => {
  const { isLoaded, isSignedIn } = useAuth();
  const { session } = useSession();
  const ranFor = useRef(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !session?.id) return undefined;
    if (ranFor.current === session.id) return undefined;
    ranFor.current = session.id;
    enforceSessionLimit(session.id).catch(() => {
      // Best-effort — never block the app shell on a session-limit hiccup.
    });
    return undefined;
  }, [isLoaded, isSignedIn, session?.id]);

  return null;
};

export default SessionLimitGuard;
