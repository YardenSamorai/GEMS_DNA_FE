import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import {
  fetchCompany,
  updateCompany,
  deleteCompany,
  COMPANY_TYPES,
  PAYMENT_TERMS,
  CURRENCIES,
  WEEKDAYS,
} from "../../services/companiesApi";
import { fetchMemos, MEMO_STATUSES, isMemoEffectivelyExpired } from "../../services/memosApi";
import { fetchTeamMembers, inviteTeamMember, removeTeamMember, resendTeamInvite } from "../../services/teamApi";
import {
  fetchOwnerMemoRequest,
  declineMemoRequest,
  convertMemoRequest,
} from "../../services/portalApi";
import { Skeleton, SkeletonCard } from "../../components/ui/Skeleton";
import MemoWizard from "./components/MemoWizard";

/**
 * StoreProfile — full-page Store profile.
 *
 * Replaces the old "edit store" modal with a proper profile UI inspired
 * by CustomerProfile: a hero with logo + cover, a KPI strip, and tabbed
 * content (Overview / Contacts / Memos / Activity). Edits are inline
 * per-section instead of a single giant form.
 */
export default function StoreProfile() {
  const { id } = useParams();
  const { user } = useUser();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [store, setStore] = useState(null);
  const [memos, setMemos] = useState([]);
  const [loading, setLoading] = useState(true);
  // Honour ?tab=requests so a click on the orange ribbon on the
  // CrmCompanies card lands directly on the requests view.
  const initialTab = searchParams.get("tab") || "overview";
  const [tab, setTab] = useState(initialTab);
  useEffect(() => {
    if (tab && tab !== "overview") {
      const next = new URLSearchParams(searchParams);
      next.set("tab", tab);
      setSearchParams(next, { replace: true });
    } else if (searchParams.get("tab")) {
      const next = new URLSearchParams(searchParams);
      next.delete("tab");
      setSearchParams(next, { replace: true });
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [tab]);
  const [createMemoOpen, setCreateMemoOpen] = useState(false);

  const reload = async () => {
    if (!user?.id || !id) return;
    setLoading(true);
    try {
      const [s, m] = await Promise.all([
        fetchCompany(user.id, id),
        fetchMemos(user.id, { companyId: id }),
      ]);
      setStore(s);
      setMemos(m);
    } catch (e) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [id, user?.id]);

  const memoRequests = useMemo(
    () => Array.isArray(store?.memo_requests) ? store.memo_requests : [],
    [store?.memo_requests]
  );
  const pendingRequestCount = useMemo(
    () => memoRequests.filter((r) => r.status === "pending").length,
    [memoRequests]
  );

  const kpis = useMemo(() => {
    if (!memos.length) return { active: 0, itemsOut: 0, totalValue: 0, lifetime: 0, soldValue: 0 };
    const active = memos.filter((m) => m.status === "out" || m.status === "partially_returned").length;
    const itemsOut = memos.reduce((a, m) => a + (m.items_out || 0), 0);
    const totalValue = memos
      .filter((m) => m.status !== "draft" && m.status !== "closed")
      .reduce((a, m) => a + Number(m.total_value || 0), 0);
    const lifetime = memos.length;
    return { active, itemsOut, totalValue, lifetime };
  }, [memos]);

  const handlePatch = async (patch) => {
    try {
      const updated = await updateCompany(user.id, id, patch);
      setStore((s) => ({ ...s, ...updated }));
      toast.success("Saved");
    } catch (e) { toast.error(e.message); }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${store.name}"? This cannot be undone.`)) return;
    try {
      await deleteCompany(user.id, id);
      toast.success("Store deleted");
      navigate("/crm/stores");
    } catch (e) { toast.error(e.message); }
  };

  if (loading || !store) {
    return (
      <div className="space-y-3 max-w-5xl mx-auto">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={6} />
      </div>
    );
  }

  const type = COMPANY_TYPES.find((t) => t.value === store.type) || COMPANY_TYPES[0];

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-5">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link to="/crm/stores" className="inline-flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to stores
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCreateMemoOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New memo
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-rose-600 text-xs font-semibold hover:bg-rose-50"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Hero card */}
      <Hero store={store} type={type} onPatch={handlePatch} onPortalChanged={reload} />

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Kpi
          label="Active memos"
          value={kpis.active}
          accent="text-blue-600"
          icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
        <Kpi
          label="Items out"
          value={kpis.itemsOut}
          accent="text-amber-600"
          icon="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4"
        />
        <Kpi
          label="Open value"
          value={`$${Number(kpis.totalValue).toLocaleString()}`}
          accent="text-emerald-600"
          icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <Kpi
          label="Lifetime memos"
          value={kpis.lifetime}
          accent="text-stone-700"
          icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-stone-200">
        <nav className="flex gap-1 overflow-x-auto">
          {[
            { id: "overview", label: "Overview" },
            { id: "requests", label: "Requests", count: pendingRequestCount, accent: pendingRequestCount > 0 },
            { id: "memos",    label: `Memos (${memos.length})` },
            { id: "contacts", label: `Contacts (${(store.contacts || []).length})` },
            { id: "settings", label: "Settings" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 transition flex items-center gap-1.5 ${
                tab === t.id
                  ? "border-stone-900 text-stone-900"
                  : "border-transparent text-stone-500 hover:text-stone-800"
              }`}
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                  t.accent
                    ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm"
                    : "bg-stone-200 text-stone-700"
                }`}>{t.count}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {tab === "overview" && <OverviewTab store={store} memos={memos} onPatch={handlePatch} />}
      {tab === "requests" && <RequestsTab requests={memoRequests} onChanged={reload} />}
      {tab === "memos"    && <MemosTab memos={memos} storeId={store.id} onCreate={() => setCreateMemoOpen(true)} />}
      {tab === "contacts" && <ContactsTab contacts={store.contacts || []} storeId={store.id} />}
      {tab === "settings" && <SettingsTab store={store} onPatch={handlePatch} />}

      {createMemoOpen && (
        <MemoWizard
          companies={[store]}
          preselectCompanyId={store.id}
          onClose={() => setCreateMemoOpen(false)}
          onCreated={(memo) => { setCreateMemoOpen(false); navigate(`/crm/memos/${memo.id}`); }}
        />
      )}
    </div>
  );
}

/* ─────────────── Hero header (logo + cover + identity) ─────────────── */

function Hero({ store, type, onPatch, onPortalChanged }) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(store.name);
  useEffect(() => setName(store.name), [store.name]);

  const initials = (store.name || "?").split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
  const cover = store.cover_image_url;

  return (
    <div className="relative bg-white border border-stone-200 rounded-2xl overflow-hidden">
      {/* Thin top accent — just enough to brand the card without
          stealing space from the identity row. If the owner uploaded
          a cover image we render that as a shorter banner instead. */}
      {cover ? (
        <div
          className="h-20 sm:h-24 w-full relative"
          style={{ backgroundImage: `url(${cover})`, backgroundSize: "cover", backgroundPosition: "center" }}
        >
          <div className="absolute top-3 right-3 z-10">
            <CoverEditButton store={store} onPatch={onPatch} />
          </div>
        </div>
      ) : (
        <div
          className="h-2 sm:h-2.5 w-full"
          style={{ backgroundImage: "linear-gradient(90deg, #2563eb 0%, #4f46e5 60%, #6366f1 100%)" }}
        />
      )}

      {/* Identity row — logo, name & chips side-by-side. No more
          "logo floats over the banner" trick: it sits cleanly on the
          white surface so the cover never blocks it. */}
      <div className="px-4 sm:px-6 pt-4 pb-4 sm:pb-5 flex items-start gap-3 sm:gap-4">
        {store.logo_url ? (
          <img
            src={store.logo_url}
            alt={store.name}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover bg-white ring-1 ring-stone-200 shrink-0"
          />
        ) : (
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xl sm:text-2xl shrink-0">
            {initials || "?"}
          </div>
        )}

        <div className="min-w-0 flex-1">
          {editingName ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => { setEditingName(false); if (name.trim() && name !== store.name) onPatch({ name: name.trim() }); else setName(store.name); }}
              onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") { setName(store.name); setEditingName(false); } }}
              className="text-xl sm:text-2xl font-bold text-stone-900 bg-stone-50 border-b-2 border-stone-300 focus:outline-none focus:border-stone-900 px-1 w-full"
            />
          ) : (
            <h1
              onClick={() => setEditingName(true)}
              title="Click to rename"
              className="text-xl sm:text-2xl font-bold text-stone-900 cursor-text hover:bg-stone-50 -mx-1 px-1 rounded inline-block max-w-full break-words leading-tight"
            >
              {store.name}
            </h1>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${type.color}`}>
              {type.label}
            </span>
            {(store.city || store.country) && (
              <span className="text-xs text-stone-500 inline-flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                {[store.city, store.country].filter(Boolean).join(", ")}
              </span>
            )}
            {store.established_year && (
              <span className="text-xs text-stone-500">est. {store.established_year}</span>
            )}
          </div>
          {store.description && (
            <p className="mt-2 text-sm text-stone-600 leading-relaxed">{store.description}</p>
          )}
        </div>

        {/* When there's no cover image, the "Cover" button still needs
            a home — tucked at the top-right of the identity row so the
            owner can add a cover image without an extra click. */}
        {!cover && (
          <div className="shrink-0">
            <CoverEditButton store={store} onPatch={onPatch} />
          </div>
        )}
      </div>

      {/* Portal access strip — sits at the bottom of the hero so it's
          impossible to miss. Renders one of three states:
          1. No portal user        → red CTA "Invite portal user".
          2. Pending invitation    → amber strip with name/email + Resend/Cancel.
          3. Active portal user    → green strip with "Revoke access". */}
      <PortalAccessStrip store={store} onPortalChanged={onPortalChanged} />
    </div>
  );
}

/* ─────────────── Portal access strip (Hero footer) ─────────────── */

function PortalAccessStrip({ store, onPortalChanged }) {
  const { user } = useUser();
  const [showInvite, setShowInvite] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(null);
  const [busy, setBusy] = useState(false);

  const portalUsers = Array.isArray(store.portal_users) ? store.portal_users : [];
  const activeUser  = portalUsers.find((u) => !u.pending) || null;
  const pendingUser = !activeUser ? portalUsers.find((u) => u.pending) : null;
  const primary     = activeUser || pendingUser;
  const hasAny      = portalUsers.length > 0;

  const handleRevoke = async () => {
    if (!confirmRevoke) return;
    setBusy(true);
    try {
      await removeTeamMember(
        { id: user.id, email: user.primaryEmailAddress?.emailAddress },
        confirmRevoke.id
      );
      toast.success(confirmRevoke.pending ? "Invitation cancelled" : "Portal access revoked");
      setConfirmRevoke(null);
      if (onPortalChanged) await onPortalChanged();
    } catch (e) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  const resend = async (m) => {
    setBusy(true);
    try {
      const r = await resendTeamInvite(
        { id: user.id, email: user.primaryEmailAddress?.emailAddress },
        m.id
      );
      const sent = r?.email?.sent === true;
      if (sent) toast.success(`Invitation re-sent to ${m.email}`);
      else if (r?.email?.skipped) toast(`Invitation row updated — email service is not configured.`, { icon: "i" });
      else toast.error(`Re-send failed: ${r?.email?.error || "unknown error"}`);
      if (onPortalChanged) await onPortalChanged();
    } catch (e) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  // No portal user yet — bold red strip + Invite CTA.
  if (!hasAny) {
    return (
      <>
        <div className="flex items-center justify-between gap-3 flex-wrap px-4 sm:px-6 py-3 bg-rose-50 border-t border-rose-200">
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="w-7 h-7 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </span>
            <div className="min-w-0">
              <div className="text-sm font-bold text-rose-800">No portal access</div>
              <div className="text-xs text-rose-700 mt-0.5">
                This store can't see its memos online yet. Invite someone to give them portal access.
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Invite portal user
          </button>
        </div>
        {showInvite && (
          <InvitePortalUserModal
            storeId={store.id}
            onClose={() => setShowInvite(false)}
            onInvited={async () => {
              setShowInvite(false);
              if (onPortalChanged) await onPortalChanged();
            }}
          />
        )}
      </>
    );
  }

  // Portal user(s) exist — green/amber strip with primary user + actions.
  const isPending     = !activeUser;
  const stripBg       = isPending ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200";
  const pillColor     = isPending ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-emerald-100 text-emerald-800 border-emerald-200";
  const pillLabel     = isPending ? "Invitation sent" : "Portal active";
  const dotColor      = isPending ? "bg-amber-500" : "bg-emerald-500";
  const subtitle      = isPending
    ? "Waiting for them to accept the email and sign in"
    : "Can sign in to the consignment portal right now";

  return (
    <>
      <div className={`flex items-center justify-between gap-3 flex-wrap px-4 sm:px-6 py-3 border-t ${stripBg}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm shrink-0 ring-2 ring-white"
            style={{ backgroundColor: primary?.avatar_color || "#0ea5e9" }}
          >
            {(primary?.name || "?").split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${pillColor}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${isPending ? "animate-pulse" : ""}`} />
                {pillLabel}
              </span>
              {portalUsers.length > 1 && (
                <span className="text-[10px] uppercase tracking-wider font-bold text-stone-500">
                  +{portalUsers.length - 1} more
                </span>
              )}
            </div>
            <div className="text-sm font-semibold text-stone-900 truncate mt-0.5">{primary?.name}</div>
            <div className="text-[11px] text-stone-500 truncate break-all">{primary?.email}</div>
            <div className="text-[11px] text-stone-400 mt-0.5 italic">{subtitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {isPending && (
            <button
              onClick={() => resend(primary)}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-700 text-xs font-semibold hover:bg-amber-100 disabled:opacity-50"
            >
              Resend email
            </button>
          )}
          <button
            onClick={() => setShowInvite(true)}
            title="Invite another portal user"
            className="px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-stone-700 text-xs font-semibold hover:border-stone-500"
          >
            Invite another
          </button>
          <button
            onClick={() => setConfirmRevoke(primary)}
            className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-600 text-xs font-semibold hover:bg-rose-50"
          >
            {isPending ? "Cancel invitation" : "Revoke access"}
          </button>
        </div>
      </div>

      {showInvite && (
        <InvitePortalUserModal
          storeId={store.id}
          onClose={() => setShowInvite(false)}
          onInvited={async () => {
            setShowInvite(false);
            if (onPortalChanged) await onPortalChanged();
          }}
        />
      )}

      {confirmRevoke && (
        <ConfirmDialog
          title={isPending ? "Cancel invitation?" : "Revoke portal access?"}
          body={
            <>
              <p className="text-sm text-stone-700">
                <span className="font-semibold">{confirmRevoke.name}</span> ({confirmRevoke.email}){" "}
                {isPending
                  ? "will no longer be able to use the invitation link from the email."
                  : "will lose access to the consignment portal immediately."}
              </p>
              <p className="text-xs text-stone-500 mt-2">
                Memos and history stay intact — you can re-invite them or someone else later.
              </p>
            </>
          }
          confirmLabel={busy ? (isPending ? "Cancelling…" : "Revoking…") : (isPending ? "Cancel invitation" : "Revoke access")}
          confirmTone="rose"
          busy={busy}
          onCancel={() => setConfirmRevoke(null)}
          onConfirm={handleRevoke}
        />
      )}
    </>
  );
}

/* Reusable confirm dialog with backdrop, used for destructive actions. */
function ConfirmDialog({ title, body, confirmLabel, confirmTone = "stone", busy, onCancel, onConfirm }) {
  const tones = {
    rose:  "bg-rose-600 hover:bg-rose-700",
    stone: "bg-stone-900 hover:bg-stone-800",
  };
  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="p-5 sm:p-6">
          <h3 className="font-bold text-stone-900 text-base">{title}</h3>
          <div className="mt-2">{body}</div>
        </div>
        <div className="px-5 sm:px-6 py-3 bg-stone-50 border-t border-stone-100 flex justify-end gap-2 rounded-b-2xl">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-2 rounded-lg text-sm font-semibold text-stone-600 hover:bg-stone-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`px-3 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 ${tones[confirmTone] || tones.stone}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function CoverEditButton({ store, onPatch }) {
  const [open, setOpen] = useState(false);
  const [logo, setLogo] = useState(store.logo_url || "");
  const [cover, setCover] = useState(store.cover_image_url || "");

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/90 backdrop-blur-sm border border-white/40 text-stone-700 text-xs font-semibold hover:bg-white"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        Cover
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl">
            <h3 className="font-semibold text-stone-900 mb-3">Store imagery</h3>
            <label className="block mb-3">
              <div className="text-xs font-medium text-stone-600 mb-1">Logo URL</div>
              <input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://..." className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 focus:outline-none focus:border-stone-400" />
            </label>
            <label className="block mb-4">
              <div className="text-xs font-medium text-stone-600 mb-1">Cover image URL</div>
              <input value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://..." className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 focus:outline-none focus:border-stone-400" />
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-stone-600 hover:bg-stone-100">Cancel</button>
              <button
                onClick={() => { onPatch({ logoUrl: logo || null, coverImageUrl: cover || null }); setOpen(false); }}
                className="px-3 py-1.5 rounded-lg bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─────────────── KPI tile ─────────────── */

function Kpi({ label, value, accent = "text-stone-900", icon }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-3 sm:p-4">
      <div className="flex items-center gap-2 text-stone-500">
        {icon && (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d={icon} />
          </svg>
        )}
        <span className="text-[10px] uppercase tracking-wider font-bold">{label}</span>
      </div>
      <div className={`text-xl sm:text-2xl font-bold mt-1 ${accent}`}>{value}</div>
    </div>
  );
}

/* ─────────────── Overview tab ─────────────── */

function OverviewTab({ store, memos, onPatch }) {
  const recentMemos = memos.slice(0, 5);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
      <div className="lg:col-span-2 space-y-3 sm:space-y-4">
        {/* About / description */}
        <DescriptionCard description={store.description} onPatch={onPatch} />
        {/* Recent memos preview */}
        <div className="bg-white border border-stone-200 rounded-xl">
          <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
            <h3 className="font-semibold text-stone-900 text-sm">Recent memos</h3>
            {memos.length > 5 && (
              <Link to={`/crm/memos?companyId=${store.id}`} className="text-xs font-semibold text-stone-600 hover:text-stone-900">
                View all →
              </Link>
            )}
          </div>
          {recentMemos.length === 0 ? (
            <div className="p-6 text-center text-sm text-stone-400">No memos yet</div>
          ) : (
            <div className="divide-y divide-stone-100">
              {recentMemos.map((m) => <MemoListRow key={m.id} memo={m} />)}
            </div>
          )}
        </div>
      </div>
      <div className="space-y-3 sm:space-y-4">
        <ContactBlock store={store} onPatch={onPatch} />
        <SocialBlock store={store} onPatch={onPatch} />
        <BusinessHoursBlock store={store} onPatch={onPatch} />
      </div>
    </div>
  );
}

/* ─────────────── Description (inline editable) ─────────────── */

function DescriptionCard({ description, onPatch }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(description || "");
  useEffect(() => setVal(description || ""), [description]);

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-stone-900 text-sm">About this store</h3>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs font-semibold text-stone-600 hover:text-stone-900">
            {description ? "Edit" : "+ Add description"}
          </button>
        )}
      </div>
      {editing ? (
        <>
          <textarea
            value={val}
            onChange={(e) => setVal(e.target.value)}
            rows={5}
            placeholder="Tell your team about this store — relationship history, who runs it, what styles they favor, what's worked in the past..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 focus:outline-none focus:border-stone-400 resize-none"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={() => { setEditing(false); setVal(description || ""); }} className="px-3 py-1 rounded-md text-xs font-semibold text-stone-600 hover:bg-stone-100">Cancel</button>
            <button
              onClick={() => { onPatch({ description: val.trim() || null }); setEditing(false); }}
              className="px-3 py-1 rounded-md bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800"
            >
              Save
            </button>
          </div>
        </>
      ) : description ? (
        <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap">{description}</p>
      ) : (
        <p className="text-sm text-stone-400 italic">No description yet</p>
      )}
    </div>
  );
}

/* ─────────────── Contact block (sidebar) ─────────────── */

function ContactBlock({ store, onPatch }) {
  const [editing, setEditing] = useState(false);
  const [data, setData] = useState({
    primaryContact: store.primary_contact || "",
    email: store.email || "",
    phone: store.phone || "",
    website: store.website || "",
    address: store.address || "",
    city: store.city || "",
    country: store.country || "",
  });
  useEffect(() => setData({
    primaryContact: store.primary_contact || "", email: store.email || "",
    phone: store.phone || "", website: store.website || "",
    address: store.address || "", city: store.city || "", country: store.country || "",
  }), [store]);

  const items = [
    { icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", label: "Contact",  value: store.primary_contact, link: null },
    { icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",      label: "Email",    value: store.email, link: store.email && `mailto:${store.email}` },
    { icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z", label: "Phone",    value: store.phone, link: store.phone && `tel:${store.phone}` },
    { icon: "M21 12a9 9 0 11-18 0 9 9 0 0118 0z M3 12h18 M12 3a15.3 15.3 0 0140 0", label: "Website", value: store.website, link: store.website },
    { icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z", label: "Address", value: [store.address, store.city, store.country].filter(Boolean).join(", "), link: null },
  ];

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-stone-900 text-sm">Contact</h3>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs font-semibold text-stone-600 hover:text-stone-900">Edit</button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <Input label="Primary contact" value={data.primaryContact} onChange={(v) => setData({ ...data, primaryContact: v })} />
          <Input label="Email" value={data.email} onChange={(v) => setData({ ...data, email: v })} type="email" />
          <Input label="Phone" value={data.phone} onChange={(v) => setData({ ...data, phone: v })} />
          <Input label="Website" value={data.website} onChange={(v) => setData({ ...data, website: v })} />
          <Input label="Address" value={data.address} onChange={(v) => setData({ ...data, address: v })} />
          <div className="grid grid-cols-2 gap-2">
            <Input label="City" value={data.city} onChange={(v) => setData({ ...data, city: v })} />
            <Input label="Country" value={data.country} onChange={(v) => setData({ ...data, country: v })} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setEditing(false)} className="px-3 py-1 rounded-md text-xs font-semibold text-stone-600 hover:bg-stone-100">Cancel</button>
            <button
              onClick={() => { onPatch(data); setEditing(false); }}
              className="px-3 py-1 rounded-md bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.filter((i) => i.value).length === 0 ? (
            <p className="text-xs text-stone-400 italic">No contact info yet — click Edit to add</p>
          ) : items.filter((i) => i.value).map((i) => (
            <div key={i.label} className="flex items-start gap-2 text-sm">
              <svg className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d={i.icon} /></svg>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-wider text-stone-400 font-medium">{i.label}</div>
                {i.link ? (
                  <a href={i.link} target={i.link.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="text-stone-700 hover:text-stone-900 break-words">{i.value}</a>
                ) : (
                  <div className="text-stone-700 break-words">{i.value}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────── Social links block ─────────────── */

function SocialBlock({ store, onPatch }) {
  const [editing, setEditing] = useState(false);
  const [data, setData] = useState({
    instagram: store.instagram || "", facebook: store.facebook || "",
    linkedin: store.linkedin || "", whatsapp: store.whatsapp || "",
  });
  useEffect(() => setData({
    instagram: store.instagram || "", facebook: store.facebook || "",
    linkedin: store.linkedin || "", whatsapp: store.whatsapp || "",
  }), [store]);

  const links = [
    { key: "instagram", label: "Instagram", value: store.instagram, prefix: "https://instagram.com/" },
    { key: "facebook",  label: "Facebook",  value: store.facebook,  prefix: "https://facebook.com/" },
    { key: "linkedin",  label: "LinkedIn",  value: store.linkedin,  prefix: "https://linkedin.com/in/" },
    { key: "whatsapp",  label: "WhatsApp",  value: store.whatsapp,  prefix: "https://wa.me/" },
  ];
  const hasAny = links.some((l) => l.value);

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-stone-900 text-sm">Social</h3>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs font-semibold text-stone-600 hover:text-stone-900">
            {hasAny ? "Edit" : "+ Add"}
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          {links.map((l) => (
            <Input key={l.key} label={l.label} value={data[l.key]} onChange={(v) => setData({ ...data, [l.key]: v })} placeholder={l.key === "whatsapp" ? "+972 50..." : "@username or full URL"} />
          ))}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setEditing(false)} className="px-3 py-1 rounded-md text-xs font-semibold text-stone-600 hover:bg-stone-100">Cancel</button>
            <button
              onClick={() => { onPatch(data); setEditing(false); }}
              className="px-3 py-1 rounded-md bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800"
            >
              Save
            </button>
          </div>
        </div>
      ) : !hasAny ? (
        <p className="text-xs text-stone-400 italic">No social links yet</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {links.filter((l) => l.value).map((l) => (
            <a
              key={l.key}
              href={l.value.startsWith("http") ? l.value : l.prefix + l.value.replace(/^@/, "")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 text-xs font-semibold hover:bg-stone-200"
            >
              {l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────── Business hours block ─────────────── */

function BusinessHoursBlock({ store, onPatch }) {
  const [editing, setEditing] = useState(false);
  const initial = store.business_hours || {};
  const [data, setData] = useState(() => Object.fromEntries(WEEKDAYS.map((d) => [d.key, initial[d.key] || ""])));
  useEffect(() => {
    const v = store.business_hours || {};
    setData(Object.fromEntries(WEEKDAYS.map((d) => [d.key, v[d.key] || ""])));
  }, [store]);

  const hasAny = Object.values(initial || {}).some((v) => v && v.trim());

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-stone-900 text-sm">Business hours</h3>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs font-semibold text-stone-600 hover:text-stone-900">
            {hasAny ? "Edit" : "+ Add"}
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-1.5">
          {WEEKDAYS.map((d) => (
            <div key={d.key} className="flex items-center gap-2">
              <span className="w-9 text-xs font-semibold text-stone-600">{d.label}</span>
              <input
                value={data[d.key]}
                onChange={(e) => setData({ ...data, [d.key]: e.target.value })}
                placeholder="9:00 – 18:00 or Closed"
                className="flex-1 px-2 py-1 text-xs rounded border border-stone-200 focus:outline-none focus:border-stone-400"
              />
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setEditing(false)} className="px-3 py-1 rounded-md text-xs font-semibold text-stone-600 hover:bg-stone-100">Cancel</button>
            <button
              onClick={() => { onPatch({ businessHours: data }); setEditing(false); }}
              className="px-3 py-1 rounded-md bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800"
            >
              Save
            </button>
          </div>
        </div>
      ) : !hasAny ? (
        <p className="text-xs text-stone-400 italic">No hours set</p>
      ) : (
        <div className="space-y-1">
          {WEEKDAYS.map((d) => (
            <div key={d.key} className="flex items-center justify-between text-xs">
              <span className="font-semibold text-stone-600 w-9">{d.label}</span>
              <span className="text-stone-700">{initial[d.key] || "—"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────── Requests tab (memo requests from the store-portal) ─────────────── */

const REQUEST_STATUS = {
  pending:   { label: "Pending review",      color: "bg-amber-50 text-amber-700 border-amber-200" },
  converted: { label: "Converted to memo",   color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  declined:  { label: "Declined",            color: "bg-rose-50 text-rose-700 border-rose-200" },
  cancelled: { label: "Cancelled by store",  color: "bg-stone-100 text-stone-600 border-stone-200" },
};

function RequestsTab({ requests, onChanged }) {
  const [openId, setOpenId] = useState(null);
  const pending = useMemo(() => requests.filter((r) => r.status === "pending"), [requests]);
  const past    = useMemo(() => requests.filter((r) => r.status !== "pending"), [requests]);

  if (requests.length === 0) {
    return (
      <div className="bg-white border border-dashed border-stone-300 rounded-xl p-10 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-stone-900 mb-1">No memo requests yet</h3>
        <p className="text-xs text-stone-500">When this store's portal users ask for a memo, it'll appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-xl overflow-hidden ring-1 ring-amber-100">
          <div className="px-4 py-3 border-b border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50 flex items-center gap-2">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-70 animate-ping" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-amber-500" />
            </span>
            <h3 className="font-semibold text-amber-900 text-sm">
              {pending.length} pending request{pending.length === 1 ? "" : "s"}
            </h3>
          </div>
          <div className="divide-y divide-amber-100">
            {pending.map((r) => (
              <RequestRow key={r.id} req={r} onOpen={() => setOpenId(r.id)} />
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-200">
            <h3 className="font-semibold text-stone-900 text-sm">Past requests</h3>
          </div>
          <div className="divide-y divide-stone-100">
            {past.map((r) => (
              <RequestRow key={r.id} req={r} onOpen={() => setOpenId(r.id)} />
            ))}
          </div>
        </div>
      )}

      {openId != null && (
        <RequestDetailDrawer
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => { setOpenId(null); onChanged?.(); }}
        />
      )}
    </div>
  );
}

function RequestRow({ req, onOpen }) {
  const meta = REQUEST_STATUS[req.status] || REQUEST_STATUS.pending;
  return (
    <button
      onClick={onOpen}
      className="group w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-stone-50/70 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${meta.color}`}>
            {meta.label}
          </span>
          <span className="text-[11px] text-stone-400">#{req.id}</span>
          <span className="text-[11px] text-stone-400">· {new Date(req.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
          {req.preferred_due_at && (
            <span className="text-[11px] text-stone-500">· wants by {new Date(req.preferred_due_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
          )}
        </div>
        <div className="font-bold text-stone-900 text-sm mt-1 group-hover:text-indigo-700 transition-colors">
          {req.item_count} item{req.item_count === 1 ? "" : "s"}
          {req.requester_name && <span className="text-stone-500 font-normal"> · from {req.requester_name}</span>}
        </div>
        {req.message && <div className="text-xs text-stone-500 truncate mt-0.5">"{req.message}"</div>}
      </div>
      <svg className="w-4 h-4 text-stone-300 mt-2 hidden sm:block group-hover:text-indigo-500 group-hover:translate-x-0.5 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

/**
 * RequestItemRow — clickable row that previews a stone or jewelry item
 * inside a request. Click opens the canonical detail page in a new tab
 * so the supplier doesn't lose the request drawer context.
 *
 *   - jewelry → /jewelry/items/:id (uses snapshot.id / item_id)
 *   - stone   → /<sku> (the legacy DiamondCard route)
 */
function RequestItemRow({ item }) {
  const snap = item.snapshot || {};
  const isJewelry = item.item_type === "jewelry";
  const title = isJewelry
    ? (snap.name || item.item_sku)
    : `${snap.shape || ""} ${snap.weightCt ? `${snap.weightCt} ct` : ""}`.trim() || item.item_sku;
  const subBits = isJewelry
    ? [snap.metalType, snap.category].filter(Boolean)
    : [snap.color, snap.clarity, snap.origin].filter(Boolean);

  // Build the deep-link to the full detail page. Jewelry items prefer
  // a numeric DB id (snapshot.id or item.item_id) — fall back to SKU.
  // Stones go to the legacy /<sku> DiamondCard route.
  let href = null;
  if (isJewelry) {
    const jid = snap.id || item.item_id;
    if (jid) href = `/jewelry/items/${jid}`;
  } else if (item.item_sku) {
    href = `/${encodeURIComponent(item.item_sku)}`;
  }

  const inner = (
    <>
      <div className="w-14 h-14 rounded-lg bg-stone-100 overflow-hidden ring-1 ring-stone-200 shrink-0">
        {snap.imageUrl ? <img src={snap.imageUrl} alt="" className="w-full h-full object-cover" /> : null}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${isJewelry ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700"}`}>{item.item_type}</span>
          <span className="text-[11px] font-mono font-semibold text-stone-400">{item.item_sku}</span>
        </div>
        <div className="text-sm font-semibold text-stone-900 mt-1 truncate group-hover:text-indigo-700 transition-colors">{title}</div>
        {subBits.length > 0 && (
          <div className="text-[11px] text-stone-500 mt-0.5 truncate">{subBits.join(" · ")}</div>
        )}
        {item.notes && <div className="text-[11px] text-stone-500 mt-1 italic">"{item.notes}"</div>}
      </div>
      {href && (
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-stone-400 group-hover:text-indigo-600 self-center shrink-0 transition-colors">
          <span className="hidden sm:inline">Details</span>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
        </div>
      )}
    </>
  );

  if (!href) {
    return (
      <div className="flex items-start gap-3 px-3 py-3">{inner}</div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 px-3 py-3 hover:bg-stone-50 transition-colors cursor-pointer"
    >
      {inner}
    </a>
  );
}

function RequestDetailDrawer({ id, onClose, onChanged }) {
  const { user } = useUser();
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);
  const [declineMode, setDeclineMode] = useState(false);
  const [reason, setReason]   = useState("");

  useEffect(() => {
    if (!user?.id || id == null) return;
    setLoading(true);
    fetchOwnerMemoRequest(user.id, id)
      .then(setData)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [user?.id, id]);

  const convert = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const out = await convertMemoRequest(user.id, id);
      toast.success(`Draft memo created${out?.memo?.memo_number ? `: ${out.memo.memo_number}` : ""}`);
      if (out?.memo?.id) navigate(`/crm/memos/${out.memo.id}`);
      onChanged?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await declineMemoRequest(user.id, id, reason.trim() || null);
      toast.success("Request declined");
      onChanged?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/60 backdrop-blur-sm">
      <div className="w-full sm:max-w-xl bg-white shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-stone-200 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-stone-400">Request #{id}</div>
            <h3 className="text-lg font-bold text-stone-900 mt-0.5">{data?.company_name || "Loading…"}</h3>
            {data && (
              <div className="text-xs text-stone-500 mt-0.5">
                Submitted {new Date(data.created_at).toLocaleString()}
                {data.requester_name && <> · by {data.requester_name}</>}
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading || !data ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-3 w-1/3 bg-stone-200 rounded" />
              <div className="h-32 bg-stone-100 rounded-xl" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${(REQUEST_STATUS[data.status] || REQUEST_STATUS.pending).color}`}>
                  {(REQUEST_STATUS[data.status] || REQUEST_STATUS.pending).label}
                </span>
                {data.preferred_due_at && (
                  <span className="text-xs text-stone-500">Wants by {new Date(data.preferred_due_at).toLocaleDateString()}</span>
                )}
              </div>
              {data.message && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-stone-400 mb-1">Notes from store</div>
                  <div className="rounded-xl bg-stone-50 border border-stone-200 p-3 text-sm text-stone-800 whitespace-pre-wrap">{data.message}</div>
                </div>
              )}
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-stone-400 mb-2">
                  Items · {data.items?.length || 0}
                </div>
                <div className="rounded-xl border border-stone-200 divide-y divide-stone-100 overflow-hidden">
                  {(data.items || []).map((it) => (
                    <RequestItemRow key={it.id} item={it} />
                  ))}
                  {(!data.items || data.items.length === 0) && (
                    <div className="px-3 py-4 text-xs text-stone-400 italic">Free-text request only — no specific items listed.</div>
                  )}
                </div>
              </div>
              {data.decline_reason && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-rose-500 mb-1">Decline reason</div>
                  <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-900 whitespace-pre-wrap">{data.decline_reason}</div>
                </div>
              )}
              {data.converted_memo_id && (
                <Link
                  to={`/crm/memos/${data.converted_memo_id}`}
                  className="block rounded-xl border border-emerald-200 bg-emerald-50 p-3 hover:bg-emerald-100 transition"
                >
                  <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-emerald-700">Resulting memo</div>
                  <div className="text-sm font-bold text-emerald-900 mt-0.5">Open memo →</div>
                </Link>
              )}
              {declineMode && data.status === "pending" && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-stone-400 mb-1.5">Reason (optional)</div>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="Why is this declined? (Out of stock, customer mismatch, etc.)"
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 placeholder-stone-400 resize-y"
                  />
                </div>
              )}
            </>
          )}
        </div>
        {data?.status === "pending" && (
          <div className="px-5 py-3 border-t border-stone-200 flex items-center justify-between gap-2 bg-stone-50/70">
            {!declineMode ? (
              <>
                <button
                  onClick={() => setDeclineMode(true)}
                  disabled={busy}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >Decline</button>
                <button
                  onClick={convert}
                  disabled={busy}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white text-sm font-bold disabled:opacity-50 hover:opacity-95"
                >
                  {busy ? "Working…" : "Convert to memo →"}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setDeclineMode(false); setReason(""); }}
                  disabled={busy}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-stone-600 hover:bg-stone-200"
                >Back</button>
                <button
                  onClick={decline}
                  disabled={busy}
                  className="px-5 py-2 rounded-lg bg-rose-600 text-white text-sm font-bold disabled:opacity-50 hover:bg-rose-700"
                >
                  {busy ? "Declining…" : "Confirm decline"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────── Memos tab ─────────────── */

function MemosTab({ memos, storeId, onCreate }) {
  if (memos.length === 0) {
    return (
      <div className="bg-white border border-dashed border-stone-300 rounded-xl p-10 text-center">
        <p className="text-sm text-stone-500 mb-4">No memos for this store yet</p>
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Create first memo
        </button>
      </div>
    );
  }
  return (
    <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100">
      {memos.map((m) => <MemoListRow key={m.id} memo={m} />)}
    </div>
  );
}

function MemoListRow({ memo }) {
  const expired = isMemoEffectivelyExpired(memo);
  const effective = expired ? "expired" : memo.status;
  const status = MEMO_STATUSES.find((s) => s.value === effective) || MEMO_STATUSES[0];
  return (
    <Link to={`/crm/memos/${memo.id}`} className="flex items-center gap-3 p-3 hover:bg-stone-50">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-mono font-semibold text-stone-400">{memo.memo_number}</span>
          <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full border ${status.color}`}>
            {status.label}
          </span>
        </div>
        <div className="text-xs text-stone-500 mt-0.5">
          {memo.item_count || 0} item{memo.item_count !== 1 ? "s" : ""}
          {memo.items_out > 0 && memo.items_out < memo.item_count && (
            <span className="text-amber-600 ml-1">({memo.items_out} out)</span>
          )}
          {memo.due_at && <> · due {new Date(memo.due_at).toLocaleDateString()}</>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-semibold text-stone-900">${Number(memo.total_value || 0).toLocaleString()}</div>
      </div>
    </Link>
  );
}

/* ─────────────── Contacts tab ─────────────── */

function ContactsTab({ contacts, storeId }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl">
      <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
        <h3 className="font-semibold text-stone-900 text-sm">People at this store</h3>
        <Link
          to={`/crm/contacts?action=new&companyId=${storeId}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Link contact
        </Link>
      </div>
      {contacts.length === 0 ? (
        <div className="p-10 text-center text-sm text-stone-400">
          No contacts linked yet. Link an existing CRM contact to this store, or create a new one.
        </div>
      ) : (
        <div className="divide-y divide-stone-100">
          {contacts.map((c) => (
            <Link
              key={c.id}
              to={`/crm/customers/${c.id}`}
              className="flex items-center gap-3 p-3 hover:bg-stone-50"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-stone-200 to-stone-300 text-stone-700 flex items-center justify-center font-bold text-sm shrink-0">
                {(c.name || "?").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-stone-900 truncate">{c.name}</div>
                <div className="text-xs text-stone-500 truncate">
                  {[c.title, c.email, c.phone].filter(Boolean).join(" · ") || c.type}
                </div>
              </div>
              <svg className="w-4 h-4 text-stone-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────── Settings tab (memo defaults, taxonomy, etc.) ─────────────── */

function SettingsTab({ store, onPatch }) {
  const [data, setData] = useState({
    type: store.type || "retail_store",
    defaultMemoDays: store.default_memo_days || 30,
    paymentTerms: store.payment_terms || "",
    creditLimit: store.credit_limit || "",
    currency: store.currency || "USD",
    taxId: store.tax_id || "",
    establishedYear: store.established_year || "",
    notes: store.notes || "",
  });

  const dirty = useMemo(() => (
    data.type !== (store.type || "retail_store") ||
    Number(data.defaultMemoDays) !== (store.default_memo_days || 30) ||
    data.paymentTerms !== (store.payment_terms || "") ||
    String(data.creditLimit) !== String(store.credit_limit || "") ||
    data.currency !== (store.currency || "USD") ||
    data.taxId !== (store.tax_id || "") ||
    String(data.establishedYear) !== String(store.established_year || "") ||
    data.notes !== (store.notes || "")
  ), [data, store]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
      <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
        <h3 className="font-semibold text-stone-900 text-sm">Classification</h3>
        <Select label="Type" value={data.type} onChange={(v) => setData({ ...data, type: v })} options={COMPANY_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
        <Input label="Tax ID / VAT" value={data.taxId} onChange={(v) => setData({ ...data, taxId: v })} />
        <Input label="Established year" value={data.establishedYear} onChange={(v) => setData({ ...data, establishedYear: v })} type="number" />
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
        <h3 className="font-semibold text-stone-900 text-sm">Memo defaults</h3>
        <p className="text-xs text-stone-500 -mt-2">These values pre-fill when issuing a new memo to this store.</p>
        <Input label="Default memo length (days)" value={data.defaultMemoDays} onChange={(v) => setData({ ...data, defaultMemoDays: v })} type="number" />
        <Select label="Payment terms" value={data.paymentTerms} onChange={(v) => setData({ ...data, paymentTerms: v })} options={[{ value: "", label: "—" }, ...PAYMENT_TERMS]} />
        <Input label="Credit limit (USD)" value={data.creditLimit} onChange={(v) => setData({ ...data, creditLimit: v })} type="number" placeholder="No limit" />
        <Select label="Currency" value={data.currency} onChange={(v) => setData({ ...data, currency: v })} options={CURRENCIES} />
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3 lg:col-span-2">
        <h3 className="font-semibold text-stone-900 text-sm">Internal notes</h3>
        <textarea
          value={data.notes}
          onChange={(e) => setData({ ...data, notes: e.target.value })}
          rows={3}
          placeholder="Sensitive info (negotiation history, credit issues, contact preferences) only visible to the team..."
          className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 focus:outline-none focus:border-stone-400 resize-none"
        />
      </div>

      <PortalAccessCard storeId={store.id} />

      {dirty && (
        <div className="lg:col-span-2 sticky bottom-4 z-10 bg-white border border-stone-200 rounded-xl p-3 flex items-center justify-between shadow-lg">
          <span className="text-xs text-stone-500">Unsaved changes</span>
          <div className="flex gap-2">
            <button
              onClick={() => setData({
                type: store.type, defaultMemoDays: store.default_memo_days, paymentTerms: store.payment_terms || "",
                creditLimit: store.credit_limit || "", currency: store.currency || "USD",
                taxId: store.tax_id || "", establishedYear: store.established_year || "", notes: store.notes || "",
              })}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold text-stone-600 hover:bg-stone-100"
            >
              Discard
            </button>
            <button
              onClick={() => onPatch({
                ...data,
                defaultMemoDays: Number(data.defaultMemoDays) || 30,
                creditLimit: data.creditLimit !== "" ? Number(data.creditLimit) : null,
                establishedYear: data.establishedYear !== "" ? Number(data.establishedYear) : null,
              })}
              className="px-3 py-1.5 rounded-lg bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800"
            >
              Save changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────── Portal access card ─────────────── */

function PortalAccessCard({ storeId }) {
  const { user } = useUser();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const reload = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await fetchTeamMembers({ id: user.id, email: user.primaryEmailAddress?.emailAddress });
      const all = Array.isArray(data?.members) ? data.members : [];
      setMembers(all.filter((m) => m.role === "store_user" && Number(m.company_id) === Number(storeId)));
    } catch (e) {
      // Silent — settings tab can render without portal users.
    } finally { setLoading(false); }
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [user?.id, storeId]);

  const remove = async (m) => {
    if (!window.confirm(`Revoke ${m.name}'s portal access?`)) return;
    setBusyId(m.id);
    try {
      await removeTeamMember({ id: user.id, email: user.primaryEmailAddress?.emailAddress }, m.id);
      toast.success("Portal access revoked");
      reload();
    } catch (e) { toast.error(e.message); }
    finally { setBusyId(null); }
  };

  const resend = async (m) => {
    setBusyId(m.id);
    try {
      await resendTeamInvite({ id: user.id, email: user.primaryEmailAddress?.emailAddress }, m.id);
      toast.success("Invitation re-sent");
    } catch (e) { toast.error(e.message); }
    finally { setBusyId(null); }
  };

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3 lg:col-span-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-semibold text-stone-900 text-sm">Portal access</h3>
          <p className="text-xs text-stone-500 mt-0.5">
            People at this store who can sign in to the consignment portal and request sold/return on memo items.
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Invite portal user
        </button>
      </div>

      {loading ? (
        <div className="text-xs text-stone-400">Loading…</div>
      ) : members.length === 0 ? (
        <div className="text-xs text-stone-400 italic">No portal users yet — invite someone from this store to give them access.</div>
      ) : (
        <ul className="divide-y divide-stone-100 -mx-4">
          {members.map((m) => (
            <li key={m.id} className="px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-xs shrink-0"
                  style={{ backgroundColor: m.avatar_color || "#0ea5e9" }}
                >
                  {(m.name || "?").split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-stone-900 truncate">{m.name}</div>
                  <div className="text-[11px] text-stone-500 truncate">{m.email}</div>
                </div>
                {m.pending && (
                  <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                    Pending sign-in
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {m.pending && (
                  <button
                    onClick={() => resend(m)}
                    disabled={busyId === m.id}
                    className="px-2.5 py-1 rounded-md bg-white border border-stone-300 text-stone-700 text-[11px] font-semibold hover:border-stone-500 disabled:opacity-50"
                  >
                    Resend
                  </button>
                )}
                <button
                  onClick={() => remove(m)}
                  disabled={busyId === m.id}
                  className="px-2.5 py-1 rounded-md bg-white border border-stone-200 text-rose-600 text-[11px] font-semibold hover:bg-rose-50 disabled:opacity-50"
                >
                  Revoke
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showInvite && (
        <InvitePortalUserModal
          storeId={storeId}
          onClose={() => setShowInvite(false)}
          onInvited={() => { setShowInvite(false); reload(); }}
        />
      )}
    </div>
  );
}

function InvitePortalUserModal({ storeId, onClose, onInvited }) {
  const { user } = useUser();
  const [form, setForm] = useState({ name: "", email: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setBusy(true);
    try {
      const r = await inviteTeamMember(
        { id: user.id, email: user.primaryEmailAddress?.emailAddress },
        {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          role: "store_user",
          companyId: storeId,
        }
      );
      // The BE returns the row even when email delivery failed; surface
      // the actual delivery state so the owner knows whether the store
      // user got the email or whether they need to resend / share link
      // manually.
      const emailSent    = r?.email?.sent === true;
      const emailSkipped = r?.email?.skipped === true;
      const emailError   = r?.email?.error;
      if (emailSent) {
        toast.success(`Portal invitation sent to ${form.name.trim()}`);
      } else if (emailSkipped) {
        toast(
          `${form.name.trim()} added — email service is not configured on the server (RESEND_API_KEY).`,
          { icon: "i", duration: 7000 }
        );
      } else {
        toast.error(
          `${form.name.trim()} added but email delivery failed: ${emailError || "unknown error"} — use Resend to retry.`,
          { duration: 9000 }
        );
      }
      onInvited();
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="px-4 sm:px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-stone-900">Invite portal user</h2>
            <p className="text-xs text-stone-500 mt-0.5">They'll get an email with a link to sign in to the consignment portal.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100" aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={submit} className="p-4 sm:p-6 space-y-3">
          <Input label="Full name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. Sarah Levi" />
          <Input label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" placeholder="sarah@store.com" />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg text-sm font-semibold text-stone-600 hover:bg-stone-100">
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-3 py-2 rounded-lg bg-stone-900 text-white text-sm font-semibold hover:bg-stone-800 disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send invitation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─────────────── Tiny inputs ─────────────── */

function Input({ label, value, onChange, type = "text", placeholder }) {
  return (
    <label className="block">
      <div className="text-[11px] font-medium text-stone-600 mb-0.5">{label}</div>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-stone-200 focus:outline-none focus:border-stone-400"
      />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <div className="text-[11px] font-medium text-stone-600 mb-0.5">{label}</div>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-stone-200 focus:outline-none focus:border-stone-400 bg-white"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
