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

const STATUS_BADGES = {
  draft: { label: "In design", tone: "bg-stone-100 text-stone-700" },
  design: { label: "In design", tone: "bg-amber-100 text-amber-800" },
  cad: { label: "CAD modeling", tone: "bg-amber-100 text-amber-800" },
  wax: { label: "Wax / mold", tone: "bg-blue-100 text-blue-800" },
  casting: { label: "In casting", tone: "bg-blue-100 text-blue-800" },
  setting: { label: "Stone setting", tone: "bg-purple-100 text-purple-800" },
  polishing: { label: "Polishing", tone: "bg-purple-100 text-purple-800" },
  qc: { label: "Final QC", tone: "bg-purple-100 text-purple-800" },
  ready: { label: "Ready for delivery", tone: "bg-emerald-100 text-emerald-800" },
  sold: { label: "Delivered", tone: "bg-emerald-100 text-emerald-800" },
};

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
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6">
        <div className="text-sm text-stone-500">Loading preview…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6">
        <div className="max-w-md rounded-xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16h.01" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-stone-900">Preview unavailable</h1>
          <p className="mt-2 text-sm text-stone-600">
            {error || "This preview link is no longer active. Please ask your designer for a new link."}
          </p>
        </div>
      </div>
    );
  }

  const { item, stoneSummary } = data;
  const status = STATUS_BADGES[item.status] || { label: item.status, tone: "bg-stone-100 text-stone-700" };
  const totalCarats = Number(stoneSummary?.totalCarats || 0);

  return (
    <div className="min-h-screen bg-stone-50 pb-24 sm:pb-12">
      {/* Brand bar — kept tiny so the piece is the hero, not us. */}
      <div className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-stone-900 to-stone-600" />
            <span className="text-sm font-semibold tracking-tight text-stone-900">GEMS DNA</span>
          </div>
          <span className="text-[11px] uppercase tracking-wide text-stone-500">Design preview</span>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-5 pt-6">
        {/* Hero gallery */}
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          {galleryImages.length ? (
            <>
              <div className="relative aspect-square w-full bg-stone-100">
                <img
                  src={galleryImages[activeImageIdx]?.url}
                  alt={item.name}
                  className="h-full w-full object-cover"
                  onError={(e) => { e.currentTarget.style.opacity = "0.3"; }}
                />
                {galleryImages[activeImageIdx]?.kind && KIND_LABEL[galleryImages[activeImageIdx].kind] && (
                  <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                    {KIND_LABEL[galleryImages[activeImageIdx].kind]}
                  </span>
                )}
              </div>
              {galleryImages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto p-3">
                  {galleryImages.map((img, idx) => (
                    <button
                      key={img.id || idx}
                      type="button"
                      onClick={() => setActiveImageIdx(idx)}
                      className={`flex-shrink-0 overflow-hidden rounded-lg border-2 transition ${
                        idx === activeImageIdx ? "border-stone-900" : "border-transparent hover:border-stone-300"
                      }`}
                    >
                      <img src={img.url} alt="" className="h-16 w-16 object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex aspect-square items-center justify-center bg-stone-100 text-sm text-stone-400">
              Photos coming soon
            </div>
          )}
        </div>

        {/* Title + status + price */}
        <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
              {item.name || "Custom piece"}
            </h1>
            {item.category && (
              <p className="mt-0.5 text-sm text-stone-500">{item.category}</p>
            )}
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.tone}`}>
            {status.label}
          </span>
        </div>

        {item.salePrice && (
          <div className="mt-3 inline-flex items-baseline gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2 shadow-sm">
            <span className="text-[11px] uppercase tracking-wide text-stone-500">Price</span>
            <span className="text-xl font-semibold text-stone-900">
              ${Number(item.salePrice).toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
          </div>
        )}

        {/* Specs */}
        <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Specs</h2>
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
          <section className="mt-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              From your designer
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
              {item.description}
            </p>
          </section>
        )}

        {/* Approval surface */}
        <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
                submitted.action === "approved"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}>
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  {submitted.action === "approved" ? (
                    <path d="M5 13l4 4L19 7" />
                  ) : (
                    <path d="M12 9v3m0 4h.01M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  )}
                </svg>
              </div>
              <p className="text-base font-medium text-stone-900">Thank you</p>
              <p className="max-w-sm text-sm text-stone-600">{submitted.message}</p>
              <button
                type="button"
                onClick={() => setSubmitted(null)}
                className="mt-2 text-xs font-medium text-stone-500 underline hover:text-stone-800"
              >
                Send another response
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-base font-semibold text-stone-900">
                What do you think?
              </h2>
              <p className="mt-1 text-xs text-stone-500">
                Your response goes straight to your designer. You can come back here any time.
              </p>

              <div className="mt-4 space-y-3">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Your name (optional)"
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-500 focus:ring-stone-500"
                  disabled={submitting}
                />
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Notes, questions or change requests…"
                  rows={3}
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-500 focus:ring-stone-500"
                  disabled={submitting}
                />
              </div>

              {/* Action row — wraps on tiny screens so the buttons stack readably. */}
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => submit("approved")}
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
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
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-500 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Request changes
                </button>
                <button
                  type="button"
                  onClick={() => submit("comment")}
                  disabled={submitting || !comment.trim()}
                  title={!comment.trim() ? "Type your message first" : undefined}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Send a message
                </button>
              </div>
            </>
          )}
        </section>

        <p className="mt-6 text-center text-[11px] text-stone-400">
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
      <dt className="text-[11px] uppercase tracking-wide text-stone-500">{label}</dt>
      <dd className={`mt-0.5 text-sm text-stone-900 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
};

export default CustomerSharePage;
