/**
 * Stage: one WebGL renderer, the camera that frames the bust like the reference
 * character, the render loop (paused when the tab is hidden, when setActive(false),
 * or when the layer is scrolled/translated out of view), resize handling, and the
 * DOM rim glow behind the character.
 *
 * stage.params is a plain object that GSAP tweens; the loop reads it every frame.
 */
import * as THREE from 'three';
import { clamp, lerp, watchPixelRatio } from './support.js';
import { log } from '../util/log.js';

export const PARAM_DEFAULTS = Object.freeze({
  modelYaw: 0,
  modelPitch: 0,
  lean: 0,
  camZ: 1, // camera distance as a multiple of the hero framing distance
  camY: 0, // camera + target vertical offset (world units; negative = subject sits higher)
  light: 0,
  rim: 1,
  screenRise: 0,
  screenOpacity: 0,
  screenLight: 0,
  headLookMix: 0,
  sceneX: 0, // character mode: world offset of the character (the desk scene sits left of the cards)
  sceneY: 0,
  sceneScale: 1, // character mode: the seated scene shrinks a little around its middle at "What I do"
});

// Reference camera: fov 14.5, zoom 1.1, slightly above and looking down a little.
// Framing matches the reference's big bust: the head (hair top to beard) fills ~38% of the
// viewport height with the hair 15% from the top, so the bottom edge cuts the chest.
const CAMERA = Object.freeze({
  fov: 14.5,
  zoom: 1.1,
  near: 0.1,
  far: 200,
  tilt: 0.075, // radians the camera looks down
  headShare: 0.38, // head (hair top to chin) as a share of the viewport height
  headTop: 0.15, // hair top, from the top of the viewport
  sideMargin: 0.06, // keep the bust this far (share of width) from the sides
});
// Full device resolution up to 2x (the hero face needs it to stay as sharp as the photo), but
// never more canvas pixels than a 1920x1080 screen at 2x: larger screens render a little below
// their DPR, where the photo is already the limit and the GPU cost is not worth it.
const MAX_DPR = 2;
const MAX_CANVAS_PIXELS = 1920 * 1080 * 4;

function pixelRatioFor(width, height) {
  const budget = Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, width * height));
  return Math.max(1, Math.min(window.devicePixelRatio || 1, MAX_DPR, budget));
}
const MAX_DT = 1 / 20;
// Fixed camera (character mode): windows narrower than this aspect step the camera back so the
// scene keeps its width (the head keeps clear of the hero text on both sides). The compact
// (portrait) story sets its own, a phone's (stage.setFitAspect).
const FIT_ASPECT = 1.5;
const RIM = Object.freeze({ fromY: 100, introY: 55, goneY: -70, scale: 1.4, fadeGain: 3 });
// Shrink the observed box by a pixel so a layer translated exactly out of view (-100%) counts as off-screen.
const VISIBILITY_MARGIN = '-1px 0px -1px 0px';
const STATS_SMOOTH = 0.05;

function makeRenderer() {
  const dpr = window.devicePixelRatio || 1;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: dpr < 2,
      powerPreference: 'high-performance',
      premultipliedAlpha: true,
      stencil: false,
    });
  } catch (error) {
    throw new Error(`WebGL is not available (${error && error.message ? error.message : 'no context'})`);
  }
  renderer.setPixelRatio(Math.min(dpr, MAX_DPR));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  const canvas = renderer.domElement;
  canvas.className = 'avatar-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    display: 'block',
    zIndex: '2',
    pointerEvents: 'none',
  });
  return renderer;
}

/** The DOM glow behind the character (.avatar-rim, or the page's .character-rim). */
function createRimGlow(container) {
  let el = container.querySelector('.avatar-rim, .character-rim');
  const created = !el;
  if (created) {
    el = document.createElement('div');
    el.className = 'avatar-rim';
    el.setAttribute('aria-hidden', 'true');
    Object.assign(el.style, {
      position: 'absolute',
      width: '400px',
      height: '400px',
      top: '50%',
      left: '50%',
      zIndex: '1',
      borderRadius: '50%',
      background: '#f59bf8',
      boxShadow: 'inset 66px 35px 85px #5500ffa6',
      filter: 'blur(50px)',
      pointerEvents: 'none',
    });
    container.prepend(el);
  }
  const last = { y: NaN, s: NaN, o: NaN, fade: NaN };
  // "changed" is written as !(diff <= eps) so the first call (last = NaN) always writes.
  const changed = (a, b, eps) => !(Math.abs(a - b) <= eps);
  return {
    /** @param {number} intro 0..1 lights-on progress @param {number} rim 0..1 (scroll) */
    update(intro, rim) {
      const y = lerp(RIM.goneY, lerp(RIM.fromY, RIM.introY, intro), rim);
      const s = RIM.scale * rim;
      const o = clamp(intro, 0, 1) * clamp(rim * RIM.fadeGain, 0, 1);
      if (changed(y, last.y, 0.05) || changed(s, last.s, 0.001)) {
        el.style.transform = `translate(-50%, ${y.toFixed(2)}%) scale(${s.toFixed(3)})`;
        last.y = y;
        last.s = s;
      }
      if (changed(o, last.o, 0.002)) {
        el.style.opacity = o.toFixed(3);
        last.o = o;
      }
      // the hero's floor fade (hero.css --scene-fade) leaves with the back glow
      const fade = clamp(rim, 0, 1);
      if (changed(fade, last.fade, 0.002)) {
        container.style.setProperty('--scene-fade', fade.toFixed(3));
        last.fade = fade;
      }
    },
    clear() {
      el.style.removeProperty('transform');
      el.style.removeProperty('opacity');
      container.style.removeProperty('--scene-fade');
      last.y = NaN;
      last.s = NaN;
      last.o = NaN;
      last.fade = NaN;
    },
    dispose() {
      this.clear();
      if (created) el.remove();
    },
  };
}

/**
 * @param {{ container: HTMLElement }} opts
 */
export function createStage({ container }) {
  if (!container || !(container instanceof HTMLElement)) throw new Error('avatar stage needs a container element');
  const renderer = makeRenderer();
  const canvas = renderer.domElement;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far);
  camera.zoom = CAMERA.zoom;
  const params = { ...PARAM_DEFAULTS };
  const intro = { rim: 0 }; // lights-on progress of the DOM rim glow (tweened by index.js)
  const rim = createRimGlow(container);
  const updaters = [];
  const base = { dist: 10, x: 0, y: 0, z: 0 };
  const lookAt = new THREE.Vector3();
  const probe = new THREE.Vector3();
  const state = {
    fixed: null, fit: 1, fitAspect: FIT_ASPECT,
    frame: null, active: false, onScreen: true, hidden: document.hidden, lost: false, failed: false,
    raf: 0, last: 0, time: 0, width: 0, height: 0, destroyed: false, ready: false,
  };
  let troubleListener = null;
  const reportTrouble = () => { if (troubleListener) troubleListener(state.lost || state.failed); };
  const stats = { frames: 0, frameMs: 0, cpuMs: 0, maxCpuMs: 0 };
  container.appendChild(canvas);

  /** Place the camera from params (no allocations). */
  function applyCamera() {
    if (state.fixed) {
      // The reference camera: no lookAt, straight down -z; params are absolute world units.
      camera.position.set(state.fixed.x, params.camY, params.camZ * state.fit);
      camera.rotation.set(0, 0, 0);
      camera.updateMatrixWorld();
      return;
    }
    const d = base.dist * Math.max(0.2, params.camZ);
    const y = base.y + params.camY;
    camera.position.set(base.x, y + Math.sin(CAMERA.tilt) * d, base.z + Math.cos(CAMERA.tilt) * d);
    lookAt.set(base.x, y, base.z);
    camera.lookAt(lookAt);
    camera.updateMatrixWorld();
  }

  /** Hero framing: head share of the viewport height, head top position, bust centred. */
  function computeFraming() {
    const f = state.frame;
    if (!f || !state.width || !state.height) return;
    const aspect = state.width / state.height;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(CAMERA.fov / 2)) / CAMERA.zoom;
    let visH = (f.top - f.bottom) / CAMERA.headShare;
    const needW = f.halfWidth * 2 / (1 - 2 * CAMERA.sideMargin);
    if (visH * aspect < needW) visH = needW / aspect;
    base.dist = visH / (2 * tanHalf);
    base.x = f.centerX;
    base.z = f.z;
    base.y = f.top - (0.5 - CAMERA.headTop) * visH;
    // Perspective + tilt shift the head top a little: correct with two projection passes.
    const saved = { camZ: params.camZ, camY: params.camY };
    params.camZ = 1;
    params.camY = 0;
    for (let i = 0; i < 2; i += 1) {
      applyCamera();
      probe.set(f.centerX, f.top, f.z).project(camera);
      const wantNdc = 1 - 2 * CAMERA.headTop;
      base.y -= ((wantNdc - probe.y) / 2) * visH;
    }
    params.camZ = saved.camZ;
    params.camY = saved.camY;
  }

  function resize() {
    if (state.destroyed) return;
    const width = Math.max(1, container.clientWidth || window.innerWidth);
    const height = Math.max(1, container.clientHeight || window.innerHeight);
    const dpr = pixelRatioFor(width, height); // also changes when moved to another screen, or zoomed (watchPixelRatio)
    const dprChanged = dpr !== renderer.getPixelRatio();
    if (dprChanged) renderer.setPixelRatio(dpr);
    if (!dprChanged && width === state.width && height === state.height) return;
    state.width = width;
    state.height = height;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    state.fit = Math.max(1, state.fitAspect / camera.aspect);
    computeFraming();
    if (state.ready && !state.raf) renderNow(0);
  }

  function renderNow(dt) {
    for (let i = 0; i < updaters.length; i += 1) updaters[i](dt, state.time);
    applyCamera();
    const t0 = performance.now();
    renderer.render(scene, camera);
    const cpu = performance.now() - t0;
    stats.cpuMs = stats.frames ? lerp(stats.cpuMs, cpu, STATS_SMOOTH) : cpu;
    stats.maxCpuMs = Math.max(stats.maxCpuMs, cpu);
  }

  function tick(now) {
    state.raf = 0;
    if (!shouldRun()) return;
    state.raf = requestAnimationFrame(tick);
    const dt = state.last ? clamp((now - state.last) / 1000, 0, MAX_DT) : 1 / 60;
    if (state.last) stats.frameMs = stats.frames ? lerp(stats.frameMs, now - state.last, STATS_SMOOTH) : now - state.last;
    state.last = now;
    state.time += dt;
    try {
      renderNow(dt);
    } catch (error) {
      // Never throw from rAF every frame: stop the loop and let index.js show the static portrait.
      log.error('avatar render failed', error);
      state.failed = true;
      sync();
      reportTrouble();
      return;
    }
    rim.update(clamp(intro.rim, 0, 1), clamp(params.rim, 0, 1));
    stats.frames += 1;
  }

  const shouldRun = () => state.ready && state.active && state.onScreen && !state.hidden
    && !state.lost && !state.failed && !state.destroyed;

  function sync() {
    if (shouldRun() && !state.raf) {
      state.last = 0;
      state.raf = requestAnimationFrame(tick);
    } else if (!shouldRun() && state.raf) {
      cancelAnimationFrame(state.raf);
      state.raf = 0;
    }
  }

  const onVisibility = () => { state.hidden = document.hidden; sync(); };
  const onLost = (event) => {
    event.preventDefault(); // allows the browser to restore the context
    state.lost = true;
    sync();
    reportTrouble();
  };
  const onRestored = () => {
    state.lost = false;
    if (state.ready && !state.failed) renderNow(0);
    sync();
    reportTrouble();
  };
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);
  window.addEventListener('resize', resize, { passive: true });
  const unwatchPixelRatio = watchPixelRatio(resize);
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  if (resizeObserver) resizeObserver.observe(container);
  const io = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      state.onScreen = entry.isIntersecting;
      sync();
    }, { threshold: 0, rootMargin: VISIBILITY_MARGIN })
    : null;
  if (io) io.observe(container);

  const stage = {
    THREE,
    renderer,
    scene,
    camera,
    canvas,
    container,
    params,
    intro,
    stats,
    /** Register a per-frame callback (dt, time). */
    onUpdate(fn) { updaters.push(fn); },
    /** fn(true) when the GPU context is lost or rendering failed, fn(false) when it is back. */
    onTrouble(fn) { troubleListener = typeof fn === 'function' ? fn : null; },
    /**
     * Use a fixed camera (character mode) instead of framing a subject: fov, zoom and x as
     * given; params.camY / params.camZ become the camera's absolute y and z.
     */
    useFixedCamera({ fov, zoom, position }) {
      state.fixed = { x: position[0] };
      camera.fov = fov;
      camera.zoom = zoom;
      params.camY = position[1];
      params.camZ = position[2];
      camera.updateProjectionMatrix();
      state.width = 0;
      resize();
    },
    /**
     * Fixed camera: below this aspect (width / height) the camera steps back to keep the scene's
     * width. Omit it for the default (desktop) value.
     * @param {number} [aspect]
     */
    setFitAspect(aspect) {
      const next = Number(aspect) > 0 ? Number(aspect) : FIT_ASPECT;
      if (next === state.fitAspect) return;
      state.fitAspect = next;
      state.width = 0;
      resize();
    },
    /** Tell the stage what to frame: { top, bottom, centerX, halfWidth, z } in world units. */
    setFrame(frame) {
      state.frame = frame;
      state.width = 0;
      resize();
    },
    get running() { return Boolean(state.raf); },
    get time() { return state.time; },
    /** Upload textures and compile every program before the first visible frame. */
    async prepare(textures = []) {
      textures.forEach((texture) => renderer.initTexture(texture));
      applyCamera();
      // compileAsync only helps with KHR_parallel_shader_compile, and without it three.js logs a
      // console warning, so ask first (extensions.has() is silent) and compile synchronously otherwise.
      const ext = renderer.extensions;
      const parallel = Boolean(ext && typeof ext.has === 'function' && ext.has('KHR_parallel_shader_compile'));
      if (parallel && typeof renderer.compileAsync === 'function') await renderer.compileAsync(scene, camera);
      else renderer.compile(scene, camera);
      state.ready = true;
      renderNow(0);
      sync();
    },
    setActive(on) {
      state.active = Boolean(on);
      canvas.style.visibility = state.active ? '' : 'hidden';
      if (!state.active) rim.clear();
      sync();
    },
    destroy() {
      if (state.destroyed) return;
      state.destroyed = true;
      sync();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      window.removeEventListener('resize', resize);
      unwatchPixelRatio();
      if (resizeObserver) resizeObserver.disconnect();
      if (io) io.disconnect();
      updaters.length = 0;
      troubleListener = null;
      rim.dispose();
      renderer.dispose();
      if (typeof renderer.forceContextLoss === 'function') renderer.forceContextLoss();
      canvas.remove();
    },
  };
  resize();
  return stage;
}
