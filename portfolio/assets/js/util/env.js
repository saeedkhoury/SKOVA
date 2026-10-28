/**
 * Environment gates shared by every module. All values are read live (no caching),
 * except WebGL support, which cannot change during a visit.
 */
export const BP = Object.freeze({
  MOBILE: 768, // <= 768: phone layout, no pin, no split reveals
  REVEALS: 900, // < 900: split-text reveals off
  DESKTOP: 1024, // > 1024: desktop composition; at or below it, the compact (portrait) one
  CURSOR: 600, // >= 600 + fine pointer: custom cursor
});

const query = (q) => {
  try {
    return window.matchMedia(q);
  } catch {
    return { matches: false, addEventListener() {}, removeEventListener() {} };
  }
};

const MQ = {
  reduced: query('(prefers-reduced-motion: reduce)'),
  fine: query('(hover: hover) and (pointer: fine)'),
  saveData: query('(prefers-reduced-data: reduce)'),
};

const params = (() => {
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return new URLSearchParams();
  }
})();

/** ?motion=reduce forces the reduced-motion path (handy for testing). */
export function prefersReducedMotion() {
  return MQ.reduced.matches || params.get('motion') === 'reduce';
}

export function hasFinePointer() {
  return MQ.fine.matches;
}

export const viewportWidth = () => window.innerWidth || document.documentElement.clientWidth;

export const viewportHeight = () => window.innerHeight || document.documentElement.clientHeight;

export const isMobile = () => viewportWidth() <= BP.MOBILE;
export const isDesktop = () => viewportWidth() > BP.DESKTOP;
/** Phones and tablets held upright: the compact composition of the live avatar. */
export const isCompactPortrait = () => !isDesktop() && viewportHeight() >= viewportWidth();

let webglSupport = null;

export function supportsWebGL() {
  if (webglSupport !== null) return webglSupport;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    webglSupport = Boolean(gl);
    const lose = gl && gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

/** ?avatar=0 forces the static portrait (testing, or a manual opt-out). */
export function avatarDisabledByUrl() {
  return params.get('avatar') === '0';
}

/**
 * Devices that asked for less data, or report very little memory (Chrome on Android exposes
 * both), keep the still: the 3D avatar is a 4 MB download and a steady GPU load.
 */
const LOW_MEMORY_GB = 2;
export function prefersLightPage() {
  try {
    const nav = window.navigator || {};
    const connection = nav.connection || {};
    if (connection.saveData || MQ.saveData.matches) return true;
    if (/(^|-)2g$/.test(String(connection.effectiveType || ''))) return true;
    const memory = Number(nav.deviceMemory);
    return Number.isFinite(memory) && memory > 0 && memory < LOW_MEMORY_GB;
  } catch {
    return false;
  }
}

/** A composition the live avatar has: desktop (> 1024), or a phone or tablet held upright. */
export const hasLiveComposition = () => isDesktop() || isCompactPortrait();

/** Live 3D avatar gate: a live composition, WebGL, motion allowed, not a data-saving device. */
export function canRunLive3D() {
  return hasLiveComposition() && !prefersReducedMotion() && !avatarDisabledByUrl() && !prefersLightPage() && supportsWebGL();
}

/** Media queries whose change requires rebuilding layout-dependent motion. */
const BREAKPOINT_QUERIES = [
  `(min-width: ${BP.MOBILE + 1}px)`,
  `(min-width: ${BP.REVEALS}px)`,
  `(min-width: ${BP.DESKTOP + 1}px)`,
  `(min-width: ${BP.CURSOR}px)`,
  '(prefers-reduced-motion: reduce)',
  '(hover: hover) and (pointer: fine)',
  '(orientation: portrait)',
];

/**
 * Calls fn() whenever any of the breakpoints above flips.
 * @param {() => void} fn
 * @returns {() => void} unsubscribe
 */
export function onEnvironmentChange(fn) {
  const lists = BREAKPOINT_QUERIES.map(query);
  lists.forEach((mql) => mql.addEventListener('change', fn));
  return () => lists.forEach((mql) => mql.removeEventListener('change', fn));
}

/** Snapshot of the current environment, passed to every motion module. */
export function readEnv() {
  const width = viewportWidth();
  const reduced = prefersReducedMotion();
  const desktop = width > BP.DESKTOP;
  const portrait = !desktop && viewportHeight() >= width;
  return Object.freeze({
    width,
    reduced,
    fine: hasFinePointer(),
    mobile: width <= BP.MOBILE,
    desktop,
    portrait, // a phone or tablet held upright (compact composition)
    live: (desktop || portrait) && !reduced, // the live avatar may show (if it was built)
    reveals: width >= BP.REVEALS,
    cursor: width >= BP.CURSOR,
  });
}
