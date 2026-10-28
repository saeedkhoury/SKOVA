/**
 * Small DOM helpers. Text always goes in through text nodes, never innerHTML,
 * so config strings can never inject markup.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Create an element.
 * @param {string} tag
 * @param {Record<string, unknown>} [props] className, text, attrs, dataset, style (css vars)
 * @param {Array<Node|string|null|undefined|false>} [children]
 * @returns {HTMLElement}
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  applyProps(node, props);
  append(node, children);
  return node;
}

/** Create an SVG element (same props as el). */
export function svg(tag, props = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  applyProps(node, props);
  append(node, children);
  return node;
}

function applyProps(node, { className, text, attrs, dataset, vars } = {}) {
  if (className) node.setAttribute('class', className);
  if (text !== undefined && text !== null) node.textContent = String(text);
  if (attrs) {
    Object.entries(attrs).forEach(([name, value]) => {
      if (value === false || value === null || value === undefined) return;
      node.setAttribute(name, value === true ? '' : String(value));
    });
  }
  if (dataset) Object.entries(dataset).forEach(([k, v]) => { node.dataset[k] = String(v); });
  if (vars) Object.entries(vars).forEach(([k, v]) => node.style.setProperty(k, String(v)));
}

/** Append children; strings become text nodes, falsy entries are skipped. */
export function append(parent, children) {
  children.forEach((child) => {
    if (child === null || child === undefined || child === false) return;
    parent.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  });
  return parent;
}

/** Replace all children of a node. */
export function fill(parent, children) {
  parent.replaceChildren();
  return append(parent, children);
}

/**
 * Split text into word wrappers (.w) holding one span per character (.ch).
 * Words keep a normal space between them so lines can still wrap.
 * @param {string} text
 * @returns {DocumentFragment}
 */
export function splitChars(text) {
  const frag = document.createDocumentFragment();
  String(text).trim().split(/\s+/).forEach((word, i) => {
    if (i > 0) frag.appendChild(document.createTextNode(' '));
    const w = el('span', { className: 'w' });
    Array.from(word).forEach((ch) => w.appendChild(el('span', { className: 'ch', text: ch })));
    frag.appendChild(w);
  });
  return frag;
}

/** Debounce: run fn once, `ms` after the last call. */
export function debounce(fn, ms) {
  let timer = 0;
  const debounced = (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => window.clearTimeout(timer);
  return debounced;
}

export const wait = (ms) => new Promise((resolve) => { window.setTimeout(resolve, ms); });

/**
 * Reject if `promise` has not settled within `ms`.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} label
 * @returns {Promise<T>}
 */
export function withTimeout(promise, ms, label = 'task') {
  let timer = 0;
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
}

/** Resolves when an <img> has loaded or failed (never rejects). */
export function imageSettled(img) {
  if (!img) return Promise.resolve(false);
  if (img.complete && img.getAttribute('src')) return Promise.resolve(img.naturalWidth > 0);
  return new Promise((resolve) => {
    img.addEventListener('load', () => resolve(true), { once: true });
    img.addEventListener('error', () => resolve(false), { once: true });
  });
}
