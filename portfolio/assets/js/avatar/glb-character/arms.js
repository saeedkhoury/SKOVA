/**
 * His arms. In the hero his hands rest on his thighs from the sides, like a real seated person:
 * upper arms hanging relaxed from his shoulders, a little away from his body, elbows bent and a
 * little out, palms on the thighs (layout.js REST; two-bone IK, character/reach.js solveArm). As
 * the desk rises (params.screenRise) they move onto the keyboard and type, physically: every frame
 * the hand's lowest points (touch.js: the real mesh points of the palm, thumb and each curled
 * finger) are measured over the key tops and the desk, the wrist is set so the resting fingertips
 * hover just over the keys, and each finger's curl (fingers.js) is solved so its tip follows the
 * typing rhythm (typing.js) exactly: lifts, strikes the key top, takes the key down with it (the
 * key under that fingertip goes down in sync) and lets go. Nothing goes below the key tops or into
 * the desk. All driven by elapsed time, so it is frame-rate independent.
 */
import * as THREE from 'three';
import { clamp } from '../support.js';
import { solveArm } from '../character/reach.js';
import { ARMS, REST } from './layout.js';
import { createTouch } from './touch.js';
import { RHYTHM, createTyping } from './typing.js';

const SIDES = Object.freeze([['Left', 1], ['Right', -1]]);
const LANDED = 0.999; // params.screenRise from which the desk counts as in place
// fingers that never type (his short little fingers) keep the resting curl, or less near a key
const TYPIST = Object.freeze(RHYTHM.fingers.map((share) => share > 0));
const smooth = (t) => t * t * (3 - 2 * t);

const S = new THREE.Vector3();
const E = new THREE.Vector3();
const axis = new THREE.Vector3();
const bend = new THREE.Vector3();
const pole = new THREE.Vector3();
const cross = new THREE.Vector3();
const qPole = new THREE.Quaternion();
const qUpperParent = new THREE.Quaternion();
const qPoleLocal = new THREE.Quaternion();

/**
 * Turn the arm around its shoulder-to-wrist line so the elbow points along `wantWorld` (a world
 * direction, e.g. down and a little out): how a typist's elbows hang beside the body, whatever
 * pose the arm started from. `amount` 0..1 blends from the solver's own elbow to the pole.
 */
function aimElbow(arm, wantWorld, amount) {
  if (amount <= 0) return;
  arm.upper.updateWorldMatrix(true, true);
  arm.upper.getWorldPosition(S);
  arm.fore.getWorldPosition(E);
  arm.hand.getWorldPosition(axis);
  axis.sub(S).normalize();
  bend.subVectors(E, S);
  bend.addScaledVector(axis, -bend.dot(axis));
  pole.copy(wantWorld).addScaledVector(axis, -wantWorld.dot(axis));
  if (bend.lengthSq() < 1e-10 || pole.lengthSq() < 1e-10) return;
  bend.normalize();
  pole.normalize();
  const angle = Math.atan2(cross.crossVectors(bend, pole).dot(axis), bend.dot(pole)) * amount;
  qPole.setFromAxisAngle(axis, angle);
  arm.upper.parent.getWorldQuaternion(qUpperParent);
  qPoleLocal.copy(qUpperParent).invert().multiply(qPole).multiply(qUpperParent);
  arm.upper.quaternion.premultiply(qPoleLocal);
  arm.upper.updateWorldMatrix(false, true);
}

/** A hand orientation in the body frame: fingers forward, in (yaw) and down (pitch); palm down, turned in by roll. */
function handRotation(palmSign, side, { yaw, pitch, roll }) {
  const F = new THREE.Vector3(-side * Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  // palm down and turned toward his middle, so the thumb side is higher
  const P = new THREE.Vector3(-side * Math.sin(roll), -Math.cos(roll), 0);
  P.addScaledVector(F, -P.dot(F)).normalize();
  const X = P.clone().multiplyScalar(palmSign); // the hand's local +x
  const Z = new THREE.Vector3().crossVectors(X, F);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, F, Z));
}

/**
 * @param {{ model: THREE.Object3D, frame: THREE.Object3D, desk: object, fingers: object }} opts
 *   call in the bind pose; fingers: createFingers() (the curl uniforms and each hand's frame)
 */
export function createArms({ model, frame, desk, fingers }) {
  const keys = new Map(); // key index -> 0..1, the keys held down this frame
  // the desk rises into place in its parent's space (scene.js applyDesk): the hands go to where the
  // keyboard will be, so the rising desk passes under them, never through them
  const place = desk.group.parent;
  if (!place) throw new Error('the desk must be in the scene before the arms');
  const state = { landed: false };
  const arms = SIDES.map(([name, side], i) => {
    const arm = {
      side,
      upper: model.getObjectByName(`${name}Arm`),
      fore: model.getObjectByName(`${name}ForeArm`),
      hand: model.getObjectByName(`${name}Hand`),
      wrist: new THREE.Vector3(...ARMS.wrists[i]),
      rest: new THREE.Vector3(...REST.wrists[i]),
      restQ: handRotation(fingers.hands[i].shape.palm, side, REST.hand),
      typingQ: handRotation(fingers.hands[i].shape.palm, side, ARMS.hand),
      curls: new Float32Array(4),
      fresh: true, // the solver starts from the resting curl
    };
    if (!arm.upper || !arm.fore || !arm.hand) throw new Error(`the avatar has no ${name} arm bones`);
    const down = new THREE.Vector3(0, -1, 0).applyQuaternion(arm.typingQ.clone().invert());
    arm.touch = createTouch({ mesh: fingers.mesh, hand: fingers.hands[i], surfaces: desk.surfaces, down });
    arm.touch.setPressed(keys);
    return arm;
  });
  const typing = createTyping({ hover: ARMS.hover });
  const sample = [0, 1].map(() => ({ clear: new Float32Array(4), key: new Float32Array(4), dip: 0, roll: 0, drift: [0, 0] }));
  const neutral = { dip: 0, roll: 0, drift: [0, 0] };
  const target = new THREE.Vector3();
  const from = new THREE.Vector3();
  const qFrame = new THREE.Quaternion();
  const qWant = new THREE.Quaternion();
  const qRest = new THREE.Quaternion();
  const qParent = new THREE.Quaternion();
  const qTap = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const elbowWorld = new THREE.Vector3();
  const toDesk = new THREE.Matrix4();

  function placeHand(arm, weight, tap) {
    frame.getWorldQuaternion(qFrame);
    qRest.copy(qFrame).multiply(arm.restQ);
    // a strike dips the fingers a little and rolls the hand toward the striking finger
    qTap.setFromEuler(euler.set(tap.dip * ARMS.tap.pitch, 0, -tap.roll * ARMS.tap.roll * arm.side));
    qWant.copy(qFrame).multiply(qTap).multiply(arm.typingQ);
    qRest.slerp(qWant, weight);
    arm.hand.parent.updateWorldMatrix(true, false);
    arm.hand.parent.getWorldQuaternion(qParent);
    arm.hand.quaternion.copy(qParent.invert().multiply(qRest));
    arm.hand.updateWorldMatrix(false, false);
  }

  function reach(arm, weight, lift, tap) {
    frame.localToWorld(from.copy(arm.rest));
    target.set(arm.wrist.x + tap.drift[0] * arm.side, arm.wrist.y + lift, arm.wrist.z + tap.drift[1]);
    place.localToWorld(target);
    solveArm(arm, from.lerp(target, weight), REST.swivel * arm.side);
    // at the keys the elbows hang down beside him (ARMS.elbow, in his body's frame)
    frame.getWorldQuaternion(qFrame);
    elbowWorld.set(ARMS.elbow[0] * arm.side, ARMS.elbow[1], ARMS.elbow[2]).applyQuaternion(qFrame);
    aimElbow(arm, elbowWorld, weight);
    placeHand(arm, weight, tap);
  }

  /** Hand frame (metres) -> the desk's space once it is in place (it rises into it). */
  function deskMatrix(arm, touch) {
    place.updateWorldMatrix(true, false);
    return toDesk.copy(place.matrixWorld).invert().multiply(arm.hand.matrixWorld).multiply(touch.unscale);
  }

  /** The fingers' curls while the hands travel from the thighs to the keys (resting). */
  function approachCurls(arm, weight) {
    arm.curls.fill(REST.curl + (ARMS.curl - REST.curl) * Math.min(1, weight / ARMS.touchFrom));
  }

  function type(arm, i, weight) {
    const tap = sample[i];
    if (weight < ARMS.touchFrom) {
      reach(arm, weight, 0, tap);
      approachCurls(arm, weight);
      return;
    }
    const settle = smooth(clamp((weight - ARMS.touchFrom) / (1 - ARMS.touchFrom), 0, 1));
    // the wrist height that rests the thumb and fingertips (and nothing else) just over the keys,
    // found with the hand as it is this frame but before the strike's small dip: the dip (less than
    // the thumb's hover) and the strikes then move the hand and fingers, never into the keys
    const dip = tap.dip * ARMS.tap.dip;
    reach(arm, weight, 0, tap);
    const lift = arm.touch.liftFor(deskMatrix(arm, arm.touch), ARMS.curl, ARMS.hover, ARMS.thumbHover, ARMS.palmClear);
    reach(arm, weight, (lift - dip) * settle, tap);
    const m = deskMatrix(arm, arm.touch);
    if (arm.fresh) arm.curls.fill(ARMS.curl);
    arm.fresh = false;
    for (let f = 0; f < 4; f += 1) {
      let want = arm.touch.curlFor(m, f, arm.curls, tap.clear[f]);
      if (!TYPIST[f]) want = Math.min(want, ARMS.curl);
      arm.curls[f] = ARMS.curl + (want - ARMS.curl) * settle;
      // a striking finger that reached the key top takes that key down and rides it
      if (tap.key[f] > 0 && state.landed && arm.touch.fingerClear(m, f, arm.curls) <= ARMS.contact) {
        const index = arm.touch.keyUnder(m, f, arm.curls);
        if (index < 0) continue;
        keys.set(index, Math.max(keys.get(index) || 0, tap.key[f]));
        arm.curls[f] = arm.touch.curlFor(m, f, arm.curls, tap.clear[f]);
      }
    }
    // a last check over the whole hand: never into a key or the desk
    const low = arm.touch.handLow(m, arm.curls);
    if (low < 0) reach(arm, weight, (lift - dip) * settle - low, tap);
  }

  return {
    /**
     * @param {number} time seconds @param {number} rise params.screenRise (0..1)
     * @param {boolean} still freeze the typing (still renders)
     */
    update(time, rise, still) {
      const weight = smooth(clamp((rise - ARMS.reachFrom) / (ARMS.reachTo - ARMS.reachFrom), 0, 1));
      state.landed = rise >= LANDED; // keys only go down once the keyboard is in place
      keys.clear();
      typing.sample(still ? 0 : time, sample);
      arms.forEach((arm, i) => {
        if (weight <= 0) {
          arm.curls.fill(REST.curl);
          arm.fresh = true;
          reach(arm, 0, 0, neutral);
        } else {
          type(arm, i, weight);
        }
        fingers.setCurls(i, arm.curls);
      });
      // the thumbs tuck in as the hands reach the keys (touch.js measures them tucked)
      fingers.setTuck(weight / ARMS.touchFrom);
      desk.pressAt(keys);
    },
  };
}
