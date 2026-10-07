import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, Curve, MeshBasicMaterial, SRGBColorSpace, TubeGeometry, Vector3 } from "three";
import { createEmeraldCutGeometry, facetPlanes } from "./emeraldCut";
import { createGemMaterial } from "./gemMaterial";

/* Resting pose — also the pose of the static poster, so the poster and the
 * first live frame match and the hand-over is invisible. */
export const POSE = { pitch: 0.9, roll: -0.1, yaw: 0.3 };

const RING_RADIUS = 1.62;
const RING_SEGMENTS = 240;
const RING_SIDES = 6;
const RING_TUBE = 0.0055;
const RING_IDLE = 0.16; // share of the ring drawn before any scroll

const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));

function makeShadowTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(0.45, "rgba(0,0,0,0.22)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/* Starts at the stone's left and runs across the front, so the short idle arc
 * is in view rather than behind the stone. */
const ringPoint = (t, target) => {
  const a = Math.PI - t * Math.PI * 2;
  return target.set(Math.cos(a) * RING_RADIUS, 0, Math.sin(a) * RING_RADIUS);
};

class Circle extends Curve {
  getPoint(t, target = new Vector3()) {
    return ringPoint(t, target);
  }
}

/* A hairline tube rather than a GL line (always 1 device pixel, so it all but
 * disappears on dense screens). TubeGeometry orders its triangles along the
 * path, so a draw range reveals the ring as an arc. */
const makeRingGeometry = () => new TubeGeometry(new Circle(), RING_SEGMENTS, RING_TUBE, RING_SIDES, true);
const ringIndexCount = (share) => Math.round(share * RING_SEGMENTS) * RING_SIDES * 6;

/**
 * motion: ref to { progress 0..1, pointerX/Y -1..1, still } written by the
 * page (scroll / pointer listeners), read here every frame. No React state
 * changes per frame.
 */
export default function Gemstone({ motion, tier, envMap }) {
  const group = useRef();
  const gem = useRef();
  const ring = useRef();
  const dot = useRef();
  const shadow = useRef();
  const live = useRef({ yaw: 0, tiltX: 0, tiltY: 0, progress: 0 });

  const geometry = useMemo(createEmeraldCutGeometry, []);
  const material = useMemo(() => createGemMaterial(envMap, facetPlanes(geometry), { quality: tier }), [envMap, geometry, tier]);
  const ringGeometry = useMemo(makeRingGeometry, []);
  const ringMaterial = useMemo(() => new MeshBasicMaterial({ color: "#8e8e93", transparent: true, opacity: 0.55, toneMapped: false }), []);
  const shadowTexture = useMemo(makeShadowTexture, []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      shadowTexture.dispose();
    },
    [geometry, material, ringGeometry, ringMaterial, shadowTexture]
  );

  useFrame((_, delta) => {
    const s = live.current;
    const m = motion.current;
    const dt = Math.min(delta, 1 / 20); // a resumed tab must not jump
    const still = m.still;

    if (!still) s.yaw += dt * 0.075; // one turn in ~84 s
    s.progress = still ? m.progress : damp(s.progress, m.progress, 6, dt);
    s.tiltX = still ? 0 : damp(s.tiltX, m.pointerY * 0.07, 2.4, dt);
    s.tiltY = still ? 0 : damp(s.tiltY, m.pointerX * 0.11, 2.4, dt);

    const p = s.progress;
    const g = gem.current;
    g.rotation.set(POSE.pitch + p * 0.42 + s.tiltX, POSE.yaw + s.yaw + p * 1.05 + s.tiltY, POSE.roll * (1 - p * 0.6), "YXZ");
    group.current.position.y = p * 0.18;

    const drawn = Math.min(1, RING_IDLE + p * (1 - RING_IDLE) * 1.15);
    ring.current.geometry.setDrawRange(0, ringIndexCount(drawn));
    ring.current.visible = drawn > 0.002;
    ringPoint(drawn, dot.current.position);
    dot.current.visible = ring.current.visible;

    shadow.current.material.opacity = 0.5 - p * 0.18;
  });

  return (
    <group ref={group}>
      <mesh ref={gem} geometry={geometry} material={material} scale={1.14} />
      <group rotation={[0.34, 0.25, -0.12]}>
        <mesh ref={ring} geometry={ringGeometry} material={ringMaterial} />
        <mesh ref={dot}>
          <sphereGeometry args={[0.032, 16, 12]} />
          <meshBasicMaterial color="#10b981" toneMapped={false} />
        </mesh>
      </group>
      <mesh ref={shadow} position={[0, -1.02, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1}>
        <planeGeometry args={[2.9, 1.9]} />
        <meshBasicMaterial map={shadowTexture} transparent depthWrite={false} toneMapped={false} opacity={0.5} />
      </mesh>
    </group>
  );
}
