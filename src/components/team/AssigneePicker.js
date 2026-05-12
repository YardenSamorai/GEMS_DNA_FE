import React, { useState, useRef, useEffect } from "react";
import { useTeam } from "../../context/TeamContext";
import MemberAvatar from "./MemberAvatar";

/**
 * AssigneePicker — dropdown to set who's responsible for a record.
 *
 * Used inside drawers / detail pages (Contact drawer, Deal drawer, Jewelry
 * item detail). Reps can only assign to themselves; the BE enforces the
 * same rule but we hide the rest of the team from the UI for clarity.
 *
 * Props:
 *   value     current assigned_to (clerk_user_id) or null
 *   onChange  (clerkUserIdOrNull) => Promise<void> | void
 *   disabled  read-only mode
 *   compact   when true, render the trigger as just the avatar (saves space
 *             in tight headers)
 *
 * For solo workspaces the picker collapses to nothing (no team to pick from).
 */
const AssigneePicker = ({ value, onChange, disabled = false, compact = false }) => {
  const team = useTeam();
  const [open, setOpen] = useState(false);
  const popRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!team.ready) return null;
  if (!team.members || team.members.length <= 1) return null;

  const member = value ? team.membersByClerkId[value] : null;
  const canPickAny = team.isOwner;
  const visible = canPickAny
    ? team.members.filter((m) => m.clerk_user_id)
    : team.members.filter((m) => m.clerk_user_id === team.actorUserId);

  const handlePick = (next) => {
    setOpen(false);
    if (typeof onChange === "function") onChange(next);
  };

  const trigger = compact ? (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setOpen((o) => !o)}
      className={`inline-flex items-center justify-center rounded-full transition ${
        disabled ? "opacity-60 cursor-not-allowed" : "hover:opacity-80"
      }`}
      title={member ? `Assigned to ${member.name}` : "Unassigned · click to assign"}
    >
      {member ? (
        <MemberAvatar member={member} size="sm" />
      ) : (
        <MemberAvatar size="sm" />
      )}
    </button>
  ) : (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setOpen((o) => !o)}
      className={`inline-flex items-center gap-2 rounded-lg border bg-white px-2.5 py-1.5 text-sm transition shadow-sm ${
        disabled
          ? "opacity-60 cursor-not-allowed border-stone-200 text-stone-500"
          : "border-stone-200 text-stone-700 hover:bg-stone-50"
      }`}
    >
      {member ? (
        <>
          <MemberAvatar member={member} size="xs" ring={false} />
          <span className="truncate max-w-[140px]">{member.name}</span>
        </>
      ) : (
        <>
          <MemberAvatar size="xs" ring={false} />
          <span className="text-stone-500">Unassigned</span>
        </>
      )}
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-stone-400">
        <path fillRule="evenodd" d="M5.3 7.3a1 1 0 011.4 0L10 10.6l3.3-3.3a1 1 0 011.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 010-1.4z" clipRule="evenodd" />
      </svg>
    </button>
  );

  return (
    <div ref={popRef} className="relative inline-block">
      {trigger}
      {open && (
        <div className="absolute z-40 mt-1.5 w-60 max-h-80 overflow-y-auto rounded-lg border border-stone-200 bg-white p-1 shadow-lg">
          {canPickAny && (
            <button
              type="button"
              onClick={() => handlePick(null)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
                !value ? "bg-emerald-50 text-emerald-700" : "hover:bg-stone-50 text-stone-700"
              }`}
            >
              <MemberAvatar size="xs" ring={false} />
              <span className="flex-1">Unassigned</span>
            </button>
          )}
          {visible.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => handlePick(m.clerk_user_id)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
                value === m.clerk_user_id
                  ? "bg-emerald-50 text-emerald-700"
                  : "hover:bg-stone-50 text-stone-700"
              }`}
            >
              <MemberAvatar member={m} size="xs" ring={false} />
              <span className="flex-1 truncate">
                {m.name}
                {m.role === "owner" && (
                  <span className="ml-1 text-[9px] uppercase tracking-wider text-stone-400">
                    Admin
                  </span>
                )}
              </span>
              {value === m.clerk_user_id && (
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-emerald-600">
                  <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4L8.4 15a1 1 0 01-1.4 0L3.3 11.3a1 1 0 011.4-1.4L7.7 13l7.6-7.6a1 1 0 011.4 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
          {!canPickAny && (
            <div className="px-2 py-1.5 text-[11px] text-stone-500">
              Only the workspace owner can re-assign records.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AssigneePicker;
