/**
 * The gentle entrance of the All Works cards: each card fades and rises a little as it scrolls
 * into view, the ones that arrive together in a short stagger (CSS transitions in works.css,
 * an IntersectionObserver here, no GSAP). The caller skips it for reduced motion.
 */
const STAGGER_MS = 90;
const OBSERVE = Object.freeze({ rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
const NOOP = () => {};

/**
 * Hide the cards and reveal each one as it enters the viewport. Call it in the same task as
 * the render, so a hidden card is never painted first.
 * @param {HTMLElement[]} items the card list items, in page order
 * @returns {() => void} stop: shows every card and stops observing
 */
export function playEntrance(items) {
  const targets = (items || []).filter(Boolean);
  if (!targets.length || typeof window.IntersectionObserver !== 'function') return NOOP;
  targets.forEach((item) => item.classList.add('will-enter'));
  const observer = new IntersectionObserver((entries) => {
    let order = 0;
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.style.setProperty('--enter-delay', `${order * STAGGER_MS}ms`);
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
      order += 1;
    });
  }, OBSERVE);
  targets.forEach((item) => observer.observe(item));
  return () => {
    observer.disconnect();
    targets.forEach((item) => item.classList.remove('will-enter', 'is-in'));
  };
}
