/**
 * Small helpers shared by the avatar modules: asset loading with real progress,
 * number helpers, a pixel-ratio watcher, and a tiny tween runner used only when GSAP is missing.
 * No DOM writes, no console output.
 */

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Frame-rate independent version of "value += (target - value) * k" tuned at 60 fps.
 * @param {number} k60 factor per frame at 60 fps (0..1)
 * @param {number} dt seconds since the last frame
 */
export function damp(k60, dt) {
  return 1 - Math.pow(1 - clamp(k60, 0, 0.999), dt * 60);
}

/** Error message from anything that was thrown. */
export function messageOf(error) {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : 'unknown error';
}

/** Resolve a site-relative asset path against the page (or an explicit base URL). */
export function resolveAsset(path, base) {
  if (typeof path !== 'string' || !path.trim()) throw new Error('missing asset path');
  return new URL(path, base || document.baseURI).href;
}

/**
 * Progress reporter: combines weighted parts into one monotonic 0..1 value.
 * @param {(p: number) => void} [onProgress]
 * @param {Record<string, number>} weights
 */
export function createProgress(onProgress, weights) {
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0) || 1;
  const parts = Object.fromEntries(Object.keys(weights).map((key) => [key, 0]));
  let last = 0;
  const emit = () => {
    const value = Object.keys(weights).reduce((sum, key) => sum + parts[key] * weights[key], 0) / total;
    const next = clamp(Math.max(last, value), 0, 1);
    if (next === last && next !== 0) return;
    last = next;
    if (typeof onProgress !== 'function') return;
    try {
      onProgress(next);
    } catch {
      // The caller's progress callback failing must not break loading; progress is cosmetic.
    }
  };
  return {
    /** @param {string} key @param {number} fraction */
    set(key, fraction) {
      if (!(key in parts)) return;
      parts[key] = clamp(Math.max(parts[key], Number(fraction) || 0), 0, 1);
      emit();
    },
    /** Callback bound to one part, for loaders. */
    part(key) {
      return (fraction) => this.set(key, fraction);
    },
    done() {
      Object.keys(parts).forEach((key) => { parts[key] = 1; });
      emit();
    },
  };
}

/**
 * Fetch a file as a Blob and report download progress (0..1).
 * Without a Content-Length (or a readable body) progress jumps to 1 when done.
 * @param {string} url
 * @param {(fraction: number) => void} [onProgress]
 * @param {AbortSignal} [signal]
 * @returns {Promise<Blob>}
 */
export async function fetchBlob(url, onProgress = () => {}, signal) {
  const response = await fetch(url, { signal, credentials: 'same-origin' });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  const type = response.headers.get('content-type') || '';
  const total = Number(response.headers.get('content-length')) || 0;
  if (!response.body || !total || typeof response.body.getReader !== 'function') {
    const blob = await response.blob();
    onProgress(1);
    return blob;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress(Math.min(1, loaded / total));
  }
  onProgress(1);
  return new Blob(chunks, { type });
}

/**
 * Download and decode an image. Uses an <img> (not ImageBitmap) so WebGL upload
 * flags (flipY, premultiply) behave the same in every browser.
 * @returns {Promise<HTMLImageElement>} decoded image; call releaseImage() after upload
 */
export async function loadImage(url, onProgress, signal) {
  const blob = await fetchBlob(url, onProgress, signal);
  const objectUrl = URL.createObjectURL(blob);
  const img = new Image();
  img.decoding = 'async';
  img.dataset.objectUrl = objectUrl;
  img.src = objectUrl;
  try {
    if (typeof img.decode === 'function') await img.decode();
    else await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new Error(`could not decode image ${url}`);
  }
  if (!img.naturalWidth || !img.naturalHeight) {
    URL.revokeObjectURL(objectUrl);
    throw new Error(`image ${url} has no pixels`);
  }
  return img;
}

/** Free the blob URL behind an image created by loadImage (safe to call twice). */
export function releaseImage(img) {
  const objectUrl = img && img.dataset ? img.dataset.objectUrl : '';
  if (!objectUrl) return;
  URL.revokeObjectURL(objectUrl);
  delete img.dataset.objectUrl;
}

export async function loadJson(url, signal) {
  const response = await fetch(url, { signal, credentials: 'same-origin' });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new Error(`${url} is not valid JSON`);
  }
}

const EASES = {
  'power2.inOut': (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  none: (t) => t,
};

/**
 * Minimal tween runner (used only when window.gsap is missing).
 * Call step(dt) once per frame; tweens with the same target+key replace each other.
 */
export function createTweens() {
  const list = [];
  return {
    to(target, key, to, { duration = 1, delay = 0, ease = 'power2.inOut' } = {}) {
      const existing = list.findIndex((t) => t.target === target && t.key === key);
      if (existing >= 0) list.splice(existing, 1);
      list.push({ target, key, from: null, to, duration, delay, elapsed: 0, ease: EASES[ease] || EASES.none });
    },
    step(dt) {
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const tween = list[i];
        tween.elapsed += dt;
        const local = tween.elapsed - tween.delay;
        if (local < 0) continue;
        if (tween.from === null) tween.from = tween.target[tween.key];
        const t = clamp(local / Math.max(tween.duration, 1e-4), 0, 1);
        tween.target[tween.key] = lerp(tween.from, tween.to, tween.ease(t));
        if (t >= 1) list.splice(i, 1);
      }
    },
    clear() {
      list.length = 0;
    },
  };
}

/**
 * Call onChange whenever the device pixel ratio changes without a resize (the window moved to
 * another screen, or the page zoom changed). Returns the unsubscribe function.
 */
export function watchPixelRatio(onChange) {
  let query = null;
  const fire = () => {
    onChange();
    listen(); // a media query matches one ratio: listen again for the new one
  };
  function listen() {
    if (typeof window.matchMedia !== 'function') return;
    query = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    if (typeof query.addEventListener === 'function') query.addEventListener('change', fire, { once: true });
  }
  listen();
  return () => {
    if (query && typeof query.removeEventListener === 'function') query.removeEventListener('change', fire);
  };
}
