/** Renderer for the Tech Stack section: background video, title, pyramid of tiles. */
import { el, fill } from '../util/dom.js';
import { externalAttrs } from './shared.js';

/** Two-letter monogram used when a tile has no icon (or the icon fails to load). */
export function monogramText(name = '') {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
  const word = words[0] || '?';
  return word.length <= 3 ? word : word.slice(0, 2);
}

function monogram(name) {
  return el('span', { className: 'techstack-mono', text: monogramText(name), attrs: { 'aria-hidden': 'true' } });
}

function tile(item) {
  let icon = monogram(item.name);
  if (item.icon) {
    icon = el('img', { attrs: { src: item.icon, alt: '', width: 30, height: 30, loading: 'lazy', decoding: 'async' } });
    icon.addEventListener('error', () => icon.replaceWith(monogram(item.name)), { once: true });
  }
  const children = [icon, el('span', { className: 'techstack-name', text: item.name })];
  if (!item.url) return el('span', { className: 'techstack-item' }, children);
  return el('a', {
    className: 'techstack-item',
    attrs: { ...externalAttrs(item.url, item.name), title: item.name, 'data-cursor': 'disable' },
  }, children);
}

function techVideo(video) {
  const node = el('video', {
    className: 'techstack-video',
    attrs: {
      muted: true,
      loop: true,
      playsinline: true,
      preload: 'none',
      poster: video.poster || null,
      disablepictureinpicture: true,
      disableremoteplayback: true,
      tabindex: '-1',
    },
  });
  node.muted = true; // the property (not just the attribute) is what autoplay policies check
  if (video.webm) node.appendChild(el('source', { attrs: { src: video.webm, type: 'video/webm' } }));
  if (video.mp4) node.appendChild(el('source', { attrs: { src: video.mp4, type: 'video/mp4' } }));
  return node;
}

export function renderTech(section, tech) {
  if (!section || !tech) return;
  const rows = Array.isArray(tech.rows) ? tech.rows : [];
  const container = el('div', { className: 'techstack-video-container', attrs: { 'aria-hidden': 'true' } }, [
    tech.video ? techVideo(tech.video) : null,
    el('div', { className: 'techstack-overlay' }),
  ]);
  if (tech.video && tech.video.poster) container.style.backgroundImage = `url("${encodeURI(tech.video.poster)}")`;
  fill(section, [
    container,
    el('div', { className: 'techstack-content' }, [
      el('h2', { text: tech.title, attrs: { id: 'tech-title' } }),
      el('div', { className: 'techstack-pyramid' }, rows.map((row, r) => el('ul', { className: 'techstack-row' },
        row.filter((item) => item && item.name).map((item) => el('li', { dataset: { row: r } }, [tile(item)]))))),
    ]),
  ]);
}
