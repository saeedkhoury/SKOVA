/**
 * Inline SVG icons built from static path data (no config strings involved).
 * GitHub and WhatsApp: simple-icons 16.32.0 (CC0). LinkedIn: devicon 2.17.0 linkedin-plain (MIT).
 * Arrow, document, magnifier and close glyphs are drawn here.
 */
import { svg } from './dom.js';

const PATHS = {
  github: {
    viewBox: '0 0 24 24',
    d: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
  },
  linkedin: {
    viewBox: '0 0 128 128',
    d: 'M116 3H12a8.91 8.91 0 00-9 8.8v104.42a8.91 8.91 0 009 8.78h104a8.93 8.93 0 009-8.81V11.77A8.93 8.93 0 00116 3zM39.17 107H21.06V48.73h18.11zm-9-66.21a10.5 10.5 0 1110.49-10.5 10.5 10.5 0 01-10.54 10.48zM107 107H88.89V78.65c0-6.75-.12-15.44-9.41-15.44s-10.87 7.36-10.87 15V107H50.53V48.73h17.36v8h.24c2.42-4.58 8.32-9.41 17.13-9.41C103.6 47.28 107 59.35 107 75z',
  },
  whatsapp: {
    viewBox: '0 0 24 24',
    d: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z',
  },
};

/** Filled brand icon. */
export function brandIcon(name) {
  const def = PATHS[name];
  if (!def) return null;
  return svg('svg', { attrs: { viewBox: def.viewBox, 'aria-hidden': 'true', focusable: 'false' } }, [
    svg('path', { attrs: { d: def.d, fill: 'currentColor' } }),
  ]);
}

const STROKE = { fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

/** Arrow pointing up and to the right (outbound link). */
export function arrowIcon() {
  return svg('svg', { attrs: { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' } }, [
    svg('path', { attrs: { d: 'M7 17 17 7M9 7h8v8', ...STROKE } }),
  ]);
}

/** A page with text lines (resume). */
export function documentIcon() {
  return svg('svg', { attrs: { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' } }, [
    svg('rect', { attrs: { x: '5', y: '3', width: '14', height: '18', rx: '2', ...STROKE } }),
    svg('path', { attrs: { d: 'M9 7h6M9 11h6M9 15h4', ...STROKE } }),
  ]);
}

/** A magnifier (open a picture larger). */
export function searchIcon() {
  return svg('svg', { attrs: { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' } }, [
    svg('circle', { attrs: { cx: '11', cy: '11', r: '7', ...STROKE } }),
    svg('path', { attrs: { d: 'm20 20-4.2-4.2', ...STROKE } }),
  ]);
}

/** A cross (close). */
export function closeIcon() {
  return svg('svg', { attrs: { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' } }, [
    svg('path', { attrs: { d: 'M6 6l12 12M18 6 6 18', ...STROKE } }),
  ]);
}
