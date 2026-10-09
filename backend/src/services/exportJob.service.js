'use strict';

const path = require('path');
const fs = require('fs');
const fsPromises = require('fs/promises');
const { Op } = require('sequelize');
const { ExportJob } = require('../models');
const models = require('../models');
const { getEntityConfig, sanitizeFilters, resolveColumns } = require('../exports/registry');
const exportProcessor = require('./exportProcessor.service');
const config = require('../config/env');
const logger = require('../utils/logger');

// Lazy-require queue if BullMQ is active
let exportQueue = null;
try {
  const { Queue } = require('bullmq');
  const { connection } = require('../queues/connection');
  exportQueue = new Queue('admin-export-jobs', {
    connection,
    defaultJobOptions: {
      attempts: 2,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
    },
  });
} catch {
  // Queue not available, will use DB polling worker fallback
}

class ExportJobService {
  constructor() {
    this.syncRowLimit = parseInt(process.env.EXPORT_SYNC_ROW_LIMIT, 10) || 5000;
    this.maxConcurrent = parseInt(process.env.EXPORT_MAX_CONCURRENT_PER_TENANT, 10) || 3;
    this.maxRows = parseInt(process.env.EXPORT_MAX_ROWS, 10) || 50000;
  }

  /**
   * Request an export job
   */
  async requestExport({ tenantId, userId, entity, filters = {}, columns = null, forceAsync = false }) {
    const entityConfig = getEntityConfig(entity);
    if (!entityConfig) {
      const err = new Error(`Invalid export entity: '${entity}'. Supported entities: ${Object.keys(require('../exports/registry').EXPORT_REGISTRY).join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    const Model = models[entityConfig.modelName];
    if (!Model) {
      const err = new Error(`Database model for entity '${entity}' is not configured.`);
      err.statusCode = 500;
      throw err;
    }

    // 1. Check Concurrent Active Jobs Per Tenant
    const activeJobsCount = await ExportJob.count({
      where: {
        tenant_id: tenantId,
        status: { [Op.in]: ['queued', 'processing'] },
      },
    });

    if (activeJobsCount >= this.maxConcurrent) {
      const err = new Error(`Maximum concurrent export jobs (${this.maxConcurrent}) reached for this tenant. Please wait for active exports to complete.`);
      err.statusCode = 429;
      throw err;
    }

    const cleanFilters = sanitizeFilters(entity, filters);
    const resolvedCols = resolveColumns(entity, columns).map((c) => c.key);
    const where = entityConfig.buildWhere(tenantId, cleanFilters);

    // 2. Count Matching Rows
    const totalMatching = await Model.count({ where });

    // 3. Check Sync vs Async Execution
    if (!forceAsync && totalMatching <= this.syncRowLimit) {
      // Synchronous Direct Export
      const buffer = await exportProcessor.generateDirectSyncExport({
        tenantId,
        entityKey: entity,
        filters: cleanFilters,
        columnKeys: resolvedCols,
      });

      return {
        is_sync: true,
        buffer,
        total_rows: totalMatching,
        filename: `${entity}_export_${new Date().toISOString().split('T')[0]}.xlsx`,
      };
    }

    // 4. Asynchronous Queue Execution
    const job = await ExportJob.create({
      tenant_id: tenantId,
      requested_by: userId,
      entity,
      filters: cleanFilters,
      columns: resolvedCols,
      status: 'queued',
      total_rows: totalMatching,
    });

    // Enqueue to BullMQ or trigger async runner
    await this.enqueueJob(job.id);

    return {
      is_sync: false,
      job_id: job.id,
      status: 'queued',
      total_estimated_rows: totalMatching,
      message: `Export job queued successfully. ${totalMatching > this.maxRows ? `(Export capped at ${this.maxRows} rows)` : ''}`,
    };
  }

  /**
   * Enqueue job for background worker
   */
  async enqueueJob(jobId) {
    if (exportQueue && process.env.USE_MOCK_REDIS !== 'true') {
      try {
        await exportQueue.add('processExport', { jobId });
        return;
      } catch (qErr) {
        logger.warn(`[ExportJobService] BullMQ enqueue failed: ${qErr.message}. Falling back to immediate background execution.`);
      }
    }

    // Fallback: run via background execution
    setImmediate(() => {
      exportProcessor.processJob(jobId).catch((err) => {
        logger.error(`[ExportJobService] Direct job execution error: ${err.message}`);
      });
    });
  }

  /**
   * List paginated export jobs for tenant
   */
  async listJobs(tenantId, { page = 1, limit = 20, status = null, entity = null } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const where = { tenant_id: tenantId };
    if (status) where.status = status;
    if (entity) where.entity = entity;

    const { count, rows } = await ExportJob.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: limitNum,
      offset,
    });

    return {
      total: count,
      page: pageNum,
      limit: limitNum,
      total_pages: Math.ceil(count / limitNum),
      jobs: rows,
    };
  }

  /**
   * Get single export job status and progress
   */
  async getJob(jobId, tenantId) {
    const job = await ExportJob.findOne({
      where: { id: jobId, tenant_id: tenantId },
    });
    if (!job) {
      const err = new Error('Export job not found');
      err.statusCode = 404;
      throw err;
    }
    return job;
  }

  /**
   * Get download file information (verifies owner tenant and expiration)
   */
  async getDownloadInfo(jobId, tenantId) {
    const job = await this.getJob(jobId, tenantId);

    if (job.status !== 'completed') {
      const err = new Error(`Export is not ready for download (current status: ${job.status})`);
      err.statusCode = 400;
      throw err;
    }

    if (job.expires_at && new Date(job.expires_at) < new Date()) {
      await job.update({ status: 'expired' });
      const err = new Error('Export download link has expired');
      err.statusCode = 410;
      throw err;
    }

    const filename = `${job.entity}_export_${new Date(job.created_at).toISOString().split('T')[0]}.xlsx`;

    // S3/R2 presigned URL handling
    if (config.storage.provider === 's3' || config.storage.provider === 'r2') {
      const fileUploadService = require('./fileUpload.service');
      if (fileUploadService.getSignedDownloadUrl) {
        const signedUrl = await fileUploadService.getSignedDownloadUrl(job.file_key, 900); // 15 min TTL
        return { isDirectStream: false, downloadUrl: signedUrl, filename };
      }
    }

    // Local file streaming
    const filePath = path.join(__dirname, '..', '..', config.storage.uploadDir, 'exports', String(job.tenant_id), `${job.id}.xlsx`);
    if (!fs.existsSync(filePath)) {
      const err = new Error('Exported file not found on disk');
      err.statusCode = 404;
      throw err;
    }

    return {
      isDirectStream: true,
      filePath,
      filename,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  /**
   * Cleanup expired export files and mark jobs as expired
   */
  async cleanupExpiredExports() {
    try {
      const expiredJobs = await ExportJob.findAll({
        where: {
          status: 'completed',
          expires_at: { [Op.lte]: new Date() },
        },
      });

      for (const job of expiredJobs) {
        const filePath = path.join(__dirname, '..', '..', config.storage.uploadDir, 'exports', String(job.tenant_id), `${job.id}.xlsx`);
        if (fs.existsSync(filePath)) {
          await fsPromises.unlink(filePath).catch(() => {});
        }
        await job.update({ status: 'expired' });
      }

      logger.info(`[ExportJobService] Cleaned up ${expiredJobs.length} expired export files.`);
    } catch (err) {
      logger.error(`[ExportJobService] Error during export cleanup: ${err.message}`);
    }
  }
}

module.exports = new ExportJobService();
