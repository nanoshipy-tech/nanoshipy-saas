'use strict';

const { Worker } = require('bullmq');
const { connection } = require('../queues/connection');
const { TenantSubscription } = require('../models');
const planRenewalService = require('../services/planRenewal.service');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

const planRenewalWorker = new Worker(
  'plan-renewal',
  async (job) => {
    logger.info('[PlanRenewalWorker] Running daily subscription renewal check...');

    const today = new Date();
    today.setHours(23, 59, 59, 999); // Till end of day

    // Fetch due subscriptions
    const dueSubscriptions = await TenantSubscription.findAll({
      where: {
        status: { [Op.in]: ['active', 'grace_period'] },
        current_period_end: { [Op.lte]: today },
      },
    });

    logger.info(`[PlanRenewalWorker] Found ${dueSubscriptions.length} subscriptions due for check/renewal.`);

    for (const sub of dueSubscriptions) {
      try {
        await planRenewalService.renewSubscription(sub.id);
      } catch (subErr) {
        logger.error(`[PlanRenewalWorker] Failed to process renewal for subscription ${sub.id}: ${subErr.message}`);
      }
    }
  },
  {
    connection,
    concurrency: 1, // Renew sequentially to prevent lock contentions
  }
);

planRenewalWorker.on('failed', (job, err) => {
  logger.error(`[PlanRenewalWorker] Job ${job?.id} failed:`, { error: err.message });
});

planRenewalWorker.on('error', (err) => {
  logger.error('[PlanRenewalWorker] Worker error:', { error: err.message });
});

module.exports = planRenewalWorker;
