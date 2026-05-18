import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { fetchPublicShare, respondToShare } from "../../services/jewelryApi";

/* =========================================================================
 * Public, no-auth customer preview page.
 *
 * URL: /share/:token
 *
 * The customer lands here from a link the workshop sent them. They see a
 * curated view of the piece (cover + photos + AI mockups + specs), and can
 * approve, request changes, or leave a comment. Each action POSTs back via
 * the unauthenticated public API and is mirrored into the workshop's
 * activity log so they see customer feedback in the main feed.
 *
 * Design priorities, in order:
 *   1. Mobile-first — most customers open these on their phone over a
 *      WhatsApp link. Hero image is full-width, gallery is horizontally
 *      scrollable, CTAs sit fixed at the bottom on small screens.
 *   2. No app chrome — no sidebar, no top bar, no Clerk. The router mounts
 *      this route outside <AppLayout> for that reason.
 *   3. Honest "no longer available" state for revoked / expired tokens, so
 *      the customer doesn't think the link is broken.
 * ========================================================================= */

// v1.0.5 — Status tones neutralised. Emerald is reserved for "ready"
// and "delivered" (positive terminal states). Everything else is a quiet
// graphite pill so the piece itself stays the focal point.
const STATUS_BADGES = {
  draft:     { label: "In design",          tone: "neutral" },
  design:    { label: "In design",          tone: "neutral" },
  cad:       { label: "CAD modeling",       tone: "neutral" },
  wax:       { label: "Wax / mold",         tone: "neutral" },
  casting:   { label: "In casting",         tone: "neutral" },
  setting:   { label: "Stone setting",      tone: "neutral" },
  polishing: { label: "Polishing",          tone: "neutral" },
  qc:        { label: "Final QC",           tone: "neutral" },
  ready:     { label: "Ready for delivery", tone: "positive" },
  sold:      { label: "Delivered",          tone: "positive" },
};
const statusPill = (tone) =>
  tone === "positive"
    ? "bg-brand-emerald/12 text-brand-emerald"
    : "glass-surface text-app-graphite";

const KIND_LABEL = {
  sketch: "Sketch",
  cad: "CAD",
  ai_mockup: "AI mockup",
  progress: "Progress photo",
  final: "Final photo",
};

const CustomerSharePage = () => {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [submitted, setSubmitted] = useState(null); // { action, message }
  const [comment, setComment] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPublicShare(token);
      setData(res);
    } catch (err) {
      setError(err.message || "Couldn't load this preview.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // The cover image is always slot 0 in the gallery (so the customer sees
  // the workshop's chosen "best" face first), then everything else in the
  // order the BE returned. De-dup if cover URL also appears in the list.
  const galleryImages = useMemo(() => {
    if (!data) return [];
    const list = [];
    if (data.item?.coverImageUrl) {
      list.push({
        id: "cover",
        url: data.item.coverImageUrl,
        kind: "final",
        filename: "Cover photo",
      });
    }
    for (const img of data.images || []) {
      if (data.item?.coverImageUrl && img.url === data.item.coverImageUrl) continue;
      list.push(img);
    }
    return list;
  }, [data]);

  const submit = async (action) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await respondToShare(token, {
        action,
        customerName: customerName.trim() || null,
        comment: comment.trim() || null,
      });
      setSubmitted({
        action,
        message:
          action === "approved"
            ? "Approval received. We'll start the next step today."
            : action === "changes_requested"
            ? "Got it — we'll review your notes and come back with options."
            : "Your message reached us. We'll be in touch shortly.",
      });
      setComment("");
    } catch (err) {
      toast.error(err.message || "Couldn't submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen app-canvas flex items-center justify-center px-6">
        <div className="text-[13px] text-app-muted">Loading preview…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen app-canvas flex items-center justify-center px-6">
        <div className="glass-surface-strong rounded-3xl p-8 max-w-md w-full text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-app-surface/60 border border-white/55 backdrop-blur-md text-app-graphite">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16h.01" />
            </svg>
          </div>
          <h1 className="text-[18px] font-semibold tracking-tight text-app-ink">Preview unavailable</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-app-muted">
            {error || "This preview link is no longer active. Please ask your designer for a new link."}
          </p>
        </div>
      </div>
    );
  }

  const { item, stoneSummary } = data;
  const status = STATUS_BADGES[item.status] || { label: item.status, tone: "neutral" };
  const totalCarats = Number(stoneSummary?.totalCarats || 0);

  return (
    <div className="min-h-screen app-canvas pb-24 sm:pb-12">
      {/* Brand bar — quiet glass, ink monogram. The piece must dominate. */}
      <div className="glass-bar">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="relative inline-flex w-7 h-7 rounded-lg bg-app-ink items-center justify-center">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 9L12 22L22 9L12 2Z" fill="white" />
              </svg>
            </span>
            <span className="text-[14px] font-semibold tracking-tight text-app-ink">GEMS DNA</span>
          </div>
          <span className="text-[10.5px] uppercase tracking-[0.14em] font-medium text-app-muted">Design preview</span>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-5 pt-6">
        {/* Hero gallery */}
        <div className="overflow-hidden rounded-3xl glass-surface-strong">
          {galleryImages.length ? (
            <>
              <div className="relative aspect-square w-full bg-app-canvas-2">
                <img
                  src={galleryImages[activeImageIdx]?.url}
                  alt={item.name}
                  className="h-full w-full object-cover"
                  onError={(e) => { e.currentTarget.style.opacity = "0.3"; }}
                />
                {galleryImages[activeImageIdx]?.kind && KIND_LABEL[galleryImages[activeImageIdx].kind] && (
                  <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[10.5px] font-medium tracking-[0.08em] uppercase text-white backdrop-blur-md">
                    {KIND_LABEL[galleryImages[activeImageIdx].kind]}
                  </span>
                )}
              </div>
              {galleryImages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto scrollbar-hide p-3">
                  {galleryImages.map((img, idx) => (
                    <button
                      key={img.id || idx}
                      type="button"
                      onClick={() => setActiveImageIdx(idx)}
                      className={`flex-shrink-0 overflow-hidden rounded-xl ring-2 transition ${
                        idx === activeImageIdx ? "ring-app-ink" : "ring-transparent hover:ring-app-line2"
                      }`}
                    >
                      <img src={img.url} alt="" className="h-16 w-16 object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex aspect-square items-center justify-center bg-app-canvas-2 text-[13px] text-app-soft">
              Photos coming soon
            </div>
          )}
        </div>

        {/* Title + status + price */}
        <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[28px] font-semibold tracking-tight text-app-ink leading-tight">
              {item.name || "Custom piece"}
            </h1>
            {item.category && (
              <p className="mt-1 text-[13px] text-app-muted">{item.category}</p>
            )}
          </div>
          <span className={`rounded-full px-3 py-1 text-[11px] font-medium tracking-[0.04em] ${statusPill(status.tone)}`}>
            {status.label}
          </span>
        </div>

        {item.salePrice && (
          <div className="mt-4 inline-flex items-baseline gap-2 rounded-full glass-surface px-4 py-1.5">
            <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-app-muted">Price</span>
            <span className="text-[18px] font-semibold tracking-tight text-app-ink">
              ${Number(item.salePrice).toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
          </div>
        )}

        {/* Specs */}
        <section className="mt-6 rounded-3xl glass-surface p-5 sm:p-6">
          <h2 className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-app-muted">Specs</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
            <SpecRow label="Metal" value={item.metalSummary} />
            <SpecRow label="Size" value={item.size} />
            <SpecRow
              label="Weight"
              value={item.weightGrams ? `${Number(item.weightGrams).toFixed(2)} g` : null}
            />
            <SpecRow
              label="Stones"
              value={
                stoneSummary?.count
                  ? `${stoneSummary.count}${totalCarats ? ` · ${totalCarats.toFixed(2)} ct total` : ""}`
                  : null
              }
            />
            <SpecRow label="Reference" value={item.sku} mono />
          </dl>
        </section>

        {/* Designer notes */}
        {item.description && (
          <section className="mt-4 rounded-3xl glass-surface p-5 sm:p-6">
            <h2 className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-app-muted">
              From your designer
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-app-ink">
              {item.description}
            </p>
          </section>
        )}

        {/* Approval surface */}
        <section className="mt-6 rounded-3xl glass-surface-strong p-5 sm:p-6">
          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                submitted.action === "approved"
                  ? "bg-brand-emerald/12 text-brand-emerald"
                  : "bg-app-surface/65 border border-white/55 text-app-graphite backdrop-blur-md"
              }`}>
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  {submitted.action === "approved" ? (
                    <path d="M5 13l4 4L19 7" />
                  ) : (
                    <path d="M12 9v3m0 4h.01M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  )}
                </svg>
              </div>
              <p className="text-[15px] font-medium text-app-ink">Thank you</p>
              <p className="max-w-sm text-[13px] text-app-muted leading-relaxed">{submitted.message}</p>
              <button
                type="button"
                onClick={() => setSubmitted(null)}
                className="mt-2 text-[11.5px] font-medium text-app-muted underline hover:text-app-ink"
              >
                Send another response
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-[16px] font-semibold tracking-tight text-app-ink">
                What do you think?
              </h2>
              <p className="mt-1 text-[12px] text-app-muted">
                Your response goes straight to your designer. You can come back here any time.
              </p>

              <div className="mt-4 space-y-3">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Your name (optional)"
                  className="input-modern"
                  disabled={submitting}
                />
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Notes, questions or change requests…"
                  rows={3}
                  className="input-modern !rounded-2xl !py-3"
                  disabled={submitting}
                />
              </div>

              {/* Action row — primary ink CTA + glass secondaries */}
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => submit("approved")}
                  disabled={submitting}
                  className="btn-primary w-full"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                  Approve design
                </button>
                <button
                  type="button"
                  onClick={() => submit("changes_requested")}
                  disabled={submitting || !comment.trim()}
                  title={!comment.trim() ? "Add a note describing the changes" : undefined}
                  className="btn-secondary w-full disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Request changes
                </button>
                <button
                  type="button"
                  onClick={() => submit("comment")}
                  disabled={submitting || !comment.trim()}
                  title={!comment.trim() ? "Type your message first" : undefined}
                  className="btn-secondary w-full disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Send a message
                </button>
              </div>
            </>
          )}
        </section>

        <p className="mt-6 text-center text-[10.5px] text-app-soft tracking-[0.04em]">
          Powered by GEMS DNA · {item.sku || `Item #${item.id}`}
        </p>
      </main>
    </div>
  );
};

const SpecRow = ({ label, value, mono }) => {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-app-muted">{label}</dt>
      <dd className={`mt-1 text-[13.5px] text-app-ink ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
};

export default CustomerSharePage;
