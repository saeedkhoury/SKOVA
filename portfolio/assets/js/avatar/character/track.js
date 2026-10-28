/**
 * Where the character's head wants to point, using the reference's own rules:
 *  - while scrollY < 200: yaw = x * PI/6 (lerp 0.1 per frame), pitch from the pointer's
 *    height with the reference's piecewise formula (lerp 0.2 per frame)
 *  - further down (desktop): pitch -0.4, yaw -0.3, lerp 0.03 (he looks at his screen)
 *  - touch: follows the finger (200 ms after it lands), recentres 2 s after release with
 *    slow lerps (0.03), then back to the normal ones a second later
 *  - hovering the 280 px circle over the face (.character-hover) raises the brows
 * The per-frame lerps are converted to frame-rate independent ones (tuned at 60 fps).
 * Values are head-bone rotations in the reference's convention (negative x = look up).
 */
import { clamp, damp } from '../support.js';

const R = Math.PI / 6;
const SCROLL_FOLLOW_LIMIT = 200;
const PITCH_LOW = -0.3;
const PITCH_HIGH = 0.4;
const LOOK = Object.freeze({ x: -0.4, y: -0.3, k: 0.03 });
const FACTORS = Object.freeze({ x: 0.1, y: 0.2 });
const SLOW = Object.freeze({ x: 0.03, y: 0.03 });
const TOUCH = Object.freeze({ followDelayMs: 200, recenterMs: 2000, restoreMs: 1000 });

/** The reference's head pitch target for a pointer height y in -1..1 (up positive). */
export function pitchTarget(y) {
  if (y <= PITCH_LOW) return -PITCH_LOW - 0.5 * R;
  if (y < PITCH_HIGH) return -y - 0.5 * R;
  return -R - 0.5 * R;
}

/**
 * @param {{ hotspot?: Element | null, touchArea?: Element | null }} opts
 */
export function createTracker({ hotspot = null, touchArea = null } = {}) {
  const pointer = { x: 0, y: 0 };
  const factor = { ...FACTORS };
  const head = { x: pitchTarget(0), y: 0 };
  const state = { hover: false, following: true, touchFollow: false };
  const timers = new Set();
  const later = (fn, ms) => {
    const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
  };
  const clearTimers = () => { timers.forEach((id) => window.clearTimeout(id)); timers.clear(); };

  const setPointer = (clientX, clientY) => {
    pointer.x = clamp((clientX / (window.innerWidth || 1)) * 2 - 1, -1, 1);
    pointer.y = clamp(-(clientY / (window.innerHeight || 1)) * 2 + 1, -1, 1);
  };
  const testHover = (clientX, clientY) => {
    if (!hotspot) return;
    const rect = hotspot.getBoundingClientRect();
    const r = rect.width / 2;
    state.hover = r > 0 && Math.hypot(clientX - (rect.left + r), clientY - (rect.top + rect.height / 2)) <= r;
  };
  const onMouseMove = (event) => {
    setPointer(event.clientX, event.clientY);
    testHover(event.clientX, event.clientY);
  };
  const onMouseLeave = () => { state.hover = false; };
  const onTouchStart = () => {
    clearTimers();
    Object.assign(factor, FACTORS);
    later(() => { state.touchFollow = true; }, TOUCH.followDelayMs);
  };
  const onTouchMove = (event) => {
    const t = event.touches && event.touches[0];
    if (state.touchFollow && t) setPointer(t.clientX, t.clientY);
  };
  const onTouchEnd = () => {
    clearTimers();
    state.touchFollow = false;
    later(() => {
      pointer.x = 0;
      pointer.y = 0;
      Object.assign(factor, SLOW);
      later(() => Object.assign(factor, FACTORS), TOUCH.restoreMs);
    }, TOUCH.recenterMs);
  };

  const passive = { passive: true };
  document.addEventListener('mousemove', onMouseMove, passive);
  document.documentElement.addEventListener('mouseleave', onMouseLeave, passive);
  if (touchArea) {
    touchArea.addEventListener('touchstart', onTouchStart, passive);
    touchArea.addEventListener('touchmove', onTouchMove, passive);
    touchArea.addEventListener('touchend', onTouchEnd, passive);
    touchArea.addEventListener('touchcancel', onTouchEnd, passive);
  }

  return {
    head,
    pointer,
    get hover() { return state.hover && state.following; },
    /** True while the head follows the pointer (top of the page). */
    get following() { return state.following; },
    /** @param {number} dt seconds */
    update(dt) {
      state.following = (window.scrollY || window.pageYOffset || 0) < SCROLL_FOLLOW_LIMIT;
      if (state.following) {
        head.y += (pointer.x * R - head.y) * damp(factor.x, dt);
        head.x += (pitchTarget(pointer.y) - head.x) * damp(factor.y, dt);
      } else {
        head.x += (LOOK.x - head.x) * damp(LOOK.k, dt);
        head.y += (LOOK.y - head.y) * damp(LOOK.k, dt);
      }
    },
    /** Put the head straight at its resting target (used by still renders). */
    settle() {
      head.x = pitchTarget(pointer.y);
      head.y = pointer.x * R;
    },
    destroy() {
      clearTimers();
      document.removeEventListener('mousemove', onMouseMove, passive);
      document.documentElement.removeEventListener('mouseleave', onMouseLeave, passive);
      if (touchArea) {
        touchArea.removeEventListener('touchstart', onTouchStart, passive);
        touchArea.removeEventListener('touchmove', onTouchMove, passive);
        touchArea.removeEventListener('touchend', onTouchEnd, passive);
        touchArea.removeEventListener('touchcancel', onTouchEnd, passive);
      }
    },
  };
}
