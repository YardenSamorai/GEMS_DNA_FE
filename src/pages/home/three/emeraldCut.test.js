import { createEmeraldCutGeometry, emeraldCutTriangles, facetPlanes, octagonRing } from "./emeraldCut";

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];

describe("emerald-cut geometry", () => {
  const tris = emeraldCutTriangles();
  const faces = [];
  for (let i = 0; i < tris.length; i += 3) faces.push([tris[i], tris[i + 1], tris[i + 2]]);

  it("winds every face counter-clockwise when seen from outside", () => {
    const ys = tris.map((p) => p[1]);
    const center = [0, (Math.max(...ys) + Math.min(...ys)) / 2, 0];
    for (const [a, b, c] of faces) {
      const n = cross(sub(b, a), sub(c, a));
      const centroid = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
      expect(dot(n, sub(centroid, center))).toBeGreaterThan(0);
    }
  });

  it("has an upward-facing table and a downward-facing keel", () => {
    const top = Math.max(...tris.map((p) => p[1]));
    const table = faces.filter((f) => f.every((p) => Math.abs(p[1] - top) < 1e-9));
    expect(table.length).toBeGreaterThan(0);
    for (const [a, b, c] of table) expect(cross(sub(b, a), sub(c, a))[1]).toBeGreaterThan(0);
  });

  it("keeps the corner facets at 45° on every ring", () => {
    for (const inset of [0, 0.1, 0.3, 0.64]) {
      const ring = octagonRing(inset, 0);
      const [p, q] = [ring[0], ring[1]];
      expect(Math.abs(Math.abs(p[0] - q[0]) - Math.abs(p[2] - q[2]))).toBeLessThan(1e-9);
    }
  });

  it("describes the stone as one plane per facet, with every vertex inside", () => {
    const geometry = createEmeraldCutGeometry();
    const planes = facetPlanes(geometry);
    // girdle 8 + crown 3×8 + table 1 + pavilion 4×8 + keel 8
    expect(planes).toHaveLength(73);
    const p = geometry.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      for (const [x, y, z, d] of planes) expect(x * p[i] + y * p[i + 1] + z * p[i + 2]).toBeLessThanOrEqual(d + 1e-5);
    }
  });

  it("builds a closed, flat-shaded mesh", () => {
    const geometry = createEmeraldCutGeometry();
    expect(geometry.index).toBeNull();
    expect(geometry.attributes.position.count).toBe(tris.length);
    expect(geometry.attributes.normal.count).toBe(tris.length);
  });
});
