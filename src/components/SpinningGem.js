import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * SpinningGem — procedural round-brilliant-cut diamond loader.
 *
 * Built entirely from a hand-tuned BufferGeometry — no external GLB,
 * no asset download, no model-viewer custom element. The mesh is a
 * symmetric brilliant cut with table / crown / pavilion / culet
 * proportions tuned for the small (~64px) loader use case:
 *
 *   • 24-segment ring (smooth silhouette but still faceted enough to
 *     read as a real diamond)
 *   • Non-indexed BufferGeometry so each triangle keeps its own face
 *     normal — that's what gives a brilliant cut its sharp specular
 *     "flash" instead of looking like a smooth sphere.
 *   • MeshPhysicalMaterial with transmission, ior=2.4 (diamond's real
 *     index of refraction), clearcoat — refracts the environment map
 *     instead of looking like opaque white plastic.
 *   • RoomEnvironment as the IBL source so we get realistic studio
 *     reflections without bundling an HDR file.
 *
 * The CSS `.gem3d-halo` pulse stays underneath because the brand
 * emerald color is recognisable at any speed, even when the gem
 * is just a sub-pixel sparkle on a phone.
 *
 * Props:
 *   size - pixel size of the bounding box. Defaults to 64.
 */
export default function SpinningGem({ size = 64 }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Use the inline-style size as the source of truth — clientWidth
    // may be 0 during the first paint on flex/grid parents, and that
    // would yield a zero-sized canvas and nothing to render.
    const w = size;
    const h = size;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    /* ────────────── Renderer ────────────── */
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Slightly under-exposed on purpose: the bright key light + high
    // envMapIntensity would otherwise clip the whole gem to white. Keeping
    // exposure below 1 preserves the dark/bright facet contrast.
    renderer.toneMappingExposure = 0.85;
    renderer.setClearColor(0x000000, 0); // transparent
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    /* ────────────── Scene + IBL ────────────── */
    const scene = new THREE.Scene();

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    /* ────────────── Camera ────────────── */
    const camera = new THREE.PerspectiveCamera(28, w / h, 0.1, 50);
    camera.position.set(0, 0.32, 4.1);
    camera.lookAt(0, 0, 0);

    /* ────────────── Diamond mesh ────────────── */
    const geometry = createBrilliantDiamond();
    // No transmission. At ~64px on a transparent canvas a transmissive
    // material has nothing to refract, so tone-mapping blows the whole
    // silhouette out to a flat white blob. Instead we render the gem as a
    // highly reflective faceted crystal: a faint icy tint, sharp clearcoat,
    // strong env reflections and iridescent "fire". Adjacent facets then
    // bounce the studio light at different intensities, which is exactly
    // what reads as a sparkling diamond rather than a white shape.
    const material = new THREE.MeshPhysicalMaterial({
      // Emerald green (matches the app's brand-emerald). Saturated base so
      // the gem reads clearly green; envMapIntensity is held a touch lower
      // than the white version so the studio reflections don't wash it pale.
      color: 0x0aa05f,
      metalness: 0.0,
      roughness: 0.06,
      envMapIntensity: 1.9,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      reflectivity: 1,
      iridescence: 0.6,
      iridescenceIOR: 1.3,
      iridescenceThicknessRange: [120, 400],
      // FrontSide + outward-oriented winding (see createBrilliantDiamond)
      // keeps the gem a clean opaque solid. DoubleSide let the back facets
      // bleed through and made the shape unreadable.
      side: THREE.FrontSide,
      // Flat shading so each triangle reads as a distinct facet instead of
      // a smooth (sphere-like) blob.
      flatShading: true,
    });
    const diamond = new THREE.Mesh(geometry, material);
    diamond.scale.setScalar(0.95);
    scene.add(diamond);

    // A bright key + cool fill from opposite sides make adjacent facets
    // catch light at different intensities — that contrast is what sells
    // "faceted gem". The point light adds a moving specular sparkle.
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(2, 3, 2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x7be0b0, 1.2);
    fill.position.set(-2.5, -1, -1.5);
    scene.add(fill);
    const sparkle = new THREE.PointLight(0xffffff, 1.6, 12);
    sparkle.position.set(0, 1.5, 3);
    scene.add(sparkle);

    /* ────────────── Animation loop ────────────── */
    let rafId = 0;
    let lastT = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;
      diamond.rotation.y += dt * 0.9;        // smooth full rotation
      diamond.rotation.x = Math.sin(now / 1800) * 0.08; // gentle wobble
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    /* ────────────── Cleanup ────────────── */
    return () => {
      cancelAnimationFrame(rafId);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      envTex.dispose();
      pmrem.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [size]);

  return (
    <div className="gem3d" style={{ width: size, height: size }} aria-hidden>
      <span className="gem3d-halo" />
      <div
        ref={mountRef}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      />
    </div>
  );
}

/**
 * Procedural round brilliant cut diamond geometry.
 *
 * Layout (heights are relative to girdle = 0):
 *
 *           [ table top, flat octagon-ish disk ]   ↑ +0.30
 *                /                  \
 *           [ crown bezel facets ]                 ↕ 0.30
 *                |                  |
 *           [ girdle (widest ring) ]               ─ 0
 *                \                  /
 *           [ pavilion main facets ]               ↕ 0.55
 *                       •                          ↓ -0.55  (culet)
 *
 * We use a 24-segment ring with the girdle vertices rotated by half a
 * segment relative to the table — that staggered alignment is what
 * gives a real brilliant cut its "kite" facets and prevents the
 * crown from looking like a smooth cone.
 *
 * Returns a non-indexed BufferGeometry so flat shading produces one
 * face normal per triangle (i.e. per facet) instead of averaging
 * across shared vertices.
 */
function createBrilliantDiamond() {
  const SEGMENTS = 24;
  const TABLE_R = 0.46;
  const GIRDLE_R = 0.95;
  const TABLE_Y = 0.30;
  const GIRDLE_Y = 0.0;
  // Deep pavilion so the profile narrows to a real point (the old -0.55
  // was too shallow and read as a flying-saucer disc rather than a gem).
  const CULET_Y = -0.92;

  const tablePts = [];
  const girdlePts = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const a = (i / SEGMENTS) * Math.PI * 2;
    tablePts.push([Math.cos(a) * TABLE_R, TABLE_Y, Math.sin(a) * TABLE_R]);
  }
  for (let i = 0; i < SEGMENTS; i++) {
    const a = ((i + 0.5) / SEGMENTS) * Math.PI * 2;
    girdlePts.push([Math.cos(a) * GIRDLE_R, GIRDLE_Y, Math.sin(a) * GIRDLE_R]);
  }
  const tableCenter = [0, TABLE_Y, 0];
  const culet = [0, CULET_Y, 0];

  const positions = [];
  const addTri = (a, b, c) => positions.push(...a, ...b, ...c);

  // Table (top flat surface) — fan from the center
  for (let i = 0; i < SEGMENTS; i++) {
    addTri(tableCenter, tablePts[i], tablePts[(i + 1) % SEGMENTS]);
  }

  // Crown — two triangles per segment forming kite-shaped bezel facets
  for (let i = 0; i < SEGMENTS; i++) {
    const tA = tablePts[i];
    const tB = tablePts[(i + 1) % SEGMENTS];
    const gMid = girdlePts[i];                   // girdle vertex sits BETWEEN tA and tB
    const gPrev = girdlePts[(i + SEGMENTS - 1) % SEGMENTS];
    // Each table edge has two crown triangles flanking it.
    addTri(tA, gPrev, gMid);
    addTri(tA, gMid, tB);
  }

  // Pavilion — single triangle per segment from the girdle to the culet
  for (let i = 0; i < SEGMENTS; i++) {
    const gA = girdlePts[i];
    const gB = girdlePts[(i + 1) % SEGMENTS];
    addTri(culet, gB, gA);
  }

  // Orient every triangle so its face normal points away from the body
  // centre. The hand-authored winding above is inconsistent between the
  // table / crown / pavilion sections, which left some facets facing
  // inward — with FrontSide culling those facets vanished (or rendered
  // dark), which is what made the gem look broken. This pass guarantees a
  // clean, fully-lit convex solid.
  orientTrianglesOutward(positions);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.computeVertexNormals(); // per-triangle (non-indexed) → flat facet normals
  // Recentre on the bounding-box midpoint so the gem spins around its own
  // axis instead of an off-centre point (the asymmetric crown/pavilion
  // heights otherwise make it look like it's wobbling on a stick).
  geometry.center();
  return geometry;
}

/**
 * Flip any triangle whose normal faces the interior so the whole mesh has
 * consistently outward-pointing normals. Operates in place on a flat
 * [x,y,z, x,y,z, ...] position array (9 floats per triangle).
 */
function orientTrianglesOutward(positions) {
  const n = positions.length / 3;
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < positions.length; i += 3) {
    cx += positions[i];
    cy += positions[i + 1];
    cz += positions[i + 2];
  }
  cx /= n; cy /= n; cz /= n;

  for (let i = 0; i < positions.length; i += 9) {
    const ax = positions[i],     ay = positions[i + 1], az = positions[i + 2];
    const bx = positions[i + 3], by = positions[i + 4], bz = positions[i + 5];
    const cxx = positions[i + 6], cyy = positions[i + 7], czz = positions[i + 8];
    // face normal = (b-a) × (c-a)
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cxx - ax, vy = cyy - ay, vz = czz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    // direction from body centre to the triangle centroid
    const gx = (ax + bx + cxx) / 3 - cx;
    const gy = (ay + by + cyy) / 3 - cy;
    const gz = (az + bz + czz) / 3 - cz;
    if (nx * gx + ny * gy + nz * gz < 0) {
      // facing inward → swap b and c to reverse the winding
      positions[i + 3] = cxx; positions[i + 4] = cyy; positions[i + 5] = czz;
      positions[i + 6] = bx;  positions[i + 7] = by;  positions[i + 8] = bz;
    }
  }
}
