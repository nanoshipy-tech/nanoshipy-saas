'use strict';

/**
 * auditLogRetention.worker.js
 *
 * BullMQ scheduled worker that purges/archives old audit log entries.
 *
 * Resolution:
 *  - General entries older than `audit_log_retention_days` (platform_settings,
 *    default 365) are deleted in 1,000-row batches to avoid long table locks.
 *  - Financial and security entries (wallet_*, invoice_*, subscription_*,
 *    recharge_*, login, impersonation_*, password_reset, 2fa_*) are exempt and
 *    retained for FINANCIAL_AUDIT_MIN_RETENTION_DAYS (env default: 2555 / 7 years).
 *
 * NOTE: Archive-to-cold-storage (S3/R2 via Module 4 file service) is flagged as
 * a future enhancement. Currently this worker deletes rows only, which is
 * sufficient for most development/staging environments. For production compliance
 * requirements, add an archive step before deletion.
 */

const { Worker, Queue } = require('bullmq');
const { connection } = require('../queues/connection');
const auditLogRepository = require('../repositories/auditLog.repository');
const settingsService = require('../services/settings.service');
const logger = require('../utils/logger');

const QUEUE_NAME = 'audit-log-retention';
const FINANCIAL_MIN_DAYS = parseInt(process.env.FINANCIAL_AUDIT_MIN_RETENTION_DAYS, 10) || 2555; // 7 years

const auditLogRetentionWorker = new Worker(
  QUEUE_NAME,
  async (job) => {
    logger.info('[AuditLogRetentionWorker] Starting retention run...');

    try {
      // Read current retention setting via three-tier resolution
      const { value: retentionDays } = await settingsService.getEffectiveSetting(null, 'audit_log_retention_days');
      const generalDays = parseInt(retentionDays, 10) || 365;

      const generalCutoff = new Date();
      generalCutoff.setDate(generalCutoff.getDate() - generalDays);

      const financialCutoff = new Date();
      financialCutoff.setDate(financialCutoff.getDate() - FINANCIAL_MIN_DAYS);

      logger.info(`[AuditLogRetentionWorker] General cutoff: ${generalCutoff.toISOString()} (${generalDays} days)`);
      logger.info(`[AuditLogRetentionWorker] Financial/security cutoff: ${financialCutoff.toISOString()} (${FINANCIAL_MIN_DAYS} days)`);

      // Purge tenant audit_logs
      const tenantDeleted = await auditLogRepository.deleteOldTenantAuditLogs(
        generalCutoff,
        financialCutoff,
        1000
      );
      logger.info(`[AuditLogRetentionWorker] Deleted ${tenantDeleted} old tenant audit_logs rows`);

      // Purge platform audit_logs
      const platformDeleted = await auditLogRepository.deleteOldPlatformAuditLogs(
        generalCutoff,
        financialCutoff,
        1000
      );
      logger.info(`[AuditLogRetentionWorker] Deleted ${platformDeleted} old platform_audit_logs rows`);

      return { tenantDeleted, platformDeleted, generalCutoff, financialCutoff };
    } catch (err) {
      logger.error(`[AuditLogRetentionWorker] Retention run failed: ${err.message}`, err);
      throw err;
    }
  },
  {
    connection,
    concurrency: 1, // Only one retention run at a time
  }
);

auditLogRetentionWorker.on('completed', (job, result) => {
  logger.info(`[AuditLogRetentionWorker] Job ${job.id} completed`, result);
});

auditLogRetentionWorker.on('failed', (job, err) => {
  logger.error(`[AuditLogRetentionWorker] Job ${job?.id} failed: ${err.message}`);
});

auditLogRetentionWorker.on('error', (err) => {
  logger.error('[AuditLogRetentionWorker] Worker error:', err);
});

// ─────────────────────────────────────────────
// Scheduler — register the repeatable cron job
// ─────────────────────────────────────────────

const auditLogRetentionQueue = new Queue(QUEUE_NAME, { connection });

/**
 * Schedule a nightly audit log retention run (2am UTC).
 */
async function scheduleAuditLogRetention() {
  await auditLogRetentionQueue.add(
    'nightly-retention',
    {},
    {
      repeat: { pattern: '0 2 * * *' }, // 2am UTC daily
      jobId: 'audit-log-retention-nightly',
    }
  );
  logger.info('[AuditLogRetentionScheduler] Nightly audit log retention scheduled (2am UTC)');
}

module.exports = { auditLogRetentionWorker, scheduleAuditLogRetention };
