const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
const logger = require('../config/logging');

const client = new CloudWatchClient({
    region: process.env.AWS_REGION || 'ap-south-1'
});

async function recordMetric(metricName, value, unit = 'Count', dimensions = {}) {
    if (process.env.NODE_ENV === 'development' && !process.env.ENABLE_CLOUDWATCH_LOCAL) {
        return;
    }

    try {
        const formattedDimensions = Object.entries(dimensions).map(([Name, Value]) => ({
            Name,
            Value: String(Value)
        }));

        const command = new PutMetricDataCommand({
            Namespace: 'ChatAgent/Backend',
            MetricData: [
                {
                    MetricName: metricName,
                    Dimensions: formattedDimensions,
                    Unit: unit,
                    Value: value,
                    Timestamp: new Date(),
                },
            ],
        });

        await client.send(command);
    } catch (error) {
        logger.warn(`[CloudWatch] Failed to record metric ${metricName}:`, error.message);
    }
}

async function withLatency(metricName, fn, dimensions = {}) {
    const start = Date.now();
    try {
        return await fn();
    } finally {
        const duration = Date.now() - start;
        await recordMetric(metricName, duration, 'Milliseconds', dimensions);
    }
}

module.exports = {
    recordMetric,
    withLatency
};
