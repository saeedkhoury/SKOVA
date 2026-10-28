/**
 * Head pose controller shared by the portrait and GLB modes.
 *  - Near the top of the page (scrollY < 200) the head turns toward the pointer;
 *    on touch it follows the finger and recentres 2 s after release.
 *  - Further down it eases toward the "look at the screen" pose, blended by params.headLookMix.
 *  - A very slow idle drift keeps it from ever looking frozen. No blinking, no fake mouth or eyes.
 * Angles are relative to the body: +yaw turns the face to the viewer's right, +pitch tips it down.
 * Limits come in two kinds: relative to the body (yaw, yawRight, pitch, roll) and in world space
 * with the body's own turn included (worldLeft/Right/Down/Up), which keeps the photo portrait
 * inside the angles it can show without stretching.
 */
import { clamp, damp, lerp } from './support.js';

// Reference-like defaults (rigged model); the portrait passes tighter, photo-safe limits.
export const DEFAULT_HEAD_LIMITS = Object.freeze({
  yaw: Math.PI / 6, yawRight: Math.PI / 6, pitch: 0.3, roll: 0.08,
  worldLeft: Infinity, worldRight: Infinity, worldDown: Infinity, worldUp: Infinity,
});
const FOLLOW_K = Object.freeze({ yaw: 0.1, pitch: 0.12 }); // per frame at 60 fps
const SCROLL_K = 0.03;
const SCROLL_FOLLOW_LIMIT = 200; // px
const TOUCH_RECENTER_MS = 2000;
const FACE_Y = 0.3; // pointer height (fraction of the viewport) that maps to a level head
const UP_SHARE = 0.75; // the head looks up less far than it looks down
const ROLL_PER_YAW = -0.1; // a slight head tilt goes with a turn
// While scrolled: keep the face partly toward the viewer as the body turns,
// then turn it toward the screen (world yaw) with a downward look. Kept small: at the big
// hero framing, larger turns visibly squeeze the photo's image-left eye.
const NEUTRAL_COUNTER = 0.4;
const SCREEN_LOOK = Object.freeze({ worldYaw: 0.08, worldPitch: 0.1, roll: -0.02 });
const DRIFT = Object.freeze({ yaw: 0.02, pitch: 0.012, roll: 0.006 });
const NO_BODY = Object.freeze({ yaw: 0, pitch: 0 });

/**
 * @param {{ limits?: Partial<typeof DEFAULT_HEAD_LIMITS> }} [options]
 */
export function createHead(options = {}) {
  const limits = { ...DEFAULT_HEAD_LIMITS, ...((options && options.limits) || {}) };
  const pointer = { x: 0, y: FACE_Y, active: false };
  const smooth = { yaw: 0, pitch: 0 };
  const pose = { yaw: 0, pitch: 0, roll: 0 };
  let recenterTimer = 0;

  const setPointer = (event) => {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    pointer.x = clamp((event.clientX / w) * 2 - 1, -1, 1);
    pointer.y = clamp(event.clientY / h, 0, 1);
    pointer.active = true;
  };
  const onMove = (event) => {
    if (event.pointerType === 'touch') window.clearTimeout(recenterTimer);
    setPointer(event);
  };
  const onDown = (event) => {
    if (event.pointerType !== 'touch') return;
    window.clearTimeout(recenterTimer);
    setPointer(event);
  };
  const onUp = (event) => {
    if (event.pointerType !== 'touch') return;
    window.clearTimeout(recenterTimer);
    recenterTimer = window.setTimeout(() => { pointer.active = false; }, TOUCH_RECENTER_MS);
  };
  const onLeave = (event) => {
    if (!event.relatedTarget) pointer.active = false; // pointer left the window: look back to centre
  };

  const opts = { passive: true };
  document.addEventListener('pointermove', onMove, opts);
  document.addEventListener('pointerdown', onDown, opts);
  document.addEventListener('pointerup', onUp, opts);
  document.addEventListener('pointercancel', onUp, opts);
  document.documentElement.addEventListener('pointerleave', onLeave, opts);

  function pointerTarget(out) {
    if (!pointer.active) {
      out.yaw = 0;
      out.pitch = 0;
      return out;
    }
    out.yaw = pointer.x * (pointer.x > 0 ? limits.yawRight : limits.yaw);
    const dy = pointer.y - FACE_Y;
    const n = clamp(dy / (dy < 0 ? FACE_Y : 1 - FACE_Y), -1, 1);
    out.pitch = n < 0 ? n * limits.pitch * UP_SHARE : n * limits.pitch;
    return out;
  }

  function screenTarget(out, params, body) {
    const mix = clamp(params.headLookMix || 0, 0, 1);
    out.yaw = lerp(-NEUTRAL_COUNTER * body.yaw, SCREEN_LOOK.worldYaw - body.yaw, mix);
    out.pitch = lerp(0, SCREEN_LOOK.worldPitch - body.pitch, mix);
    return out;
  }

  const target = { yaw: 0, pitch: 0 };

  /**
   * @param {number} dt seconds
   * @param {number} time seconds
   * @param {object} params stage.params (headLookMix)
   * @param {{ yaw: number, pitch: number }} [body] world turn of the body at the neck
   */
  function update(dt, time, params, body = NO_BODY) {
    const following = (window.scrollY || window.pageYOffset || 0) < SCROLL_FOLLOW_LIMIT;
    if (following) pointerTarget(target);
    else screenTarget(target, params, body);
    smooth.yaw += (target.yaw - smooth.yaw) * damp(following ? FOLLOW_K.yaw : SCROLL_K, dt);
    smooth.pitch += (target.pitch - smooth.pitch) * damp(following ? FOLLOW_K.pitch : SCROLL_K, dt);

    const driftYaw = DRIFT.yaw * (0.6 * Math.sin(time * 0.31) + 0.4 * Math.sin(time * 0.53 + 1.7));
    const driftPitch = DRIFT.pitch * (0.6 * Math.sin(time * 0.27 + 0.4) + 0.4 * Math.sin(time * 0.61 + 2.3));
    const driftRoll = DRIFT.roll * Math.sin(time * 0.19 + 0.9);
    const yawMin = Math.max(-limits.yaw, -limits.worldLeft - body.yaw);
    const yawMax = Math.min(limits.yawRight, limits.worldRight - body.yaw);
    const pitchMin = Math.max(-limits.pitch, -limits.worldUp - body.pitch);
    const pitchMax = Math.min(limits.pitch, limits.worldDown - body.pitch);
    pose.yaw = clamp(smooth.yaw + driftYaw, yawMin, Math.max(yawMin, yawMax));
    pose.pitch = clamp(smooth.pitch + driftPitch, pitchMin, Math.max(pitchMin, pitchMax));
    const lookRoll = SCREEN_LOOK.roll * clamp(params.headLookMix || 0, 0, 1);
    pose.roll = clamp(pose.yaw * ROLL_PER_YAW + driftRoll + lookRoll, -limits.roll, limits.roll);
  }

  return {
    pose,
    update,
    destroy() {
      window.clearTimeout(recenterTimer);
      document.removeEventListener('pointermove', onMove, opts);
      document.removeEventListener('pointerdown', onDown, opts);
      document.removeEventListener('pointerup', onUp, opts);
      document.removeEventListener('pointercancel', onUp, opts);
      document.documentElement.removeEventListener('pointerleave', onLeave, opts);
    },
  };
}
