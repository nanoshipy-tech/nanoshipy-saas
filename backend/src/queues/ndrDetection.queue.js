'use strict';

const { Queue } = require('bullmq');
const { connection } = require('./connection');

const ndrDetectionQueue = new Queue('ndr-detection', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 200 },
  },
});

module.exports = ndrDetectionQueue;
