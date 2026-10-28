/**
 * Custom cursor (reference): a 50px glowing circle that follows the pointer with
 * lerp 1/6 per frame. [data-cursor="disable"] shrinks it to 0, [data-cursor="icons"]
 * turns it into a pill over the social column. Fine pointers >= 600px only, never
 * with reduced motion.
 */
import { el } from '../util/dom.js';

const LERP = 1 / 6;

export function createCursor(env) {
  if (env.reduced || !env.fine || !env.cursor) return { destroy() {} };
  const node = el('div', { className: 'cursor-main', attrs: { 'aria-hidden': 'true' } });
  document.body.appendChild(node);
  const target = { x: 0, y: 0 };
  const pos = { x: 0, y: 0 };
  let locked = false;
  let shown = false;
  let raf = 0;

  const place = (x, y) => { node.style.transform = `translate3d(${x}px, ${y}px, 0)`; };
  const loop = () => {
    if (!locked) {
      pos.x += (target.x - pos.x) * LERP;
      pos.y += (target.y - pos.y) * LERP;
      place(pos.x, pos.y);
    }
    raf = window.requestAnimationFrame(loop);
  };
  const onMove = (event) => {
    target.x = event.clientX;
    target.y = event.clientY;
    if (shown) return;
    shown = true;
    pos.x = target.x;
    pos.y = target.y;
    node.classList.add('is-visible');
  };
  const onOver = (event) => {
    const host = event.target.closest && event.target.closest('[data-cursor]');
    if (!host) return;
    if (host.dataset.cursor === 'icons') {
      const rect = host.getBoundingClientRect();
      node.classList.add('cursor-icons');
      node.style.setProperty('--cursorH', `${rect.height}px`);
      place(rect.left, rect.top);
      locked = true;
    } else if (host.dataset.cursor === 'disable') {
      node.classList.add('cursor-disable');
    }
  };
  const onOut = (event) => {
    const host = event.target.closest && event.target.closest('[data-cursor]');
    if (!host || (event.relatedTarget && host.contains(event.relatedTarget))) return;
    node.classList.remove('cursor-disable', 'cursor-icons');
    locked = false;
  };
  const onLeave = () => { shown = false; node.classList.remove('is-visible'); };

  document.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('mouseover', onOver);
  document.addEventListener('mouseout', onOut);
  document.documentElement.addEventListener('mouseleave', onLeave);
  raf = window.requestAnimationFrame(loop);

  return {
    destroy() {
      window.cancelAnimationFrame(raf);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      node.remove();
    },
  };
}
