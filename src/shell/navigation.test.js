import { NAV, visibleNav, flatItems, activeItem, activeChild, pageContext, mobileNav } from "./navigation";

const admin = { gated: false, can: () => true };
const member = (sections) => ({ gated: true, can: (k) => sections.includes(k) });
const ids = (nav) => flatItems(nav).map((it) => it.id);

describe("visibleNav", () => {
  it("shows everything to admins", () => {
    expect(ids(visibleNav(NAV, admin))).toEqual([
      "dashboard", "inventory", "sales", "crm", "photos", "quality", "api", "team",
    ]);
  });

  it("keeps only granted sections for gated members and drops empty groups", () => {
    const nav = visibleNav(NAV, member(["crm"]));
    expect(ids(nav)).toEqual(["crm"]);
    expect(nav.map((g) => g.id)).toEqual(["main"]);
  });

  it("grants API Access through either sales or inventory", () => {
    expect(ids(visibleNav(NAV, member(["inventory"])))).toEqual(["inventory", "api"]);
    expect(ids(visibleNav(NAV, member(["sales"])))).toEqual(["sales", "api"]);
    expect(ids(visibleNav(NAV, member(["photos"])))).toEqual(["photos"]);
  });

  it("maps Data Quality to the tools permission", () => {
    expect(ids(visibleNav(NAV, member(["tools"])))).toEqual(["quality"]);
  });
});

describe("activeItem", () => {
  const at = (p) => activeItem(NAV, p)?.id || null;

  it("matches each section", () => {
    expect(at("/dashboard")).toBe("dashboard");
    expect(at("/inventory")).toBe("inventory");
    expect(at("/sales/stone/T9616")).toBe("sales");
    expect(at("/crm/customers/12")).toBe("crm");
    expect(at("/photos/review")).toBe("photos");
    expect(at("/qa")).toBe("quality");
    expect(at("/api-access")).toBe("api");
    expect(at("/team")).toBe("team");
  });

  it("keeps Inventory lit on the legacy jewelry aliases only", () => {
    expect(at("/jewelry/items")).toBe("inventory");
    expect(at("/jewelry-items")).toBe("inventory");
    expect(at("/jewelry/R-100")).toBe(null);
  });

  it("does not match lookalike prefixes", () => {
    expect(at("/teamwork")).toBe(null);
    expect(at("/T9616")).toBe(null);
  });

  it("resolves the sales child", () => {
    const sales = NAV[0].items.find((it) => it.id === "sales");
    expect(activeChild(sales, "/sales/inventory")?.id).toBe("gemstones");
    expect(activeChild(sales, "/sales/jewelry/R-1")?.id).toBe("jewelry");
    expect(activeChild(sales, "/sales/dashboard")).toBe(null);
  });
});

describe("pageContext", () => {
  const labels = (p) => pageContext(p).crumbs.map((c) => c.label);

  it("builds breadcrumbs", () => {
    expect(labels("/dashboard")).toEqual(["Dashboard"]);
    expect(labels("/sales/diamonds")).toEqual(["Sales Inventory", "Diamonds"]);
    expect(labels("/sales/stone/T9616")).toEqual(["Sales Inventory", "T9616"]);
    expect(labels("/crm/deals")).toEqual(["CRM", "Deals"]);
    expect(labels("/crm/customers/7")).toEqual(["CRM", "Customer"]);
    expect(labels("/photos/review")).toEqual(["Photo Station", "Review"]);
    expect(labels("/team/")).toEqual(["Team"]);
    expect(labels("/nowhere")).toEqual([]);
  });

  it("links the parent crumb and leaves the current page plain", () => {
    const { crumbs } = pageContext("/crm/tasks");
    expect(crumbs[0].to).toBe("/crm/contacts");
    expect(crumbs[1].to).toBeUndefined();
  });

  it("supplies the heading only for catalog pages without their own", () => {
    expect(pageContext("/sales/emeralds").heading).toBe(true);
    expect(pageContext("/sales/stone/T1").heading).toBe(false);
    expect(pageContext("/inventory").heading).toBe(false);
  });
});

describe("mobileNav", () => {
  it("gives admins the four primary tabs and the workspace in More", () => {
    const { tabs, more } = mobileNav(NAV, "/dashboard", admin);
    expect(tabs.map((t) => t.label)).toEqual(["Dashboard", "Inventory", "Sales", "CRM"]);
    expect(tabs.find((t) => t.id === "sales").to).toBe("/sales/emeralds");
    expect(ids(more)).toEqual(["photos", "quality", "api", "team"]);
  });

  it("switches to category tabs inside the sales catalog", () => {
    const { tabs, more, inSales } = mobileNav(NAV, "/sales/diamonds", admin);
    expect(inSales).toBe(true);
    expect(tabs.map((t) => t.id)).toEqual(["sales-home", "diamonds", "emeralds", "gemstones", "jewelry"]);
    expect(ids(more)).toEqual(["dashboard", "inventory", "crm", "photos", "quality", "api", "team"]);
  });

  it("adds Photos as a tab for gated members who have it", () => {
    const { tabs, more } = mobileNav(NAV, "/photos", member(["photos"]));
    expect(tabs.map((t) => t.id)).toEqual(["photos"]);
    expect(more).toEqual([]);
  });

  it("hides sales category tabs from members without sales", () => {
    const { tabs } = mobileNav(NAV, "/sales/diamonds", member(["crm"]));
    expect(tabs).toEqual([]);
  });
});
