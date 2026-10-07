import QRCode from "qrcode";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  EdgesGeometry,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
} from "three";

/*
 * The digital layer that forms around the cut stone: its facet edges traced
 * and its corners anchored (top to bottom, like a scan), then its code
 * assembling behind it. Each piece reveals with a single 0..1 uniform.
 */

/* Facet edges, revealed in order from the table down. */
export function createEdgeTrace(stoneGeometry) {
  const geometry = new EdgesGeometry(stoneGeometry, 1);
  const p = geometry.attributes.position.array;
  const segments = p.length / 6;
  const mids = Array.from({ length: segments }, (_, s) => [s, (p[s * 6 + 1] + p[s * 6 + 4]) / 2]);
  mids.sort((a, b) => b[1] - a[1]);
  const order = new Float32Array(segments * 2);
  mids.forEach(([s], rank) => {
    order[s * 2] = order[s * 2 + 1] = rank / segments;
  });
  geometry.setAttribute("order", new BufferAttribute(order, 1));

  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: { reveal: { value: 0 }, opacity: { value: 0 }, color: { value: new Color("#ffffff") } },
    vertexShader: /* glsl */ `
      attribute float order;
      varying float vOrder;
      void main() {
        vOrder = order;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float reveal;
      uniform float opacity;
      uniform vec3 color;
      varying float vOrder;
      void main() {
        if (vOrder > reveal) discard;
        gl_FragColor = vec4(color, opacity);
      }
    `,
  });
  return { geometry, material };
}

/* A point at every corner of the cut, appearing just behind the edge trace. */
export function createAnchors(stoneGeometry) {
  const src = stoneGeometry.attributes.position.array;
  const seen = new Map();
  for (let i = 0; i < src.length; i += 3) {
    const key = `${src[i].toFixed(4)},${src[i + 1].toFixed(4)},${src[i + 2].toFixed(4)}`;
    if (!seen.has(key)) seen.set(key, [src[i], src[i + 1], src[i + 2]]);
  }
  const points = [...seen.values()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const position = new Float32Array(points.flat());
  const order = new Float32Array(points.map((_, i) => i / points.length));

  const pts = new BufferGeometry();
  pts.setAttribute("position", new BufferAttribute(position, 3));
  pts.setAttribute("order", new BufferAttribute(order, 1));

  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: { reveal: { value: 0 }, opacity: { value: 0 }, size: { value: 6 }, color: { value: new Color("#10b981") } },
    vertexShader: /* glsl */ `
      attribute float order;
      uniform float reveal;
      uniform float size;
      varying float vShow;
      void main() {
        float since = reveal - order;
        vShow = step(0.0, since);
        // a small settle as each point lands
        float pop = 1.0 + 0.8 * exp(-since * 40.0) * vShow;
        gl_PointSize = size * pop;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float opacity;
      uniform vec3 color;
      varying float vShow;
      void main() {
        if (vShow < 0.5) discard;
        vec2 c = gl_PointCoord - 0.5;
        float r = length(c);
        if (r > 0.5) discard;
        float edge = smoothstep(0.5, 0.36, r);
        vec3 tint = mix(color, vec3(1.0), smoothstep(0.22, 0.0, r) * 0.55);
        gl_FragColor = vec4(tint, opacity * edge);
      }
    `,
  });
  return { geometry: pts, material };
}

/*
 * A real, scannable QR code for gems-dna.com, laid out as a field of modules
 * behind the stone — quiet grey on the page's grey, finder squares a shade
 * darker. Modules grow in from the stone outwards.
 */
export function createCodeField({ size = 2.5, text = "https://gems-dna.com", origin = [0, 0] } = {}) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const cell = size / n;
  const cells = [];
  const finder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.modules.get(r, c)) continue;
      const x = (c - (n - 1) / 2) * cell;
      const y = ((n - 1) / 2 - r) * cell;
      cells.push({ x, y, finder: finder(r, c), dist: Math.hypot(x - origin[0], y - origin[1]) });
    }
  }
  const furthest = Math.max(...cells.map((cellInfo) => cellInfo.dist));
  cells.forEach((cellInfo) => (cellInfo.dist /= furthest));
  const geometry = new PlaneGeometry(cell * 0.86, cell * 0.86);
  const material = new MeshBasicMaterial({ toneMapped: false });
  const mesh = new InstancedMesh(geometry, material, cells.length);
  const light = new Color("#d9d9de");
  const dark = new Color("#c2c2c8");
  cells.forEach((cellInfo, i) => mesh.setColorAt(i, cellInfo.finder ? dark : light));
  mesh.instanceColor.needsUpdate = true;

  const dummy = new Object3D();
  const update = (amount) => {
    cells.forEach((cellInfo, i) => {
      const t = Math.min(1, Math.max(0, (amount * 1.35 - cellInfo.dist * 0.95) / 0.3));
      const s = t * t * (3 - 2 * t);
      dummy.position.set(cellInfo.x, cellInfo.y, 0);
      dummy.scale.setScalar(Math.max(s, 1e-4));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.visible = amount > 0.001;
  };
  update(0);
  const dispose = () => {
    geometry.dispose();
    material.dispose();
  };
  return { mesh, update, dispose };
}
