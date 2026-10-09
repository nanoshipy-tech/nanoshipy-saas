'use strict';

const { Worker } = require('bullmq');
const { connection } = require('../queues/connection');
const { ExportJob, sequelize } = require('../models');
const exportProcessor = require('../services/exportProcessor.service');
const exportJobService = require('../services/exportJob.service');
const webhookDispatcher = require('../services/webhookDispatcher.service');
const logger = require('../utils/logger');

let exportJobWorker = null;
let dbPollingInterval = null;
let cleanupInterval = null;

// Initialize BullMQ worker if Redis is active
if (process.env.USE_MOCK_REDIS !== 'true') {
  try {
    exportJobWorker = new Worker(
      'admin-export-jobs',
      async (job) => {
        const { jobId } = job.data;
        logger.info(`[ExportJobWorker] BullMQ processing job ${jobId}`);
        await exportProcessor.processJob(jobId);
      },
      {
        connection,
        concurrency: 3,
      }
    );

    exportJobWorker.on('failed', (job, err) => {
      logger.error(`[ExportJobWorker] BullMQ job ${job?.id} failed: ${err.message}`);
    });

    exportJobWorker.on('error', (err) => {
      logger.warn(`[ExportJobWorker] BullMQ error: ${err.message}`);
    });
  } catch (err) {
    logger.warn(`[ExportJobWorker] Failed to initialize BullMQ worker: ${err.message}`);
  }
}

/**
 * DB Polling Worker Fallback with Atomic Row-Level Locking
 * Ensures that even in environments without Redis, jobs are picked up reliably
 * and two concurrent workers never process the same job.
 */
async function pollAndProcessPendingJobs() {
  try {
    // 1. Atomically pick the next queued job
    // We update status to 'processing' atomically to lock it
    const queuedJob = await ExportJob.findOne({
      where: { status: 'queued' },
      order: [['created_at', 'ASC']],
    });

    if (!queuedJob) return;

    // Atomic update lock
    const [affectedCount] = await ExportJob.update(
      { status: 'processing', started_at: new Date() },
      {
        where: { id: queuedJob.id, status: 'queued' },
      }
    );

    if (affectedCount === 0) {
      // Another worker/thread already claimed this job
      return;
    }

    logger.info(`[ExportPollingWorker] Claimed queued export job ${queuedJob.id}`);
    await exportProcessor.processJob(queuedJob.id);
  } catch (err) {
    logger.error(`[ExportPollingWorker] Error polling jobs: ${err.message}`);
  }
}

/**
 * Periodic Webhook Retry Processor
 */
async function processWebhookRetries() {
  try {
    await webhookDispatcher.processPendingRetries();
  } catch (err) {
    logger.error(`[ExportPollingWorker] Error processing webhook retries: ${err.message}`);
  }
}

function startExportPollingWorker(intervalMs = 4000) {
  if (dbPollingInterval) return;

  dbPollingInterval = setInterval(async () => {
    await pollAndProcessPendingJobs();
    await processWebhookRetries();
  }, intervalMs);

  // Periodic cleanup job for expired exports every hour
  cleanupInterval = setInterval(async () => {
    await exportJobService.cleanupExpiredExports();
  }, 3600000);

  logger.info('[ExportPollingWorker] Database polling worker started.');
}

function stopExportPollingWorker() {
  if (dbPollingInterval) {
    clearInterval(dbPollingInterval);
    dbPollingInterval = null;
  }
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  if (exportJobWorker) {
    exportJobWorker.close().catch(() => {});
  }
}

module.exports = {
  exportJobWorker,
  startExportPollingWorker,
  stopExportPollingWorker,
};
