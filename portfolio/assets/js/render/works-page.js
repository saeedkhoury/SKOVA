/**
 * Renderer for the All Works page (works.html): the header, one numbered card per project in
 * site.config.js `work` (picture, title, category, summary, stack, link) and a small footer.
 * The page texts come from `worksPage`. All config text goes in through text nodes
 * (util/dom.js). A picture that is missing or fails to load becomes a designed title card,
 * so the page never shows a broken image.
 */
import { el, fill } from '../util/dom.js';
import { arrowIcon, searchIcon } from '../util/icons.js';
import { externalAttrs, fullNameOf, isExternal } from './shared.js';
import { brandOf } from './brand.js';
import { titleCard } from './title-card.js';

/** Pixel size of every All Works picture (`work[].card`); reserves its box before it loads. */
export const CARD_SIZE = Object.freeze({ width: 1600, height: 816 });

const HOME_HREF = './';
/** Columns per viewport width, as in works.css. Pictures in the first row load at once, the rest lazily. */
const COLUMNS = Object.freeze([{ minWidth: 1081, count: 3 }, { minWidth: 641, count: 2 }]);
/** Links to these hosts are code, not a live site ("View code" instead of "Visit site"). */
const CODE_HOSTS = new Set(['github.com', 'www.github.com']);
/** Used only for keys missing from config.worksPage. */
const DEFAULT_TEXTS = Object.freeze({
  back: 'Back to Home',
  titleStart: 'All',
  titleEnd: 'Works',
  text: '',
  view: 'Click to View',
  visit: 'Visit site',
  code: 'View code',
});

function firstRowCount() {
  const width = window.innerWidth || document.documentElement.clientWidth || 0;
  const match = COLUMNS.find(({ minWidth }) => width >= minWidth);
  return match ? match.count : 1;
}

function isCodeLink(href) {
  try {
    return CODE_HOSTS.has(new URL(href).hostname);
  } catch {
    return false;
  }
}

function header(texts) {
  return el('header', { className: 'works-header' }, [
    el('a', { className: 'works-back', attrs: { href: HOME_HREF } }, [
      el('span', { className: 'works-back-arrow', text: '←', attrs: { 'aria-hidden': 'true' } }),
      texts.back,
    ]),
    el('h1', { attrs: { id: 'works-title' } }, [`${texts.titleStart} `, el('span', { text: texts.titleEnd })]),
    texts.text ? el('p', { className: 'works-intro', text: texts.text }) : null,
  ]);
}

/** The picture failed: show the title card instead, and keep keyboard focus inside the card. */
function swapForTitleCard(button, item) {
  const hadFocus = document.activeElement === button;
  const card = button.closest('.works-card');
  button.replaceWith(titleCard(item, { decorative: true }));
  if (!hadFocus || !card) return;
  const heading = card.querySelector('h2');
  const next = card.querySelector('.works-visit') || heading;
  if (next === heading && heading) heading.setAttribute('tabindex', '-1');
  if (next) next.focus({ preventScroll: true });
}

function picture(item, index, ctx) {
  if (!item.card) return titleCard(item, { decorative: true });
  const img = el('img', {
    attrs: {
      src: item.card,
      alt: '', // the button around it carries the name
      width: CARD_SIZE.width,
      height: CARD_SIZE.height,
      loading: index < ctx.eager ? 'eager' : 'lazy',
      decoding: 'async',
    },
  });
  const button = el('button', {
    className: 'works-shot',
    attrs: { type: 'button', 'aria-label': `View a larger picture of ${item.title}`, 'aria-haspopup': 'dialog' },
  }, [
    img,
    el('span', { className: 'works-overlay', attrs: { 'aria-hidden': 'true' } }, [
      el('span', { className: 'works-view' }, [searchIcon(), ctx.texts.view]),
    ]),
  ]);
  img.addEventListener('error', () => swapForTitleCard(button, item), { once: true });
  button.addEventListener('click', () => ctx.onView(item, button));
  return button;
}

function visitLink(item, texts) {
  if (!isExternal(item.link)) return null;
  return el('a', { className: 'works-visit', attrs: externalAttrs(item.link) }, [
    isCodeLink(item.link) ? texts.code : texts.visit,
    el('span', { className: 'sr-only', text: ` (${item.title}, opens in a new tab)` }),
    arrowIcon(),
  ]);
}

function workCard(item, index, ctx) {
  const titleId = `works-${index}-title`;
  const summary = item.summary || item.tools;
  return el('li', { className: 'works-item' }, [
    el('article', { className: 'works-card', attrs: { 'aria-labelledby': titleId } }, [
      el('div', { className: 'works-media' }, [
        picture(item, index, ctx),
        el('span', { className: 'works-num', text: String(index + 1).padStart(2, '0'), attrs: { 'aria-hidden': 'true' } }),
      ]),
      el('div', { className: 'works-body' }, [
        el('h2', { className: 'works-name', text: item.title, attrs: { id: titleId } }),
        item.category ? el('p', { className: 'works-cat', text: item.category }) : null,
        summary ? el('p', { className: 'works-summary', text: summary }) : null,
        item.stack ? el('p', { className: 'works-stack', text: item.stack }) : null,
        visitLink(item, ctx.texts),
      ]),
    ]),
  ]);
}

function renderFooter(footer, config, brandName, fullName) {
  if (!footer) return;
  const credit = (config.contact && config.contact.credit) || '';
  fill(footer, [
    el('p', { className: 'works-footer-year', text: `© ${new Date().getFullYear()} ${brandName}`.trim() }),
    credit && fullName ? el('p', { className: 'works-footer-credit' }, [`${credit} `, el('span', { text: fullName })]) : null,
  ]);
}

/**
 * Build the All Works page.
 * @param {{ main: HTMLElement, footer?: HTMLElement | null }} slots
 * @param {object} config site.config.js default export
 * @param {{ onView?: (item: object, button: HTMLButtonElement) => void }} [options]
 *   onView: a picture button was pressed (opens the lightbox)
 * @returns {{ items: HTMLLIElement[] }} the card list items, in order
 */
export function renderWorksPage({ main, footer = null }, config, { onView = () => {} } = {}) {
  const texts = { ...DEFAULT_TEXTS, ...(config.worksPage || {}) };
  const person = config.person || {};
  const fullName = fullNameOf(person);
  const brand = brandOf(config.brand, person.initials || fullName);
  const projects = (Array.isArray(config.work) ? config.work : []).filter((item) => item && item.title);
  const ctx = { texts, onView, eager: firstRowCount() };
  const items = projects.map((item, index) => workCard(item, index, ctx));
  document.title = [`${texts.titleStart} ${texts.titleEnd}`.trim(), brand.name].filter(Boolean).join(' · ');
  fill(main, [
    header(texts),
    el('ol', { className: 'works-grid', attrs: { role: 'list', 'aria-labelledby': 'works-title' } }, items),
  ]);
  renderFooter(footer, config, brand.name, fullName);
  return { items };
}
