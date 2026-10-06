import { useMemo } from "react";
import { useUser } from "@clerk/clerk-react";
import { useTeam } from "../context/TeamContext";

export const roleLabel = (team) => {
  if (!team) return "";
  if (team.isAdmin) return "Admin";
  if (team.isManager) return "Manager";
  if (team.isSalesman) return "Salesman";
  return "Member";
};

/* Who is signed in — Clerk account details with the workspace member record
 * as fallback, plus the workspace role. */
export const useIdentity = () => {
  const { user } = useUser();
  const team = useTeam();
  return useMemo(() => {
    const me = team?.me || null;
    const clerkName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
    const name = clerkName || me?.name || user?.username || "";
    const firstName = user?.firstName || (me?.name || "").trim().split(/\s+/)[0] || "";
    return {
      userId: user?.id || null,
      name,
      firstName,
      email: user?.primaryEmailAddress?.emailAddress || me?.email || "",
      imageUrl: user?.hasImage ? user.imageUrl : null,
      role: team?.ready ? roleLabel(team) : "",
      member: me,
    };
  }, [user, team]);
};
