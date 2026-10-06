import React from "react";
import { Plus } from "lucide-react";
import MemberAvatar from "../../../components/team/MemberAvatar";
import { useTeam } from "../../../context/TeamContext";
import { STONE_STATUS_LABELS } from "../../../services/stonesApi";

export const WhatsAppIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.42-.08-.12-.28-.2-.57-.34zM12.05 21.8h-.01a9.87 9.87 0 01-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 01-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 012.89 6.99c0 5.45-4.44 9.88-9.88 9.88zm8.41-18.3A11.82 11.82 0 0012.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 005.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.17-3.48-8.41z" />
  </svg>
);

/* Workshop bridge status: a dot and a word. */
export const StoneStatus = ({ row }) => {
  if (!row?.status) return null;
  const label = STONE_STATUS_LABELS[row.status] || row.status;
  const title = row.jewelry_sku
    ? `${label} in ${row.jewelry_sku}${row.jewelry_name ? ` (${row.jewelry_name})` : ""}`
    : label;
  return (
    <span className={`inv-status inv-status--${row.status}`} title={title}>
      {label}
    </span>
  );
};

export const TagDots = ({ tags }) => {
  if (!tags?.length) return null;
  const names = tags.map((t) => t.name).join(", ");
  return (
    <span className="inv-tags" title={names} aria-label={`Tags: ${names}`}>
      {tags.slice(0, 4).map((t) => (
        <span key={t.id} className="inv-tag-dot" style={{ background: t.color }} />
      ))}
    </span>
  );
};

/* Claim / release a loose stone. Only rendered when the workspace has a team;
 * a rep can release their own stones and the owner can release anyone's. */
export const AssignmentChip = ({ stone, onAssign, busy }) => {
  const team = useTeam();
  if (!team?.ready || (team.members || []).length <= 1 || !onAssign) return null;
  const member = stone.assignedTo && team.membersByClerkId ? team.membersByClerkId[stone.assignedTo] : null;
  const isMine = stone.assignedTo && stone.assignedTo === team.actorUserId;

  if (!stone.assignedTo) {
    return (
      <button
        type="button"
        className="inv-assign inv-assign--claim"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          onAssign(stone, "me");
        }}
        title="Claim this stone for yourself"
      >
        <Plus size={13} strokeWidth={2} aria-hidden="true" />
        <span>Claim</span>
      </button>
    );
  }

  const canRelease = isMine || team.isOwner;
  return (
    <button
      type="button"
      className="inv-assign"
      disabled={busy || !canRelease}
      onClick={(e) => {
        e.stopPropagation();
        if (canRelease) onAssign(stone, null);
      }}
      title={isMine ? "Release this stone" : `Assigned to ${member?.name || "team member"}`}
    >
      <MemberAvatar member={member} clerkUserId={stone.assignedTo} size="xs" ring={false} />
      <span>{isMine ? "Mine" : member?.name?.split(" ")[0] || "Assigned"}</span>
    </button>
  );
};
