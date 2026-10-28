/**
 * One-shot intro after the loader: hero text rises out of blur, role headline
 * fades up, header / social column / nav fade in. Values from the reference.
 */
import { log } from '../util/log.js';

const CHAR_FROM = { opacity: 0, y: 80, filter: 'blur(5px)' };
const CHAR_TO = { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.2, ease: 'power3.inOut', stagger: 0.025, delay: 0.3 };
const CHROME = ['.header', '.icons-section', '.nav-fade'];

function splitHeroText(SplitText) {
  if (!SplitText) return null;
  try {
    return SplitText.create(['.landing-greeting', '.landing-name'], { type: 'chars,lines', linesClass: 'split-line', mask: 'lines' });
  } catch (error) {
    log.warn('intro split failed', error);
    return null;
  }
}

/**
 * @param {{ gsap: any, SplitText: any, env: object }} ctx
 * @returns {{ destroy(): void }}
 */
export function playIntro({ gsap, SplitText, env }) {
  if (!gsap || env.reduced) return { destroy() {} };
  let split = null;
  const ctx = gsap.context(() => {
    split = splitHeroText(SplitText);
    const article = gsap.utils.toArray('.role-article .role-word.is-first .ch');
    const rest = gsap.utils.toArray('.role-rest .role-word.is-first .ch');
    const heroChars = split ? split.chars : gsap.utils.toArray('.landing-intro');
    gsap.fromTo([...article, ...heroChars], CHAR_FROM, {
      ...CHAR_TO,
      clearProps: 'filter',
      onComplete: () => { if (split) split.revert(); split = null; },
    });
    if (rest.length) gsap.fromTo(rest, CHAR_FROM, { ...CHAR_TO, clearProps: 'filter' });
    gsap.fromTo('.role-accent', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.2, ease: 'power1.inOut', delay: 0.8 });
    gsap.fromTo(CHROME, { opacity: 0 }, { opacity: 1, duration: 1.2, ease: 'power1.inOut', delay: 0.1 });
  });
  return {
    destroy() {
      ctx.getTweens().forEach((tween) => tween.progress(1));
      if (split) split.revert();
      split = null;
    },
  };
}
