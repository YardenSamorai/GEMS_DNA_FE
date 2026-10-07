/*
 * Which hero the device gets:
 *   "none" — the still render only (no WebGL 2, software rendering, reduced
 *            motion, or Data Saver).
 *   "low"  — live, lighter scene (phones, tablets, modest hardware).
 *   "high" — live, full scene.
 */
export function gemSupport(win = typeof window === "undefined" ? null : window) {
  if (!win) return "none";
  const mq = (q) => Boolean(win.matchMedia && win.matchMedia(q).matches);
  if (mq("(prefers-reduced-motion: reduce)")) return "none";
  if (win.navigator?.connection?.saveData) return "none";
  if (!hasHardwareWebGL2(win)) return "none";

  const nav = win.navigator || {};
  const modest = (nav.hardwareConcurrency || 8) <= 4 || (nav.deviceMemory || 8) <= 4;
  if (modest || mq("(pointer: coarse)") || mq("(max-width: 1023.98px)")) return "low";
  return "high";
}

function hasHardwareWebGL2(win) {
  try {
    const canvas = win.document.createElement("canvas");
    // Refuse software rasterisers: a slow refracting gem is worse than a still one.
    const gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true });
    if (!gl) return false;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return !/swiftshader|llvmpipe|software|microsoft basic render/i.test(renderer);
  } catch {
    return false;
  }
}
