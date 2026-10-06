/* Navigation model for the app shell — one source for the Sidebar, the
 * TopBar breadcrumb and the mobile tab bar. Pure data + functions; icons are
 * referenced by key (see shell/icons.js) so this stays testable. */

const JEWELRY_ALIASES = ["/jewelry", "/jewelry/", "/jewelry/items", "/jewelry-items"];

const under = (base) => (p) => p === base || p.startsWith(`${base}/`);

export const SALES_CHILDREN = [
  { id: "diamonds", label: "Diamonds", to: "/sales/diamonds", match: under("/sales/diamonds") },
  { id: "emeralds", label: "Emeralds", to: "/sales/emeralds", match: under("/sales/emeralds") },
  {
    id: "gemstones",
    label: "Gemstones",
    to: "/sales/gemstones",
    match: (p) => under("/sales/gemstones")(p) || under("/sales/inventory")(p),
  },
  { id: "jewelry", label: "Jewelry", to: "/sales/jewelry", match: under("/sales/jewelry") },
];

// `section` is the permission key (utils/permissions); `anyOf` grants the item
// when the member holds any of the listed sections.
export const NAV = [
  {
    id: "main",
    items: [
      { id: "dashboard", label: "Dashboard", to: "/dashboard", icon: "dashboard", section: "dashboard", match: under("/dashboard") },
      {
        id: "inventory",
        label: "Inventory",
        to: "/inventory",
        icon: "inventory",
        section: "inventory",
        match: (p) => under("/inventory")(p) || JEWELRY_ALIASES.includes(p),
      },
      {
        id: "sales",
        label: "Sales Inventory",
        shortLabel: "Sales",
        to: "/sales/diamonds",
        // The phone tab bar has always opened the catalog on Emeralds.
        mobileTo: "/sales/emeralds",
        icon: "sales",
        section: "sales",
        match: under("/sales"),
        children: SALES_CHILDREN,
      },
      { id: "crm", label: "CRM", to: "/crm/contacts", icon: "crm", section: "crm", match: under("/crm") },
    ],
  },
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { id: "photos", label: "Photo Station", shortLabel: "Photos", to: "/photos", icon: "photos", section: "photos", match: under("/photos") },
      {
        id: "quality",
        label: "Data Quality",
        to: "/qa-data",
        icon: "quality",
        section: "tools",
        match: (p) => p === "/qa-data" || p === "/qa",
      },
      { id: "api", label: "API Access", to: "/api-access", icon: "api", anyOf: ["sales", "inventory"], match: under("/api-access") },
      { id: "team", label: "Team", to: "/team", icon: "team", section: "team", match: under("/team") },
    ],
  },
];

/* Admins see everything; gated members only what they were granted. */
export const canSee = (item, { gated, can }) => {
  if (!gated) return true;
  if (item.anyOf) return item.anyOf.some((k) => can(k));
  return !item.section || can(item.section);
};

export const visibleNav = (nav, access) =>
  nav
    .map((g) => ({ ...g, items: g.items.filter((it) => canSee(it, access)) }))
    .filter((g) => g.items.length > 0);

export const flatItems = (nav) => nav.flatMap((g) => g.items);

export const activeItem = (nav, path) => flatItems(nav).find((it) => it.match(path)) || null;

export const activeChild = (item, path) => (item?.children || []).find((c) => c.match(path)) || null;

/* ---------------------------------------------------------------- breadcrumb */

const CRM_PAGES = {
  contacts: "Contacts",
  customers: "Customer",
  deals: "Deals",
  tasks: "Tasks",
  stores: "Stores",
  memos: "Memos",
  documents: "Documents",
  catalog: "Catalog",
  settings: "Settings",
};

const CATALOG_PATHS = ["/sales/diamonds", "/sales/emeralds", "/sales/gemstones", "/sales/inventory", "/sales/jewelry"];

/* Returns { crumbs: [{ label, to? }], heading } — the last crumb is the
 * current page. `heading` marks pages that have no <h1> of their own, so the
 * top bar supplies it. */
export const pageContext = (path) => {
  const p = path.length > 1 ? path.replace(/\/+$/, "") : path;
  const item = activeItem(NAV, p);
  if (!item) return { crumbs: [], heading: false };
  const parent = { label: item.label, to: item.to };

  if (item.id === "sales") {
    const m = p.match(/^\/sales\/(stone|jewelry)\/([^/]+)$/);
    if (m) return { crumbs: [parent, { label: decodeURIComponent(m[2]) }], heading: false };
    if (p === "/sales/dashboard") return { crumbs: [parent, { label: "Home" }], heading: false };
    const child = activeChild(item, p);
    return {
      crumbs: child ? [parent, { label: child.label }] : [{ label: item.label }],
      heading: CATALOG_PATHS.includes(p),
    };
  }
  if (item.id === "crm") {
    const seg = p.split("/")[2];
    return { crumbs: CRM_PAGES[seg] ? [parent, { label: CRM_PAGES[seg] }] : [{ label: item.label }], heading: false };
  }
  if (item.id === "photos" && p === "/photos/review") {
    return { crumbs: [parent, { label: "Review" }], heading: false };
  }
  return { crumbs: [{ label: item.label }], heading: false };
};

/* ---------------------------------------------------------------- phone tabs */

// While browsing the sales catalog the phone tab bar swaps to category tabs.
export const SALES_TABS = [
  { id: "sales-home", label: "Home", to: "/sales/dashboard", icon: "salesHome", section: "sales", match: under("/sales/dashboard") },
  { id: "diamonds", label: "Diamonds", to: "/sales/diamonds", icon: "diamond", section: "sales", match: under("/sales/diamonds") },
  { id: "emeralds", label: "Emeralds", to: "/sales/emeralds", icon: "emerald", section: "sales", match: under("/sales/emeralds") },
  {
    id: "gemstones",
    label: "Gemstones",
    to: "/sales/inventory",
    icon: "gemstone",
    section: "sales",
    match: (p) => under("/sales/inventory")(p) || under("/sales/gemstones")(p),
  },
  { id: "jewelry", label: "Jewelry", to: "/sales/jewelry", icon: "jewelry", section: "sales", match: under("/sales/jewelry") },
];

const PRIMARY_TAB_IDS = ["dashboard", "inventory", "sales", "crm"];

/* Tabs for the phone bar (the "More" tab is added by the view) and the
 * entries that go into the More sheet. */
export const mobileNav = (nav, path, access) => {
  const visible = visibleNav(nav, access);
  const items = flatItems(visible);
  const inSales = under("/sales")(path);

  let tabs;
  if (inSales) {
    tabs = SALES_TABS.filter((t) => canSee(t, access));
  } else {
    tabs = PRIMARY_TAB_IDS.map((id) => items.find((it) => it.id === id))
      .filter(Boolean)
      .map((it) => ({ ...it, label: it.shortLabel || it.label, to: it.mobileTo || it.to }));
    // Office staff who only photograph stones get the station as a tab.
    const photos = items.find((it) => it.id === "photos");
    if (access.gated && photos) tabs.push({ ...photos, label: photos.shortLabel || photos.label });
  }

  const taken = new Set(inSales ? ["sales"] : tabs.map((t) => t.id));
  const more = visible
    .map((g) => ({ ...g, items: g.items.filter((it) => !taken.has(it.id)) }))
    .filter((g) => g.items.length > 0);

  return { tabs, more, inSales };
};
