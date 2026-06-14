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

// Nav sections the admin can grant per-user. Keep in sync with the BE
// NAV_SECTION_KEYS and the PERMISSION_SECTIONS config in App.js.
export const ALL_SECTION_KEYS = [
  "dashboard", "inventory", "crm", "sales", "team", "tools",
];
// Admins implicitly get everything.
const ADMIN_PERMISSIONS = { sections: [...ALL_SECTION_KEYS], locationView: "full" };

const normalizePermissions = (raw) => {
  const p = raw && typeof raw === "object" ? raw : {};
  const sections = Array.isArray(p.sections)
    ? p.sections.filter((s) => ALL_SECTION_KEYS.includes(s))
    : [];
  const locationView = ["full", "memo_branch", "branch_only"].includes(p.locationView)
    ? p.locationView
    : "branch_only";
  return { sections, locationView };
};

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
  permissions: ADMIN_PERMISSIONS,
  locationView: "full",
  isOwner: true,
  isAdmin: true,
  isManager: false,
  isSalesman: false,
  isStoreUser: false,
  companyId: null,
  can: () => true,
  canViewExactLocation: true,
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
    permissions: null,
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
        permissions: data?.permissions || data?.me?.permissions || null,
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
        permissions: ADMIN_PERMISSIONS,
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
    // Normalised role helpers. The workspace owner *is* the admin. A legacy
    // 'rep' is treated as a salesman. Store users are handled separately.
    const isAdmin = !!state.isOwner || state.role === "owner" || state.role === "admin";
    const isManager = state.role === "manager";
    const isSalesman = !isAdmin && (state.role === "salesman" || state.role === "rep");

    // Per-user permissions. Admins implicitly get everything; everyone else
    // uses the set the admin configured (normalised so unknown keys can't slip
    // in). `can(section)` gates nav/routes; `locationView` gates memo detail.
    const permissions = isAdmin ? ADMIN_PERMISSIONS : normalizePermissions(state.permissions);
    const can = (section) => isAdmin || permissions.sections.includes(section);
    const locationView = permissions.locationView;
    const canViewExactLocation = locationView === "full";

    return {
      ...state,
      actor,
      isAdmin,
      isManager,
      isSalesman,
      permissions,
      locationView,
      canViewExactLocation,
      can,
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
