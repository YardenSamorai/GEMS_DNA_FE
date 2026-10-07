import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { NeutralToneMapping } from "three";
import Gemstone from "./Gemstone";
import { createStudioCube } from "./studioEnvironment";

const QUALITY = {
  high: { dpr: [1, 2], env: 256 },
  low: { dpr: [1, 1.5], env: 128 },
};

function Stone({ motion, tier }) {
  const gl = useThree((s) => s.gl);
  const studio = useMemo(() => createStudioCube(gl, { size: QUALITY[tier].env }), [gl, tier]);
  useEffect(() => () => studio.dispose(), [studio]);
  return <Gemstone motion={motion} tier={tier} envMap={studio.texture} />;
}

/* Reports the first rendered frames (so the poster can hand over), then
 * watches frame time: one step down in resolution if it's heavy, and a
 * hand-back to the still poster if even that can't hold ~30 fps. */
function FrameWatch({ onReady, onSlow }) {
  const setDpr = useThree((s) => s.setDpr);
  const w = useRef({ frames: 0, samples: [], stepped: false, done: false });
  useFrame((_, delta) => {
    const s = w.current;
    s.frames += 1;
    if (s.frames === 3) onReady();
    if (s.done || s.frames < 10 || delta > 0.25) return; // skip warm-up and tab resumes
    s.samples.push(delta);
    if (s.samples.length < 45) return;
    const sorted = [...s.samples].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    s.samples = [];
    if (median <= 1 / 34) {
      s.done = true;
    } else if (!s.stepped) {
      s.stepped = true;
      setDpr(1);
    } else {
      s.done = true;
      onSlow();
    }
  });
  return null;
}

export default function GemCanvas({ motion, tier = "high", active, onReady, onFail }) {
  const q = QUALITY[tier];
  return (
    <Canvas
      className="home-gem-canvas"
      dpr={q.dpr}
      frameloop={active ? "always" : "never"}
      camera={{ fov: 30, position: [0, 0.32, 6.3], near: 0.1, far: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: tier === "high" ? "high-performance" : "default" }}
      onCreated={({ gl, camera }) => {
        gl.toneMapping = NeutralToneMapping;
        gl.toneMappingExposure = 1.3;
        camera.lookAt(0, -0.05, 0);
        gl.domElement.addEventListener("webglcontextlost", onFail, { once: true });
      }}
      aria-hidden="true"
      tabIndex={-1}
      style={{ pointerEvents: "none" }}
    >
      <Stone motion={motion} tier={tier} />
      <FrameWatch onReady={onReady} onSlow={onFail} />
    </Canvas>
  );
}
