/**
 * CloudWatch metrics were removed (no @aws-sdk). These no-ops keep call sites stable.
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
