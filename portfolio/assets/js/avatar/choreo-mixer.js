/**
 * Shared by the scroll stories (choreography.js: desktop, choreography-compact.js: phones and
 * tablets held upright): scrubbed timelines and the mixer that sums each timeline's offsets
 * ("parts") onto the hero values every tick.
 */
const LAYER = '#avatar-layer';

export const NO_FIRST_RENDER = Object.freeze({ immediateRender: false });

/** Character mode: the scene values the mixer owns besides the camera and the model's turn. */
export const CHARACTER_SCENE = Object.freeze({ sceneX: 0, sceneY: 0, sceneScale: 1, screenRise: 0 });

/**
 * @param {any} gsap @param {Element} trigger @param {string} start
 * @param {string | (() => string)} end @param {boolean | number} [scrub]
 */
export function scrubbed(gsap, trigger, start, end, scrub = true) {
  return gsap.timeline({
    scrollTrigger: { trigger, start, end, scrub, invalidateOnRefresh: true },
  });
}

// Fastest the camera may dolly (world units per second): normal scrolling never reaches it, but a
// hard wheel flick through the About pull-back glides over a few frames instead of popping.
const SLEW = Object.freeze({ camZ: 420 });
// Character mode: the desk set's rise and the scene's growth may only increase this fast (per
// second), so a hard flick down never shows the full desk while the camera is still close (the
// camera is held by SLEW). Going back up they follow at once; normal scrolling never reaches these.
const SLEW_UP = Object.freeze({ screenRise: 5, sceneScale: 8 });
const MAX_TICK_MS = 20; // per-frame cap even when a frame runs long

/** How far a mixed value may move this tick toward `target` (Infinity: no limit). */
function stepLimit(key, deltaMs) {
  if (!deltaMs) return { down: Infinity, up: Infinity };
  const dt = Math.min(deltaMs, MAX_TICK_MS) / 1000;
  const both = SLEW[key] ? SLEW[key] * dt : Infinity;
  return { down: both, up: SLEW_UP[key] ? SLEW_UP[key] * dt : both };
}

/**
 * Sums each timeline's part onto the base values: params (when there is a live stage) and the
 * layer's xPercent / yPercent. No tween targets the layer itself, so a ScrollTrigger refresh
 * (which reverts tweened inline styles) can never restore a stale transform on it.
 * apply() runs on the GSAP ticker; it is cheap and only touches the DOM on change.
 */
export function createMixer(gsap, params, base) {
  const layer = document.querySelector(LAYER);
  const keys = Object.keys(base); // the stage params the mixer owns
  const parts = [];
  let last = '';
  const sum = (key) => parts.reduce((total, part) => total + part[key], 0);
  return {
    layer,
    part() {
      const part = { layerX: 0, layerY: 0 };
      keys.forEach((key) => { part[key] = 0; });
      parts.push(part);
      return part;
    },
    /** @param {number} [time] @param {number} [deltaMs] ticker delta; without it values snap */
    apply(time, deltaMs) {
      if (params) {
        keys.forEach((key) => {
          const target = base[key] + sum(key);
          const limit = stepLimit(key, deltaMs);
          const now = Number.isFinite(params[key]) ? params[key] : target;
          params[key] = now + Math.max(-limit.down, Math.min(limit.up, target - now));
        });
      }
      if (!layer) return;
      const x = sum('layerX');
      const y = sum('layerY');
      const key = `${x}|${y}`;
      if (key === last) return;
      last = key;
      gsap.set(layer, { xPercent: x, yPercent: y });
    },
    reset() {
      if (params) keys.forEach((key) => { params[key] = base[key]; });
      if (layer) gsap.set(layer, { clearProps: 'transform' });
      last = '';
    },
  };
}
