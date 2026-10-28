/**
 * The All Works picture lightbox: one <dialog> opened with showModal(), so the page behind is
 * inert and Esc closes it. The close button and a click anywhere around the picture close it
 * too; focus then goes back to the picture button that opened it, and the page does not
 * scroll while it is open (works.css, html.has-lightbox).
 */
import { el } from '../util/dom.js';
import { closeIcon } from '../util/icons.js';
import { log } from '../util/log.js';

const OPEN_CLASS = 'has-lightbox';
const TITLE_ID = 'lightbox-title';

function supportsDialog() {
  return typeof window.HTMLDialogElement === 'function'
    && typeof window.HTMLDialogElement.prototype.showModal === 'function';
}

/** Without <dialog> support (very old browsers): show the picture on its own in a new tab. */
const NEW_TAB_VIEWER = Object.freeze({
  open(item) {
    if (item && item.card) window.open(item.card, '_blank', 'noopener');
  },
  destroy() {},
});

function buildDialog(closeLabel, size) {
  const title = el('h2', { className: 'sr-only', attrs: { id: TITLE_ID } });
  const img = el('img', { className: 'lightbox-img', attrs: { alt: '', width: size.width, height: size.height, decoding: 'async' } });
  const close = el('button', { className: 'lightbox-close', attrs: { type: 'button', 'aria-label': closeLabel } }, [closeIcon()]);
  const dialog = el('dialog', { className: 'lightbox', attrs: { 'aria-labelledby': TITLE_ID } }, [
    title,
    close,
    el('div', { className: 'lightbox-stage' }, [img]),
  ]);
  return { dialog, title, img, close };
}

/**
 * @param {{ size: { width: number, height: number }, closeLabel?: string }} options
 *   size: the pixel size of the pictures (reserves the box while the picture decodes)
 * @returns {{ open(item: { title: string, card: string }, opener?: HTMLElement): void, destroy(): void }}
 */
export function createLightbox({ size, closeLabel = 'Close' }) {
  if (!supportsDialog()) return NEW_TAB_VIEWER;
  const root = document.documentElement;
  const { dialog, title, img, close } = buildDialog(closeLabel, size);
  let opener = null;

  const onClose = () => {
    root.classList.remove(OPEN_CLASS);
    const target = opener;
    opener = null;
    if (target && target.isConnected) target.focus({ preventScroll: true });
  };
  // A click on the dark area (anything but the picture itself) closes the lightbox.
  const onClick = (event) => {
    if (event.target !== img) dialog.close();
  };
  dialog.addEventListener('close', onClose);
  dialog.addEventListener('click', onClick);
  close.addEventListener('click', () => dialog.close());
  document.body.appendChild(dialog);

  return {
    open(item, button = null) {
      if (!item || !item.card || dialog.open) return;
      opener = button;
      title.textContent = item.title;
      img.setAttribute('alt', `Screens from ${item.title}`);
      img.setAttribute('src', item.card);
      root.classList.add(OPEN_CLASS);
      try {
        dialog.showModal();
      } catch (error) {
        log.warn('lightbox could not open', error);
        root.classList.remove(OPEN_CLASS);
        opener = null;
      }
    },
    destroy() {
      if (dialog.open) dialog.close();
      dialog.removeEventListener('close', onClose);
      dialog.removeEventListener('click', onClick);
      dialog.remove();
    },
  };
}
