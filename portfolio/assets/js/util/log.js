/**
 * Tiny logger: silent unless the page URL contains ?debug (or &debug).
 * Use it instead of console.* so production stays quiet.
 */
const DEBUG = (() => {
  try {
    return new URLSearchParams(window.location.search).has('debug');
  } catch {
    return false;
  }
})();

const PREFIX = '[site]';

export const log = {
  enabled: DEBUG,
  info: (...args) => { if (DEBUG) console.info(PREFIX, ...args); },
  warn: (...args) => { if (DEBUG) console.warn(PREFIX, ...args); },
  error: (...args) => { if (DEBUG) console.error(PREFIX, ...args); },
};
