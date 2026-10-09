'use strict';

const { Worker } = require('bullmq');
const { connection } = require('../queues/connection');
const reportExportService = require('../services/reportExport.service');
const logger = require('../utils/logger');

const reportExportWorker = new Worker(
  'report-export',
  async (job) => {
    const { tenantId, userId, params } = job.data;
    logger.info(`[ReportExportWorker] Processing job ${job.id} for tenant ${tenantId}`);
    
    try {
      const result = await reportExportService.processExportJob(tenantId, userId, params);
      logger.info(`[ReportExportWorker] Job ${job.id} completed successfully. File: ${result.fileUrl}`);
      return result;
    } catch (err) {
      logger.error(`[ReportExportWorker] Job ${job.id} failed: ${err.message}`, err);
      throw err;
    }
  },
  {
    connection,
    concurrency: 2, // run up to 2 report exports in parallel
  }
);

reportExportWorker.on('failed', (job, err) => {
  logger.error(`[ReportExportWorker] Job ${job?.id} permanently failed: ${err.message}`);
});

reportExportWorker.on('error', (err) => {
  logger.error('[ReportExportWorker] General worker error:', err);
});

module.exports = reportExportWorker;
