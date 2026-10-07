import { Matrix3, ShaderMaterial, Vector3, Vector4 } from "three";

/*
 * The stone, ray-cast and ray-traced as an intersection of planes.
 *
 * It is drawn on its bounding box: each pixel intersects the view ray with
 * the planes (a convex solid needs nothing more), writes the true depth, and
 * shades the facet it hit. Because the solid is only planes, the cut can be
 * animated — the rough crystal's faces are fixed, and each facet plane slides
 * in from outside until the polished stone remains.
 *
 * Shading: light refracts in, crosses the stone (absorbed per channel,
 * Beer–Lambert), and at each facet it reaches either leaves into the studio
 * cube map or is totally internally reflected — the stepped "hall of
 * mirrors" of an emerald cut. Faces of the rough are frosted: a perturbed
 * normal and blurred reflections, with milky light from within. Cut facets
 * are polished. Dispersion splits the way out per colour channel.
 */

const vertexShader = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vEye;
  void main() {
    vPos = position;
    vEye = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform mat4 modelMatrix;
  uniform mat4 projectionMatrix;
  uniform samplerCube envMap;
  uniform mat3 envRotation;
  uniform vec4 planes[PLANE_COUNT];
  uniform float planeFrost[PLANE_COUNT];
  uniform vec3 absorption;
  uniform float ior;
  uniform float spread;
  varying vec3 vPos;
  varying vec3 vEye;

  vec3 studio(vec3 objectDir, float blur) {
    vec3 dir = envRotation * normalize(mat3(modelMatrix) * objectDir);
    return textureLod(envMap, dir, blur).rgb;
  }

  float schlick(float cosI, float eta) {
    float f0 = pow((eta - 1.0) / (eta + 1.0), 2.0);
    return f0 + (1.0 - f0) * pow(1.0 - cosI, 5.0);
  }

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }

  vec3 traceInside(vec3 pos, vec3 dir) {
    vec3 carry = vec3(1.0);
    for (int bounce = 0; bounce < BOUNCES; bounce++) {
      float travel = 1e6;
      vec3 n = vec3(0.0, 1.0, 0.0);
      float frost = 0.0;
      for (int i = 0; i < PLANE_COUNT; i++) {
        float facing = dot(dir, planes[i].xyz);
        if (facing > 1e-4) {
          float t = (planes[i].w - dot(pos, planes[i].xyz)) / facing;
          if (t < travel) { travel = t; n = planes[i].xyz; frost = planeFrost[i]; }
        }
      }
      travel = max(travel, 0.0);
      pos += dir * travel;
      carry *= exp(-absorption * travel);

      vec3 out_ = refract(dir, -n, ior);
      if (dot(out_, out_) > 0.0) {
        float blur = frost * 5.0;
        vec3 r = refract(dir, -n, ior - spread);
        vec3 b = refract(dir, -n, ior + spread);
        if (dot(r, r) == 0.0) r = out_;
        if (dot(b, b) == 0.0) b = out_;
        vec3 light = vec3(studio(r, blur).r, studio(out_, blur).g, studio(b, blur).b);
        return carry * light * (1.0 - schlick(dot(out_, n), ior));
      }
      dir = reflect(dir, -n);
    }
    return carry * studio(dir, 2.0) * 0.6;
  }

  void main() {
    vec3 dir = normalize(vPos - vEye);
    float tNear = -1e6;
    float tFar = 1e6;
    vec3 N = vec3(0.0, 1.0, 0.0);
    float frost = 0.0;
    for (int i = 0; i < PLANE_COUNT; i++) {
      vec3 n = planes[i].xyz;
      float den = dot(dir, n);
      float dist = planes[i].w - dot(vEye, n);
      if (abs(den) < 1e-6) {
        if (dist < 0.0) discard;
        continue;
      }
      float t = dist / den;
      if (den < 0.0) {
        if (t > tNear) { tNear = t; N = n; frost = planeFrost[i]; }
      } else {
        tFar = min(tFar, t);
      }
    }
    if (tNear > tFar || tNear < 0.0) discard;

    vec3 P = vEye + dir * tNear;
    vec4 clip = projectionMatrix * viewMatrix * modelMatrix * vec4(P, 1.0);
    gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);

    // Natural crystal faces: a fine, matte, slightly pitted skin — two
    // octaves of small-scale relief rather than large waves.
    if (frost > 0.0) {
      vec3 q = P * 34.0;
      vec3 bump = vec3(noise(q), noise(q + 17.3), noise(q + 41.7)) - 0.5;
      q *= 2.7;
      bump += 0.5 * (vec3(noise(q), noise(q + 9.1), noise(q + 23.9)) - 0.5);
      N = normalize(N + frost * 0.3 * bump);
    }

    float cosI = clamp(dot(-dir, N), 0.0, 1.0);
    float fresnel = schlick(cosI, ior) * (1.0 - frost * 0.5);
    vec3 inside = traceInside(P, refract(dir, N, 1.0 / ior));
    // Light scattered in the frosted skin and the milky body of the rough.
    vec3 milk = studio(N, 6.0) * vec3(0.3, 0.46, 0.38);
    inside = mix(inside, milk + inside * 0.2, frost * 0.88);
    vec3 color = inside * (1.0 - fresnel) + studio(reflect(dir, N), frost * 6.0) * fresnel;

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
      envRotation: { value: new Matrix3() },
      planes: { value: planes.map(([x, y, z, d]) => new Vector4(x, y, z, d)) },
      planeFrost: { value: planes.map(() => 0) },
      // per unit length, in the stone's own units: red and blue are absorbed,
      // green carries — an emerald's body colour.
      absorption: { value: new Vector3(1.45, 0.2, 0.85) },
      ior: { value: 1.58 }, // beryl
      spread: { value: high ? 0.006 : 0 }, // beryl's fire is faint
    },
  });
}
