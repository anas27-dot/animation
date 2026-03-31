// Rate limiting is disabled. These middlewares are no-ops.
// Keeping the same exports so route files don't need changes.

const noop = (req, res, next) => next();

module.exports = {
  generalLimiter: noop,
  sensitiveLimiter: noop,
  chatLimiter: noop,
  strictLimiter: noop,
};

