/**
 * The head as distance functions, in head-joint space (origin = top of the neck, +y up,
 * +z toward the viewer). Proportions follow Saeed's photos (review/v2-assets/likeness-notes.md):
 * a long oval face with a strong jaw, a straight prominent nose, natural ears close to the head.
 * From the beard bottom (~-0.4) to the hair top (~2.38) the head is ~2.8 units tall.
 *
 *  skin   skull, forehead, cheekbones, jaw, chin, mouth area, brow ridge, soft eye sockets,
 *         nose and ears. Its colour (skinColor) is the warm tan albedo plus everything painted:
 *         the high skin fade on the sides and back, the faded sideburns, a short stubble edge above
 *         the beard line, and a warmer tint on the thin parts (ears, nose).
 *
 * Hair and beard live in hair-shapes.js, lips in face-parts.js. Landmarks shared with the
 * parametric parts (eyes, lids, brows, mouth) live in HEAD.
 */
import { capsule, clamp, ellipsoid, mix, roundCone, smax, smin, smoothstep, sphere } from './sdf.js';
import { PALETTE } from './palette.js';

export const HEAD = Object.freeze({
  eye: Object.freeze({ x: 0.35, y: 1.1, z: 0.685, r: 0.162 }),
  mouth: Object.freeze({ y: 0.4, halfWidth: 0.205 }),
});

const EAR = Object.freeze({ x: 0.775, y: 0.86, z: -0.15, flare: 0.7, tilt: 0.16 });
const EAR_COS = Math.cos(EAR.flare);
const EAR_SIN = Math.sin(EAR.flare);
const EAR_TCOS = Math.cos(EAR.tilt);
const EAR_TSIN = Math.sin(EAR.tilt);
const SOCKET = Object.freeze({ rx: 1.42, ry: 0.8, rz: 1.0, ahead: 0.04, lift: 0.012, blend: 0.05 });

/** Skull without features (shared by skin and hair). */
export function skull(x, y, z) {
  const cranium = ellipsoid(x, y, z, 0, 1.36, -0.1, 0.83, 0.78, 0.9);
  const forehead = ellipsoid(x, y, z, 0, 1.42, 0.16, 0.72, 0.62, 0.7);
  return smin(cranium, forehead, 0.3);
}

/** Cheeks, jaw, chin and the mouth area (shared by skin and beard). */
function lowerFace(x, y, z) {
  const mid = ellipsoid(x, y, z, 0, 0.84, 0.1, 0.78, 0.78, 0.74);
  const jaw = ellipsoid(x, y, z, 0, 0.36, 0.0, 0.72, 0.44, 0.68);
  const chin = ellipsoid(x, y, z, 0, 0.06, 0.55, 0.31, 0.25, 0.27);
  const muzzle = ellipsoid(x, y, z, 0, 0.48, 0.69, 0.34, 0.27, 0.31);
  let d = smin(mid, jaw, 0.3);
  d = smin(d, chin, 0.22);
  d = smin(d, muzzle, 0.18);
  return smin(d, sphere(Math.abs(x), y, z, 0.59, 0.3, -0.28, 0.15), 0.22); // jaw angles
}

/** Head form without features: skull, cheekbones, jaw (the beard follows this surface). */
export function faceBase(x, y, z) {
  let d = smin(skull(x, y, z), lowerFace(x, y, z), 0.25);
  d = smin(d, ellipsoid(x, y, z, 0, 0.55, -0.38, 0.54, 0.48, 0.42), 0.3); // nape, flowing into the neck
  return smin(d, sphere(Math.abs(x), y, z, 0.49, 0.9, 0.48, 0.27), 0.25);
}

/** Straight, prominent nose: a wide defined bridge running straight into a tip that the
 * wings merge into (no ball, no hook). */
function nose(x, y, z) {
  const bridge = roundCone(x, y, z, 0, 1.24, 0.84, 0, 0.83, 1.08, 0.08, 0.1);
  const tip = ellipsoid(x, y, z, 0, 0.77, 1.08, 0.12, 0.1, 0.1);
  const wings = ellipsoid(Math.abs(x), y, z, 0.1, 0.685, 0.99, 0.085, 0.075, 0.095);
  const base = ellipsoid(x, y, z, 0, 0.655, 1.0, 0.1, 0.055, 0.15);
  return smin(smin(smin(bridge, tip, 0.08), wings, 0.1), base, 0.05);
}

/** A natural ear close to the head (mirrored by |x|), with a bowl and a rim. */
export function ear(x, y, z) {
  const ax = Math.abs(x) - EAR.x;
  const dz = z - EAR.z;
  const lx = ax * EAR_COS + dz * EAR_SIN; // outward normal of the ear plane
  const pz = -ax * EAR_SIN + dz * EAR_COS;
  const dy0 = y - EAR.y;
  const ly = dy0 * EAR_TCOS - pz * EAR_TSIN; // leaning back a little, like real ears
  const lz = dy0 * EAR_TSIN + pz * EAR_TCOS;
  const shell = ellipsoid(lx, ly, lz, 0.06, 0, 0, 0.07, 0.31, 0.2);
  const bowl = ellipsoid(lx, ly, lz, 0.13, -0.03, 0.025, 0.06, 0.2, 0.12);
  const root = ellipsoid(lx, ly, lz, -0.04, -0.03, 0.03, 0.09, 0.2, 0.12);
  return smin(smax(shell, -bowl, 0.035), root, 0.06);
}

function browRidge(ax, y, z) {
  return capsule(ax, y, z, 0, 1.31, 0.83, 0.55, 1.36, 0.64, 0.1);
}

function eyeSocket(ax, y, z) {
  const e = HEAD.eye;
  return ellipsoid(ax, y, z, e.x, e.y + SOCKET.lift, e.z + SOCKET.ahead, e.r * SOCKET.rx, e.r * SOCKET.ry, e.r * SOCKET.rz);
}

export function skin(x, y, z) {
  const ax = Math.abs(x);
  let d = faceBase(x, y, z);
  d = smin(d, browRidge(ax, y, z), 0.15);
  d = smax(d, -eyeSocket(ax, y, z), SOCKET.blend);
  d = smin(d, nose(x, y, z), 0.08);
  return smin(d, ear(x, y, z), 0.05);
}

/** Angle around the vertical axis from the front (0) to the back (PI). */
export const around = (x, z) => Math.abs(Math.atan2(x, z));

/**
 * Lower edge of the hair mass: the forehead hairline in front (slightly receding at the
 * temples), the top of the high fade on the sides, lower at the back.
 */
export function hairline(au, x = 0) {
  const temples = 0.06 * smoothstep(0.45, 0.72, au) * (1 - smoothstep(0.78, 1.0, au));
  const soft = 0.018 * Math.sin(x * 11 + 0.6) * (1 - smoothstep(0.3, 0.6, au)); // an irregular front edge
  return 1.86 + temples + soft - 0.15 * smoothstep(0.75, 1.1, au) - 0.2 * smoothstep(2.0, 2.8, au);
}

// The cheek line climbs ~40 degrees from the mouth corner to the lower ear, where the faded sideburn takes over.
const BEARD_LINE = Object.freeze({ rise: 0.46, from: 0.25, span: 1.0 });

/** Top edge of the beard: under the nose (mustache), down to the mouth corners, then a diagonal
 * cheek line up to the sideburn in front of the ear. */
export function beardTop(au) {
  const corner = 0.58 - 0.105 * smoothstep(0.1, 0.27, au);
  return corner + BEARD_LINE.rise * clamp((au - BEARD_LINE.from) / BEARD_LINE.span, 0, 1);
}

const FADE = Object.freeze({ side: 0.62, back: 0.78, solid: 0.38, front: 0.55, frontWidth: 0.07 });
const SIDEBURN = Object.freeze({ from: 0.95, to: 1.5, amount: 0.95 });
const CHEEK = Object.freeze({ x: 0.45, y: 0.85, rx: 0.2, ry: 0.2, amount: 0.25 }); // soft warmth on the cheeks
const STUBBLE_EDGE = Object.freeze({ width: 0.2, amount: 0.75 });
// Under the jaw the neck sits in the head's shadow: a soft gradient instead of a hard edge.
const NECK_SHADE = Object.freeze({ top: -0.25, bottom: -1.05, dark: 0.45, light: 0.92 });

/** Shade factor for the neck (head space y): dark under the jaw, lighter toward the collar. */
export function neckShade(y) {
  return mix(NECK_SHADE.dark, NECK_SHADE.light, smoothstep(NECK_SHADE.top, NECK_SHADE.bottom, y));
}

/** Stubble cover (0 skin .. 1 dark) painted on the skin: fade, sideburns, beard edge. */
function stubbleAt(x, y, z) {
  const au = around(x, z);
  const top = hairline(au, x);
  const depth = mix(FADE.side, FADE.back, smoothstep(1.6, 2.6, au));
  const sides = smoothstep(0.62, 0.92, au);
  let s = smoothstep(top - depth, top - depth * FADE.solid, y) * sides;
  s = Math.max(s, FADE.front * smoothstep(top - FADE.frontWidth, top, y) * (1 - sides)); // soft front hairline
  const burn = smoothstep(SIDEBURN.from, SIDEBURN.from + 0.08, au) * (1 - smoothstep(SIDEBURN.to - 0.04, SIDEBURN.to + 0.04, au));
  const burnSpan = smoothstep(beardTop(au) - 0.12, beardTop(au) - 0.02, y) * (1 - smoothstep(top - 0.1, top, y));
  s = Math.max(s, burn * burnSpan * mix(SIDEBURN.amount, 1, smoothstep(top - depth, top, y)));
  const edge = 1 - smoothstep(0, STUBBLE_EDGE.width, y - beardTop(au));
  s = Math.max(s, edge * STUBBLE_EDGE.amount * (au < 1.55 ? 1 : 0));
  return clamp(s * smoothstep(-0.015, 0.06, ear(x, y, z)), 0, 1);
}

/** Skin colour (linear): warm tan, warmer on thin parts, stubble painted on top. */
export function skinColor(x, y, z, nx, ny, nz, out) {
  const s = PALETTE;
  const ax = Math.abs(x);
  const thin = Math.max(0.8 * (1 - smoothstep(-0.02, 0.05, ear(x, y, z))), 0.3 * smoothstep(1.0, 1.2, z) * smoothstep(0.62, 0.76, y) * (1 - smoothstep(0.1, 0.18, ax)));
  const cheek = CHEEK.amount * Math.exp(-(((ax - CHEEK.x) / CHEEK.rx) ** 2) - (((y - CHEEK.y) / CHEEK.ry) ** 2)) * smoothstep(0.1, 0.4, z);
  const stubble = stubbleAt(x, y, z);
  const warm = Math.max(thin, cheek);
  for (let i = 0; i < 3; i += 1) out[i] = mix(mix(s.skin[i], s.skinWarm[i], warm), s.stubble[i], stubble);
}

/** Bounds (min, max) for meshing the skin, in head space. */
export const SKIN_BOUNDS = Object.freeze([[-1.02, -0.36, -1.1], [1.02, 2.25, 1.38]]);

/** Depth of a surface in front of (x, y): march from the front along -z. */
export function depthAt(sdf, x, y, zStart = 2) {
  let z = zStart;
  for (let i = 0; i < 96; i += 1) {
    const d = sdf(x, y, z);
    if (d < 1e-4) break;
    z -= clamp(d, 0.002, 0.2);
  }
  return z;
}

export const skinDepthAt = (x, y) => depthAt(skin, x, y);
