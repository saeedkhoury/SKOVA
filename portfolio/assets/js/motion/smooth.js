/**
 * Lenis smooth scroll, synced with ScrollTrigger and driven by the GSAP ticker.
 * Off for reduced motion and for coarse pointers (native touch scrolling feels better).
 */
import { log } from '../util/log.js';

export const LENIS_OPTIONS = Object.freeze({
  duration: 1.7,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  orientation: 'vertical',
  gestureOrientation: 'vertical',
  smoothWheel: true,
  wheelMultiplier: 1.7,
  touchMultiplier: 2,
  infinite: false,
  autoRaf: false,
});

const NOOP = Object.freeze({ lenis: null, destroy() {} });

/**
 * @param {{ gsap: any, ScrollTrigger: any, Lenis: any, env: object }} ctx
 * @returns {{ lenis: any, destroy(): void }}
 */
export function createSmooth({ gsap, ScrollTrigger, Lenis, env }) {
  if (!Lenis || !gsap || env.reduced || !env.fine) return NOOP;
  let lenis;
  try {
    lenis = new Lenis(LENIS_OPTIONS);
  } catch (error) {
    log.warn('Lenis failed to start, using native scroll', error);
    return NOOP;
  }
  const onScroll = () => ScrollTrigger && ScrollTrigger.update();
  lenis.on('scroll', onScroll);
  const tick = (time) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  return {
    lenis,
    destroy() {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    },
  };
}
