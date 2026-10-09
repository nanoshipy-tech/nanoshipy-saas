'use strict';

const { Worker } = require('bullmq');
const { connection } = require('../../queues/connection');
const ChannelFactory = require('../../channels/ChannelFactory');
const notificationLogRepository = require('../../repositories/notificationLog.repository');
const logger = require('../../utils/logger');

const notificationDispatchWorker = new Worker(
  'notification-dispatch',
  async (job) => {
    const { logId, recipient, subject, body, channel, metadata } = job.data;
    logger.info(`[NotificationWorker] Processing job ${job.id} on channel: ${channel} for log ID: ${logId}`);

    try {
      const adapter = ChannelFactory.getChannel(channel);
      const response = await adapter.send({
        recipient,
        subject,
        body,
        metadata,
      });

      if (response.success) {
        await notificationLogRepository.logDelivery(logId, 'sent', response, null);
        logger.info(`[NotificationWorker] Job ${job.id} dispatched successfully via ${channel}`);
      } else {
        await notificationLogRepository.logDelivery(logId, 'failed', response, response.error);
        throw new Error(`Channel delivery unsuccessful: ${response.error}`);
      }
    } catch (err) {
      logger.error(`[NotificationWorker] Job ${job.id} failed: ${err.message}`);
      await notificationLogRepository.logDelivery(logId, 'failed', null, err.message);
      // Re-throw to trigger BullMQ's automatic retry backoff logic
      throw err;
    }
  },
  {
    connection,
    concurrency: 5,
  }
);

notificationDispatchWorker.on('failed', (job, err) => {
  logger.error(`[NotificationWorker] Job ${job?.id} permanently failed: ${err.message}`);
});

notificationDispatchWorker.on('error', (err) => {
  logger.error('[NotificationWorker] General worker error:', { error: err.message });
});

module.exports = notificationDispatchWorker;
