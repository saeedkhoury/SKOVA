/**
 * Where a hand touches the keyboard and the desk. At build time it picks, from the hand's own
 * mesh, the points that can be its lowest: the pad and tip of each finger (for any curl and any
 * typing tilt) and the outer points of the palm, thumb and cuff. Every frame they are put through
 * the hand's current bone (and each finger's curl, the same maths as the shader, fingers.js) into
 * the desk's space and measured against what is under them: the key tops over the keyboard, the
 * desk top elsewhere. From that it finds the wrist lift that rests the fingertips on the keys, the
 * curl that puts one fingertip at a given height, and the key under a fingertip.
 */
import * as THREE from 'three';
import { HAND_THUMB, THUMB_TUCK } from './fingers.js';

const FINGER_FROM = 0.35; // share of the finger length from the knuckle where tip candidates start
const SHARE = Object.freeze({ own: 0.6, near: 0.25 }); // a finger's own points; points it moves too
const KEEP = Object.freeze({ finger: 8, palm: 4 });
const CURL_RANGE = Object.freeze([0.05, 1.9]);
const SOLVE = Object.freeze({ steps: 6, tolerance: 0.0002, probe: 0.06 });

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A hand-frame point's place across the fingers and toward the palm (fingers.js). */
function inPalmFrame(p, shape) {
  const px = shape.palm * p.x;
  return [shape.across[0] * px + shape.across[1] * p.z, shape.across[1] * px - shape.across[0] * p.z];
}

/**
 * Bend one hand-frame point (metres) by `curl` radians (the shader's maths, fingers.js); `thumb`
 * is its thumb share (the thumb tucks in); writes `out`.
 */
function bend(out, p, shape, curl, thumb) {
  const px = shape.palm * p.x;
  const along = shape.across[0] * px + shape.across[1] * p.z;
  const toward = shape.across[1] * px - shape.across[0] * p.z;
  const knuckle = shape.knuckle - shape.arc * (along - shape.fingers[1]) ** 2;
  const s = p.y - knuckle;
  let y = p.y;
  let w = toward - THUMB_TUCK.tuck * thumb * smoothstep(THUMB_TUCK.from, THUMB_TUCK.to, p.y);
  if (s > 0 && curl > 1e-4) {
    const k = curl / shape.length;
    const a = k * s;
    const d = w - shape.centre;
    y = knuckle + Math.sin(a) / k - d * Math.sin(a);
    w = shape.centre + (1 - Math.cos(a)) / k + d * Math.cos(a);
  }
  const [ax, az] = shape.across;
  return out.set(shape.palm * (ax * along + az * w), y, az * along - ax * w);
}

/** The thumb share of a hand-frame point (fingers.js THUMB). */
function thumbShare(p, shape) {
  const [, toward] = inPalmFrame(p, shape);
  return smoothstep(HAND_THUMB.from, HAND_THUMB.to, toward) * (1 - smoothstep(HAND_THUMB.endFrom, HAND_THUMB.endTo, p.y));
}

/** Per point: how much of each finger's curl it takes (the shader's blend, with the thumb mask). */
function fingerShares(p, shape, width) {
  const [along] = inPalmFrame(p, shape);
  const thumb = thumbShare(p, shape);
  const w = shape.fingers.map((at) => Math.exp(-(((along - at) / width) ** 2)) + 1e-4);
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((v) => (v / sum) * (1 - thumb));
}

/** The points furthest along each direction (the top `keep` per direction, no full sort). */
function extremes(points, directions, keep, map = (p) => p) {
  const chosen = new Set();
  const scratch = new THREE.Vector3();
  const best = [];
  directions.forEach((d) => {
    const dir = d.dir || d;
    best.length = 0;
    for (let i = 0; i < points.length; i += 1) {
      const score = map(points[i], d, scratch).dot(dir);
      if (best.length < keep || score > best[best.length - 1][0]) {
        let at = best.length < keep ? best.length : keep - 1;
        while (at > 0 && best[at - 1][0] < score) at -= 1;
        best.splice(at, 0, [score, i]);
        if (best.length > keep) best.pop();
      }
    }
    best.forEach(([, i]) => chosen.add(i));
  });
  return [...chosen].map((i) => points[i]);
}

/** Directions within `spread` radians of `down` (a steps x steps grid of tilts). */
function downDirections(down, spread, steps) {
  const out = [];
  const side = new THREE.Vector3(0, 1, 0).cross(down).normalize();
  const fore = new THREE.Vector3().crossVectors(down, side).normalize();
  for (let a = 0; a < steps; a += 1) {
    for (let b = 0; b < steps; b += 1) {
      const u = -spread + (2 * spread * a) / (steps - 1);
      const v = -spread + (2 * spread * b) / (steps - 1);
      out.push(down.clone().addScaledVector(side, Math.tan(u)).addScaledVector(fore, Math.tan(v)).normalize());
    }
  }
  return out;
}

/** The hand's mesh points (hand frame, metres) split into the four fingers and the rest. */
function collect(mesh, hand) {
  const g = mesh.geometry;
  const pos = g.getAttribute('position');
  const ji = g.getAttribute('skinIndex');
  const wi = g.getAttribute('skinWeight');
  const fingers = [[], [], [], []];
  const near = [[], [], [], []];
  const palm = [];
  const thumb = [];
  const { shape, toHand, width } = hand;
  for (let i = 0; i < pos.count; i += 1) {
    let w = 0;
    for (let k = 0; k < 4; k += 1) if (ji.getComponent(i, k) === hand.index) w += wi.getComponent(i, k);
    if (w < 0.5) continue;
    const p = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(toHand);
    const shares = fingerShares(p, shape, width);
    const curled = shares.reduce((a, b) => a + b, 0);
    if (w > 0.98 && p.y > shape.knuckle + FINGER_FROM * shape.length && curled > 0.98) {
      // a point between two fingers moves with both: it is kept clear of the keys with each of them
      shares.forEach((share, f) => {
        if (share >= SHARE.own) fingers[f].push({ p, shares });
        else if (share >= SHARE.near) near[f].push({ p, shares });
      });
    } else if (curled < 0.02 && p.y > shape.knuckle - 0.06) {
      thumb.push({ p: bend(new THREE.Vector3(), p, shape, 0, thumbShare(p, shape)), shares: null });
    } else if (p.y <= shape.knuckle - shape.arc * 0.003) {
      palm.push({ p: bend(new THREE.Vector3(), p, shape, 0, thumbShare(p, shape)), shares: null });
    }
  }
  return { fingers, near, palm, thumb };
}

/**
 * @param {{ mesh: THREE.SkinnedMesh, hand: object, surfaces: object, down: THREE.Vector3 }} opts
 *   hand: a createFingers() hand (index, shape, toHand, metres, width); surfaces: desk.surfaces;
 *   down: straight down in the hand's frame when it types (the points are picked around it)
 */
export function createTouch({ mesh, hand, surfaces, down }) {
  const { shape } = hand;
  const raw = collect(mesh, hand);
  const curls = [0.3, 0.7, 1.1, 1.5, 1.9];
  const fingerDirs = downDirections(down, 0.45, 3).map((dir) => ({ dir }));
  const tmp = new THREE.Vector3();
  const configs = curls.flatMap((c) => fingerDirs.map((d) => ({ ...d, c })));
  const pick = (points) => (points.length ? extremes(points, configs, KEEP.finger, (pt, d) => bend(tmp, pt.p, shape, d.c, 0)) : []);
  const fingers = raw.fingers.map(pick);
  // each finger's own points and the in-between points it also moves
  const reach = fingers.map((own, f) => own.concat(pick(raw.near[f])));
  const palm = extremes(raw.palm, downDirections(down, 0.8, 7), KEEP.palm, (pt) => pt.p);
  const thumb = extremes(raw.thumb, downDirections(down, 0.8, 7), KEEP.palm, (pt) => pt.p);
  if (fingers.some((f) => !f.length) || !palm.length || !thumb.length) throw new Error('touch: hand points missing');
  const keyboard = surfaces.keyboard;
  const kb = keyboard.box;
  const top = surfaces.desk;
  const v = new THREE.Vector3();
  let pressed = null; // Map key index -> 0..1 for this frame

  /** The key whose cap is nearest (x, z), on the grid (desk group space). */
  function keyNear(x, z) {
    const c = Math.min(keyboard.cols - 1, Math.max(0, Math.round((x - keyboard.origin[0]) / keyboard.pitch[0])));
    const r = Math.min(keyboard.rows - 1, Math.max(0, Math.round((z - keyboard.origin[1]) / keyboard.pitch[1])));
    return r * keyboard.cols + c;
  }

  /** What is under (x, z): the top of the nearest key cap (pressed keys lower), else the desk top. */
  function surfaceAt(x, z) {
    if (x >= kb.x0 && x <= kb.x1 && z >= kb.z0 && z <= kb.z1) {
      const down = pressed ? pressed.get(keyNear(x, z)) || 0 : 0;
      return keyboard.capTop - surfaces.travel * down;
    }
    if (x >= top.x0 && x <= top.x1 && z >= top.z0 && z <= top.z1) return surfaces.deskTop;
    return -Infinity;
  }

  const curlOf = (shares, c) => shares[0] * c[0] + shares[1] * c[1] + shares[2] * c[2] + shares[3] * c[3];

  /** Lowest clearance (and where) of these finger points for the curls c, via matrix m (hand -> desk). */
  function fingerLow(m, pts, c, at) {
    let low = Infinity;
    for (let i = 0; i < pts.length; i += 1) {
      bend(v, pts[i].p, shape, curlOf(pts[i].shares, c), 0).applyMatrix4(m);
      const clear = v.y - surfaceAt(v.x, v.z);
      if (clear < low) {
        low = clear;
        if (at) at.copy(v);
      }
    }
    return low;
  }

  function rigidLow(m, points) {
    let low = Infinity;
    for (let i = 0; i < points.length; i += 1) {
      v.copy(points[i].p).applyMatrix4(m);
      low = Math.min(low, v.y - surfaceAt(v.x, v.z));
    }
    return low;
  }

  const restCurls = [0, 0, 0, 0];
  const trial = [0, 0, 0, 0];
  const at = new THREE.Vector3();

  /** Secant search for the curl of finger f that puts the lowest of `pts` at `want`. */
  function solve(m, pts, f, current, want) {
    for (let k = 0; k < 4; k += 1) trial[k] = current[k];
    let c0 = current[f];
    trial[f] = c0;
    let g0 = fingerLow(m, pts, trial, null) - want;
    if (!Number.isFinite(g0) || Math.abs(g0) < SOLVE.tolerance) return c0;
    let c1 = Math.min(CURL_RANGE[1], Math.max(CURL_RANGE[0], c0 + (g0 > 0 ? SOLVE.probe : -SOLVE.probe)));
    for (let step = 0; step < SOLVE.steps; step += 1) {
      trial[f] = c1;
      const g1 = fingerLow(m, pts, trial, null) - want;
      if (Math.abs(g1) < SOLVE.tolerance || Math.abs(g1 - g0) < 1e-9) return c1;
      const next = Math.min(CURL_RANGE[1], Math.max(CURL_RANGE[0], c1 - (g1 * (c1 - c0)) / (g1 - g0)));
      c0 = c1;
      g0 = g1;
      c1 = next;
    }
    return c1;
  }

  return {
    /** Hand frame (metres) -> the bone's own units. */
    unscale: new THREE.Matrix4().makeScale(1 / hand.metres, 1 / hand.metres, 1 / hand.metres),
    /** Points the solver uses (QA). */
    points: { fingers, reach, palm, thumb },
    surfaceAt,
    /**
     * How far to raise the wrist (scene units, may be negative) so the hand rests on the keys like a
     * typist's: the fingertips at `curl` no lower than `hover` over the keys, the thumb `thumbHover`
     * over them, the palm and cuff `palmClear` over the keys or the desk.
     */
    liftFor(m, curl, hover, thumbHover, palmClear) {
      restCurls.fill(curl);
      let finger = Infinity;
      for (let f = 0; f < 4; f += 1) finger = Math.min(finger, fingerLow(m, reach[f], restCurls, null));
      const needs = [[finger, hover], [rigidLow(m, thumb), thumbHover], [rigidLow(m, palm), palmClear]];
      let lift = -Infinity;
      needs.forEach(([low, want]) => { if (Number.isFinite(low)) lift = Math.max(lift, want - low); });
      return Number.isFinite(lift) ? lift : 0;
    },
    /** Finger f's lowest clearance now (scene units). */
    fingerClear(m, f, current) { return fingerLow(m, fingers[f], current, null); },
    /** The whole hand's lowest clearance with these curls (fingers, thumb, palm). */
    handLow(m, current) {
      let low = Math.min(rigidLow(m, thumb), rigidLow(m, palm));
      for (let f = 0; f < 4; f += 1) low = Math.min(low, fingerLow(m, reach[f], current, null));
      return low;
    },
    /**
     * The curl (radians) of finger f that puts its fingertip `want` over the surface, but never one
     * that takes a point it shares with a neighbouring finger into a key.
     */
    curlFor(m, f, current, want) {
      const curl = solve(m, fingers[f], f, current, want);
      for (let k = 0; k < 4; k += 1) trial[k] = current[k];
      trial[f] = curl;
      if (fingerLow(m, reach[f], trial, null) >= 0) return curl;
      return Math.min(curl, solve(m, reach[f], f, current, 0));
    },
    /** The key under finger f's lowest point, or -1 off the keyboard. */
    keyUnder(m, f, current) {
      fingerLow(m, fingers[f], current, at);
      return at.x >= kb.x0 && at.x <= kb.x1 && at.z >= kb.z0 && at.z <= kb.z1 ? keyNear(at.x, at.z) : -1;
    },
    /** The keys held down this frame (they lower the surface under them). */
    setPressed(map) { pressed = map; },
  };
}
