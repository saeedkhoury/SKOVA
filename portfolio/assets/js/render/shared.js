/** Helpers shared by the section renderers. */
import { el } from '../util/dom.js';

/** Rolling hover label: the word plus a duplicate that slides in from below. */
export function hoverLabel(text) {
  return el('span', { className: 'hover-link' }, [
    el('span', { className: 'hover-in' }, [text, el('span', { text, attrs: { 'aria-hidden': 'true' } })]),
  ]);
}

export function fullNameOf(person = {}) {
  return `${person.firstName || ''} ${person.lastName || ''}`.trim();
}

const SOCIAL = [
  { key: 'github', name: 'GitHub', icon: 'github' },
  { key: 'linkedin', name: 'LinkedIn', icon: 'linkedin' },
  { key: 'whatsapp', name: 'WhatsApp', icon: 'whatsapp' },
];

/** Social profiles present in config.person, in display order. */
export function socialLinks(person = {}) {
  return SOCIAL.filter(({ key }) => Boolean(person[key])).map((s) => ({ ...s, href: person[s.key] }));
}

/** Attributes for a link that opens in a new tab. */
export function externalAttrs(href, label) {
  return {
    href,
    target: '_blank',
    rel: 'noopener noreferrer',
    ...(label ? { 'aria-label': `${label} (opens in a new tab)` } : {}),
  };
}

/** True for an absolute http(s) address, i.e. another site. */
export function isExternal(href) {
  return /^https?:\/\//i.test(String(href || ''));
}

/**
 * Attributes for a link from config: another site opens in a new tab, anything else
 * (a page of this site such as works.html, mailto:) opens in the same tab.
 * @param {string} href
 * @param {string} [label] accessible name for a new-tab link
 * @returns {Record<string, string>}
 */
export function linkAttrs(href, label) {
  return isExternal(href) ? externalAttrs(href, label) : { href };
}
