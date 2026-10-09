'use strict';

const { Queue } = require('bullmq');
const { connection } = require('./connection');

const ndrSlaEscalationQueue = new Queue('ndr-sla-escalation', {
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

module.exports = ndrSlaEscalationQueue;
