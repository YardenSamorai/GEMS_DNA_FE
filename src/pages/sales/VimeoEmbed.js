import React, { useEffect, useRef, useState } from "react";
import { enhanceVimeoUrl } from "./SalesInventory";

/* ============================================================================
 * VimeoEmbed — retina-aware Vimeo iframe for the product pages.
 *
 * Vimeo's adaptive player picks the stream rendition from the player's CSS
 * size and ignores devicePixelRatio. On a retina phone the ~390px square
 * player therefore gets the soft 360p stream: the first second looks sharp
 * (initial segment), then ABR "adapts" down and the quality visibly drops.
 * Desktop players are big enough to receive 1080p, which is why the same
 * videos look fine there.
 *
 * Workaround: render the iframe larger (by the device pixel ratio, capped at
 * 2×) and scale it back down with a CSS transform. The player believes it is
 * huge and serves the high rendition, while on screen the size is unchanged —
 * but now every physical pixel gets real video data.
 *
 * The scale-down also shrinks the player's own controls, so the native play
 * button becomes a fiddly tap target on phones. To fix that we overlay our own
 * big centered play button and drive the player through Vimeo's postMessage
 * API: tapping it starts playback and hides the overlay; the player's
 * play / pause / finish events keep the overlay in sync (it reappears when
 * the video is paused or ends).
 *
 * Non-Vimeo sources (V360 spins, YouTube) render as a plain full-size iframe.
 * ========================================================================== */

/* Send a command to the embedded Vimeo player. */
const post = (iframe, method, value) => {
  try {
    iframe?.contentWindow?.postMessage(
      JSON.stringify(value !== undefined ? { method, value } : { method }),
      "https://player.vimeo.com"
    );
  } catch {
    /* iframe not ready — non-fatal */
  }
};

const PlayOverlay = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Play video"
    className="absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-[0_4px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm transition active:scale-95"
  >
    <svg className="ml-1 h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86A1 1 0 008 5.14z" />
    </svg>
  </button>
);

const VimeoEmbed = ({ src, title }) => {
  const isVimeo = /player\.vimeo\.com\/video\//i.test(src || "");
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const scale = isVimeo ? Math.min(Math.max(dpr, 1), 2) : 1;

  const iframeRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  // Keep the overlay in sync with the player: subscribe to play/pause/finish
  // once the player reports ready, then mirror its state.
  useEffect(() => {
    if (!isVimeo) return undefined;
    const onMessage = (e) => {
      if (!/^https?:\/\/player\.vimeo\.com$/.test(e.origin)) return;
      if (e.source !== iframeRef.current?.contentWindow) return;
      let data = e.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      const event = data?.event;
      if (event === "ready") {
        post(iframeRef.current, "addEventListener", "play");
        post(iframeRef.current, "addEventListener", "pause");
        post(iframeRef.current, "addEventListener", "finish");
      } else if (event === "play") {
        setPlaying(true);
      } else if (event === "pause" || event === "finish") {
        setPlaying(false);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [isVimeo]);

  const handlePlay = () => {
    post(iframeRef.current, "play");
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

  const pct = `${scale * 100}%`;
  return (
    <div className="relative h-full w-full overflow-hidden">
      <iframe
        ref={iframeRef}
        src={enhanceVimeoUrl(src)}
        title={title}
        frameBorder="0"
        allow="autoplay; fullscreen"
        allowFullScreen
        className={scale === 1 ? "h-full w-full" : "absolute left-0 top-0"}
        style={
          scale === 1
            ? undefined
            : {
                width: pct,
                height: pct,
                transform: `scale(${1 / scale})`,
                transformOrigin: "top left",
              }
        }
      />
      {!playing && <PlayOverlay onClick={handlePlay} />}
    </div>
  );
};

export default VimeoEmbed;
