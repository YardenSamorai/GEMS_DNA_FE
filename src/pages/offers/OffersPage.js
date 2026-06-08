import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { useRouteLoading } from "../../components/RouteLoadingContext";
import {
  fetchOffers,
  fetchOffer,
  revokeOffer,
  offerPublicUrl,
} from "../../services/offersApi";

/* ============================================================================
 * Offers — the salesperson's outbox of anonymous stone links.
 *
 * Each offer is one /o/:token link sent to a buyer. This page lists them with
 * live engagement (views + responses), and a detail drawer to copy/reshare the
 * link, see exactly what the buyer sees, read their responses, and revoke.
 * ========================================================================== */

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

const fmtMoney = (v) =>
  v == null ? null : `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const offerState = (o) => {
  if (o.revoked_at || o.status === "revoked") return { label: "Revoked", cls: "bg-app-canvas-2 text-app-soft" };
  if (o.expires_at && new Date(o.expires_at).getTime() < Date.now())
    return { label: "Expired", cls: "bg-amber-500/12 text-amber-600" };
  return { label: "Active", cls: "bg-emerald-500/12 text-emerald-600" };
};

const RESPONSE_LABEL = {
  interested: "Interested",
  reserve_request: "Reserve request",
  question: "Question",
  viewed: "Viewed",
};

const Kpi = ({ label, value }) => (
  <div className="rounded-2xl glass-surface p-4">
    <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-app-soft">{label}</div>
    <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-app-ink">{value}</div>
  </div>
);

const OffersPage = () => {
  const { user } = useUser();
  const userId = user?.id;
  const { id } = useParams();
  const navigate = useNavigate();

  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  useRouteLoading(initialLoading);

  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState(null); // { offer, items, responses, views }
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(() => {
    if (!userId) return;
    setLoading(true);
    fetchOffers(userId)
      .then((res) => setOffers(res.offers || []))
      .catch((err) => toast.error(err.message || "Failed to load offers"))
      .finally(() => { setLoading(false); setInitialLoading(false); });
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const openDetail = useCallback((offerId) => {
    if (!userId) return;
    setDetailLoading(true);
    fetchOffer(offerId, userId)
      .then((res) => setDetail(res))
      .catch((err) => toast.error(err.message || "Failed to load offer"))
      .finally(() => setDetailLoading(false));
  }, [userId]);

  // Deep link /offers/:id opens the drawer once offers/user are ready.
  useEffect(() => {
    if (id && userId) openDetail(id);
  }, [id, userId, openDetail]);

  const closeDetail = () => {
    setDetail(null);
    if (id) navigate("/offers");
  };

  const stats = useMemo(() => {
    const active = offers.filter((o) => offerState(o).label === "Active").length;
    const views = offers.reduce((a, b) => a + (Number(b.view_count) || 0), 0);
    const responses = offers.reduce((a, b) => a + (Number(b.response_count) || 0), 0);
    return { total: offers.length, active, views, responses };
  }, [offers]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return offers;
    return offers.filter((o) =>
      [o.title, o.alias, o.buyer_label].filter(Boolean).some((s) => s.toLowerCase().includes(q))
    );
  }, [offers, search]);

  const handleRevoke = async (offerId) => {
    try {
      await revokeOffer(offerId, userId);
      toast.success("Offer revoked");
      load();
      if (detail?.offer?.id === offerId) openDetail(offerId);
    } catch (err) {
      toast.error(err.message || "Couldn't revoke");
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <h1 className="text-2xl font-semibold tracking-tight text-app-ink">Offers</h1>
            <span className="text-sm text-app-muted">Anonymous stone links you sent</span>
          </div>
          <p className="mt-1 text-xs text-app-soft">
            Create offers from inventory: select stones → Actions → Create offer.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Offers" value={loading ? "—" : stats.total.toLocaleString()} />
        <Kpi label="Active" value={loading ? "—" : stats.active.toLocaleString()} />
        <Kpi label="Total views" value={loading ? "—" : stats.views.toLocaleString()} />
        <Kpi label="Responses" value={loading ? "—" : stats.responses.toLocaleString()} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, alias or buyer…"
            className="h-9 w-full rounded-lg border border-app-line bg-app-canvas-2 pl-9 pr-3 text-[13px] text-app-ink focus:border-app-line-2 focus:outline-none"
          />
        </div>
      </div>

      {/* List */}
      <div className="mt-4 overflow-hidden rounded-2xl glass-surface">
        {loading ? (
          <div className="p-10 text-center text-[13px] text-app-muted">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-[14px] font-medium text-app-ink">No offers yet</p>
            <p className="mt-1 text-[12.5px] text-app-soft">
              Go to Inventory, select stones, then Actions → Create offer.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-app-line">
            {visible.map((o) => {
              const st = offerState(o);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => openDetail(o.id)}
                  className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-app-canvas-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-medium text-app-ink">
                        {o.title || "Untitled offer"}
                      </span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${st.cls}`}>{st.label}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[12px] text-app-soft">
                      {[o.alias && `by ${o.alias}`, o.buyer_label, `${o.item_count} stone${o.item_count === 1 ? "" : "s"}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <div className="text-[12px] text-app-ink">{o.view_count || 0} views</div>
                    <div className="text-[11px] text-app-soft">{o.response_count || 0} responses</div>
                  </div>
                  <div className="hidden shrink-0 text-right text-[11.5px] text-app-soft md:block">
                    {fmtDate(o.created_at)}
                  </div>
                  <svg className="h-4 w-4 shrink-0 text-app-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {(detail || detailLoading) && (
        <OfferDrawer
          detail={detail}
          loading={detailLoading}
          onClose={closeDetail}
          onRevoke={handleRevoke}
        />
      )}
    </div>
  );
};

/* ---------- Detail drawer ---------- */
const OfferDrawer = ({ detail, loading, onClose, onRevoke }) => {
  const offer = detail?.offer;
  const items = detail?.items || [];
  const responses = detail?.responses || [];
  const url = offer ? offerPublicUrl(offer.token) : "";
  const st = offer ? offerState(offer) : null;

  const viewsByItem = useMemo(() => {
    const m = {};
    for (const v of detail?.views || []) m[v.item_id] = v.views;
    return m;
  }, [detail]);

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    catch (_) { toast.error("Copy failed"); }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-app-canvas shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {loading || !offer ? (
          <div className="flex h-full items-center justify-center text-[13px] text-app-muted">Loading…</div>
        ) : (
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[18px] font-semibold tracking-tight text-app-ink">
                    {offer.title || "Untitled offer"}
                  </h2>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${st.cls}`}>{st.label}</span>
                </div>
                <p className="mt-0.5 text-[12px] text-app-soft">
                  {[offer.alias && `by ${offer.alias}`, offer.buyer_label].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <button type="button" onClick={onClose} className="text-app-soft hover:text-app-ink" aria-label="Close">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Link */}
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-app-line bg-app-canvas-2 p-2">
              <span className="flex-1 truncate font-mono text-[11.5px] text-app-graphite">{url}</span>
              <button type="button" onClick={copyLink} className="btn-secondary shrink-0 !py-1.5 !text-[12px]">Copy</button>
              <a href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary shrink-0 !py-1.5 !text-[12px]">Open</a>
            </div>

            {/* Meta */}
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-app-canvas-2 p-2.5">
                <div className="text-[16px] font-semibold text-app-ink">{offer.view_count || 0}</div>
                <div className="text-[10.5px] text-app-soft">Views</div>
              </div>
              <div className="rounded-xl bg-app-canvas-2 p-2.5">
                <div className="text-[16px] font-semibold text-app-ink">{items.length}</div>
                <div className="text-[10.5px] text-app-soft">Stones</div>
              </div>
              <div className="rounded-xl bg-app-canvas-2 p-2.5">
                <div className="text-[16px] font-semibold text-app-ink">
                  {responses.filter((r) => r.action !== "viewed").length}
                </div>
                <div className="text-[10.5px] text-app-soft">Responses</div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-app-soft">
              <span>Created {fmtDate(offer.created_at)}</span>
              <span>Expires {offer.expires_at ? fmtDate(offer.expires_at) : "never"}</span>
              <span>Cert {offer.show_certificate ? "shown" : "hidden"}</span>
              <span>SKU {offer.hide_sku ? "hidden" : "shown"}</span>
            </div>

            {/* Responses */}
            {responses.filter((r) => r.action !== "viewed").length > 0 && (
              <div className="mt-5">
                <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-app-soft">Responses</div>
                <div className="space-y-2">
                  {responses.filter((r) => r.action !== "viewed").map((r) => (
                    <div key={r.id} className="rounded-xl border border-app-line bg-app-canvas-2 p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[12.5px] font-medium text-app-ink">
                          {RESPONSE_LABEL[r.action] || r.action}
                          {r.buyer_name ? ` · ${r.buyer_name}` : ""}
                        </span>
                        <span className="text-[10.5px] text-app-soft">{fmtDate(r.created_at)}</span>
                      </div>
                      {r.message && <p className="mt-1 text-[12px] text-app-graphite">{r.message}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stones */}
            <div className="mt-5">
              <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-app-soft">Stones</div>
              <div className="space-y-2">
                {items.map((it) => (
                  <div key={it.id} className="flex items-center gap-3 rounded-xl border border-app-line bg-app-canvas-2 p-2">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-app-canvas">
                      {Array.isArray(it.image_urls) && it.image_urls[0] ? (
                        <img src={it.image_urls[0]} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-medium text-app-ink">
                        {[it.shape, it.carat ? `${Number(it.carat).toFixed(2)}ct` : null].filter(Boolean).join(" · ") || it.temp_ref}
                      </div>
                      <div className="truncate font-mono text-[10.5px] text-app-soft">
                        {offer.hide_sku ? it.temp_ref : (it.source_sku || it.temp_ref)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[12px] font-medium text-app-ink">
                        {it.price_mode === "show" && it.price != null ? fmtMoney(it.price) : "On request"}
                      </div>
                      <div className="text-[10.5px] text-app-soft">{viewsByItem[it.id] || 0} views</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Revoke */}
            {st.label === "Active" && (
              <button
                type="button"
                onClick={() => onRevoke(offer.id)}
                className="mt-6 w-full rounded-xl border border-red-500/30 bg-red-500/8 px-4 py-2.5 text-[13px] font-medium text-red-500 transition hover:bg-red-500/15"
              >
                Revoke link
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OffersPage;
