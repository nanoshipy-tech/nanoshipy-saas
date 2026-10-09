'use strict';

const { Queue } = require('bullmq');
const { connection } = require('./connection');
const trackingPollQueue = require('./trackingPoll.queue');
const trackingService = require('../services/tracking.service');
const logger = require('../utils/logger');

// Internal queue used to schedule the dispatcher itself
const schedulerQueue = new Queue('tracking-poll-dispatcher', {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 10 },
  },
});

const { Worker } = require('bullmq');

/**
 * The dispatcher worker picks up the repeatable job and fans out
 * individual poll jobs for every eligible shipment.
 */
const dispatcherWorker = new Worker(
  'tracking-poll-dispatcher',
  async () => {
    logger.info('[PollScheduler] Dispatching tracking poll jobs...');

    const shipmentIds = await trackingService.getShipmentIdsForPolling();

    for (const shipmentId of shipmentIds) {
      await trackingPollQueue.add(`poll-${shipmentId}`, { shipmentId }, {
        jobId: `poll-${shipmentId}`, // Dedupe — one active poll job per shipment at a time
      });
    }

    logger.info(`[PollScheduler] Dispatched ${shipmentIds.length} poll jobs`);

    // Also run stuck shipment detection
    const flagged = await trackingService.flagStuckShipments();
    if (flagged > 0) {
      logger.warn(`[PollScheduler] Flagged ${flagged} shipments as delayed`);
    }
  },
  { connection, concurrency: 1 },
);

dispatcherWorker.on('error', (err) => {
  logger.error('[PollScheduler] Dispatcher worker error:', { error: err.message });
});

/**
 * Register a repeatable job that fires every 30 minutes.
 * Safe to call multiple times — BullMQ dedupes by the repeat key.
 */
async function startScheduler() {
  await schedulerQueue.add(
    'dispatch-tracking-polls',
    {},
    {
      repeat: {
        every: 30 * 60 * 1000, // 30 minutes
      },
      jobId: 'dispatch-tracking-polls-repeatable',
    },
  );
  logger.info('[PollScheduler] Repeatable tracking poll scheduler registered (every 30 min)');
}

async function stopScheduler() {
  await dispatcherWorker.close();
  await schedulerQueue.close();
}

module.exports = { startScheduler, stopScheduler };
