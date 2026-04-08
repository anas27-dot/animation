/**
 * Normalize asset URLs so the hosted UI never embeds localhost/loopback (blocked by browsers from public HTTPS).
 * Set PUBLIC_API_URL on Render, e.g. https://omniagent-backend.onrender.com (no trailing slash).
 */
const logger = require('../config/logging');

let warnedMissingBase = false;

function getPublicApiBase() {
  return String(process.env.PUBLIC_API_URL || '')
    .trim()
    .replace(/\/$/, '');
}

/**
 * @param {string} url
 * @returns {string}
 */
function resolvePublicAssetUrl(url) {
  if (!url || typeof url !== 'string') return url;
  const trimmed = url.trim();
  if (!trimmed) return url;

  const base = getPublicApiBase();

  if (/^https?:\/\//i.test(trimmed)) {
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(trimmed)) {
      if (!base) {
        if (!warnedMissingBase) {
          warnedMissingBase = true;
          logger.warn(
            '[publicUrl] Image URL points to localhost but PUBLIC_API_URL is unset; browsers will block from production UI. Set PUBLIC_API_URL to your API HTTPS origin.'
          );
        }
        return trimmed;
      }
      const pathAndQuery = trimmed.replace(/^https?:\/\/[^/?#]+/i, '') || '/';
      return `${base}${pathAndQuery}`;
    }
    return trimmed;
  }

  if (trimmed.startsWith('/uploads/')) {
    if (!base) {
      if (!warnedMissingBase) {
        warnedMissingBase = true;
        logger.warn(
          '[publicUrl] Relative upload URL requires PUBLIC_API_URL in production so the UI (different host) can load files.'
        );
      }
      return trimmed;
    }
    return `${base}${trimmed}`;
  }

  return trimmed;
}

module.exports = {
  getPublicApiBase,
  resolvePublicAssetUrl,
};
