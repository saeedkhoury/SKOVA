/**
 * Vertex colour functions for the body parts (linear light): skin (neck shaded under the jaw),
 * the dark tattoo sleeve on his right forearm, and the sneaker soles.
 */
import { clamp, mix, smoothstep, toLocal } from './sdf.js';
import { POSE, forearmFrame } from './body-shapes.js';
import { neckShade } from './head-shapes.js';
import { neckline } from './hair-shapes.js';
import { PALETTE } from './palette.js';

const INK = Object.freeze({ amount: 0.9, from: 0.12, to: 0.9 });
const NECK_STUBBLE = Object.freeze({ width: 0.14, amount: 0.7 });

export function skinFlat(x, y, z, nx, ny, nz, out) {
  out[0] = PALETTE.skin[0];
  out[1] = PALETTE.skin[1];
  out[2] = PALETTE.skin[2];
}

/** The neck sits in the head's shadow: darker under the jaw (same gradient as the head), with a
 * short stubble fade just under the beard's neckline so its edge reads as hair, not a mask. */
export function neckColor(x, y, z, nx, ny, nz, out) {
  const hy = y - POSE.head[1];
  const k = neckShade(hy);
  const gap = neckline(Math.abs(x), z - POSE.head[2]) - hy;
  const stubble = NECK_STUBBLE.amount * (1 - smoothstep(0, NECK_STUBBLE.width, gap)) * smoothstep(-0.2, 0.25, z);
  for (let i = 0; i < 3; i += 1) out[i] = mix(PALETTE.skin[i] * k, PALETTE.beardEdge[i], stubble);
}

export function soleColor(x, y, z, nx, ny, nz, out) {
  const sole = 1 - smoothstep(0.2, 0.26, y);
  for (let i = 0; i < 3; i += 1) out[i] = mix(1, PALETTE.sole[i] / 0.87, sole);
}

/**
 * Forearm skin; on his right arm (s = -1) a tattoo sleeve from below the elbow to the wrist:
 * flowing dark bands and filled shapes, mostly on the outer and upper side.
 */
export function forearmColor(s) {
  const { frame, length } = forearmFrame(s);
  const q = [0, 0, 0];
  return (x, y, z, nx, ny, nz, out) => {
    skinFlat(x, y, z, nx, ny, nz, out);
    if (s > 0) return;
    toLocal(frame, x, y, z, q);
    const u = clamp(q[1] / length, 0, 1);
    const a = Math.atan2(q[0], q[2]);
    const band = Math.sin(24 * u + 2.6 * Math.sin(3 * a + 4 * u));
    const swirl = Math.sin(4 * a + 10 * u + 1.8 * Math.sin(12 * u));
    let ink = Math.max(smoothstep(0.25, 0.5, band * swirl), 0.8 * smoothstep(0.8, 0.95, Math.abs(band)));
    ink *= smoothstep(INK.from, INK.from + 0.08, u) * (1 - smoothstep(INK.to - 0.06, INK.to, u));
    ink *= smoothstep(-0.75, -0.1, ny + 0.7 * s * nx);
    for (let i = 0; i < 3; i += 1) out[i] = mix(out[i], PALETTE.ink[i], ink * INK.amount);
  };
}
