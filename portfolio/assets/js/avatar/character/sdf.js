/**
 * Signed distance helpers for the code-built character (pure math, no three.js).
 * Every primitive takes the sample point as plain numbers and returns a distance
 * (negative inside). Shapes are blended with smooth unions so parts read as one
 * piece of sculpted clay. Allocation-free: they run millions of times while meshing.
 */

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const mix = (a, b, t) => a + (b - a) * t;

export function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Polynomial smooth minimum (blend radius k). */
export function smin(a, b, k) {
  if (k <= 0) return a < b ? a : b;
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return (a < b ? a : b) - h * h * k * 0.25;
}

/** Smooth maximum (smooth intersection / subtraction with -b). */
export function smax(a, b, k) {
  return -smin(-a, -b, k);
}

export function sphere(px, py, pz, cx, cy, cz, r) {
  const dx = px - cx;
  const dy = py - cy;
  const dz = pz - cz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}

/** Ellipsoid (bound, close to exact near the surface). */
export function ellipsoid(px, py, pz, cx, cy, cz, rx, ry, rz) {
  const x = px - cx;
  const y = py - cy;
  const z = pz - cz;
  const k0 = Math.sqrt((x * x) / (rx * rx) + (y * y) / (ry * ry) + (z * z) / (rz * rz));
  const k1 = Math.sqrt((x * x) / (rx ** 4) + (y * y) / (ry ** 4) + (z * z) / (rz ** 4));
  if (k1 < 1e-9) return -Math.min(rx, ry, rz);
  return (k0 * (k0 - 1)) / k1;
}

export function capsule(px, py, pz, ax, ay, az, bx, by, bz, r) {
  const pax = px - ax;
  const pay = py - ay;
  const paz = pz - az;
  const bax = bx - ax;
  const bay = by - ay;
  const baz = bz - az;
  const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1);
  const dx = pax - bax * h;
  const dy = pay - bay * h;
  const dz = paz - baz * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}

/** Cone with rounded ends between a (radius ra) and b (radius rb). */
export function roundCone(px, py, pz, ax, ay, az, bx, by, bz, ra, rb) {
  const bax = bx - ax;
  const bay = by - ay;
  const baz = bz - az;
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = ra - rb;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const pax = px - ax;
  const pay = py - ay;
  const paz = pz - az;
  const y = pax * bax + pay * bay + paz * baz;
  const z = y - l2;
  const qx = pax * l2 - bax * y;
  const qy = pay * l2 - bay * y;
  const qz = paz * l2 - baz * y;
  const x2 = qx * qx + qy * qy + qz * qz;
  const y2 = y * y * l2;
  const z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - rb;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - ra;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - ra;
}

/** Axis-aligned box with rounded edges (half sizes h*, corner radius r). */
export function roundBox(px, py, pz, cx, cy, cz, hx, hy, hz, r) {
  const qx = Math.abs(px - cx) - hx + r;
  const qy = Math.abs(py - cy) - hy + r;
  const qz = Math.abs(pz - cz) - hz + r;
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  const oz = Math.max(qz, 0);
  return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0) - r;
}

/** Torus lying in the xz plane (ring radius R, tube radius r). */
export function torusY(px, py, pz, cx, cy, cz, R, r) {
  const x = px - cx;
  const z = pz - cz;
  const q = Math.sqrt(x * x + z * z) - R;
  const y = py - cy;
  return Math.sqrt(q * q + y * y) - r;
}

/**
 * A local frame (origin + orthonormal axes) for shapes that are not axis aligned.
 * toLocal writes the point's local coordinates into `out` (no allocation).
 */
export function makeFrame(origin, forward, upHint = [0, 1, 0]) {
  const f = normalize(forward);
  const side = normalize(cross(upHint, f));
  const up = cross(f, side);
  return Object.freeze({ o: origin.slice(), x: side, y: up, z: f });
}

export function toLocal(frame, px, py, pz, out) {
  const dx = px - frame.o[0];
  const dy = py - frame.o[1];
  const dz = pz - frame.o[2];
  out[0] = dx * frame.x[0] + dy * frame.x[1] + dz * frame.x[2];
  out[1] = dx * frame.y[0] + dy * frame.y[1] + dz * frame.y[2];
  out[2] = dx * frame.z[0] + dy * frame.z[1] + dz * frame.z[2];
  return out;
}

export function normalize(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

export function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const lerp3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/** Union of several distances with one blend radius (helper for readable shape code). */
export function sminAll(k, ...ds) {
  let d = ds[0];
  for (let i = 1; i < ds.length; i += 1) d = smin(d, ds[i], k);
  return d;
}

function hash3(x, y, z) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}

/** Smooth value noise in 0..1 (for breaking up perfect silhouettes, e.g. the beard's edge). */
export function noise3(x, y, z) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);
  const a = mix(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), ux);
  const b = mix(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), ux);
  const c = mix(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), ux);
  const d = mix(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), ux);
  return mix(mix(a, b, uy), mix(c, d, uy), uz);
}
