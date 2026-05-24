import React, { useEffect, useState } from "react";

/**
 * SpinningGem — auto-rotating emerald 3D gem used as the brand loader.
 *
 * Renders the optimised /loader/gem.glb (913 KB Draco + WebP, down
 * from a 30 MB raw export) inside Google's <model-viewer> custom
 * element. We lazy-import the element on mount so the splash screen
 * itself doesn't have to wait on a ~120 KB module before first paint —
 * the existing `gem3d-halo` pulse + the model's transparent background
 * keep the loader visually alive during that brief window.
 *
 * The custom element is registered once per page (the dynamic import
 * resolves to the cached module on subsequent renders), and the GLB
 * is cached aggressively by the browser via Vercel's static-asset
 * headers, so navigations after the first show the gem instantly.
 *
 * Props:
 *   size - pixel size of the bounding box. Defaults to 64.
 */

let modelViewerLoadingPromise = null;
function ensureModelViewerLoaded() {
  if (typeof window === "undefined") return null;
  if (!modelViewerLoadingPromise) {
    modelViewerLoadingPromise = import("@google/model-viewer");
  }
  return modelViewerLoadingPromise;
}

export default function SpinningGem({ size = 64 }) {
  const [elementReady, setElementReady] = useState(
    () => typeof window !== "undefined" && !!window.customElements?.get("model-viewer")
  );

  useEffect(() => {
    if (elementReady) return;
    const p = ensureModelViewerLoaded();
    if (!p) return;
    let cancelled = false;
    p.then(() => { if (!cancelled) setElementReady(true); }).catch(() => {});
    return () => { cancelled = true; };
  }, [elementReady]);

  return (
    <div className="gem3d" style={{ width: size, height: size }} aria-hidden>
      <span className="gem3d-halo" />
      {elementReady ? (
        // model-viewer treats any presence of `ar` / `camera-controls`
        // as truthy regardless of value, so we OMIT those attributes
        // entirely to keep the loader non-interactive. The boolean
        // attributes we DO want (`auto-rotate`, `disable-zoom`,
        // `disable-tap`) are passed as empty strings, which JSX
        // serialises to attribute presence — the form model-viewer
        // expects.
        <model-viewer
          src="/loader/gem.glb"
          alt=""
          auto-rotate=""
          rotation-per-second="60deg"
          auto-rotate-delay="0"
          disable-zoom=""
          disable-tap=""
          interaction-prompt="none"
          loading="eager"
          reveal="auto"
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "transparent",
            "--poster-color": "transparent",
            pointerEvents: "none",
          }}
        />
      ) : null}
    </div>
  );
}
