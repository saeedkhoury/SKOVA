/**
 * In-page navigation for [data-nav] links: Lenis scrollTo (duration 1.5) when smooth
 * scrolling is active, native smooth scrolling otherwise (instant for reduced motion).
 * Focus moves to the target section so keyboard and screen-reader users follow along.
 *
 * Native path guard: a ScrollTrigger.refresh() restores the scroll position it measured,
 * which cancels a running native smooth scroll. For a short while after a tap, a refresh
 * re-issues the scroll unless the visitor has started scrolling on their own.
 */
const LENIS_DURATION = 1.5;
const GUARD_MS = 2000;
const SETTLED_PX = 2;
const USER_SCROLL_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'];

function resolveTarget(href) {
  if (!href || !href.startsWith('#') || href.length < 2) return null;
  try {
    return document.querySelector(href);
  } catch {
    return null;
  }
}

function focusSection(target) {
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

/** Re-issues scrollIntoView after a refresh for GUARD_MS; returns a stop function. */
function guardNativeScroll(ScrollTrigger, target, behavior) {
  if (!ScrollTrigger || typeof ScrollTrigger.addEventListener !== 'function') return () => {};
  let timer = 0;
  let frame = 0;
  const scrollAgain = () => {
    if (Math.abs(target.getBoundingClientRect().top) > SETTLED_PX) target.scrollIntoView({ behavior, block: 'start' });
  };
  // Two frames later: a smooth scroll started in the same task as the refresh's instant
  // scroll restore ends almost at once in Chrome, far short of the target.
  const reissue = () => {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(() => { frame = window.requestAnimationFrame(scrollAgain); });
  };
  const stop = () => {
    window.clearTimeout(timer);
    window.cancelAnimationFrame(frame);
    ScrollTrigger.removeEventListener('refresh', reissue);
    USER_SCROLL_EVENTS.forEach((type) => window.removeEventListener(type, stop, true));
  };
  ScrollTrigger.addEventListener('refresh', reissue);
  // Added after the tap's own events have been dispatched, so only later input cancels the guard.
  USER_SCROLL_EVENTS.forEach((type) => window.addEventListener(type, stop, { capture: true, passive: true }));
  timer = window.setTimeout(stop, GUARD_MS);
  return stop;
}

export function createNav(env, getLenis, ScrollTrigger = null) {
  let stopGuard = () => {};
  const onClick = (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const link = event.target.closest && event.target.closest('a[data-nav]');
    if (!link) return;
    const target = resolveTarget(link.getAttribute('href'));
    if (!target) return;
    event.preventDefault();
    stopGuard();
    const lenis = getLenis();
    if (lenis) {
      lenis.scrollTo(target, { offset: 0, duration: LENIS_DURATION, onComplete: () => focusSection(target) });
      return;
    }
    const behavior = env.reduced ? 'auto' : 'smooth';
    target.scrollIntoView({ behavior, block: 'start' });
    focusSection(target);
    stopGuard = guardNativeScroll(ScrollTrigger, target, behavior);
  };
  document.addEventListener('click', onClick);
  return {
    destroy() {
      stopGuard();
      document.removeEventListener('click', onClick);
    },
  };
}
