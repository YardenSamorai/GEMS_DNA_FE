import React, { useState, useRef, useEffect } from "react";
import { useTeam } from "../../context/TeamContext";
import MemberAvatar from "./MemberAvatar";

/**
 * AssigneeFilter — single chip control that scopes a list to:
 *   "All" / "Mine" / "Unassigned" / a specific rep
 *
 * Designed to drop-in next to a search box or filter row. The whole roster
 * lives behind a popover so the chip stays compact even with 10 reps.
 *
 * Props:
 *   value        "all" | "me" | "unassigned" | <clerk_user_id>
 *   onChange     (next) => void
 *   align        "left" | "right" (popover anchor; default "left")
 *   showCounts   reserved for a future leaderboard pass; ignored for now
 *
 * Solo workspaces (no reps yet) render nothing — the chip would just say
 * "Mine" and add no value.
 */
const AssigneeFilter = ({ value = "all", onChange, align = "left" }) => {
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
  // Nothing to filter by in a 1-person team.
  if (!team.members || team.members.length <= 1) return null;

  const meKey = team.actorUserId;
  const memberByValue =
    value && value !== "all" && value !== "me" && value !== "unassigned"
      ? team.membersByClerkId[value]
      : null;

  const labelFor = (val) => {
    if (val === "all") return "All";
    if (val === "me") return "Mine";
    if (val === "unassigned") return "Unassigned";
    return memberByValue?.name || "Filter";
  };

  const renderTrigger = () => {
    if (value === "me" || value === meKey) {
      return (
        <>
          <MemberAvatar member={team.me} size="xs" ring={false} />
          <span>Mine</span>
        </>
      );
    }
    if (value === "unassigned") {
      return (
        <>
          <span className="w-5 h-5 rounded-full border border-dashed border-stone-300 inline-block" />
          <span>Unassigned</span>
        </>
      );
    }
    if (memberByValue) {
      return (
        <>
          <MemberAvatar member={memberByValue} size="xs" ring={false} />
          <span>{memberByValue.name?.split(" ")[0] || "Member"}</span>
        </>
      );
    }
    // "all"
    return (
      <>
        <svg className="w-3.5 h-3.5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
        </svg>
        <span>All team</span>
      </>
    );
  };

  const Option = ({ active, children, onClick, leading }) => (
    <button
      type="button"
      onClick={() => { onClick(); setOpen(false); }}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
        active ? "bg-emerald-50 text-emerald-700" : "hover:bg-stone-50 text-stone-700"
      }`}
    >
      {leading}
      <span className="flex-1 truncate">{children}</span>
      {active && (
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-emerald-600">
          <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4L8.4 15a1 1 0 01-1.4 0L3.3 11.3a1 1 0 011.4-1.4L7.7 13l7.6-7.6a1 1 0 011.4 0z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );

  return (
    <div ref={popRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 transition shadow-sm"
        title={`Filter by team member · ${labelFor(value)}`}
      >
        {renderTrigger()}
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-stone-400">
          <path fillRule="evenodd" d="M5.3 7.3a1 1 0 011.4 0L10 10.6l3.3-3.3a1 1 0 011.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 010-1.4z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute z-30 mt-1.5 w-56 max-h-80 overflow-y-auto rounded-lg border border-stone-200 bg-white p-1 shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <Option
            active={value === "all"}
            onClick={() => onChange("all")}
            leading={
              <svg className="w-4 h-4 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-7.13a4 4 0 11-8 0 4 4 0 018 0zm6 4a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          >
            All team
          </Option>
          {meKey && (
            <Option
              active={value === "me" || value === meKey}
              onClick={() => onChange("me")}
              leading={<MemberAvatar member={team.me} size="xs" ring={false} />}
            >
              Mine
            </Option>
          )}
          <Option
            active={value === "unassigned"}
            onClick={() => onChange("unassigned")}
            leading={<span className="w-5 h-5 rounded-full border border-dashed border-stone-300 inline-block" />}
          >
            Unassigned
          </Option>

          <div className="my-1 border-t border-stone-100" />
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-stone-400">
            Team
          </div>
          {team.members
            .filter((m) => m.clerk_user_id && m.clerk_user_id !== meKey)
            .map((m) => (
              <Option
                key={m.id}
                active={value === m.clerk_user_id}
                onClick={() => onChange(m.clerk_user_id)}
                leading={<MemberAvatar member={m} size="xs" ring={false} />}
              >
                <span className="flex items-center gap-1.5">
                  <span className="truncate">{m.name}</span>
                  {m.role === "owner" && (
                    <span className="text-[9px] uppercase tracking-wider text-stone-400">
                      Admin
                    </span>
                  )}
                </span>
              </Option>
            ))}
        </div>
      )}
    </div>
  );
};

export default AssigneeFilter;
