/**
 * Hair and beard as distance functions, in head-joint space (see head-shapes.js).
 *
 *  hair   Saeed's cut: black, a dome of volume on top swept up and back with a soft quiff at the
 *         front, fuller on his right, short on the sides, and a high skin fade (the fade itself is
 *         painted on the skin, below the crisp edge of this mass).
 *  beard  a full, groomed short beard as its own sculpted volume: thin at the sharp diagonal cheek
 *         line, fuller along the jaw, longest under the chin, a connected mustache, and an opening
 *         where the lips show. Strand detail comes from the material (detail.js).
 */
import { clamp, ellipsoid, mix, noise3, smax, smin, smoothstep } from './sdf.js';
import { around, beardTop, faceBase, hairline, skin, skull } from './head-shapes.js';
import { PALETTE } from './palette.js';

const HAIR = Object.freeze({
  edge: 0.025, // thickness right at the lower edge
  slope: 0.5, // the hair can only grow this much thicker per unit of height above its edge
  slopeFront: 0.5, // gentler at the forehead: the front rises from a soft hairline, no ledge
  side: 0.055, // the short hair on the sides and back
});
// The volume on top: a dome, higher at the front and fuller on his right (viewer's left).
const DOME = Object.freeze({ x: -0.03, y: 1.58, z: -0.1, rxRight: 0.75, rxLeft: 0.7, ry: 0.66, rz: 1.0, tilt: -0.12 });
const DOME_COS = Math.cos(DOME.tilt);
const DOME_SIN = Math.sin(DOME.tilt);
const QUIFF = Object.freeze({ x: -0.1, y: 1.98, z: 0.22, rx: 0.5, ry: 0.2, rz: 0.32, lift: -0.35, blend: 0.26 });
const QUIFF_COS = Math.cos(QUIFF.lift);
const QUIFF_SIN = Math.sin(QUIFF.lift);
const PART = Object.freeze({ x: 0.5, soft: 0.07, extra: 0.03 });
const EAR_CLEAR = Object.freeze({ x: 0.84, y: 0.86, z: -0.12, rx: 0.2, ry: 0.42, rz: 0.32 });

function dome(x, y, z) {
  const dy = y - DOME.y;
  const dz = z - DOME.z;
  const rx = x < DOME.x ? DOME.rxRight : DOME.rxLeft;
  return ellipsoid(x, dy * DOME_COS - dz * DOME_SIN, dy * DOME_SIN + dz * DOME_COS, DOME.x, 0, 0, rx, DOME.ry, DOME.rz);
}

/** Front lock: swept up and back, a little higher on his right. */
function quiff(x, y, z) {
  const dy = y - QUIFF.y - 0.06 * smoothstep(0.45, -0.55, x);
  const dz = z - QUIFF.z;
  return ellipsoid(x, dy * QUIFF_COS - dz * QUIFF_SIN, dy * QUIFF_SIN + dz * QUIFF_COS, QUIFF.x, 0, 0, QUIFF.rx, QUIFF.ry, QUIFF.rz);
}

export function hair(x, y, z) {
  const line = hairline(around(x, z), x);
  const above = Math.max(0, y - line);
  const base = skull(x, y, z);
  let d = smin(base - (HAIR.edge + Math.min(HAIR.side, above)), dome(x, y, z), 0.12);
  d = smin(d, quiff(x, y, z), QUIFF.blend);
  // the part on his left: beyond it the hair lies short against the head
  const side = smoothstep(PART.x, PART.x + PART.soft, x);
  if (side > 0) d = smax(d, mix(-1, base - (HAIR.edge + HAIR.side + PART.extra), side), 0.03);
  const slope = mix(HAIR.slopeFront, HAIR.slope, smoothstep(0.35, 0.9, around(x, z)));
  d = smax(d, base - (HAIR.edge + slope * above), 0.03);
  d = smax(d, line - y, 0.03);
  const e = EAR_CLEAR;
  return smax(d, -ellipsoid(Math.abs(x), y, z, e.x, e.y, e.z, e.rx, e.ry, e.rz), 0.06);
}

/** Hair colour: black, a touch lighter right at its lower edge where the fade starts. */
export function hairColor(x, y, z, nx, ny, nz, out) {
  const line = hairline(around(x, z), x);
  const edge = (1 - smoothstep(line, line + 0.08, y)) * smoothstep(0.6, 0.9, around(x, z));
  for (let i = 0; i < 3; i += 1) out[i] = mix(PALETTE.hair[i], PALETTE.hairEdge[i], edge);
}

const BEARD = Object.freeze({ edge: 0.006, cheek: 0.045, chin: 0.065, line: 0.3, noise: 0.012, noiseFreq: 9 });
const BULK = Object.freeze({ y: -0.22, z: 0.5, rx: 0.4, ry: 0.3, rz: 0.3 });
const MOUTH_HOLE = Object.freeze({ y: 0.39, z: 1.0, rx: 0.19, ry: 0.058, rz: 0.24 });

/** Back edge of the beard: just in front of the ear, reaching back round the jaw angle lower down. */
const backLimit = (y) => 1.62 + 0.28 * smoothstep(0.75, 0.2, y);
/** 1 on the face, thinning to 0 at the back edge (it fades into the sideburn and neck, no step). */
const backFade = (au, y) => smoothstep(backLimit(y) + 0.02, backLimit(y) - 0.3, au);
/** Front outline: the beard narrows from the jaw to a rounded U at the chin. */
const outline = (y) => 0.42 + 0.42 * smoothstep(-0.45, 0.4, y);
/** Lower edge (neckline): lowest under the chin, rising along the jaw to the jaw angle. */
export const neckline = (ax, z) => -0.56 + 0.62 * smoothstep(0.04, 0.62, ax) + 0.16 * smoothstep(0.2, -0.4, z);

export function beard(x, y, z) {
  const au = around(x, z);
  const ax = Math.abs(x);
  const lineY = beardTop(au);
  const below = clamp((lineY - y) / BEARD.line, 0, 1);
  const chin = smoothstep(0.42, -0.08, y) * (1 - smoothstep(0.22, 0.78, ax));
  let d = faceBase(x, y, z) - (BEARD.edge + (BEARD.cheek * Math.sqrt(below) + BEARD.chin * chin) * backFade(au, y));
  d = smin(d, ellipsoid(x, y, z, 0, BULK.y, BULK.z, BULK.rx, BULK.ry, BULK.rz), 0.16);
  d = smax(d, y - lineY, 0.015);
  d = smax(d, au - backLimit(y), 0.05);
  d = smax(d, neckline(ax, z) - y, 0.05);
  d = smax(d, ax - outline(y), 0.08);
  const m = MOUTH_HOLE;
  d = smax(d, -ellipsoid(x, y, z, 0, m.y, m.z, m.rx, m.ry, m.rz), 0.035);
  const f = BEARD.noiseFreq; // soft, irregular clumps: the outline is not a perfect curve
  return d + BEARD.noise * (noise3(x * f, y * f, z * f) - 0.5) * 2;
}

/** Beard colour: near black, a little browner at the thin cheek edge and on the mustache. */
export function beardColor(x, y, z, nx, ny, nz, out) {
  const au = around(x, z);
  const edge = Math.max(1 - smoothstep(0.0, 0.2, beardTop(au) - y), 1 - backFade(au, y));
  const k = Math.min(1, edge * 0.9);
  for (let i = 0; i < 3; i += 1) out[i] = mix(PALETTE.beard[i], PALETTE.beardEdge[i], k);
}

/** Everything solid on the head, for ambient occlusion (creases at hairline, beard, ears). */
export function headContext(withBeard, withHair) {
  return (x, y, z) => {
    let d = skin(x, y, z);
    if (withHair) d = smin(d, hair(x, y, z), 0.02);
    if (withBeard) d = Math.min(d, beard(x, y, z));
    return d;
  };
}

/** Bounds (min, max) for meshing each part, in head space. */
export const HAIR_BOUNDS = Object.freeze([[-1.0, 1.25, -1.15], [1.0, 2.5, 1.12]]);
export const BEARD_BOUNDS = Object.freeze([[-0.98, -0.7, -0.75], [0.98, 1.3, 1.14]]);
