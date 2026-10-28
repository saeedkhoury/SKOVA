/**
 * Tech stack: background video plays only while visible (preload none until near the
 * viewport, poster only for reduced motion, failures keep the dark overlay look), and the
 * tile pyramid regroups into narrower rows when a configured row does not fit (phones).
 * The video fills an absolutely positioned box (object-fit: cover), so its metadata never
 * changes the layout and needs no ScrollTrigger refresh.
 */
import { el, debounce } from '../util/dom.js';
import { log } from '../util/log.js';

const NEAR_MARGIN = '600px 0px';
const VISIBLE_THRESHOLD = 0.1;
const MIN_BOTTOM_ROW = 3;
const REGROUP_DEBOUNCE_MS = 150;

function watchVideo(video, env) {
  if (!video) return () => {};
  const sources = Array.from(video.querySelectorAll('source'));
  let failed = 0;
  const fail = () => video.classList.add('is-failed');
  const onSourceError = () => { failed += 1; if (failed >= sources.length) fail(); };
  sources.forEach((s) => s.addEventListener('error', onSourceError));
  video.addEventListener('error', fail);
  const unbind = () => {
    sources.forEach((s) => s.removeEventListener('error', onSourceError));
    video.removeEventListener('error', fail);
  };
  if (env.reduced || !('IntersectionObserver' in window)) {
    video.pause();
    return unbind;
  }
  let visible = false;
  const play = () => {
    if (!visible || document.hidden) return;
    const attempt = video.play();
    if (attempt && attempt.catch) attempt.catch((error) => log.info('video play blocked', error));
  };
  const near = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    near.disconnect();
    video.preload = 'auto';
  }, { rootMargin: NEAR_MARGIN });
  const seen = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible) play(); else video.pause();
  }, { threshold: VISIBLE_THRESHOLD });
  const onVisibility = () => (document.hidden ? video.pause() : play());
  near.observe(video);
  seen.observe(video);
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    near.disconnect();
    seen.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    unbind();
    video.pause();
  };
}

/** Row sizes for n tiles, widest first, at most perRow per row, tapering to the bottom. */
export function pyramidSizes(n, perRow) {
  if (n <= perRow) return [n];
  const bottomUp = [];
  let size = Math.min(MIN_BOTTOM_ROW, perRow);
  let total = 0;
  while (total + size <= n) {
    bottomUp.push(size);
    total += size;
    size = Math.min(size + 1, perRow);
  }
  let rest = n - total;
  for (let i = 0; rest > 0 && i < bottomUp.length; i += 1) {
    const cap = i + 1 < bottomUp.length ? bottomUp[i + 1] : perRow;
    while (rest > 0 && bottomUp[i] < cap) { bottomUp[i] += 1; rest -= 1; }
  }
  if (rest > 0) bottomUp.unshift(rest);
  return bottomUp.reverse();
}

function layoutRows(pyramid, items) {
  const firstRow = pyramid.querySelector('.techstack-row');
  const sample = items[0] && items[0].firstElementChild;
  if (!firstRow || !sample) return null;
  const gap = parseFloat(window.getComputedStyle(firstRow).columnGap) || 0;
  const tile = sample.getBoundingClientRect().width;
  const perRow = Math.max(1, Math.floor((pyramid.clientWidth + gap) / (tile + gap)));
  const original = [];
  items.forEach((li) => {
    const r = Number(li.dataset.row) || 0;
    (original[r] = original[r] || []).push(li);
  });
  const groups = original.filter(Boolean);
  if (groups.every((g) => g.length <= perRow)) return groups;
  let start = 0;
  return pyramidSizes(items.length, perRow).map((count) => {
    const row = items.slice(start, start + count);
    start += count;
    return row;
  });
}

function regroup(pyramid) {
  const items = Array.from(pyramid.querySelectorAll('li'));
  const rows = layoutRows(pyramid, items);
  if (!rows) return;
  const current = Array.from(pyramid.children).map((ul) => ul.children.length).join(',');
  if (current === rows.map((r) => r.length).join(',')) return;
  pyramid.replaceChildren(...rows.map((row) => el('ul', { className: 'techstack-row' }, row)));
}

export function createTech(env) {
  const section = document.querySelector('.techstack-new');
  if (!section) return { destroy() {} };
  const stopVideo = watchVideo(section.querySelector('video'), env);
  const pyramid = section.querySelector('.techstack-pyramid');
  const onResize = debounce(() => { if (pyramid) regroup(pyramid); }, REGROUP_DEBOUNCE_MS);
  if (pyramid) regroup(pyramid);
  window.addEventListener('resize', onResize);
  return {
    destroy() {
      stopVideo();
      onResize.cancel();
      window.removeEventListener('resize', onResize);
    },
  };
}
