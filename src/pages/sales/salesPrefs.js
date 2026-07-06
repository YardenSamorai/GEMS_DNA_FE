/* Personal, device-local display preferences for the sales catalogs.
 * Set from the Sales Dashboard's Settings tab; read by the catalog pages on
 * mount. Stored in localStorage so the choice survives app restarts. */

const CATALOG_VIEW_KEY = "sales.catalogView"; // 'grid' | 'rows'

export const getCatalogView = () => {
  try {
    return localStorage.getItem(CATALOG_VIEW_KEY) === "rows" ? "rows" : "grid";
  } catch {
    return "grid";
  }
};

export const setCatalogView = (view) => {
  try {
    localStorage.setItem(CATALOG_VIEW_KEY, view === "rows" ? "rows" : "grid");
  } catch {
    /* storage unavailable — preference just won't persist */
  }
};
