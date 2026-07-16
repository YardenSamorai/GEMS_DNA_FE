import React, { useEffect, useRef, useState } from "react";
import Player from "@vimeo/player";
import { enhanceVimeoUrl } from "./SalesInventory";

/* ============================================================================
 * VimeoEmbed — quality-locked Vimeo iframe for the product pages.
 *
 * Vimeo's adaptive player picks the stream rendition from the player's CSS
 * size (ignoring devicePixelRatio) and its bandwidth estimate. On phones the
 * ~390px square player gets the soft 240p/360p stream: the first second looks
 * sharp (initial segment), then ABR "adapts" down and the quality visibly
 * drops. Desktop players are big enough to receive 1080p, which is why the
 * same videos look fine there.
 *
 * Fix: drive the player with the official @vimeo/player SDK and LOCK the
 * quality to the highest rendition the video offers (setQuality disables
 * adaptive switching entirely — the player buffers instead of degrading).
 *
 * The tiny native play button is also a fiddly tap target on phones, so we
 * overlay our own big centered play button; the SDK's play / pause / ended
 * events keep it in sync (it reappears when the video is paused or ends).
 *
 * Non-Vimeo sources (V360 spins, YouTube) render as a plain full-size iframe.
 * ========================================================================== */

/* Highest-first preference order for locked playback quality. */
const QUALITY_ORDER = ["2160p", "1440p", "1080p", "720p", "540p"];

/* IMPORTANT (iOS): this overlay is never unmounted — it fades out via CSS
 * (`opacity-0 pointer-events-none`) when playback starts. Removing a DOM node
 * mid-touch is a long-standing Safari bug that breaks tap-to-click dispatch
 * for the whole page afterwards (scrolling keeps working but taps go dead),
 * which is exactly what unmounting the button on tap used to trigger. */
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

const VimeoEmbed = ({ src, title }) => {
  const isVimeo = /player\.vimeo\.com\/video\//i.test(src || "");
  const iframeRef = useRef(null);
  const playerRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!isVimeo || !iframeRef.current) return undefined;

    const player = new Player(iframeRef.current);
    playerRef.current = player;

    const onPlay = () => setPlaying(true);
    const onStop = () => setPlaying(false);
    player.on("play", onPlay);
    player.on("pause", onStop);
    player.on("ended", onStop);

    // Lock the highest rendition this video actually has. getQualities tells
    // us what exists; if it isn't available we blind-try from the top.
    player
      .ready()
      .then(async () => {
        let available = [];
        try {
          const qualities = await player.getQualities();
          available = (qualities || []).map((q) => q.id || q);
        } catch {
          /* getQualities unsupported — fall through to blind attempts */
        }
        for (const q of QUALITY_ORDER) {
          if (available.length && !available.includes(q)) continue;
          try {
            await player.setQuality(q);
            return; // locked
          } catch {
            /* rendition rejected — try the next one down */
          }
        }
      })
      .catch(() => {
        /* player never became ready — leave defaults */
      });

    return () => {
      player.off("play", onPlay);
      player.off("pause", onStop);
      player.off("ended", onStop);
      // Stop playback before the iframe unmounts so iOS doesn't keep a
      // dangling active media session for a removed player.
      try {
        player.pause().catch(() => {});
      } catch {
        /* already gone */
      }
      // iOS Safari: removing an iframe while it holds focus (the user tapped
      // the video / its controls) breaks tap hit-testing for the ENTIRE page
      // afterwards — scrolling still works but no element receives clicks
      // until a reload. Blurring the iframe before it leaves the DOM releases
      // the ghost focus and keeps taps alive after Back navigation.
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
  }, [isVimeo]);

  const handlePlay = () => {
    playerRef.current?.play().catch(() => {});
    setPlaying(true);
  };

  if (!isVimeo) {
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

export default VimeoEmbed;
