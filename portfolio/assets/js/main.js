/**
 * Boot order:
 *   render(config) -> loader (fonts + avatar or static portrait + minimum display)
 *   -> loader leaves -> smooth scroll, motion modules, intro, avatar intro, hero choreography.
 * Nothing here may block the page: every optional piece (GSAP, Lenis, the avatar,
 * the choreography, fonts, video) has a timeout or a fallback.
 */
import config from '../../site.config.js';
import { render } from './render.js';
import { createLoader } from './loader.js';
import { BP, readEnv, canRunLive3D, onEnvironmentChange } from './util/env.js';
import { debounce, wait, withTimeout, imageSettled } from './util/dom.js';
import { log } from './util/log.js';
import { createSmooth } from './motion/smooth.js';
import { playIntro } from './motion/intro.js';
import { buildMotion } from './motion/index.js';

const MIN_DISPLAY_MS = 1600;
const FONT_TIMEOUT_MS = 4000;
const AVATAR_IMPORT_TIMEOUT_MS = 8000;
const AVATAR_CREATE_TIMEOUT_MS = 25000;
const CHOREO_IMPORT_TIMEOUT_MS = 8000;
const LATE_SWAP_MAX_SCROLL = 200;
const LATE_SWAP_FADE_MS = 450; // the live canvas fades in over the lit still (hero.css avatar-arrive)
const REFRESH_DEBOUNCE_MS = 150;
const REBUILD_DEBOUNCE_MS = 200;
const WEIGHT = Object.freeze({ fonts: 0.2, hero: 0.7, minimum: 0.1 });
const FONT_PROBES = ['300 1em Geist', '500 1em Geist', '600 1em Geist'];

const root = document.documentElement;
const state = {
  refs: null,
  lib: null,
  env: null,
  smooth: null,
  motion: null,
  avatar: null,
  avatarActive: false,
  avatarIntroPlayed: false,
  buildHeroTimelines: null,
  choreoRequest: null,
  started: false,
};

function getLibs() {
  return {
    gsap: window.gsap || null,
    ScrollTrigger: window.ScrollTrigger || null,
    SplitText: window.SplitText || null,
    Lenis: window.Lenis || null,
  };
}

function registerPlugins({ gsap, ScrollTrigger, SplitText }) {
  if (!gsap) return;
  try {
    const plugins = [ScrollTrigger, SplitText].filter(Boolean);
    if (plugins.length) gsap.registerPlugin(...plugins);
    if (ScrollTrigger) ScrollTrigger.config({ ignoreMobileResize: true });
  } catch (error) {
    log.error('GSAP plugin registration failed', error);
  }
}

const safely = (label, fn) => {
  try {
    return fn();
  } catch (error) {
    log.error(label, error);
    return null;
  }
};

const requestRefresh = debounce(() => {
  safely('ScrollTrigger.refresh', () => state.lib && state.lib.ScrollTrigger && state.lib.ScrollTrigger.refresh());
}, REFRESH_DEBOUNCE_MS);

function fontsReady() {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const loads = FONT_PROBES.map((font) => document.fonts.load(font).catch(() => null));
  return withTimeout(Promise.all(loads).then(() => document.fonts.ready), FONT_TIMEOUT_MS, 'fonts')
    .catch((error) => log.warn(error));
}

/** Point the static portrait at its file (once) and resolve when it loaded or failed. */
function showStaticPortrait(img) {
  if (!img) return Promise.resolve(false);
  if (img.getAttribute('src')) return imageSettled(img);
  // Tablets and desktops show the bust large (and at 2x density), phones get the 900px file.
  const wide = window.innerWidth > BP.MOBILE;
  const src = (wide ? img.dataset.src : img.dataset.srcMobile) || img.dataset.src;
  if (!src) return Promise.resolve(false);
  img.addEventListener('error', () => img.classList.add('is-broken'), { once: true });
  img.addEventListener('load', requestRefresh, { once: true });
  img.fetchPriority = 'high';
  img.src = src;
  return imageSettled(img);
}

function destroyQuietly(avatar) {
  safely('avatar destroy', () => avatar && avatar.destroy && avatar.destroy());
}

/**
 * @param {HTMLElement} layer @param {(p: number) => void} onProgress
 * @param {AbortController | null} controller aborted here when the build times out (the model
 *   download stops), or by the caller when the avatar is no longer wanted
 */
async function loadAvatar(layer, onProgress, controller) {
  const mod = await withTimeout(import('./avatar/index.js'), AVATAR_IMPORT_TIMEOUT_MS, 'avatar import');
  if (typeof mod.createAvatar !== 'function') throw new Error('avatar module has no createAvatar()');
  const signal = controller ? controller.signal : undefined;
  const creating = Promise.resolve().then(() => mod.createAvatar({ config, container: layer, onProgress, signal }));
  try {
    const avatar = await withTimeout(creating, AVATAR_CREATE_TIMEOUT_MS, 'createAvatar');
    if (!avatar) throw new Error('createAvatar resolved without an avatar');
    return avatar;
  } catch (error) {
    if (controller) controller.abort();
    creating.then(destroyQuietly, () => {});
    layer.querySelectorAll('canvas').forEach((canvas) => canvas.remove());
    throw error;
  }
}

function requestChoreography() {
  if (state.choreoRequest) return state.choreoRequest;
  state.choreoRequest = withTimeout(import('./avatar/choreography.js'), CHOREO_IMPORT_TIMEOUT_MS, 'choreography import')
    .then((mod) => {
      state.buildHeroTimelines = typeof mod.buildHeroTimelines === 'function' ? mod.buildHeroTimelines : null;
      if (state.buildHeroTimelines && state.started) rebuild();
    })
    .catch((error) => log.warn('hero choreography unavailable', error));
  return state.choreoRequest;
}

const CHOREO_CLASSES = ['choreo-live', 'choreo-compact', 'whatbox-gated'];

/**
 * Hero scroll choreography. Desktop: always (the live avatar's stage when active, else the
 * still). Phones and tablets held upright: only with the live avatar (the compact story);
 * without it they keep the plain layout with the still under the name.
 */
function heroModule() {
  root.classList.remove(...CHOREO_CLASSES);
  const { gsap, ScrollTrigger } = state.lib;
  const env = state.env;
  if (!gsap || !ScrollTrigger || env.reduced) return null;
  const stage = state.avatarActive && state.avatar ? state.avatar.stage || null : null;
  const compact = !env.desktop;
  if (compact && !(stage && stage.kind === 'character' && env.portrait)) return null;
  if (!state.buildHeroTimelines) {
    requestChoreography();
    return null;
  }
  root.classList.add('choreo-live');
  if (compact) root.classList.add('choreo-compact');
  else if (stage) root.classList.add('whatbox-gated');
  let handle = null;
  try {
    handle = state.buildHeroTimelines({ gsap, ScrollTrigger, stage, compact });
  } catch (error) {
    root.classList.remove(...CHOREO_CLASSES);
    throw error;
  }
  return {
    destroy() {
      safely('hero timelines kill', () => handle && handle.kill && handle.kill());
      root.classList.remove(...CHOREO_CLASSES);
    },
  };
}

/** @param {object} avatar @param {{ instant?: boolean }} [opts] instant: start lit (a late swap) */
function activateAvatar(avatar, { instant = false } = {}) {
  state.avatar = avatar;
  state.avatarActive = true;
  root.classList.add('avatar-live');
  safely('avatar setActive', () => avatar.setActive && avatar.setActive(true));
  if (state.avatarIntroPlayed) return;
  state.avatarIntroPlayed = true;
  safely('avatar intro', () => avatar.startIntro && avatar.startIntro({ instant }));
}

function deactivateAvatar() {
  state.avatarActive = false;
  root.classList.remove('avatar-live');
  safely('avatar pause', () => state.avatar && state.avatar.setActive && state.avatar.setActive(false));
  showStaticPortrait(state.refs.fallbackImg);
}

/** The avatar may show live: desktop, or a phone or upright tablet with a scene mode (the
 * photo relief has no compact story, so it keeps the still there). */
function liveWanted(env, avatar) {
  if (!env.live) return false;
  return env.desktop || Boolean(avatar && avatar.stage && avatar.stage.kind === 'character');
}

function syncAvatar(env) {
  if (!state.avatar) return;
  const wanted = liveWanted(env, state.avatar);
  if (wanted && !state.avatarActive) activateAvatar(state.avatar);
  else if (!wanted && state.avatarActive) deactivateAvatar();
}

const hooks = {
  hero: heroModule,
  getLenis: () => (state.smooth && state.smooth.lenis) || null,
};

function buildAll() {
  state.smooth = safely('smooth scroll', () => createSmooth({ ...state.lib, env: state.env }));
  state.motion = safely('motion', () => buildMotion(state.lib, state.env, hooks));
}

function rebuild() {
  safely('motion destroy', () => state.motion && state.motion.destroy());
  safely('smooth destroy', () => state.smooth && state.smooth.destroy());
  state.env = readEnv();
  root.classList.toggle('reduced-motion', state.env.reduced);
  syncAvatar(state.env);
  buildAll();
  requestRefresh();
}

function watchRefreshTriggers() {
  if (!state.lib.ScrollTrigger) return;
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(requestRefresh).catch(() => {});
  if (document.readyState === 'complete') requestRefresh();
  else window.addEventListener('load', requestRefresh, { once: true });
  // Only images without a reserved box can move the layout. Work screenshots and tech icons carry
  // width + height (their box is held by aspect-ratio), so their late loads must not refresh: a
  // refresh mid-scroll cancels native smooth scrolling (nav taps on touch) and re-pins Work.
  document.querySelectorAll('main img:not([width][height])').forEach((img) => {
    if (!img.complete) img.addEventListener('load', requestRefresh, { once: true });
  });
}

/** The parts of readEnv() that change what gets built. */
const envSignature = (env) => JSON.stringify(env, ['reduced', 'fine', 'mobile', 'desktop', 'portrait', 'live', 'reveals', 'cursor']);

/** A breakpoint query flipped: rebuild only if the environment really changed (a desktop window
 * crossing a square aspect flips the orientation query without changing anything we build). */
function onEnvironmentFlip() {
  if (state.env && envSignature(readEnv()) === envSignature(state.env)) return;
  rebuild();
}

function start() {
  state.started = true;
  state.env = readEnv();
  syncAvatar(state.env); // the device may have turned while the loading screen ran
  buildAll();
  safely('intro', () => playIntro({ ...state.lib, env: state.env }));
  root.classList.add('lights-on');
  watchRefreshTriggers();
  requestRefresh();
  onEnvironmentChange(debounce(onEnvironmentFlip, REBUILD_DEBOUNCE_MS));
}

/** Cancel the late model's download once the visitor scrolls down (it could no longer swap in). */
function cancelOnScroll(controller) {
  if (!controller) return () => {};
  const stop = () => window.removeEventListener('scroll', onScroll);
  function onScroll() {
    if (window.scrollY < LATE_SWAP_MAX_SCROLL) return;
    stop();
    controller.abort();
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  return stop;
}

/**
 * A late avatar swaps in only if the visitor is still at the top of the page. The still is
 * already lit, so the avatar starts lit too and its canvas fades in over the still (no dark replay).
 */
function adoptLateAvatar(task, controller) {
  const stopWatching = cancelOnScroll(controller);
  task.then((avatar) => {
    stopWatching();
    const env = readEnv();
    const stillWanted = window.scrollY < LATE_SWAP_MAX_SCROLL && liveWanted(env, avatar);
    if (!stillWanted) {
      destroyQuietly(avatar);
      return;
    }
    root.classList.add('avatar-arriving');
    window.setTimeout(() => root.classList.remove('avatar-arriving'), LATE_SWAP_FADE_MS);
    activateAvatar(avatar, { instant: true });
    rebuild();
  }, stopWatching);
}

function showFallbackPage() {
  const template = document.getElementById('nojs');
  const main = document.getElementById('main');
  // Static, authored markup from index.html (never config strings).
  if (template && main && !main.querySelector('.nojs')) main.insertAdjacentHTML('afterbegin', template.textContent);
  const loader = document.getElementById('loader');
  if (loader) loader.remove();
  root.classList.remove('is-loading');
  root.classList.add('rendered', 'boot-failed');
}

/**
 * Very slow networks: if this script arrives after the inline 9s failsafe already showed the
 * plain page, upgrade in place. The plain block and the (hidden) loader go, and the page
 * starts without a loading screen.
 */
function takeOverLateBoot() {
  if (!root.classList.contains('boot-failed')) return;
  document.querySelectorAll('#main > .nojs').forEach((node) => node.remove());
  const loader = document.getElementById('loader');
  if (loader) loader.remove();
  root.classList.remove('boot-failed', 'is-loading');
}

async function boot() {
  if ('scrollRestoration' in window.history && !window.location.hash) {
    window.history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
  }
  try {
    state.refs = render(config);
  } catch (error) {
    log.error('render failed', error);
    showFallbackPage();
    return;
  }
  takeOverLateBoot();
  state.lib = getLibs();
  registerPlugins(state.lib);

  const loader = createLoader({ marquee: (config.loader && config.loader.marquee) || [] });
  loader.track(fontsReady(), WEIGHT.fonts);
  loader.track(wait(MIN_DISPLAY_MS), WEIGHT.minimum);

  const env = readEnv();
  const live3D = canRunLive3D();
  if ((env.desktop || live3D) && !env.reduced && state.lib.gsap) requestChoreography();

  const { avatarLayer, fallbackImg } = state.refs;
  let heroTracker = null;
  let avatarTask = null;
  let readyAvatar = null;
  const avatarDownload = typeof AbortController === 'function' ? new AbortController() : null;
  if (live3D && avatarLayer) {
    avatarTask = loadAvatar(avatarLayer, (p) => heroTracker && heroTracker.progress(p), avatarDownload);
    avatarTask.then((avatar) => { readyAvatar = avatar; }, (error) => log.warn('avatar unavailable, static portrait', error));
  }
  const heroTask = avatarTask ? avatarTask.catch(() => showStaticPortrait(fallbackImg)) : showStaticPortrait(fallbackImg);
  heroTracker = loader.track(heroTask, WEIGHT.hero);

  await loader.done();

  if (readyAvatar) activateAvatar(readyAvatar);
  else {
    showStaticPortrait(fallbackImg);
    if (avatarTask) adoptLateAvatar(avatarTask, avatarDownload);
  }
  start();
}

boot().catch((error) => {
  log.error('boot failed', error);
  if (!root.classList.contains('rendered')) showFallbackPage();
});
