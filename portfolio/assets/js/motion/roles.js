/**
 * Role roll in the hero: article, accent word and rest roll together between
 * config.hero.roles. Timing mirrors the reference loop: first swap at 4s, the
 * next every 6s, 1.2s power3.inOut, stagger .1, repeatDelay 1.
 */
const FIRST_SWAP_S = 4;
const SWAP_EVERY_S = 6;
const ROLL = { duration: 1.2, ease: 'power3.inOut', stagger: 0.1, immediateRender: false };
const REPEAT_DELAY_S = 1;
const OUT_Y = -110;
const IN_Y = 110;

function charsOf(line, role) {
  return Array.from(line.querySelectorAll(`.role-word[data-role="${role}"] .ch`));
}

/**
 * @param {{ gsap: any, env: object }} ctx
 * @returns {{ destroy(): void }}
 */
export function createRoles({ gsap, env }) {
  const lines = Array.from(document.querySelectorAll('.role-roll .role-line'));
  const count = lines.length ? lines[0].querySelectorAll('.role-word').length : 0;
  if (!gsap || env.reduced || count < 2) return { destroy() {} };

  const allChars = lines.flatMap((line) => Array.from(line.querySelectorAll('.ch')));
  const firstChars = lines.flatMap((line) => charsOf(line, 0));
  gsap.set(allChars, { y: 0, yPercent: IN_Y, opacity: 0 });
  gsap.set(firstChars, { yPercent: 0, opacity: 1 });

  const tl = gsap.timeline({ repeat: -1, repeatDelay: REPEAT_DELAY_S });
  for (let k = 0; k < count; k += 1) {
    const at = FIRST_SWAP_S + k * SWAP_EVERY_S;
    const next = (k + 1) % count;
    lines.forEach((line) => {
      const out = charsOf(line, k);
      const into = charsOf(line, next);
      if (out.length) tl.fromTo(out, { yPercent: 0, opacity: 1 }, { yPercent: OUT_Y, ...ROLL }, at);
      if (into.length) tl.fromTo(into, { yPercent: IN_Y, opacity: 0 }, { yPercent: 0, opacity: 1, ...ROLL }, at);
    });
  }

  return {
    destroy() {
      tl.kill();
      gsap.set(allChars, { clearProps: 'transform,opacity' });
    },
  };
}
