/**
 * The SKOVA brand slots (config.brand): the header logo, the loading screen title, the
 * og:site_name tag and the name used in the footer credit. The person's name stays wherever
 * it means the person (hero, contact, author).
 */
import { el, fill } from '../util/dom.js';

/**
 * @param {{ name?: string, mark?: string, markOnLight?: string } | null | undefined} brand
 * @param {string} fallbackName used when no brand name is configured
 * @returns {{ name: string, mark: string, markOnLight: string }}
 */
export function brandOf(brand, fallbackName = '') {
  const source = brand && typeof brand === 'object' ? brand : {};
  return {
    name: String(source.name || fallbackName).trim(),
    mark: typeof source.mark === 'string' ? source.mark : '',
    markOnLight: typeof source.markOnLight === 'string' ? source.markOnLight : '',
  };
}

/** The S mark. Decorative: the brand name next to it is the text. */
function markImage(src) {
  return el('img', {
    className: 'brand-mark',
    attrs: { src, alt: '', decoding: 'async', draggable: 'false' },
  });
}

/** Mark + name. */
function lockup(name, markSrc) {
  return [markSrc ? markImage(markSrc) : null, el('span', { className: 'brand-name', text: name })];
}

/** The header logo: links back to the top of the page (motion/nav.js handles [data-nav]). */
export function brandHomeLink(brand) {
  return el('a', {
    className: 'navbar-title brand-lockup',
    attrs: { href: '#home', 'data-nav': '', 'data-cursor': 'disable', 'aria-label': `${brand.name}, back to top` },
  }, lockup(brand.name, brand.mark));
}

/**
 * The loading screen title is already in index.html (it shows before any script runs).
 * Update it in place from the config, so a matching config causes no flash.
 */
export function syncLoaderBrand(node, brand) {
  if (!node || !brand.name) return;
  const name = node.querySelector('.brand-name');
  const mark = node.querySelector('.brand-mark');
  if (!name) {
    fill(node, lockup(brand.name, brand.markOnLight));
    return;
  }
  if (name.textContent !== brand.name) name.textContent = brand.name;
  if (mark && !brand.markOnLight) mark.remove();
  else if (mark && mark.getAttribute('src') !== brand.markOnLight) mark.setAttribute('src', brand.markOnLight);
  else if (!mark && brand.markOnLight) node.insertBefore(markImage(brand.markOnLight), name);
}
