/**
 * Fine surface detail for the clay materials, computed in the shader from the object-space
 * position (the meshed SDF parts have no UVs):
 *
 *  strands  combed strands: fine stripes along the hair's flow (the low-frequency axis), warped
 *           and broken up by value noise, bent into the normal (and a touch into the colour) so the
 *           key light shows strands and clumps
 *  knit     a small pique relief for the polo (sum of sines on the three axes, broken up by noise)
 *
 * The relief fades out when it gets finer than a pixel (no shimmer when the camera pulls back).
 */
import * as THREE from 'three';

const NOISE = /* glsl */ `
varying vec3 vDetailPos;
uniform mat3 normalMatrix;
float detailHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float detailNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(detailHash(i), detailHash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(detailHash(i + vec3(0.0, 1.0, 0.0)), detailHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(detailHash(i + vec3(0.0, 0.0, 1.0)), detailHash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(detailHash(i + vec3(0.0, 1.0, 1.0)), detailHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
`;

const HEIGHT = Object.freeze({
  strands: /* glsl */ `
float detailHeight(vec3 p) {
  vec3 q = p * DETAIL_FREQ;
  float warp = 2.6 * detailNoise(q * 0.13) + 1.2 * detailNoise(q * 0.31 + 3.7);
  float comb = 0.5 + 0.5 * sin(q.x + q.y + q.z + warp * 1.7);
  return mix(comb, detailNoise(q * 0.7 + 1.3), DETAIL_NOISE);
}`,
  knit: /* glsl */ `
float detailHeight(vec3 p) {
  vec3 q = p * DETAIL_FREQ;
  return mix(0.5 + 0.17 * (sin(q.x) + sin(q.y) + sin(q.z)), detailNoise(q * 0.9), DETAIL_NOISE);
}`,
});

/**
 * @param {THREE.Material} material a MeshStandardMaterial / MeshPhysicalMaterial
 * @param {{ kind: 'strands'|'knit', freq: number[], bump: number, shade?: number }} opts
 *   freq: spatial frequency per axis (object units), bump: normal strength, shade: colour darkening
 *   in the low parts (0..1), noise: how much of the strand pattern is broken up by noise (0..1)
 */
export function addDetail(material, { kind, freq, bump, shade = 0, noise = 0.3 }) {
  if (!HEIGHT[kind]) throw new Error(`unknown detail kind ${kind}`);
  const f = freq.map((v) => Number(v).toFixed(3)).join(', ');
  const key = `detail:${kind}:${f}:${bump}:${shade}:${noise}`;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDetailPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDetailPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n#define DETAIL_FREQ vec3(${f})\n#define DETAIL_NOISE ${Number(noise).toFixed(3)}\n${NOISE}${HEIGHT[kind]}\nvec3 detailGrad;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float maxFreq = max(DETAIL_FREQ.x, max(DETAIL_FREQ.y, DETAIL_FREQ.z));
  float fade = clamp(1.6 - length(fwidth(vDetailPos)) * maxFreq * 0.45, 0.0, 1.0);
  float e = 0.15 / maxFreq;
  float h0 = detailHeight(vDetailPos);
  detailGrad = vec3(detailHeight(vDetailPos + vec3(e, 0.0, 0.0)) - h0,
                    detailHeight(vDetailPos + vec3(0.0, e, 0.0)) - h0,
                    detailHeight(vDetailPos + vec3(0.0, 0.0, e)) - h0) / e * fade;
  diffuseColor.rgb *= 1.0 - ${Number(shade).toFixed(3)} * (1.0 - h0) * fade;
}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  vec3 g = normalMatrix * detailGrad;
  normal = normalize(normal - ${Number(bump).toFixed(4)} * (g - dot(g, normal) * normal));
}`);
  };
  material.customProgramCacheKey = () => key;
  material.needsUpdate = true;
  return material;
}

/**
 * Sheen and specular that follow the albedo: the warm velvet edge and the shine show on bright
 * skin, while the dark painted fade, stubble and tattoo stay matte (three.js would otherwise put
 * the coloured rim lights on top of any colour, and the fade would read lavender).
 */
export function tintSheen(material) {
  material.onBeforeCompile = (shader) => {
    const bright = 'clamp(dot(diffuseColor.rgb, vec3(0.9, 0.6, 0.3)), 0.0, 1.0)';
    const chunk = THREE.ShaderChunk.lights_physical_fragment.replace(
      'material.sheenColor = sheenColor;',
      `material.sheenColor = sheenColor * ${bright};`,
    ) + `\nmaterial.specularColor *= mix(0.15, 1.0, clamp(${bright} * 1.6, 0.0, 1.0));`;
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_fragment>', chunk);
  };
  material.customProgramCacheKey = () => 'tint-sheen';
  material.needsUpdate = true;
  return material;
}
