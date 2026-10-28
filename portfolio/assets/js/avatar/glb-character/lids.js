/**
 * Blink lids for the GLB avatar, whose eyes are painted in its texture (no eyelid geometry, no
 * morph targets). A shader lid on the model's own material (onBeforeCompile): in the mesh's bind
 * pose (the vertex position before skinning, so the lid follows the head whatever the bones do),
 * each painted eye is the region measured in eyes.js. As the blink goes 0 -> 1 a lid edge sweeps
 * from above the upper lash line down to the lower edge of the eye; above it the eye is painted
 * over with his own skin (sampled from the texture just above that eye), shaded a little darker
 * toward the edge, with a lash line along the edge. At 0 nothing changes (the branch is skipped).
 * The lid also takes the skin's roughness and metalness and drops the eye's normal-map relief.
 */
import * as THREE from 'three';
import { EYES, LID } from './eyes.js';
import { bindToNode } from './shader-patch.js';

const VERTEX_PARS = /* glsl */`
uniform mat4 lidMatrix;
uniform mat3 lidAxes; // model-space axes in geometry space
varying vec3 vLidPos;
varying vec3 vLidX;
varying vec3 vLidY;
varying vec3 vLidZ;
`;

// where the bind pose's model axes point now (view space), to light the lid as a curved surface
const VERTEX_AXES = /* glsl */`
#ifdef USE_SKINNING
mat3 lidSkin = mat3(skinMatrix);
#else
mat3 lidSkin = mat3(1.0);
#endif
vLidX = normalMatrix * (lidSkin * lidAxes[0]);
vLidY = normalMatrix * (lidSkin * lidAxes[1]);
vLidZ = normalMatrix * (lidSkin * lidAxes[2]);
`;

const FRAGMENT_PARS = /* glsl */`
uniform float lidBlink;
uniform vec4 lidAxis[2];   // centre x, y; axis x, y
uniform vec4 lidShape[2];  // half (with margin), zMin, margin, lash
uniform vec4 lidTop[2];
uniform vec4 lidBottom[2];
uniform vec2 lidSkin[6];   // three skin uvs per eye, along it
uniform vec4 lidBall[2];   // the eye's sphere: centre, radius
varying vec3 vLidPos;
varying vec3 vLidX;
varying vec3 vLidY;
varying vec3 vLidZ;

float lidCurve(vec4 c, float u) {
  return sqrt(max(0.0, 1.0 - u * u)) * (c.x + u * (c.y + u * (c.z + u * c.w)));
}

// x: cover (0..1), y: lash (0..1), z: shade, w: u along the eye (-1..1); round: how far inside the
// outline (0 on it, 1 a few millimetres in). No branches, so the derivatives (fwidth) stay defined.
vec4 lidEye(vec4 axis, vec4 shape, vec4 top, vec4 bottom, out float round) {
  vec2 d = vLidPos.xy - axis.xy;
  float u = dot(d, axis.zw) / shape.x;
  float v = dot(d, vec2(-axis.w, axis.z));
  float aa = max(fwidth(v), 1e-5);
  float inside = step(abs(u), 0.999) * step(shape.y, vLidPos.z);
  u = clamp(u, -1.0, 1.0);
  float upper = lidCurve(top, u) + shape.z;
  float lower = -lidCurve(bottom, u) - shape.z;
  float edge = mix(upper + 2.0 * aa, lower, lidBlink);
  float above = v - edge;
  float cover = inside * smoothstep(-aa, aa, above) * (1.0 - smoothstep(upper, upper + 2.0 * aa, v));
  float lashWidth = shape.w * (0.45 + 0.55 * sqrt(1.0 - u * u)) * smoothstep(0.0, 0.08, lidBlink);
  float lash = 1.0 - smoothstep(lashWidth - aa, lashWidth + aa, above);
  // the lid curves under toward its edge: darker there, a touch lighter higher up
  float shade = mix(0.84, 1.0, smoothstep(0.0, 0.006, above));
  round = smoothstep(0.0, 0.004, min(upper - v, v - lower)) * smoothstep(0.0, 0.25, 1.0 - abs(u));
  return vec4(cover, lash, shade, u);
}

// the skin just above the eye, blended along it from three samples (their uvs may sit in
// different texture islands, so the colours are blended, never the uvs)
vec4 lidSkinColor(sampler2D tex, int eye, float u) {
  vec4 a = texture2D(tex, lidSkin[eye * 3]);
  vec4 b = texture2D(tex, lidSkin[eye * 3 + 1]);
  vec4 c = texture2D(tex, lidSkin[eye * 3 + 2]);
  return u < 0.0 ? mix(a, b, u + 1.0) : mix(b, c, u);
}
`;

const FRAGMENT_LID = /* glsl */`
float lidCover = 0.0;
float lidRound = 0.0;
int lidSide = 0;
float lidU = 0.0;
#ifdef USE_MAP
if (lidBlink > 0.0) {
  float roundA;
  float roundB;
  vec4 eyeA = lidEye(lidAxis[0], lidShape[0], lidTop[0], lidBottom[0], roundA);
  vec4 eyeB = lidEye(lidAxis[1], lidShape[1], lidTop[1], lidBottom[1], roundB);
  bool first = eyeA.x >= eyeB.x;
  vec4 lid = first ? eyeA : eyeB;
  lidCover = lid.x;
  lidRound = first ? roundA : roundB;
  lidSide = first ? 0 : 1;
  lidU = lid.w;
  vec3 skin = diffuse * lidSkinColor(map, lidSide, lidU).rgb * lid.z;
  vec3 lidColor = mix(skin, vec3(0.012, 0.009, 0.008), lid.y);
  diffuseColor.rgb = mix(diffuseColor.rgb, lidColor, lidCover);
}
#endif
`;

const ROUGHNESS_LID = /* glsl */`
#ifdef USE_ROUGHNESSMAP
if (lidBlink > 0.0) roughnessFactor = mix(roughnessFactor, roughness * lidSkinColor(roughnessMap, lidSide, lidU).g, lidCover);
#endif
`;

const METALNESS_LID = /* glsl */`
#ifdef USE_METALNESSMAP
if (lidBlink > 0.0) metalnessFactor = mix(metalnessFactor, metalness * lidSkinColor(metalnessMap, lidSide, lidU).b, lidCover);
#endif
`;

// over the lid: no painted-eye relief from the normal map or the mesh, the eye's sphere instead
const NORMAL_LID = /* glsl */`
if (lidCover > 0.0) {
  vec4 ball = lidBall[lidSide];
  vec3 nb = normalize(vLidPos - ball.xyz);
  vec3 lidNormal = normalize(nb.x * vLidX + nb.y * vLidY + nb.z * vLidZ);
  vec3 smoothNormal = normalize(mix(nonPerturbedNormal, lidNormal, lidRound));
  normal = normalize(mix(normal, smoothNormal, lidCover));
}
`;

const curveAt = (c, u) => Math.sqrt(Math.max(0, 1 - u * u)) * (c[0] + u * (c[1] + u * (c[2] + u * c[3])));

/** UVs of the skin just above each eye: the nearest front-facing vertex to each sample point. */
function skinUvs(mesh, toModel) {
  const pos = mesh.geometry.getAttribute('position');
  const uv = mesh.geometry.getAttribute('uv');
  if (!uv) throw new Error('lids: the avatar has no uv');
  const targets = EYES.flatMap((eye) => LID.skinAt.map((u) => {
    const h = curveAt(eye.top, u) + LID.margin + LID.skinAbove;
    const along = u * eye.half;
    return {
      x: eye.center[0] + eye.axis[0] * along - eye.axis[1] * h,
      y: eye.center[1] + eye.axis[1] * along + eye.axis[0] * h,
      zMin: eye.zMin, best: Infinity, index: -1,
    };
  }));
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    p.fromBufferAttribute(pos, i).applyMatrix4(toModel);
    for (let k = 0; k < targets.length; k += 1) {
      const t = targets[k];
      if (p.z < t.zMin) continue;
      const d = (p.x - t.x) ** 2 + (p.y - t.y) ** 2;
      if (d < t.best) { t.best = d; t.index = i; }
    }
  }
  return targets.map((t) => {
    if (t.index < 0) throw new Error('lids: no skin found above the eyes');
    return new THREE.Vector2(uv.getX(t.index), uv.getY(t.index));
  });
}

function makeUniforms(model, mesh) {
  const toModel = bindToNode(model, mesh);
  const map = mesh.material.map;
  if (!map) throw new Error('lids: the avatar has no base colour texture');
  map.updateMatrix(); // the shader samples the skin at these uvs, so apply the map's own transform here
  return {
    lidBlink: { value: 0 },
    lidMatrix: { value: toModel },
    lidAxes: { value: new THREE.Matrix3().setFromMatrix4(toModel).invert() },
    lidBall: { value: EYES.map((e) => new THREE.Vector4(...e.ball)) },
    lidAxis: { value: EYES.map((e) => new THREE.Vector4(e.center[0], e.center[1], e.axis[0], e.axis[1])) },
    lidShape: { value: EYES.map((e) => new THREE.Vector4(e.half + LID.margin, e.zMin, LID.margin, LID.lash)) },
    lidTop: { value: EYES.map((e) => new THREE.Vector4(...e.top)) },
    lidBottom: { value: EYES.map((e) => new THREE.Vector4(...e.bottom)) },
    lidSkin: { value: skinUvs(mesh, toModel).map((uv) => uv.applyMatrix3(map.matrix)) },
  };
}

/**
 * @param {{ model: THREE.Object3D, mesh: THREE.SkinnedMesh }} opts call in the bind pose
 * @returns {{ patch: object, set(value: number): void, readonly value: number }} patch: for
 *   patchMaterial() (shader-patch.js)
 */
export function createLids({ model, mesh }) {
  const uniforms = makeUniforms(model, mesh);
  const patch = {
    key: 'lids1',
    uniforms,
    edits: [
      ['vertex', '#include <common>', VERTEX_PARS],
      ['vertex', '#include <begin_vertex>', 'vLidPos = (lidMatrix * vec4(position, 1.0)).xyz;'],
      ['vertex', '#include <defaultnormal_vertex>', VERTEX_AXES],
      ['fragment', '#include <common>', FRAGMENT_PARS],
      ['fragment', '#include <map_fragment>', FRAGMENT_LID],
      ['fragment', '#include <roughnessmap_fragment>', ROUGHNESS_LID],
      ['fragment', '#include <metalnessmap_fragment>', METALNESS_LID],
      ['fragment', '#include <normal_fragment_maps>', NORMAL_LID],
    ],
  };
  return {
    patch,
    /** @param {number} value 0 open .. 1 closed */
    set(value) {
      uniforms.lidBlink.value = Math.min(1, Math.max(0, Number(value) || 0));
    },
    get value() { return uniforms.lidBlink.value; },
  };
}
