/**
 * Pinned horizontal "My Work" gallery on > 768px (not for reduced motion).
 * Distance follows the reference formula and is recomputed on every refresh.
 *
 * Keyboard support for the pinned gallery:
 *  - focus survives ScrollTrigger.refresh() (the refresh moves the pinned section out of and
 *    back into its spacer, which would otherwise drop focus to <body>);
 *  - a focused link that sits outside the viewport (the gallery is translated sideways)
 *    scrolls the page to the point where the gallery shows it.
 */
const NOOP = { destroy() {} };
const FOCUS_MARGIN = 80; // px kept free between a focused link and the viewport's side edges

function measureDistance(container, flex) {
  const boxes = flex.children;
  if (!boxes.length) return 0;
  const box = boxes[0].getBoundingClientRect();
  const left = container.getBoundingClientRect().left;
  const width = flex.getBoundingClientRect().width;
  const halfPad = (parseFloat(window.getComputedStyle(boxes[0]).paddingLeft) || 0) / 2;
  return Math.max(0, box.width * boxes.length - (left + width) + halfPad);
}

/** Gallery x for a page scroll position, once the scrub has caught up. */
function settledX(st, d, y) {
  const span = st.end - st.start;
  if (span <= 0) return 0;
  return -d * Math.min(1, Math.max(0, (y - st.start) / span));
}

/**
 * Page scroll that brings `el` (inside the translated gallery) fully into view, or null when
 * it is already visible at the current scroll position.
 */
function revealY({ gsap, st, flex, el, d }) {
  if (!st || d <= 0) return null;
  const x = Number(gsap.getProperty(flex, 'x')) || 0; // current, possibly still easing
  const r = el.getBoundingClientRect();
  const left0 = r.left - x; // position with the gallery at x = 0
  const right0 = r.right - x;
  const maxRight = window.innerWidth - FOCUS_MARGIN;
  const settled = settledX(st, d, window.scrollY);
  if (left0 + settled >= FOCUS_MARGIN && right0 + settled <= maxRight) return null;
  let goal = settled;
  if (right0 + goal > maxRight) goal = maxRight - right0;
  if (left0 + goal < FOCUS_MARGIN) goal = FOCUS_MARGIN - left0;
  goal = Math.min(0, Math.max(-d, goal));
  return Math.round(st.start + (-goal / d) * (st.end - st.start));
}

/** Keeps focus inside `section` across refreshes and reveals focused gallery links. */
function bindKeyboard({ gsap, ScrollTrigger, section, flex, getTrigger, distance }) {
  let saved = null;
  let frame = 0;
  const onRefreshInit = () => {
    const active = document.activeElement;
    saved = active && section.contains(active) ? active : null;
  };
  const onRefresh = () => {
    if (saved && saved.isConnected && document.activeElement !== saved) saved.focus({ preventScroll: true });
    saved = null;
  };
  const onFocusIn = (event) => {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(() => {
      const y = revealY({ gsap, st: getTrigger(), flex, el: event.target, d: distance() });
      if (y !== null && Math.abs(y - window.scrollY) > 1) window.scrollTo(0, y);
    });
  };
  ScrollTrigger.addEventListener('refreshInit', onRefreshInit);
  ScrollTrigger.addEventListener('refresh', onRefresh);
  flex.addEventListener('focusin', onFocusIn);
  return () => {
    window.cancelAnimationFrame(frame);
    ScrollTrigger.removeEventListener('refreshInit', onRefreshInit);
    ScrollTrigger.removeEventListener('refresh', onRefresh);
    flex.removeEventListener('focusin', onFocusIn);
  };
}

export function createWork({ gsap, ScrollTrigger }, env) {
  const section = document.querySelector('.work-section');
  const container = section && section.querySelector('.work-container');
  const flex = section && section.querySelector('.work-flex');
  if (!section || !container || !flex) return NOOP;
  section.classList.remove('is-pinned');
  if (!gsap || !ScrollTrigger || env.reduced || env.mobile) return NOOP;

  section.classList.add('is-pinned');
  const distance = () => measureDistance(container, flex);
  if (distance() <= 0) {
    section.classList.remove('is-pinned');
    return NOOP;
  }
  let st = null;
  const ctx = gsap.context(() => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => `+=${distance()}`,
        scrub: 1,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        id: 'work',
      },
    }).to(flex, { x: () => -distance(), ease: 'none' });
    st = tl.scrollTrigger || null;
  });
  const unbindKeyboard = bindKeyboard({ gsap, ScrollTrigger, section, flex, getTrigger: () => st, distance });
  return {
    destroy() {
      unbindKeyboard();
      ctx.revert();
      section.classList.remove('is-pinned');
    },
  };
}
