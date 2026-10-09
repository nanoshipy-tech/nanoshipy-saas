const app = require('./app');
const config = require('./config/env');
const logger = require('./utils/logger');
const { sequelize } = require('./models');
const { getRedisClient } = require('./config/redis.config');
const cleanupJob = require('./jobs/cleanupExpiredTokens.job');

let workers = [];
let schedulers = null;

const startServer = async () => {
  try {
    // Check DB connection
    await sequelize.authenticate();
    logger.info('[DB] Connection has been established successfully.');

    // Ensure ShopifyConnection, ShippingAllocationRule, ExportJob, WebhookEndpoint exist
    const { ShopifyConnection, ShippingAllocationRule, ExportJob, WebhookEndpoint, WebhookDelivery } = require('./models');
    await ShopifyConnection.sync().catch(err => logger.warn(`[ShopifyConnection.sync] ${err.message}`));
    await ShippingAllocationRule.sync().catch(err => logger.warn(`[ShippingAllocationRule.sync] ${err.message}`));
    if (ExportJob) await ExportJob.sync().catch(err => logger.warn(`[ExportJob.sync] ${err.message}`));
    if (WebhookEndpoint) await WebhookEndpoint.sync().catch(err => logger.warn(`[WebhookEndpoint.sync] ${err.message}`));
    if (WebhookDelivery) await WebhookDelivery.sync({ alter: true }).catch(err => logger.warn(`[WebhookDelivery.sync] ${err.message}`));

    // Initialize Redis
    getRedisClient();

    // Initialize central event subscriptions mapping (Module 14 Hook)
    const { initializeSubscriptions } = require('./events/eventSubscriptions');
    initializeSubscriptions();

    const { initEventSubscribers } = require('./events/eventSubscriber');
    initEventSubscribers();

    // Start background jobs
    cleanupJob.start();
    logger.info('[Jobs] Started background jobs.');

    // Start BullMQ workers & schedulers if not in mock Redis mode
    if (process.env.USE_MOCK_REDIS !== 'true') {
      try {
        const webhookProcessWorker = require('./workers/webhookProcess.worker');
        const trackingPollWorker = require('./workers/trackingPoll.worker');
        const ndrDetectionWorker = require('./workers/ndrDetection.worker');
        const monthlyStatementWorker = require('./workers/monthlyStatement.worker');
        const planRenewalWorker = require('./workers/planRenewal.worker');
        const notificationDispatchWorker = require('./queue/workers/notificationDispatch.worker');
        const { webhookDeliveryWorker } = require('./queue/workers/webhookDelivery.worker');
        const { analyticsSnapshotWorker, scheduleNightlySnapshots } = require('./jobs/analyticsSnapshot.worker');
        const reportExportWorker = require('./workers/reportExport.worker');
        const { auditLogRetentionWorker, scheduleAuditLogRetention } = require('./workers/auditLogRetention.worker');
        const sandboxStatusProgressionWorker = require('./jobs/sandboxStatusProgression.worker');
        const codRemittanceReconciliationWorker = require('./jobs/codRemittanceReconciliation.worker');
        const ndrSlaEscalationWorker = require('./workers/ndrSlaEscalation.worker');
        const { storefrontWebhookWorker, storefrontOrderPollWorker } = require('./workers/storefrontSync.worker');
        const { scheduleStorefrontSync, stopStorefrontSyncScheduler } = require('./schedulers/storefrontSyncScheduler');
        const { startScheduler, stopScheduler } = require('./queues/trackingPollScheduler');
        const { scheduleMonthlyStatements } = require('./schedulers/monthlyStatementScheduler');
        const { schedulePlanRenewals } = require('./schedulers/planRenewalScheduler');

        workers = [
          webhookProcessWorker,
          trackingPollWorker,
          ndrDetectionWorker,
          ndrSlaEscalationWorker,
          monthlyStatementWorker,
          planRenewalWorker,
          notificationDispatchWorker,
          webhookDeliveryWorker,
          analyticsSnapshotWorker,
          reportExportWorker,
          auditLogRetentionWorker,
          sandboxStatusProgressionWorker,
          codRemittanceReconciliationWorker,
          storefrontWebhookWorker,
          storefrontOrderPollWorker,
        ];
        schedulers = { stopScheduler, stopStorefrontSyncScheduler };

        logger.info('[Workers] BullMQ workers started.');

        await startScheduler();
        logger.info('[Scheduler] Tracking poll scheduler registered.');
        await scheduleMonthlyStatements();
        logger.info('[Scheduler] Monthly billing statements scheduler registered.');
        await schedulePlanRenewals();
        logger.info('[Scheduler] Subscription plan renewals scheduler registered.');
        await scheduleNightlySnapshots();
        logger.info('[Scheduler] Nightly analytics snapshots scheduler registered.');
        await scheduleAuditLogRetention();
        logger.info('[Scheduler] Nightly audit log retention scheduler registered.');
        await scheduleStorefrontSync();
        logger.info('[Scheduler] Periodic storefront sync scheduler registered.');
      } catch (schedErr) {
        logger.warn(`[Scheduler] Optional schedulers skipped: ${schedErr.message}`);
      }
    } else {
      logger.info('[Scheduler] Skipping BullMQ background workers and schedulers in local mock Redis mode.');
    }

    // Start SLA breach checker cron (every 30 minutes)
    const cron = require('node-cron');
    const ticketSlaService = require('./services/ticketSla.service');
    cron.schedule('*/30 * * * *', async () => {
      try {
        await ticketSlaService.checkSlaBreaches();
      } catch (err) {
        logger.error(`[SlaCron] SLA check failed: ${err.message}`);
      }
    });
    logger.info('[Scheduler] Ticket SLA breach checker registered (every 30m).');

    // Start Export & Webhook Polling background worker
    try {
      const { startExportPollingWorker } = require('./workers/exportJob.worker');
      startExportPollingWorker();
      logger.info('[Scheduler] Export & Webhook background processor registered.');
    } catch (expErr) {
      logger.warn(`[Scheduler] Export polling worker init warning: ${expErr.message}`);
    }

    // Start NDR SLA breach checker cron (every 15 minutes)
    const ndrService = require('./services/ndr.service');
    cron.schedule('*/15 * * * *', async () => {
      try {
        await ndrService.checkNdrSlaBreaches();
      } catch (err) {
        logger.error(`[NdrSlaCron] NDR SLA check failed: ${err.message}`);
      }
    });
    logger.info('[Scheduler] NDR SLA breach checker registered (every 15m).');

    // Start Express server
    const server = app.listen(config.port, () => {
      logger.info(`[Server] Listening on port ${config.port} in ${config.nodeEnv} mode`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('[Server] Shutting down gracefully...');
      server.close(() => {
        logger.info('[Server] HTTP server closed.');
      });
      cleanupJob.stop();

      for (const worker of workers) {
        try {
          await worker.close();
        } catch (_) {}
      }

      if (schedulers?.stopScheduler) {
        try {
          await schedulers.stopScheduler();
        } catch (_) {}
      }

      await sequelize.close();
      const redisClient = getRedisClient();
      if (redisClient) {
        await redisClient.quit();
      }
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('[Server] Failed to start:', { error: error.message });
    process.exit(1);
  }
};

startServer();
