import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  fetchPublicOffer,
  respondToOffer,
  trackOffer,
} from "../../services/offersApi";

/* =========================================================================
 * Public, no-auth, UNBRANDED stone offer page.
 *
 * URL: /o/:token
 *
 * A buyer opens this from a link a salesperson sent (usually over WhatsApp).
 * They see a clean, professional selection of stones — with NO company name,
 * logo, website or inventory source anywhere. The only identity shown is the
 * salesperson's alias and (optionally) a WhatsApp contact button.
 *
 * Anonymity rules enforced here (the BE enforces the rest):
 *   - No BrandMark / "GEMS DNA" / "Powered by" anywhere.
 *   - Neutral <title>, and robots noindex so the link never gets indexed.
 *   - We render only the fields the BE chose to expose (cert/price already
 *     filtered server-side per the offer's toggles).
 * ========================================================================= */

const fmtMoney = (v) =>
  v == null
    ? null
    : `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

const fmtCt = (v) => (v == null ? null : `${Number(v).toFixed(2)} ct`);

const AVAILABILITY = {
  available: { label: "Available", cls: "bg-emerald-500/12 text-emerald-600" },
  reserved: { label: "Reserved", cls: "bg-amber-500/12 text-amber-600" },
  unavailable: { label: "No longer available", cls: "bg-app-canvas-2 text-app-soft" },
};

const waLink = (phone, text) => {
  const digits = String(phone || "").replace(/[^\d]/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
};

const OfferViewPage = () => {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null); // selected item for detail modal

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPublicOffer(token);
      setData(res);
      trackOffer(token, "view");
    } catch (err) {
      setError(err.message || "This selection is no longer active.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // Neutral metadata + noindex. Restores nothing on unmount (page is terminal).
  useEffect(() => {
    const title = data?.offer?.title || data?.offer?.alias || "Stone selection";
    document.title = title;
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", "noindex, nofollow");
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen app-canvas flex items-center justify-center px-6">
        <div className="text-[13px] text-app-muted">Loading…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen app-canvas flex items-center justify-center px-6">
        <div className="glass-surface-strong rounded-3xl p-8 max-w-md w-full text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-app-canvas-2 text-app-graphite">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16h.01" />
            </svg>
          </div>
          <h1 className="text-[18px] font-semibold tracking-tight text-app-ink">
            Selection unavailable
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-app-muted">
            {error || "This link is no longer active. Please ask for a new one."}
          </p>
        </div>
      </div>
    );
  }

  const { offer, items = [] } = data;

  return (
    <div className="min-h-screen app-canvas pb-16">
      {/* Neutral header — alias only, no brand. */}
      <header className="glass-bar">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <div className="min-w-0">
            <div className="text-[15px] font-semibold tracking-tight text-app-ink truncate">
              {offer.title || "Stone selection"}
            </div>
            {offer.alias && (
              <div className="text-[11.5px] text-app-muted truncate">by {offer.alias}</div>
            )}
          </div>
          {offer.contactPhone && (
            <a
              href={waLink(offer.contactPhone, "Hi, I'm looking at the stones you sent.")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-3 py-1.5 text-[12px] font-medium text-emerald-600 hover:bg-emerald-500/20 transition"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              </svg>
              WhatsApp
            </a>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-6 sm:px-5">
        <p className="mb-4 text-[12.5px] text-app-soft">
          {items.length} {items.length === 1 ? "stone" : "stones"} selected for you. Tap any stone for full details.
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <StoneCard key={it.id} item={it} onOpen={() => setActive(it)} />
          ))}
        </div>
      </main>

      {active && (
        <StoneDetail
          item={active}
          offer={offer}
          token={token}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
};

/* ---------- Card ---------- */
const StoneCard = ({ item, onOpen }) => {
  const avail = AVAILABILITY[item.availability] || AVAILABILITY.available;
  const cover = item.imageUrls?.[0];
  const title = [item.shape, fmtCt(item.carat)].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group overflow-hidden rounded-2xl glass-surface text-left transition hover:shadow-md"
    >
      <div className="relative aspect-square w-full bg-app-canvas-2">
        {cover ? (
          <img
            src={cover}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-[1.03]"
            onError={(e) => { e.currentTarget.style.opacity = "0.3"; }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[11px] text-app-soft">
            No image
          </div>
        )}
        {item.videoUrl && (
          <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-md">
            360°
          </span>
        )}
      </div>
      <div className="p-2.5">
        <div className="truncate text-[13px] font-semibold text-app-ink">{title || "Stone"}</div>
        <div className="mt-0.5 flex items-center gap-1 text-[11.5px] text-app-muted">
          {[item.color, item.clarity, item.lab].filter(Boolean).join(" · ") || "—"}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-1">
          <span className="text-[12.5px] font-semibold text-app-ink">
            {item.priceMode === "show" ? fmtMoney(item.price) : "On request"}
          </span>
          <span className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-medium ${avail.cls}`}>
            {avail.label}
          </span>
        </div>
        <div className="mt-1 font-mono text-[10.5px] text-app-soft">{item.reference}</div>
      </div>
    </button>
  );
};

/* ---------- Detail modal ---------- */
const StoneDetail = ({ item, offer, token, onClose }) => {
  const [imgIdx, setImgIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [showAsk, setShowAsk] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    trackOffer(token, "item_view", item.id);
  }, [token, item.id]);

  const images = item.imageUrls || [];
  const title = [item.shape, fmtCt(item.carat)].filter(Boolean).join(" · ") || "Stone";

  const send = async (action) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await respondToOffer(token, {
        action,
        offerItemId: item.id,
        buyerName: buyerName.trim() || null,
        message: message.trim() || null,
      });
      setDone(
        action === "interested"
          ? "Thanks — your interest was sent."
          : action === "reserve_request"
          ? "Reserve request sent. You'll be contacted shortly."
          : "Your message was sent."
      );
      setMessage("");
      setShowAsk(false);
    } catch (err) {
      toast.error(err.message || "Couldn't send. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const specs = [
    ["Reference", item.reference, true],
    ["Shape", item.shape],
    ["Carat", fmtCt(item.carat)],
    ["Color", item.color],
    ["Clarity", item.clarity],
    ["Lab", item.lab],
    ["Certificate", item.certNumber, true],
    ["Measurements", item.measurements],
    ["Treatment", item.treatment],
    ["Origin", item.origin],
  ].filter(([, v]) => v);

  const wa = waLink(
    offer.contactPhone,
    `Hi, I'm interested in stone ${item.reference} (${title}).`
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-app-canvas sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md"
          aria-label="Close"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Gallery */}
        <div className="aspect-square w-full bg-app-canvas-2">
          {images[imgIdx] ? (
            <img src={images[imgIdx]} alt={title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[12px] text-app-soft">
              No image
            </div>
          )}
        </div>
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto p-3">
            {images.map((url, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setImgIdx(i)}
                className={`h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg ring-2 transition ${
                  i === imgIdx ? "ring-app-ink" : "ring-transparent"
                }`}
              >
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[20px] font-semibold tracking-tight text-app-ink">{title}</h2>
            <span className="text-[18px] font-semibold text-app-ink">
              {item.priceMode === "show" ? fmtMoney(item.price) : "On request"}
            </span>
          </div>

          {item.videoUrl && (
            <a
              href={item.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackOffer(token, "media_open", item.id)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full glass-surface px-3 py-1.5 text-[12px] font-medium text-app-graphite hover:text-app-ink"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <circle cx="12" cy="12" r="9" />
              </svg>
              View 360° / video
            </a>
          )}

          {/* Specs */}
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3">
            {specs.map(([label, value, mono]) => (
              <div key={label}>
                <dt className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-app-muted">{label}</dt>
                <dd className={`mt-0.5 text-[13px] text-app-ink ${mono ? "font-mono" : ""}`}>{value}</dd>
              </div>
            ))}
          </dl>

          {/* Actions */}
          {done ? (
            <div className="mt-6 rounded-2xl bg-emerald-500/10 p-4 text-center text-[13px] font-medium text-emerald-600">
              {done}
            </div>
          ) : (
            <div className="mt-6 space-y-2">
              {showAsk && (
                <div className="space-y-2">
                  <input
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="Your name (optional)"
                    className="input-modern"
                    disabled={submitting}
                  />
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Your question…"
                    rows={3}
                    className="input-modern !rounded-2xl !py-3"
                    disabled={submitting}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => send("interested")}
                  disabled={submitting}
                  className="btn-primary w-full"
                >
                  I'm interested
                </button>
                <button
                  type="button"
                  onClick={() => send("reserve_request")}
                  disabled={submitting}
                  className="btn-secondary w-full"
                >
                  Reserve
                </button>
                {!showAsk ? (
                  <button
                    type="button"
                    onClick={() => setShowAsk(true)}
                    disabled={submitting}
                    className="btn-secondary w-full"
                  >
                    Ask a question
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => send("question")}
                    disabled={submitting || !message.trim()}
                    className="btn-secondary w-full disabled:opacity-45"
                  >
                    Send question
                  </button>
                )}
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-500/12 px-3 py-2 text-[13px] font-medium text-emerald-600 hover:bg-emerald-500/20"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                    </svg>
                    WhatsApp
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfferViewPage;
