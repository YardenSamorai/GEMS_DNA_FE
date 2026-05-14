import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { fetchPortalCatalog, createMemoRequest } from "../../services/portalApi";
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

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    setLoading(true);
    fetchPortalCatalog(user.id, { type: tab, search, shape })
      .then((d) => alive && setData({ stones: d.stones || [], jewelry: d.jewelry || [] }))
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
    <div className="space-y-5 sm:space-y-7 pb-32">
      <CatalogHero />

      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        {/* Tabs */}
        <div className="border-b border-stone-200 px-3 sm:px-5 flex items-center gap-1 overflow-x-auto">
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
                className={`relative px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors ${active ? "text-stone-900" : "text-stone-500 hover:text-stone-800"}`}
              >
                <span>{t.label}</span>
                <span className="ml-1.5 text-[10px] font-bold text-stone-400">{t.count}</span>
                {active && <span className="absolute left-3 right-3 sm:left-4 sm:right-4 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" />}
              </button>
            );
          })}
        </div>

        {/* Search + filters */}
        <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-stone-200 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.85-5.65a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SKU, shape, color…"
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 bg-white placeholder-stone-400"
            />
          </div>
          {(tab === "all" || tab === "stones") && allShapes.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 scrollbar-hide">
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
          <div className="p-3 sm:p-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {all.map((it) => (
              <CatalogCard key={`${it.kind}-${it.sku || it.id}`} item={it} basket={basket} />
            ))}
          </div>
        )}
      </div>

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
    </div>
  );
}

/* ============================================================
   Hero
   ============================================================ */
function CatalogHero() {
  return (
    <section className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-900 to-blue-900 text-white px-5 sm:px-8 py-6 sm:py-9">
      <div className="absolute inset-0 opacity-30 mix-blend-screen pointer-events-none">
        <div className="absolute -top-16 -left-10 w-64 h-64 bg-indigo-400 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -right-10 w-72 h-72 bg-violet-400 rounded-full blur-3xl" />
      </div>
      <div className="relative max-w-2xl">
        <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-indigo-200/90 mb-2">
          Available inventory
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight tracking-tight">
          Hand-pick what you'd like to memo
        </h1>
        <p className="text-sm sm:text-base text-indigo-100/80 mt-2">
          Browse pieces currently free in our stock. Add what catches your eye to your request — your supplier reviews it and issues the memo for you.
        </p>
      </div>
    </section>
  );
}

/* ============================================================
   Card
   ============================================================ */
function CatalogCard({ item, basket }) {
  const inBasket = basket.has(item);
  const title = item.kind === "jewelry"
    ? (item.name || item.sku)
    : `${item.shape || item.category || "Stone"}${item.weightCt ? ` · ${item.weightCt} ct` : ""}`;
  const sub = item.kind === "jewelry"
    ? [item.metalType, item.metalColor].filter(Boolean).join(" · ") || item.category
    : [item.color, item.clarity, item.origin].filter(Boolean).join(" · ");

  return (
    <div className={`group relative rounded-2xl overflow-hidden border bg-white transition-all ${inBasket ? "border-indigo-300 ring-2 ring-indigo-200" : "border-stone-200 hover:border-stone-300 hover:shadow-md"}`}>
      <div className="aspect-square bg-stone-100 relative overflow-hidden">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={title} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-300">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        <span className={`absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold backdrop-blur ${item.kind === "jewelry" ? "bg-violet-500/90 text-white" : "bg-blue-500/90 text-white"}`}>
          {item.kind === "jewelry" ? "Jewelry" : "Stone"}
        </span>
      </div>
      <div className="p-3 sm:p-3.5">
        <div className="text-[11px] text-stone-400 font-semibold tracking-wide truncate">{item.sku}</div>
        <div className="font-semibold text-stone-900 text-sm leading-tight truncate mt-0.5">{title}</div>
        {sub && <div className="text-[11px] text-stone-500 mt-0.5 truncate">{sub}</div>}
        <button
          onClick={() => basket.toggle(item)}
          className={`mt-3 w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
            inBasket
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-stone-100 text-stone-700 hover:bg-stone-900 hover:text-white"
          }`}
        >
          {inBasket ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Added
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add to request
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function ShapePill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-2.5 py-1.5 rounded-full text-[11px] font-semibold border transition whitespace-nowrap ${
        active
          ? "bg-stone-900 text-white border-stone-900"
          : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
      }`}
    >{label}</button>
  );
}

/* ============================================================
   Floating basket dock
   ============================================================ */
function BasketDock({ onOpen }) {
  const { items, count, remove } = useRequestBasket();
  const [expanded, setExpanded] = useState(false);
  if (count === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 max-w-[calc(100vw-2rem)]">
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2 pl-3 pr-4 py-3 rounded-full bg-stone-900 text-white shadow-2xl shadow-stone-900/20 hover:bg-stone-800 transition-all"
        >
          <span className="relative flex w-8 h-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-600">
            <span className="text-[11px] font-bold">{count}</span>
          </span>
          <span className="text-sm font-semibold">{count} item{count === 1 ? "" : "s"} ready to request</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      ) : (
        <div className="bg-white border border-stone-200 rounded-2xl shadow-2xl shadow-stone-900/15 w-[360px] max-w-full overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
            <div className="text-sm font-semibold text-stone-900">Request basket · {count}</div>
            <button onClick={() => setExpanded(false)} className="text-stone-400 hover:text-stone-700">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-stone-100">
            {items.map((it) => (
              <div key={`${it.kind}-${it.sku}`} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-10 h-10 rounded-lg bg-stone-100 overflow-hidden ring-1 ring-stone-200 shrink-0">
                  {it.imageUrl ? <img src={it.imageUrl} alt="" className="w-full h-full object-cover" /> : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-stone-900 truncate">{it.kind === "jewelry" ? (it.name || it.sku) : `${it.shape || ""} ${it.weightCt ? `${it.weightCt} ct` : ""}`.trim()}</div>
                  <div className="text-[10px] text-stone-400">{it.sku}</div>
                </div>
                <button onClick={() => remove(it)} className="text-stone-400 hover:text-rose-600 text-xs font-semibold">Remove</button>
              </div>
            ))}
          </div>
          <button
            onClick={() => { setExpanded(false); onOpen(); }}
            className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white text-sm font-bold hover:opacity-95"
          >
            Continue to request →
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
            sku: i.sku,
            kind: i.kind,
            name: i.name,
            shape: i.shape,
            category: i.category,
            type: i.type,
            weightCt: i.weightCt,
            color: i.color,
            clarity: i.clarity,
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-xl sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-stone-400">New memo request</div>
            <h3 className="text-lg font-bold text-stone-900 mt-0.5">Review &amp; send</h3>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto space-y-4">
          {items.length > 0 && (
            <div>
              <div className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Items in this request · {items.length}</div>
              <div className="rounded-xl border border-stone-200 divide-y divide-stone-100 max-h-56 overflow-y-auto">
                {items.map((it) => (
                  <div key={`${it.kind}-${it.sku}`} className="flex items-center gap-3 px-3 py-2">
                    <div className="w-9 h-9 rounded-lg bg-stone-100 overflow-hidden ring-1 ring-stone-200 shrink-0">
                      {it.imageUrl ? <img src={it.imageUrl} alt="" className="w-full h-full object-cover" /> : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-stone-900 truncate">{it.kind === "jewelry" ? (it.name || it.sku) : `${it.shape || ""} ${it.weightCt ? `${it.weightCt} ct` : ""}`.trim()}</div>
                      <div className="text-[10px] text-stone-400 truncate">{it.sku}</div>
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${it.kind === "jewelry" ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700"}`}>{it.kind}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5 block">Notes for your supplier (optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder={items.length ? "Anything specific about these pieces? Customer in mind, deadline, preferred sizes…" : "Describe what you're looking for. Shape, carat range, metal, deadline…"}
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 placeholder-stone-400 resize-y"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5 block">Preferred receive date (optional)</label>
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400"
            />
          </div>
          <div className="rounded-xl bg-blue-50/60 border border-blue-100 p-3 text-[12px] text-blue-900 leading-relaxed flex gap-2">
            <svg className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>This is a request, not a confirmed memo. Your supplier reviews availability &amp; pricing and replies with the official memo. You can cancel any time before they convert it.</span>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-stone-200 flex items-center justify-end gap-2 bg-stone-50/70">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-stone-600 hover:bg-stone-200">Cancel</button>
          <button
            onClick={submit}
            disabled={submitting || (items.length === 0 && !message.trim())}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-95"
          >
            {submitting ? "Sending…" : "Send request"}
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
    <div className="px-6 py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-stone-100 mx-auto flex items-center justify-center mb-3">
        <svg className="w-6 h-6 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35m1.85-5.65a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z" />
        </svg>
      </div>
      <div className="font-semibold text-stone-700 text-sm">Nothing matches that</div>
      <div className="text-xs text-stone-400 mt-1 max-w-xs mx-auto">
        Try clearing the filters, or send your supplier a free-text request describing what you're looking for.
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="p-3 sm:p-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-stone-200 overflow-hidden">
          <div className="aspect-square bg-stone-100 animate-pulse" />
          <div className="p-3 space-y-2">
            <div className="h-3 w-1/2 bg-stone-100 rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-stone-200 rounded animate-pulse" />
            <div className="h-3 w-1/3 bg-stone-100 rounded animate-pulse" />
            <div className="h-7 w-full bg-stone-100 rounded animate-pulse mt-2" />
          </div>
        </div>
      ))}
    </div>
  );
}
