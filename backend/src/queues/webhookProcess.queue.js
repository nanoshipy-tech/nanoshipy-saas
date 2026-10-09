'use strict';

const { Queue } = require('bullmq');
const { connection } = require('./connection');

const webhookProcessQueue = new Queue('webhook-process', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 200 },
  },
});

module.exports = webhookProcessQueue;
