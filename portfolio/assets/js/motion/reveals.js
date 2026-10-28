/**
 * Section text reveals.
 *  >= 900px: SplitText reveals from the reference (.title chars, .para words),
 *            trigger = the element's grandparent, start "20% 60%" (desktop) / "top 60%".
 *  <  900px: one simple fade-up batch for the main blocks.
 * Reduced motion: nothing hidden, nothing animated.
 */
import { log } from '../util/log.js';

const ACTIONS = 'play pause resume reverse';
const TITLE_FROM = { autoAlpha: 0, y: 80, rotate: 10 };
const TITLE_TO = { autoAlpha: 1, y: 0, rotate: 0, duration: 0.8, ease: 'power2.inOut', stagger: 0.03 };
const PARA_FROM = { autoAlpha: 0, y: 80 };
const PARA_TO = { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.02 };
const BATCH_SELECTOR = [
  '.about-me .title',
  '.about-me .para',
  '.what-box h2',
  '.what-content',
  '.work-section h2',
  '.work-box',
  '.techstack-content h2',
  '.techstack-pyramid',
].join(', ');
const BATCH_START = 'top 90%';

function splitReveal({ gsap, SplitText }, node, type, from, to, start) {
  const trigger = (node.parentElement && node.parentElement.parentElement) || node;
  return SplitText.create(node, {
    type,
    linesClass: 'split-line',
    autoSplit: true,
    onSplit(self) {
      const targets = type.startsWith('chars') ? self.chars : self.words;
      return gsap.fromTo(targets, from, { ...to, scrollTrigger: { trigger, start, toggleActions: ACTIONS } });
    },
  });
}

function createSplitReveals(lib, env) {
  const { gsap } = lib;
  const start = env.desktop ? '20% 60%' : 'top 60%';
  const ctx = gsap.context(() => {
    document.querySelectorAll('.para').forEach((node) => {
      try {
        splitReveal(lib, node, 'lines,words', PARA_FROM, PARA_TO, start);
      } catch (error) {
        log.warn('para reveal failed', error);
      }
    });
    document.querySelectorAll('.title').forEach((node) => {
      try {
        splitReveal(lib, node, 'chars,lines', TITLE_FROM, TITLE_TO, start);
      } catch (error) {
        log.warn('title reveal failed', error);
      }
    });
  });
  return { destroy: () => ctx.revert() };
}

function createFadeBatch({ gsap, ScrollTrigger }) {
  const ctx = gsap.context(() => {
    const nodes = gsap.utils.toArray(BATCH_SELECTOR);
    if (!nodes.length) return;
    const show = (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.08, overwrite: true });
    gsap.set(nodes, { opacity: 0, y: 30 });
    ScrollTrigger.batch(nodes, { start: BATCH_START, onEnter: show, onEnterBack: show, onLeave: show });
    const already = nodes.filter((node) => node.getBoundingClientRect().top < window.innerHeight);
    if (already.length) show(already);
  });
  return { destroy: () => ctx.revert() };
}

/**
 * @param {{ gsap: any, ScrollTrigger: any, SplitText: any, env: object }} lib
 * @returns {{ destroy(): void }}
 */
export function createReveals(lib, env) {
  if (!lib.gsap || !lib.ScrollTrigger || env.reduced) return { destroy() {} };
  if (!env.reveals) return createFadeBatch(lib);
  if (!lib.SplitText) return { destroy() {} };
  return createSplitReveals(lib, env);
}
