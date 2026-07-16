import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

/* ============================================================================
 * MediaViewer — public viewer behind the CERT / VIDEO buttons in the exported
 * catalog PDF.
 *
 * A PDF can't open dialogs, so its buttons link here instead of dumping the
 * client on a raw Vimeo / lab URL: a clean dark page with the SKU and the
 * media front-and-center. Videos play the direct 1080p MP4 in a native
 * player; certificates render inline (image or embedded document) with an
 * "Open original" escape hatch for lab sites that block embedding.
 *
 * DELIBERATELY UNBRANDED — no logo, no company name, no links back to the
 * seller. Clients forward these pages down the chain, and the middleman must
 * be able to do that without revealing their source.
 *
 * Query params:  ?type=video|cert  &src=<encoded https url>  &sku=<sku>
 * No auth — recipients are clients. The page renders media only; the URLs it
 * shows are the same ones the PDF/WhatsApp message already exposes.
 * ========================================================================== */

const IMAGE_RE = /\.(jpe?g|png|webp|gif)(\?|$)/i;

/* Direct video FILES (Vimeo's progressive MP4s) play in the native <video>
 * player at full quality. Anything else — V360 spins, player pages — is an
 * interactive web viewer, not a file, and must be embedded as an iframe. */
const isVideoFile = (src) =>
  /\.(mp4|webm|mov|m4v)(\?|$)/i.test(src) ||
  /vimeocdn\.com/i.test(src) ||
  /player\.vimeo\.com\/progressive/i.test(src);

const MediaViewer = () => {
  const [params] = useSearchParams();
  const type = (params.get("type") || "").toLowerCase();
  const sku = (params.get("sku") || "").trim();
  const src = useMemo(() => {
    const raw = String(params.get("src") || "").trim();
    return /^https:\/\//i.test(raw) ? raw : null;
  }, [params]);

  const [videoStarted, setVideoStarted] = useState(false);

  const heading = type === "cert" ? "CERTIFICATE" : "VIDEO";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#141414] text-white">
      {/* Header — media type + SKU only. No logo or company identity here. */}
      <header className="flex flex-col items-center px-5 pb-2 pt-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50">
          {heading}
        </p>
        {sku && (
          <h1 className="mt-1 text-[20px] font-semibold tracking-wide">{sku}</h1>
        )}
      </header>

      {/* Media */}
      <main className="flex flex-1 items-center justify-center px-4 py-5">
        {!src ? (
          <p className="max-w-sm text-center text-[14px] leading-relaxed text-white/60">
            This link is missing or invalid.
          </p>
        ) : type === "video" && !isVideoFile(src) ? (
          /* Interactive viewers (V360 spins, player pages) — embedded frame.
             The viewer page itself handles playback and drag-to-spin. */
          <div className="w-full max-w-[720px] overflow-hidden rounded-2xl bg-black shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
            <iframe
              src={src}
              title={sku ? `${sku} video` : "Video"}
              className="aspect-square w-full border-0"
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          </div>
        ) : type === "video" ? (
          <div className="relative w-full max-w-[720px] overflow-hidden rounded-2xl bg-black shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={src}
              className="aspect-square w-full select-none object-contain"
              playsInline
              loop
              controls={videoStarted}
              preload="metadata"
              onPlay={() => setVideoStarted(true)}
            />
            {/* Big centered play button — CSS-hidden once playback starts
                (never unmounted; see the iOS dead-taps saga in VimeoEmbed). */}
            <button
              type="button"
              aria-label="Play video"
              aria-hidden={videoStarted}
              tabIndex={videoStarted ? -1 : 0}
              onClick={(e) => {
                const v = e.currentTarget.parentElement.querySelector("video");
                v?.play().catch(() => {});
              }}
              className={`absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-[0_4px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm transition-opacity duration-200 active:scale-95 ${
                videoStarted ? "pointer-events-none opacity-0" : "opacity-100"
              }`}
            >
              <svg className="ml-1 h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86A1 1 0 008 5.14z" />
              </svg>
            </button>
          </div>
        ) : IMAGE_RE.test(src) ? (
          <img
            src={src}
            alt={sku ? `${sku} certificate` : "Certificate"}
            className="max-h-[75dvh] w-auto max-w-full rounded-xl bg-white shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]"
          />
        ) : (
          <div className="flex w-full max-w-[820px] flex-col items-center gap-4">
            {/* Some lab sites refuse to be embedded (X-Frame-Options) — the
                button below always works, so a blocked frame is never a dead
                end. */}
            <iframe
              src={src}
              title={sku ? `${sku} certificate` : "Certificate"}
              className="h-[70dvh] w-full rounded-xl border-0 bg-white shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]"
            />
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/25 px-5 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/80 transition hover:border-white/50 hover:text-white"
            >
              Open original certificate
            </a>
          </div>
        )}
      </main>

      {/* No footer — nothing identifying the seller (see header note). */}
      <div className="pb-8" aria-hidden />
    </div>
  );
};

export default MediaViewer;
