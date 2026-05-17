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
    <div className="space-y-6 sm:space-y-8 pb-32">
      <CatalogHero
        stoneCount={data.stones.length}
        jewelryCount={data.jewelry.length}
        loading={loading}
      />

      <section className="glass-surface rounded-2xl sm:rounded-[28px] overflow-hidden">
        {/* Tabs — segmented control inside a glass pill. Active chip
            is a filled ink pill with subtle elevation. */}
        <div className="px-5 sm:px-7 pt-5 pb-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="inline-flex p-1 rounded-full bg-white/50 border border-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] overflow-x-auto overflow-y-hidden scrollbar-hide">
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
                  className={`relative px-3.5 sm:px-4 py-1.5 rounded-full text-[12.5px] sm:text-[13px] whitespace-nowrap transition-all font-medium flex items-center gap-2 ${
                    active
                      ? "bg-glass-ink text-white shadow-[0_4px_14px_-6px_rgba(20,22,28,0.45)]"
                      : "text-glass-muted hover:text-glass-ink"
                  }`}
                >
                  {t.label}
                  <span className={`text-[10.5px] tabular-nums ${active ? "text-white/70" : "text-glass-soft"}`}>{t.count}</span>
                </button>
              );
            })}
          </div>
          <div className="relative w-full sm:w-72">
            <svg className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-glass-soft pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-4.35-4.35m1.85-5.65a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SKU, shape, colour"
              className="w-full pl-9 pr-3 py-2 rounded-full text-[13px] bg-white/55 border border-white/60 focus:outline-none focus:border-glass-line2 placeholder:text-glass-soft text-glass-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
            />
          </div>
        </div>

        {(tab === "all" || tab === "stones") && allShapes.length > 0 && (
          <div className="px-5 sm:px-7 pb-4 flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <ShapePill label="All shapes" active={!shape} onClick={() => setShape("")} />
            {allShapes.map((s) => (
              <ShapePill key={s} label={s} active={shape.toLowerCase() === s.toLowerCase()} onClick={() => setShape(s)} />
            ))}
          </div>
        )}

        <div className="border-t border-glass-line/70" />

        {/* Grid */}
        {loading ? (
          <SkeletonGrid />
        ) : all.length === 0 ? (
          <EmptyCatalog />
        ) : (
          <div className="p-5 sm:p-7 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 sm:gap-x-6 gap-y-8 sm:gap-y-9">
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
   Hero — glass card with title + inventory counts at right.
   ============================================================ */
function CatalogHero({ stoneCount = 0, jewelryCount = 0, loading = false }) {
  return (
    <section className="glass-surface rounded-2xl sm:rounded-[28px] px-6 sm:px-9 py-7 sm:py-9 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-7">
      <div className="max-w-xl">
        <div className="text-[10.5px] tracking-[0.14em] uppercase text-glass-muted font-medium mb-3">
          Inventory
        </div>
        <h1 className="text-[28px] sm:text-[36px] leading-[1.1] text-glass-ink font-semibold tracking-tight">
          Available pieces for memo
        </h1>
        <p className="mt-4 text-[14px] sm:text-[15px] leading-relaxed text-glass-muted max-w-md">
          Stones and finished jewellery currently free from prior commitment.
          Mark a selection — your supplier reviews availability and issues
          the memo on your behalf.
        </p>
      </div>
      <dl className="hidden sm:flex items-end gap-6">
        <InventoryCount label="Stones"  value={stoneCount}   loading={loading} />
        <span className="h-10 w-px bg-glass-line mb-1.5" aria-hidden />
        <InventoryCount label="Jewelry" value={jewelryCount} loading={loading} />
      </dl>
    </section>
  );
}

function InventoryCount({ label, value, loading }) {
  return (
    <div className="text-right">
      <dd className="text-[30px] font-semibold leading-none tabular-nums text-glass-ink tracking-tight">
        {loading ? <span className="inline-block w-9 h-7 rounded bg-glass-canvas2" /> : value}
      </dd>
      <dt className="text-[10.5px] tracking-[0.14em] uppercase text-glass-muted mt-2 font-medium">
        {label}
      </dt>
    </div>
  );
}

/* ============================================================
   Card — image-led, modern glass treatment.
     · Square image with rounded corners on a soft canvas2 fill.
     · Kind eyebrow inside a tiny frosted-glass chip.
     · Hover reveals "View" affordance over a soft ink scrim.
     · Selected state: ring + filled corner check.
     · CTA: filled pill (ink) when selected, glass pill otherwise.
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
    <article className="group relative">
      {/* Imagery — click target for full spec dialog. */}
      <button
        type="button"
        onClick={onPreview}
        className={`block w-full aspect-square relative overflow-hidden text-left rounded-2xl bg-glass-canvas2 transition-all focus:outline-none focus:ring-2 focus:ring-glass-ink/30 ${
          inBasket ? "ring-2 ring-glass-ink shadow-[0_8px_24px_-12px_rgba(20,22,28,0.30)]" : "ring-1 ring-glass-line hover:ring-glass-line2"
        }`}
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
          <div className="w-full h-full flex items-center justify-center text-glass-soft">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Kind eyebrow — frosted glass chip. */}
        <span className="absolute top-3 left-3 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium text-glass-ink bg-white/75 backdrop-blur-md border border-white/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
          {item.kind === "jewelry" ? "Jewelry" : "Stone"}
        </span>

        {/* Selected corner mark */}
        {inBasket && (
          <span className="absolute top-3 right-3 inline-flex items-center justify-center w-6 h-6 rounded-full bg-glass-ink text-white shadow-[0_4px_12px_-4px_rgba(20,22,28,0.45)]">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </span>
        )}

        {/* Hover affordance — soft ink scrim + "View" pill. */}
        <span className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-glass-ink/35 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-b-2xl" />
        <span className="absolute right-3 bottom-3 inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium text-glass-ink bg-white/85 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          View details
        </span>
      </button>

      {/* Meta */}
      <div className="pt-3.5 pb-1 px-1">
        <button
          type="button"
          onClick={onPreview}
          className="block text-left w-full focus:outline-none"
        >
          <div className="text-[10.5px] text-glass-soft tabular-nums truncate">
            {item.sku}
          </div>
          <h3 className="text-[15px] font-semibold leading-tight text-glass-ink truncate mt-1 tracking-tight">
            {title}
          </h3>
          {sub && (
            <div className="text-[12px] text-glass-muted mt-1 truncate">
              {sub}
            </div>
          )}
        </button>

        <button
          onClick={() => basket.toggle(item)}
          className={`mt-3 w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-full text-[12px] font-medium transition-colors ${
            inBasket
              ? "bg-glass-ink text-white hover:bg-glass-graphite shadow-[0_4px_14px_-6px_rgba(20,22,28,0.45)]"
              : "bg-white/65 text-glass-ink border border-white/70 hover:bg-white/85 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
          }`}
        >
          {inBasket ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Selected
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Mark for memo
            </>
          )}
        </button>
      </div>
    </article>
  );
}

function ShapePill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${
        active
          ? "bg-glass-ink text-white shadow-[0_4px_14px_-6px_rgba(20,22,28,0.45)]"
          : "bg-white/55 text-glass-muted border border-white/60 hover:text-glass-ink hover:bg-white/75 backdrop-blur-md"
      }`}
    >{label}</button>
  );
}

/* ============================================================
   Floating selection dock — Apple-style pill that expands into
   a glass panel. Ink primary when collapsed; the expanded panel
   is a frosted glass sheet floating above the canvas.
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
          className="flex items-center gap-3 pl-4 pr-5 py-3 rounded-full bg-glass-ink text-white hover:bg-glass-graphite transition-colors shadow-[0_18px_40px_-12px_rgba(20,22,28,0.45)] ring-1 ring-inset ring-white/10"
        >
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/15 text-white tabular-nums text-[13px] font-semibold">
            {count}
          </span>
          <span className="text-[13.5px] font-medium">Review selection</span>
          <svg className="w-4 h-4 -mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      ) : (
        <div className="glass-surface-strong rounded-3xl w-[380px] max-w-full overflow-hidden">
          <div className="flex items-start justify-between px-5 py-4 border-b border-glass-line/70">
            <div>
              <div className="text-[10.5px] tracking-[0.14em] uppercase text-glass-muted font-medium">Selection</div>
              <div className="text-[18px] font-semibold tracking-tight text-glass-ink leading-tight mt-0.5">
                {count} {count === 1 ? "piece" : "pieces"}
              </div>
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="w-8 h-8 inline-flex items-center justify-center rounded-full text-glass-muted hover:text-glass-ink hover:bg-white/55 transition-colors"
              aria-label="Collapse selection"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-glass-line/70">
            {items.map((it) => (
              <div key={`${it.kind}-${it.sku}`} className="flex items-center gap-3.5 px-5 py-3">
                <div className="w-11 h-11 rounded-xl bg-glass-canvas2 border border-glass-line shrink-0 overflow-hidden">
                  {it.imageUrl ? <img src={it.imageUrl} alt="" className="w-full h-full object-cover" /> : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-glass-ink truncate font-medium">{it.kind === "jewelry" ? (it.name || it.sku) : `${it.shape || ""} ${it.weightCt ? `${it.weightCt} ct` : ""}`.trim()}</div>
                  <div className="text-[11px] text-glass-soft tabular-nums mt-0.5">{it.sku}</div>
                </div>
                <button
                  onClick={() => remove(it)}
                  className="text-[12px] text-glass-muted hover:text-glass-ink transition-colors font-medium"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className="p-4">
            <button
              onClick={() => { setExpanded(false); onOpen(); }}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-glass-ink text-white text-[14px] font-medium hover:bg-glass-graphite transition-colors shadow-[0_8px_22px_-8px_rgba(20,22,28,0.45)]"
            >
              Compose request
              <svg className="w-4 h-4 -mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-glass-ink/35 backdrop-blur-md p-0 sm:p-4">
      <div className="glass-surface-strong w-full sm:max-w-xl sm:rounded-3xl rounded-t-3xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="px-6 py-5 border-b border-glass-line/70 flex items-start justify-between">
          <div>
            <div className="text-[10.5px] tracking-[0.14em] uppercase text-glass-muted font-medium">
              New memo request
            </div>
            <h3 className="text-[22px] font-semibold tracking-tight text-glass-ink mt-1">
              Review &amp; send
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 inline-flex items-center justify-center rounded-full text-glass-muted hover:text-glass-ink hover:bg-white/55 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto space-y-5">
          {items.length > 0 && (
            <div>
              <div className="text-[11px] text-glass-muted font-medium mb-2.5">
                In this request · {items.length}
              </div>
              <div className="rounded-2xl bg-white/55 border border-white/65 backdrop-blur-md divide-y divide-glass-line/70 max-h-56 overflow-y-auto shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
                {items.map((it) => (
                  <div key={`${it.kind}-${it.sku}`} className="flex items-center gap-3 px-3.5 py-2.5">
                    <div className="w-9 h-9 rounded-lg bg-glass-canvas2 border border-glass-line overflow-hidden shrink-0">
                      {it.imageUrl ? <img src={it.imageUrl} alt="" className="w-full h-full object-cover" /> : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-glass-ink truncate font-medium">{it.kind === "jewelry" ? (it.name || it.sku) : `${it.shape || ""} ${it.weightCt ? `${it.weightCt} ct` : ""}`.trim()}</div>
                      <div className="text-[11px] text-glass-soft tabular-nums mt-0.5">{it.sku}</div>
                    </div>
                    <span className="text-[10.5px] text-glass-muted font-medium capitalize">
                      {it.kind}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="text-[12px] text-glass-graphite font-medium mb-2 block">
              Notes for your supplier <span className="text-glass-soft font-normal">(optional)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder={items.length ? "Anything specific — customer in mind, deadline, preferred sizes…" : "Describe what you're looking for — shape, carat range, metal, deadline…"}
              className="w-full px-4 py-2.5 rounded-2xl text-[13px] bg-white/55 border border-white/65 focus:outline-none focus:border-glass-line2 placeholder:text-glass-soft resize-y text-glass-ink leading-relaxed shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
            />
          </div>
          <div>
            <label className="text-[12px] text-glass-graphite font-medium mb-2 block">
              Preferred receive date <span className="text-glass-soft font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full px-4 py-2.5 rounded-full text-[13px] bg-white/55 border border-white/65 focus:outline-none focus:border-glass-line2 text-glass-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
            />
          </div>
          <div className="rounded-2xl bg-white/40 border border-white/55 px-4 py-3 text-[12.5px] text-glass-graphite leading-relaxed backdrop-blur-md">
            This is a request, not a confirmed memo. Your supplier reviews availability and pricing and replies with the official memo. You may cancel any time before it is converted.
          </div>
        </div>
        <div className="px-6 py-4 border-t border-glass-line/70 flex items-center justify-end gap-3 bg-white/30 backdrop-blur-md">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-full text-[13.5px] text-glass-muted hover:text-glass-ink font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || (items.length === 0 && !message.trim())}
            className="px-6 py-2.5 rounded-full bg-glass-ink text-white text-[13.5px] font-medium hover:bg-glass-graphite transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_6px_18px_-8px_rgba(20,22,28,0.45)]"
          >
            {submitting ? "Sending…" : "Send request"}
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-glass-ink/35 backdrop-blur-md p-0 sm:p-4">
      <div className="glass-surface-strong w-full sm:max-w-4xl sm:rounded-3xl rounded-t-3xl overflow-hidden max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-glass-line/70 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium text-glass-ink bg-white/65 border border-white/70 backdrop-blur-md">
                {isJewelry ? "Jewelry" : "Stone"}
              </span>
              <span className="text-[11px] text-glass-soft tabular-nums">
                {detail?.sku || item.sku}
              </span>
            </div>
            <h3 className="text-[22px] sm:text-[26px] font-semibold tracking-tight leading-tight text-glass-ink mt-2 truncate">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 inline-flex items-center justify-center rounded-full text-glass-muted hover:text-glass-ink hover:bg-white/55 transition-colors shrink-0"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 grid sm:grid-cols-2 gap-6 animate-pulse">
              <div className="aspect-square rounded-2xl bg-glass-canvas2" />
              <div className="space-y-3">
                <div className="h-4 w-1/2 rounded bg-glass-canvas2" />
                <div className="h-3 w-full rounded bg-glass-canvas2" />
                <div className="h-3 w-5/6 rounded bg-glass-canvas2" />
                <div className="h-3 w-3/4 rounded bg-glass-canvas2" />
                <div className="h-32 rounded-2xl bg-glass-canvas2" />
              </div>
            </div>
          ) : error ? (
            <div className="px-6 py-16 text-center">
              <div className="text-[14px] text-glass-ink">{error}</div>
              <div className="text-[12px] text-glass-muted mt-2">Try closing the dialog and re-opening it.</div>
            </div>
          ) : !detail ? null : (
            <div className="grid sm:grid-cols-2 gap-0">
              {/* Gallery column */}
              <div className="sm:border-r border-glass-line/70 p-5 sm:p-6 bg-white/20">
                <div className="aspect-square w-full overflow-hidden rounded-2xl bg-glass-canvas2 border border-glass-line flex items-center justify-center">
                  {activeImg ? (
                    <img src={activeImg} alt={title} className="w-full h-full object-contain" />
                  ) : (
                    <svg className="w-14 h-14 text-glass-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        className={`aspect-square overflow-hidden rounded-lg transition-all ${
                          activeImg === src
                            ? "ring-2 ring-glass-ink"
                            : "ring-1 ring-glass-line hover:ring-glass-line2"
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
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-glass-ink text-white text-[13px] font-medium hover:bg-glass-graphite transition-colors shadow-[0_6px_18px_-8px_rgba(20,22,28,0.45)]"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white/65 backdrop-blur-md border border-white/70 text-glass-ink text-[13px] font-medium hover:bg-white/85 transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      View certificate
                    </a>
                  )}
                </div>
              </div>

              {/* Spec column */}
              <div className="p-5 sm:p-6 space-y-6">
                <div>
                  <div className="text-[11px] text-glass-muted font-medium mb-3">
                    Specifications
                  </div>
                  <dl className="text-[13px] divide-y divide-glass-line/70 rounded-2xl bg-white/45 backdrop-blur-md border border-white/55 overflow-hidden">
                    {specs.map((row) => (
                      <div key={row.label} className="grid grid-cols-[120px_1fr] gap-4 px-4 py-2.5">
                        <dt className="text-glass-muted">{row.label}</dt>
                        <dd className="text-glass-ink truncate font-medium" title={String(row.value)}>{String(row.value)}</dd>
                      </div>
                    ))}
                    {specs.length === 0 && (
                      <div className="text-glass-soft italic px-4 py-3 text-[12.5px]">No specifications recorded.</div>
                    )}
                  </dl>
                </div>

                {!isJewelry && detail.certComments && (
                  <div>
                    <div className="text-[11px] text-glass-muted font-medium mb-2">Cert comments</div>
                    <p className="text-[13px] text-glass-graphite whitespace-pre-wrap leading-relaxed">{detail.certComments}</p>
                  </div>
                )}

                {isJewelry && (detail.metals?.length > 0 || detail.stones?.length > 0) && (
                  <div className="space-y-5">
                    {detail.metals?.length > 0 && (
                      <div>
                        <div className="text-[11px] text-glass-muted font-medium mb-2">Metals</div>
                        <div className="rounded-2xl bg-white/45 border border-white/55 backdrop-blur-md divide-y divide-glass-line/70 overflow-hidden">
                          {detail.metals.map((m) => (
                            <div key={m.id} className="flex items-center justify-between px-4 py-2.5 text-[13px]">
                              <span className="text-glass-graphite">{[m.metalType, m.purity, m.color].filter(Boolean).join(" · ") || "—"}</span>
                              <span className="text-glass-ink tabular-nums font-medium">{m.weightGrams != null ? `${m.weightGrams} g` : "—"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {detail.stones?.length > 0 && (
                      <div>
                        <div className="text-[11px] text-glass-muted font-medium mb-2">Stones</div>
                        <div className="rounded-2xl bg-white/45 border border-white/55 backdrop-blur-md divide-y divide-glass-line/70 overflow-hidden">
                          {detail.stones.map((s) => {
                            const snap = s.snapshot || {};
                            const stoneTitle = `${snap.shape || snap.category || "Stone"}${snap.weightCt ? ` · ${snap.weightCt} ct` : ""}`;
                            const stoneSub = [snap.color, snap.clarity, snap.origin].filter(Boolean).join(" · ");
                            return (
                              <div key={s.id} className="flex items-start gap-3 px-4 py-3">
                                <div className="w-10 h-10 rounded-lg bg-glass-canvas2 border border-glass-line overflow-hidden shrink-0">
                                  {snap.imageUrl && <img src={snap.imageUrl} alt="" className="w-full h-full object-cover" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[13px] text-glass-ink truncate font-medium">{stoneTitle}</div>
                                  {stoneSub && <div className="text-[11.5px] text-glass-muted truncate mt-0.5">{stoneSub}</div>}
                                  <div className="text-[10.5px] text-glass-soft mt-1">{s.role}{s.quantity > 1 ? ` · ×${s.quantity}` : ""}</div>
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
                    <div className="text-[11px] text-glass-muted font-medium mb-2">Description</div>
                    <p className="text-[13px] text-glass-graphite whitespace-pre-wrap leading-relaxed">{detail.description}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-glass-line/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white/30 backdrop-blur-md">
          <div className="text-[12px] text-glass-muted leading-relaxed">
            Pricing is established when your supplier issues the memo.
          </div>
          <button
            onClick={() => { basket?.toggle(item); }}
            className={`inline-flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-full text-[13.5px] font-medium transition-colors ${
              inBasket
                ? "bg-glass-ink text-white hover:bg-glass-graphite shadow-[0_6px_18px_-8px_rgba(20,22,28,0.45)]"
                : "bg-white/65 text-glass-ink border border-white/70 hover:bg-white/85 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
            }`}
          >
            {inBasket ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                Selected
              </>
            ) : "Mark for memo"}
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
      <div className="w-12 h-12 mx-auto rounded-2xl bg-white/60 border border-white/65 backdrop-blur-md flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
        <svg className="w-5 h-5 text-glass-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="text-[18px] font-semibold tracking-tight text-glass-ink mt-4">Nothing matches your filters</div>
      <div className="text-[13px] text-glass-muted mt-2 max-w-sm mx-auto leading-relaxed">
        Try clearing the filters, or send your supplier a free-text request describing what you're looking for.
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="p-5 sm:p-7 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 sm:gap-x-6 gap-y-8 sm:gap-y-9">
      {[...Array(8)].map((_, i) => (
        <div key={i}>
          <div className="aspect-square rounded-2xl bg-glass-canvas2 animate-pulse" />
          <div className="pt-3.5 pb-1 px-1 space-y-2">
            <div className="h-2.5 w-1/3 rounded bg-glass-canvas2 animate-pulse" />
            <div className="h-4 w-3/4 rounded bg-glass-canvas2 animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-glass-canvas2 animate-pulse" />
            <div className="h-7 w-full rounded-full bg-glass-canvas2 animate-pulse mt-3" />
          </div>
        </div>
      ))}
    </div>
  );
}
