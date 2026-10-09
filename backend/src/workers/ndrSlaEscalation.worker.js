'use strict';

const { Worker } = require('bullmq');
const { connection } = require('../queues/connection');
const ndrService = require('../services/ndr.service');
const logger = require('../utils/logger');

const { acquireLock, releaseLock } = require('../utils/distributedLock.util');

const LOCK_KEY = 'lock:worker:ndr-sla-escalation';
const LOCK_TTL_MS = 60000;

const ndrSlaEscalationWorker = new Worker(
  'ndr-sla-escalation',
  async (job) => {
    const acquired = await acquireLock(LOCK_KEY, LOCK_TTL_MS);
    if (!acquired) {
      logger.info('[NdrSlaEscalationWorker] Another worker instance is already executing SLA escalation. Skipping duplicate run.');
      return { skipped: true, reason: 'LOCKED_BY_ANOTHER_INSTANCE' };
    }

    try {
      logger.info('[NdrSlaEscalationWorker] Executing scheduled check for SLA-breached NDR cases...');
      const count = await ndrService.checkNdrSlaBreaches();
      return { resolved_count: count };
    } finally {
      await releaseLock(LOCK_KEY);
    }
  },
  {
    connection,
    concurrency: 1,
  },
);

ndrSlaEscalationWorker.on('failed', (job, err) => {
  logger.error(`[NdrSlaEscalationWorker] Job ${job?.id} failed:`, { error: err.message });
});

ndrSlaEscalationWorker.on('error', (err) => {
  logger.error('[NdrSlaEscalationWorker] Worker error:', { error: err.message });
});

module.exports = ndrSlaEscalationWorker;
