/* ============================================================================
 * Team management — shared constants & helpers.
 *
 * Pulled out of the page so the console (TeamSettings) and the per-member
 * detail panel (MemberDetail) share one source of truth for role labels,
 * permission options, money/time formatting, and activity-event rendering.
 * ========================================================================== */

/* ----------------------------------------------------------- Permissions */

// Per-user permissions, set by the admin. `sections` = which nav areas the
// member can open; `locationView` = how much stone-location detail they get.
// Keep keys in sync with TeamContext.ALL_SECTION_KEYS / BE NAV_SECTION_KEYS.
export const SECTION_OPTIONS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "inventory", label: "Inventory" },
  { key: "crm", label: "CRM" },
  { key: "sales", label: "Sales Inventory" },
  { key: "team", label: "Team" },
  { key: "tools", label: "Data Quality" },
];

// Stone-location visibility tiers, most → least detail. Enforced server-side
// in /api/soap-stones, so these must stay in sync with BE LOCATION_VIEWS.
export const LOCATION_VIEW_OPTIONS = [
  { value: "full", label: "Full", hint: "Exact location + holder + memo + branch" },
  { value: "memo_branch", label: "Memo + Branch", hint: "Branch + holder + memo status — no exact spot" },
  { value: "branch_only", label: "Branch only", hint: "Branch + memo/hold flags — no holder, no exact" },
  { value: "status_only", label: "Status only", hint: "Only \u201con memo / on hold\u201d flags — no branch" },
  { value: "hidden", label: "Hidden", hint: "No location info at all" },
];

export const LOCATION_VIEW_LABEL = {
  full: "Full location",
  memo_branch: "Memo + Branch",
  branch_only: "Branch only",
  status_only: "Status only",
  hidden: "Location hidden",
};

const LOCATION_VIEW_VALUES = LOCATION_VIEW_OPTIONS.map((o) => o.value);

export const DEFAULT_PERMS = { sections: ["sales"], locationView: "branch_only" };

// The backend mints a synthetic placeholder email for the owner row before a
// real Clerk address is known (e.g. "owner-user_3F8...@local"). It's not a real
// address and should never be shown to the team.
export const isPlaceholderEmail = (email) =>
  !email || /@local$/i.test(String(email).trim());

// A member's real email, or null when all we have is the internal placeholder.
export const cleanEmail = (member) =>
  isPlaceholderEmail(member?.email) ? null : member.email;

// Resolve a member's effective "see internal cost / margin" flag. Mirrors the
// BE rule: explicit boolean wins; absent => role default (manager yes, else no).
export const canViewCostOf = (m) => {
  const p = m?.permissions && typeof m.permissions === "object" ? m.permissions : {};
  if (typeof p.canViewCost === "boolean") return p.canViewCost;
  return isAdminRole(m?.role) || m?.role === "manager";
};

export const permsOf = (m) => {
  const p = m?.permissions && typeof m.permissions === "object" ? m.permissions : {};
  return {
    sections: Array.isArray(p.sections) ? p.sections : [...DEFAULT_PERMS.sections],
    locationView: LOCATION_VIEW_VALUES.includes(p.locationView)
      ? p.locationView
      : DEFAULT_PERMS.locationView,
    canViewCost: canViewCostOf(m),
  };
};

/* ----------------------------------------------------------------- Roles */

// Admin-tier roles (full access). 'owner' is the single workshop owner; 'admin'
// is a grantable equivalent — keep in sync with BE isAdminRole.
export const isAdminRole = (role) => role === "owner" || role === "admin";

export const roleLabelFor = (role) =>
  role === "owner"
    ? "Owner"
    : role === "admin"
    ? "Admin"
    : role === "manager"
    ? "Manager"
    : "Salesman";

// Roles an admin can assign through the UI. Owner is never assignable.
export const ASSIGNABLE_ROLES = [
  { value: "salesman", label: "Salesman" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin — full access" },
];

/* --------------------------------------------------------------- Format */

export const fmtMoney = (n, cur = "USD") => {
  const v = Number(n) || 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency: cur, maximumFractionDigits: 0,
    }).format(v);
  } catch { return `${cur} ${v.toLocaleString()}`; }
};

// "5 minutes ago" / "3 hours ago" / "2 days ago"
export const timeAgo = (iso) => {
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

// Compact relative time for dense feeds. "3 min ago" / "2 hr ago" / "Jun 14"
export const relTime = (iso) => {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/* ---------------------------------------------------------- Activity feed */

// Mirrors the labels used on the Sales dashboard so the two activity surfaces
// read the same way.
export const ACTIVITY_META = {
  session_start: { label: "Opened the app", chip: "bg-emerald-100 text-emerald-700" },
  session_end:   { label: "Left the app",   chip: "bg-stone-100 text-stone-600" },
  stone_view:    { label: "Viewed",         chip: "bg-cyan-100 text-cyan-700" },
  stone_dwell:   { label: "Studied",        chip: "bg-teal-100 text-teal-700" },
  category_view: { label: "Browsed",        chip: "bg-violet-100 text-violet-700" },
  search:        { label: "Searched",       chip: "bg-sky-100 text-sky-700" },
  filter_apply:  { label: "Filtered",       chip: "bg-amber-100 text-amber-700" },
  sort:          { label: "Sorted",         chip: "bg-indigo-100 text-indigo-700" },
  zero_results:  { label: "No results",     chip: "bg-stone-200 text-stone-700" },
  media_view:    { label: "Opened media",   chip: "bg-fuchsia-100 text-fuchsia-700" },
  price_view:    { label: "Viewed price",   chip: "bg-yellow-100 text-yellow-800" },
  export:        { label: "Exported",       chip: "bg-orange-100 text-orange-700" },
  denied:        { label: "Blocked",        chip: "bg-red-100 text-red-700" },
  share:         { label: "Shared",         chip: "bg-rose-100 text-rose-700" },
};

// "2m 5s" / "45s" / "1h 3m"
const fmtDuration = (ms) => {
  const s = Math.round((Number(ms) || 0) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return rs ? `${m}m ${rs}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
};

const PRETTY_MEDIA = { video_360: "360° video", certificate: "certificate", image: "photo" };
const PRETTY_EXPORT = {
  labels_print: "labels printed",
  label_print: "label printed",
  label_png: "label image",
  labels_png: "label images",
};

export const eventSummary = (ev) => {
  const meta = ev.meta || {};
  switch (ev.type) {
    case "stone_view":
    case "share":
      return ev.sku ? `${ev.sku}${ev.category ? ` · ${ev.category}` : ""}` : ev.category || "";
    case "stone_dwell":
      return `${ev.sku || ""}${meta.ms ? ` · ${fmtDuration(meta.ms)}` : ""}`;
    case "category_view":
      return ev.category || "";
    case "search":
      return meta.q ? `"${meta.q}"` : "";
    case "sort":
      return meta.sortBy || "";
    case "zero_results":
      return meta.q ? `"${meta.q}" · no matches` : "no matches";
    case "media_view":
      return `${ev.sku || ""}${meta.media ? ` · ${PRETTY_MEDIA[meta.media] || meta.media}` : ""}`;
    case "price_view":
      return `${ev.sku || ""}${meta.context === "cost" ? " · cost / margin" : ""}`;
    case "export":
      return `${meta.count ?? ""} ${PRETTY_EXPORT[meta.kind] || meta.kind || "items"}`.trim();
    case "session_end":
      return meta.ms ? `${fmtDuration(meta.ms)} in app` : "";
    case "denied":
      return `tried to open ${meta.resource || "a blocked area"}`;
    case "filter_apply": {
      const n = Array.isArray(meta.facets) ? meta.facets.length : 0;
      const head = n ? `${n} filter${n === 1 ? "" : "s"}` : "filtered";
      return `${head} · ${meta.results ?? "?"} results`;
    }
    default:
      return "";
  }
};

export const kindOf = (ev) => {
  const k = String(ev.kind || "").toLowerCase();
  if (k) return k;
  const c = String(ev.category || "").toLowerCase();
  if (c.includes("diamond") || c.includes("fancy")) return "diamond";
  if (c.includes("emerald")) return "emerald";
  if (c.includes("jewel")) return "jewelry";
  return "gemstone";
};

export const eventLink = (ev) => {
  if ((ev.type === "stone_view" || ev.type === "share") && ev.sku) {
    const sku = encodeURIComponent(ev.sku);
    return kindOf(ev) === "jewelry" ? `/sales/jewelry/${sku}` : `/sales/stone/${sku}`;
  }
  return null;
};
