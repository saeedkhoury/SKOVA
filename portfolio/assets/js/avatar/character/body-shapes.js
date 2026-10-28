/**
 * Body, limbs and chair as distance functions, in model space at the rest pose
 * (floor at y = 0, the character faces +z, his left hand is on +x).
 * Each part belongs to one joint of the rig (rig.js); it is meshed here in model space
 * and moved into its joint's space afterwards.
 *
 * Saeed's build and outfit (11.jpg): athletic, broad sloping shoulders, a white short-sleeve
 * polo with an open collar (V placket, the collar flaps lying on the shoulders), bare forearms,
 * stone trousers and white sneakers. The rest pose is already the typing pose: upper arms down
 * and a little forward, forearms reaching to the keyboard, hands resting on the keys, seated.
 */
import {
  capsule, cross, ellipsoid, makeFrame, normalize, roundBox, roundCone, smax, smin, sphere, sub, toLocal, torusY,
} from './sdf.js';

export const POSE = Object.freeze({
  hips: [0, 6.3, 0.1],
  spine: [0, 7.0, -0.25],
  chest: [0, 9.6, -0.1],
  neck: [0, 10.95, -0.06], // the neck pivots low, at the collar, so its base barely moves
  head: [0, 11.8, 0],
  shoulder: [0.85, 10.95, -0.15], // x mirrored per side
  upperArm: [1.95, 10.2, -0.12],
  forearm: [2.08, 8.56, 0.66],
  hand: [1.08, 8.34, 2.35],
});

const HAND_SCALE = 1.04;
const SLEEVE = Object.freeze({ length: 0.56, radius: [0.5, 0.45], hem: 0.05 });
const ARM = Object.freeze({ upper: [0.4, 0.34], fore: [0.33, 0.25] });
const NECK_V = Object.freeze({ y: 10.32, half: 0.05, spread: 0.43, front: 0.3 });
const COLLAR = Object.freeze({ rx: 0.76, rz: 0.66, cz: -0.12, inner: 0.97, outer: 1.22, lift: 0.0, thick: 0.022, lapel: 0.24 });

/** Mirror a pose point to one side (s = 1 left, -1 right). */
export const sided = (p, s) => [p[0] * s, p[1], p[2]];

/** The athletic upper body under the polo (no neck opening yet). */
function trunk(x, y, z) {
  const ax = Math.abs(x);
  let d = ellipsoid(x, y, z, 0, 9.75, 0.0, 1.66, 1.55, 1.04); // chest
  d = smin(d, ellipsoid(ax, y, z, 0.6, 10.0, 0.42, 0.66, 0.48, 0.4), 0.45); // pecs (soft: the polo drapes)
  d = smin(d, ellipsoid(x, y, z, 0, 8.2, 0.06, 1.38, 1.3, 0.98), 0.6); // belly
  d = smin(d, ellipsoid(x, y, z, 0, 7.05, 0.06, 1.32, 0.85, 1.0), 0.5); // waist
  d = smin(d, capsule(ax, y, z, 0.5, 10.95, -0.2, 1.66, 10.4, -0.15, 0.55), 0.5); // sloping shoulder line
  d = smin(d, sphere(ax, y, z, 1.86, 10.16, -0.12, 0.5), 0.55); // deltoids
  return smin(d, ellipsoid(x, y, z, 0, 11.0, -0.25, 0.95, 0.45, 0.68), 0.5); // trapezius
}

/** The open V of the placket (a wedge in front, widening upward). */
function neckV(x, y, z) {
  const v = NECK_V;
  const side = (Math.abs(x) - v.half - v.spread * (y - v.y)) / Math.hypot(1, v.spread);
  return Math.max(side, v.y - y, v.front - z);
}

const neckHole = (x, y, z) => capsule(x, y, z, 0, 11.0, -0.05, 0, 13, -0.1, 0.66);

export function torso(x, y, z) {
  let d = trunk(x, y, z);
  d = smax(d, -neckHole(x, y, z), 0.06);
  d = smax(d, -neckV(x, y, z), 0.025);
  return smin(d, torusY(x, y, z, 0, 6.55, 0.08, 1.3, 0.1), 0.1); // hem
}

/** The polo's collar: a band lying on the shoulders around the neck, open down the V. */
export function collar(x, y, z) {
  const c = COLLAR;
  const rho = Math.hypot(x / c.rx, (z - c.cz) / c.rz);
  const band = Math.max(rho - c.outer, c.inner - rho) * 0.62;
  const front = Math.max(Math.abs(x) - NECK_V.half - NECK_V.spread * (y - NECK_V.y) - c.lapel, NECK_V.y + 0.02 - y, 0.1 - z);
  const region = Math.min(band, front);
  const shell = Math.abs(trunk(x, y, z) - c.lift) - c.thick;
  return smax(smax(smax(shell, region, 0.03), -neckV(x, y, z), 0.02), -neckHole(x, y, z) + 0.04, 0.03);
}

/** Skin seen in the open collar: the neck flowing into the upper chest, just under the polo
 * (body.js keeps only the part that leaves the neck's surface, so the two meet without a seam). */
export function chestSkin(x, y, z) {
  return smin(neck(x, y, z), ellipsoid(x, y, z, 0, 10.3, 0.02, 1.2, 1.0, 0.86), 0.35);
}

/** The neck: short and thick, tapering a little toward the jaw; it rises well into the head,
 * so the jaw sits on it from every angle. */
export function neck(x, y, z) {
  return roundCone(x, y, z, 0, 10.95, -0.02, 0, 12.2, -0.18, 0.6, 0.52);
}

function armPoints(s) {
  return {
    S: sided(POSE.upperArm, s),
    E: sided(POSE.forearm, s),
    W: sided(POSE.hand, s),
  };
}

/** The short polo sleeve around the top of the upper arm, ending in a hem. */
export function sleeve(s) {
  const { S, E } = armPoints(s);
  const axis = normalize(sub(E, S));
  const M = [S[0] + (E[0] - S[0]) * SLEEVE.length, S[1] + (E[1] - S[1]) * SLEEVE.length, S[2] + (E[2] - S[2]) * SLEEVE.length];
  return (x, y, z) => {
    let d = roundCone(x, y, z, S[0], S[1], S[2], M[0], M[1], M[2], SLEEVE.radius[0], SLEEVE.radius[1]);
    d = smin(d, sphere(x, y, z, S[0], S[1], S[2], 0.52), 0.2);
    const along = (x - M[0]) * axis[0] + (y - M[1]) * axis[1] + (z - M[2]) * axis[2];
    d = smax(d, along, 0.03);
    return d - SLEEVE.hem * Math.exp(-(((along + 0.06) / 0.05) ** 2));
  };
}

/** The bare upper arm under the sleeve, down to the elbow. */
export function upperArm(s) {
  const { S, E } = armPoints(s);
  return (x, y, z) => smin(
    roundCone(x, y, z, S[0], S[1], S[2], E[0], E[1], E[2], ARM.upper[0], ARM.upper[1]),
    sphere(x, y, z, E[0], E[1], E[2], ARM.upper[1]),
    0.1,
  );
}

/** Forearm: thicker near the elbow, slim at the wrist. */
export function forearm(s) {
  const { E, W } = armPoints(s);
  const B = [E[0] + (W[0] - E[0]) * 0.28, E[1] + (W[1] - E[1]) * 0.28 + 0.02, E[2] + (W[2] - E[2]) * 0.28];
  return (x, y, z) => {
    let d = roundCone(x, y, z, E[0], E[1], E[2], W[0], W[1], W[2], ARM.fore[0], ARM.fore[1]);
    d = smin(d, sphere(x, y, z, E[0], E[1], E[2], ARM.upper[1] - 0.01), 0.1);
    return smin(d, sphere(x, y, z, B[0], B[1], B[2], 0.36), 0.25); // the muscle below the elbow
  };
}

/** Local frame along the forearm (y from elbow to wrist) for painting and the watch. */
export function forearmFrame(s) {
  const { E, W } = armPoints(s);
  const axis = normalize(sub(W, E));
  return { E, W, axis, length: Math.hypot(W[0] - E[0], W[1] - E[1], W[2] - E[2]), frame: makeFrame(E, normalize(cross(axis, [0, 1, 0])), axis) };
}

/** Hand with finger hints, palm down on the keys; thumb toward the body. */
export function hand(s) {
  const { E, W } = armPoints(s);
  const dir = sub(W, E);
  const frame = makeFrame(W, [dir[0], -0.12 * Math.hypot(dir[0], dir[2]), dir[2]]);
  const q = [0, 0, 0];
  const inward = -s; // frame x points outward for the left hand and inward for the right
  return (x, y, z) => {
    toLocal(frame, x, y, z, q);
    const lx = q[0] / HAND_SCALE;
    const ly = q[1] / HAND_SCALE;
    const lz = q[2] / HAND_SCALE;
    let d = ellipsoid(lx, ly, lz, 0, -0.02, 0.4, 0.34, 0.16, 0.42); // palm
    d = smin(d, sphere(lx, ly, lz, 0, 0, 0, 0.26), 0.12); // wrist
    for (let i = 0; i < 4; i += 1) {
      const fx = (i - 1.5) * 0.165;
      const len = i === 0 || i === 3 ? 0.86 : 0.95;
      d = smin(d, capsule(lx, ly, lz, fx, -0.03, 0.6, fx * 1.05, -0.14, len, 0.078), 0.04);
    }
    const thumb = capsule(lx, ly, lz, inward * 0.26, -0.03, 0.22, inward * 0.41, -0.09, 0.55, 0.085);
    return smin(d, thumb, 0.08) * HAND_SCALE;
  };
}

/** Pelvis, thighs and shins (trousers), seated. */
export function legs(x, y, z) {
  let d = ellipsoid(x, y, z, 0, 6.4, 0.15, 1.42, 0.8, 1.1);
  const ax = Math.abs(x);
  d = smin(d, roundCone(ax, y, z, 0.74, 6.38, 0.3, 0.86, 6.33, 2.9, 0.71, 0.6), 0.3); // thighs
  d = smin(d, sphere(ax, y, z, 0.86, 6.28, 2.95, 0.6), 0.15); // knees
  return smin(d, roundCone(ax, y, z, 0.86, 6.1, 3.0, 0.92, 1.05, 3.1, 0.54, 0.45), 0.2); // shins
}

/** White sneakers: a rounded upper on a flat, slightly wider sole. */
export function shoes(x, y, z) {
  const ax = Math.abs(x);
  let d = ellipsoid(ax, y, z, 0.93, 0.55, 3.55, 0.48, 0.42, 0.98);
  d = smin(d, sphere(ax, y, z, 0.93, 0.98, 3.15, 0.4), 0.2);
  d = smin(d, roundBox(ax, y, z, 0.93, 0.12, 3.6, 0.5, 0.11, 1.06, 0.1), 0.06);
  return smax(d, 0.02 - y, 0.03); // flat sole
}

/** Chair shell: a soft seat and a slightly reclined back (the slim legs are plain cylinders). */
export function chair(x, y, z) {
  const seat = roundBox(x, y, z, 0, 5.32, 0.15, 2.0, 0.2, 1.7, 0.18);
  const tilt = (y - 7.0) * 0.08; // the back leans back a little toward the top
  const back = roundBox(x, y, z + tilt, 0, 8.3, -1.72, 1.85, 1.55, 0.17, 0.16);
  return smin(seat, back, 0.25);
}

/** Chair legs: [top, bottom] points (model space), splayed like the reference's simple chair. */
export const CHAIR_LEGS = Object.freeze([
  [[1.65, 5.15, 1.4], [1.95, 0, 1.85]],
  [[-1.65, 5.15, 1.4], [-1.95, 0, 1.85]],
  [[1.65, 5.15, -1.3], [1.95, 0, -1.8]],
  [[-1.65, 5.15, -1.3], [-1.95, 0, -1.8]],
]);

const CONTEXT_ARMS = [sleeve(1), sleeve(-1), upperArm(1), upperArm(-1), forearm(1), forearm(-1)];

/** Everything of the body at rest (for ambient occlusion between parts). */
export function bodyContext(x, y, z) {
  let d = Math.min(torso(x, y, z), collar(x, y, z), neck(x, y, z), chestSkin(x, y, z), legs(x, y, z));
  for (let i = 0; i < CONTEXT_ARMS.length; i += 1) d = Math.min(d, CONTEXT_ARMS[i](x, y, z));
  return Math.min(d, chair(x, y, z));
}

/** Meshing bounds per part (model space). */
export function boundsFor(part, s = 1) {
  const { S, E, W } = armPoints(s);
  switch (part) {
    case 'torso': return [[-2.55, 6.2, -1.3], [2.55, 11.7, 1.3]];
    case 'collar': return [[-1.28, 10.25, -1.05], [1.28, 11.7, 1.1]];
    case 'chestSkin': return [[-0.8, 10.1, 0.0], [0.8, 11.6, 1.2]];
    case 'neck': return [[-0.72, 10.6, -0.88], [0.72, 12.62, 0.68]];
    case 'sleeve': return box([S, [S[0] + (E[0] - S[0]) * 0.62, S[1] + (E[1] - S[1]) * 0.62, S[2] + (E[2] - S[2]) * 0.62]], 0.7);
    case 'upperArm': return box([S, E], 0.5);
    case 'forearm': return box([E, W], 0.5);
    case 'hand': return box([W, [W[0] - s * 0.6, W[1] - 0.35, W[2] + 1.3]], 0.45);
    case 'legs': return [[-1.65, 0.5, -1.0], [1.65, 7.3, 3.7]];
    case 'shoes': return [[-1.55, -0.1, 2.45], [1.55, 1.5, 4.75]];
    case 'chair': return [[-2.3, 4.85, -2.35], [2.3, 10.2, 2.1]];
    default: throw new Error(`no bounds for ${part}`);
  }
}

function box(points, pad) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  points.forEach((p) => {
    for (let i = 0; i < 3; i += 1) {
      min[i] = Math.min(min[i], p[i] - pad);
      max[i] = Math.max(max[i], p[i] + pad);
    }
  });
  return [min, max];
}
