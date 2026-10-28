/**
 * Loader controller. Progress = max(fake ramp, real progress of tracked tasks).
 * It can never hang: a 6s hard cap finishes it, and a CSS animation hides the
 * screen after 9s if this script never runs (removed here once we take over).
 *
 * createLoader({ marquee }) -> { track(promise, weight), done() }
 */
import { el } from './util/dom.js';
import { prefersReducedMotion } from './util/env.js';

const FAKE_FAST_MS = 100; // quick ramp: +0..5 every 100ms
const FAKE_FAST_STEP = 5;
const FAKE_FAST_UNTIL = 50;
const FAKE_SLOW_MS = 2000; // then +0/1 every 2s
const FAKE_SLOW_CAP = 91;
const FINISH_STEP_MS = 2; // final count to 100
const EASE_TICK_MS = 40; // the shown number eases toward the target instead of jumping
const EASE_FACTOR = 0.12;
const HARD_CAP_MS = 6000;
const WELCOME_AFTER_MS = 600; // at 100%: label collapses, "Welcome"
const FLOOD_AFTER_MS = 1000; // then the pill floods the screen
const REMOVE_AFTER_MS = 900; // then the loader leaves
const FLOOD_EXTRA_W = 5000; // the flood ends at calc(100vw + 5000px) x calc(100vh + 500px)
const FLOOD_EXTRA_H = 500;
const REDUCED_HOLD_MS = 450;
const REDUCED_FADE_MS = 300;
const GAME_BARS = 27;
const MARQUEE_PX_PER_S = 50;
const MARQUEE_MIN_ITEMS = 6;
const STATUS_STEPS = [25, 50, 75];

const clamp01 = (n) => Math.min(1, Math.max(0, Number(n) || 0));

function buildGame(holder) {
  if (!holder || holder.childElementCount) return;
  for (let i = 0; i < GAME_BARS; i += 1) holder.appendChild(el('div', { className: 'loaderGame-line' }));
}

function buildMarquee(track, words) {
  const list = (words || []).filter(Boolean).map(String);
  if (!track || !list.length) return;
  const half = [];
  while (half.length < MARQUEE_MIN_ITEMS) half.push(...list);
  track.replaceChildren(...[...half, ...half].map((word) => el('span', { text: word })));
  const halfWidth = track.scrollWidth / 2;
  if (halfWidth > 0) track.style.setProperty('--marquee-duration', `${Math.round(halfWidth / MARQUEE_PX_PER_S)}s`);
}

function noopLoader() {
  return {
    track: () => ({ progress() {} }),
    done: () => Promise.resolve(),
  };
}

/** Size the flood layer (loader.css .loading-screen::before) to the pill and set its end scale. */
function prepareFlood(wrap) {
  const screen = wrap && wrap.parentElement;
  const w = wrap ? wrap.offsetWidth : 0;
  const h = wrap ? wrap.offsetHeight : 0;
  if (!screen || !w || !h) return;
  screen.style.setProperty('--flood-w', `${w}px`);
  screen.style.setProperty('--flood-h', `${h}px`);
  screen.style.setProperty('--flood-sx', String((window.innerWidth + FLOOD_EXTRA_W) / w));
  screen.style.setProperty('--flood-sy', String((window.innerHeight + FLOOD_EXTRA_H) / h));
}

function bindBlob(wrap) {
  if (!wrap) return () => {};
  const onMove = (event) => {
    const rect = wrap.getBoundingClientRect();
    wrap.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`);
    wrap.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`);
  };
  wrap.addEventListener('pointermove', onMove);
  return () => wrap.removeEventListener('pointermove', onMove);
}

/**
 * @param {{ marquee?: string[] }} options
 */
export function createLoader({ marquee = [] } = {}) {
  const root = document.getElementById('loader');
  if (!root) return noopLoader();

  const ui = {
    percent: document.getElementById('loader-percent'),
    status: document.getElementById('loader-status'),
    wrap: document.getElementById('loader-wrap'),
    button: document.getElementById('loader-button'),
  };
  const reduced = prefersReducedMotion();
  const tasks = [];
  const timers = new Set();
  // Continue from the inline head script's pre-boot count (slow networks), never backwards.
  const shownBefore = parseInt(ui.percent ? ui.percent.textContent : '0', 10) || 0;
  const initial = Math.max(0, Math.min(FAKE_FAST_UNTIL, shownBefore));
  const state = { fake: initial, shown: initial, finishing: false, announced: 0 };
  let resolveDone = () => {};
  const donePromise = new Promise((resolve) => { resolveDone = resolve; });

  root.classList.add('is-running');
  buildGame(document.getElementById('loader-game'));
  buildMarquee(document.getElementById('loader-track'), marquee);
  const unbindBlob = bindBlob(ui.wrap);

  const later = (fn, ms) => {
    const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
  };
  const every = (fn, ms) => {
    const id = window.setInterval(fn, ms);
    timers.add(id);
    return id;
  };
  const stop = (id) => { window.clearInterval(id); timers.delete(id); };

  function announce(value) {
    if (!ui.status) return;
    const step = STATUS_STEPS.filter((s) => value >= s).pop() || 0;
    if (value >= 100) ui.status.textContent = 'Loaded. Welcome';
    else if (step > state.announced) ui.status.textContent = `Loading ${step}%`;
    state.announced = Math.max(state.announced, step);
  }

  function paint(value) {
    const next = Math.max(state.shown, Math.min(100, Math.round(value)));
    if (next === state.shown && next !== 0) return;
    state.shown = next;
    if (ui.percent) ui.percent.textContent = `${next}%`;
    announce(next);
  }

  function realPercent() {
    const total = tasks.reduce((sum, t) => sum + t.weight, 0);
    if (!total) return 0;
    return (tasks.reduce((sum, t) => sum + t.weight * t.fraction, 0) / total) * 100;
  }

  function target() {
    return Math.min(99, Math.max(state.fake, realPercent()));
  }

  function update() {
    if (state.finishing) return;
    const gap = target() - state.shown;
    if (gap > 0) paint(state.shown + Math.max(1, Math.round(gap * EASE_FACTOR)));
  }

  every(update, EASE_TICK_MS);

  // Fake ramp (verified reference behaviour).
  let fakeTimer = every(() => {
    state.fake += Math.round(Math.random() * FAKE_FAST_STEP);
    update();
    if (state.fake <= FAKE_FAST_UNTIL) return;
    stop(fakeTimer);
    fakeTimer = every(() => {
      state.fake += Math.round(Math.random());
      update();
      if (state.fake > FAKE_SLOW_CAP) stop(fakeTimer);
    }, FAKE_SLOW_MS);
  }, FAKE_FAST_MS);

  function teardown() {
    timers.forEach((id) => { window.clearTimeout(id); window.clearInterval(id); });
    timers.clear();
    unbindBlob();
    root.remove();
    document.documentElement.classList.remove('is-loading');
    resolveDone();
  }

  function leave() {
    paint(100);
    if (reduced) {
      ui.button?.classList.add('loading-complete');
      later(() => root.classList.add('is-fading'), REDUCED_HOLD_MS);
      later(teardown, REDUCED_HOLD_MS + REDUCED_FADE_MS);
      return;
    }
    later(() => {
      ui.button?.classList.add('loading-complete');
      later(() => {
        prepareFlood(ui.wrap);
        ui.wrap?.classList.add('loading-clicked');
        root.classList.add('loader-out');
        later(teardown, REMOVE_AFTER_MS);
      }, FLOOD_AFTER_MS);
    }, WELCOME_AFTER_MS);
  }

  function finish() {
    if (state.finishing) return;
    state.finishing = true;
    timers.forEach((id) => { window.clearTimeout(id); window.clearInterval(id); });
    timers.clear();
    const counter = every(() => {
      if (state.shown >= 100) {
        stop(counter);
        leave();
        return;
      }
      paint(state.shown + 1);
    }, FINISH_STEP_MS);
  }

  function check() {
    if (tasks.length && tasks.every((t) => t.settled)) finish();
    else update();
  }

  // The cap counts from navigation start, so a late page script (slow network) adds no 6s more.
  later(finish, Math.max(0, HARD_CAP_MS - performance.now()));

  return {
    /**
     * Register a loading task. The promise may reject: a failed task still counts as done.
     * @param {Promise<unknown>} promise
     * @param {number} weight share of the real progress
     * @returns {{ progress(fraction: number): void }}
     */
    track(promise, weight = 0) {
      const task = { weight: Math.max(0, Number(weight) || 0), fraction: 0, settled: false };
      if (state.finishing) return { progress() {} };
      tasks.push(task);
      Promise.resolve(promise)
        .catch(() => null)
        .then(() => {
          task.fraction = 1;
          task.settled = true;
          check();
        });
      return {
        progress(fraction) {
          if (task.settled) return;
          task.fraction = clamp01(fraction);
          update();
        },
      };
    },
    /** Resolves once the loader screen has been removed. */
    done: () => donePromise,
  };
}
