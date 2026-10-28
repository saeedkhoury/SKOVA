/** Renderers for What I do, Career, CTA, Contact and the footer. */
import { el, svg, fill } from '../util/dom.js';
import { arrowIcon } from '../util/icons.js';
import { externalAttrs, linkAttrs, socialLinks } from './shared.js';

const DASH = { stroke: 'white', 'stroke-width': '2' };

/** Horizontal dashed lines for a card (top and/or bottom). */
function horizontalBorders(withTop) {
  const lines = [];
  if (withTop) lines.push(svg('line', { attrs: { x1: '0', y1: '0', x2: '100%', y2: '0', 'stroke-dasharray': '6,6', ...DASH } }));
  lines.push(svg('line', { attrs: { x1: '0', y1: '100%', x2: '100%', y2: '100%', 'stroke-dasharray': '6,6', ...DASH } }));
  return svg('svg', { attrs: { height: '100%', focusable: 'false' } }, lines);
}

/** Vertical dashed lines framing both cards. */
function verticalBorders() {
  return svg('svg', { attrs: { width: '100%', focusable: 'false' } }, [
    svg('line', { attrs: { x1: '0', y1: '0', x2: '0', y2: '100%', 'stroke-dasharray': '7,7', ...DASH } }),
    svg('line', { attrs: { x1: '100%', y1: '0', x2: '100%', y2: '100%', 'stroke-dasharray': '7,7', ...DASH } }),
  ]);
}

function whatCard(item, index) {
  const id = `what-card-${index}`;
  const tools = Array.isArray(item.tools) ? item.tools : [];
  const body = el('div', { className: 'what-content-in', attrs: { id: `${id}-body` } }, [
    el('h3', { text: item.title }),
    item.subtitle ? el('p', { className: 'what-sub', text: item.subtitle }) : null,
    item.details ? el('p', { className: 'what-details', text: item.details }) : null,
    tools.length ? el('h4', { text: 'Skillset & tools' }) : null,
    tools.length ? el('ul', { className: 'what-content-flex' }, tools.map((t) => el('li', { className: 'what-tags', text: t }))) : null,
  ]);
  return el('article', { className: 'what-content what-noTouch', attrs: { id, 'aria-labelledby': `${id}-title` } }, [
    el('div', { className: 'what-border1', attrs: { 'aria-hidden': 'true' } }, [horizontalBorders(index === 0)]),
    el('div', { className: 'what-corner', attrs: { 'aria-hidden': 'true' } }),
    body,
    el('button', {
      className: 'what-arrow',
      attrs: { type: 'button', 'aria-expanded': 'false', 'aria-controls': `${id}-body`, 'data-cursor': 'disable' },
    }, [el('span', { className: 'sr-only', text: `More about ${item.title}` })]), // aria-expanded says open or closed
  ]);
}

export function renderWhatIDo(section, items = []) {
  if (!section) return;
  const cards = items.map(whatCard);
  cards.forEach((card) => {
    const heading = card.querySelector('h3');
    if (heading) heading.id = `${card.id}-title`;
  });
  fill(section, [
    el('div', { className: 'what-box' }, [
      el('h2', { className: 'title', attrs: { id: 'whatido-title' } }, [
        'W',
        el('span', { className: 'hat-h2', text: 'HAT' }),
        el('span', { className: 'what-i' }, [' I', el('span', { className: 'do-h2', text: ' DO' })]),
      ]),
    ]),
    el('div', { className: 'what-box' }, [
      el('div', { className: 'what-box-in' }, [
        el('div', { className: 'what-border2', attrs: { 'aria-hidden': 'true' } }, [verticalBorders()]),
        ...cards,
      ]),
    ]),
  ]);
}

function careerEntry(item) {
  return el('li', { className: 'career-info-box' }, [
    el('div', { className: 'career-info-in' }, [
      el('div', { className: 'career-role' }, [
        el('h3', { text: item.role }),
        item.org ? el('p', { className: 'career-org', text: item.org }) : null,
      ]),
      item.when ? el('p', { className: 'career-when', text: item.when }) : null,
    ]),
    item.text ? el('p', { text: item.text }) : null,
  ]);
}

export function renderCareer(section, career) {
  if (!section || !career) return;
  const items = Array.isArray(career.items) ? career.items : [];
  fill(section, [
    el('div', { className: 'career-container' }, [
      el('h2', { attrs: { id: 'career-title' } }, [
        `${career.titleStart} `,
        el('span', { text: '&' }),
        el('br'),
        ` ${career.titleEnd}`,
      ]),
      el('div', { className: 'career-info' }, [
        el('div', { className: 'career-timeline', attrs: { 'aria-hidden': 'true' } }, [el('div', { className: 'career-dot' })]),
        el('ol', { className: 'career-list' }, items.map(careerEntry)),
      ]),
    ]),
  ]);
}

export function renderCta(section, cta) {
  if (!section || !cta || !cta.href) return;
  const attrs = linkAttrs(cta.href);
  fill(section, [
    el('div', { className: 'cta-buttons' }, [
      el('a', { className: 'cta-btn cta-btn-hire', text: cta.label, attrs: { ...attrs, 'data-cursor': 'disable' } }),
    ]),
  ]);
}

function contactLink(label, href) {
  return el('a', { className: 'contact-social', attrs: { ...externalAttrs(href), 'data-cursor': 'disable' } }, [
    label,
    arrowIcon(),
    el('span', { className: 'sr-only', text: ' (opens in a new tab)' }),
  ]);
}

export function renderContact(section, config, fullName, brandName = '') {
  if (!section) return;
  const person = config.person || {};
  const contact = config.contact || {};
  const links = socialLinks(person).map(({ name, href }) => contactLink(name, href));
  if (person.cv) links.push(contactLink('CV', person.cv));
  fill(section, [
    el('div', { className: 'contact-container' }, [
      el('h2', { text: fullName, attrs: { id: 'contact-title' } }),
      contact.note ? el('p', { className: 'contact-note', text: contact.note }) : null,
      el('div', { className: 'contact-flex' }, [
        el('div', { className: 'contact-box' }, [
          el('h3', { text: 'Email' }),
          el('p', {}, [el('a', { text: person.email, attrs: { href: `mailto:${person.email}`, 'data-cursor': 'disable' } })]),
          el('h3', { text: 'Location' }),
          el('p', { text: person.location }),
        ]),
        el('div', { className: 'contact-box' }, [
          el('h3', { text: 'Social' }),
          el('div', { className: 'contact-social-list' }, links),
        ]),
        el('div', { className: 'contact-box contact-credit' }, [
          el('p', { className: 'credit' }, [`${contact.credit || ''} `, el('span', { text: fullName })]),
          el('p', { className: 'credit-year', text: `© ${new Date().getFullYear()} ${brandName}`.trim() }),
          contact.builtWith ? el('p', { className: 'credit-built', text: contact.builtWith }) : null,
        ]),
      ]),
    ]),
  ]);
}

export function renderFooter(footer) {
  if (!footer) return;
  fill(footer, [
    el('a', { className: 'back-to-top', attrs: { href: '#home', 'data-nav': '', 'data-cursor': 'disable' } }, ['Back to top', arrowIcon()]),
  ]);
}
