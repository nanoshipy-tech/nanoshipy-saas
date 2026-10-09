'use strict';

const { Queue } = require('bullmq');
const { connection } = require('../queues/connection');
const logger = require('../utils/logger');

const monthlyStatementQueue = new Queue('monthly-statement', {
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
 * Initializes repeatable prior-month statement generation trigger.
 * Scheduled to run automatically on the 1st of each calendar month at midnight (00:00).
 */
async function scheduleMonthlyStatements() {
  try {
    const cronExpression = '0 0 1 * *'; // 1st of month at 00:00

    // Remove any existing repeatable jobs for clean starts
    const jobs = await monthlyStatementQueue.getRepeatableJobs();
    for (const job of jobs) {
      await monthlyStatementQueue.removeRepeatableByKey(job.key);
    }

    await monthlyStatementQueue.add(
      'generate-prior-month-statements',
      {},
      {
        repeat: {
          pattern: cronExpression,
        },
      }
    );

    logger.info(`[MonthlyStatementScheduler] Successfully scheduled prior-month consolidated billing statement generator cron: ${cronExpression}`);
  } catch (err) {
    logger.error('[MonthlyStatementScheduler] Failed to initialize repeatable schedule:', { error: err.message });
  }
}

module.exports = {
  monthlyStatementQueue,
  scheduleMonthlyStatements,
};
