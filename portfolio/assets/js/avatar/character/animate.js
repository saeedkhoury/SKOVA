/**
 * Procedural animation for the character, all driven by elapsed seconds (frame-rate
 * independent): the intro (head down, lifting as the lights come up), head tracking
 * (track.js) split over neck and head, breathing, blinking, the eyebrow raise on hover,
 * typing (arms, hands and four keys), the lean toward the desk and the eye gaze.
 */
import { clamp, damp } from '../support.js';
import { LID } from './face.js';
import { createReach } from './reach.js';

// The head's rest pose looks down ~24 degrees (at the keyboard). With the reference's pointer
// formula (centre = -0.26) the face then rests slightly lowered and lifts toward the pointer,
// which matches how far the reference's head actually turns up and down.
const REST_PITCH = 0.34;
const LOOK_EXTRA_YAW = -0.04; // past 200 px the face turns a touch back toward the viewer (a clean 3/4 view)
const NECK_SHARE = 0.3; // part of the head turn (yaw) taken by the neck
// The neck pivots at the collar: it takes only a little of the nod, so its base never swings
// out of the open collar (the head joint does the rest).
const NECK_PITCH_SHARE = 0.1;
// Intro: head well down (the crown shows) and shoulders a little hunched, lifting as the lights ramp.
const INTRO = Object.freeze({ down: 0.85, hunch: 0.15, delay: 0.25, duration: 1.5 });
const LEAN = Object.freeze({ spine: 0.3, chest: 0.12, neck: 0.25 });
const BREATH = Object.freeze({ hz: 0.24, lift: 0.028, tilt: 0.012, shrug: 0.02 });
const BLINK = Object.freeze({ start: 2.5, min: 2, max: 5, close: 0.05, hold: 0.02, open: 0.07 });
const BROW = Object.freeze({ in: 0.5, out: 0.6, lift: 0.075, tilt: 0.07, lidOpen: 0.6 });
const TYPING = Object.freeze({ timeScale: 1.2, stroke: 0.3, tap: 0.16, forearm: 0.035, wander: 0.025, skip: 0.22, swivel: 0.05 });
const GAZE = Object.freeze({ x: 0.16, y: 0.12, lift: -0.16, screenYaw: 0.32, screenPitch: 0.06, k: 0.12 });

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const smooth = (t) => t * t * (3 - 2 * t);

/** Deterministic pseudo random 0..1 for an integer (typing variety without state). */
function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Press curve over one stroke (0..1): quick down, short hold, slower release. */
function press(u) {
  return clamp(u / 0.16, 0, 1) * (1 - smooth(clamp((u - 0.28) / 0.3, 0, 1)));
}

function blinkAmount(t) {
  if (t < 0) return 0;
  if (t < BLINK.close) return smooth(t / BLINK.close);
  if (t < BLINK.close + BLINK.hold) return 1;
  const o = (t - BLINK.close - BLINK.hold) / BLINK.open;
  return o < 1 ? 1 - smooth(o) : 0;
}

/**
 * @param {{ joints: Record<string, THREE.Object3D>, tracker: object, desk: object | null }} opts
 */
export function createAnimator({ joints, tracker, desk }) {
  const j = joints;
  const rest = Object.fromEntries(Object.entries(j).map(([name, node]) => [name, node.position.clone()]));
  const browRest = ['browL', 'browR'].map((name) => j[name].position.clone());
  const state = {
    introAt: null, nextBlink: Infinity, blinkAt: -10, brow: 0, look: 0, still: false,
    gazeX: 0, gazeY: 0,
  };
  const keyAmounts = [0, 0, 0, 0];
  const reach = createReach(j);
  const taps = [0, 1].map(() => ({ fore: [0, 0], hand: [0, 0], swivel: 0 }));

  /** 0 while the lights are off (head down), 1 once the intro has lifted the head. */
  function introLift(time) {
    return state.introAt === null ? 0 : ease(clamp((time - state.introAt - INTRO.delay) / INTRO.duration, 0, 1));
  }

  function applyHead(lift, lean) {
    const pitch = tracker.head.x + (1 - lift) * INTRO.down;
    const yaw = tracker.head.y + LOOK_EXTRA_YAW * state.look;
    j.neck.rotation.set(NECK_PITCH_SHARE * pitch + lean * LEAN.neck, NECK_SHARE * yaw, 0, 'YXZ');
    j.head.rotation.set(REST_PITCH + (1 - NECK_PITCH_SHARE) * pitch, (1 - NECK_SHARE) * yaw, 0, 'YXZ');
  }

  function applyBody(time, lean, lift) {
    const b = Math.sin(time * Math.PI * 2 * BREATH.hz);
    j.spine.rotation.x = lean * LEAN.spine;
    j.chest.rotation.x = lean * LEAN.chest - b * BREATH.tilt + (1 - lift) * INTRO.hunch;
    j.chest.position.y = rest.chest.y + b * BREATH.lift;
    j.shoulderL.position.y = rest.shoulderL.y + b * BREATH.shrug;
    j.shoulderR.position.y = rest.shoulderR.y + b * BREATH.shrug;
  }

  function applyBlink(time) {
    if (state.nextBlink === Infinity && state.introAt !== null) state.nextBlink = state.introAt + BLINK.start;
    if (!state.still && time >= state.nextBlink) {
      state.blinkAt = time;
      state.nextBlink = time + BLINK.min + Math.random() * (BLINK.max - BLINK.min);
    }
    const blink = state.still ? 0 : blinkAmount(time - state.blinkAt);
    const surprise = smooth(state.brow) * BROW.lidOpen;
    const open = LID.open + (LID.wide - LID.open) * surprise;
    const angle = open + (LID.closed - open) * blink;
    j.lidL.rotation.x = angle;
    j.lidR.rotation.x = angle;
  }

  function applyBrows(dt) {
    const step = tracker.hover ? dt / BROW.in : -dt / BROW.out;
    state.brow = clamp(state.brow + step, 0, 1);
    const k = smooth(state.brow);
    j.browL.position.y = browRest[0].y + BROW.lift * k;
    j.browR.position.y = browRest[1].y + BROW.lift * k;
    j.browL.rotation.z = -BROW.tilt * k;
    j.browR.rotation.z = BROW.tilt * k;
  }

  function handStroke(t, side) {
    const phase = t / TYPING.stroke + side * 0.5;
    const n = Math.floor(phase);
    const u = phase - n;
    const active = hash(n * 2 + side) > TYPING.skip;
    const finger = hash(n * 7 + side * 3) > 0.5 ? 1 : 0;
    return { amount: active ? press(u) : 0, finger, n };
  }

  function applyTyping(time) {
    const t = state.still ? 0 : time * TYPING.timeScale;
    [['L', 0], ['R', 1]].forEach(([suffix, side]) => {
      const { amount, finger, n } = handStroke(t, side);
      const wander = Math.sin(t * 0.7 + side * 2.1) * TYPING.wander;
      const tap = taps[side];
      tap.hand[0] = amount * TYPING.tap - 0.04;
      tap.hand[1] = wander;
      tap.fore[0] = -amount * TYPING.forearm;
      tap.fore[1] = wander * 0.5;
      tap.swivel = Math.sin(t * 0.37 + side) * TYPING.swivel * (side ? -1 : 1);
      keyAmounts[side * 2] = finger === 0 ? amount : 0;
      keyAmounts[side * 2 + 1] = finger === 1 ? amount : 0;
      if (hash(n + 0.5) > 0.98) keyAmounts[side * 2] = Math.max(keyAmounts[side * 2], amount);
    });
    reach.update(taps); // the hands stay on the keys whatever the lean
    if (desk) desk.pressKeys(keyAmounts);
  }

  function applyGaze(dt) {
    state.look += ((tracker.following ? 0 : 1) - state.look) * damp(0.05, dt);
    const px = tracker.pointer.x * GAZE.x * (1 - state.look) + GAZE.screenYaw * state.look;
    const py = (GAZE.lift - tracker.pointer.y * GAZE.y) * (1 - state.look) + GAZE.screenPitch * state.look;
    state.gazeX += (py - state.gazeX) * damp(GAZE.k, dt);
    state.gazeY += (px - state.gazeY) * damp(GAZE.k, dt);
    j.eyeL.rotation.set(state.gazeX, state.gazeY, 0);
    j.eyeR.rotation.set(state.gazeX, state.gazeY, 0);
  }

  return {
    startIntro(time) {
      if (state.introAt === null) state.introAt = time;
    },
    /** Freeze the incidental motion (blink, typing) for still renders. */
    setStill(on) {
      state.still = Boolean(on);
      if (state.still && state.introAt === null) state.introAt = -100;
    },
    /** @param {number} dt @param {number} time @param {object} params stage.params */
    update(dt, time, params) {
      tracker.update(state.still ? 1 : dt);
      const lean = clamp(Number(params.lean) || 0, 0, 1.5);
      const lift = introLift(time);
      applyBody(state.still ? 0 : time, lean, lift);
      applyHead(lift, lean);
      applyBrows(dt);
      applyBlink(time);
      applyTyping(time);
      applyGaze(state.still ? 1 : dt);
    },
  };
}
