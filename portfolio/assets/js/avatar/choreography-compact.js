/**
 * The hero scroll story on phones and tablets held upright (html.choreo-compact): the desktop's
 * three timelines, recomposed for a tall screen. The live avatar's canvas is fixed behind the
 * page (hero.css); the camera does the composing, so the bust never shows a hard cut edge.
 *
 *   hero   name at the top, his bust in the middle, the role below it (over the floor fade)
 *   T1     landing "top top" to "bottom top": he turns and rises to the top of the screen while
 *          the About text comes up under him
 *   T2     about "top top" to "bottom top": the camera pulls back to him seated at his desk in
 *          the top half (desk rises, screen lights up, he leans in and types), About fades
 *   T3     whatido "top top", one layer height on: the desk scene scrolls away with "What I do"
 *
 * Camera values are world units for a 390 x 844 phone (the stage keeps that scene width on
 * narrower screens, and the same height share on wider ones: stage.setFitAspect).
 */
import { CHARACTER_SCENE, NO_FIRST_RENDER, createMixer, scrubbed } from './choreo-mixer.js';

const SEL = Object.freeze({
  landing: '.landing-section',
  landingContainer: '.landing-container',
  about: '.about-section',
  aboutMe: '.about-me',
  whatido: '.whatido',
});

/** The phone the composition is tuned on (width / height). */
export const COMPACT_FIT_ASPECT = 390 / 844;

export const COMPACT = Object.freeze({
  // head (hair top to beard) ~26% of the height, hair top 30% down: the name above, the role below
  hero: Object.freeze({ camZ: 42.8, camY: 12.78, floor: 40 }),
  // turned toward the text and risen: a bigger bust at the top (hair ~10% down, clear of the nav
  // fade; head ~28%), the floor fade taller so his lap and arms recede before the About text
  t1: Object.freeze({ camZ: 39.8, camY: 11.08, modelYaw: 0.45, floor: 56 }),
  // the whole desk scene in the top half, the "What I do" title under it
  t2: Object.freeze({
    camZ: 82, camY: 7.1, modelYaw: 0.92, modelPitch: 0.12, lean: 0.3, // upright (glb-character/layout.js TYPING_LEAN)
    sceneX: -1.7, sceneY: 0, sceneScale: 1, rimAt: 2.3, rimFor: 2.5, scrub: 0.5,
    // the chair (and desk set) fade in as soon as the pull-back starts, so he never sits on air
    setAt: 2.2,
  }),
  t3: Object.freeze({ modelPitch: -0.04 }),
  // the About text (sticky in the lower half, sections.css) fades and lifts as the camera pulls back
  text: Object.freeze({ fadeAt: 1.8, fadeFor: 0.8, lift: -40 }),
});

/** T1: he turns and rises to the top; the hero text fades and drops a little. */
function landingTimeline(gsap, mix, v) {
  const trigger = document.querySelector(SEL.landing);
  if (!trigger) return;
  const tl = scrubbed(gsap, trigger, 'top top', 'bottom top');
  const part = mix.part();
  const { hero, t1 } = v;
  tl.fromTo(part, { modelYaw: 0, camZ: 0, camY: 0 }, {
    modelYaw: t1.modelYaw, camZ: t1.camZ - hero.camZ, camY: t1.camY - hero.camY, duration: 1, ease: 'power1.inOut',
  }, 0);
  if (mix.layer) {
    // the floor fade's height (hero.css --floor-h): a CSS variable, so a refresh cannot leave a stale transform
    tl.fromTo(mix.layer, { '--floor-h': `${hero.floor}%` }, { '--floor-h': `${t1.floor}%`, duration: 1, ease: 'none' }, 0);
  }
  const container = trigger.querySelector(SEL.landingContainer);
  if (container) {
    tl.to(container, { opacity: 0, duration: 0.4 }, 0);
    tl.to(container, { yPercent: 20, duration: 0.8 }, 0);
  }
}

/** T2: the pull-back to the desk; the About text leaves upward while it fades. */
function aboutTimeline(gsap, mix, params, v) {
  const trigger = document.querySelector(SEL.about);
  if (!trigger) return;
  const { t1, t2, text } = v;
  // About is a screen and a half tall here (its text holds in the lower half), so the story runs
  // over all of it: from the end of T1 until it has left the screen.
  const tl = scrubbed(gsap, trigger, 'top top', 'bottom top', t2.scrub);
  const part = mix.part();
  const at = (from, to, duration, position, extra = {}) => tl.fromTo(part, from, { ...to, duration, ...NO_FIRST_RENDER, ...extra }, position);
  at({ camZ: 0, camY: 0 }, { camZ: t2.camZ - t1.camZ, camY: t2.camY - t1.camY }, 6, 2, { ease: 'power3.inOut' });
  at({ sceneX: 0, sceneY: 0, sceneScale: 0 }, { sceneX: t2.sceneX, sceneY: t2.sceneY, sceneScale: t2.sceneScale - 1 }, 6, 2, { ease: 'power3.inOut' });
  at({ modelYaw: 0, modelPitch: 0 }, { modelYaw: t2.modelYaw - t1.modelYaw, modelPitch: t2.modelPitch }, 3, 3);
  at({ screenRise: 0 }, { screenRise: 1 }, 3, 1.5);
  tl.fromTo(params, { lean: 0 }, { lean: t2.lean, duration: 3, ...NO_FIRST_RENDER }, 2);
  tl.fromTo(params, { screenOpacity: 0 }, { screenOpacity: 1, duration: 0.8, ...NO_FIRST_RENDER }, t2.setAt);
  tl.fromTo(params, { screenLight: 0 }, { screenLight: 1, duration: 0.8, ...NO_FIRST_RENDER }, 4.5);
  // the back glow leaves sooner than on desktop: on a tall screen it would cross the desk scene
  tl.fromTo(params, { rim: 1 }, { rim: 0, duration: t2.rimFor, ...NO_FIRST_RENDER }, t2.rimAt);
  const aboutMe = trigger.querySelector(SEL.aboutMe);
  if (aboutMe) tl.fromTo(aboutMe, { y: 0, opacity: 1 }, { y: text.lift, opacity: 0, duration: text.fadeFor, ...NO_FIRST_RENDER }, text.fadeAt);
  // pad to the reference length (the camera tween ends at 8)
  if (tl.duration() < 8) tl.to({}, { duration: 8 - tl.duration() }, tl.duration());
}

/**
 * T3: the layer leaves upward at the page's own speed (one layer height of scroll moves it one
 * layer height), so the desk scene stays put above the "What I do" title as both scroll away.
 */
function whatIDoTimeline(gsap, mix, v) {
  const trigger = document.querySelector(SEL.whatido);
  if (!trigger) return;
  const layer = mix.layer;
  const end = () => `+=${Math.max(1, layer ? layer.offsetHeight : window.innerHeight)}`;
  const tl = scrubbed(gsap, trigger, 'top top', end);
  const part = mix.part();
  if (layer) tl.fromTo(part, { layerY: 0 }, { layerY: -100, duration: 1, ease: 'none', ...NO_FIRST_RENDER }, 0);
  const { t2, t3 } = v;
  tl.fromTo(part, { modelPitch: 0 }, { modelPitch: t3.modelPitch - t2.modelPitch, duration: 1, ...NO_FIRST_RENDER }, 0);
}

/**
 * @param {{ gsap: any, stage: { params: object, kind?: string, setFitAspect?: (aspect?: number) => void } }} deps
 * @returns {{ kill(): void }}
 */
export function buildCompactTimelines({ gsap, stage }) {
  const noop = { kill() {} };
  const params = stage && stage.params ? stage.params : null;
  if (!params || stage.kind !== 'character' || !document.querySelector(SEL.landing)) return noop;
  const v = COMPACT;
  if (typeof stage.setFitAspect === 'function') stage.setFitAspect(COMPACT_FIT_ASPECT);
  const base = { modelYaw: 0, modelPitch: 0, camZ: v.hero.camZ, camY: v.hero.camY, ...CHARACTER_SCENE };
  const mix = createMixer(gsap, params, base);
  const ctx = gsap.context(() => {
    landingTimeline(gsap, mix, v);
    aboutTimeline(gsap, mix, params, v);
    whatIDoTimeline(gsap, mix, v);
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
      if (typeof stage.setFitAspect === 'function') stage.setFitAspect();
    },
  };
}
