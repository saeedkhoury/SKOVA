/**
 * Hero scroll choreography (spec section 5): the three verified reference timelines
 * with our parameter mappings. Desktop (> 1024) with motion allowed; phones and tablets held
 * upright get the compact story (choreography-compact.js) when the live avatar runs. With
 * stage === null (static portrait on desktop) the DOM parts still run, and the static image
 * shrinks a little in place of the camera pull-back.
 *
 * Positions: T1 landing "top top" to "bottom top", T2 about "center 55%" to
 * "bottom top", T3 whatido "top top" to "bottom top"; all scrubbed, invalidateOnRefresh.
 * Durations and delays are timeline units copied from the reference.
 *
 * Values that several timelines move (camera z / y, model yaw / pitch, the layer's x) are never
 * tweened directly: each timeline tweens its own offsets ("parts") and a mixer sums them onto the
 * hero values every tick. A ScrollTrigger refresh or a lagging scrub can then never leave one
 * timeline's stale value behind (each part always matches its own timeline's progress).
 */
import { CHARACTER_SCENE, NO_FIRST_RENDER, createMixer, scrubbed } from './choreo-mixer.js';
import { buildCompactTimelines } from './choreography-compact.js';

const DESKTOP_MIN_WIDTH = 1025;
const SEL = Object.freeze({
  landing: '.landing-section',
  landingContainer: '.landing-container',
  about: '.about-section',
  aboutMe: '.about-me',
  whatido: '.whatido',
  whatBox: '.what-box-in',
  layer: '#avatar-layer',
  fallback: '.avatar-fallback',
  rim: '#avatar-layer .character-rim',
});

// Values each timeline ends on; the next timeline starts from them (rebuild and reverse safe).
// Framing per stage (hero: head 38% of the viewport height, hair 15% from the top):
// About: a little closer, hair back down to ~16%, the bust on the left half.
// What I do: pulled back to a ~21% head, hair ~18.5% so the title sits over hair, not eyes.
const T1 = Object.freeze({ layerX: -25, modelYaw: 0.15, camZ: 0.9, camY: 0.078, containerY: 40, aboutMeY: -50 });
const T2 = Object.freeze({
  layerX: -20, modelYaw: 0.18, modelPitch: 0.05, lean: 1, camZ: 1.77, camY: -0.365, aboutY: 30,
});
const T3 = Object.freeze({ layerY: -100, whatY: 15, modelPitch: -0.04 });
// Character mode: the reference's own values (camera z/y in world units, model rotations in
// radians, lean = neck/spine bend). Durations and delays as in its timelines; its camera tween
// in T1 uses GSAP's default duration (0.5).
const CHARACTER = Object.freeze({
  hero: Object.freeze({ camZ: 24.7, camY: 13.1 }),
  t1: Object.freeze({ modelYaw: 0.7, camZ: 22, camDuration: 0.5 }),
  // sceneX / sceneY (world units, ours): the seated scene ends on the left half, clear of the
  // cards, with the "What I do" title over his hair rather than his eyes; sceneScale keeps the
  // chair legs off the bottom edge.
  t2: Object.freeze({ camZ: 75, camY: 8.4, layerX: -12, modelYaw: 0.92, modelPitch: 0.12, lean: 0.6, rimAt: 2.3, sceneX: -4, sceneY: -0.05, sceneScale: 0.92, scrub: 0.5 }),
  t3: Object.freeze({ modelPitch: -0.04, duration: 2, delay: 1 }),
});

/** The character values with the subject's own composition (stage.choreo.t2: sceneX/Y/Scale) merged in. */
function characterValues(stage) {
  const own = stage.choreo && stage.choreo.t2 ? stage.choreo.t2 : {};
  return { ...CHARACTER, t2: { ...CHARACTER.t2, ...own } };
}
// Static portrait (no live stage): the image shrinks in place of the camera pull-back. It uses
// the separate CSS "scale" property, so the image's own centring transform and the layer (whose
// clip and bottom fade would show a seam if scaled) are never touched. The image's translateX
// runs before "scale", so origin x 0% is the layout box's left edge (= the head pivot once
// translated) and the head stays on its line. Scale 0.58 gives the live stage's ~22% head; the
// origin 12.4% down the image puts the eyes at ~28.5% of the height, below the "What I do" title.
const STATIC_PULLBACK = Object.freeze({ scale: 0.58, origin: '0% 12.4%' });
// The avatar still: shrink around its eyes (32% down the image) so the head keeps its line.
const STATIC_PULLBACK_CHARACTER = Object.freeze({ scale: 0.62, origin: '0% 32%' });

function prefersReducedMotion() {
  if (document.documentElement.classList.contains('reduced-motion')) return true;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** T1: the character slides left and turns a little; hero text fades, About rises in. */
function landingTimeline(gsap, mix, params, character) {
  const trigger = document.querySelector(SEL.landing);
  if (!trigger) return;
  const tl = scrubbed(gsap, trigger, 'top top', 'bottom top');
  const part = mix.part();
  if (params && character) {
    const { hero, t1 } = character;
    tl.fromTo(part, { modelYaw: 0 }, { modelYaw: t1.modelYaw, duration: 1 }, 0);
    tl.fromTo(part, { camZ: 0 }, { camZ: t1.camZ - hero.camZ, duration: t1.camDuration }, 0);
  } else if (params) {
    tl.fromTo(part, { modelYaw: 0, camZ: 0, camY: 0 }, { modelYaw: T1.modelYaw, camZ: T1.camZ - 1, camY: T1.camY, duration: 1 }, 0);
  }
  if (mix.layer) tl.fromTo(part, { layerX: 0 }, { layerX: T1.layerX, duration: 1 }, 0);
  const container = trigger.querySelector(SEL.landingContainer);
  if (container) {
    tl.to(container, { opacity: 0, duration: 0.4 }, 0);
    tl.to(container, { yPercent: T1.containerY, duration: 0.8 }, 0);
  }
  if (document.querySelector(SEL.aboutMe)) tl.fromTo(SEL.aboutMe, { yPercent: T1.aboutMeY }, { yPercent: 0, duration: 1 }, 0);
}

/** Tweens of the values only T2 moves (directly on params). */
function aboutOwnTweens(tl, params) {
  tl.fromTo(params, { lean: 0 }, { lean: T2.lean, duration: 3, ...NO_FIRST_RENDER }, 2);
  tl.fromTo(params, { screenRise: 0 }, { screenRise: 1, duration: 3, ...NO_FIRST_RENDER }, 1.5);
  tl.fromTo(params, { screenOpacity: 0 }, { screenOpacity: 1, duration: 1, ...NO_FIRST_RENDER }, 3.2);
  tl.fromTo(params, { screenLight: 0 }, { screenLight: 1, duration: 0.6, ...NO_FIRST_RENDER }, 4.5);
  tl.fromTo(params, { headLookMix: 0 }, { headLookMix: 1, duration: 3, ...NO_FIRST_RENDER }, 2);
  tl.fromTo(params, { rim: 1 }, { rim: 0, duration: 5, ...NO_FIRST_RENDER }, 2);
}

function aboutStageTweens(tl, part, params) {
  tl.fromTo(part, { camZ: 0, camY: 0 }, { camZ: T2.camZ - T1.camZ, camY: T2.camY - T1.camY, duration: 6, ease: 'power3.inOut', ...NO_FIRST_RENDER }, 2);
  tl.fromTo(part, { modelYaw: 0, modelPitch: 0 }, { modelYaw: T2.modelYaw - T1.modelYaw, modelPitch: T2.modelPitch, duration: 3, ...NO_FIRST_RENDER }, 3);
  aboutOwnTweens(tl, params);
}

/** T2 for the character: pull back to the desk, turn to it, lean in, desk rises, screen on. */
function characterAboutTweens(tl, part, params, character) {
  const { hero, t1, t2 } = character;
  tl.fromTo(part, { camZ: 0, camY: 0 }, { camZ: t2.camZ - t1.camZ, camY: t2.camY - hero.camY, duration: 6, ease: 'power3.inOut', ...NO_FIRST_RENDER }, 2);
  tl.fromTo(part, { sceneX: 0, sceneY: 0, sceneScale: 0 }, { sceneX: t2.sceneX, sceneY: t2.sceneY, sceneScale: t2.sceneScale - 1, duration: 6, ease: 'power3.inOut', ...NO_FIRST_RENDER }, 2);
  tl.fromTo(part, { modelYaw: 0, modelPitch: 0 }, { modelYaw: t2.modelYaw - t1.modelYaw, modelPitch: t2.modelPitch, duration: 3, ...NO_FIRST_RENDER }, 3);
  tl.fromTo(params, { lean: 0 }, { lean: t2.lean, duration: 3, ...NO_FIRST_RENDER }, 2);
  tl.fromTo(part, { screenRise: 0 }, { screenRise: 1, duration: 3, ...NO_FIRST_RENDER }, 1.5);
  tl.fromTo(params, { screenOpacity: 0 }, { screenOpacity: 1, duration: 0.8, ...NO_FIRST_RENDER }, 3.2);
  tl.fromTo(params, { screenLight: 0 }, { screenLight: 1, duration: 0.8, ...NO_FIRST_RENDER }, 4.5);
  tl.fromTo(params, { rim: 1 }, { rim: 0, duration: 5, ...NO_FIRST_RENDER }, t2.rimAt);
}

function staticPullback(tl, cleanups) {
  const img = document.querySelector(SEL.fallback);
  if (!img) return;
  const layer = document.querySelector(SEL.layer);
  const values = layer && layer.dataset.avatarMode === 'character' ? STATIC_PULLBACK_CHARACTER : STATIC_PULLBACK;
  const proxy = { scale: 1 };
  const apply = () => { img.style.scale = proxy.scale.toFixed(4); };
  img.style.transformOrigin = values.origin;
  cleanups.push(() => {
    img.style.removeProperty('scale');
    img.style.removeProperty('transform-origin');
  });
  tl.fromTo(proxy, { scale: 1 }, {
    scale: values.scale, duration: 6, ease: 'power3.inOut', onUpdate: apply, ...NO_FIRST_RENDER,
  }, 2);
  staticRimFade(tl, cleanups);
}

/** The static glow fades like the live rim (1 to 0, delay 2, duration 5) through a CSS variable
 * read by its filter, so its own lights-on opacity transition never lags the scrub. */
function staticRimFade(tl, cleanups) {
  const rim = document.querySelector(SEL.rim);
  if (!rim) return;
  const proxy = { v: 1 };
  const apply = () => { rim.style.setProperty('--rim-scroll', proxy.v.toFixed(3)); };
  cleanups.push(() => rim.style.removeProperty('--rim-scroll'));
  tl.fromTo(proxy, { v: 1 }, { v: 0, duration: 5, onUpdate: apply, ...NO_FIRST_RENDER }, 2);
}

/** T2: big pull-back, the desk (or the glass screen) rises and lights up, the head turns to it. */
function aboutTimeline(gsap, mix, params, cleanups, character) {
  const trigger = document.querySelector(SEL.about);
  if (!trigger) return;
  // The live character's camera pull-back catches up over half a second, so a hard wheel flick
  // does not pop the camera (safe: this timeline only moves its own part and its own values).
  const tl = scrubbed(gsap, trigger, 'center 55%', 'bottom top', params && character ? character.t2.scrub : true);
  const part = mix.part();
  if (params && character) characterAboutTweens(tl, part, params, character);
  else if (params) aboutStageTweens(tl, part, params);
  else staticPullback(tl, cleanups);
  tl.fromTo(trigger, { yPercent: 0, opacity: 1 }, { yPercent: T2.aboutY, opacity: 0, duration: 2, ...NO_FIRST_RENDER }, 3);
  const layerX = character ? character.t2.layerX : T2.layerX;
  if (mix.layer) tl.fromTo(part, { layerX: 0 }, { layerX: layerX - T1.layerX, duration: 5, ...NO_FIRST_RENDER }, 2);
  // The cards stay hidden (html.whatbox-gated, opacity only) until the character has settled at
  // the screen; their draw-on animation starts as they appear.
  if (params && document.querySelector(SEL.whatBox)) {
    const section = document.querySelector(SEL.whatido);
    tl.fromTo(SEL.whatBox, { opacity: 0, pointerEvents: 'none' }, {
      opacity: 1,
      pointerEvents: 'auto',
      duration: 0.01,
      onStart: () => { if (section) section.classList.add('is-inview'); },
      ...NO_FIRST_RENDER,
    }, 6);
  }
  // Pad the timeline to the reference length (camera tween ends at 8).
  if (tl.duration() < 8) tl.to({}, { duration: 8 - tl.duration() }, tl.duration());
}

/** T3: the character leaves upward while "What I do" drifts down a little. */
function whatIDoTimeline(gsap, mix, params, character) {
  const trigger = document.querySelector(SEL.whatido);
  if (!trigger) return;
  const tl = scrubbed(gsap, trigger, 'top top', 'bottom top');
  const part = mix.part();
  if (mix.layer) tl.fromTo(part, { layerY: 0 }, { layerY: T3.layerY, duration: 4, ease: 'none', ...NO_FIRST_RENDER }, 1);
  tl.fromTo(trigger, { yPercent: 0 }, { yPercent: T3.whatY, duration: 5, ...NO_FIRST_RENDER }, 0);
  if (params && character) {
    const { t2, t3 } = character;
    tl.fromTo(part, { modelPitch: 0 }, { modelPitch: t3.modelPitch - t2.modelPitch, duration: t3.duration, ...NO_FIRST_RENDER }, t3.delay);
  } else if (params) {
    tl.fromTo(part, { modelPitch: 0 }, { modelPitch: T3.modelPitch - T2.modelPitch, duration: 5, ...NO_FIRST_RENDER }, 0);
  }
}

/**
 * @param {{ gsap: any, ScrollTrigger: any, stage?: { params: object } | null, compact?: boolean }} deps
 *   compact: the phone / upright tablet story (choreography-compact.js), which needs the live stage
 * @returns {{ kill(): void }}
 */
export function buildHeroTimelines({ gsap, ScrollTrigger, stage = null, compact = false } = {}) {
  const noop = { kill() {} };
  if (!gsap || !ScrollTrigger || typeof gsap.context !== 'function') return noop;
  if (prefersReducedMotion() || !document.querySelector(SEL.landing)) return noop;
  gsap.registerPlugin(ScrollTrigger);
  // phones and tablets held upright: their own story, live avatar only
  if (compact) return buildCompactTimelines({ gsap, stage });
  if (window.innerWidth < DESKTOP_MIN_WIDTH) return noop;
  const params = stage && stage.params ? stage.params : null;
  // the live seated character (GLB avatar or code-built): the reference's values, plus its own composition
  const character = stage && stage.kind === 'character' ? characterValues(stage) : null;
  const cleanups = [];
  const base = character
    ? { modelYaw: 0, modelPitch: 0, camZ: CHARACTER.hero.camZ, camY: CHARACTER.hero.camY, ...CHARACTER_SCENE }
    : { modelYaw: 0, modelPitch: 0, camZ: 1, camY: 0 };
  const mix = createMixer(gsap, params, base);
  const ctx = gsap.context(() => {
    landingTimeline(gsap, mix, params, character);
    aboutTimeline(gsap, mix, params, cleanups, character);
    whatIDoTimeline(gsap, mix, params, character);
  });
  mix.apply();
  gsap.ticker.add(mix.apply);
  let killed = false;
  return {
    kill() {
      if (killed) return;
      killed = true;
      gsap.ticker.remove(mix.apply);
      ctx.revert();
      mix.reset();
      cleanups.forEach((cleanup) => cleanup());
    },
  };
}
