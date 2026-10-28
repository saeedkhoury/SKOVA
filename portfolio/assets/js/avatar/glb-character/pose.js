/**
 * The avatar's procedural pose on top of the seated base pose, all driven by elapsed seconds
 * (frame-rate independent):
 *  - head tracking (character/track.js, the reference's pointer formula) on the Head bone, a small
 *    share on the neck; past 200 px he looks down at his screen
 *  - the natural, open posture of his bind pose (the A-pose he was modelled in): the seated clip
 *    only places his hips and legs; the spine, chest, collarbones and neck are set absolutely, in the
 *    body's frame, to their bind-pose orientations (upright, chest open, shoulders level at their
 *    natural height and width, a short natural neck). His arms are arms.js.
 *  - the intro: head low and shoulders a little hunched while the lights are off, lifting as they ramp
 *  - a friendly head tilt and nod while the pointer is over his face (no brows on this model; the
 *    blink is blink.js and lids.js)
 *  - breathing in the chest and shoulders, and the lean toward the desk (params.lean), hinged low
 *    in the back so the chest stays open
 * The head is aimed absolutely in the body's frame (upright like in the bind pose), so the seated
 * clip's own head tilt never shows.
 */
import { clamp, damp } from '../support.js';
import { aimBone, captureIn } from '../glb.js';

// The pointer formula centres on -PI/12 (looking up): REST_PITCH brings the centre back to his
// head held level, as in the bind pose, so the neck shows as it does there (positive x = face down).
const REST_PITCH = Math.PI / 12;
const NECK = Object.freeze({ yaw: 0.25, pitch: 0.12 });
// Past 200 px (tracker LOOK: pitch -0.4, yaw -0.3) these turn his face to the keyboard and screen in
// front of him, while the camera keeps a 3/4 view of it at "What I do".
const LOOK = Object.freeze({ pitch: 0.36, yaw: 0.26 });
// While the lights are off his head is only a little lowered, so his face stays readable.
const INTRO = Object.freeze({ down: 0.3, hunch: 0.06, delay: 0.25, duration: 1.5 });
// Looking up (pointer near the top) lifts the chin by this share only: the full reference pitch
// shows too much of this model's throat. Level and downward looks keep the reference formula.
const UP_SHARE = 0.5;
// The bones set to their bind-pose orientation in the body's frame (the seated clip slumps: pelvis
// rolled back, upper back rounded, shoulders forward and down). Lower spine first: each one's pitch
// carries the ones below it, so the chain stays one rigid, upright back plus the lean.
const UPRIGHT = Object.freeze(['lower', 'upper', 'chest', 'neck', 'shoulderL', 'shoulderR']);
// The lean toward the desk hinges low in the back and keeps the chest open (no rounding).
const LEAN = Object.freeze({ lower: 0.45, upper: 0.04, chest: 0, head: 0.2 });
const BREATH = Object.freeze({ hz: 0.24, chest: 0.014, shoulder: 0.012 });
const HOVER = Object.freeze({ in: 0.5, out: 0.6, tilt: 0.13, lift: 0.05, nod: 0.06 });

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const smooth = (t) => t * t * (3 - 2 * t);

/**
 * @param {{ bones: Record<string, THREE.Bone>, frame: THREE.Object3D, tracker: object }} opts
 *   bones: head, neck, chest (Spine), upper (Spine01), lower (Spine02), shoulderL, shoulderR.
 *   Call before the base pose is first restored: the head's upright rest comes from the bind pose.
 */
export function createPose({ bones, frame, tracker }) {
  const b = bones;
  const headRest = captureIn(b.head, frame);
  const rest = Object.fromEntries(UPRIGHT.map((key) => [key, captureIn(b[key], frame)]));
  const state = { introAt: null, hover: 0, look: 0, still: false, aimed: false, pitch: 0, yaw: 0, speed: 0 };

  /** 0 while the lights are off (head down), 1 once the intro has lifted the head. */
  function introLift(time) {
    return state.introAt === null ? 0 : ease(clamp((time - state.introAt - INTRO.delay) / INTRO.duration, 0, 1));
  }

  /** The spine and collarbones; returns the chest's pitch (the neck carries it). */
  function applyBody(time, lean, lift) {
    const breath = state.still ? 0 : Math.sin(time * Math.PI * 2 * BREATH.hz);
    const lower = lean * LEAN.lower;
    const upper = lower + lean * LEAN.upper - breath * BREATH.chest;
    const chest = upper + lean * LEAN.chest + (1 - lift) * INTRO.hunch;
    aimBone(b.lower, frame, rest.lower, lower, 0, 0);
    aimBone(b.upper, frame, rest.upper, upper, 0, 0);
    aimBone(b.chest, frame, rest.chest, chest, 0, 0);
    const shoulder = breath * BREATH.shoulder;
    aimBone(b.shoulderL, frame, rest.shoulderL, chest, 0, shoulder);
    aimBone(b.shoulderR, frame, rest.shoulderR, chest, 0, -shoulder);
    return chest;
  }

  /** How fast the head turns (radians per second), for the saccade blink. */
  function trackSpeed(pitch, yaw, dt) {
    if (state.aimed && dt > 0) state.speed = Math.hypot(pitch - state.pitch, yaw - state.yaw) / dt;
    state.aimed = true;
    state.pitch = pitch;
    state.yaw = yaw;
  }

  function applyHead(dt, lift, lean, chest) {
    state.look += ((tracker.following ? 0 : 1) - state.look) * damp(0.05, dt);
    state.hover = clamp(state.hover + (tracker.hover ? dt / HOVER.in : -dt / HOVER.out), 0, 1);
    const k = smooth(state.hover);
    const nod = HOVER.nod * Math.sin(Math.PI * state.hover) - HOVER.lift * k;
    const pitch = tracker.head.x + LOOK.pitch * state.look + (1 - lift) * INTRO.down + nod;
    const yaw = tracker.head.y + LOOK.yaw * state.look;
    trackSpeed(pitch, yaw, dt);
    const aim = REST_PITCH + pitch + lean * LEAN.head;
    // the neck takes a small share of the head's downward turn (none at rest: the bind pose; looking
    // up, the neck stays put, so the throat never stretches long)
    aimBone(b.neck, frame, rest.neck, chest + NECK.pitch * Math.max(0, REST_PITCH + pitch), NECK.yaw * yaw, 0);
    aimBone(b.head, frame, headRest, aim < 0 ? aim * UP_SHARE : aim, yaw, HOVER.tilt * k);
  }

  return {
    /** Radians per second the head turned over the last frame. */
    get headSpeed() { return state.still ? 0 : state.speed; },
    startIntro(time) {
      if (state.introAt === null) state.introAt = time;
    },
    /** Freeze breathing and skip the intro (still renders). */
    setStill(on) {
      state.still = Boolean(on);
      if (state.still && state.introAt === null) state.introAt = -100;
    },
    /** @param {number} dt @param {number} time @param {object} params stage.params */
    update(dt, time, params) {
      tracker.update(state.still ? 1 : dt);
      const lean = clamp(Number(params.lean) || 0, 0, 1.5);
      const lift = introLift(time);
      const chest = applyBody(time, lean, lift);
      applyHead(state.still ? 1 : dt, lift, lean, chest);
    },
  };
}
