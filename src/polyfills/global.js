// Polyfill `global` for libraries (like sockjs-client) that expect a Node-like global.
// Only set it if it doesn't already exist to avoid clobbering host environments.
if (typeof window !== 'undefined' && typeof global === 'undefined') {
  // eslint-disable-next-line no-global-assign
  window.global = window;
}

export default {};
