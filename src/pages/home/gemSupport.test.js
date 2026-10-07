import { gemSupport } from "./gemSupport";

function fakeWindow({ media = [], saveData = false, webgl2 = true, renderer = "ANGLE (Apple, Apple M2, OpenGL 4.1)", cores = 8, memory = 8 } = {}) {
  const gl = {
    getExtension: (name) => (name === "WEBGL_debug_renderer_info" ? { UNMASKED_RENDERER_WEBGL: 0x9246 } : { loseContext() {} }),
    getParameter: () => renderer,
  };
  return {
    matchMedia: (q) => ({ matches: media.some((m) => q.includes(m)) }),
    navigator: { connection: { saveData }, hardwareConcurrency: cores, deviceMemory: memory },
    document: { createElement: () => ({ getContext: () => (webgl2 ? gl : null) }) },
  };
}

describe("gemSupport", () => {
  it("gives a capable desktop the full scene", () => {
    expect(gemSupport(fakeWindow())).toBe("high");
  });

  it("keeps the still render for reduced motion, Data Saver and missing WebGL 2", () => {
    expect(gemSupport(fakeWindow({ media: ["prefers-reduced-motion: reduce"] }))).toBe("none");
    expect(gemSupport(fakeWindow({ saveData: true }))).toBe("none");
    expect(gemSupport(fakeWindow({ webgl2: false }))).toBe("none");
  });

  it("refuses software renderers", () => {
    expect(gemSupport(fakeWindow({ renderer: "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))" }))).toBe("none");
    expect(gemSupport(fakeWindow({ renderer: "llvmpipe (LLVM 15.0.7, 256 bits)" }))).toBe("none");
  });

  it("gives phones, tablets and modest hardware the lighter scene", () => {
    expect(gemSupport(fakeWindow({ media: ["pointer: coarse"] }))).toBe("low");
    expect(gemSupport(fakeWindow({ media: ["max-width: 1023.98px"] }))).toBe("low");
    expect(gemSupport(fakeWindow({ cores: 4 }))).toBe("low");
    expect(gemSupport(fakeWindow({ memory: 2 }))).toBe("low");
  });

  it("is safe without a window", () => {
    expect(gemSupport(null)).toBe("none");
  });
});
