import React from "react";
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
 * 2× so the player controls stay usable) and scale it back down with a CSS
 * transform. The player believes it is huge and serves the high rendition,
 * while on screen the size is unchanged — but now every physical pixel gets
 * real video data.
 *
 * Non-Vimeo sources (V360 spins, YouTube) render as a plain full-size iframe.
 * ========================================================================== */
const VimeoEmbed = ({ src, title }) => {
  const isVimeo = /player\.vimeo\.com\/video\//i.test(src || "");
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const scale = isVimeo ? Math.min(Math.max(dpr, 1), 2) : 1;

  if (scale === 1) {
    return (
      <iframe
        src={enhanceVimeoUrl(src)}
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
        src={enhanceVimeoUrl(src)}
        title={title}
        frameBorder="0"
        allow="autoplay; fullscreen"
        allowFullScreen
        className="absolute left-0 top-0"
        style={{
          width: pct,
          height: pct,
          transform: `scale(${1 / scale})`,
          transformOrigin: "top left",
        }}
      />
    </div>
  );
};

export default VimeoEmbed;
