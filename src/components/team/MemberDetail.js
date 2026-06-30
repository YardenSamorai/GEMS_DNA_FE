import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import MemberAvatar from "./MemberAvatar";
import PermissionsEditor from "./PermissionsEditor";
import { updateTeamMember, removeTeamMember, resendTeamInvite } from "../../services/teamApi";
import { fetchRepActivity } from "../../services/activityApi";
import {
  ACTIVITY_META,
  ASSIGNABLE_ROLES,
  LOCATION_VIEW_LABEL,
  cleanEmail,
  eventLink,
  eventSummary,
  fmtMoney,
  isAdminRole,
  permsOf,
  presetForRole,
  relTime,
  roleLabelFor,
  timeAgo,
} from "./teamUtils";

const FEED_PAGE = 50;

const RoleBadge = ({ role }) => {
  const tint = isAdminRole(role)
    ? "bg-amber-100 text-amber-700 ring-amber-200"
    : role === "manager"
    ? "bg-sky-100 text-sky-700 ring-sky-200"
    : role === "sales_agent"
    ? "bg-violet-100 text-violet-700 ring-violet-200"
    : "bg-emerald-100 text-emerald-700 ring-emerald-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${tint}`}>
      {roleLabelFor(role)}
    </span>
  );
};

const PresenceDot = ({ online }) => (
  <span
    className={`relative inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${online ? "bg-emerald-500" : "bg-stone-300"}`}
    title={online ? "Online now" : "Offline"}
  >
    {online && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75" />}
  </span>
);

const Kpi = ({ label, value, sub, accent = "stone" }) => {
  const tint = {
    emerald: "text-emerald-700",
    sky: "text-sky-700",
    violet: "text-violet-700",
    amber: "text-amber-700",
    stone: "text-stone-800",
  }[accent];
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-3 py-2.5">
      <div className={`text-lg font-bold leading-none tabular-nums ${tint}`}>{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-stone-500 leading-tight">{label}</div>
      {sub && <div className="text-[10.5px] text-stone-400 leading-tight mt-0.5">{sub}</div>}
    </div>
  );
};

const QuotaBar = ({ pct }) => {
  const v = Math.max(0, Math.min(100, Number(pct) || 0));
  const tone = v >= 100 ? "bg-emerald-500" : v >= 60 ? "bg-sky-500" : v >= 30 ? "bg-amber-500" : "bg-rose-400";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
      <div className={`h-full rounded-full ${tone} transition-all`} style={{ width: `${v}%` }} />
    </div>
  );
};

const ActivityRow = ({ ev }) => {
  const meta = ACTIVITY_META[ev.type] || { label: ev.type, chip: "bg-stone-100 text-stone-600" };
  const summary = eventSummary(ev);
  const to = eventLink(ev);
  const inner = (
    <>
      <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10.5px] font-semibold ${meta.chip}`}>{meta.label}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-stone-700">
          {summary || <span className="text-stone-400">—</span>}
        </p>
      </div>
      <span className="shrink-0 text-[11.5px] tabular-nums text-stone-400">{relTime(ev.created_at)}</span>
    </>
  );
  const cls = "flex items-center gap-2.5 rounded-xl border border-stone-200 bg-white px-3 py-2.5 transition hover:bg-stone-50";
  return to ? <Link to={to} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
};

/**
 * MemberDetail — the per-member management surface.
 *
 *   • Header: avatar, name/email, role, presence + invite status, quick actions.
 *   • Overview tab: KPI grid (revenue / deals / quota / pipeline) + quota bar +
 *     7-day usage + 30-day activity breakdown.
 *   • Activity tab: the rep's full keyset-paginated history.
 *   • Access tab: editable name, role, commission, quota, visible sections and
 *     stone-location visibility.
 */
const MemberDetail = ({ actor, member, kpis = {}, presence = {}, onChanged, onClose }) => {
  const isOwner = member.role === "owner";
  const isPending = !member.clerk_user_id && !isOwner;
  const online = !!presence.online;
  const lastSeen = presence.last_seen || member.last_seen;

  const [tab, setTab] = useState("overview");
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);
  const [removing, setRemoving] = useState(false);

  const initialDraft = useCallback(() => {
    const p = permsOf(member);
    return {
      name: member.name || "",
      role: member.role === "rep" ? "salesman" : member.role || "salesman",
      commissionPct: member.commission_pct ?? "",
      quotaMonthly: member.quota_monthly ?? "",
      sections: p.sections,
      locationView: p.locationView,
      canViewCost: p.canViewCost,
    };
  }, [member]);
  const [draft, setDraft] = useState(initialDraft);
  useEffect(() => { setDraft(initialDraft()); setTab("overview"); }, [member.id, initialDraft]);

  // Per-rep activity history (only meaningful once they've signed in).
  const [events, setEvents] = useState([]);
  const [breakdown, setBreakdown] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!member.clerk_user_id) {
      setEvents([]); setBreakdown([]); setCursor(null);
      return;
    }
    let alive = true;
    (async () => {
      try {
        setLoadingFeed(true);
        const res = await fetchRepActivity(actor, member.clerk_user_id, { limit: FEED_PAGE });
        if (!alive) return;
        setBreakdown(res.breakdown || []);
        setEvents(res.events || []);
        setCursor(res.nextCursor || null);
      } catch (_) {
        if (alive) { setEvents([]); setBreakdown([]); setCursor(null); }
      } finally {
        if (alive) setLoadingFeed(false);
      }
    })();
    return () => { alive = false; };
  }, [actor, member.clerk_user_id]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchRepActivity(actor, member.clerk_user_id, { limit: FEED_PAGE, before: cursor });
      setEvents((prev) => [...prev, ...(res.events || [])]);
      setCursor(res.nextCursor || null);
    } catch (_) { /* keep what we have */ } finally {
      setLoadingMore(false);
    }
  };

  const toggleSection = (key) =>
    setDraft((d) => ({
      ...d,
      sections: d.sections.includes(key) ? d.sections.filter((k) => k !== key) : [...d.sections, key],
    }));

  // Changing the role re-seeds that role's default permissions; the admin can
  // then fine-tune them before saving. Admin keeps whatever (it gets full
  // access regardless), so we only swap the role there.
  const changeRole = (next) =>
    setDraft((d) => {
      if (next === "admin") return { ...d, role: next };
      const preset = presetForRole(next);
      return {
        ...d,
        role: next,
        sections: preset.sections,
        locationView: preset.locationView,
        canViewCost: preset.canViewCost,
      };
    });

  const save = async () => {
    setSaving(true);
    try {
      const patch = {
        name: draft.name || member.name,
        commissionPct: Number(draft.commissionPct) || 0,
        quotaMonthly: Number(draft.quotaMonthly) || 0,
      };
      if (!isOwner) {
        patch.role = draft.role;
        patch.permissions = {
          sections: draft.sections,
          locationView: draft.locationView,
          canViewCost: !!draft.canViewCost,
        };
      }
      await updateTeamMember(actor, member.id, patch);
      toast.success("Saved");
      onChanged?.();
    } catch (err) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      await resendTeamInvite(actor, member.id);
      toast.success(`Invitation re-sent to ${member.name}`);
      onChanged?.();
    } catch (err) {
      toast.error(err.message || "Resend failed");
    } finally {
      setResending(false);
    }
  };

  const remove = async () => {
    if (isOwner) return;
    if (!window.confirm(`Remove ${member.name} from the team?`)) return;
    setRemoving(true);
    try {
      await removeTeamMember(actor, member.id);
      toast.success(`${member.name} removed`);
      onChanged?.();
      onClose?.();
    } catch (err) {
      toast.error(err.message || "Remove failed");
      setRemoving(false);
    }
  };

  const sevenDay = [
    ["Sessions", presence.sessions_7d],
    ["Views", presence.stone_views_7d],
    ["Shares", presence.shares_7d],
    ["Events", presence.events_7d],
  ];

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "activity", label: "Activity" },
    { id: "access", label: "Access & profile" },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-stone-100 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <MemberAvatar member={member} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-bold text-stone-800">{member.name}</h2>
              <RoleBadge role={member.role} />
            </div>
            {cleanEmail(member)
              ? <div className="truncate text-sm text-stone-500">{cleanEmail(member)}</div>
              : isOwner && <div className="truncate text-sm text-stone-500">Workshop owner · full access</div>}
            <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-stone-500">
              {!isOwner && <PresenceDot online={online} />}
              <span>
                {isPending
                  ? `Pending sign-in${member.last_invited_at || member.invited_at ? ` · invited ${timeAgo(member.last_invited_at || member.invited_at)}` : ""}`
                  : online
                  ? "Online now"
                  : lastSeen
                  ? `Last seen ${timeAgo(lastSeen)}`
                  : isOwner ? "Workshop owner" : "Never signed in"}
              </span>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden -m-1.5 rounded-full p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Quick actions */}
        <div className="mt-3 flex flex-wrap gap-2">
          {isPending && (
            <button
              type="button"
              onClick={resend}
              disabled={resending}
              className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100 disabled:opacity-60"
            >
              {resending ? "Sending…" : "Resend invite"}
            </button>
          )}
          {!isOwner && (
            <button
              type="button"
              onClick={remove}
              disabled={removing}
              className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
            >
              {removing ? "Removing…" : "Remove member"}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-stone-100 px-3 pt-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`relative rounded-t-lg px-3 py-2 text-[13px] font-medium transition ${
              tab === t.id ? "text-stone-900" : "text-stone-400 hover:text-stone-600"
            }`}
          >
            {t.label}
            {tab === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-emerald-500" />}
          </button>
        ))}
      </div>

      {/* Body — extra bottom padding on phones so the Save/Reset row clears the
          fixed mobile dock (≈74px + safe area). Restored to normal at md+. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-28 sm:px-5 sm:pt-5 md:pb-6">
        {tab === "overview" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Kpi label="Revenue MTD" accent="emerald" value={fmtMoney(kpis.revenueMtd)} sub={`${kpis.wonDealsMtd || 0} won`} />
              <Kpi label="Quota" accent="sky" value={kpis.quotaPct != null ? `${kpis.quotaPct}%` : "—"} sub={fmtMoney(member.quota_monthly)} />
              <Kpi label="Commission" accent="violet" value={`${Number(member.commission_pct || 0)}%`} />
              <Kpi label="Contacts" value={kpis.assignedContacts || 0} sub="assigned" />
              <Kpi label="Jewelry" accent="amber" value={kpis.jewelryInProgress || 0} sub="in progress" />
              <Kpi label="Stones" value={kpis.stonesInProgress || 0} sub="in progress" />
            </div>

            {kpis.quotaPct != null && (
              <div>
                <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wider text-stone-500">
                  <span>Quota attainment</span>
                  <span className="tabular-nums">{kpis.quotaPct}%</span>
                </div>
                <QuotaBar pct={kpis.quotaPct} />
              </div>
            )}

            {!isPending && (
              <div>
                <div className="mb-1.5 text-[11px] uppercase tracking-wider text-stone-500">Last 7 days</div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {sevenDay.map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-stone-50 px-1 py-2 ring-1 ring-stone-100">
                      <div className="text-base font-semibold leading-none tabular-nums text-stone-800">
                        {Number(value || 0).toLocaleString()}
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-wide text-stone-400">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {breakdown.length > 0 && (
              <div>
                <div className="mb-1.5 text-[11px] uppercase tracking-wider text-stone-500">Last 30 days</div>
                <div className="flex flex-wrap gap-2">
                  {breakdown.slice().sort((a, b) => b.count - a.count).map((b) => {
                    const m = ACTIVITY_META[b.type] || { label: b.type, chip: "bg-stone-100 text-stone-600" };
                    return (
                      <span key={b.type} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold ${m.chip}`}>
                        {m.label}
                        <span className="tabular-nums opacity-80">{b.count}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {!isOwner && (
              <div className="rounded-xl bg-stone-50 p-3 ring-1 ring-stone-100">
                <div className="text-[11px] uppercase tracking-wider text-stone-500">Access</div>
                <div className="mt-1 text-[13px] text-stone-700">
                  {member.role === "admin" ? (
                    <span className="font-medium text-amber-700">Full access — all sections, cost &amp; margin</span>
                  ) : (
                    <>
                      {permsOf(member).sections.length} section{permsOf(member).sections.length === 1 ? "" : "s"} ·{" "}
                      {LOCATION_VIEW_LABEL[permsOf(member).locationView]}
                      {permsOf(member).canViewCost && " · Sees cost & margin"}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "activity" && (
          <div>
            {isPending ? (
              <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/50 p-8 text-center text-sm text-stone-500">
                No activity yet — this member hasn't signed in.
              </div>
            ) : loadingFeed ? (
              <div className="space-y-1.5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-11 w-full rounded-xl bg-stone-100 animate-pulse" />
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/50 p-8 text-center text-sm text-stone-500">
                No activity recorded yet.
              </div>
            ) : (
              <>
                <ul className="space-y-1.5">
                  <AnimatePresence initial={false}>
                    {events.map((ev) => (
                      <motion.li
                        key={ev.id}
                        layout
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 480, damping: 34 }}
                      >
                        <ActivityRow ev={ev} />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
                {cursor && (
                  <div className="mt-3 flex justify-center">
                    <button
                      type="button"
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-[13px] font-semibold text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
                    >
                      {loadingMore ? "Loading…" : "Load more"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === "access" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[11px] uppercase tracking-wider font-medium text-stone-500">Full name</span>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  className="team-input"
                />
              </label>
              {!isOwner && (
                <label className="block">
                  <span className="mb-1 block text-[11px] uppercase tracking-wider font-medium text-stone-500">Role</span>
                  <select
                    value={draft.role}
                    onChange={(e) => changeRole(e.target.value)}
                    className="team-input"
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block">
                <span className="mb-1 block text-[11px] uppercase tracking-wider font-medium text-stone-500">Commission %</span>
                <input
                  type="number" step="0.5" min="0" max="100"
                  value={draft.commissionPct}
                  onChange={(e) => setDraft((d) => ({ ...d, commissionPct: e.target.value }))}
                  className="team-input"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] uppercase tracking-wider font-medium text-stone-500">Monthly quota (USD)</span>
                <input
                  type="number" step="100" min="0"
                  value={draft.quotaMonthly}
                  onChange={(e) => setDraft((d) => ({ ...d, quotaMonthly: e.target.value }))}
                  className="team-input"
                />
              </label>
            </div>

            {isOwner ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-700 ring-1 ring-amber-100">
                The workshop owner always has full access — role and permissions can't be changed.
              </p>
            ) : draft.role === "admin" ? (
              <div className="border-t border-stone-100 pt-4">
                <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 px-3 py-2.5 ring-1 ring-amber-100">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-[12.5px] text-amber-800 leading-snug">
                    <span className="font-semibold">Admins have full access</span> — every section, full stone-location
                    detail, internal cost &amp; margin, and the ability to manage the team. Individual permissions don't
                    apply. Switch the role back to Manager or Salesman to fine-tune access.
                  </p>
                </div>
              </div>
            ) : (
              <div className="border-t border-stone-100 pt-4">
                <PermissionsEditor
                  sections={draft.sections}
                  locationView={draft.locationView}
                  canViewCost={draft.canViewCost}
                  onToggleSection={toggleSection}
                  onLocationView={(v) => setDraft((d) => ({ ...d, locationView: v }))}
                  onToggleCost={(v) => setDraft((d) => ({ ...d, canViewCost: v }))}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
              <button
                type="button"
                onClick={() => setDraft(initialDraft())}
                className="rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-600 transition hover:bg-stone-50"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition ${
                  saving ? "bg-emerald-400 cursor-wait" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberDetail;
