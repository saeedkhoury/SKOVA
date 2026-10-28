/**
 * Magnetic social icons (reference): while the pointer is inside an icon's 50px cell
 * the icon eases toward it (factor .1 per frame), otherwise back to the centre.
 * Only where the column is shown (>= 900px), fine pointers, motion allowed.
 */
const EASE = 0.1;
const SETTLE = 0.05;
const MIN_WIDTH = 900;
const ZONE = { minX: 10, maxX: 40, minY: 5, maxY: 40 };

export function createSocial(env) {
  const cells = Array.from(document.querySelectorAll('#social .social-cell'));
  if (env.reduced || !env.fine || env.width < MIN_WIDTH || !cells.length) return { destroy() {} };
  const items = cells.map((cell) => ({ cell, link: cell.querySelector('a'), rect: null, tx: 0, ty: 0, x: 0, y: 0 }));
  let raf = 0;

  const measure = () => items.forEach((item) => {
    item.rect = item.cell.getBoundingClientRect();
    item.tx = item.rect.width / 2;
    item.ty = item.rect.height / 2;
    if (!item.x) { item.x = item.tx; item.y = item.ty; }
  });

  const step = () => {
    let moving = false;
    items.forEach((item) => {
      item.x += (item.tx - item.x) * EASE;
      item.y += (item.ty - item.y) * EASE;
      if (Math.abs(item.tx - item.x) > SETTLE || Math.abs(item.ty - item.y) > SETTLE) moving = true;
      if (item.link) {
        item.link.style.setProperty('--siLeft', `${item.x}px`);
        item.link.style.setProperty('--siTop', `${item.y}px`);
      }
    });
    raf = moving ? window.requestAnimationFrame(step) : 0;
  };
  const kick = () => { if (!raf) raf = window.requestAnimationFrame(step); };

  const onMove = (event) => {
    items.forEach((item) => {
      if (!item.rect) return;
      const dx = event.clientX - item.rect.left;
      const dy = event.clientY - item.rect.top;
      const inside = dx > ZONE.minX && dx < ZONE.maxX && dy > ZONE.minY && dy < ZONE.maxY;
      item.tx = inside ? dx : item.rect.width / 2;
      item.ty = inside ? dy : item.rect.height / 2;
    });
    kick();
  };

  measure();
  document.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('resize', measure);

  return {
    destroy() {
      window.cancelAnimationFrame(raf);
      document.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', measure);
      items.forEach(({ link }) => {
        if (!link) return;
        link.style.removeProperty('--siLeft');
        link.style.removeProperty('--siTop');
      });
    },
  };
}
