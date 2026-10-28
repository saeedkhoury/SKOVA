/**
 * createAvatar(): the hero character (spec section 4).
 *
 *   const avatar = await createAvatar({ config, container, onProgress });
 *   avatar.mode        'glb' | 'character' | 'portrait'
 *   avatar.stage       tweenable params for buildHeroTimelines()
 *   avatar.startIntro() lights on (2 s power2.inOut) + rim glow + idle;
 *                      startIntro({ instant: true }) starts lit (a late swap over the lit still)
 *   avatar.setActive(b) pause / resume the render loop (hides the canvas while paused)
 *   avatar.destroy()   disposes everything and removes listeners
 *
 * Rejects with a clear Error on any failure (no WebGL, missing asset, bad meta);
 * the caller then shows the static image. Pass `signal` (an AbortSignal) to cancel: the model
 * download stops and the promise rejects.
 * GLB mode (the default) seats Saeed's 3D avatar (a .glb) at the desk (avatar/glb-character/);
 * character mode builds the clay character in code (avatar/character/). Both use the reference
 * camera, lights and scroll story. Portrait mode is the photo relief.
 * If the GPU later fails (lost context, render error) the static image is shown.
 */
import { createStage } from './stage.js';
import { createRelief, validateMeta } from './relief.js';
import { createScreen, makeScreenTexture } from './screen.js';
import { createHead } from './head.js';
import { createProgress, createTweens, loadImage, loadJson, releaseImage, resolveAsset, messageOf } from './support.js';
import { fetchGlb } from './glb.js';
import { log } from '../util/log.js';

const SCREEN_IMAGE = 'assets/img/work/clinic-en.jpg';
const LIVE_CLASS = 'avatar-live';
const WEIGHTS = Object.freeze({ meta: 0.04, image: 0.5, depth: 0.2, screen: 0.08, compile: 0.18 });
const CHARACTER_WEIGHTS = Object.freeze({ build: 0.82, screen: 0.06, compile: 0.12 });
const GLB_WEIGHTS = Object.freeze({ download: 0.74, build: 0.1, screen: 0.04, compile: 0.12 });
const SCENE_MODES = Object.freeze(['glb', 'character']);
// The reference's verified camera (fov 14.5, at (0, 13.1, 24.7), zoom 1.1, no lookAt).
const CHARACTER_CAMERA = Object.freeze({ fov: 14.5, zoom: 1.1, position: [0, 13.1, 24.7] });
const INTRO = Object.freeze({
  light: { duration: 2, ease: 'power2.inOut' },
  rim: { duration: 2, delay: 0.2, ease: 'power2.inOut' },
});
// An instant intro tells the subject its intro began this long ago (seconds), so the head is up.
const INSTANT_INTRO_AGO = 10;

function screenImagePath(config) {
  const work = Array.isArray(config.work) ? config.work : [];
  const clinic = work.find((item) => item && typeof item.image === 'string' && item.image.includes('clinic'));
  return clinic ? clinic.image : SCREEN_IMAGE;
}

async function loadScreenTexture(path, base, progress, maxAnisotropy) {
  try {
    const image = await loadImage(resolveAsset(path, base), progress.part('screen'));
    return { texture: makeScreenTexture(image, maxAnisotropy), image };
  } catch (error) {
    log.warn('avatar screen image unavailable, plain glass instead', error);
    progress.set('screen', 1);
    return { texture: null, image: null };
  }
}

async function loadPortraitSubject(portrait, base, progress, maxAnisotropy) {
  if (!portrait || !portrait.image || !portrait.depth || !portrait.meta) throw new Error('config.avatar.portrait needs image, depth and meta');
  const [rawMeta, image, depthImage] = await Promise.all([
    loadJson(resolveAsset(portrait.meta, base)).then((json) => { progress.set('meta', 1); return json; }),
    loadImage(resolveAsset(portrait.image, base), progress.part('image')),
    loadImage(resolveAsset(portrait.depth, base), progress.part('depth')),
  ]);
  const meta = validateMeta(rawMeta);
  const subject = createRelief({ image, depthImage, meta, maxAnisotropy });
  return { subject, images: [image, depthImage] };
}

/** Show the static portrait in place of the canvas (GPU trouble after a successful start). */
function createFailover(container) {
  const root = document.documentElement;
  return {
    show() {
      root.classList.remove(LIVE_CLASS);
      const img = container.querySelector('.avatar-fallback');
      if (img && !img.getAttribute('src') && img.dataset.src) img.src = img.dataset.src;
    },
    hide(active) {
      if (active) root.classList.add(LIVE_CLASS);
    },
  };
}

/** Lights on: tweened over INTRO, or at once (a late swap over the already lit still). */
function lightsOn(stage, tweens, instant) {
  const gsap = window.gsap;
  if (instant) {
    if (gsap && typeof gsap.killTweensOf === 'function') gsap.killTweensOf([stage.params, stage.intro]);
    stage.params.light = 1;
    stage.intro.rim = 1;
    return;
  }
  if (gsap && typeof gsap.to === 'function') {
    gsap.to(stage.params, { light: 1, ...INTRO.light, overwrite: 'auto' });
    gsap.to(stage.intro, { rim: 1, ...INTRO.rim, overwrite: 'auto' });
  } else {
    tweens.to(stage.params, 'light', 1, INTRO.light);
    tweens.to(stage.intro, 'rim', 1, INTRO.rim);
  }
}

function buildApi(parts) {
  const { stage, subject, screen, head, tweens, failover } = parts;
  // paused: the caller explicitly called setActive(false); startIntro() then leaves the loop off.
  const state = { intro: false, active: false, paused: false, destroyed: false };

  function setActive(on) {
    if (state.destroyed) return;
    state.active = Boolean(on);
    state.paused = !state.active;
    stage.setActive(state.active);
  }

  function startIntro({ instant = false } = {}) {
    if (state.destroyed || state.intro) return;
    state.intro = true;
    if (!state.paused && !state.active) setActive(true);
    lightsOn(stage, tweens, instant);
    if (typeof subject.startIntro === 'function') subject.startIntro();
  }

  function destroy() {
    if (state.destroyed) return;
    state.destroyed = true;
    const gsap = window.gsap;
    if (gsap && typeof gsap.killTweensOf === 'function') gsap.killTweensOf([stage.params, stage.intro]);
    tweens.clear();
    head.destroy();
    screen.dispose();
    subject.dispose();
    stage.destroy();
    document.documentElement.classList.remove(LIVE_CLASS);
    if (window.__avatarDebug === api) delete window.__avatarDebug;
  }

  stage.onTrouble((trouble) => (trouble ? failover.show() : failover.hide(state.active)));
  const api = { mode: subject.kind, stage, startIntro, setActive, destroy };
  if (log.enabled) window.__avatarDebug = api; // ?debug only: lets QA scripts read the stage
  return api;
}

function cleanupQuietly(owned) {
  owned.images.forEach(releaseImage);
  const steps = [
    () => owned.head && owned.head.destroy(),
    () => owned.screen && owned.screen.dispose(),
    () => owned.subject && owned.subject.dispose(),
    () => owned.stage && owned.stage.destroy(),
  ];
  steps.forEach((step) => {
    try {
      step();
    } catch (error) {
      log.warn('avatar cleanup step failed', error); // the original error is what the caller needs
    }
  });
}

function characterApi({ stage, subject, tweens, failover }) {
  const state = { intro: false, paused: false, destroyed: false };
  function setActive(on) {
    if (state.destroyed) return;
    state.paused = !on;
    stage.setActive(Boolean(on));
  }
  /** @param {{ instant?: boolean }} [opts] instant: start lit with the head already up */
  function startIntro({ instant = false } = {}) {
    if (state.destroyed || state.intro) return;
    state.intro = true;
    if (!state.paused && !stage.running) stage.setActive(true);
    lightsOn(stage, tweens, instant);
    subject.startIntro(instant ? stage.time - INSTANT_INTRO_AGO : stage.time);
  }
  function destroy() {
    if (state.destroyed) return;
    state.destroyed = true;
    const gsap = window.gsap;
    if (gsap && typeof gsap.killTweensOf === 'function') gsap.killTweensOf([stage.params, stage.intro]);
    tweens.clear();
    subject.dispose();
    stage.scene.environment = null;
    stage.destroy();
    document.documentElement.classList.remove(LIVE_CLASS);
    if (window.__avatarDebug === api) delete window.__avatarDebug;
  }
  stage.onTrouble((trouble) => (trouble ? failover.show() : failover.hide(!state.paused)));
  const api = { mode: subject.kind, stage, startIntro, setActive, destroy };
  if (log.enabled) {
    api.character = subject; // ?debug only: lets QA scripts pose the character
    window.__avatarDebug = api;
  }
  return api;
}

/** The subject for a scene mode: the GLB avatar, or the clay character built in code. */
async function createSceneSubject(mode, { config, container, stage, baseUrl, onProgress, source }) {
  const avatarConfig = config.avatar || {};
  const shared = {
    renderer: stage.renderer,
    hotspot: container.querySelector('.character-hover'),
    touchArea: document.getElementById('home'),
    onProgress,
  };
  if (mode === 'glb') {
    const { createGlbCharacter } = await import('./glb-character/index.js');
    return createGlbCharacter({ ...shared, glb: avatarConfig.glb || {}, source, baseUrl });
  }
  const { createCharacter } = await import('./character/index.js');
  return createCharacter({ ...shared, options: avatarConfig.character || {} });
}

/** Forward the caller's AbortSignal to our own controller (the download's); returns the unlink. */
function linkAbort(signal, controller) {
  if (!signal || !controller) return () => {};
  const onAbort = () => controller.abort();
  if (signal.aborted) onAbort();
  else signal.addEventListener('abort', onAbort, { once: true });
  return () => signal.removeEventListener('abort', onAbort);
}

function checkNotAborted(signal) {
  if (signal && signal.aborted) throw new Error('cancelled');
}

/** Put the built subject on the stage and compile it (scene modes, after the build). */
async function mountSubject({ stage, subject, shotTask, owned, signal }) {
  if (Number(subject.exposure) > 0) stage.renderer.toneMappingExposure = subject.exposure;
  // a textured subject may keep its colours truer with Khronos PBR Neutral than with ACES
  if (subject.toneMapping === 'neutral') stage.renderer.toneMapping = stage.THREE.NeutralToneMapping;
  stage.choreo = subject.choreo || null;
  const shot = await shotTask;
  owned.image = shot.image;
  subject.setScreenTexture(shot.texture);
  checkNotAborted(signal);
  const tweens = createTweens();
  stage.scene.add(subject.root);
  stage.scene.environment = subject.environment;
  stage.onUpdate((dt, time) => {
    tweens.step(dt);
    subject.update(dt, time, stage.params, stage.scene);
  });
  subject.revealForCompile(); // compile the desk's shaders now, not mid-scroll
  await stage.prepare(subject.textures);
  checkNotAborted(signal);
  releaseImage(owned.image);
  return tweens;
}

/**
 * Scene modes ('glb', 'character'): a seated character at a desk, framed by the reference camera
 * and driven by the reference's scroll story. The subject's own composition values (choreo) and
 * exposure ride along on the stage. The canvas stays hidden until the caller activates it
 * (html.avatar-live), so a late model never flashes its unlit first frame.
 */
async function createSceneAvatar({ config, container, onProgress, baseUrl, mode, signal }) {
  const progress = createProgress(onProgress, mode === 'glb' ? GLB_WEIGHTS : CHARACTER_WEIGHTS);
  progress.set('build', 0);
  const owned = { stage: null, subject: null, image: null };
  const abort = typeof AbortController === 'function' ? new AbortController() : null;
  const unlink = linkAbort(signal, abort);
  try {
    // the model download starts first: it is the long part, the modules below load meanwhile
    const glb = config.avatar.glb || {};
    const source = mode === 'glb' && typeof glb.url === 'string' && glb.url
      ? fetchGlb(glb.url, { baseUrl, onProgress: progress.part('download'), signal: abort ? abort.signal : undefined })
      : null;
    owned.stage = createStage({ container });
    const { stage } = owned;
    stage.kind = 'character';
    stage.renderer.toneMapping = stage.THREE.ACESFilmicToneMapping;
    stage.useFixedCamera(CHARACTER_CAMERA);
    const shotTask = loadScreenTexture(screenImagePath(config), baseUrl, progress, stage.renderer.capabilities.getMaxAnisotropy());
    owned.subject = await createSceneSubject(mode, { config, container, stage, baseUrl, source, onProgress: progress.part('build') });
    const tweens = await mountSubject({ stage, subject: owned.subject, shotTask, owned, signal });
    progress.set('compile', 1);
    progress.done();
    return characterApi({ stage, subject: owned.subject, tweens, failover: createFailover(container) });
  } catch (error) {
    if (abort) abort.abort();
    releaseImage(owned.image);
    try {
      if (owned.subject) owned.subject.dispose();
      if (owned.stage) owned.stage.destroy();
    } catch (cleanupError) {
      log.warn('character cleanup failed', cleanupError); // the original error is what the caller needs
    }
    throw new Error(`${mode} avatar unavailable: ${messageOf(error)}`);
  } finally {
    unlink();
  }
}

/**
 * @param {{ config: object, container: HTMLElement, onProgress?: (p: number) => void, baseUrl?: string,
 *   signal?: AbortSignal }} options
 *   baseUrl: optional base for asset paths (default: the page URL), used by test pages.
 *   signal: cancels the build (the model download stops; the promise rejects)
 * @returns {Promise<{ mode: string, stage: object, startIntro(opts?: { instant?: boolean }): void,
 *   setActive(on: boolean): void, destroy(): void }>}
 */
export async function createAvatar({ config, container, onProgress, baseUrl, signal } = {}) {
  if (!container || !(container instanceof HTMLElement)) throw new Error('createAvatar needs a container element');
  const avatarConfig = config && config.avatar;
  if (!avatarConfig || typeof avatarConfig !== 'object') throw new Error('config.avatar is missing');
  if (SCENE_MODES.includes(avatarConfig.mode)) return createSceneAvatar({ config, container, onProgress, baseUrl, mode: avatarConfig.mode, signal });
  const progress = createProgress(onProgress, WEIGHTS);
  progress.set('meta', 0);
  const owned = { stage: null, subject: null, screen: null, head: null, images: [] };
  try {
    owned.stage = createStage({ container });
    const maxAnisotropy = owned.stage.renderer.capabilities.getMaxAnisotropy();
    const [loaded, shot] = await Promise.all([
      loadPortraitSubject(avatarConfig.portrait, baseUrl, progress, maxAnisotropy),
      loadScreenTexture(screenImagePath(config), baseUrl, progress, maxAnisotropy),
    ]);
    owned.subject = loaded.subject;
    owned.images = [...loaded.images, shot.image].filter(Boolean);
    owned.screen = createScreen({ texture: shot.texture });
    owned.head = createHead({ limits: owned.subject.headLimits });
    const tweens = createTweens();
    const { stage, subject, screen, head } = owned;
    stage.scene.add(subject.root, screen.group);
    stage.setFrame(subject.frame);
    screen.placeFor(subject.frame);
    stage.onUpdate((dt, time) => {
      tweens.step(dt);
      head.update(dt, time, stage.params, subject.bodyPose(stage.params));
      screen.update(dt, time, stage.params);
      subject.update(time, stage.params, head.pose, screen, dt);
    });
    await stage.prepare([...subject.textures, ...screen.textures]);
    checkNotAborted(signal);
    owned.images.forEach(releaseImage);
    progress.set('compile', 1);
    progress.done();
    return buildApi({ stage, subject, screen, head, tweens, failover: createFailover(container) });
  } catch (error) {
    cleanupQuietly(owned);
    throw new Error(`avatar unavailable: ${messageOf(error)}`);
  }
}
