import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchJewelryItem } from "../../../services/jewelryApi";
import { sanitizeText } from "../../../utils/helper";
import StatusBadge from "./StatusBadge";

/* Quick-look dialog for the Jewelry Inventory grid.
 *
 * Two flavors driven by item.__source:
 *   - 'workshop'  -> jewelry_items job: lazy-fetches /api/jewelry-items/:id
 *                    for stones/files/history, shows status + customer +
 *                    money + a "Open full page" CTA.
 *   - 'catalog'   -> jewelry_products row: pure read-only preview built from
 *                    the row already in memory, with a "Make from this
 *                    template" CTA that hops to the public DNA page (which
 *                    hosts the existing modal).
 *
 * Anything that requires more than a glance — editing, uploading, rich stone
 * management — is intentionally NOT here, only on the full detail page.
 */

const fmtMoney = (n, currency = "$") => {
  const v = Number(n);
  if (!v && v !== 0) return null;
  return `${currency}${Math.round(v).toLocaleString()}`;
};

const fmtDate = (d) => {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch (_) { return ""; }
};

const Section = ({ title, children, action }) => (
  <section>
    <div className="mb-2 flex items-baseline justify-between">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">{title}</h3>
      {action}
    </div>
    {children}
  </section>
);

const KV = ({ label, value, mono }) => (
  <div className="flex flex-col rounded-lg bg-stone-50 px-3 py-2">
    <span className="text-[10px] font-medium uppercase tracking-wider text-stone-400">{label}</span>
    <span className={`text-sm ${mono ? "font-mono" : ""} text-stone-800`}>
      {value === null || value === undefined || value === "" ? "—" : value}
    </span>
  </div>
);

/* =========================================================
   Workshop view (jewelry_items)
   ========================================================= */
const WorkshopBody = ({ baseItem }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchJewelryItem(baseItem.id)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((e) => { if (!cancelled) setError(e.message || "Failed to load"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [baseItem.id]);

  // Use the freshly fetched item if available, fall back to the card's data
  // so the dialog renders something useful before the network round-trip.
  const item = data?.item || baseItem;
  const stones = data?.stones || [];
  const files = data?.files || [];
  const history = data?.history || [];

  const stonesTotal = useMemo(() => {
    return stones.reduce((sum, s) => {
      const v = Number(s?.snapshot?.priceTotal || s?.snapshot?.price_total || 0);
      return sum + (isNaN(v) ? 0 : v);
    }, 0);
  }, [stones]);

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Header strip: image + title + customer + status */}
      <div className="flex gap-4">
        <div className="h-32 w-32 shrink-0 overflow-hidden rounded-xl bg-stone-100">
          {item.cover_image_url ? (
            <img src={item.cover_image_url} alt={item.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-stone-300">
              <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3l3.057-3 4.886 0L16 3l4 5-8 13L4 8l1-5z" />
              </svg>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-stone-900" title={item.name}>{item.name || "Untitled"}</h2>
            {item.status && <StatusBadge status={item.status} size="sm" />}
            {item.type === "stock" && (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-stone-700">Stock</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-500">
            <span className="font-mono">{item.sku || "—"}</span>
            {item.category && <span>· {item.category}</span>}
            {item.template_model_number && (
              <Link
                to={`/${item.template_model_number}`}
                onClick={(e) => e.stopPropagation()}
                className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100"
                title="View the catalog template this job was made from"
              >
                From {item.template_model_number}
              </Link>
            )}
          </div>
          {(item.contact_name || item.deal_title) && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {item.contact_id && (
                <Link
                  to={`/crm/customers/${item.contact_id}`}
                  className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-amber-700 hover:bg-amber-100"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  {item.contact_name}
                </Link>
              )}
              {item.deal_title && (
                <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-1 text-purple-700">
                  Deal: {item.deal_title}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Specs */}
      <Section title="Specs">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <KV label="Metal" value={item.metal_summary} />
          <KV label="Weight" value={item.weight_grams ? `${item.weight_grams} g` : null} />
          <KV label="Size" value={item.size} />
        </div>
      </Section>

      {/* Money */}
      {(item.total_cost || item.sale_price || item.markup_percent) && (
        <Section title="Money">
          <div className="grid grid-cols-3 gap-2">
            <KV label="Total cost" value={fmtMoney(item.total_cost)} />
            <KV label="Markup" value={item.markup_percent ? `${item.markup_percent}%` : null} />
            <KV label="Sale price" value={fmtMoney(item.sale_price)} />
          </div>
        </Section>
      )}

      {/* Stones */}
      <Section
        title={`Stones${stones.length ? ` · ${stones.length}` : ""}`}
        action={stones.length > 0 && stonesTotal > 0 && (
          <span className="text-xs font-medium text-stone-600">
            Total: <span className="text-emerald-700">{fmtMoney(stonesTotal)}</span>
          </span>
        )}
      >
        {loading && stones.length === 0 ? (
          <div className="text-xs text-stone-400">Loading…</div>
        ) : stones.length === 0 ? (
          <div className="rounded-md bg-stone-50 px-3 py-2 text-xs text-stone-400">No stones added yet.</div>
        ) : (
          <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white text-xs">
            {stones.slice(0, 6).map((s) => {
              const snap = s.snapshot || {};
              const carat = snap.weightCt || snap.weight_ct;
              const price = snap.priceTotal || snap.price_total;
              return (
                <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {s.stone_sku ? (
                        <Link
                          to={`/${s.stone_sku}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-emerald-700 hover:underline"
                        >
                          {s.stone_sku}
                        </Link>
                      ) : (
                        <span className="font-mono text-stone-500">no SKU</span>
                      )}
                      {s.role && <span className="text-stone-400">· {s.role}</span>}
                      {s.inventory_status && (
                        <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-stone-600">
                          {s.inventory_status}
                        </span>
                      )}
                    </div>
                    {(carat || snap.shape || snap.color) && (
                      <div className="mt-0.5 truncate text-[11px] text-stone-500">
                        {[carat ? `${carat} ct` : null, snap.shape, snap.color, snap.clarity].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 font-medium text-stone-700 tabular-nums">{fmtMoney(price) || "—"}</span>
                </li>
              );
            })}
            {stones.length > 6 && (
              <li className="px-3 py-2 text-center text-[11px] text-stone-400">+ {stones.length - 6} more</li>
            )}
          </ul>
        )}
      </Section>

      {/* Description */}
      {item.description && (
        <Section title="Description">
          <p className="whitespace-pre-line text-sm text-stone-700">{item.description}</p>
        </Section>
      )}

      {/* Files */}
      {files.length > 0 && (
        <Section title={`Files · ${files.length}`}>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {files.slice(0, 6).map((f) => (
              <a
                key={f.id}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="aspect-square overflow-hidden rounded-md bg-stone-100"
                title={f.filename || f.kind}
              >
                {f.mime_type?.startsWith("image/") ? (
                  <img src={f.url} alt={f.filename || ""} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] text-stone-500">{f.kind || "FILE"}</div>
                )}
              </a>
            ))}
          </div>
        </Section>
      )}

      {/* History */}
      {history.length > 0 && (
        <Section title="Recent activity">
          <ul className="space-y-1.5 text-xs">
            {history.slice(0, 4).map((h) => (
              <li key={h.id} className="flex items-baseline gap-2">
                <span className="text-stone-400">{fmtDate(h.changed_at)}</span>
                <span className="text-stone-700">
                  {h.from_status ? `${h.from_status} → ${h.to_status}` : h.to_status}
                </span>
                {h.notes && <span className="text-stone-500">· {h.notes}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
};

/* =========================================================
   Catalog view (jewelry_products)
   ========================================================= */
const CatalogBody = ({ item }) => {
  const raw = item.__raw || {};
  const allImages = (raw.all_pictures_link || "")
    .split(";")
    .map((u) => u.trim())
    .filter(Boolean);
  const [activeImage, setActiveImage] = useState(allImages[0] || item.cover_image_url || null);
  useEffect(() => {
    setActiveImage(allImages[0] || item.cover_image_url || null);
  }, [allImages, item.cover_image_url]);

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="grid gap-4 sm:grid-cols-[260px_1fr]">
        <div>
          <div className="aspect-square overflow-hidden rounded-xl bg-stone-100">
            {activeImage ? (
              <img src={activeImage} alt={item.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-stone-300">
                <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3l3.057-3 4.886 0L16 3l4 5-8 13L4 8l1-5z" />
                </svg>
              </div>
            )}
          </div>
          {allImages.length > 1 && (
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
              {allImages.slice(0, 8).map((img) => (
                <button
                  key={img}
                  type="button"
                  onClick={() => setActiveImage(img)}
                  className={`h-12 w-12 shrink-0 overflow-hidden rounded-md border-2 transition ${activeImage === img ? "border-emerald-500" : "border-transparent hover:border-stone-300"}`}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-700">
              Catalog
            </span>
            {raw.jewelry_type && (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-stone-700">{raw.jewelry_type}</span>
            )}
            {raw.collection && (
              <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-purple-700">{raw.collection}</span>
            )}
          </div>
          <h2 className="mt-1.5 text-lg font-semibold text-stone-900">{item.name || raw.title || raw.model_number}</h2>
          <div className="mt-1 flex items-center gap-2 text-xs text-stone-500">
            <span className="font-mono">{item.sku}</span>
            {raw.stock_number && <span>· Stock: {raw.stock_number}</span>}
          </div>
          {item.sale_price ? (
            <div className="mt-3 inline-flex items-baseline gap-1 rounded-lg bg-emerald-50 px-3 py-2">
              <span className="text-xs text-emerald-600">{raw.currency || "$"}</span>
              <span className="text-2xl font-bold text-emerald-700 tabular-nums">{Math.round(item.sale_price).toLocaleString()}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Center stone */}
      {(raw.stone_type || raw.center_stone_carat || raw.center_stone_shape) && (
        <Section title="Center stone">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <KV label="Type" value={(raw.stone_type || "").replace(/\s+O$/i, "").trim() || null} />
            <KV label="Carat" value={raw.center_stone_carat ? `${raw.center_stone_carat} ct` : null} />
            <KV label="Shape" value={raw.center_stone_shape} />
            <KV label="Color" value={raw.center_stone_color} />
            <KV label="Clarity" value={raw.center_stone_clarity} />
          </div>
        </Section>
      )}

      {/* General details */}
      <Section title="General">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <KV label="Metal" value={raw.metal_type} />
          <KV label="Style" value={raw.style} />
          <KV label="Jewelry weight" value={raw.jewelry_weight ? `${raw.jewelry_weight} g` : null} />
          <KV label="Total carat" value={raw.total_carat ? `${raw.total_carat} ct` : null} />
          <KV label="Size" value={raw.jewelry_size} />
          <KV label="Availability" value={raw.availability} />
        </div>
      </Section>

      {/* Certificate */}
      {(raw.certificate_link || raw.certificate_number) && (
        <Section title="Certificate">
          <div className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2 text-sm">
            <span className="text-stone-700">{raw.certificate_number || "—"}</span>
            {raw.certificate_link && (
              <a
                href={raw.certificate_link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-emerald-700 hover:underline"
              >
                Open ↗
              </a>
            )}
          </div>
        </Section>
      )}

      {/* Description — strip mojibake/replacement chars from the raw catalog
          row before showing. WooCommerce sometimes ships text with broken
          UTF-8 sequences (e.g. "style�a perfect"), so we never trust raw. */}
      {(() => {
        const desc = sanitizeText(raw.full_description || raw.description || "");
        if (!desc) return null;
        return (
          <Section title="Description">
            <p className="whitespace-pre-line text-sm text-stone-700">{desc}</p>
          </Section>
        );
      })()}
    </div>
  );
};

/* =========================================================
   Outer dialog shell + footer actions
   ========================================================= */
const JewelryItemDialog = ({ open, item, onClose }) => {
  // Lock background scroll while the dialog is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !item) return null;
  const isCatalog = item.__source === "catalog";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            {isCatalog ? "Catalog preview" : "Workshop job"}
          </span>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            title="Close (Esc)"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {isCatalog ? <CatalogBody item={item} /> : <WorkshopBody baseItem={item} />}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-200 bg-stone-50 px-5 py-3">
          {isCatalog ? (
            <Link
              to={`/${item.sku}`}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              View full DNA
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </Link>
          ) : (
            <Link
              to={`/jewelry/items/${item.id}`}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Open full page
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default JewelryItemDialog;
