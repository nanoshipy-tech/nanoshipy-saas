'use strict';

const { Worker } = require('bullmq');
const { connection } = require('../queues/connection');
const ndrDetectionService = require('../services/ndrDetection.service');
const logger = require('../utils/logger');

const ndrDetectionWorker = new Worker(
  'ndr-detection',
  async (job) => {
    const { trackingEventId } = job.data;
    logger.info(`[NdrDetectionWorker] Processing check for tracking event ${trackingEventId}`);
    await ndrDetectionService.detectAndProcessNdrOrRto(trackingEventId);
  },
  {
    connection,
    concurrency: 5,
  },
);

ndrDetectionWorker.on('failed', (job, err) => {
  logger.error(`[NdrDetectionWorker] Job ${job?.id} failed:`, { error: err.message });
});

ndrDetectionWorker.on('error', (err) => {
  logger.error('[NdrDetectionWorker] Worker error:', { error: err.message });
});

module.exports = ndrDetectionWorker;
