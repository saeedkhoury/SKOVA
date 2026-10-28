/**
 * Career timeline (reference values): trigger "top 50%" to "bottom 30%", scrub 1.5.
 * The line grows, entries fade in, the dot pulses until the end; desktop drifts the section.
 */
export function createCareer({ gsap, ScrollTrigger }, env) {
  const section = document.querySelector('.career-section');
  if (!section || !gsap || !ScrollTrigger || env.reduced) return { destroy() {} };
  const ctx = gsap.context(() => {
    const tl = gsap.timeline({
      scrollTrigger: { trigger: section, start: 'top 50%', end: 'bottom 30%', scrub: 1.5, invalidateOnRefresh: true },
    });
    tl.fromTo('.career-timeline', { maxHeight: '0%' }, { maxHeight: '100%', duration: 1, ease: 'none' }, 0)
      .fromTo('.career-timeline', { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0)
      .fromTo('.career-info-box', { opacity: 0 }, { opacity: 1, stagger: 0.1, duration: 0.5 }, 0)
      .fromTo('.career-dot', { animationIterationCount: 'infinite' }, { animationIterationCount: '1', delay: 0.3, duration: 0.1 }, 0);
    if (env.desktop) tl.fromTo(section, { y: 0 }, { y: '20%', duration: 0.5, delay: 0.2 }, 0);
  }, section);
  return { destroy: () => ctx.revert() };
}
