// Helpers for turning a CRM contact's raw interaction + deal stream into a
// clean "Interested in" feed for the UI. Every "I'm interested" click on a
// public DNA page creates:
//   - one new crm_deals row    (title "DNA inquiry · {sku}", notes = message)
//   - one new crm_deal_items row with the full stone snapshot
//   - one new crm_interactions row (type 'dna_inquiry', metadata.snapshot)
// crm_contacts.dna_sku only ever stores the *first* SKU the visitor clicked,
// so it can't be the source of truth here — the interactions array is.
//
// All functions in this file are pure (no React, no fetch). Easy to unit-
// test and cheap for pages that don't render the block.

const STONE_CATEGORIES = new Set([
  // Anything that looks like a coloured stone or diamond. Used to decide
  // whether the public DNA URL is "/SKU" (stone page) or "/jewelry/SKU"
  // (jewelry page). When in doubt we fall back to the stone path because
  // that's where ~95% of inquiries come from in production.
  "diamond", "sapphire", "ruby", "emerald", "spinel", "tanzanite",
  "tourmaline", "aquamarine", "garnet", "topaz", "opal", "pearl",
  "alexandrite", "paraiba", "morganite", "tsavorite", "peridot",
  "amethyst", "citrine", "zircon", "kunzite", "quartz",
]);

const JEWELRY_CATEGORIES = new Set([
  "ring", "rings", "necklace", "necklaces", "pendant", "pendants",
  "earring", "earrings", "bracelet", "bracelets", "bangle", "bangles",
  "brooch", "set", "sets", "jewelry", "jewellery",
]);

/**
 * Build a public DNA URL for an inquiry, given its sku + snapshot category.
 * We can't tell stone-vs-jewelry from the SKU alone, so we sniff the
 * snapshot category. Default = stone path.
 */
function dnaUrlForSnapshot(sku, snapshot) {
  const cat = String(snapshot?.category || "").trim().toLowerCase();
  if (JEWELRY_CATEGORIES.has(cat)) return `/jewelry/${sku}`;
  // STONE_CATEGORIES covers the named coloured stones; "diamond" itself is
  // there. If the category is empty or anything we don't recognise we treat
  // it as a stone (true for ~95% of dna-lead inquiries in production).
  return `/${sku}`;
}

/**
 * Strip the synthetic lines `Stone: SKU` / `IP: x.x.x.x` that the backend
 * appends to the dna_inquiry interaction `content`. Returns the visitor's
 * own message (or empty string if they didn't include one).
 */
function extractMessageFromInteractionContent(content) {
  if (!content) return "";
  return String(content)
    .split("\n")
    .filter((line) => {
      const l = line.trim();
      if (!l) return false;
      if (/^stone\s*:/i.test(l)) return false;
      if (/^ip\s*:/i.test(l)) return false;
      return true;
    })
    .join("\n")
    .trim();
}

/**
 * Decide whether a contact has any DNA-origin signal we can show. Used to
 * gate the block in ContactDrawer / CustomerProfile so we don't render an
 * empty box for non-DNA contacts.
 */
export function hasDnaInquiries(contact) {
  if (!contact) return false;
  if (contact.source === "dna_lead") return true;
  if (contact.dna_sku) return true;
  const interactions = Array.isArray(contact.interactions) ? contact.interactions : [];
  return interactions.some((i) => i?.type === "dna_inquiry");
}

/**
 * Build the deduplicated, latest-first feed of stones the contact has
 * expressed interest in.
 *
 * @param {object} contact  Output of fetchContact(): { interactions, deals, dna_sku, ... }
 * @returns {Array} rows in display order. Each row:
 *   {
 *     sku, snapshot, firstAt, latestAt, inquiryCount,
 *     latestMessage, latestDealId, latestInteractionId,
 *     stoneUrl, allOccurrences: [{occurred_at, dealId, message}]
 *   }
 */
export function extractDnaInquiries(contact) {
  if (!contact) return [];

  const interactions = Array.isArray(contact.interactions) ? contact.interactions : [];
  const deals = Array.isArray(contact.deals) ? contact.deals : [];

  // Index deals by id so we can pull the visitor's message (which lives on
  // deals.notes, not on the interaction itself) per occurrence.
  const dealById = new Map();
  for (const d of deals) {
    if (d?.id != null) dealById.set(String(d.id), d);
  }

  const groups = new Map(); // sku -> aggregate row

  const dnaInteractions = interactions.filter((i) => i?.type === "dna_inquiry");

  for (const i of dnaInteractions) {
    // Backend stores metadata as JSONB and the pg driver typically parses
    // it for us, but be defensive in case some row arrives as a string.
    let meta = i.metadata;
    if (typeof meta === "string") {
      try { meta = JSON.parse(meta); } catch (_) { meta = {}; }
    }
    const sku = String(meta?.sku || "").trim();
    if (!sku) continue;

    const snapshot = meta?.snapshot && typeof meta.snapshot === "object" ? meta.snapshot : {};
    const occurredAt = i.occurred_at || i.created_at || null;
    const deal = i.deal_id != null ? dealById.get(String(i.deal_id)) : null;
    const message = deal?.notes
      ? String(deal.notes).trim()
      : extractMessageFromInteractionContent(i.content);

    const occurrence = {
      occurredAt,
      dealId: i.deal_id ?? null,
      interactionId: i.id ?? null,
      message,
    };

    const existing = groups.get(sku);
    if (!existing) {
      groups.set(sku, {
        sku,
        snapshot,
        firstAt: occurredAt,
        latestAt: occurredAt,
        inquiryCount: 1,
        latestMessage: message,
        latestDealId: i.deal_id ?? null,
        latestInteractionId: i.id ?? null,
        stoneUrl: dnaUrlForSnapshot(sku, snapshot),
        allOccurrences: [occurrence],
      });
    } else {
      existing.inquiryCount += 1;
      existing.allOccurrences.push(occurrence);
      // Newer wins for "latest" fields; older wins for firstAt.
      if (!existing.latestAt || (occurredAt && new Date(occurredAt) > new Date(existing.latestAt))) {
        existing.latestAt = occurredAt;
        existing.latestMessage = message;
        existing.latestDealId = i.deal_id ?? null;
        existing.latestInteractionId = i.id ?? null;
        // Prefer the snapshot from the most recent inquiry — image / price
        // could have been refreshed by the BE since the first click.
        if (snapshot && Object.keys(snapshot).length > 0) {
          existing.snapshot = snapshot;
          existing.stoneUrl = dnaUrlForSnapshot(sku, snapshot);
        }
      }
      if (!existing.firstAt || (occurredAt && new Date(occurredAt) < new Date(existing.firstAt))) {
        existing.firstAt = occurredAt;
      }
    }
  }

  // Fallback: legacy contacts where the dna_inquiry interaction was never
  // logged (e.g. data created before the interaction-write was added). The
  // contact row still carries dna_sku → render a single, minimal card so
  // sales reps see *something*.
  if (groups.size === 0 && contact.dna_sku) {
    const sku = String(contact.dna_sku).trim();
    groups.set(sku, {
      sku,
      snapshot: {},
      firstAt: contact.created_at || null,
      latestAt: contact.last_contact_at || contact.created_at || null,
      inquiryCount: 1,
      latestMessage: "",
      latestDealId: deals[0]?.id ?? null,
      latestInteractionId: null,
      stoneUrl: `/${sku}`,
      allOccurrences: [{
        occurredAt: contact.created_at || null,
        dealId: deals[0]?.id ?? null,
        interactionId: null,
        message: "",
      }],
    });
  }

  // Latest-first display order.
  return Array.from(groups.values()).sort((a, b) => {
    const at = a.latestAt ? new Date(a.latestAt).getTime() : 0;
    const bt = b.latestAt ? new Date(b.latestAt).getTime() : 0;
    return bt - at;
  });
}

/**
 * Human-friendly relative time ("just now", "5m ago", "3d ago", "2 weeks
 * ago"). Slightly more granular at the top end than the existing timeAgo
 * helpers because the "Interested 38 days ago" → call them today narrative
 * is exactly the use case for this block.
 */
export function relativeTime(dateLike) {
  if (!dateLike) return "";
  const ts = new Date(dateLike).getTime();
  if (Number.isNaN(ts)) return "";
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  if (d < 14) return `${d}d ago`;
  if (d < 60) return `${Math.floor(d / 7)}w ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

/**
 * Compact, scannable one-line spec built from a stone snapshot — used in
 * the sub-title of every inquiry card. Returns "" when there's nothing
 * meaningful to print, so the caller can gate display.
 *
 *   "1.52ct · Round · D / IF · GIA"
 *   "3.05ct · Cushion · Royal Blue · Heated · GRS"
 */
export function summariseSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return "";
  const parts = [];
  const w = snapshot.weightCt ?? snapshot.weight ?? snapshot.carat ?? snapshot.weight_ct;
  if (w != null && String(w).trim() !== "") {
    const n = Number(w);
    if (!Number.isNaN(n) && n > 0) parts.push(`${n.toFixed(2)}ct`);
  }
  if (snapshot.shape) parts.push(String(snapshot.shape));
  // For diamonds: color + clarity; for coloured stones: just colour.
  const colour = snapshot.color || snapshot.colorName || snapshot.fancyColor;
  if (colour) parts.push(String(colour));
  if (snapshot.clarity && String(snapshot.clarity).toUpperCase() !== "N/A") {
    parts.push(String(snapshot.clarity));
  }
  if (snapshot.treatment && String(snapshot.treatment).toLowerCase() !== "no oil") {
    parts.push(String(snapshot.treatment));
  }
  if (snapshot.lab && String(snapshot.lab).toUpperCase() !== "N/A") {
    parts.push(String(snapshot.lab));
  }
  return parts.join(" · ");
}
