import React, { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  listJewelryShares,
  createJewelryShare,
  revokeJewelryShare,
  listJewelryShareResponses,
  generateAiMockup,
} from "../../../services/jewelryApi";

/* =========================================================================
 * Customer Preview tab — workshop side.
 *
 * Replaces the old "3D Preview" tab. Two stacked sections:
 *
 *   1. AI Mockups
 *      Free-text prompt → OpenAI gpt-image-1 → blob → registered as a
 *      jewelry_item_files row (kind='ai_mockup'). Existing mockups for
 *      this item are listed below the prompt with thumbnails.
 *
 *   2. Customer share links
 *      Generate / copy / revoke opaque public links of the form
 *      /share/<token>. Each link tracks views + customer responses
 *      (approve / changes / comments) which we render as a timeline.
 *
 * The whole panel is data-driven — no hard-coded ringkit, no three.js,
 * no procedural anything. Mounting cost is one fetch for shares + one
 * fetch for responses. Mockups already live in `item.files` / the Files
 * tab, so we just filter that list here.
 * ========================================================================= */

const CustomerPreviewPanel = ({ item, files = [], onItemUpdated, currentUserId }) => {
  const itemId = item?.id;

  /* ---------- AI mockups ---------- */
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [setAsCover, setSetAsCover] = useState(false);
  const [useItemContext, setUseItemContext] = useState(true);

  // Pull existing mockups straight off the files prop — saves a round trip
  // and stays in sync with the Files tab automatically.
  const aiMockups = useMemo(
    () => (files || []).filter((f) => f.kind === "ai_mockup"),
    [files]
  );

  const generate = async () => {
    const cleaned = prompt.trim();
    if (!cleaned) {
      toast.error("Describe what to render first.");
      return;
    }
    setGenerating(true);
    try {
      await generateAiMockup(itemId, {
        prompt: cleaned,
        userId: currentUserId,
        useItemContext,
        setAsCover,
      });
      toast.success("Mockup generated");
      setPrompt("");
      setSetAsCover(false);
      if (typeof onItemUpdated === "function") await onItemUpdated();
    } catch (err) {
      toast.error(err.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  /* ---------- Shares ---------- */
  const [shares, setShares] = useState([]);
  const [responses, setResponses] = useState([]);
  const [loadingShares, setLoadingShares] = useState(true);
  const [creatingShare, setCreatingShare] = useState(false);
  const [shareNotes, setShareNotes] = useState("");
  const [shareExpiry, setShareExpiry] = useState(""); // YYYY-MM-DD

  const loadShares = useCallback(async () => {
    if (!itemId) return;
    setLoadingShares(true);
    try {
      const [sharesRes, respRes] = await Promise.all([
        listJewelryShares(itemId),
        listJewelryShareResponses(itemId).catch(() => ({ responses: [] })),
      ]);
      setShares(sharesRes.shares || []);
      setResponses(respRes.responses || []);
    } catch (err) {
      console.warn("Failed to load shares:", err);
    } finally {
      setLoadingShares(false);
    }
  }, [itemId]);

  useEffect(() => { loadShares(); }, [loadShares]);

  const createShare = async () => {
    setCreatingShare(true);
    try {
      // Convert YYYY-MM-DD into end-of-day ISO so the link works the whole
      // chosen day in the customer's timezone (close enough — we don't
      // collect the customer's TZ on this surface).
      const expiresAt = shareExpiry
        ? new Date(`${shareExpiry}T23:59:59Z`).toISOString()
        : null;
      await createJewelryShare(itemId, {
        userId: currentUserId,
        expiresAt,
        notes: shareNotes.trim() || null,
      });
      toast.success("Share link created");
      setShareNotes("");
      setShareExpiry("");
      await loadShares();
    } catch (err) {
      toast.error(err.message || "Couldn't create share");
    } finally {
      setCreatingShare(false);
    }
  };

  const revokeShare = async (shareId) => {
    if (!window.confirm("Revoke this share link? The customer will no longer be able to open it.")) return;
    try {
      await revokeJewelryShare(itemId, shareId);
      toast.success("Link revoked");
      await loadShares();
    } catch (err) {
      toast.error(err.message || "Couldn't revoke share");
    }
  };

  const copyShareUrl = async (token) => {
    const url = buildShareUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch (_) {
      // Fallback for older browsers / insecure context
      window.prompt("Copy this link:", url);
    }
  };

  const responsesByShare = useMemo(() => {
    const map = {};
    for (const r of responses) {
      (map[r.share_id] = map[r.share_id] || []).push(r);
    }
    return map;
  }, [responses]);

  return (
    <div className="space-y-5">
      {/* ============ AI Mockups ============ */}
      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-stone-900">AI mockup</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            Generate a photoreal preview from a description. Useful when you
            need to show the customer a direction before any CAD work is done.
          </p>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Pear-cut emerald centre stone with two side baguette diamonds, 18K yellow gold band, vintage art-deco feel."
          rows={3}
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-500"
          disabled={generating}
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3 text-xs text-stone-700">
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={useItemContext}
                onChange={(e) => setUseItemContext(e.target.checked)}
                disabled={generating}
                className="h-3.5 w-3.5 rounded border-stone-400 text-emerald-600 focus:ring-emerald-500"
              />
              Include item context (metal / size / category)
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={setAsCover}
                onChange={(e) => setSetAsCover(e.target.checked)}
                disabled={generating}
                className="h-3.5 w-3.5 rounded border-stone-400 text-emerald-600 focus:ring-emerald-500"
              />
              Set as cover photo
            </label>
          </div>
          <button
            type="button"
            onClick={generate}
            disabled={generating || !prompt.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                  <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Rendering…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4l16 8-16 8 4-8-4-8z" strokeLinejoin="round" />
                </svg>
                Generate mockup
              </>
            )}
          </button>
        </div>

        {generating && (
          <p className="mt-2 text-[11px] text-stone-500">
            This usually takes 15-30 seconds. Don't navigate away.
          </p>
        )}

        {aiMockups.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">
              Mockups for this piece
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {aiMockups.map((m) => (
                <a
                  key={m.id}
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative aspect-square overflow-hidden rounded-lg border border-stone-200 bg-stone-100"
                >
                  <img src={m.url} alt="AI mockup" className="h-full w-full object-cover transition group-hover:scale-105" />
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    AI
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ============ Share links ============ */}
      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Customer share links</h2>
            <p className="mt-0.5 text-xs text-stone-500">
              Generate a public link the customer can open from any device — no
              login needed. They can approve, request changes, or leave a
              comment, and you'll see it in the activity feed.
            </p>
          </div>
        </div>

        {/* Create form */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <input
              type="text"
              value={shareNotes}
              onChange={(e) => setShareNotes(e.target.value)}
              placeholder="Internal note for this link (optional, e.g. 'sent via WhatsApp')"
              className="w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:ring-emerald-500"
              disabled={creatingShare}
            />
            <input
              type="date"
              value={shareExpiry}
              onChange={(e) => setShareExpiry(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              title="Optional expiry date"
              className="w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:ring-emerald-500"
              disabled={creatingShare}
            />
            <button
              type="button"
              onClick={createShare}
              disabled={creatingShare}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creatingShare ? "Creating…" : "Generate link"}
            </button>
          </div>
        </div>

        {/* Existing shares */}
        <div className="mt-4 space-y-3">
          {loadingShares && <p className="text-xs text-stone-500">Loading…</p>}
          {!loadingShares && shares.length === 0 && (
            <p className="text-sm text-stone-500">No share links yet.</p>
          )}
          {shares.map((s) => (
            <ShareCard
              key={s.id}
              share={s}
              responses={responsesByShare[s.id] || []}
              onCopy={() => copyShareUrl(s.token)}
              onRevoke={() => revokeShare(s.id)}
            />
          ))}
        </div>
      </section>
    </div>
  );
};

/* ---------- Sub-components ---------- */

function ShareCard({ share, responses, onCopy, onRevoke }) {
  const url = buildShareUrl(share.token);
  const isRevoked = Boolean(share.revoked_at);
  const isExpired = share.expires_at && new Date(share.expires_at).getTime() < Date.now();
  const usable = !isRevoked && !isExpired;

  // Customer-facing responses (everything except 'viewed') get the
  // chronological timeline treatment. Plain 'viewed' rows are summarised
  // by the view counter on the share row itself.
  const meaningful = responses.filter((r) => r.action !== "viewed");

  return (
    <div
      className={`rounded-lg border p-3 ${
        usable ? "border-stone-200 bg-white" : "border-stone-200 bg-stone-50 opacity-80"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <code className="truncate rounded bg-stone-100 px-2 py-0.5 text-[11px] text-stone-800">
              {url}
            </code>
            {isRevoked && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-800">
                Revoked
              </span>
            )}
            {!isRevoked && isExpired && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                Expired
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-stone-500">
            <span>Created {fmtDate(share.created_at)}</span>
            {share.expires_at && <span>· Expires {fmtDate(share.expires_at)}</span>}
            {share.view_count > 0 && (
              <span>
                · {share.view_count} view{share.view_count === 1 ? "" : "s"}
                {share.last_viewed_at ? ` (last ${timeAgo(share.last_viewed_at)})` : ""}
              </span>
            )}
            {share.notes && (
              <span className="italic">· {share.notes}</span>
            )}
          </div>
          {(share.approve_count > 0 || share.change_request_count > 0 || share.comment_count > 0) && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {share.approve_count > 0 && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                  ✓ {share.approve_count} approval{share.approve_count === 1 ? "" : "s"}
                </span>
              )}
              {share.change_request_count > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                  {share.change_request_count} change request{share.change_request_count === 1 ? "" : "s"}
                </span>
              )}
              {share.comment_count > 0 && (
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-700">
                  {share.comment_count} comment{share.comment_count === 1 ? "" : "s"}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-shrink-0 gap-1.5">
          {usable && (
            <>
              <button
                type="button"
                onClick={onCopy}
                className="rounded border border-stone-300 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-50"
              >
                Copy link
              </button>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="rounded border border-stone-300 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-50"
              >
                Open
              </a>
              <button
                type="button"
                onClick={onRevoke}
                className="rounded border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50"
              >
                Revoke
              </button>
            </>
          )}
        </div>
      </div>

      {meaningful.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-stone-100 pt-3">
          {meaningful.map((r) => (
            <li key={r.id} className="flex gap-2 text-xs">
              <span className={`mt-0.5 inline-flex h-5 items-center rounded-full px-2 text-[10px] font-medium ${
                r.action === "approved"
                  ? "bg-emerald-100 text-emerald-800"
                  : r.action === "changes_requested"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-stone-100 text-stone-700"
              }`}>
                {r.action === "approved"
                  ? "Approved"
                  : r.action === "changes_requested"
                  ? "Changes"
                  : "Comment"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-stone-700">
                  <span className="font-medium">{r.customer_name || "Anonymous"}</span>
                  <span className="ml-2 text-[10px] text-stone-400">
                    {timeAgo(r.created_at)}
                  </span>
                </div>
                {r.comment && (
                  <p className="mt-0.5 whitespace-pre-wrap text-stone-600">{r.comment}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- helpers ---------- */

function buildShareUrl(token) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/share/${token}`;
}

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default CustomerPreviewPanel;
