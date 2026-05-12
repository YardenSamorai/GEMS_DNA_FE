import React, { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { useTeam } from "../../context/TeamContext";
import {
  inviteTeamMember,
  updateTeamMember,
  removeTeamMember,
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

const RoleBadge = ({ role }) => (
  <span
    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
      role === "owner"
        ? "bg-amber-100 text-amber-700 ring-1 ring-amber-200"
        : "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
    }`}
  >
    {role === "owner" ? "Admin" : "Sales rep"}
  </span>
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
  const [draft, setDraft] = useState({ name: "", commissionPct: "", quotaMonthly: "" });

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
    const fd = new FormData(e.currentTarget);
    const payload = {
      email: String(fd.get("email") || "").trim().toLowerCase(),
      name: String(fd.get("name") || "").trim(),
      role: "rep",
      commissionPct: Number(fd.get("commissionPct") || 0),
      quotaMonthly: Number(fd.get("quotaMonthly") || 0),
    };
    if (!payload.email || !payload.name) {
      toast.error("Email and name are required");
      return;
    }
    setInviting(true);
    try {
      await inviteTeamMember(team.actor, payload);
      toast.success(`Invited ${payload.name}`);
      e.currentTarget.reset();
      setShowInvite(false);
      await team.refresh();
      await loadLeaderboard();
    } catch (err) {
      toast.error(err.message || "Invite failed");
    } finally {
      setInviting(false);
    }
  };

  const startEdit = (m) => {
    setEditingId(m.id);
    setDraft({
      name: m.name || "",
      commissionPct: m.commission_pct ?? "",
      quotaMonthly: m.quota_monthly ?? "",
    });
  };

  const saveEdit = async (m) => {
    try {
      await updateTeamMember(team.actor, m.id, {
        name: draft.name || m.name,
        commissionPct: Number(draft.commissionPct) || 0,
        quotaMonthly: Number(draft.quotaMonthly) || 0,
      });
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
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <header className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Team & Sales Reps</h1>
          <p className="text-stone-500 text-sm mt-0.5">
            Invite up to 10 reps. Each rep sees only the contacts, deals, and jewelry items they're assigned to.
          </p>
        </div>
        <div className="text-right text-xs text-stone-500">
          <div className="text-2xl font-bold text-stone-800">{(team.members || []).length}</div>
          <div>of {cap} seats used</div>
        </div>
      </header>

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <StatCard
          label="Active reps"
          value={reps.filter((m) => m.active).length}
          accent="emerald"
        />
        <StatCard
          label="Pending sign-in"
          value={reps.filter((m) => !m.clerk_user_id).length}
          accent="amber"
        />
        <StatCard
          label="Seats remaining"
          value={remaining}
          accent="sky"
        />
      </div>

      <section className="mb-6">
        {!showInvite ? (
          <button
            onClick={() => setShowInvite(true)}
            disabled={remaining <= 0}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium shadow-sm transition ${
              remaining <= 0
                ? "bg-stone-100 text-stone-400 cursor-not-allowed"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
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
            className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
          >
            <div className="grid md:grid-cols-4 gap-3">
              <Field label="Full name" required>
                <input name="name" required placeholder="Liora Cohen"
                  className="input-base" />
              </Field>
              <Field label="Email" required>
                <input name="email" type="email" required placeholder="liora@example.com"
                  className="input-base" />
              </Field>
              <Field label="Commission %">
                <input name="commissionPct" type="number" step="0.5" min="0" max="100" placeholder="10"
                  className="input-base" />
              </Field>
              <Field label="Monthly quota (USD)">
                <input name="quotaMonthly" type="number" step="100" min="0" placeholder="20000"
                  className="input-base" />
              </Field>
            </div>
            <p className="text-[11px] text-stone-500 mt-2">
              The rep will be linked automatically the first time they sign in with this email.
            </p>
            <div className="flex justify-end gap-2 mt-3">
              <button type="button" onClick={() => setShowInvite(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50">
                Cancel
              </button>
              <button
                type="submit" disabled={inviting}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white shadow-sm transition ${
                  inviting ? "bg-emerald-400 cursor-wait" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {inviting ? "Inviting…" : "Invite"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
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
                        {!m.clerk_user_id && m.role !== "owner" && <PendingBadge />}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3"><RoleBadge role={m.role} /></td>
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
                      {lb.jewelryInProgress || 0} jewelry in progress
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
      </section>

      <p className="text-[11px] text-stone-400 mt-4">
        Tip: when a rep signs in for the first time with the email you invited, they're linked automatically.
        Until then, their row shows <span className="font-medium">Pending sign-in</span>.
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

const StatCard = ({ label, value, accent = "emerald" }) => {
  const tints = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber:   "bg-amber-50 text-amber-700 ring-amber-200",
    sky:     "bg-sky-50 text-sky-700 ring-sky-200",
  };
  return (
    <div className={`rounded-xl ring-1 ${tints[accent]} p-4`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs uppercase tracking-wider mt-1 opacity-80">{label}</div>
    </div>
  );
};

export default TeamSettings;
