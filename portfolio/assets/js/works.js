/**
 * Entry of the All Works page (works.html): render it from site.config.js, then the card
 * entrance and the picture lightbox. No loader and no GSAP. The page has no inline script
 * (the CSP in vercel.json only allows the home page's two), so the html classes that
 * index.html sets inline are set here.
 */
import config from '../../site.config.js';
import { renderWorksPage, CARD_SIZE } from './render/works-page.js';
import { createLightbox } from './works/lightbox.js';
import { playEntrance } from './works/entrance.js';
import { isExternal } from './render/shared.js';
import { el, fill } from './util/dom.js';
import { prefersReducedMotion } from './util/env.js';
import { log } from './util/log.js';

const root = document.documentElement;

function markEnvironment(reduced) {
  root.classList.remove('no-js');
  root.classList.add('js');
  root.classList.toggle('reduced-motion', reduced);
}

/**
 * The render failed: show the same plain list as the <noscript> block in works.html
 * (title + link per project, and the way home), built with text nodes only.
 */
function showFallback(main) {
  const texts = config.worksPage || {};
  const projects = (Array.isArray(config.work) ? config.work : []).filter((item) => item && item.title);
  const entry = (item) => el('li', {}, [
    isExternal(item.link) ? el('a', { text: item.title, attrs: { href: item.link } }) : String(item.title),
  ]);
  fill(main, [
    el('div', { className: 'nojs works-nojs' }, [
      el('h1', { className: 'nojs-name', text: `${texts.titleStart || ''} ${texts.titleEnd || ''}`.trim() }),
      el('ul', { className: 'works-nojs-list' }, projects.map(entry)),
      el('p', {}, [el('a', { className: 'works-back', text: texts.back || 'Home', attrs: { href: './' } })]),
    ]),
  ]);
  root.classList.add('boot-failed');
}

function boot() {
  const main = document.getElementById('main');
  const footer = document.getElementById('works-footer');
  const reduced = prefersReducedMotion();
  markEnvironment(reduced);
  if (!main) return;

  let lightbox = null;
  const onView = (item, button) => {
    if (lightbox) lightbox.open(item, button);
  };
  let refs;
  try {
    refs = renderWorksPage({ main, footer }, config, { onView });
  } catch (error) {
    log.error('works page render failed', error);
    try {
      showFallback(main);
    } catch (fallbackError) {
      log.error('works page fallback failed', fallbackError);
    }
    return;
  }
  if (!reduced) {
    try {
      playEntrance(refs.items);
    } catch (error) {
      log.warn('card entrance unavailable', error);
    }
  }
  try {
    lightbox = createLightbox({ size: CARD_SIZE });
  } catch (error) {
    log.warn('lightbox unavailable', error);
  }
  root.classList.add('rendered');
}

boot();
