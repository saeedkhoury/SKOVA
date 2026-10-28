/**
 * Builds every layout-dependent motion module in page order (so ScrollTriggers are
 * created top to bottom) and returns one destroy() for all of them.
 */
import { log } from '../util/log.js';
import { createRoles } from './roles.js';
import { createReveals } from './reveals.js';
import { createWhatIDo } from './whatido.js';
import { createCareer } from './career.js';
import { createWork } from './work.js';
import { createTech } from './tech.js';
import { createContact } from './contact.js';
import { createCursor } from './cursor.js';
import { createSocial } from './social.js';
import { createNav } from './nav.js';

function attempt(name, factory) {
  try {
    const mod = factory();
    return mod && typeof mod.destroy === 'function' ? mod : null;
  } catch (error) {
    log.error(`motion module "${name}" failed`, error);
    return null;
  }
}

/**
 * @param {object} lib { gsap, ScrollTrigger, SplitText }
 * @param {object} env readEnv() snapshot
 * @param {{ hero?: () => ({destroy(): void}|null), getLenis: () => any }} hooks
 * @returns {{ destroy(): void }}
 */
export function buildMotion(lib, env, hooks) {
  const modules = [
    attempt('hero', () => (hooks.hero ? hooks.hero() : null)),
    attempt('roles', () => createRoles({ gsap: lib.gsap, env })),
    attempt('reveals', () => createReveals(lib, env)),
    attempt('whatido', () => createWhatIDo(env)),
    attempt('career', () => createCareer(lib, env)),
    attempt('work', () => createWork(lib, env)),
    attempt('tech', () => createTech(env)),
    attempt('contact', () => createContact(lib, env)),
    attempt('cursor', () => createCursor(env)),
    attempt('social', () => createSocial(env)),
    attempt('nav', () => createNav(env, hooks.getLenis, lib.ScrollTrigger)),
  ].filter(Boolean);

  return {
    destroy() {
      [...modules].reverse().forEach((mod) => {
        try {
          mod.destroy();
        } catch (error) {
          log.warn('motion destroy failed', error);
        }
      });
    },
  };
}
