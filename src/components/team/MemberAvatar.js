import React from "react";
import { colorFromSeed, initialsFromName } from "../../services/teamApi";

/**
 * MemberAvatar — circle with initials + brand color, the visual identity of a
 * sales rep. Used everywhere a row/card needs to show "who owns this".
 *
 * Props:
 *   member       team_members row (preferred) — { name, avatar_color, role, clerk_user_id }
 *   clerkUserId  fallback when only the id is available; color is hashed from it
 *   name         fallback display name
 *   size         "xs" | "sm" | "md" | "lg" (default "sm" — fits inside a list cell)
 *   ring         draw a thin contrast ring (default true)
 *   tooltip      override hover title (defaults to member.name)
 *   onClick      makes the bubble interactive
 *
 * No member at all? Renders a neutral "unassigned" dashed circle so an empty
 * `assigned_to` is visually distinct from a missing column.
 */
const SIZE_CLASSES = {
  xs: "w-5 h-5 text-[9px]",
  sm: "w-6 h-6 text-[10px]",
  md: "w-8 h-8 text-xs",
  lg: "w-10 h-10 text-sm",
};

const MemberAvatar = ({
  member,
  clerkUserId,
  name,
  size = "sm",
  ring = true,
  tooltip,
  onClick,
  className = "",
}) => {
  const sizeCls = SIZE_CLASSES[size] || SIZE_CLASSES.sm;
  const ringCls = ring ? "ring-2 ring-white dark:ring-stone-900" : "";
  const interactiveCls = onClick ? "cursor-pointer hover:opacity-90 transition" : "";

  if (!member && !clerkUserId && !name) {
    return (
      <div
        title={tooltip || "Unassigned"}
        onClick={onClick}
        className={`${sizeCls} ${ringCls} ${interactiveCls} ${className} inline-flex items-center justify-center rounded-full border border-dashed border-stone-300 text-stone-400`}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
          <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 8a7 7 0 1114 0H3z" />
        </svg>
      </div>
    );
  }

  const displayName = member?.name || name || "?";
  const seed = member?.clerk_user_id || clerkUserId || displayName;
  const color = member?.avatar_color || colorFromSeed(seed);
  const initials = initialsFromName(displayName);
  const finalTooltip = tooltip || `${displayName}${member?.role === "owner" ? " (Admin)" : ""}`;

  return (
    <div
      title={finalTooltip}
      onClick={onClick}
      className={`${sizeCls} ${ringCls} ${interactiveCls} ${className} inline-flex items-center justify-center rounded-full font-semibold text-white shadow-sm`}
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
};

export default MemberAvatar;
