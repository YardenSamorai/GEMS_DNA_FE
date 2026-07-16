import React, { useEffect, useRef, useState } from "react";
import Player from "@vimeo/player";
import { enhanceVimeoUrl } from "./SalesInventory";

const API_BASE = process.env.REACT_APP_API_URL || "https://gems-dna-be.onrender.com";

/* ============================================================================
 * VimeoEmbed — full-quality video for the product pages.
 *
 * Why not just the Vimeo iframe? iOS Safari plays embedded Vimeo through
 * Apple's native HLS engine, which picks the rendition by player size and
 * ignores every quality instruction (URL param, SDK setQuality). A ~390px
 * square player gets the blurry 240p/360p stream no matter what we ask —
 * that's why videos looked great on desktop but terrible on iPhone.
 *
 * Fix: the BE exposes /api/vimeo-file/:id (Vimeo API + Pro account), which
 * returns the direct progressive MP4 at the highest rendition (usually
 * 1080p). We play that in a native <video> — one fixed-quality file, no
 * adaptive engine, no way to degrade. A big centered play button starts it.
 *
 * If the MP4 can't be resolved (endpoint down, token missing, brand-new
 * video still transcoding) we fall back to the old quality-locked iframe.
 * Non-Vimeo sources (V360 spins, YouTube) render as a plain iframe.
 * ========================================================================== */

const vimeoId = (url) => {
  const m = /player\.vimeo\.com\/video\/(\d+)/i.exec(url || "");
  return m ? m[1] : null;
};

/* In-module cache so swiping back and forth doesn't refetch the link. */
const fileCache = new Map(); // videoId -> link | null (null = resolution failed)

/* IMPORTANT (iOS): this overlay is never unmounted — it fades out via CSS
 * (`opacity-0 pointer-events-none`) when playback starts. Removing a DOM node
 * mid-touch is a long-standing Safari bug that breaks tap-to-click dispatch
 * for the whole page afterwards (scrolling keeps working but taps go dead). */
const PlayOverlay = ({ onClick, hidden }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Play video"
    aria-hidden={hidden}
    tabIndex={hidden ? -1 : 0}
    className={`absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-[0_4px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm transition-opacity duration-200 active:scale-95 ${
      hidden ? "pointer-events-none opacity-0" : "opacity-100"
    }`}
  >
    <svg className="ml-1 h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86A1 1 0 008 5.14z" />
    </svg>
  </button>
);

/* ---- Native MP4 player (the preferred path) ------------------------------ */
const NativeVideo = ({ fileUrl, title }) => {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  // Pause before unmount so iOS doesn't hold a dangling media session.
  useEffect(() => {
    const el = videoRef.current;
    return () => {
      try {
        el?.pause();
      } catch {
        /* non-fatal */
      }
    };
  }, []);

  const handlePlay = () => {
    videoRef.current?.play().catch(() => {});
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        src={fileUrl}
        title={title}
        className="h-full w-full object-contain"
        playsInline
        loop
        controls={playing}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <PlayOverlay onClick={handlePlay} hidden={playing} />
    </div>
  );
};

/* ---- Quality-locked iframe (fallback path) ------------------------------- */
const QUALITY_ORDER = ["2160p", "1440p", "1080p", "720p", "540p"];

const IframeVideo = ({ src, title }) => {
  const iframeRef = useRef(null);
  const playerRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!iframeRef.current) return undefined;
    const player = new Player(iframeRef.current);
    playerRef.current = player;

    const onPlay = () => setPlaying(true);
    const onStop = () => setPlaying(false);
    player.on("play", onPlay);
    player.on("pause", onStop);
    player.on("ended", onStop);

    player
      .ready()
      .then(async () => {
        let available = [];
        try {
          const qualities = await player.getQualities();
          available = (qualities || []).map((q) => q.id || q);
        } catch {
          /* getQualities unsupported */
        }
        for (const q of QUALITY_ORDER) {
          if (available.length && !available.includes(q)) continue;
          try {
            await player.setQuality(q);
            return;
          } catch {
            /* try next */
          }
        }
      })
      .catch(() => {});

    return () => {
      player.off("play", onPlay);
      player.off("pause", onStop);
      player.off("ended", onStop);
      try {
        player.pause().catch(() => {});
      } catch {
        /* already gone */
      }
      // iOS: release ghost focus from the removed iframe, otherwise taps die
      // page-wide after Back navigation.
      try {
        const ae = document.activeElement;
        if (ae && (ae === iframeRef.current || ae.tagName === "IFRAME")) {
          ae.blur();
          window.focus();
        }
      } catch {
        /* non-fatal */
      }
      playerRef.current = null;
    };
  }, []);

  const handlePlay = () => {
    playerRef.current?.play().catch(() => {});
    setPlaying(true);
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      <iframe
        ref={iframeRef}
        src={enhanceVimeoUrl(src)}
        title={title}
        className="h-full w-full"
        frameBorder="0"
        allow="autoplay; fullscreen"
        allowFullScreen
      />
      <PlayOverlay onClick={handlePlay} hidden={playing} />
    </div>
  );
};

/* ---- Entry component ------------------------------------------------------ */
const VimeoEmbed = ({ src, title }) => {
  const id = vimeoId(src);
  // undefined = still resolving, null = failed (use iframe), string = MP4 url
  const [fileUrl, setFileUrl] = useState(() => (id && fileCache.has(id) ? fileCache.get(id) : undefined));

  useEffect(() => {
    if (!id || fileUrl !== undefined) return undefined;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/vimeo-file/${id}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        const link = data?.link || null;
        fileCache.set(id, link);
        if (alive) setFileUrl(link);
      } catch {
        fileCache.set(id, null);
        if (alive) setFileUrl(null);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!id) {
    // Non-Vimeo (V360, YouTube) — plain iframe, untouched.
    return (
      <iframe
        src={src}
        title={title}
        className="h-full w-full"
        frameBorder="0"
        allow="autoplay; fullscreen"
        allowFullScreen
      />
    );
  }

  if (fileUrl === undefined) {
    // Resolving the direct file — brief black placeholder (sub-second).
    return <div className="h-full w-full bg-black" />;
  }

  return fileUrl ? (
    <NativeVideo fileUrl={fileUrl} title={title} />
  ) : (
    <IframeVideo src={src} title={title} />
  );
};

export default VimeoEmbed;
