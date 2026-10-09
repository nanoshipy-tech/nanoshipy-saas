'use strict';

const path = require('path');
const fs = require('fs');
const fsPromises = require('fs/promises');
const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const { ExportJob, sequelize } = require('../models');
const models = require('../models');
const { getEntityConfig, resolveColumns, sanitizeFilters, sanitizeCellValue, FORMATTERS } = require('../exports/registry');
const webhookDispatcher = require('./webhookDispatcher.service');
const config = require('../config/env');
const logger = require('../utils/logger');

class ExportProcessorService {
  constructor() {
    this.batchSize = parseInt(process.env.EXPORT_BATCH_SIZE, 10) || 1000;
    this.maxRows = parseInt(process.env.EXPORT_MAX_ROWS, 10) || 50000;
    this.ttlHours = parseInt(process.env.EXPORT_FILE_TTL_HOURS, 10) || 24;

    // Ensure temp and export directories exist
    this.baseUploadDir = path.join(__dirname, '..', '..', config.storage.uploadDir);
    this.exportsDir = path.join(this.baseUploadDir, 'exports');
    this.tempDir = path.join(this.exportsDir, 'temp');

    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Process an export job
   * @param {string} jobId - UUID of the export job
   */
  async processJob(jobId) {
    const job = await ExportJob.findByPk(jobId);
    if (!job) {
      logger.warn(`[ExportProcessor] Job ${jobId} not found`);
      return;
    }

    if (job.status !== 'queued') {
      logger.info(`[ExportProcessor] Job ${jobId} is already in status ${job.status}`);
      return job;
    }

    // Atomic status transition with started_at timestamp
    await job.update({ status: 'processing', started_at: new Date() });

    const entityConfig = getEntityConfig(job.entity);
    if (!entityConfig) {
      await job.update({ status: 'failed', error_message: `Unknown entity: ${job.entity}` });
      await webhookDispatcher.emitWebhookEvent(job.tenant_id, 'export.failed', {
        export_id: job.id,
        entity: job.entity,
        error: `Unknown entity: ${job.entity}`,
      });
      return;
    }

    const Model = models[entityConfig.modelName];
    if (!Model) {
      await job.update({ status: 'failed', error_message: `Model ${entityConfig.modelName} not found` });
      return;
    }

    const columns = resolveColumns(job.entity, job.columns);
    const filters = sanitizeFilters(job.entity, job.filters || {});
    const baseWhere = entityConfig.buildWhere(job.tenant_id, filters);

    const tempFilePath = path.join(this.tempDir, `${job.id}.xlsx`);
    const tenantExportsDir = path.join(this.exportsDir, String(job.tenant_id));
    if (!fs.existsSync(tenantExportsDir)) {
      fs.mkdirSync(tenantExportsDir, { recursive: true });
    }
    const finalFilePath = path.join(tenantExportsDir, `${job.id}.xlsx`);
    const fileKey = `exports/${job.tenant_id}/${job.id}.xlsx`;

    try {
      logger.info(`[ExportProcessor] Streaming export for job ${job.id} (entity: ${job.entity}, tenant: ${job.tenant_id})`);

      // Initialize ExcelJS Streaming WorkbookWriter (constant flat memory)
      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
        filename: tempFilePath,
        useStyles: true,
        useSharedStrings: true,
      });

      const worksheet = workbook.addWorksheet(entityConfig.label || 'Export', {
        views: [{ state: 'frozen', ySplit: 1 }],
      });

      // 2. Set Column Definitions & Widths
      worksheet.columns = columns.map((col) => ({
        header: col.header,
        key: col.key,
        width: col.width || 20,
      }));

      // 3. Style Frozen Header Row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' },
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 28;
      headerRow.commit();

      // 4. Keyset Pagination DB Reading in Batches (Flat Memory, No OFFSET)
      let lastId = null;
      let totalRows = 0;

      while (totalRows < this.maxRows) {
        const batchWhere = { ...baseWhere };
        if (lastId) {
          batchWhere.id = { [Op.gt]: lastId };
        }

        const limit = Math.min(this.batchSize, this.maxRows - totalRows);
        const rows = await Model.findAll({
          where: batchWhere,
          order: [['id', 'ASC']],
          limit,
          raw: true,
        });

        if (!rows || rows.length === 0) {
          break; // Completed dataset
        }

        for (const item of rows) {
          const rowData = {};
          for (const col of columns) {
            let val = item[col.key];
            if (col.formatter && FORMATTERS[col.formatter]) {
              val = FORMATTERS[col.formatter](val);
            }
            // Formula Injection Neutralization
            rowData[col.key] = sanitizeCellValue(val);
          }

          const excelRow = worksheet.addRow(rowData);
          excelRow.height = 20;
          excelRow.commit();
          totalRows++;
        }

        lastId = rows[rows.length - 1].id;
      }

      // 5. Finalize & Flush Excel Workbook
      await worksheet.commit();
      await workbook.commit();

      // 6. Handle Storage
      let fileSize = 0;
      if (fs.existsSync(tempFilePath)) {
        const stats = await fsPromises.stat(tempFilePath);
        fileSize = stats.size;

        if (config.storage.provider === 's3' || config.storage.provider === 'r2') {
          const fileUploadService = require('./fileUpload.service');
          const fileBuffer = await fsPromises.readFile(tempFilePath);
          await fileUploadService.uploadFile(
            fileBuffer,
            `exports/${job.tenant_id}`,
            `${job.id}.xlsx`,
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          );
          // Delete local temp file
          await fsPromises.unlink(tempFilePath).catch(() => {});
        } else {
          // Local storage: move from temp to tenant directory
          await fsPromises.rename(tempFilePath, finalFilePath);
        }
      }

      const expiresAt = new Date(Date.now() + this.ttlHours * 3600000);

      await job.update({
        status: 'completed',
        total_rows: totalRows,
        file_key: fileKey,
        file_size: fileSize,
        completed_at: new Date(),
        expires_at: expiresAt,
        error_message: null,
      });

      logger.info(`[ExportProcessor] Job ${job.id} completed. Rows: ${totalRows}, Size: ${fileSize} bytes`);

      // 7. Emit Webhook Notification: export.completed
      const downloadUrl = `${config.appUrl || 'http://localhost:5000'}/api/v1/admin/exports/${job.id}/download`;
      await webhookDispatcher.emitWebhookEvent(job.tenant_id, 'export.completed', {
        export_id: job.id,
        entity: job.entity,
        total_rows: totalRows,
        file_size: fileSize,
        download_url: downloadUrl,
        expires_at: expiresAt.toISOString(),
      });

      return job;
    } catch (err) {
      console.error('[ExportProcessor Error Stack]:', err.stack || err);
      logger.error(`[ExportProcessor] Job ${job.id} failed: ${err.message}`, err);

      await job.update({
        status: 'failed',
        error_message: 'Export failed while compiling workbook. Please refine date or filter parameters and try again.',
      });

      // Emit Webhook Notification: export.failed
      await webhookDispatcher.emitWebhookEvent(job.tenant_id, 'export.failed', {
        export_id: job.id,
        entity: job.entity,
        error: 'Export generation failed',
      });

      // Cleanup temp file on failure
      if (fs.existsSync(tempFilePath)) {
        await fsPromises.unlink(tempFilePath).catch(() => {});
      }
    }
  }

  /**
   * Generates export directly and synchronously (for small row count <= EXPORT_SYNC_ROW_LIMIT)
   */
  async generateDirectSyncExport({ tenantId, entityKey, filters = {}, columnKeys = null }) {
    const entityConfig = getEntityConfig(entityKey);
    if (!entityConfig) throw new Error(`Unknown entity: ${entityKey}`);

    const Model = models[entityConfig.modelName];
    if (!Model) throw new Error(`Model ${entityConfig.modelName} not found`);

    const columns = resolveColumns(entityKey, columnKeys);
    const sanitizedFlt = sanitizeFilters(entityKey, filters);
    const where = entityConfig.buildWhere(tenantId, sanitizedFlt);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(entityConfig.label || 'Export');
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    worksheet.columns = columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width || 20,
    }));

    const headerRow = worksheet.getRow(1);
    headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 28;

    const rows = await Model.findAll({
      where,
      order: [['id', 'ASC']],
      limit: parseInt(process.env.EXPORT_SYNC_ROW_LIMIT, 10) || 5000,
      raw: true,
    });

    for (const item of rows) {
      const rowData = {};
      for (const col of columns) {
        let val = item[col.key];
        if (col.formatter && FORMATTERS[col.formatter]) {
          val = FORMATTERS[col.formatter](val);
        }
        rowData[col.key] = sanitizeCellValue(val);
      }
      worksheet.addRow(rowData);
    }

    return workbook.xlsx.writeBuffer();
  }
}

module.exports = new ExportProcessorService();
