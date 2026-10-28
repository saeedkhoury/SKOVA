/**
 * The designed title card (assets/css/title-card.css): shown where a project has no picture,
 * or where its picture fails to load, on the home page "My Work" gallery and on works.html.
 */
import { el } from '../util/dom.js';

/**
 * Title large, category small, on a lavender gradient.
 * @param {{ title: string, category?: string, alt?: string }} item a `work` entry from site.config.js
 * @param {{ decorative?: boolean }} [options] decorative: hidden from screen readers, for places
 *   where the same title and category are already written next to the card
 * @returns {HTMLElement}
 */
export function titleCard(item, { decorative = false } = {}) {
  const attrs = decorative
    ? { 'aria-hidden': 'true' }
    : { role: 'img', 'aria-label': item.alt || item.title };
  return el('div', { className: 'work-card', attrs }, [
    item.category ? el('span', { className: 'work-card-cat', text: item.category, attrs: { 'aria-hidden': 'true' } }) : null,
    el('span', { className: 'work-card-title', text: item.title, attrs: { 'aria-hidden': 'true' } }),
  ]);
}
