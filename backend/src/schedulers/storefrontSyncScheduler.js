'use strict';

const { Queue, Worker } = require('bullmq');
const { connection } = require('../queues/connection');
const { StorefrontConnection } = require('../models');
const logger = require('../utils/logger');

let pollQueue = null;
let schedulerQueue = null;
let dispatcherWorker = null;

if (process.env.USE_MOCK_REDIS !== 'true') {
  pollQueue = new Queue('storefront-order-poll', {
    connection,
    defaultJobOptions: {
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 50 },
    },
  });

  schedulerQueue = new Queue('storefront-sync-dispatcher', {
    connection,
    defaultJobOptions: {
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 10 },
    },
  });

  dispatcherWorker = new Worker(
    'storefront-sync-dispatcher',
    async () => {
      logger.info('[StorefrontScheduler] Running periodic storefront sync dispatch...');

      try {
        const activeConnections = await StorefrontConnection.findAll({
          where: { status: 'connected' },
          attributes: ['id', 'platform', 'store_name', 'seller_id'],
        });

        if (!activeConnections || activeConnections.length === 0) {
          logger.info('[StorefrontScheduler] No active storefront connections found.');
          return;
        }

        for (const conn of activeConnections) {
          await pollQueue.add(
            'poll-storefront-orders',
            { connectionId: conn.id, tenantId: conn.seller_id, trigger: 'scheduled' },
            {
              jobId: `poll-${conn.id}-${Math.floor(Date.now() / (10 * 60 * 1000))}`,
            }
          );
        }

        logger.info(`[StorefrontScheduler] Dispatched polling jobs for ${activeConnections.length} storefronts.`);
      } catch (err) {
        logger.error(`[StorefrontScheduler] Dispatcher error: ${err.message}`, { error: err });
      }
    },
    { connection, concurrency: 1 }
  );

  dispatcherWorker.on('error', (err) => {
    logger.error('[StorefrontScheduler] Dispatcher worker encountered error:', { error: err.message });
  });
}

/**
 * Register repeatable storefront sync job (default: every 15 minutes)
 */
async function scheduleStorefrontSync(everyMs = 15 * 60 * 1000) {
  if (process.env.USE_MOCK_REDIS === 'true') {
    logger.info('[StorefrontScheduler] Mock Redis mode — skipping BullMQ repeatable scheduler.');
    return;
  }

  if (schedulerQueue) {
    await schedulerQueue.add(
      'dispatch-storefront-sync',
      {},
      {
        repeat: {
          every: everyMs,
        },
        jobId: 'dispatch-storefront-sync-repeatable',
      }
    );
    logger.info(`[StorefrontScheduler] Registered repeatable storefront sync job (every ${everyMs / 60000} minutes)`);
  }
}

async function stopStorefrontSyncScheduler() {
  if (dispatcherWorker) await dispatcherWorker.close();
  if (schedulerQueue) await schedulerQueue.close();
  if (pollQueue) await pollQueue.close();
}

module.exports = {
  scheduleStorefrontSync,
  stopStorefrontSyncScheduler,
};
