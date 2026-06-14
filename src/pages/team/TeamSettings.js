import React, { useEffect, useState, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import { useTeam } from "../../context/TeamContext";
import {
  inviteTeamMember,
  fetchTeamLeaderboard,
  resendTeamInvite,
} from "../../services/teamApi";
import { fetchTeamActivity } from "../../services/activityApi";
import MemberAvatar from "../../components/team/MemberAvatar";
import MemberDetail from "../../components/team/MemberDetail";
import PermissionsEditor from "../../components/team/PermissionsEditor";
import {
  ASSIGNABLE_ROLES,
  DEFAULT_PERMS,
  fmtMoney,
  isAdminRole,
  roleLabelFor,
} from "../../components/team/teamUtils";

const CAP = 11; // owner + 10 reps

const RoleBadge = ({ role }) => {
  const tint = isAdminRole(role)
    ? "bg-amber-100 text-amber-700 ring-amber-200"
    : role === "manager"
    ? "bg-sky-100 text-sky-700 ring-sky-200"
    : "bg-emerald-100 text-emerald-700 ring-emerald-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${tint}`}>
      {roleLabelFor(role)}
    </span>
  );
};

const StatCard = ({ label, value, accent = "stone" }) => {
  const tint = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    sky: "bg-sky-50 text-sky-700 ring-sky-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
    stone: "bg-stone-50 text-stone-700 ring-stone-200",
  }[accent];
  return (
    <div className={`rounded-xl ring-1 ${tint} p-3`}>
      <div className="text-xl font-bold leading-none tabular-nums">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider opacity-80 leading-tight">{label}</div>
    </div>
  );
};

const QuotaMini = ({ pct }) => {
  const v = Math.max(0, Math.min(100, Number(pct) || 0));
  const tone = v >= 100 ? "bg-emerald-500" : v >= 60 ? "bg-sky-500" : v >= 30 ? "bg-amber-500" : "bg-rose-400";
  return (
    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-stone-100">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${v}%` }} />
    </div>
  );
};

const Field = ({ label, required, children }) => (
  <label className="block">
    <span className="mb-1 block text-[11px] uppercase tracking-wider font-medium text-stone-500">
      {label}{required && <span className="text-rose-500"> *</span>}
    </span>
    {children}
  </label>
);

/* ------------------------------------------------------------ Invite modal */

const InviteModal = ({ remaining, onClose, onInvited, actor, refresh }) => {
  const [inviting, setInviting] = useState(false);
  const [role, setRole] = useState("salesman");
  const [sections, setSections] = useState([...DEFAULT_PERMS.sections]);
  const [locationView, setLocationView] = useState(DEFAULT_PERMS.locationView);
  const [canViewCost, setCanViewCost] = useState(false);

  const toggleSection = (key) =>
    setSections((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const submit = async (e) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    const fd = new FormData(formEl);
    const payload = {
      email: String(fd.get("email") || "").trim().toLowerCase(),
      name: String(fd.get("name") || "").trim(),
      role,
      permissions: { sections, locationView, canViewCost },
      commissionPct: Number(fd.get("commissionPct") || 0),
      quotaMonthly: Number(fd.get("quotaMonthly") || 0),
    };
    if (!payload.email || !payload.name) {
      toast.error("Email and name are required");
      return;
    }
    setInviting(true);
    try {
      const r = await inviteTeamMember(actor, payload);
      if (r?.email?.sent) toast.success(`Invitation email sent to ${payload.name}`);
      else if (r?.email?.skipped) toast(`${payload.name} added — share the sign-in link manually.`, { icon: "ℹ️", duration: 6000 });
      else toast.success(`${payload.name} added (email delivery failed — try Resend later)`);
      await refresh();
      onInvited?.();
      onClose();
    } catch (err) {
      toast.error(err.message || "Invite failed");
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-stone-800">Invite a team member</h2>
          <button type="button" onClick={onClose} className="-m-1.5 rounded-full p-1.5 text-stone-400 hover:bg-stone-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Full name" required>
            <input name="name" required placeholder="Liora Cohen" autoComplete="off" className="team-input" />
          </Field>
          <Field label="Email" required>
            <input name="email" type="email" required placeholder="liora@example.com" autoComplete="off" className="team-input" />
          </Field>
          <Field label="Role" required>
            <select
              value={role}
              onChange={(e) => {
                const next = e.target.value;
                setRole(next);
                setCanViewCost(next === "manager" || next === "admin");
              }}
              className="team-input"
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Commission %">
            <input name="commissionPct" type="number" step="0.5" min="0" max="100" placeholder="10" className="team-input" />
          </Field>
          <Field label="Monthly quota (USD)">
            <input name="quotaMonthly" type="number" step="100" min="0" placeholder="20000" className="team-input" />
          </Field>
        </div>
        <div className="mt-4 border-t border-stone-100 pt-4">
          {role === "admin" ? (
            <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 px-3 py-2.5 ring-1 ring-amber-100">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[12.5px] text-amber-800 leading-snug">
                <span className="font-semibold">Admins get full access</span> — every section, full stone-location
                detail, internal cost &amp; margin, and team management. No per-section setup needed.
              </p>
            </div>
          ) : (
            <PermissionsEditor
              sections={sections}
              locationView={locationView}
              canViewCost={canViewCost}
              onToggleSection={toggleSection}
              onLocationView={setLocationView}
              onToggleCost={setCanViewCost}
            />
          )}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-stone-500">
          They're linked automatically the first time they sign in with this email. Until then they show as
          <span className="font-medium"> Pending sign-in</span>.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-600 hover:bg-stone-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={inviting || remaining <= 0}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition ${
              inviting ? "bg-emerald-400 cursor-wait" : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {inviting ? "Inviting…" : "Send invite"}
          </button>
        </div>
      </form>
    </div>
  );
};

/* ----------------------------------------------------------- Member list row */

const MemberRow = ({ member, kpis, presence, selected, onSelect }) => {
  const isOwner = member.role === "owner";
  const isPending = !member.clerk_user_id && !isOwner;
  const online = !!presence.online;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
        selected
          ? "border-emerald-300 bg-emerald-50/60 ring-1 ring-emerald-200"
          : "border-stone-200 bg-white hover:bg-stone-50"
      }`}
    >
      <div className="relative shrink-0">
        <MemberAvatar member={member} size="md" />
        {!isOwner && (
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
              online ? "bg-emerald-500" : "bg-stone-300"
            }`}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-stone-800">{member.name}</span>
          <RoleBadge role={member.role} />
        </div>
        <div className="truncate text-[11.5px] text-stone-500">{member.email}</div>
      </div>
      <div className="shrink-0 text-right">
        {isPending ? (
          <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-stone-500">
            Pending
          </span>
        ) : isOwner ? (
          <span className="text-[11px] text-stone-400">{online ? "online" : "owner"}</span>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <span className="text-[12px] font-semibold tabular-nums text-stone-700">{fmtMoney(kpis.revenueMtd)}</span>
            {kpis.quotaPct != null && <QuotaMini pct={kpis.quotaPct} />}
          </div>
        )}
      </div>
    </button>
  );
};

/* ------------------------------------------------------------------- Page */

const TeamSettings = () => {
  const team = useTeam();
  const [leaderboard, setLeaderboard] = useState([]);
  const [presence, setPresence] = useState([]); // reps rollup from /api/team/activity
  const [selectedId, setSelectedId] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [resendingAll, setResendingAll] = useState(false);

  // Toolbar state.
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all"); // all | manager | salesman | pending | online
  const [sortBy, setSortBy] = useState("name"); // name | revenue | quota | recent

  const loadLeaderboard = useCallback(async () => {
    if (!team.actor?.id) return;
    try {
      const r = await fetchTeamLeaderboard(team.actor);
      setLeaderboard(Array.isArray(r?.leaderboard) ? r.leaderboard : []);
    } catch (e) {
      console.warn("Leaderboard failed:", e.message);
    }
  }, [team.actor]);

  const loadPresence = useCallback(async () => {
    if (!team.actor?.id) return;
    try {
      const r = await fetchTeamActivity(team.actor, { repsOnly: 1 });
      setPresence(Array.isArray(r?.reps) ? r.reps : []);
    } catch (_) { /* presence is best-effort */ }
  }, [team.actor]);

  useEffect(() => {
    if (!team.ready || !team.isAdmin) return undefined;
    loadLeaderboard();
    loadPresence();
    const t = setInterval(loadPresence, 15000);
    return () => clearInterval(t);
  }, [team.ready, team.isAdmin, loadLeaderboard, loadPresence]);

  const kpisById = useMemo(() => {
    const map = {};
    for (const x of leaderboard) map[x.memberId] = x;
    return map;
  }, [leaderboard]);

  const presenceByClerk = useMemo(() => {
    const map = {};
    for (const r of presence) if (r.actor_id) map[r.actor_id] = r;
    return map;
  }, [presence]);

  const onChanged = useCallback(async () => {
    await team.refresh();
    await loadLeaderboard();
    await loadPresence();
  }, [team, loadLeaderboard, loadPresence]);

  // Admin-only bulk action: re-send the invitation email to everyone still
  // pending sign-in, in one click.
  const resendAllPending = useCallback(async (pendingMembers) => {
    if (!pendingMembers.length || resendingAll) return;
    setResendingAll(true);
    let ok = 0;
    let failed = 0;
    for (const m of pendingMembers) {
      try {
        await resendTeamInvite(team.actor, m.id);
        ok += 1;
      } catch (_) {
        failed += 1;
      }
    }
    if (ok) toast.success(`Re-sent ${ok} invite${ok === 1 ? "" : "s"}${failed ? ` · ${failed} failed` : ""}`);
    else toast.error("Couldn't resend invites — try again");
    await onChanged();
    setResendingAll(false);
  }, [team.actor, resendingAll, onChanged]);

  if (team.loading) {
    return <div className="p-6 text-sm text-stone-500">Loading team…</div>;
  }

  if (!team.isAdmin) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
          <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v3m0 4h.01M5 19h14a2 2 0 001.7-3L13.7 5a2 2 0 00-3.4 0L3.3 16A2 2 0 005 19z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-stone-800">Team management is admin-only</h2>
        <p className="mt-2 text-stone-500">
          You don't have admin access. Ask your workshop owner or an admin to invite, edit, or remove team members.
        </p>
      </div>
    );
  }

  const members = team.members || [];
  const owner = members.find((m) => m.role === "owner");
  const reps = members.filter((m) => m.role !== "owner");
  const remaining = Math.max(0, CAP - members.length);
  const onlineCount = members.filter((m) => presenceByClerk[m.clerk_user_id]?.online).length;
  const adminCount = members.filter((m) => isAdminRole(m.role)).length;
  const pendingMembers = reps.filter((m) => !m.clerk_user_id);

  // Filter + sort the roster for the list panel.
  const ordered = [owner, ...reps].filter(Boolean);
  const filtered = ordered.filter((m) => {
    if (query) {
      const q = query.toLowerCase();
      if (!(`${m.name} ${m.email}`.toLowerCase().includes(q))) return false;
    }
    const isPending = !m.clerk_user_id && m.role !== "owner";
    if (roleFilter === "manager" && m.role !== "manager") return false;
    if (roleFilter === "salesman" && !(m.role === "salesman" || m.role === "rep")) return false;
    if (roleFilter === "pending" && !isPending) return false;
    if (roleFilter === "online" && !presenceByClerk[m.clerk_user_id]?.online) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => {
    // Owner always floats to the top regardless of sort.
    if (a.role === "owner") return -1;
    if (b.role === "owner") return 1;
    if (sortBy === "revenue") return (kpisById[b.id]?.revenueMtd || 0) - (kpisById[a.id]?.revenueMtd || 0);
    if (sortBy === "quota") return (kpisById[b.id]?.quotaPct || 0) - (kpisById[a.id]?.quotaPct || 0);
    if (sortBy === "recent") {
      const at = new Date(presenceByClerk[a.clerk_user_id]?.last_seen || a.last_seen || 0).getTime();
      const bt = new Date(presenceByClerk[b.clerk_user_id]?.last_seen || b.last_seen || 0).getTime();
      return bt - at;
    }
    return String(a.name || "").localeCompare(String(b.name || ""));
  });

  const selected = members.find((m) => m.id === selectedId) || null;

  const FILTERS = [
    ["all", "All"],
    ["online", "Online"],
    ["manager", "Managers"],
    ["salesman", "Salesmen"],
    ["pending", "Pending"],
  ];

  return (
    <div className="mx-auto max-w-7xl p-3 sm:p-6">
      {/* Header */}
      <header className="mb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold leading-tight text-stone-800">Team &amp; Sales Reps</h1>
            <p className="mt-1 text-xs sm:text-sm text-stone-500">
              Manage every member down to the detail — role, commission, quota, exactly which sections they see,
              how much stone-location detail they get, plus live presence and their full activity history.
            </p>
          </div>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            {pendingMembers.length > 0 && (
              <button
                onClick={() => resendAllPending(pendingMembers)}
                disabled={resendingAll}
                title="Re-send the invitation email to everyone still pending"
                className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-60"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {resendingAll ? "Sending…" : `Resend ${pendingMembers.length} pending`}
              </button>
            )}
            <button
              onClick={() => setShowInvite(true)}
              disabled={remaining <= 0}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition ${
                remaining <= 0
                  ? "cursor-not-allowed bg-stone-100 text-stone-400"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Invite member
            </button>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
        <StatCard label="Members" value={members.length} />
        <StatCard label="Admins" value={adminCount} accent="amber" />
        <StatCard label="Online now" value={onlineCount} accent="emerald" />
        <StatCard label="Active reps" value={reps.filter((m) => m.active).length} accent="sky" />
        <StatCard label="Pending" value={pendingMembers.length} accent="rose" />
        <StatCard label="Seats left" value={remaining} accent="stone" />
      </div>

      {/* Mobile actions */}
      <div className="mb-4 flex gap-2 sm:hidden">
        <button
          onClick={() => setShowInvite(true)}
          disabled={remaining <= 0}
          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-sm transition ${
            remaining <= 0 ? "cursor-not-allowed bg-stone-100 text-stone-400" : "bg-emerald-600 text-white hover:bg-emerald-700"
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Invite member
        </button>
        {pendingMembers.length > 0 && (
          <button
            onClick={() => resendAllPending(pendingMembers)}
            disabled={resendingAll}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-60"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {resendingAll ? "Sending…" : `Resend (${pendingMembers.length})`}
          </button>
        )}
      </div>

      {/* Master / detail */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(300px,360px)_1fr]">
        {/* List + toolbar */}
        <div className="min-w-0">
          <div className="mb-3 space-y-2">
            <div className="relative">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or email…"
                className="team-input pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex flex-1 gap-1 overflow-x-auto scrollbar-hide">
                {FILTERS.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setRoleFilter(id)}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-medium transition ${
                      roleFilter === id ? "bg-stone-800 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="shrink-0 rounded-lg border border-stone-200 bg-white px-2 py-1 text-[12px] text-stone-600"
                title="Sort by"
              >
                <option value="name">Name</option>
                <option value="revenue">Revenue</option>
                <option value="quota">Quota %</option>
                <option value="recent">Recent</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            {sorted.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                kpis={kpisById[m.id] || {}}
                presence={presenceByClerk[m.clerk_user_id] || {}}
                selected={selectedId === m.id}
                onSelect={() => setSelectedId(m.id)}
              />
            ))}
            {sorted.length === 0 && (
              <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/50 px-4 py-10 text-center text-sm text-stone-500">
                {members.length <= 1 ? "No reps invited yet — invite your first team member." : "No members match this filter."}
              </div>
            )}
          </div>
        </div>

        {/* Detail (desktop) */}
        <div className="hidden lg:block">
          {selected ? (
            <div className="rounded-2xl border border-stone-200 bg-white shadow-sm">
              <MemberDetail
                actor={team.actor}
                member={selected}
                kpis={kpisById[selected.id] || {}}
                presence={presenceByClerk[selected.clerk_user_id] || {}}
                onChanged={onChanged}
              />
            </div>
          ) : (
            <div className="flex h-full min-h-[400px] items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-stone-50/40">
              <div className="text-center text-stone-400">
                <svg className="mx-auto mb-3 h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-3-3m0 0l-3 3m3-3V10m6 9a9 9 0 11-12 0" />
                </svg>
                <p className="text-sm font-medium">Select a member</p>
                <p className="text-xs">Pick someone on the left to view and manage their details.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail (mobile overlay) */}
      {selected && (
        <div className="fixed inset-0 z-40 bg-white lg:hidden">
          <div className="h-full overflow-hidden">
            <MemberDetail
              actor={team.actor}
              member={selected}
              kpis={kpisById[selected.id] || {}}
              presence={presenceByClerk[selected.clerk_user_id] || {}}
              onChanged={onChanged}
              onClose={() => setSelectedId(null)}
            />
          </div>
        </div>
      )}

      {showInvite && (
        <InviteModal
          remaining={remaining}
          actor={team.actor}
          refresh={team.refresh}
          onInvited={onChanged}
          onClose={() => setShowInvite(false)}
        />
      )}

      <p className="mt-5 text-[11px] leading-relaxed text-stone-400">
        Tip: presence updates live every 15&nbsp;seconds. Members show as <span className="font-medium">Pending sign-in</span> until they
        first sign in with their invited email — use <span className="font-medium">Resend invite</span> on their card if the email got lost.
      </p>

      <style>{`
        .team-input {
          width: 100%;
          border: 1px solid #e7e5e4;
          background: #fff;
          border-radius: 8px;
          padding: 0.45rem 0.65rem;
          font-size: 0.875rem;
          color: #1c1917;
        }
        .team-input:focus {
          outline: 2px solid #10b98155;
          border-color: #10b981;
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default TeamSettings;
