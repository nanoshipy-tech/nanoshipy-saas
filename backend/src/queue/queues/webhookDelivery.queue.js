'use strict';

const { Queue } = require('bullmq');
const { connection } = require('../../queues/connection');

const webhookDeliveryQueue = new Queue('webhook-delivery', {
  connection,
  defaultJobOptions: {
    attempts: parseInt(process.env.WEBHOOK_MAX_RETRY_ATTEMPTS, 10) || 4,
    backoff: {
      type: 'exponential',
      delay: 60000,
    },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 500 },
  },
});

module.exports = {
  webhookDeliveryQueue,
};
