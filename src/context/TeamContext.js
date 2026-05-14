import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { useUser } from "@clerk/clerk-react";
import { fetchTeamMe, colorFromSeed } from "../services/teamApi";

/**
 * TeamContext — single source of truth for "who am I, and who's on my team?".
 *
 * Loaded once on signed-in app boot via /api/team/me. Components read:
 *   - me, isOwner, role        (current actor)
 *   - members[]                (full roster, used by AssigneeFilter/Picker)
 *   - membersById              (O(1) lookup by member.id)
 *   - membersByClerkId         (O(1) lookup by clerk_user_id, used to render
 *                               an avatar from a record's `assigned_to`)
 *   - tenantUserId             (the workspace owner's clerk id; same as
 *                               user.id for solo workspaces)
 *
 * Empty/loading states are exposed so callers don't render filter chips
 * before we know the roster.
 */
const TeamContext = createContext({
  loading: true,
  ready: false,
  me: null,
  members: [],
  membersById: {},
  membersByClerkId: {},
  tenantUserId: null,
  actorUserId: null,
  role: null,
  isOwner: true,
  isStoreUser: false,
  companyId: null,
  refresh: () => {},
});

export const TeamProvider = ({ children }) => {
  const { user, isSignedIn } = useUser();
  const [state, setState] = useState({
    loading: true,
    ready: false,
    me: null,
    members: [],
    tenantUserId: null,
    actorUserId: null,
    role: null,
    isOwner: true,
    isStoreUser: false,
    companyId: null,
  });

  const actor = useMemo(() => {
    if (!user) return null;
    return {
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress || null,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || null,
    };
  }, [user]);

  const refresh = useCallback(async () => {
    if (!isSignedIn || !actor?.id) {
      setState((s) => ({ ...s, loading: false, ready: false }));
      return;
    }
    try {
      const data = await fetchTeamMe(actor);
      setState({
        loading: false,
        ready: true,
        me: data?.me || null,
        members: Array.isArray(data?.members) ? data.members : [],
        tenantUserId: data?.tenantUserId || actor.id,
        actorUserId: data?.actorUserId || actor.id,
        role: data?.role || "owner",
        isOwner: data?.isOwner !== undefined ? !!data.isOwner : true,
        isStoreUser: !!data?.isStoreUser,
        companyId: data?.companyId || null,
      });
    } catch (e) {
      // Failure should never break the app — fall back to "you're a solo owner".
      console.warn("TeamProvider /me failed:", e.message);
      setState({
        loading: false,
        ready: true,
        me: null,
        members: [],
        tenantUserId: actor.id,
        actorUserId: actor.id,
        role: "owner",
        isOwner: true,
        isStoreUser: false,
        companyId: null,
      });
    }
  }, [isSignedIn, actor]);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(() => {
    const membersById = {};
    const membersByClerkId = {};
    for (const m of state.members) {
      membersById[m.id] = m;
      if (m.clerk_user_id) membersByClerkId[m.clerk_user_id] = m;
    }
    return {
      ...state,
      actor,
      membersById,
      membersByClerkId,
      refresh,
      // Resolve a clerk_user_id → display info, with a sensible fallback for
      // "assigned to someone we don't recognise (yet)".
      memberFor: (clerkUserId) => {
        if (!clerkUserId) return null;
        const m = membersByClerkId[clerkUserId];
        if (m) return m;
        return {
          id: null,
          clerk_user_id: clerkUserId,
          name: "Unknown",
          email: null,
          role: "rep",
          avatar_color: colorFromSeed(clerkUserId),
        };
      },
    };
  }, [state, actor, refresh]);

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
};

export const useTeam = () => useContext(TeamContext);

export default TeamContext;
