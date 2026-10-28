/**
 * Two-bone arm IK. solveArm() bends the elbow to match the shoulder-to-target distance, then swings
 * the upper arm about the shoulder so the wrist lands on the target, plus a small swivel of the
 * elbow around that line. It works from the arm's current pose (any rest rotations, any bone axes),
 * so the GLB avatar uses it on its skeleton too (avatar/glb-character/arms.js).
 *
 * createReach() is the code-built character's use of it: each wrist stays on its rest spot over the
 * keyboard (in the rig root's space, where the desk lives) whatever the lean of the spine and chest,
 * then the typing taps are added. The hand keeps its rest orientation relative to the root (palm
 * flat on the keys).
 */
import * as THREE from 'three';
import { POSE, sided } from './body-shapes.js';

const SIDES = Object.freeze([['L', 1], ['R', -1]]);
const EPS = 1e-4;

const S = new THREE.Vector3();
const E = new THREE.Vector3();
const W = new THREE.Vector3();
const a = new THREE.Vector3();
const b = new THREE.Vector3();
const n = new THREE.Vector3();
const qParent = new THREE.Quaternion();
const qUpperWorld = new THREE.Quaternion();
const qBend = new THREE.Quaternion();
const qSwing = new THREE.Quaternion();
const qTwist = new THREE.Quaternion();
const qLocal = new THREE.Quaternion();

/** A world rotation r as the local pre-rotation under a parent whose world rotation is p. */
function toLocal(out, p, r) {
  return out.copy(p).invert().multiply(r).multiply(p);
}

const clampUnit = (v) => Math.min(1, Math.max(-1, v));

/**
 * @param {{ upper: THREE.Object3D, fore: THREE.Object3D, hand: THREE.Object3D }} arm
 * @param {THREE.Vector3} target wrist target in world space
 * @param {number} swivel radians the elbow turns around the shoulder-to-target line
 */
export function solveArm(arm, target, swivel = 0) {
  arm.upper.updateWorldMatrix(true, true);
  arm.upper.getWorldPosition(S);
  arm.fore.getWorldPosition(E);
  arm.hand.getWorldPosition(W);
  const l1 = a.subVectors(E, S).length();
  const l2 = b.subVectors(W, E).length();
  if (l1 < EPS || l2 < EPS) return;
  const reach = Math.min(Math.max(target.distanceTo(S), Math.abs(l1 - l2) + EPS), l1 + l2 - EPS);
  // elbow: open or close the interior angle to get the wanted reach
  const now = Math.acos(clampUnit(-a.dot(b) / (l1 * l2)));
  const want = Math.acos(clampUnit((l1 * l1 + l2 * l2 - reach * reach) / (2 * l1 * l2)));
  n.crossVectors(a, b);
  if (n.lengthSq() < EPS * EPS) n.set(1, 0, 0);
  qBend.setFromAxisAngle(n.normalize(), now - want);
  arm.upper.getWorldQuaternion(qUpperWorld);
  arm.fore.quaternion.premultiply(toLocal(qLocal, qUpperWorld, qBend));
  W.sub(E).applyQuaternion(qBend).add(E);
  // swing the whole arm about the shoulder so the wrist lands on its target, plus the swivel
  a.subVectors(W, S).normalize();
  b.subVectors(target, S).normalize();
  qSwing.setFromUnitVectors(a, b);
  qTwist.setFromAxisAngle(b, swivel);
  qSwing.premultiply(qTwist);
  arm.upper.parent.getWorldQuaternion(qParent);
  arm.upper.quaternion.premultiply(toLocal(qLocal, qParent, qSwing));
}

/**
 * @param {Record<string, THREE.Object3D>} joints rig joints (root, upperArmL/R, forearmL/R, handL/R)
 */
export function createReach(joints) {
  const root = joints.root;
  const arms = SIDES.map(([suffix, s]) => ({
    upper: joints[`upperArm${suffix}`],
    fore: joints[`forearm${suffix}`],
    hand: joints[`hand${suffix}`],
    rest: new THREE.Vector3(...sided(POSE.hand, s)),
  }));
  const T = new THREE.Vector3();
  const qRoot = new THREE.Quaternion();
  const qHand = new THREE.Quaternion();
  const qTap = new THREE.Quaternion();
  const euler = new THREE.Euler();

  return {
    /**
     * @param {Array<{ fore: [number, number], hand: [number, number], swivel: number }>} taps per
     *   side (L, R): small extra rotations (x, y radians) on the forearm and the hand, elbow swivel
     */
    update(taps) {
      root.getWorldQuaternion(qRoot);
      arms.forEach((arm, i) => {
        const tap = taps[i];
        arm.upper.quaternion.identity(); // the rig's rest pose has zero rotations
        arm.fore.quaternion.identity();
        root.localToWorld(T.copy(arm.rest));
        solveArm(arm, T, tap.swivel);
        arm.fore.quaternion.multiply(qTap.setFromEuler(euler.set(tap.fore[0], tap.fore[1], 0)));
        // hand: rest orientation relative to the root, then the finger tap
        arm.upper.parent.getWorldQuaternion(qHand);
        qHand.multiply(arm.upper.quaternion).multiply(arm.fore.quaternion).invert();
        arm.hand.quaternion.copy(qHand).multiply(qRoot).multiply(qTap.setFromEuler(euler.set(tap.hand[0], tap.hand[1], 0)));
      });
    },
  };
}
