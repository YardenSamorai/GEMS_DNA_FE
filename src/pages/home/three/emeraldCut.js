import { BufferGeometry, Float32BufferAttribute } from "three";

/*
 * Procedural step-cut ("emerald cut") gemstone, table up, girdle at y = 0.
 *
 * Every ring is the girdle octagon offset inward by `d`, so the 45° corner
 * facets stay parallel from girdle to table — that parallel stepping is what
 * reads as an emerald cut rather than a generic octagon. The mesh is
 * non-indexed so each triangle keeps its own normal: crisp facet flashes
 * instead of a smoothed blob.
 *
 * This is brand imagery, not a model of any stone.
 */

const HALF_LENGTH = 1.0;
const HALF_WIDTH = 0.72;
const CORNER = 0.27;
const CHAMFER_SHRINK = 2 - Math.SQRT2;

// [inset, height] from girdle to table, then girdle to keel.
const CROWN = [
  [0, 0.025],
  [0.1, 0.105],
  [0.2, 0.17],
  [0.3, 0.215],
];
const PAVILION = [
  [0, -0.025],
  [0.13, -0.2],
  [0.29, -0.4],
  [0.47, -0.57],
  [0.64, -0.68],
];
const KEEL_Y = -0.71;

export function octagonRing(inset, y) {
  const a = HALF_LENGTH - inset;
  const b = HALF_WIDTH - inset;
  const c = Math.max(CORNER - inset * CHAMFER_SHRINK, 0.015);
  return [
    [a, y, b - c],
    [a - c, y, b],
    [-a + c, y, b],
    [-a, y, b - c],
    [-a, y, -b + c],
    [-a + c, y, -b],
    [a - c, y, -b],
    [a, y, -b + c],
  ];
}

function bridge(out, lower, upper) {
  for (let i = 0; i < lower.length; i++) {
    const j = (i + 1) % lower.length;
    out.push(lower[i], lower[j], upper[j], lower[i], upper[j], upper[i]);
  }
}

function fan(out, ring, center) {
  for (let i = 0; i < ring.length; i++) out.push(center, ring[i], ring[(i + 1) % ring.length]);
}

/* Flip any triangle whose normal points into the body (the shape is convex,
 * so "away from the centroid" is outward). */
function orientOutward(tris) {
  for (let t = 0; t < tris.length; t += 3) {
    const [a, b, c] = [tris[t], tris[t + 1], tris[t + 2]];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const m = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3 + 0.25, (a[2] + b[2] + c[2]) / 3];
    if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0) {
      tris[t + 1] = c;
      tris[t + 2] = b;
    }
  }
}

export function emeraldCutTriangles() {
  const tris = [];
  const crown = CROWN.map(([d, y]) => octagonRing(d, y));
  const pavilion = PAVILION.map(([d, y]) => octagonRing(d, y));
  bridge(tris, pavilion[0], crown[0]); // girdle band
  for (let i = 0; i < crown.length - 1; i++) bridge(tris, crown[i], crown[i + 1]);
  for (let i = 0; i < pavilion.length - 1; i++) bridge(tris, pavilion[i + 1], pavilion[i]);
  fan(tris, crown[crown.length - 1], [0, CROWN[CROWN.length - 1][1], 0]); // table
  fan(tris, pavilion[pavilion.length - 1], [0, KEEL_Y, 0]); // keel
  orientOutward(tris);
  return tris;
}

export function createEmeraldCutGeometry() {
  const positions = emeraldCutTriangles().flat();
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.center();
  return geometry;
}

/* The stone as an intersection of half-spaces: one [nx, ny, nz, d] per facet
 * (dot(n, p) = d on the facet, n pointing out). The gem shader traces light
 * inside the stone against these. */
export function facetPlanes(geometry) {
  const p = geometry.attributes.position.array;
  const planes = [];
  for (let i = 0; i < p.length; i += 9) {
    const a = [p[i], p[i + 1], p[i + 2]];
    const u = [p[i + 3] - a[0], p[i + 4] - a[1], p[i + 5] - a[2]];
    const v = [p[i + 6] - a[0], p[i + 7] - a[1], p[i + 8] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(...n);
    if (len < 1e-12) continue;
    n[0] /= len;
    n[1] /= len;
    n[2] /= len;
    const d = n[0] * a[0] + n[1] * a[1] + n[2] * a[2];
    const same = planes.some((q) => Math.abs(q[3] - d) < 1e-4 && q[0] * n[0] + q[1] * n[1] + q[2] * n[2] > 1 - 1e-6);
    if (!same) planes.push([n[0], n[1], n[2], d]);
  }
  return planes;
}
