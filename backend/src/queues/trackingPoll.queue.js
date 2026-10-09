'use strict';

const { Queue } = require('bullmq');
const { connection } = require('./connection');

const trackingPollQueue = new Queue('tracking-poll', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 },
  },
});

module.exports = trackingPollQueue;
