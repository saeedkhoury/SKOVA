/**
 * render(config): builds every section of the page from site.config.js.
 * All config text goes through textContent / text nodes (see util/dom.js).
 * Each section renders independently, so one bad entry cannot blank the page.
 */
import { el, fill, splitChars } from './util/dom.js';
import { brandIcon, documentIcon } from './util/icons.js';
import { log } from './util/log.js';
import { renderWhatIDo, renderCareer, renderCta, renderContact, renderFooter } from './render/sections.js';
import { renderWork } from './render/work.js';
import { renderTech } from './render/tech.js';
import { hoverLabel, fullNameOf, socialLinks } from './render/shared.js';
import { brandOf, brandHomeLink, syncLoaderBrand } from './render/brand.js';

const NAV = [
  { label: 'About', href: '#about' },
  { label: 'Work', href: '#work' },
  { label: 'Contact', href: '#contact' },
];

const $ = (selector) => document.querySelector(selector);

/** Run one section renderer; log and continue on failure. */
function safely(name, fn) {
  try {
    return fn();
  } catch (error) {
    log.error(`render ${name} failed`, error);
    return null;
  }
}

function setMeta(selector, value) {
  const node = document.head.querySelector(selector);
  if (node && value) node.setAttribute('content', value);
}

function applyMeta(meta = {}, brand = {}) {
  if (meta.title) document.title = meta.title;
  setMeta('meta[property="og:site_name"]', brand.name);
  setMeta('meta[name="application-name"]', brand.name);
  setMeta('meta[name="apple-mobile-web-app-title"]', brand.name);
  setMeta('meta[name="description"]', meta.description);
  setMeta('meta[name="theme-color"]', meta.themeColor);
  setMeta('meta[property="og:title"]', meta.title);
  setMeta('meta[property="og:description"]', meta.description);
  if (!meta.url) return;
  try {
    const base = new URL(meta.url);
    setMeta('meta[property="og:url"]', base.href);
    setMeta('meta[property="og:image"]', new URL('assets/img/og.jpg', base).href);
  } catch (error) {
    log.warn('meta.url is not a valid URL', error);
  }
}

function renderHeader(person, brand) {
  const header = $('#site-header');
  if (!header) return;
  const links = NAV.map(({ label, href }) => el('li', {}, [
    el('a', { attrs: { href, 'data-nav': '', 'data-cursor': 'disable' } }, [hoverLabel(label)]),
  ]));
  fill(header, [
    brandHomeLink(brand),
    person.email && el('a', {
      className: 'navbar-connect',
      text: person.email,
      attrs: { href: `mailto:${person.email}`, 'data-cursor': 'disable' },
    }),
    el('nav', { attrs: { 'aria-label': 'Main' } }, [el('ul', {}, links)]),
  ]);
}

function renderChrome(person) {
  const holder = $('#icons-section');
  if (!holder) return;
  const cells = socialLinks(person).map(({ name, icon, href }) => el('span', { className: 'social-cell' }, [
    el('a', {
      attrs: { href, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `${name} (opens in a new tab)` },
    }, [brandIcon(icon)]),
  ]));
  fill(holder, [
    el('div', { className: 'social-icons', attrs: { id: 'social', 'data-cursor': 'icons', role: 'group', 'aria-label': 'Social links' } }, cells),
    person.cv && el('a', {
      className: 'resume-button',
      attrs: {
        href: person.cv,
        target: '_blank',
        rel: 'noopener',
        'data-cursor': 'disable',
        'aria-label': 'Resume, PDF (opens in a new tab)',
      },
    }, [hoverLabel('RESUME'), el('span', { className: 'resume-icon' }, [documentIcon()])]),
  ]);
}

/** One clipped line of the role roll; every role contributes one stacked word. */
function roleLine(className, words) {
  const children = words.map((word, index) => {
    const span = el('span', { className: index === 0 ? 'role-word is-first' : 'role-word', dataset: { role: index } });
    if (word) span.appendChild(splitChars(word));
    return span;
  });
  return el('div', { className: `role-line ${className}` }, children);
}

/** The static image for the configured mode: the avatar stills (glb, character), else the photo. */
function stillFor(avatar) {
  const character = avatar.character || {};
  if ((avatar.mode === 'glb' || avatar.mode === 'character') && character.still) {
    return { mode: 'character', src: character.still, mobile: character.mobile || character.still, alt: character.alt };
  }
  const portrait = avatar.portrait || {};
  return { mode: 'portrait', src: portrait.image, mobile: portrait.mobile || portrait.image, alt: portrait.alt };
}

function renderAvatarLayer(avatar = {}) {
  const still = stillFor(avatar);
  const img = el('img', {
    className: 'avatar-fallback',
    attrs: { alt: still.alt || '', decoding: 'async', draggable: 'false' },
    dataset: { src: still.src || '', srcMobile: still.mobile || '' },
  });
  const layer = el('div', { className: 'avatar-layer', attrs: { id: 'avatar-layer' }, dataset: { avatarMode: still.mode } }, [
    el('div', { className: 'character-rim', attrs: { 'aria-hidden': 'true' } }),
    // The face hotspot: hovering this circle tilts the avatar's head (avatar/character/track.js).
    el('div', { className: 'character-hover', attrs: { 'aria-hidden': 'true' } }),
    img,
  ]);
  return { layer, img };
}

function renderHero(config, fullName) {
  const section = $('#home');
  const avatar = renderAvatarLayer(config.avatar);
  if (!section) return { avatarLayer: avatar.layer, fallbackImg: avatar.img };
  const roles = (config.hero.roles || []).filter((r) => r && (r.accent || r.rest));
  const spoken = roles.map((r) => [r.article, r.accent, r.rest].filter(Boolean).join(' ')).join(', ');
  const intro = el('div', { className: 'landing-intro' }, [
    el('p', { className: 'landing-greeting', text: config.hero.greeting }),
    el('h1', { className: 'landing-name', text: fullName, attrs: { id: 'hero-name' } }),
  ]);
  const info = el('div', { className: 'landing-info' }, [
    el('p', { className: 'sr-only', text: spoken }),
    el('div', { className: 'role-roll', attrs: { 'aria-hidden': 'true' } }, [
      roleLine('role-article', roles.map((r) => r.article)),
      roleLine('role-accent', roles.map((r) => r.accent)),
      roleLine('role-rest', roles.map((r) => r.rest)),
    ]),
  ]);
  fill(section, [el('div', { className: 'landing-container' }, [intro, info]), avatar.layer]);
  return { avatarLayer: avatar.layer, fallbackImg: avatar.img };
}

function renderAbout(about) {
  const section = $('#about');
  if (!section || !about) return;
  fill(section, [
    el('div', { className: 'about-me' }, [
      el('h2', { className: 'title', text: about.title, attrs: { id: 'about-title' } }),
      el('p', { className: 'para', text: about.text }),
    ]),
  ]);
}

/**
 * Build the whole page.
 * @param {object} config site.config.js default export
 * @returns {{ avatarLayer: HTMLElement, fallbackImg: HTMLImageElement }}
 */
export function render(config) {
  const person = config.person || {};
  const fullName = fullNameOf(person);
  const brand = brandOf(config.brand, person.initials || fullName);
  safely('meta', () => applyMeta(config.meta, brand));
  safely('loader', () => syncLoaderBrand($('#loader-name'), brand));
  safely('header', () => renderHeader(person, brand));
  safely('chrome', () => renderChrome(person));
  const hero = safely('hero', () => renderHero(config, fullName)) || renderAvatarLayer(config.avatar);
  safely('about', () => renderAbout(config.about));
  safely('whatido', () => renderWhatIDo($('#what-i-do'), config.whatIDo));
  safely('career', () => renderCareer($('#career'), config.career));
  safely('work', () => renderWork($('#work'), config.work, config.moreWork));
  safely('tech', () => renderTech($('#tech'), config.tech));
  safely('cta', () => renderCta($('#cta'), config.cta));
  safely('contact', () => renderContact($('#contact'), config, fullName, brand.name));
  safely('footer', () => renderFooter($('#site-footer')));
  document.documentElement.classList.add('rendered');
  return {
    avatarLayer: hero.avatarLayer || hero.layer,
    fallbackImg: hero.fallbackImg || hero.img,
  };
}
