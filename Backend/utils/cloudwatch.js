/**
 * CloudWatch metrics removed (no @aws-sdk). No-ops keep existing call sites working.
 */
async function recordMetric() {
  return undefined;
}

async function withLatency(_metricName, fn) {
  return fn();
}

module.exports = {
  recordMetric,
  withLatency,
};
