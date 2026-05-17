import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import {
  fetchPortalCatalog,
  createMemoRequest,
  fetchPortalItemDetail,
} from "../../services/portalApi";
import { useRequestBasket } from "./RequestBasketContext";

/**
 * StorePortalCatalog — premium "browse-and-request" surface.
 *
 *   - Tabbed (All / Stones / Jewelry) with live count chips.
 *   - Search + shape pill filters (stones).
 *   - Card grid with imagery, key specs, "Add to request" toggle.
 *   - Floating bottom-right basket dock that expands into a panel
 *     where the user can write a free-text note + submit.
 *
 * Pricing is intentionally absent — the value prop is "browse our
 * available pieces and ask for a memo on what you like". Pricing
 * is established by the supplier when they convert the request.
 */
export default function StorePortalCatalog() {
  const { user } = useUser();
  const navigate = useNavigate();
  const basket = useRequestBasket();

  const [tab, setTab]         = useState("all");
  const [search, setSearch]   = useState("");
  const [shape, setShape]     = useState("");
  const [data, setData]       = useState({ stones: [], jewelry: [] });
  const [loading, setLoading] = useState(true);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState(null); // catalog card the user clicked

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    setLoading(true);
    fetchPortalCatalog(user.id, { type: tab, search, shape })
      .then((d) => alive && setData({
        stones: d.stones || [],
        jewelry: d.jewelry || [],
        diagnostic: d._diagnostic || null,
      }))
      .catch((e) => alive && toast.error(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [user?.id, tab, search, shape]);

  const all = useMemo(() => {
    if (tab === "stones")  return data.stones;
    if (tab === "jewelry") return data.jewelry;
    return [...data.stones, ...data.jewelry];
  }, [tab, data]);

  const allShapes = useMemo(() => {
    const set = new Set();
    data.stones.forEach((s) => s.shape && set.add(s.shape));
    return Array.from(set).slice(0, 14);
  }, [data.stones]);

  return (
    <div className="space-y-10 sm:space-y-12 pb-32">
      <CatalogHero
        stoneCount={data.stones.length}
        jewelryCount={data.jewelry.length}
        loading={loading}
      />

      <section className="bg-portal-canvas border border-portal-line">
        {/* Tabs — letter-spaced labels, single champagne underbar on active. */}
        <div className="border-b border-portal-line px-5 sm:px-8 flex items-center gap-7 sm:gap-9 overflow-x-auto scrollbar-hide">
          {[
            { id: "all",     label: "All",     count: data.stones.length + data.jewelry.length },
            { id: "stones",  label: "Stones",  count: data.stones.length },
            { id: "jewelry", label: "Jewelry", count: data.jewelry.length },
          ].map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative py-4 sm:py-5 text-[11px] sm:text-[12px] tracking-[0.24em] uppercase whitespace-nowrap transition-colors flex items-baseline gap-2 ${
                  active ? "text-portal-ink" : "text-portal-muted hover:text-portal-ink"
                }`}
              >
                <span className="font-medium">{t.label}</span>
                <span className="text-[10px] tracking-normal tabular-nums text-portal-soft">{t.count}</span>
                {active && <span className="absolute left-0 right-0 -bottom-px h-px bg-portal-champagne" />}
              </button>
            );
          })}
        </div>

        {/* Search + shape filters — quiet hairline input, no rounded chips. */}
        <div className="px-5 sm:px-8 py-5 border-b border-portal-line flex flex-col gap-4">
          <div className="relative max-w-md">
            <svg className="w-3.5 h-3.5 absolute left-0 top-1/2 -translate-y-1/2 text-portal-soft pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-4.35-4.35m1.85-5.65a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by SKU, shape, colour"
              className="w-full pl-6 pr-3 py-2.5 text-[13px] bg-transparent border-b border-portal-line2 focus:outline-none focus:border-portal-ink placeholder:text-portal-soft text-portal-ink tracking-wide"
            />
          </div>
          {(tab === "all" || tab === "stones") && allShapes.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 scrollbar-hide">
              <ShapePill label="All shapes" active={!shape} onClick={() => setShape("")} />
              {allShapes.map((s) => (
                <ShapePill key={s} label={s} active={shape.toLowerCase() === s.toLowerCase()} onClick={() => setShape(s)} />
              ))}
            </div>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <SkeletonGrid />
        ) : all.length === 0 ? (
          <EmptyCatalog />
        ) : (
          <div className="p-5 sm:p-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 sm:gap-x-6 gap-y-8 sm:gap-y-10">
            {all.map((it) => (
              <CatalogCard
                key={`${it.kind}-${it.sku || it.id}`}
                item={it}
                basket={basket}
                onPreview={() => setPreviewItem(it)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Floating basket dock */}
      <BasketDock onOpen={() => setSubmitOpen(true)} />
      {submitOpen && (
        <SubmitRequestModal
          onClose={() => setSubmitOpen(false)}
          onSubmitted={(req) => {
            setSubmitOpen(false);
            basket.clear();
            navigate(`/store-portal/requests`);
          }}
        />
      )}
      {previewItem && (
        <CatalogItemDialog
          item={previewItem}
          basket={basket}
          onClose={() => setPreviewItem(null)}
        />
      )}
    </div>
  );
}

/* ============================================================
   Hero — editorial, restrained. Champagne eyebrow, Cormorant
   display title, live inventory counts to the right. Zero
   gradients, zero saturated colour.
   ============================================================ */
function CatalogHero({ stoneCount = 0, jewelryCount = 0, loading = false }) {
  return (
    <section className="border-t border-portal-champagne/60">
      <div className="pt-8 sm:pt-12 pb-2 sm:pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-8">
        <div className="max-w-xl">
          <div className="text-[10px] tracking-[0.32em] uppercase text-portal-champagne font-medium mb-4">
            Inventory
          </div>
          <h1 className="font-serif-display text-[34px] sm:text-[44px] leading-[1.05] text-portal-ink tracking-tight">
            Available pieces for memo
          </h1>
          <p className="mt-5 text-[13.5px] sm:text-[14px] leading-relaxed text-portal-graphite max-w-md">
            Stones and finished jewellery currently free from prior commitment.
            Mark a selection — your supplier reviews availability and issues
            the memo on your behalf.
          </p>
        </div>
        <dl className="hidden sm:flex items-end gap-7">
          <InventoryCount label="Stones"  value={stoneCount}   loading={loading} />
          <span className="h-12 w-px bg-portal-line2 mb-1.5" aria-hidden />
          <InventoryCount label="Jewelry" value={jewelryCount} loading={loading} />
        </dl>
      </div>
    </section>
  );
}

function InventoryCount({ label, value, loading }) {
  return (
    <div className="text-right">
      <dd className="font-serif-display text-[34px] leading-none tabular-nums text-portal-ink">
        {loading ? <span className="inline-block w-9 h-7 bg-portal-pearl" /> : value}
      </dd>
      <dt className="text-[10px] tracking-[0.28em] uppercase text-portal-soft mt-2 font-medium">
        {label}
      </dt>
    </div>
  );
}

/* ============================================================
   Card — image-led, restrained editorial treatment.
     · Square image with a soft pearl placeholder backdrop.
     · Plain text "Stone / Jewelry" eyebrow (no coloured chip).
     · Hover reveals "View" affordance over a graphite scrim.
     · Selected state: thin champagne hairline + corner mark.
     · CTA: text-only outline button, ink-on-bone, no fill colour.
   ============================================================ */
function CatalogCard({ item, basket, onPreview }) {
  const inBasket = basket.has(item);
  const title = item.kind === "jewelry"
    ? (item.name || item.sku)
    : `${item.shape || item.category || "Stone"}${item.weightCt ? ` · ${item.weightCt} ct` : ""}`;
  const sub = item.kind === "jewelry"
    ? [item.metalType, item.metalColor].filter(Boolean).join(" · ") || item.category
    : [item.color, item.clarity, item.origin].filter(Boolean).join(" · ");

  return (
    <article className={`group relative bg-portal-canvas transition-colors ${
      inBasket
        ? "outline outline-1 outline-portal-champagne -outline-offset-1"
        : ""
    }`}>
      {/* Imagery — click target for full spec dialog. */}
      <button
        type="button"
        onClick={onPreview}
        className="block w-full aspect-square bg-portal-pearl relative overflow-hidden text-left focus:outline-none focus:ring-1 focus:ring-portal-champagne"
        aria-label={`View details for ${title}`}
      >
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-portal-soft/60">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Kind eyebrow — plain letter-spaced text, no coloured chip. */}
        <span className="absolute top-3 left-3 text-[9px] tracking-[0.28em] uppercase text-portal-graphite bg-portal-bone/90 backdrop-blur-sm px-1.5 py-1 font-medium">
          {item.kind === "jewelry" ? "Jewelry" : "Stone"}
        </span>

        {/* Selected corner mark */}
        {inBasket && (
          <span className="absolute top-3 right-3 inline-flex items-center justify-center w-5 h-5 bg-portal-ink text-portal-bone">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </span>
        )}

        {/* Hover affordance — quiet graphite scrim + "View" tag. */}
        <span className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-portal-ink/35 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        <span className="absolute right-3 bottom-3 text-[9.5px] tracking-[0.28em] uppercase text-portal-bone opacity-0 group-hover:opacity-100 transition-opacity duration-300 font-medium pointer-events-none">
          View
        </span>
      </button>

      {/* Meta */}
      <div className="pt-4 pb-1">
        <button
          type="button"
          onClick={onPreview}
          className="block text-left w-full focus:outline-none"
        >
          <div className="text-[10px] tracking-[0.22em] uppercase text-portal-soft tabular-nums truncate">
            {item.sku}
          </div>
          <h3 className="font-serif-display text-[18px] leading-tight text-portal-ink truncate mt-1.5">
            {title}
          </h3>
          {sub && (
            <div className="text-[11.5px] text-portal-muted mt-1.5 truncate tracking-wide">
              {sub}
            </div>
          )}
        </button>

        <button
          onClick={() => basket.toggle(item)}
          className={`mt-4 w-full inline-flex items-center justify-center gap-2 py-2.5 text-[10px] tracking-[0.24em] uppercase border transition-colors font-medium ${
            inBasket
              ? "border-portal-ink bg-portal-ink text-portal-bone hover:bg-portal-graphite hover:border-portal-graphite"
              : "border-portal-line2 text-portal-ink hover:border-portal-ink"
          }`}
        >
          {inBasket ? "Selected" : "Mark for memo"}
        </button>
      </div>
    </article>
  );
}

function ShapePill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 text-[10px] tracking-[0.22em] uppercase whitespace-nowrap transition-colors border font-medium ${
        active
          ? "border-portal-ink text-portal-ink bg-portal-bone"
          : "border-portal-line text-portal-muted hover:border-portal-line2 hover:text-portal-ink bg-transparent"
      }`}
    >{label}</button>
  );
}

/* ============================================================
   Floating selection dock — quiet graphite ink pill that
   expands into a neutral panel. Replaces the previous gradient
   "items ready to request" badge.
   ============================================================ */
function BasketDock({ onOpen }) {
  const { items, count, remove } = useRequestBasket();
  const [expanded, setExpanded] = useState(false);
  if (count === 0) return null;
  return (
    <div className="fixed bottom-5 right-5 sm:bottom-8 sm:right-8 z-40 max-w-[calc(100vw-2rem)]">
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-4 pl-5 pr-6 py-3.5 bg-portal-ink text-portal-bone border border-portal-ink hover:bg-portal-graphite transition-colors shadow-[0_10px_28px_rgba(20,18,15,0.18)]"
        >
          <span className="flex items-baseline gap-2.5">
            <span className="text-[9px] tracking-[0.32em] uppercase text-portal-bone/65 font-medium">Selection</span>
            <span className="font-serif-display text-[20px] leading-none tabular-nums">{count}</span>
          </span>
          <span className="h-px w-4 bg-portal-bone/40" aria-hidden />
          <span className="text-[10px] tracking-[0.28em] uppercase font-medium">Review</span>
        </button>
      ) : (
        <div className="bg-portal-canvas border border-portal-line2 w-[380px] max-w-full overflow-hidden shadow-[0_24px_56px_rgba(20,18,15,0.18)]">
          <div className="flex items-start justify-between px-5 py-4 border-b border-portal-line">
            <div>
              <div className="text-[10px] tracking-[0.28em] uppercase text-portal-soft font-medium">Selection</div>
              <div className="font-serif-display text-[20px] text-portal-ink leading-tight mt-1">
                {count} {count === 1 ? "piece" : "pieces"}
              </div>
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="text-portal-muted hover:text-portal-ink transition-colors"
              aria-label="Collapse selection"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-portal-line">
            {items.map((it) => (
              <div key={`${it.kind}-${it.sku}`} className="flex items-center gap-4 px-5 py-3">
                <div className="w-11 h-11 bg-portal-pearl border border-portal-line shrink-0 overflow-hidden">
                  {it.imageUrl ? <img src={it.imageUrl} alt="" className="w-full h-full object-cover" /> : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] text-portal-ink truncate">{it.kind === "jewelry" ? (it.name || it.sku) : `${it.shape || ""} ${it.weightCt ? `${it.weightCt} ct` : ""}`.trim()}</div>
                  <div className="text-[9.5px] tracking-[0.22em] uppercase text-portal-soft mt-0.5 tabular-nums">{it.sku}</div>
                </div>
                <button
                  onClick={() => remove(it)}
                  className="text-[9.5px] tracking-[0.22em] uppercase text-portal-muted hover:text-portal-ink transition-colors font-medium"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => { setExpanded(false); onOpen(); }}
            className="w-full px-5 py-4 bg-portal-ink text-portal-bone text-[11px] tracking-[0.28em] uppercase hover:bg-portal-graphite transition-colors font-medium"
          >
            Compose request
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Submit modal — message + preferred due date + final review
   ============================================================ */
function SubmitRequestModal({ onClose, onSubmitted }) {
  const { user } = useUser();
  const { items } = useRequestBasket();
  const [message, setMessage]   = useState("");
  const [dueAt, setDueAt]       = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        items: items.map((i) => ({
          kind: i.kind,
          sku: i.sku,
          id: i.id ?? null,
          snapshot: {
            id: i.id ?? null,
            sku: i.sku,
            kind: i.kind,
            name: i.name,
            shape: i.shape,
            category: i.category,
            type: i.type,
            weightCt: i.weightCt,
            color: i.color,
            clarity: i.clarity,
            origin: i.origin,
            metalType: i.metalType,
            metalColor: i.metalColor,
            imageUrl: i.imageUrl,
          },
        })),
        message: message.trim() || null,
        preferredDueAt: dueAt || null,
      };
      const req = await createMemoRequest(user.id, payload);
      toast.success("Request sent — your supplier has been notified");
      onSubmitted?.(req);
    } catch (e) {
      toast.error(e.message || "Could not submit request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-portal-ink/55 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-portal-canvas w-full sm:max-w-xl border-0 sm:border border-portal-line2 shadow-[0_30px_60px_rgba(20,18,15,0.25)] overflow-hidden max-h-[92vh] flex flex-col">
        <div className="px-6 py-5 border-b border-portal-line flex items-start justify-between">
          <div>
            <div className="text-[10px] tracking-[0.32em] uppercase text-portal-champagne font-medium">
              New memo request
            </div>
            <h3 className="font-serif-display text-[24px] leading-tight text-portal-ink mt-2">
              Review &amp; send
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-portal-muted hover:text-portal-ink transition-colors -mt-1 -mr-1 p-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto space-y-6">
          {items.length > 0 && (
            <div>
              <div className="text-[10px] tracking-[0.28em] uppercase text-portal-soft font-medium mb-3">
                In this request · {items.length}
              </div>
              <div className="border border-portal-line divide-y divide-portal-line max-h-56 overflow-y-auto">
                {items.map((it) => (
                  <div key={`${it.kind}-${it.sku}`} className="flex items-center gap-3 px-3.5 py-2.5">
                    <div className="w-9 h-9 bg-portal-pearl border border-portal-line overflow-hidden shrink-0">
                      {it.imageUrl ? <img src={it.imageUrl} alt="" className="w-full h-full object-cover" /> : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] text-portal-ink truncate">{it.kind === "jewelry" ? (it.name || it.sku) : `${it.shape || ""} ${it.weightCt ? `${it.weightCt} ct` : ""}`.trim()}</div>
                      <div className="text-[9.5px] tracking-[0.22em] uppercase text-portal-soft mt-0.5">{it.sku}</div>
                    </div>
                    <span className="text-[9px] tracking-[0.28em] uppercase text-portal-muted font-medium">
                      {it.kind}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="text-[10px] tracking-[0.28em] uppercase text-portal-soft font-medium mb-2 block">
              Notes for your supplier <span className="text-portal-soft/70 normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder={items.length ? "Anything specific — customer in mind, deadline, preferred sizes…" : "Describe what you're looking for — shape, carat range, metal, deadline…"}
              className="w-full px-3 py-2.5 text-[13px] bg-transparent border border-portal-line2 focus:outline-none focus:border-portal-ink placeholder:text-portal-soft resize-y text-portal-ink leading-relaxed"
            />
          </div>
          <div>
            <label className="text-[10px] tracking-[0.28em] uppercase text-portal-soft font-medium mb-2 block">
              Preferred receive date <span className="text-portal-soft/70 normal-case tracking-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full px-3 py-2.5 text-[13px] bg-transparent border border-portal-line2 focus:outline-none focus:border-portal-ink text-portal-ink"
            />
          </div>
          <div className="border-l-2 border-portal-champagne pl-4 py-1 text-[12px] text-portal-graphite leading-relaxed">
            This is a request, not a confirmed memo. Your supplier reviews availability and pricing and replies with the official memo. You may cancel any time before it is converted.
          </div>
        </div>
        <div className="px-6 py-4 border-t border-portal-line flex items-center justify-end gap-4 bg-portal-bone">
          <button
            onClick={onClose}
            className="text-[10px] tracking-[0.28em] uppercase text-portal-muted hover:text-portal-ink font-medium transition-colors px-2 py-2"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || (items.length === 0 && !message.trim())}
            className="px-7 py-2.5 bg-portal-ink text-portal-bone text-[11px] tracking-[0.28em] uppercase font-medium hover:bg-portal-graphite transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Sending" : "Send request"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Catalog item dialog — full inventory specs, no pricing.
   ============================================================ */
function CatalogItemDialog({ item, basket, onClose }) {
  const { user } = useUser();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [activeImg, setActiveImg] = useState(item?.imageUrl || null);

  useEffect(() => {
    if (!user?.id || !item) return;
    let alive = true;
    setLoading(true);
    setError(null);
    const identifier = item.kind === "jewelry" ? (item.id || item.sku) : item.sku;
    fetchPortalItemDetail(user.id, item.kind, identifier)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        // pick a sensible default thumbnail
        if (d?.images?.length) setActiveImg(d.images[0]);
        else if (d?.coverImageUrl) setActiveImg(d.coverImageUrl);
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [user?.id, item]);

  // Close on Escape for keyboard users.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isJewelry = item?.kind === "jewelry";
  const title = detail
    ? (isJewelry
        ? (detail.name || detail.sku)
        : `${detail.shape || ""} ${detail.weightCt ? `${detail.weightCt} ct` : ""}`.trim() || detail.sku)
    : (isJewelry ? (item?.name || item?.sku) : `${item?.shape || ""} ${item?.weightCt ? `${item.weightCt} ct` : ""}`.trim() || item?.sku);

  const inBasket = basket?.has(item);

  // Build the spec rows for the right-hand column
  const specs = useMemo(() => {
    if (!detail) return [];
    if (isJewelry) {
      return [
        { label: "SKU",          value: detail.sku },
        { label: "Type",         value: detail.type },
        { label: "Category",     value: detail.category },
        { label: "Metal",        value: detail.metalSummary },
        { label: "Weight",       value: detail.weightGrams != null ? `${detail.weightGrams} g` : null },
        { label: "Size",         value: detail.size },
      ].filter((r) => r.value);
    }
    return [
      { label: "SKU",            value: detail.sku },
      { label: "Shape",          value: detail.shape },
      { label: "Category",       value: detail.category },
      { label: "Type",           value: detail.type },
      { label: "Carat",          value: detail.weightCt != null ? `${detail.weightCt} ct` : null },
      { label: "Color",          value: detail.color },
      { label: "Clarity",        value: detail.clarity },
      { label: "Cut",            value: detail.cut },
      { label: "Polish",         value: detail.polish },
      { label: "Symmetry",       value: detail.symmetry },
      { label: "Table %",        value: detail.tablePercent != null ? `${detail.tablePercent}%` : null },
      { label: "Depth %",        value: detail.depthPercent != null ? `${detail.depthPercent}%` : null },
      { label: "Ratio",          value: detail.ratio },
      { label: "Measurements",   value: detail.measurements },
      { label: "Lab",            value: detail.lab },
      { label: "Origin",         value: detail.origin },
      { label: "Treatment",      value: detail.treatment },
      { label: "Fluorescence",   value: detail.fluorescence },
      { label: "Luster",         value: detail.luster },
      { label: "Fancy intensity", value: detail.fancyIntensity },
      { label: "Fancy color",    value: detail.fancyColor },
      { label: "Fancy overtone", value: detail.fancyOvertone },
      { label: "Pair SKU",       value: detail.pairSku },
      { label: "Cert. number",   value: detail.certificateNumber },
    ].filter((r) => r.value !== "" && r.value != null);
  }, [detail, isJewelry]);

  const gallery = isJewelry
    ? [
        ...(detail?.coverImageUrl ? [detail.coverImageUrl] : []),
        ...((detail?.files || []).filter((f) => f.kind === "image" || /\.(jpe?g|png|gif|webp|avif)$/i.test(f.url || "")).map((f) => f.url)),
      ]
    : (detail?.images || []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-portal-ink/55 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-portal-canvas w-full sm:max-w-4xl border-0 sm:border border-portal-line2 shadow-[0_30px_60px_rgba(20,18,15,0.25)] overflow-hidden max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-portal-line flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-4">
              <span className="text-[9px] tracking-[0.32em] uppercase text-portal-champagne font-medium">
                {isJewelry ? "Jewelry" : "Stone"}
              </span>
              <span className="text-[10px] tracking-[0.22em] uppercase text-portal-soft tabular-nums">
                {detail?.sku || item.sku}
              </span>
            </div>
            <h3 className="font-serif-display text-[24px] sm:text-[28px] leading-tight text-portal-ink mt-2 truncate">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-portal-muted hover:text-portal-ink transition-colors shrink-0 -mt-1 -mr-1 p-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 grid sm:grid-cols-2 gap-6 animate-pulse">
              <div className="aspect-square bg-portal-pearl" />
              <div className="space-y-3">
                <div className="h-4 w-1/2 bg-portal-pearl" />
                <div className="h-3 w-full bg-portal-pearl" />
                <div className="h-3 w-5/6 bg-portal-pearl" />
                <div className="h-3 w-3/4 bg-portal-pearl" />
                <div className="h-32 bg-portal-pearl" />
              </div>
            </div>
          ) : error ? (
            <div className="px-6 py-16 text-center">
              <div className="text-[13px] text-portal-ink">{error}</div>
              <div className="text-[11px] text-portal-soft mt-2 tracking-wide">Try closing the dialog and re-opening it.</div>
            </div>
          ) : !detail ? null : (
            <div className="grid sm:grid-cols-2 gap-0">
              {/* Gallery column */}
              <div className="bg-portal-bone sm:border-r border-portal-line p-5 sm:p-6">
                <div className="aspect-square w-full overflow-hidden bg-portal-canvas border border-portal-line flex items-center justify-center">
                  {activeImg ? (
                    <img src={activeImg} alt={title} className="w-full h-full object-contain" />
                  ) : (
                    <svg className="w-14 h-14 text-portal-soft/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>
                {gallery.length > 1 && (
                  <div className="mt-3 grid grid-cols-5 gap-2">
                    {gallery.slice(0, 10).map((src) => (
                      <button
                        key={src}
                        onClick={() => setActiveImg(src)}
                        className={`aspect-square overflow-hidden border transition-colors ${
                          activeImg === src
                            ? "border-portal-ink"
                            : "border-portal-line hover:border-portal-line2"
                        }`}
                      >
                        <img src={src} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex flex-col gap-2">
                  {!isJewelry && Array.isArray(detail.videos) && detail.videos.length > 0 && (
                    <a
                      href={detail.videos[0]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-portal-ink text-portal-bone text-[10px] tracking-[0.24em] uppercase font-medium hover:bg-portal-graphite transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Watch 360° video
                    </a>
                  )}
                  {!isJewelry && (detail.certificateUrl || detail.certificateImageJpg) && (
                    <a
                      href={detail.certificateUrl || detail.certificateImageJpg}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent border border-portal-line2 text-portal-ink text-[10px] tracking-[0.24em] uppercase font-medium hover:border-portal-ink transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      View certificate
                    </a>
                  )}
                </div>
              </div>

              {/* Spec column */}
              <div className="p-5 sm:p-6 space-y-7">
                <div>
                  <div className="text-[10px] tracking-[0.28em] uppercase text-portal-soft font-medium mb-4">
                    Specifications
                  </div>
                  <dl className="text-[13px] divide-y divide-portal-line">
                    {specs.map((row) => (
                      <div key={row.label} className="grid grid-cols-[120px_1fr] gap-4 py-2.5">
                        <dt className="text-portal-muted tracking-wide">{row.label}</dt>
                        <dd className="text-portal-ink truncate" title={String(row.value)}>{String(row.value)}</dd>
                      </div>
                    ))}
                    {specs.length === 0 && (
                      <div className="text-portal-soft italic py-2 text-[12.5px]">No specifications recorded.</div>
                    )}
                  </dl>
                </div>

                {!isJewelry && detail.certComments && (
                  <div>
                    <div className="text-[10px] tracking-[0.28em] uppercase text-portal-soft font-medium mb-2">Cert comments</div>
                    <p className="text-[13px] text-portal-graphite whitespace-pre-wrap leading-relaxed">{detail.certComments}</p>
                  </div>
                )}

                {isJewelry && (detail.metals?.length > 0 || detail.stones?.length > 0) && (
                  <div className="space-y-5">
                    {detail.metals?.length > 0 && (
                      <div>
                        <div className="text-[10px] tracking-[0.28em] uppercase text-portal-soft font-medium mb-2">Metals</div>
                        <div className="border border-portal-line divide-y divide-portal-line">
                          {detail.metals.map((m) => (
                            <div key={m.id} className="flex items-center justify-between px-3.5 py-2.5 text-[13px]">
                              <span className="text-portal-graphite">{[m.metalType, m.purity, m.color].filter(Boolean).join(" · ") || "—"}</span>
                              <span className="text-portal-ink tabular-nums">{m.weightGrams != null ? `${m.weightGrams} g` : "—"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {detail.stones?.length > 0 && (
                      <div>
                        <div className="text-[10px] tracking-[0.28em] uppercase text-portal-soft font-medium mb-2">Stones</div>
                        <div className="border border-portal-line divide-y divide-portal-line">
                          {detail.stones.map((s) => {
                            const snap = s.snapshot || {};
                            const stoneTitle = `${snap.shape || snap.category || "Stone"}${snap.weightCt ? ` · ${snap.weightCt} ct` : ""}`;
                            const stoneSub = [snap.color, snap.clarity, snap.origin].filter(Boolean).join(" · ");
                            return (
                              <div key={s.id} className="flex items-start gap-3 px-3.5 py-3">
                                <div className="w-10 h-10 bg-portal-pearl border border-portal-line overflow-hidden shrink-0">
                                  {snap.imageUrl && <img src={snap.imageUrl} alt="" className="w-full h-full object-cover" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[13px] text-portal-ink truncate">{stoneTitle}</div>
                                  {stoneSub && <div className="text-[11px] text-portal-muted truncate mt-0.5">{stoneSub}</div>}
                                  <div className="text-[9.5px] tracking-[0.22em] uppercase text-portal-soft mt-1">{s.role}{s.quantity > 1 ? ` · ×${s.quantity}` : ""}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {isJewelry && detail.description && (
                  <div>
                    <div className="text-[10px] tracking-[0.28em] uppercase text-portal-soft font-medium mb-2">Description</div>
                    <p className="text-[13px] text-portal-graphite whitespace-pre-wrap leading-relaxed">{detail.description}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-portal-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-portal-bone">
          <div className="text-[10.5px] tracking-[0.22em] uppercase text-portal-soft leading-relaxed">
            Pricing is established when your supplier issues the memo
          </div>
          <button
            onClick={() => { basket?.toggle(item); }}
            className={`px-7 py-2.5 text-[10.5px] tracking-[0.28em] uppercase font-medium transition-colors border ${
              inBasket
                ? "bg-portal-ink text-portal-bone border-portal-ink hover:bg-portal-graphite hover:border-portal-graphite"
                : "bg-transparent text-portal-ink border-portal-line2 hover:border-portal-ink"
            }`}
          >
            {inBasket ? "Selected" : "Mark for memo"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Empty / skeleton states
   ============================================================ */
function EmptyCatalog() {
  return (
    <div className="px-6 py-20 text-center">
      <div className="h-px w-12 bg-portal-champagne mx-auto mb-6" />
      <div className="font-serif-display text-[20px] text-portal-ink">Nothing matches your filters</div>
      <div className="text-[12.5px] text-portal-muted mt-3 max-w-sm mx-auto leading-relaxed">
        Try clearing the filters, or send your supplier a free-text request describing what you're looking for.
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="p-5 sm:p-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 sm:gap-x-6 gap-y-8 sm:gap-y-10">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="bg-portal-canvas">
          <div className="aspect-square bg-portal-pearl animate-pulse" />
          <div className="pt-4 pb-1 space-y-2.5">
            <div className="h-2.5 w-1/3 bg-portal-pearl animate-pulse" />
            <div className="h-4 w-3/4 bg-portal-pearl animate-pulse" />
            <div className="h-3 w-1/2 bg-portal-pearl animate-pulse" />
            <div className="h-8 w-full bg-portal-pearl animate-pulse mt-3" />
          </div>
        </div>
      ))}
    </div>
  );
}
