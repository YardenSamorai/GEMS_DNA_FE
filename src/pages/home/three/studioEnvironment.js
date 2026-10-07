import {
  BackSide,
  BoxGeometry,
  Color,
  CubeCamera,
  DoubleSide,
  HalfFloatType,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Scene,
  WebGLCubeRenderTarget,
} from "three";

/*
 * A small product-photography studio, baked once into a cube map that the
 * gem shader samples along its reflected and refracted rays. Gem
 * photographers light with large soft boxes and use black cards to give
 * facets contrast; this does the same. Panel brightness > 1 is intentional —
 * the target is half-float, so the soft boxes stay HDR and read as crisp
 * highlights after tone mapping.
 */

const PANELS = [
  { size: [7, 0.45], at: [0, 5.5, -2.2], rot: [Math.PI / 2, 0], lum: 6 }, // overhead strips
  { size: [7, 0.45], at: [0, 5.5, 0], rot: [Math.PI / 2, 0], lum: 6 },
  { size: [7, 0.45], at: [0, 5.5, 2.2], rot: [Math.PI / 2, 0], lum: 4 },
  { size: [2.4, 4.5], at: [-5.5, 1.2, 1.5], rot: [0, Math.PI / 2], lum: 4.5 }, // key, left
  { size: [1.4, 4.5], at: [5.5, 0.6, -1], rot: [0, -Math.PI / 2], lum: 2.2 }, // rim, right
  { size: [4, 0.7], at: [0, 1.6, 5.5], rot: [0, Math.PI], lum: 1.5 }, // front strip
  { size: [0.5, 3], at: [3, 2, 5.4], rot: [0, Math.PI], lum: 3.2 }, // narrow accent
  { size: [5, 3.5], at: [-0.5, -5.5, 0.5], rot: [-Math.PI / 2, 0], lum: 1.6 }, // light table below
];

const FLAGS = [
  { size: [3.5, 4], at: [0, 1, -5.4], rot: [0, 0] },
  { size: [3, 3.5], at: [5.4, 0.5, 3], rot: [0, -Math.PI / 2] },
  { size: [2, 3], at: [-5.4, -1, -2.5], rot: [0, Math.PI / 2] },
];

export function createStudioCube(renderer, { size = 256 } = {}) {
  const scene = new Scene();
  const owned = [];
  const add = (geometry, material, at, rot) => {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(...at);
    if (rot) mesh.rotation.set(rot[0], rot[1], 0);
    scene.add(mesh);
    owned.push(geometry, material);
  };

  add(new BoxGeometry(12, 12, 12), new MeshBasicMaterial({ color: new Color(0.09, 0.09, 0.1), side: BackSide }), [0, 0, 0]);
  for (const p of PANELS) {
    add(new PlaneGeometry(...p.size), new MeshBasicMaterial({ color: new Color(1, 1, 1).multiplyScalar(p.lum), side: DoubleSide }), p.at, p.rot);
  }
  for (const f of FLAGS) {
    add(new PlaneGeometry(...f.size), new MeshBasicMaterial({ color: new Color(0.01, 0.01, 0.012), side: DoubleSide }), f.at, f.rot);
  }

  const target = new WebGLCubeRenderTarget(size, { type: HalfFloatType, generateMipmaps: false });
  new CubeCamera(0.1, 100, target).update(renderer, scene);
  owned.forEach((o) => o.dispose());
  return target;
}
