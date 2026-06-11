/**
 * Per-user section permissions — the single source of truth for "which area of
 * the app does a path belong to, and where does that area land?".
 *
 * The admin grants a member a subset of these section keys via Team Settings;
 * the Sidebar / MobileDock hide everything else and AppLayout bounces direct
 * deep-links. Keep the keys in sync with TeamContext.ALL_SECTION_KEYS and the
 * BE NAV_SECTION_KEYS.
 *
 * NOTE: this is UX-level gating. The real data boundary (e.g. hiding a stone's
 * exact memo location) is enforced server-side in /api/soap-stones.
 */
export const PERMISSION_SECTIONS = [
  { key: "dashboard", label: "Dashboard", landing: "/dashboard", match: (p) => p === "/dashboard" },
  {
    key: "inventory",
    label: "Inventory",
    landing: "/inventory",
    match: (p) =>
      p.startsWith("/inventory") ||
      p === "/jewelry" ||
      p === "/jewelry/" ||
      p.startsWith("/jewelry/items") ||
      p === "/jewelry-items" ||
      p.startsWith("/jewelry-items/"),
  },
  {
    key: "jewelry",
    label: "Jewelry workshop",
    landing: "/jewelry/production",
    // Workshop surfaces only — the unified inventory grid lives under `inventory`.
    match: (p) => p.startsWith("/jewelry/") && !p.startsWith("/jewelry/items"),
  },
  { key: "crm", label: "CRM", landing: "/crm/contacts", match: (p) => p.startsWith("/crm") },
  { key: "sales", label: "Sales Inventory", landing: "/sales/emeralds", match: (p) => p.startsWith("/sales") },
  { key: "offers", label: "Offers", landing: "/offers", match: (p) => p.startsWith("/offers") },
  { key: "team", label: "Team", landing: "/team", match: (p) => p.startsWith("/team") },
  { key: "tools", label: "Data Quality", landing: "/qa-data", match: (p) => p === "/qa-data" || p === "/qa" },
];

// Which section does a path belong to (null when it maps to none — e.g. a
// shared sub-route we don't gate).
export const sectionForPath = (path) =>
  PERMISSION_SECTIONS.find((s) => s.match(path)) || null;

// First landing page the member is allowed to open (used for redirects). `can`
// is TeamContext's section predicate. Returns null when they have no access.
export const firstAllowedLanding = (can) => {
  const s = PERMISSION_SECTIONS.find((x) => can(x.key));
  return s ? s.landing : null;
};
