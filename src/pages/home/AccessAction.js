import { Link } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import LoginSheet from "../../components/LoginSheet";
import { useTeam } from "../../context/TeamContext";

/* The page's one primary action: sign in, or — once signed in — go to the
 * workspace. Until Clerk has loaded it shows "Sign in", which works either
 * way, so the button never disappears while auth resolves. */
export function AccessAction({ variant = "primary", detectInvite = false }) {
  const { isLoaded, isSignedIn } = useAuth();
  const team = useTeam();
  const cls = variant === "quiet" ? "home-btn home-btn--quiet" : "home-btn home-btn--primary";

  if (isLoaded && isSignedIn) {
    return (
      <Link className={cls} to={team?.isStoreUser ? "/store-portal" : "/dashboard"}>
        {team?.isStoreUser ? "Open portal" : "Open workspace"}
      </Link>
    );
  }
  return (
    <LoginSheet detectInvite={detectInvite}>
      <button type="button" className={cls}>
        Sign in
      </button>
    </LoginSheet>
  );
}
