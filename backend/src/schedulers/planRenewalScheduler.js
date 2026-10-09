'use strict';

const { Queue } = require('bullmq');
const { connection } = require('../queues/connection');
const logger = require('../utils/logger');

const planRenewalQueue = new Queue('plan-renewal', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
  },
});

/**
 * Initializes repeatable subscription checks.
 * scheduled daily based on SUBSCRIPTION_RENEWAL_CHECK_HOUR env (defaults to 02:00).
 */
async function schedulePlanRenewals() {
  try {
    const hour = parseInt(process.env.SUBSCRIPTION_RENEWAL_CHECK_HOUR, 10) || 2;
    const cronExpression = `0 ${hour} * * *`;

    const jobs = await planRenewalQueue.getRepeatableJobs();
    for (const job of jobs) {
      await planRenewalQueue.removeRepeatableByKey(job.key);
    }

    await planRenewalQueue.add(
      'daily-subscription-renewal-check',
      {},
      {
        repeat: {
          pattern: cronExpression,
        },
      }
    );

    logger.info(`[PlanRenewalScheduler] Successfully scheduled daily plan renewal job cron: ${cronExpression}`);
  } catch (err) {
    logger.error('[PlanRenewalScheduler] Failed to initialize repeatable schedule:', { error: err.message });
  }
}

module.exports = {
  planRenewalQueue,
  schedulePlanRenewals,
};
