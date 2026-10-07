import { ShaderMaterial, Vector3, Vector4 } from "three";

/*
 * Faceted-gem shading, traced against the stone's own facets.
 *
 * Physically based transmission only sees the flat page behind the canvas,
 * so a stone reads as tinted plastic. Here light is followed through the
 * actual cut: it refracts in at the facet, crosses the stone (absorbed per
 * colour channel, Beer–Lambert), and at each facet it reaches it either
 * leaves — refracted out into the studio cube map — or is totally internally
 * reflected and travels on. The stone is convex, so "which facet next" is a
 * nearest-plane test over the facet list. This is what draws the stepped
 * "hall of mirrors" an emerald cut shows through its table. The way out is
 * refracted once per colour channel with slightly different indices: the
 * dispersion ("fire") at facet edges.
 */

const vertexShader = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vPos = position;
    vNormal = normal;
    vec3 eye = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
    vView = position - eye;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform mat4 modelMatrix;
  uniform samplerCube envMap;
  uniform vec4 planes[PLANE_COUNT];
  uniform vec3 absorption;
  uniform float ior;
  uniform float spread;
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vView;

  vec3 studio(vec3 objectDir) {
    return textureCube(envMap, normalize(mat3(modelMatrix) * objectDir)).rgb;
  }

  float schlick(float cosI, float eta) {
    float f0 = pow((eta - 1.0) / (eta + 1.0), 2.0);
    return f0 + (1.0 - f0) * pow(1.0 - cosI, 5.0);
  }

  vec3 traceInside(vec3 pos, vec3 dir) {
    vec3 carry = vec3(1.0);
    for (int bounce = 0; bounce < BOUNCES; bounce++) {
      float travel = 1e6;
      vec3 n = vec3(0.0, 1.0, 0.0);
      for (int i = 0; i < PLANE_COUNT; i++) {
        float facing = dot(dir, planes[i].xyz);
        if (facing > 1e-4) {
          float t = (planes[i].w - dot(pos, planes[i].xyz)) / facing;
          if (t < travel) { travel = t; n = planes[i].xyz; }
        }
      }
      travel = max(travel, 0.0);
      pos += dir * travel;
      carry *= exp(-absorption * travel);

      vec3 out_ = refract(dir, -n, ior);
      if (dot(out_, out_) > 0.0) {
        vec3 r = refract(dir, -n, ior - spread);
        vec3 b = refract(dir, -n, ior + spread);
        if (dot(r, r) == 0.0) r = out_;
        if (dot(b, b) == 0.0) b = out_;
        vec3 light = vec3(studio(r).r, studio(out_).g, studio(b).b);
        return carry * light * (1.0 - schlick(dot(out_, n), ior));
      }
      dir = reflect(dir, -n);
    }
    return carry * studio(dir) * 0.6;
  }

  void main() {
    vec3 V = normalize(vView);
    vec3 N = normalize(vNormal);
    float fresnel = schlick(clamp(dot(-V, N), 0.0, 1.0), ior);
    vec3 inside = traceInside(vPos, refract(V, N, 1.0 / ior));
    vec3 color = inside * (1.0 - fresnel) + studio(reflect(V, N)) * fresnel;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createGemMaterial(envMap, planes, { quality }) {
  const high = quality === "high";
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    defines: { PLANE_COUNT: planes.length, BOUNCES: high ? 5 : 3 },
    uniforms: {
      envMap: { value: envMap },
      planes: { value: planes.map(([x, y, z, d]) => new Vector4(x, y, z, d)) },
      // per unit length, in the stone's own units: red and blue are absorbed,
      // green carries — an emerald's body colour.
      absorption: { value: new Vector3(1.45, 0.2, 0.85) },
      ior: { value: 1.58 }, // beryl
      spread: { value: high ? 0.006 : 0 }, // beryl's fire is faint
    },
  });
}
