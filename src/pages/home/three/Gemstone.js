import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BoxGeometry, CanvasTexture, Curve, Euler, Matrix4, MeshBasicMaterial, SRGBColorSpace, TubeGeometry, Vector3 } from "three";
import { phases } from "../timeline";
import { convexBounds, createEmeraldCutGeometry, cutSchedule, facetPlanes, roughCrystalPlanes } from "./emeraldCut";
import { createGemMaterial } from "./gemMaterial";
import { createAnchors, createCodeField, createEdgeTrace } from "./identityLayer";

/*
 * Poses along the story, blended by the timeline's phases: the rough lies at
 * a natural, slightly careless angle; the cut stone turns its table to the
 * viewer; while it's mapped it turns to show its facets; identified, it
 * settles into a frontal, presented pose.
 */
const POSES = {
  rough: { pitch: 0.42, yaw: -0.4, roll: 0.3 },
  cut: { pitch: 0.9, yaw: 0.3, roll: -0.1 },
  mapped: { pitch: 0.98, yaw: 0.85, roll: -0.12 },
  identified: { pitch: 1.04, yaw: 0.16, roll: -0.05 },
};

const SCALE = 1.14;
const STONE_AT = [-0.3, -0.1, 0.25]; // where the identified stone rests
const FIELD_AT = [0.66, 0.38, -1.7]; // its code, behind and to the right
const FACET_TRAVEL = 1.6; // how far outside the rough a facet waits before its cut
const RING_RADIUS = 1.5;
const RING_SEGMENTS = 240;
const RING_SIDES = 6;
const RING_TUBE = 0.0055;

const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

function blendPose({ cut, map, id }) {
  const out = {};
  for (const k of ["pitch", "yaw", "roll"]) {
    out[k] = lerp(lerp(lerp(POSES.rough[k], POSES.cut[k], ease(cut)), POSES.mapped[k], ease(map)), POSES.identified[k], ease(id));
  }
  return out;
}

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

/* Starts at the stone's left and runs across the front. */
const ringPoint = (t, target) => {
  const a = Math.PI - t * Math.PI * 2;
  return target.set(Math.cos(a) * RING_RADIUS, 0, Math.sin(a) * RING_RADIUS);
};
class Circle extends Curve {
  getPoint(t, target = new Vector3()) {
    return ringPoint(t, target);
  }
}
/* A hairline tube rather than a GL line (always 1 device pixel). TubeGeometry
 * orders its triangles along the path, so a draw range reveals an arc. */
const ringIndexCount = (share) => Math.round(share * RING_SEGMENTS) * RING_SIDES * 6;

function useStone(tier, envMap) {
  return useMemo(() => {
    const cutGeometry = createEmeraldCutGeometry();
    const facets = facetPlanes(cutGeometry);
    const rough = roughCrystalPlanes(cutGeometry);
    const schedule = cutSchedule(facets);
    const planes = [...rough, ...facets];
    const material = createGemMaterial(envMap, planes, { quality: tier });
    rough.forEach((_, i) => (material.uniforms.planeFrost.value[i] = 1));

    const { min, max } = convexBounds(rough, 2.6, 36);
    const box = new BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
    box.translate((max[0] + min[0]) / 2, (max[1] + min[1]) / 2, (max[2] + min[2]) / 2);

    const setCut = (cut) => {
      const u = material.uniforms.planes.value;
      facets.forEach(([, , , d], i) => {
        const { start, duration } = schedule[i];
        const t = ease(Math.min(1, Math.max(0, (cut - start) / duration)));
        u[rough.length + i].w = d + FACET_TRAVEL * (1 - t);
      });
    };
    return { cutGeometry, material, box, setCut };
  }, [tier, envMap]);
}

/**
 * motion: ref to { progress 0..1, pointerX/Y -1..1, still } written by the
 * page, read here every frame — no React state changes per frame.
 */
export default function Gemstone({ motion, tier, envMap }) {
  const gl = useThree((s) => s.gl);
  const place = useRef();
  const turn = useRef();
  const ring = useRef();
  const dot = useRef();
  const shadow = useRef();
  const live = useRef({ t: 0, progress: -1, tiltX: 0, tiltY: 0, lightX: 0, lightY: 0, lastCut: -1, lastId: -1 });

  const stone = useStone(tier, envMap);
  const edges = useMemo(() => createEdgeTrace(stone.cutGeometry), [stone]);
  const anchors = useMemo(() => createAnchors(stone.cutGeometry), [stone]);
  // The code assembles outward from where the stone comes to rest.
  const code = useMemo(() => createCodeField({ origin: [STONE_AT[0] - FIELD_AT[0], STONE_AT[1] - FIELD_AT[1]] }), []);
  const ringGeometry = useMemo(() => new TubeGeometry(new Circle(), RING_SEGMENTS, RING_TUBE, RING_SIDES, true), []);
  const ringMaterial = useMemo(() => new MeshBasicMaterial({ color: "#8e8e93", transparent: true, opacity: 0.6, toneMapped: false }), []);
  const shadowTexture = useMemo(makeShadowTexture, []);
  const scratch = useMemo(() => ({ euler: new Euler(), m4: new Matrix4() }), []);

  useEffect(
    () => () => {
      stone.cutGeometry.dispose();
      stone.material.dispose();
      stone.box.dispose();
      edges.geometry.dispose();
      edges.material.dispose();
      anchors.geometry.dispose();
      anchors.material.dispose();
      code.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      shadowTexture.dispose();
    },
    [stone, edges, anchors, code, ringGeometry, ringMaterial, shadowTexture]
  );

  useFrame((_, delta) => {
    const s = live.current;
    const m = motion.current;
    const dt = Math.min(delta, 1 / 20); // a resumed tab must not jump
    const still = m.still;

    if (!still) s.t += dt;
    // Scroll can jump (keyboard, links, fast flicks): ease towards it, but
    // start exactly where the page is.
    s.progress = still || s.progress < 0 ? m.progress : damp(s.progress, m.progress, 5, dt);
    s.tiltX = still ? 0 : damp(s.tiltX, m.pointerY * 0.06, 2.2, dt);
    s.tiltY = still ? 0 : damp(s.tiltY, m.pointerX * 0.09, 2.2, dt);
    s.lightX = still ? 0 : damp(s.lightX, m.pointerX, 1.8, dt);
    s.lightY = still ? 0 : damp(s.lightY, m.pointerY, 1.8, dt);

    const ph = phases(s.progress);

    // The cut: only re-upload planes when it moves.
    if (Math.abs(ph.cut - s.lastCut) > 1e-4) {
      stone.setCut(ph.cut);
      s.lastCut = ph.cut;
    }

    // Pose, with a slow breath rather than a spin.
    const pose = blendPose(ph);
    const breathYaw = still ? 0 : Math.sin(s.t * 0.32) * 0.14;
    const breathPitch = still ? 0 : Math.sin(s.t * 0.23) * 0.035;
    turn.current.rotation.set(pose.pitch + breathPitch + s.tiltX, pose.yaw + breathYaw + s.tiltY, pose.roll, "YXZ");
    // Identified, the stone steps forward and aside so its code reads behind it.
    const idE = ease(ph.id);
    // The rough is larger than the stone cut from it: sit it a little smaller and lower.
    const cutE = ease(ph.cut);
    place.current.position.set(STONE_AT[0] * idE, lerp(-0.1, 0.06, cutE) + STONE_AT[1] * idE, STONE_AT[2] * idE);
    place.current.scale.setScalar(lerp(0.88, 1, cutE) - 0.12 * idE);

    // A fine pointer moves the studio light, not the stone.
    scratch.euler.set(-s.lightY * 0.22, s.lightX * 0.55, 0, "YXZ");
    scratch.m4.makeRotationFromEuler(scratch.euler);
    stone.material.uniforms.envRotation.value.setFromMatrix4(scratch.m4);

    // Mapping: edges trace from the table down, anchors land just behind.
    const map = ph.map;
    edges.material.uniforms.reveal.value = map * 1.05;
    edges.material.uniforms.opacity.value = Math.min(1, map * 4) * lerp(0.55, 0.26, ease(ph.id));
    anchors.material.uniforms.reveal.value = Math.max(0, map * 1.15 - 0.12);
    anchors.material.uniforms.opacity.value = Math.min(1, map * 4);
    anchors.material.uniforms.size.value = 5.5 * gl.getPixelRatio();

    // The scan arc: begins with the mapping, closes as the stone is identified.
    const drawn = Math.min(1, map * 0.62 + ph.id * 0.38);
    ring.current.geometry.setDrawRange(0, ringIndexCount(drawn));
    ring.current.visible = drawn > 0.002;
    ringPoint(drawn, dot.current.position);
    dot.current.visible = ring.current.visible;

    if (Math.abs(ph.id - s.lastId) > 1e-4) {
      code.update(ph.id);
      s.lastId = ph.id;
    }

    shadow.current.material.opacity = lerp(0.56, 0.4, cutE);
    shadow.current.position.x = STONE_AT[0] * idE;
    shadow.current.position.z = STONE_AT[2] * idE;
  });

  return (
    <group>
      <primitive object={code.mesh} position={FIELD_AT} renderOrder={-2} />
      <group ref={place}>
        <group ref={turn}>
          <group scale={SCALE}>
            <mesh geometry={stone.box} material={stone.material} />
            <group scale={1.004}>
              <lineSegments geometry={edges.geometry} material={edges.material} renderOrder={2} />
              <points geometry={anchors.geometry} material={anchors.material} renderOrder={3} />
            </group>
          </group>
        </group>
        <group rotation={[0.34, 0.25, -0.12]}>
          <mesh ref={ring} geometry={ringGeometry} material={ringMaterial} />
          <mesh ref={dot}>
            <sphereGeometry args={[0.032, 16, 12]} />
            <meshBasicMaterial color="#10b981" toneMapped={false} />
          </mesh>
        </group>
      </group>
      <mesh ref={shadow} position={[0, -1.12, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1}>
        <planeGeometry args={[3.1, 2.1]} />
        <meshBasicMaterial map={shadowTexture} transparent depthWrite={false} toneMapped={false} opacity={0.5} />
      </mesh>
    </group>
  );
}
