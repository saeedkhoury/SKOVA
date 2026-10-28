/** Contact reveal (reference): name fades up, then the boxes, once, at "top 80%". */
export function createContact({ gsap, ScrollTrigger }, env) {
  const section = document.querySelector('.contact-section');
  if (!section || !gsap || !ScrollTrigger || env.reduced) return { destroy() {} };
  const ctx = gsap.context(() => {
    gsap.timeline({
      scrollTrigger: { trigger: section, start: 'top 80%', end: 'bottom center', toggleActions: 'play none none none' },
    })
      .fromTo(['.contact-section h2', '.contact-note'], { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' })
      .fromTo('.contact-box', { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.15, ease: 'power3.out' }, '-=0.4');
  }, section);
  return { destroy: () => ctx.revert() };
}
