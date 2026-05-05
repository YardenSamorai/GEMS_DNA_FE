/* ============================================================================
 * Activity log helpers (Sprint 2 / Phase 2)
 *
 * Shared between:
 *   - OverviewTab "What just happened" feed
 *   - Per-entity timelines (Phase 3): Customer profile, Deal drawer,
 *     Jewelry item detail, DNA card
 *
 * Activity rows from /api/activity (and from /api/dashboard/overview's
 * `activity` block) carry a flat schema:
 *   { id, entity_type, entity_id, action, summary, changes, related, occurred_at }
 *
 * The FE turns each row into a clickable backlink using `entityToLink`,
 * and renders a coloured chip via `activityIconMeta`.
 * ============================================================================ */

/**
 * Map an activity entity (or any { type, id } pair) to the canonical FE URL
 * for that resource. Returns null if we don't know how to link it — callers
 * should render the row as inert text in that case.
 */
export const entityToLink = (entityType, entityId) => {
  if (!entityType || entityId == null) return null;
  switch (entityType) {
    case 'contact':
      // 'bulk' is the synthetic id used by bulk-delete / bulk-tag rows.
      // There's no single contact to drill into, so send the user to the list.
      if (entityId === 'bulk') return '/crm/contacts';
      return `/crm/customers/${entityId}`;
    case 'deal':
      // Deals don't have a dedicated detail page yet; the deals tab opens the
      // matching drawer when ?dealId= is present.
      return `/crm/deals?dealId=${entityId}`;
    case 'jewelry_item':
      return `/jewelry/items/${entityId}`;
    case 'stone':
      // entity_id for stones is the SKU (TEXT). Public DNA card lives at /:sku.
      return `/${entityId}`;
    case 'task':
      return `/crm/tasks?taskId=${entityId}`;
    case 'interaction':
      // Interactions don't have their own page — surface the contact instead
      // when we have a related contact id from the backlinks.
      return null;
    case 'invoice':
      return `/crm/customers?invoiceId=${entityId}`;
    case 'folder':
      return `/crm/contacts?folder=${entityId}`;
    default:
      return null;
  }
};

/**
 * Resolve the best link for an activity row. Prefers the row's own entity,
 * then walks `related` for the first known target (useful for interactions,
 * which always have a related contact but no page of their own).
 */
export const activityRowLink = (row) => {
  if (!row) return null;
  const direct = entityToLink(row.entity_type, row.entity_id);
  if (direct) return direct;
  if (Array.isArray(row.related)) {
    for (const r of row.related) {
      const fallback = entityToLink(r?.type, r?.id);
      if (fallback) return fallback;
    }
  }
  return null;
};

/**
 * Returns { color, letter } for the activity-row avatar chip. Falls back to
 * a neutral chip when entity_type is unknown so the UI never breaks.
 */
export const activityIconMeta = (entityType, action) => {
  // Strong signals come from the action ('sold', 'completed', 'deleted'),
  // weaker but always-present signals from the entity_type. Action wins.
  switch (action) {
    case 'sold':         return { color: 'bg-amber-500',   letter: '$' };
    case 'completed':    return { color: 'bg-emerald-500', letter: '✓' };
    case 'deleted':
    case 'bulk_deleted': return { color: 'bg-stone-500',   letter: '×' };
    case 'stage_changed':return { color: 'bg-emerald-500', letter: '→' };
    case 'status_changed':return { color: 'bg-violet-500', letter: '→' };
    case 'created':
      switch (entityType) {
        case 'contact':      return { color: 'bg-sky-500',    letter: 'C' };
        case 'deal':         return { color: 'bg-emerald-500',letter: 'D' };
        case 'jewelry_item': return { color: 'bg-violet-500', letter: 'J' };
        case 'task':         return { color: 'bg-amber-500',  letter: 'T' };
        case 'interaction':  return { color: 'bg-rose-500',   letter: 'I' };
        default:             return { color: 'bg-stone-400',  letter: '+' };
      }
    default:
      switch (entityType) {
        case 'contact':      return { color: 'bg-sky-500',    letter: 'C' };
        case 'deal':         return { color: 'bg-emerald-500',letter: 'D' };
        case 'jewelry_item': return { color: 'bg-violet-500', letter: 'J' };
        case 'task':         return { color: 'bg-amber-500',  letter: 'T' };
        case 'interaction':  return { color: 'bg-rose-500',   letter: 'I' };
        case 'stone':        return { color: 'bg-cyan-500',   letter: 'S' };
        default:             return { color: 'bg-stone-400',  letter: '·' };
      }
  }
};

/**
 * Lightweight relative-time formatter. Same look as the rest of the app
 * (matches the OverviewTab and TopBar feeds).
 */
export const timeAgo = (iso) => {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800)return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
};
