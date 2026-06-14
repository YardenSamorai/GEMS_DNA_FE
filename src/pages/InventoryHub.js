import React from "react";

import StonesInventory from "./inventory"; // /pages/inventory/index.js — the stones grid

/* ============================================================================
 * Inventory — loose gemstones & diamonds.
 *
 * Previously a two-tab hub (Stones / Jewelry). The jewelry grid + workshop
 * surfaces were removed during the Production/Jewelry-catalog cleanup, so this
 * is now a thin wrapper around the stones inventory. Kept as its own component
 * (rather than routing straight to StonesInventory) so the /inventory entry
 * point stays stable and easy to extend again later.
 * ============================================================================ */

const InventoryHub = () => <StonesInventory />;

export default InventoryHub;
