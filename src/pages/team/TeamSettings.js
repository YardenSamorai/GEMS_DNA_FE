import React, { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { useTeam } from "../../context/TeamContext";
import {
  inviteTeamMember,
  updateTeamMember,
  removeTeamMember,
  resendTeamInvite,
  fetchTeamLeaderboard,
} from "../../services/teamApi";
import MemberAvatar from "../../components/team/MemberAvatar";

/**
 * TeamSettings — admin-only roster management.
 *
 * Layout:
 *   1. Hero strip with team size + quota progress
 *   2. Invite form (email + name + commission %)
 *   3. Members table (avatar, name, email, role, commission, KPIs, actions)
 *   4. Leaderboard summary card per active rep
 *
 * Reps who hit this URL get a friendly "you're not the workshop owner" notice
 * with a quick link back to the dashboard.
 */
const fmtMoney = (n, cur = "USD") => {
  const v = Number(n) || 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency: cur, maximumFractionDigits: 0,
    }).format(v);
  } catch { return `${cur} ${v.toLocaleString()}`; }
};

// "5 minutes ago" / "3 hours ago" / "2 days ago" — keeps copy honest about
// when the last invite went out so the admin knows when to nudge.
const timeAgo = (iso) => {
  if (!iso) return "";
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  const mo = Math.floor(d / 30);
  return `${mo} month${mo === 1 ? "" : "s"} ago`;
};

// Per-user permissions, set by the admin. `sections` = which nav areas the
// member can open; `locationView` = how much stone-location detail they get.
// Keep keys in sync with TeamContext.ALL_SECTION_KEYS / BE NAV_SECTION_KEYS.
const SECTION_OPTIONS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "inventory", label: "Inventory" },
  { key: "crm", label: "CRM" },
  { key: "sales", label: "Sales Inventory" },
  { key: "team", label: "Team" },
  { key: "tools", label: "Data Quality" },
];
const LOCATION_VIEW_OPTIONS = [
  { value: "full", label: "Full", hint: "Exact location + holder + memo" },
  { value: "memo_branch", label: "Memo + Branch", hint: "Shows it's on memo, branch only" },
  { value: "branch_only", label: "Branch only", hint: "Branch only — no memo, no exact" },
];
const LOCATION_VIEW_LABEL = {
  full: "Full location",
  memo_branch: "Memo + Branch",
  branch_only: "Branch only",
};
const DEFAULT_PERMS = { sections: ["sales"], locationView: "branch_only" };
const permsOf = (m) => {
  const p = m?.permissions && typeof m.permissions === "object" ? m.permissions : {};
  return {
    sections: Array.isArray(p.sections) ? p.sections : [...DEFAULT_PERMS.sections],
    locationView: p.locationView || DEFAULT_PERMS.locationView,
  };
};

const isAdminRole = (role) => role === "owner" || role === "admin";
const roleLabelFor = (role) =>
  isAdminRole(role) ? "Admin" : role === "manager" ? "Manager" : "Salesman";

const RoleBadge = ({ role }) => {
  const tint = isAdminRole(role)
    ? "bg-amber-100 text-amber-700 ring-amber-200"
    : role === "manager"
    ? "bg-sky-100 text-sky-700 ring-sky-200"
    : "bg-emerald-100 text-emerald-700 ring-emerald-200";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${tint}`}
    >
      {roleLabelFor(role)}
    </span>
  );
};

// Reusable permissions editor — section checkboxes + memo-visibility radio.
// Used by both the invite form and the inline member editor.
const PermissionsEditor = ({ sections, locationView, onToggleSection, onLocationView }) => (
  <div className="space-y-3">
    <div>
      <span className="block text-[11px] uppercase tracking-wider font-medium text-stone-500 mb-1.5">
        Visible sections
      </span>
      <div className="grid grid-cols-2 gap-1.5">
        {SECTION_OPTIONS.map((s) => {
          const on = sections.includes(s.key);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onToggleSection(s.key)}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[12.5px] transition ${
                on
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
              }`}
            >
              <span
                className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded ${
                  on ? "bg-emerald-600 text-white" : "bg-stone-200 text-transparent"
                }`}
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </span>
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
    <div>
      <span className="block text-[11px] uppercase tracking-wider font-medium text-stone-500 mb-1.5">
        Stone location visibility
      </span>
      <div className="flex flex-col gap-1.5">
        {LOCATION_VIEW_OPTIONS.map((o) => {
          const on = locationView === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onLocationView(o.value)}
              className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-left transition ${
                on ? "border-sky-300 bg-sky-50" : "border-stone-200 bg-white hover:bg-stone-50"
              }`}
            >
              <span
                className={`mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                  on ? "border-sky-600" : "border-stone-300"
                }`}
              >
                {on && <span className="h-2 w-2 rounded-full bg-sky-600" />}
              </span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-medium text-stone-800">{o.label}</span>
                <span className="block text-[11px] text-stone-500 leading-tight">{o.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

const PendingBadge = () => (
  <span className="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-stone-600">
    Pending sign-in
  </span>
);

const TeamSettings = () => {
  const team = useTeam();
  const [leaderboard, setLeaderboard] = useState([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({
    name: "", commissionPct: "", quotaMonthly: "", role: "salesman",
    sections: [...DEFAULT_PERMS.sections], locationView: DEFAULT_PERMS.locationView,
  });
  const [resendingId, setResendingId] = useState(null);
  // Invite form — controlled so we can carry the per-user permission set.
  const [inviteRole, setInviteRole] = useState("salesman");
  const [inviteSections, setInviteSections] = useState([...DEFAULT_PERMS.sections]);
  const [inviteLocationView, setInviteLocationView] = useState(DEFAULT_PERMS.locationView);

  const toggleInviteSection = (key) =>
    setInviteSections((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  const toggleDraftSection = (key) =>
    setDraft((d) => ({
      ...d,
      sections: d.sections.includes(key)
        ? d.sections.filter((k) => k !== key)
        : [...d.sections, key],
    }));

  const loadLeaderboard = useCallback(async () => {
    if (!team.actor?.id) return;
    try {
      const r = await fetchTeamLeaderboard(team.actor);
      setLeaderboard(Array.isArray(r?.leaderboard) ? r.leaderboard : []);
    } catch (e) {
      console.warn("Leaderboard failed:", e.message);
    }
  }, [team.actor]);

  useEffect(() => {
    if (team.ready) loadLeaderboard();
  }, [team.ready, loadLeaderboard]);

  if (team.loading) {
    return (
      <div className="p-6 text-stone-500 text-sm">Loading team…</div>
    );
  }

  if (!team.isOwner) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <div className="inline-flex w-16 h-16 items-center justify-center rounded-full bg-amber-50 mb-4">
          <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v3m0 4h.01M5 19h14a2 2 0 001.7-3L13.7 5a2 2 0 00-3.4 0L3.3 16A2 2 0 005 19z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-stone-800">Team management is admin-only</h2>
        <p className="text-stone-500 mt-2">
          You're signed in as a sales rep. Ask your workshop owner to invite, edit, or remove team members.
        </p>
      </div>
    );
  }

  const reps = (team.members || []).filter((m) => m.role !== "owner");
  const owner = (team.members || []).find((m) => m.role === "owner");
  const cap = 11; // owner + 10 reps
  const remaining = Math.max(0, cap - (team.members || []).length);

  const handleInvite = async (e) => {
    e.preventDefault();
    // React recycles the SyntheticEvent after the first await, so we must
    // grab a stable reference to the form element before any async call.
    const formEl = e.currentTarget;
    const fd = new FormData(formEl);
    const payload = {
      email: String(fd.get("email") || "").trim().toLowerCase(),
      name: String(fd.get("name") || "").trim(),
      role: inviteRole,
      permissions: { sections: inviteSections, locationView: inviteLocationView },
      commissionPct: Number(fd.get("commissionPct") || 0),
      quotaMonthly: Number(fd.get("quotaMonthly") || 0),
    };
    if (!payload.email || !payload.name) {
      toast.error("Email and name are required");
      return;
    }
    setInviting(true);
    try {
      const r = await inviteTeamMember(team.actor, payload);
      const emailSent    = r?.email?.sent === true;
      const emailSkipped = r?.email?.skipped === true;
      if (emailSent) {
        toast.success(`Invitation email sent to ${payload.name}`);
      } else if (emailSkipped) {
        toast(
          `${payload.name} added — email service not configured, share the sign-in link manually.`,
          { icon: "ℹ️", duration: 6000 }
        );
      } else {
        toast.success(`${payload.name} added (email delivery failed — try Resend later)`);
      }
      try { formEl?.reset(); } catch { /* form may have unmounted already */ }
      setInviteRole("salesman");
      setInviteSections([...DEFAULT_PERMS.sections]);
      setInviteLocationView(DEFAULT_PERMS.locationView);
      setShowInvite(false);
      await team.refresh();
      await loadLeaderboard();
    } catch (err) {
      toast.error(err.message || "Invite failed");
    } finally {
      setInviting(false);
    }
  };

  const handleResend = async (m) => {
    if (!m?.id) return;
    setResendingId(m.id);
    try {
      await resendTeamInvite(team.actor, m.id);
      toast.success(`Invitation re-sent to ${m.name}`);
      await team.refresh();
    } catch (err) {
      toast.error(err.message || "Resend failed");
    } finally {
      setResendingId(null);
    }
  };

  const startEdit = (m) => {
    const perms = permsOf(m);
    setEditingId(m.id);
    setDraft({
      name: m.name || "",
      commissionPct: m.commission_pct ?? "",
      quotaMonthly: m.quota_monthly ?? "",
      role: m.role === "rep" ? "salesman" : m.role || "salesman",
      sections: perms.sections,
      locationView: perms.locationView,
    });
  };

  const saveEdit = async (m) => {
    // The owner row stays admin — never reassign its role or permissions.
    const editingRole = m.role === "owner" ? "owner" : draft.role;
    try {
      const patch = {
        name: draft.name || m.name,
        commissionPct: Number(draft.commissionPct) || 0,
        quotaMonthly: Number(draft.quotaMonthly) || 0,
      };
      if (m.role !== "owner") {
        patch.role = editingRole;
        patch.permissions = { sections: draft.sections, locationView: draft.locationView };
      }
      await updateTeamMember(team.actor, m.id, patch);
      toast.success("Saved");
      setEditingId(null);
      await team.refresh();
      await loadLeaderboard();
    } catch (err) {
      toast.error(err.message || "Save failed");
    }
  };

  const removeMember = async (m) => {
    if (m.role === "owner") return;
    if (!window.confirm(`Remove ${m.name} from the team?`)) return;
    try {
      await removeTeamMember(team.actor, m.id);
      toast.success(`${m.name} removed`);
      await team.refresh();
      await loadLeaderboard();
    } catch (err) {
      toast.error(err.message || "Remove failed");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-6">
      <header className="mb-5 sm:mb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-stone-800 leading-tight">
              Team &amp; Sales Reps
            </h1>
            <p className="text-stone-500 text-xs sm:text-sm mt-1">
              Invite team members and choose exactly what each one sees — which sections they can open
              and how much stone-location detail (full, memo&nbsp;+&nbsp;branch, or branch only).
            </p>
          </div>
          <div className="hidden sm:block text-right text-xs text-stone-500 shrink-0">
            <div className="text-2xl font-bold text-stone-800">{(team.members || []).length}</div>
            <div>of {cap} seats used</div>
          </div>
        </div>
        <div className="sm:hidden mt-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-700 ring-1 ring-stone-200">
            <span className="text-stone-900 font-bold">{(team.members || []).length}</span>
            <span className="text-stone-500">/ {cap} seats used</span>
          </span>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5 sm:mb-6">
        <StatCard
          label="Active reps"
          value={reps.filter((m) => m.active).length}
          accent="emerald"
        />
        <StatCard
          label="Pending"
          fullLabel="Pending sign-in"
          value={reps.filter((m) => !m.clerk_user_id).length}
          accent="amber"
        />
        <StatCard
          label="Seats left"
          fullLabel="Seats remaining"
          value={remaining}
          accent="sky"
        />
      </div>

      <section className="mb-5 sm:mb-6">
        {!showInvite ? (
          <button
            onClick={() => setShowInvite(true)}
            disabled={remaining <= 0}
            className={`inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg px-4 py-2.5 sm:py-2 text-sm font-medium shadow-sm transition ${
              remaining <= 0
                ? "bg-stone-100 text-stone-400 cursor-not-allowed"
                : "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Invite a sales rep
          </button>
        ) : (
          <form
            onSubmit={handleInvite}
            className="rounded-xl glass-surface p-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Full name" required>
                <input name="name" required placeholder="Liora Cohen"
                  autoComplete="off"
                  className="input-base" />
              </Field>
              <Field label="Email" required>
                <input name="email" type="email" required placeholder="liora@example.com"
                  autoComplete="off"
                  className="input-base" />
              </Field>
              <Field label="Role" required>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="input-base"
                >
                  <option value="salesman">Salesman</option>
                  <option value="manager">Manager</option>
                </select>
              </Field>
              <Field label="Commission %">
                <input name="commissionPct" type="number" inputMode="decimal" step="0.5" min="0" max="100" placeholder="10"
                  className="input-base" />
              </Field>
              <Field label="Monthly quota (USD)">
                <input name="quotaMonthly" type="number" inputMode="numeric" step="100" min="0" placeholder="20000"
                  className="input-base" />
              </Field>
            </div>
            <div className="mt-4 border-t border-stone-100 pt-4">
              <PermissionsEditor
                sections={inviteSections}
                locationView={inviteLocationView}
                onToggleSection={toggleInviteSection}
                onLocationView={setInviteLocationView}
              />
            </div>
            <p className="text-[11px] text-stone-500 mt-3 leading-relaxed">
              The member is linked automatically the first time they sign in with this email.
              Tick exactly which sections they can open and how much stone-location detail they see.
            </p>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-3">
              <button type="button" onClick={() => setShowInvite(false)}
                className="rounded-lg px-3 py-2 sm:py-1.5 text-sm text-stone-600 hover:bg-stone-50 border border-stone-200 sm:border-0">
                Cancel
              </button>
              <button
                type="submit" disabled={inviting}
                className={`rounded-lg px-3 py-2 sm:py-1.5 text-sm font-medium text-white shadow-sm transition ${
                  inviting ? "bg-emerald-400 cursor-wait" : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800"
                }`}
              >
                {inviting ? "Inviting…" : "Invite"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="md:hidden space-y-3">
        {[owner, ...reps].filter(Boolean).map((m) => {
          const lb = leaderboard.find((x) => x.memberId === m.id) || {};
          const isEditing = editingId === m.id;
          const isPending = !m.clerk_user_id && m.role !== "owner";
          const lastInviteIso = m.last_invited_at || m.invited_at;
          return (
            <div
              key={m.id}
              className="rounded-xl glass-surface p-4"
            >
              <div className="flex items-start gap-3">
                <MemberAvatar member={m} size="md" />
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <input
                      value={draft.name}
                      onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                      className="input-base"
                    />
                  ) : (
                    <div className="font-semibold text-stone-800 truncate">{m.name}</div>
                  )}
                  <div className="text-xs text-stone-500 truncate">{m.email}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <RoleBadge role={m.role} region={m.region} />
                    {isPending && <PendingBadge />}
                  </div>
                  {isPending && lastInviteIso && (
                    <div className="mt-1 text-[10px] text-stone-400 leading-tight">
                      Invited {timeAgo(lastInviteIso)}
                      {m.invite_count > 1 && ` · ${m.invite_count}x sent`}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 mt-3 pt-3 border-t border-stone-100">
                {isEditing && m.role !== "owner" && (
                  <MobileStat label="Role">
                    <select
                      value={draft.role}
                      onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
                      className="input-base"
                    >
                      <option value="salesman">Salesman</option>
                      <option value="manager">Manager</option>
                    </select>
                  </MobileStat>
                )}
                <MobileStat label="Commission">
                  {isEditing ? (
                    <input
                      type="number" step="0.5" min="0" max="100"
                      value={draft.commissionPct}
                      onChange={(e) => setDraft((d) => ({ ...d, commissionPct: e.target.value }))}
                      className="input-base"
                    />
                  ) : (
                    <span className="text-stone-800 font-medium text-sm">
                      {Number(m.commission_pct || 0)}%
                    </span>
                  )}
                </MobileStat>
                <MobileStat label="Quota / mo">
                  {isEditing ? (
                    <input
                      type="number" step="100" min="0"
                      value={draft.quotaMonthly}
                      onChange={(e) => setDraft((d) => ({ ...d, quotaMonthly: e.target.value }))}
                      className="input-base"
                    />
                  ) : (
                    <span className="text-stone-800 font-medium text-sm">
                      {fmtMoney(m.quota_monthly)}
                    </span>
                  )}
                </MobileStat>
                <MobileStat label="Won (MTD)">
                  <div className="text-stone-800 font-medium text-sm">
                    {fmtMoney(lb.revenueMtd)}
                  </div>
                  <div className="text-[10px] text-stone-500 leading-tight">
                    {lb.wonDealsMtd || 0} deal{lb.wonDealsMtd === 1 ? "" : "s"}
                    {lb.quotaPct != null && ` · ${lb.quotaPct}% quota`}
                  </div>
                </MobileStat>
                <MobileStat label="Pipeline">
                  <div className="text-stone-800 font-medium text-sm">
                    {lb.assignedContacts || 0} contacts
                  </div>
                  <div className="text-[10px] text-stone-500 leading-tight">
                    {lb.jewelryInProgress || 0} jewelry · {lb.stonesInProgress || 0} stones
                  </div>
                </MobileStat>
              </div>

              {isEditing && m.role !== "owner" && (
                <div className="mt-3 pt-3 border-t border-stone-100">
                  <PermissionsEditor
                    sections={draft.sections}
                    locationView={draft.locationView}
                    onToggleSection={toggleDraftSection}
                    onLocationView={(v) => setDraft((d) => ({ ...d, locationView: v }))}
                  />
                </div>
              )}
              {!isEditing && m.role !== "owner" && (
                <div className="mt-2 text-[11px] text-stone-500">
                  {permsOf(m).sections.length} section{permsOf(m).sections.length === 1 ? "" : "s"} ·{" "}
                  {LOCATION_VIEW_LABEL[permsOf(m).locationView]}
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-stone-100">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => saveEdit(m)}
                      className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 active:bg-emerald-800"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-xs text-stone-600 hover:bg-stone-50"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    {isPending && (
                      <button
                        onClick={() => handleResend(m)}
                        disabled={resendingId === m.id}
                        className={`flex-1 basis-full rounded-lg px-3 py-2 text-xs font-medium transition ${
                          resendingId === m.id
                            ? "bg-emerald-50 text-emerald-400 cursor-wait ring-1 ring-emerald-100"
                            : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 active:bg-emerald-200"
                        }`}
                      >
                        {resendingId === m.id ? "Sending…" : "Resend invitation email"}
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(m)}
                      className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 active:bg-stone-100"
                    >
                      Edit
                    </button>
                    {m.role !== "owner" && (
                      <button
                        onClick={() => removeMember(m)}
                        className="flex-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 active:bg-rose-100"
                      >
                        Remove
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
        {reps.length === 0 && (
          <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/50 px-4 py-10 text-center">
            <div className="inline-flex w-12 h-12 items-center justify-center rounded-full bg-white ring-1 ring-stone-200 mb-3">
              <svg className="w-6 h-6 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-3a4 4 0 11-8 0 4 4 0 018 0zm6 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div className="text-sm font-medium text-stone-700">No reps invited yet</div>
            <div className="text-xs text-stone-500 mt-1">
              Tap <span className="font-medium">Invite a sales rep</span> above to add your first team member.
            </div>
          </div>
        )}
      </section>

      <section className="hidden md:block rounded-xl glass-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-stone-200">
            <thead className="bg-stone-50">
              <tr className="text-[11px] uppercase tracking-wider text-stone-500">
                <th className="px-4 py-2 text-left font-medium">Member</th>
                <th className="px-3 py-2 text-left font-medium">Role</th>
                <th className="px-3 py-2 text-left font-medium">Commission</th>
                <th className="px-3 py-2 text-left font-medium">Quota</th>
                <th className="px-3 py-2 text-left font-medium">Won (MTD)</th>
                <th className="px-3 py-2 text-left font-medium">Pipeline</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-sm">
              {[owner, ...reps].filter(Boolean).map((m) => {
                const lb = leaderboard.find((x) => x.memberId === m.id) || {};
                const isEditing = editingId === m.id;
                const isPending = !m.clerk_user_id && m.role !== "owner";
                const lastInviteIso = m.last_invited_at || m.invited_at;
                return (
                  <tr key={m.id} className="hover:bg-stone-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <MemberAvatar member={m} size="md" />
                        <div className="min-w-0">
                          {isEditing ? (
                            <input
                              value={draft.name}
                              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                              className="input-base w-44"
                            />
                          ) : (
                            <div className="font-semibold text-stone-800 truncate">{m.name}</div>
                          )}
                          <div className="text-xs text-stone-500 truncate">{m.email}</div>
                          {isPending && (
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <PendingBadge />
                              {lastInviteIso && (
                                <span className="text-[10px] text-stone-400">
                                  · Invited {timeAgo(lastInviteIso)}
                                  {m.invite_count > 1 && ` · ${m.invite_count}x`}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      {isEditing && m.role !== "owner" ? (
                        <div className="flex flex-col gap-2 min-w-[240px]">
                          <select
                            value={draft.role}
                            onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
                            className="input-base w-40"
                          >
                            <option value="salesman">Salesman</option>
                            <option value="manager">Manager</option>
                          </select>
                          <PermissionsEditor
                            sections={draft.sections}
                            locationView={draft.locationView}
                            onToggleSection={toggleDraftSection}
                            onLocationView={(v) => setDraft((d) => ({ ...d, locationView: v }))}
                          />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <RoleBadge role={m.role} />
                          {m.role !== "owner" && (
                            <div className="text-[10.5px] text-stone-500">
                              {permsOf(m).sections.length} sec · {LOCATION_VIEW_LABEL[permsOf(m).locationView]}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {isEditing ? (
                        <input
                          type="number" step="0.5" min="0" max="100"
                          value={draft.commissionPct}
                          onChange={(e) => setDraft((d) => ({ ...d, commissionPct: e.target.value }))}
                          className="input-base w-20"
                        />
                      ) : (
                        <span className="text-stone-700">{Number(m.commission_pct || 0)}%</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {isEditing ? (
                        <input
                          type="number" step="100" min="0"
                          value={draft.quotaMonthly}
                          onChange={(e) => setDraft((d) => ({ ...d, quotaMonthly: e.target.value }))}
                          className="input-base w-28"
                        />
                      ) : (
                        <span className="text-stone-700">{fmtMoney(m.quota_monthly)}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-stone-800 font-medium">
                        {fmtMoney(lb.revenueMtd)}
                      </div>
                      <div className="text-[11px] text-stone-500">
                        {lb.wonDealsMtd || 0} deal{lb.wonDealsMtd === 1 ? "" : "s"}
                        {lb.quotaPct != null && ` · ${lb.quotaPct}% of quota`}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-stone-700">
                        {lb.assignedContacts || 0} contacts
                      </div>
                      <div className="text-[11px] text-stone-500">
                        {lb.jewelryInProgress || 0} jewelry · {lb.stonesInProgress || 0} stones
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(m)}
                            className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="ml-2 rounded-md border border-stone-200 px-2.5 py-1 text-xs text-stone-600 hover:bg-stone-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          {isPending && (
                            <button
                              onClick={() => handleResend(m)}
                              disabled={resendingId === m.id}
                              title="Resend invitation email"
                              className={`mr-2 rounded-md px-2.5 py-1 text-xs font-medium ring-1 transition ${
                                resendingId === m.id
                                  ? "bg-emerald-50 text-emerald-400 ring-emerald-100 cursor-wait"
                                  : "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100"
                              }`}
                            >
                              {resendingId === m.id ? "Sending…" : "Resend"}
                            </button>
                          )}
                          <button
                            onClick={() => startEdit(m)}
                            className="rounded-md border border-stone-200 px-2.5 py-1 text-xs text-stone-600 hover:bg-stone-50"
                          >
                            Edit
                          </button>
                          {m.role !== "owner" && (
                            <button
                              onClick={() => removeMember(m)}
                              className="ml-2 rounded-md border border-rose-200 px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-50"
                            >
                              Remove
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {reps.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-stone-500 text-sm">
                    No reps invited yet. Click <span className="font-medium">Invite a sales rep</span> above to add your first team member.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[11px] text-stone-400 mt-4 leading-relaxed">
        Tip: every new rep gets an invitation email automatically. Once they sign in with that email
        they're linked to your team. Until then their row shows <span className="font-medium">Pending sign-in</span> —
        use <span className="font-medium">Resend</span> if their first email got lost.
      </p>

      <style>{`
        .input-base {
          border: 1px solid #e7e5e4;
          background: white;
          border-radius: 8px;
          padding: 0.4rem 0.6rem;
          font-size: 0.875rem;
          width: 100%;
        }
        .input-base:focus {
          outline: 2px solid #10b98155;
          border-color: #10b981;
        }
      `}</style>
    </div>
  );
};

const Field = ({ label, required, children }) => (
  <label className="block">
    <span className="block text-[11px] uppercase tracking-wider font-medium text-stone-500 mb-1">
      {label}{required && <span className="text-rose-500"> *</span>}
    </span>
    {children}
  </label>
);

const StatCard = ({ label, fullLabel, value, accent = "emerald" }) => {
  const tints = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber:   "bg-amber-50 text-amber-700 ring-amber-200",
    sky:     "bg-sky-50 text-sky-700 ring-sky-200",
  };
  return (
    <div className={`rounded-xl ring-1 ${tints[accent]} p-3 sm:p-4`}>
      <div className="text-xl sm:text-2xl font-bold leading-none">{value}</div>
      <div className="text-[10px] sm:text-xs uppercase tracking-wider mt-1 opacity-80 leading-tight">
        <span className="sm:hidden">{label}</span>
        <span className="hidden sm:inline">{fullLabel || label}</span>
      </div>
    </div>
  );
};

const MobileStat = ({ label, children }) => (
  <div className="min-w-0">
    <div className="text-[10px] uppercase tracking-wider font-medium text-stone-500 mb-0.5">
      {label}
    </div>
    {children}
  </div>
);

export default TeamSettings;
