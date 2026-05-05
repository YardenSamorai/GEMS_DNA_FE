import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  ContactShadows,
  Html,
  Center,
} from "@react-three/drei";
import * as THREE from "three";

/* =========================================================================
 * Phase 1 / POC — 3D Preview tab.
 *
 * What this is: a React Three Fiber viewer that renders a procedurally-built
 * placeholder ring so the entire surrounding UX (controls, lighting, metal
 * swap, AR launcher) is built and tested BEFORE we spend money on real
 * jewellery-grade 3D assets.
 *
 * What this is NOT: a faithful representation of any specific item. The
 * placeholder ring is a torus + cone setting + stone, scaled roughly to a
 * solitaire. Replacing it with the real GLB model in Phase 2 is a one-line
 * change inside <PlaceholderRing /> (swap to <RealRingModel src=...
 * />).
 *
 * AR is intentionally rendered as a "coming with the real model" button —
 * @google/model-viewer expects a real GLB+USDZ pair to launch the OS-native
 * AR experience, and shipping AR with a primitive ring would just embarrass
 * us on customer phones. The button + plumbing are wired so once we have
 * the asset we drop it in and AR lights up.
 * ========================================================================= */

// PBR-correct metal palettes. Roughness/metalness combos picked to match
// real jewelry photography references — gold sits around r=0.18, platinum
// is slightly rougher so it looks "matte luxe" rather than mirror-like.
const METALS = {
  yellow: {
    label: "14K Yellow Gold",
    swatch: "#E5BE57",
    material: { color: "#E5BE57", metalness: 1, roughness: 0.18 },
  },
  rose: {
    label: "14K Rose Gold",
    swatch: "#C7836B",
    material: { color: "#C7836B", metalness: 1, roughness: 0.2 },
  },
  white: {
    label: "14K White Gold",
    swatch: "#E2E1DD",
    material: { color: "#E5E4E0", metalness: 1, roughness: 0.16 },
  },
  platinum: {
    label: "Platinum 950",
    swatch: "#D7D5D1",
    material: { color: "#D7D5D1", metalness: 1, roughness: 0.22 },
  },
};

// Try to map the item's metal_summary string to one of our palettes so the
// viewer opens in the closest match (e.g. "14K White Gold / Tennis" → white).
// Falls back to yellow if the field is empty/unrecognised.
function detectMetalKey(metalSummary) {
  if (!metalSummary) return "yellow";
  const s = metalSummary.toLowerCase();
  if (s.includes("rose") || s.includes("pink")) return "rose";
  if (s.includes("platinum") || s.includes("plat")) return "platinum";
  if (s.includes("white")) return "white";
  return "yellow";
}

/* ---------- Procedural placeholder ring ----------
 * Built from primitives so the viewer stays useful before any real GLB
 * model arrives. Stone is a faceted icosahedron with high transmission so
 * it reads as "diamond-ish" rather than "ball of glass". */
function PlaceholderRing({ metal, autoRotate }) {
  const groupRef = useRef();
  const stoneMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        metalness: 0,
        roughness: 0,
        transmission: 0.95,
        thickness: 0.5,
        ior: 2.4, // diamond-ish refractive index
        attenuationColor: "#ffffff",
        clearcoat: 1,
        clearcoatRoughness: 0,
        envMapIntensity: 1.4,
      }),
    []
  );

  useFrame((_, delta) => {
    if (autoRotate && groupRef.current) groupRef.current.rotation.y += delta * 0.3;
  });

  const m = METALS[metal].material;

  return (
    <group ref={groupRef}>
      {/* Band */}
      <mesh castShadow receiveShadow rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.18, 64, 200]} />
        <meshStandardMaterial {...m} envMapIntensity={1.2} />
      </mesh>

      {/* Setting prongs (4-prong solitaire) — small cones reaching up to the stone */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((theta, i) => {
        const r = 0.32; // distance from centre, just inside the stone
        return (
          <mesh
            key={i}
            position={[Math.cos(theta) * r, 1.05, Math.sin(theta) * r]}
            castShadow
          >
            <cylinderGeometry args={[0.04, 0.06, 0.5, 12]} />
            <meshStandardMaterial {...m} envMapIntensity={1.2} />
          </mesh>
        );
      })}

      {/* Stone seat ring */}
      <mesh position={[0, 0.88, 0]} castShadow>
        <torusGeometry args={[0.4, 0.05, 32, 64]} />
        <meshStandardMaterial {...m} envMapIntensity={1.2} />
      </mesh>

      {/* Centre stone — icosahedron approximates a brilliant cut for placeholder */}
      <mesh position={[0, 1.18, 0]} castShadow>
        <icosahedronGeometry args={[0.42, 1]} />
        <primitive attach="material" object={stoneMaterial} />
      </mesh>
    </group>
  );
}

/* ---------- Scene ---------- */
function RingScene({ metal, autoRotate }) {
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight
        castShadow
        position={[5, 8, 5]}
        intensity={2.2}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-4, 2, -3]} intensity={0.8} />
      <Suspense
        fallback={
          <Html center>
            <div className="text-xs text-stone-400">Loading scene…</div>
          </Html>
        }
      >
        {/* Studio HDR for proper gold reflections */}
        <Environment preset="studio" />
      </Suspense>
      <Center>
        <PlaceholderRing metal={metal} autoRotate={autoRotate} />
      </Center>
      <ContactShadows
        opacity={0.4}
        position={[0, -0.85, 0]}
        scale={6}
        blur={2.4}
        far={4}
      />
    </>
  );
}

/* ---------- Top-level panel ---------- */
const Visualize3DPanel = ({ item }) => {
  const initialMetal = useMemo(
    () => detectMetalKey(item?.metal_summary),
    [item?.metal_summary]
  );
  const [metal, setMetal] = useState(initialMetal);
  const [autoRotate, setAutoRotate] = useState(true);

  // model-viewer is a web component — load it once, lazily, so we don't
  // pay the cost on pages that never open the 3D tab. Once a real GLB
  // is available we'll feed it to <model-viewer src=... ar /> and the
  // OS-native AR launcher takes over from this preview.
  useEffect(() => {
    let cancelled = false;
    import("@google/model-viewer").then(() => {
      if (cancelled) return;
    }).catch(() => {
      // non-fatal — AR button will simply stay disabled
    });
    return () => { cancelled = true; };
  }, []);

  const isRing = (item?.category || item?.type || "").toLowerCase().includes("ring")
    || (item?.name || "").toLowerCase().includes("ring");

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-stone-900">3D Preview</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            Drag to orbit · scroll to zoom · pinch on touch. The placeholder
            ring is shown until we drop in the real model for this template.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-xs text-stone-700">
            <input
              type="checkbox"
              checked={autoRotate}
              onChange={(e) => setAutoRotate(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-stone-400 text-emerald-600 focus:ring-emerald-500"
            />
            Auto-rotate
          </label>
          <ARButton item={item} />
        </div>
      </div>

      {/* Canvas */}
      <div className="relative overflow-hidden rounded-lg border border-stone-200 bg-gradient-to-b from-stone-50 to-stone-100">
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [2.4, 1.8, 3.4], fov: 35 }}
          style={{ height: 480, width: "100%" }}
        >
          <RingScene metal={metal} autoRotate={autoRotate} />
          <OrbitControls
            enablePan={false}
            minDistance={2.2}
            maxDistance={7}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={(2 * Math.PI) / 3}
          />
        </Canvas>

        {!isRing && (
          <div className="absolute left-3 top-3 rounded-md bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 shadow-sm">
            Showing placeholder ring — this item is a {item?.category || item?.type || "piece"}, real model coming
          </div>
        )}
      </div>

      {/* Metal swatches */}
      <div className="mt-4">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">Metal</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(METALS).map(([key, meta]) => {
            const active = key === metal;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setMetal(key)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                  active
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm"
                    : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
                }`}
                title={meta.label}
              >
                <span
                  className="h-4 w-4 rounded-full border border-black/10"
                  style={{ backgroundColor: meta.swatch }}
                />
                {meta.label}
              </button>
            );
          })}
        </div>
        {item?.metal_summary && (
          <p className="mt-2 text-[11px] text-stone-500">
            Detected from item record: <span className="font-mono">{item.metal_summary}</span>
          </p>
        )}
      </div>

      {/* Roadmap callout */}
      <details className="mt-5 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">
        <summary className="cursor-pointer select-none font-medium text-stone-700">
          What's coming next
        </summary>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Phase 2 — replace the placeholder with a real GLB converted from your CAD files (one ring → one bracelet → one pendant).</li>
          <li>Phase 3 — auto-position center / side / accent stones from the Stones tab so each item shows its real composition.</li>
          <li>Phase 4 — true AR launch on iOS (USDZ) and Android (scene-viewer) once real models exist.</li>
        </ul>
      </details>
    </div>
  );
};

/* ---------- AR launcher ----------
 * Renders an enabled-looking button that explains why AR is parked until the
 * real GLB is available. Once we have it we'll swap this for an actual
 * <model-viewer ... ar ar-modes="webxr scene-viewer quick-look"> element. */
const ARButton = ({ item }) => {
  const handleClick = () => {
    // We deliberately don't try to launch AR with the placeholder — the user
    // would see a primitive torus floating on their hand and lose all trust
    // in the feature. Surface the roadmap instead.
    if (typeof window !== "undefined" && window.alert) {
      window.alert(
        "AR will activate once we drop in the real 3D model for this piece. " +
        "It uses your phone's camera to place the actual jewelry on your hand. " +
        "Phase 2 of the rollout."
      );
    }
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
      title={item?.sku ? `AR view for ${item.sku} (coming soon)` : "AR view (coming soon)"}
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 7l9-5 9 5-9 5-9-5z" strokeLinejoin="round" />
        <path d="M3 7v10l9 5 9-5V7" strokeLinejoin="round" />
        <path d="M12 12v10" />
      </svg>
      View in AR
      <span className="rounded bg-stone-100 px-1 text-[9px] text-stone-500">soon</span>
    </button>
  );
};

export default Visualize3DPanel;
