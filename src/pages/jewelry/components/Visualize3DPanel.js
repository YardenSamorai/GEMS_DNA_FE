import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  ContactShadows,
  Html,
  Center,
  MeshTransmissionMaterial,
} from "@react-three/drei";
import * as THREE from "three";
import toast from "react-hot-toast";
import { updateJewelryItem } from "../../../services/jewelryApi";

/* =========================================================================
 * 3D Preview tab — hybrid: real iJewel3D model when an item is linked, or
 * a procedural placeholder otherwise.
 *
 * Hybrid model:
 *   - When `item.ijewel_file_id` is set we mount the iJewel mini-viewer
 *     (CDN script, ~bundle.iife.js) pointed at the workspace `instance`.
 *     That viewer carries its own ring configurator + AR + materials UI,
 *     so we hide our own controls in that mode (no duplicate state).
 *   - When no file id is set we keep the existing drei-based placeholder
 *     so the tab is never empty: 9 procedural cuts, fancy-colour palette,
 *     metal swatches, side-stones, the lot. Useful for items that haven't
 *     been onboarded to iJewel yet (the long tail).
 *
 * The procedural rig stays here because (a) drei has no production-ready
 * jewelry npm package — drei is what such packages wrap — and (b) it
 * doubles as a "before / after" reference vs. the iJewel viewer.
 * ========================================================================= */

// FE-level default workspace name. Per-item override lives on
// item.ijewel_instance, falling back to this when null. Ship a no-op default
// so a missing env var doesn't crash render — the link form still works,
// the user just types the instance once.
const DEFAULT_IJEWEL_INSTANCE =
  (process.env.REACT_APP_IJEWEL_INSTANCE || "").trim() || null;

// Pinned mini-viewer build. Bump when iJewel publishes a stable release
// after testing it locally — we never want to track "latest" because their
// iife bundle can change globals between minor versions.
const IJEWEL_VIEWER_SCRIPT_URL =
  "https://releases.ijewel3d.com/libs/mini-viewer/0.5.10/bundle.iife.js";
const IJEWEL_SCRIPT_ID = "ijewel-mini-viewer-script";

// PBR-correct metal palettes — picked from real jewellery photography refs.
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

// Stone color palette — colourless diamond + the most common fancy colours
// jewellery shops actually carry. Each entry tunes the transmission tint
// alongside the visible swatch so the picker chip and the rendered stone
// agree visually.
const STONE_COLORS = {
  white:        { label: "Colourless",   swatch: "#FFFFFF", color: "#FFFFFF", attenuation: "#FFFFFF", attenuationDistance: 1.5 },
  fancyYellow:  { label: "Fancy Yellow", swatch: "#F8D85C", color: "#FFF6CB", attenuation: "#F0C84C", attenuationDistance: 0.8 },
  fancyPink:    { label: "Fancy Pink",   swatch: "#F2A6B6", color: "#FFE2EA", attenuation: "#F08FA3", attenuationDistance: 0.7 },
  fancyBlue:    { label: "Fancy Blue",   swatch: "#7AB8E8", color: "#D8ECFA", attenuation: "#5BA3E0", attenuationDistance: 0.7 },
  fancyGreen:   { label: "Fancy Green",  swatch: "#9BD09B", color: "#DFF2DF", attenuation: "#7FC07F", attenuationDistance: 0.7 },
  emerald:      { label: "Emerald Green",swatch: "#3F8E5A", color: "#9CD4AD", attenuation: "#3F8E5A", attenuationDistance: 0.45 },
  ruby:         { label: "Ruby Red",     swatch: "#9B2335", color: "#E0A8B0", attenuation: "#9B2335", attenuationDistance: 0.45 },
  sapphire:     { label: "Sapphire Blue",swatch: "#264E8A", color: "#A8C2E0", attenuation: "#264E8A", attenuationDistance: 0.45 },
};

/* ---------- 9 procedurally-built stone cuts ----------
 *
 * Each entry returns a function that, given a baseRadius (in scene units),
 * yields a Three.js BufferGeometry for that cut. They're not facet-perfect
 * — for the placeholder phase what matters is each cut reads as
 * unmistakably itself when you scrub the picker. Real GI-rendered facets
 * arrive with the GLB swap in Phase 2.
 *
 * Helper: makeRoundedRectShape() builds a Shape with rounded/cut corners,
 * shared by emerald, asscher and cushion which differ only in proportion +
 * corner radius.
 */
const makeRoundedRectShape = (w, h, r) => {
  const shape = new THREE.Shape();
  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w + r, -h);
  return shape;
};

const makeHeartShape = (size) => {
  const x = 0, y = 0;
  const s = size;
  const shape = new THREE.Shape();
  shape.moveTo(x, y + s * 0.25);
  shape.bezierCurveTo(x, y + s * 0.25, x - s * 0.5, y + s, x - s, y + s * 0.25);
  shape.bezierCurveTo(x - s * 1.5, y - s * 0.5, x - s * 0.5, y - s * 1.0, x, y - s * 0.5);
  shape.bezierCurveTo(x + s * 0.5, y - s * 1.0, x + s * 1.5, y - s * 0.5, x + s, y + s * 0.25);
  shape.bezierCurveTo(x + s * 0.5, y + s, x, y + s * 0.25, x, y + s * 0.25);
  return shape;
};

const STONE_SHAPES = {
  round: {
    label: "Round",
    aspect: 1, // x:y ratio for size slider
    geometry: (r) => {
      // Octahedron stretched slightly thinner — reads as a round brilliant
      const g = new THREE.OctahedronGeometry(r, 2);
      g.scale(1, 0.7, 1);
      return g;
    },
    icon: (
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="16" cy="16" r="11" />
        <path d="M5 16 L27 16 M16 5 L16 27 M8 8 L24 24 M24 8 L8 24" strokeWidth="0.5" />
      </svg>
    ),
  },
  oval: {
    label: "Oval",
    aspect: 1.4,
    geometry: (r) => {
      const g = new THREE.SphereGeometry(r, 32, 24);
      g.scale(1.4, 0.7, 1);
      return g;
    },
    icon: (
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <ellipse cx="16" cy="16" rx="14" ry="9" />
        <path d="M2 16 L30 16 M16 7 L16 25" strokeWidth="0.5" />
      </svg>
    ),
  },
  princess: {
    label: "Princess",
    aspect: 1,
    geometry: (r) => {
      // Inverted truncated pyramid + flat top (table) — square brilliant.
      const top = new THREE.BoxGeometry(r * 1.2, r * 0.15, r * 1.2);
      const pavilion = new THREE.ConeGeometry(r * 0.95, r * 1.1, 4, 1);
      pavilion.rotateY(Math.PI / 4);
      pavilion.rotateX(Math.PI);
      pavilion.translate(0, -r * 0.55 - r * 0.075, 0);
      top.translate(0, 0, 0);
      const merged = mergeGeoms([top, pavilion]);
      return merged;
    },
    icon: (
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="4" width="24" height="24" />
        <path d="M4 4 L28 28 M28 4 L4 28" strokeWidth="0.5" />
      </svg>
    ),
  },
  emerald: {
    label: "Emerald",
    aspect: 1.35,
    geometry: (r) => {
      const shape = makeRoundedRectShape(r * 1.35, r, r * 0.22);
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: r * 0.85,
        bevelEnabled: true,
        bevelSegments: 4,
        bevelSize: r * 0.18,
        bevelThickness: r * 0.18,
        steps: 1,
      });
      g.center();
      g.scale(1, 1, 0.6);
      return g;
    },
    icon: (
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 4 L23 4 L28 9 L28 23 L23 28 L9 28 L4 23 L4 9 Z" />
        <path d="M9 8 L23 8 L24 9 L24 23 L23 24 L9 24 L8 23 L8 9 Z" strokeWidth="0.7" />
      </svg>
    ),
  },
  asscher: {
    label: "Asscher",
    aspect: 1,
    geometry: (r) => {
      const shape = makeRoundedRectShape(r * 1.05, r * 1.05, r * 0.22);
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: r * 0.95,
        bevelEnabled: true,
        bevelSegments: 4,
        bevelSize: r * 0.18,
        bevelThickness: r * 0.18,
        steps: 1,
      });
      g.center();
      g.scale(1, 1, 0.6);
      return g;
    },
    icon: (
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M10 4 L22 4 L28 10 L28 22 L22 28 L10 28 L4 22 L4 10 Z" />
        <path d="M10 9 L22 9 L23 10 L23 22 L22 23 L10 23 L9 22 L9 10 Z" strokeWidth="0.7" />
      </svg>
    ),
  },
  pear: {
    label: "Pear",
    aspect: 1.45,
    geometry: (r) => {
      const g = new THREE.SphereGeometry(r, 32, 24);
      // Pull one pole into a point — tear-drop silhouette
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        if (x > 0) {
          // Stretch the +x hemisphere into a point
          const stretch = 1 + (x / r) * 0.8;
          pos.setX(i, x * stretch);
          pos.setY(i, y * (1 - 0.5 * (x / r)));
          pos.setZ(i, z * (1 - 0.4 * (x / r)));
        }
      }
      g.scale(1, 0.7, 1);
      g.computeVertexNormals();
      return g;
    },
    icon: (
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M16 3 C9 8 5 14 5 19 C5 24 10 28 16 28 C22 28 27 24 27 19 C27 14 23 8 16 3 Z" />
      </svg>
    ),
  },
  marquise: {
    label: "Marquise",
    aspect: 1.9,
    geometry: (r) => {
      const g = new THREE.SphereGeometry(r, 32, 24);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const ax = Math.abs(x);
        const stretch = 1 + (ax / r) * 0.95;
        pos.setX(i, x * stretch);
        pos.setY(i, y * (1 - 0.55 * (ax / r)));
        pos.setZ(i, z * (1 - 0.45 * (ax / r)));
      }
      g.scale(1, 0.65, 1);
      g.computeVertexNormals();
      return g;
    },
    icon: (
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 16 C8 6 24 6 29 16 C24 26 8 26 3 16 Z" />
      </svg>
    ),
  },
  cushion: {
    label: "Cushion",
    aspect: 1.05,
    geometry: (r) => {
      const shape = makeRoundedRectShape(r * 1.05, r, r * 0.42);
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: r * 0.9,
        bevelEnabled: true,
        bevelSegments: 6,
        bevelSize: r * 0.25,
        bevelThickness: r * 0.25,
        steps: 1,
      });
      g.center();
      g.scale(1, 1, 0.55);
      return g;
    },
    icon: (
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="4" width="24" height="24" rx="6" />
      </svg>
    ),
  },
  heart: {
    label: "Heart",
    aspect: 1.05,
    geometry: (r) => {
      const shape = makeHeartShape(r * 0.95);
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: r * 0.7,
        bevelEnabled: true,
        bevelSegments: 4,
        bevelSize: r * 0.15,
        bevelThickness: r * 0.15,
        steps: 1,
      });
      g.center();
      g.rotateX(Math.PI); // flip — bezier draws upside-down
      g.scale(1, 1, 0.6);
      return g;
    },
    icon: (
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M16 28 L5 17 C2 14 2 9 5 6 C8 3 13 3 16 7 C19 3 24 3 27 6 C30 9 30 14 27 17 Z" />
      </svg>
    ),
  },
};

/* mergeGeoms — local helper: takes Three.js BufferGeometries and returns
 * one merged geometry. We avoid importing BufferGeometryUtils because some
 * react-scripts 5 builds choke on its examples-folder import path. This
 * tiny inline implementation is enough for our two-piece princess cut. */
function mergeGeoms(geoms) {
  const positions = [];
  const indices = [];
  let offset = 0;
  for (const g of geoms) {
    const pos = g.attributes.position.array;
    for (let i = 0; i < pos.length; i++) positions.push(pos[i]);
    if (g.index) {
      const ind = g.index.array;
      for (let i = 0; i < ind.length; i++) indices.push(ind[i] + offset);
    } else {
      for (let i = 0; i < pos.length / 3; i++) indices.push(i + offset);
    }
    offset += pos.length / 3;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setIndex(indices);
  merged.computeVertexNormals();
  return merged;
}

/* ---------- Item → initial config detection ----------
 * Reads the first inventory-consumed stone on the item and seeds the
 * picker with its shape + colour so the viewer opens with the actual
 * composition (e.g. "Side stone Fancy yellow center stone RING" lands on
 * Fancy Yellow + Round). Falls back to round/colourless when there's
 * nothing useful to read. */
function detectStoneFromItem(stones) {
  if (!Array.isArray(stones) || !stones.length) return { shape: "round", color: "white", sizeMm: 7 };
  // Prefer center-role rows; otherwise the largest stone we have.
  const center = stones.find((s) => (s.role || "").toLowerCase() === "center");
  const candidate = center || [...stones].sort((a, b) => {
    const wa = Number(a?.snapshot?.weight) || 0;
    const wb = Number(b?.snapshot?.weight) || 0;
    return wb - wa;
  })[0];
  const snap = candidate?.snapshot || {};
  const shape = mapShapeFromText(snap.shape);
  const color = mapColorFromText(snap.color || snap.fancyColor || snap.fancyIntensity || snap.category);
  const sizeMm = mmFromCarat(Number(snap.weight)) || 7;
  return { shape, color, sizeMm };
}

function mapShapeFromText(raw) {
  if (!raw) return "round";
  const s = String(raw).toLowerCase();
  if (s.includes("emerald")) return "emerald";
  if (s.includes("asscher")) return "asscher";
  if (s.includes("princess")) return "princess";
  if (s.includes("oval")) return "oval";
  if (s.includes("pear")) return "pear";
  if (s.includes("marquise")) return "marquise";
  if (s.includes("cushion")) return "cushion";
  if (s.includes("heart")) return "heart";
  if (s.includes("round") || s.includes("brilliant")) return "round";
  return "round";
}

function mapColorFromText(raw) {
  if (!raw) return "white";
  const s = String(raw).toLowerCase();
  if (s.includes("yellow")) return "fancyYellow";
  if (s.includes("pink")) return "fancyPink";
  if (s.includes("blue") && s.includes("sapphire")) return "sapphire";
  if (s.includes("blue")) return "fancyBlue";
  if (s.includes("green") && s.includes("emerald")) return "emerald";
  if (s.includes("green")) return "fancyGreen";
  if (s.includes("ruby") || s.includes("red")) return "ruby";
  // single-letter D-K colour grades — colourless
  if (/^[d-k]$/.test(s.trim())) return "white";
  return "white";
}

// Rough carat→diameter mapping for round brilliant; serviceable for the
// other cuts as a sane default. The user can override with the slider.
function mmFromCarat(ct) {
  if (!ct) return null;
  if (ct < 0.25) return 4;
  if (ct < 0.5)  return 5;
  if (ct < 0.75) return 5.5;
  if (ct < 1)    return 6.3;
  if (ct < 1.5)  return 7.2;
  if (ct < 2)    return 8;
  if (ct < 3)    return 9;
  if (ct < 4)    return 10;
  return 11;
}

function detectMetalKey(metalSummary) {
  if (!metalSummary) return "yellow";
  const s = metalSummary.toLowerCase();
  if (s.includes("rose") || s.includes("pink")) return "rose";
  if (s.includes("platinum") || s.includes("plat")) return "platinum";
  if (s.includes("white")) return "white";
  return "yellow";
}

/* ---------- Reusable stone mesh ---------- */
function ConfiguredStone({ shape, color, sizeMm, position = [0, 0, 0] }) {
  // Convert mm → scene units (the procedural ring band has radius 1, which
  // is roughly 18 mm in real life → 1 unit ≈ 18 mm → 1 mm ≈ 0.055 units).
  // The radius in the geometry already encodes "half a stone diameter".
  const r = (sizeMm * 0.055) / 2;
  const geometry = useMemo(() => STONE_SHAPES[shape].geometry(r), [shape, r]);
  // Dispose old geometries when shape/size change so we don't leak GPU buffers
  // (Three.js geometries created with `new` don't free themselves on React unmount alone).
  useEffect(() => () => geometry.dispose(), [geometry]);
  const palette = STONE_COLORS[color] || STONE_COLORS.white;
  return (
    <mesh position={position} castShadow geometry={geometry}>
      <MeshTransmissionMaterial
        backside
        thickness={0.45}
        roughness={0}
        transmission={1}
        ior={2.4} // diamond ior so light bends realistically
        chromaticAberration={0.06}
        anisotropy={0.1}
        distortion={0.05}
        distortionScale={0.3}
        temporalDistortion={0.1}
        clearcoat={1}
        attenuationColor={palette.attenuation}
        attenuationDistance={palette.attenuationDistance}
        color={palette.color}
      />
    </mesh>
  );
}

/* ---------- Procedural placeholder ring (band + setting) ----------
 *
 * Proportions matter — the previous version had a 0.18-radius band tube
 * that read as a bracelet and a setting floating 1.2 units above the
 * band, with a "seat" torus that made every stone look like a tiny ring
 * of its own. This rewrite mirrors how a real solitaire is built:
 *
 *   - Band cross-section is a thin torus (tube ~ 1mm equivalent in the
 *     scene), proportioned for a finger ring of ~18mm inner diameter.
 *   - The setting (head) sits ON TOP of the band with no visible gap —
 *     we lift the centre stone just enough that its bottom culet kisses
 *     the band's outer surface.
 *   - Prongs are 4 short, slightly-angled-inward cylinders that hug the
 *     stone's girdle from below; no separate "seat torus" any more.
 *   - Side stones in the three-stone variant sit directly on the band
 *     too, with their own micro-prongs — never wrapped in a seat ring.
 */
function PlaceholderRing({ metal, autoRotate, centerCfg, sideCfg }) {
  const groupRef = useRef();
  useFrame((_, delta) => {
    if (autoRotate && groupRef.current) groupRef.current.rotation.y += delta * 0.3;
  });
  const m = METALS[metal].material;

  // Band geometry: radius 1 ≈ 18mm inner diameter, tube 0.06 ≈ 1.1mm thick
  // shank — "delicate solitaire" proportions, not chunky.
  const BAND_RADIUS = 1;
  const BAND_TUBE = 0.06;

  // Centre stone vertical placement: stone radius from mm + bottom culet
  // of the cut sits ON the band's top surface (y = BAND_TUBE).
  const centerR = (centerCfg.sizeMm * 0.055) / 2;
  const centerY = BAND_TUBE + centerR * 0.55; // pavilion height ≈ 0.55 of radius

  // Centre prongs: 4 thin posts reaching from band up to the girdle of
  // the stone, slightly tilted inward so they actually GRIP it.
  const prongCount = 4;
  const prongHeight = centerR * 0.7;
  const prongMidY = BAND_TUBE + prongHeight / 2;
  const prongInnerR = centerR * 0.85; // top of prong, hugs the girdle
  const prongOuterR = centerR * 1.05; // base of prong, sits on band

  // Side stones: smaller, also seated on the band, with their own micro-prongs.
  const sideR = (sideCfg.sizeMm * 0.055) / 2;
  const sideY = BAND_TUBE + sideR * 0.55;
  // Place side stones along the band's "top" (y=BAND_TUBE), spaced by
  // centre+side radii + small gap so the stones don't overlap.
  const sideOffsetX = centerR + sideR + 0.04;

  return (
    <group ref={groupRef}>
      {/* Band */}
      <mesh castShadow receiveShadow rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[BAND_RADIUS, BAND_TUBE, 32, 200]} />
        <meshStandardMaterial {...m} envMapIntensity={1.3} />
      </mesh>

      {/* Centre prongs — slim, slightly tapered, top is closer to centre */}
      {Array.from({ length: prongCount }).map((_, i) => {
        const theta = (i / prongCount) * Math.PI * 2 + Math.PI / prongCount;
        const baseX = Math.cos(theta) * prongOuterR;
        const baseZ = Math.sin(theta) * prongOuterR;
        const tipX = Math.cos(theta) * prongInnerR;
        const tipZ = Math.sin(theta) * prongInnerR;
        // Position at midpoint
        const px = (baseX + tipX) / 2;
        const pz = (baseZ + tipZ) / 2;
        // Compute rotation so the cylinder points from base to tip
        const dx = tipX - baseX;
        const dy = prongHeight;
        const dz = tipZ - baseZ;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        // Default cylinder is along +Y. We want it along (dx, dy, dz)/len.
        // Build a quaternion that rotates +Y to that direction.
        const dir = new THREE.Vector3(dx, dy, dz).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
        return (
          <mesh
            key={i}
            position={[px, prongMidY, pz]}
            quaternion={quat}
            castShadow
          >
            <cylinderGeometry args={[centerR * 0.06, centerR * 0.08, len, 12]} />
            <meshStandardMaterial {...m} envMapIntensity={1.3} />
          </mesh>
        );
      })}

      {/* Centre stone */}
      <ConfiguredStone {...centerCfg} position={[0, centerY, 0]} />

      {/* Side stones (three-stone setting) — same approach, smaller scale */}
      {sideCfg.enabled && (
        <>
          {/* Side stones themselves */}
          <ConfiguredStone
            shape={sideCfg.shape}
            color={sideCfg.color}
            sizeMm={sideCfg.sizeMm}
            position={[-sideOffsetX, sideY, 0]}
          />
          <ConfiguredStone
            shape={sideCfg.shape}
            color={sideCfg.color}
            sizeMm={sideCfg.sizeMm}
            position={[sideOffsetX, sideY, 0]}
          />
          {/* Two micro-prongs per side stone — front + back so the stone
              looks gripped without obscuring it from the typical viewing
              angle. */}
          {[-sideOffsetX, sideOffsetX].map((cx) => (
            <React.Fragment key={cx}>
              {[-1, 1].map((zSign) => (
                <mesh
                  key={zSign}
                  position={[cx, BAND_TUBE + sideR * 0.4, zSign * sideR * 0.85]}
                  castShadow
                >
                  <cylinderGeometry args={[sideR * 0.08, sideR * 0.1, sideR * 0.7, 10]} />
                  <meshStandardMaterial {...m} envMapIntensity={1.3} />
                </mesh>
              ))}
            </React.Fragment>
          ))}
        </>
      )}
    </group>
  );
}

/* ---------- Scene ---------- */
function RingScene({ metal, autoRotate, centerCfg, sideCfg }) {
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
        <Environment preset="studio" />
      </Suspense>
      <Center>
        <PlaceholderRing
          metal={metal}
          autoRotate={autoRotate}
          centerCfg={centerCfg}
          sideCfg={sideCfg}
        />
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
const Visualize3DPanel = ({ item, stones, onItemUpdated }) => {
  const fileId = item?.ijewel_file_id || null;
  const instance =
    item?.ijewel_instance || DEFAULT_IJEWEL_INSTANCE || null;
  const linked = Boolean(fileId && instance);

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-stone-900">
            3D Preview {linked ? <span className="ml-2 align-middle inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800">Real model · iJewel3D</span> : <span className="ml-2 align-middle inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">Placeholder configurator</span>}
          </h2>
          <p className="mt-0.5 text-xs text-stone-500">
            {linked
              ? "Live render of this item's CAD model. Use the on-canvas controls to change components, materials, and try in AR."
              : "No real CAD model linked yet. The configurator below previews shape, colour and metal so you can iterate before committing."}
          </p>
        </div>
      </div>

      {linked ? (
        <LinkedView
          fileId={fileId}
          instance={instance}
          item={item}
          onItemUpdated={onItemUpdated}
        />
      ) : (
        <UnlinkedView
          item={item}
          stones={stones}
          onItemUpdated={onItemUpdated}
        />
      )}
    </div>
  );
};

/* ---------- "Linked" view: real iJewel3D viewer + manage controls ---------- */
function LinkedView({ fileId, instance, item, onItemUpdated }) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      <IJewelViewer fileId={fileId} instance={instance} />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-[11px] text-stone-600">
        <div className="space-x-3">
          <span>
            File ID <span className="font-mono text-stone-800">{fileId}</span>
          </span>
          <span>
            Workspace <span className="font-mono text-stone-800">{instance}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded border border-stone-300 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-50"
          >
            {editing ? "Cancel" : "Change link"}
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3">
          <LinkIJewelForm
            item={item}
            onItemUpdated={onItemUpdated}
            onDone={() => setEditing(false)}
          />
        </div>
      )}
    </>
  );
}

/* ---------- "Unlinked" view: placeholder + invite to link a model ---------- */
function UnlinkedView({ item, stones, onItemUpdated }) {
  // Seed everything from the item's actual data so the viewer opens looking
  // like the piece, not a generic placeholder.
  const detected = useMemo(() => detectStoneFromItem(stones), [stones]);
  const initialMetal = useMemo(
    () => detectMetalKey(item?.metal_summary),
    [item?.metal_summary]
  );

  const [metal, setMetal] = useState(initialMetal);
  const [autoRotate, setAutoRotate] = useState(true);
  const [centerShape, setCenterShape] = useState(detected.shape);
  const [centerColor, setCenterColor] = useState(detected.color);
  const [centerSizeMm, setCenterSizeMm] = useState(detected.sizeMm);
  const [sideEnabled, setSideEnabled] = useState(false);
  const [sideShape, setSideShape] = useState("round");
  const [sideColor, setSideColor] = useState("white");
  const [sideSizeMm, setSideSizeMm] = useState(3.5);

  // Lazy-load model-viewer for the AR launcher (Phase 2 will feed it a real GLB).
  useEffect(() => {
    let cancelled = false;
    import("@google/model-viewer").catch(() => { /* AR will stay disabled */ });
    return () => { cancelled = true; void cancelled; };
  }, []);

  const centerCfg = { shape: centerShape, color: centerColor, sizeMm: centerSizeMm };
  const sideCfg = { enabled: sideEnabled, shape: sideShape, color: sideColor, sizeMm: sideSizeMm };

  const isRing =
    (item?.category || item?.type || "").toLowerCase().includes("ring") ||
    (item?.name || "").toLowerCase().includes("ring");

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
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

      {/* Canvas */}
      <div className="relative overflow-hidden rounded-lg border border-stone-200 bg-gradient-to-b from-stone-50 to-stone-100">
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [1.6, 1.0, 2.4], fov: 35 }}
          style={{ height: 480, width: "100%" }}
        >
          <RingScene
            metal={metal}
            autoRotate={autoRotate}
            centerCfg={centerCfg}
            sideCfg={sideCfg}
          />
          <OrbitControls
            enablePan={false}
            minDistance={1.4}
            maxDistance={5}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={(2 * Math.PI) / 3}
          />
        </Canvas>

        {!isRing && (
          <div className="absolute left-3 top-3 rounded-md bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 shadow-sm">
            Placeholder ring shown — this item is a {item?.category || item?.type || "piece"}, real model coming
          </div>
        )}
      </div>

      {/* iJewel link invite — the real reason this view exists. */}
      <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-emerald-900">
              Want to show the real CAD here?
            </p>
            <p className="mt-0.5 text-[11px] text-emerald-800/80">
              Upload this piece to{" "}
              <a
                href="https://www.ijewel3d.com/drive"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                iJewel3D Drive
              </a>{" "}
              from Rhino, copy the File ID, and paste it below. The placeholder
              will be replaced with your actual model — including AR.
            </p>
          </div>
        </div>
        <div className="mt-3">
          <LinkIJewelForm item={item} onItemUpdated={onItemUpdated} />
        </div>
      </div>

      {/* Centre stone configurator */}
      <SectionTitle title="Centre stone shape" />
      <ShapePicker value={centerShape} onChange={setCenterShape} />

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <SizeSlider
          label="Centre stone size"
          valueMm={centerSizeMm}
          onChange={setCenterSizeMm}
          shape={centerShape}
        />
        <ColorPicker
          label="Centre stone colour"
          value={centerColor}
          onChange={setCenterColor}
        />
      </div>

      {/* Side stones (three-stone setting) */}
      <div className="mt-5 rounded-lg border border-stone-200 bg-stone-50 p-3">
        <label className="flex items-center justify-between gap-2 text-sm">
          <span className="font-medium text-stone-800">Three-stone setting</span>
          <input
            type="checkbox"
            checked={sideEnabled}
            onChange={(e) => setSideEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-stone-400 text-emerald-600 focus:ring-emerald-500"
          />
        </label>
        {sideEnabled && (
          <div className="mt-3 space-y-3">
            <ShapePicker value={sideShape} onChange={setSideShape} compact />
            <div className="grid gap-3 sm:grid-cols-2">
              <SizeSlider
                label="Side stones size"
                valueMm={sideSizeMm}
                onChange={setSideSizeMm}
                shape={sideShape}
                min={2}
                max={6}
              />
              <ColorPicker
                label="Side stones colour"
                value={sideColor}
                onChange={setSideColor}
              />
            </div>
          </div>
        )}
      </div>

      {/* Metal swatches */}
      <SectionTitle title="Metal" />
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
          Item record: <span className="font-mono">{item.metal_summary}</span>
        </p>
      )}
    </>
  );
}

/* ---------- UI sub-components ---------- */
const SectionTitle = ({ title }) => (
  <div className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-stone-500">{title}</div>
);

const ShapePicker = ({ value, onChange, compact }) => (
  <div className={`grid gap-2 ${compact ? "grid-cols-9" : "grid-cols-3 sm:grid-cols-5 md:grid-cols-9"}`}>
    {Object.entries(STONE_SHAPES).map(([key, meta]) => {
      const active = key === value;
      return (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-[10px] transition ${
            active
              ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm"
              : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
          }`}
          title={meta.label}
        >
          <span className={`h-7 w-7 ${active ? "text-emerald-700" : "text-stone-500"}`}>
            {meta.icon}
          </span>
          <span className="font-medium">{meta.label}</span>
        </button>
      );
    })}
  </div>
);

const SizeSlider = ({ label, valueMm, onChange, shape, min = 4, max = 12 }) => {
  const aspect = STONE_SHAPES[shape]?.aspect || 1;
  const longSide = (valueMm * aspect).toFixed(1);
  const shortSide = valueMm.toFixed(1);
  const dimsLabel = aspect === 1 ? `${shortSide} mm` : `${longSide} × ${shortSide} mm`;
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-stone-700">
        {label}
        <span className="ml-2 font-mono text-[11px] text-stone-500">{dimsLabel}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={0.1}
        value={valueMm}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-emerald-600"
      />
      <div className="mt-0.5 flex justify-between text-[10px] text-stone-400">
        <span>{min} mm</span>
        <span>{max} mm</span>
      </div>
    </div>
  );
};

const ColorPicker = ({ label, value, onChange }) => (
  <div>
    <label className="mb-1 block text-xs font-medium text-stone-700">{label}</label>
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(STONE_COLORS).map(([key, meta]) => {
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] transition ${
              active
                ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
            }`}
            title={meta.label}
          >
            <span
              className="h-3.5 w-3.5 rounded-full border border-black/10"
              style={{ backgroundColor: meta.swatch }}
            />
            {meta.label}
          </button>
        );
      })}
    </div>
  </div>
);

/* ---------- iJewel3D Drive viewer (real CAD render + configurator) ----------
 *
 * Loads iJewel's CDN-hosted mini-viewer bundle exactly once per page (the
 * script registers a global `window.ijewelViewer`). On mount we ensure the
 * script is present, then call `loadModelById(fileId, instance, container)`.
 * The viewer paints its own controls inside `containerRef` — we do NOT try
 * to mirror them in React state because their plugin system already does
 * that. Our job is purely lifecycle: mount, swap fileId, unmount cleanly.
 *
 * Why a hand-rolled <script> injector vs. an npm package?
 *   - iJewel's npm package targets module consumers and asks you to ship
 *     ~5 MB of three.js builds yourself, which fights with the version we
 *     already bundle for drei. Their iife CDN bundle dodges all that — it
 *     loads once, on demand, only on this tab.
 *   - It also means upgrades are a one-line URL bump, not a dependency
 *     graveyard pin. The cost is one global, isolated to this component.
 */
function IJewelViewer({ fileId, instance, height = 480 }) {
  const containerRef = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    let readyHandler = null;

    function ensureScript() {
      return new Promise((resolve, reject) => {
        if (typeof window === "undefined") return reject(new Error("no window"));
        if (window.ijewelViewer) return resolve();

        const existing = document.getElementById(IJEWEL_SCRIPT_ID);
        if (existing) {
          if (window.ijewelViewer) return resolve();
          existing.addEventListener("load", () => resolve(), { once: true });
          existing.addEventListener(
            "error",
            () => reject(new Error("iJewel viewer script failed to load")),
            { once: true }
          );
          return;
        }

        const tag = document.createElement("script");
        tag.id = IJEWEL_SCRIPT_ID;
        tag.src = IJEWEL_VIEWER_SCRIPT_URL;
        tag.async = true;
        tag.onload = () => resolve();
        tag.onerror = () => reject(new Error("iJewel viewer script failed to load"));
        document.head.appendChild(tag);
      });
    }

    setStatus("loading");
    setErrorMsg("");

    readyHandler = () => {
      if (!cancelled) setStatus("ready");
    };
    window.addEventListener("ijewel-viewer-ready", readyHandler);

    ensureScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        try {
          window.ijewelViewer.loadModelById(
            fileId,
            instance,
            containerRef.current,
            {
              showCard: false,
              showLogo: true,
              transparentBg: false,
              brandingSettings: { enable: true, showLoadingScreenLogo: true },
            }
          );
        } catch (e) {
          if (!cancelled) {
            setErrorMsg(e?.message || "Failed to load iJewel model");
            setStatus("error");
          }
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setErrorMsg(e?.message || "iJewel viewer unavailable");
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
      if (readyHandler) {
        window.removeEventListener("ijewel-viewer-ready", readyHandler);
      }
      // Wipe the container so re-mount on fileId change starts clean. We
      // don't try to call into the iJewel viewer instance itself — their
      // SDK doesn't expose a public destroy() and DOM-clearing is enough
      // to garbage-collect the canvas + WebGL context.
      try {
        if (containerRef.current) containerRef.current.innerHTML = "";
      } catch (_) { /* ignore */ }
    };
  }, [fileId, instance]);

  return (
    <div className="relative overflow-hidden rounded-lg border border-stone-200 bg-gradient-to-b from-stone-50 to-stone-100">
      <div
        ref={containerRef}
        style={{ height, width: "100%" }}
        className="ijewel-viewer-container"
      />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-xs text-stone-600">
          Loading 3D model…
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/90 px-6 text-center">
          <p className="text-sm font-medium text-stone-800">Couldn't load model</p>
          <p className="text-[11px] text-stone-500">{errorMsg}</p>
          <p className="text-[11px] text-stone-500">
            Check the File ID and that the model is set to{" "}
            <span className="font-medium">Public</span> in iJewel3D Drive.
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------- Link form: paste an iJewel File ID and persist ----------
 *
 * Two text inputs. The instance is optional in the UI: most setups have a
 * single workspace and the FE-level default does the trick. We only force
 * the user to type it when the env var isn't set AND the item doesn't have
 * one yet — that's the "first time on this deployment" path.
 *
 * "Disconnect" sends nulls so the BE clears the columns; the panel then
 * re-renders into the placeholder mode.
 */
function LinkIJewelForm({ item, onItemUpdated, onDone }) {
  const [fileId, setFileId] = useState(item?.ijewel_file_id || "");
  const [instance, setInstance] = useState(
    item?.ijewel_instance || DEFAULT_IJEWEL_INSTANCE || ""
  );
  const [busy, setBusy] = useState(false);

  const persist = async (payload) => {
    setBusy(true);
    try {
      await updateJewelryItem(item.id, payload);
      toast.success(payload.ijewelFileId ? "Model linked" : "Model disconnected");
      if (typeof onItemUpdated === "function") await onItemUpdated();
      if (typeof onDone === "function") onDone();
    } catch (e) {
      toast.error(e?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const onSave = (e) => {
    e?.preventDefault?.();
    const trimmedFile = (fileId || "").trim();
    const trimmedInstance = (instance || "").trim();
    if (!trimmedFile) {
      toast.error("File ID is required");
      return;
    }
    if (!trimmedInstance && !DEFAULT_IJEWEL_INSTANCE) {
      toast.error("Workspace name is required (set REACT_APP_IJEWEL_INSTANCE or fill it in)");
      return;
    }
    persist({
      ijewelFileId: trimmedFile,
      // Only persist a per-item instance if the user explicitly typed one
      // different from the FE default. Keeps rows clean.
      ijewelInstance:
        trimmedInstance && trimmedInstance !== DEFAULT_IJEWEL_INSTANCE
          ? trimmedInstance
          : null,
    });
  };

  const onDisconnect = () => {
    if (!window.confirm("Remove the linked iJewel3D model from this item?")) return;
    persist({ ijewelFileId: null, ijewelInstance: null });
  };

  return (
    <form onSubmit={onSave} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-stone-600">
            File ID
          </span>
          <input
            type="text"
            value={fileId}
            onChange={(e) => setFileId(e.target.value)}
            placeholder="e.g. abc123def456"
            className="w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm font-mono text-stone-900 focus:border-emerald-500 focus:ring-emerald-500"
            disabled={busy}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-stone-600">
            Workspace {DEFAULT_IJEWEL_INSTANCE ? <span className="font-normal text-stone-400">(optional)</span> : null}
          </span>
          <input
            type="text"
            value={instance}
            onChange={(e) => setInstance(e.target.value)}
            placeholder={DEFAULT_IJEWEL_INSTANCE || "e.g. drive"}
            className="w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm font-mono text-stone-900 focus:border-emerald-500 focus:ring-emerald-500"
            disabled={busy}
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save link"}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500">
        <span>
          Tip: in iJewel3D Drive, right-click the model → <em>Make Public</em>, then copy the file ID from the share URL.
        </span>
        {item?.ijewel_file_id && (
          <button
            type="button"
            onClick={onDisconnect}
            disabled={busy}
            className="rounded border border-rose-200 bg-white px-2 py-0.5 text-[11px] font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
          >
            Disconnect
          </button>
        )}
      </div>
    </form>
  );
}

/* ---------- AR launcher (Phase 5 — needs real GLB+USDZ) ---------- */
const ARButton = ({ item }) => {
  const handleClick = () => {
    if (typeof window !== "undefined" && window.alert) {
      window.alert(
        "AR will activate once we drop in the real 3D model for this piece. " +
        "Until then the viewer renders a faithful approximation only — Phase 5 of the rollout."
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
