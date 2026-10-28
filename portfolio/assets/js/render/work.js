/**
 * Renderer for "My Work": numbered boxes, screenshots or designed title cards, and a closing
 * CTA box whose button opens the All Works page (works.html) in the same tab.
 */
import { el, fill } from '../util/dom.js';
import { arrowIcon } from '../util/icons.js';
import { externalAttrs, linkAttrs } from './shared.js';
import { titleCard } from './title-card.js';

const DEFAULT_RATIO = 1.6; // used only when a work item has no width/height

/** Width / height of the screenshot from config (explicit sizes avoid layout shift). */
function imageSize(item) {
  const width = Number(item.width) || 0;
  const height = Number(item.height) || 0;
  return { width, height, ratio: width && height ? width / height : DEFAULT_RATIO };
}

function workImage(item, frame) {
  const { width, height } = imageSize(item);
  const img = el('img', {
    attrs: {
      src: item.image,
      alt: item.alt || item.title,
      width: width || null,
      height: height || null,
      loading: 'lazy',
      decoding: 'async',
    },
  });
  img.addEventListener('error', () => {
    frame.style.setProperty('--ar', String(DEFAULT_RATIO));
    img.replaceWith(titleCard(item));
  }, { once: true });
  if (!width || !height) {
    img.addEventListener('load', () => {
      if (img.naturalWidth && img.naturalHeight) frame.style.setProperty('--ar', (img.naturalWidth / img.naturalHeight).toFixed(4));
    }, { once: true });
  }
  return img;
}

function workMedia(item) {
  const ratio = item.image ? imageSize(item).ratio : DEFAULT_RATIO;
  const frame = item.link
    ? el('a', { className: 'work-image-in', attrs: { ...externalAttrs(item.link, `Visit ${item.title}`), 'data-cursor': 'disable' } }, [
      el('span', { className: 'work-link', attrs: { 'aria-hidden': 'true' } }, [arrowIcon()]),
    ])
    : el('div', { className: 'work-image-in' });
  frame.style.setProperty('--ar', ratio.toFixed(4));
  frame.appendChild(item.image ? workImage(item, frame) : titleCard(item));
  return frame;
}

function workBox(item, index) {
  const number = String(index + 1).padStart(2, '0');
  return el('article', { className: 'work-box', attrs: { 'aria-labelledby': `work-${index}-title` } }, [
    el('div', { className: 'work-info' }, [
      el('div', { className: 'work-title' }, [
        el('span', { className: 'work-num', text: number, attrs: { 'aria-hidden': 'true' } }),
        el('div', {}, [
          el('h3', { text: item.title, attrs: { id: `work-${index}-title` } }),
          item.category ? el('p', { text: item.category }) : null,
        ]),
      ]),
      item.tools ? el('h4', { text: 'Tools and features' }) : null,
      item.tools ? el('p', { text: item.tools }) : null,
    ]),
    el('div', { className: 'work-image' }, [workMedia(item)]),
  ]);
}

function moreBox(more) {
  return el('div', { className: 'work-box work-box-cta' }, [
    el('div', { className: 'see-all-works' }, [
      el('h3', { text: more.title }),
      more.text ? el('p', { text: more.text }) : null,
      more.href ? el('a', {
        className: 'see-all-btn',
        text: more.label,
        // A page of this site (works.html) opens in the same tab; another site in a new one.
        attrs: { ...linkAttrs(more.href), 'data-cursor': 'disable' },
      }) : null,
    ]),
  ]);
}

export function renderWork(section, items = [], more = null) {
  if (!section) return;
  const boxes = items.filter((item) => item && item.title).map(workBox);
  if (more && more.title) boxes.push(moreBox(more));
  fill(section, [
    el('div', { className: 'work-container section-container' }, [
      el('h2', { attrs: { id: 'work-title' } }, ['My ', el('span', { text: 'Work' })]),
      el('div', { className: 'work-flex' }, boxes),
    ]),
  ]);
}
