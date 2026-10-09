'use strict';

const exportJobService = require('../services/exportJob.service');
const { listExportableEntities, getEntityConfig } = require('../exports/registry');
const { success, error } = require('../utils/apiResponse');
const logger = require('../utils/logger');

class AdminExportController {
  /**
   * GET /admin/exports/entities
   * Returns all available exportable entities with their allowed filters and columns.
   */
  async getExportableEntities(req, res, next) {
    try {
      const entities = listExportableEntities();
      return success(res, entities);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /admin/exports
   * Creates an export job or streams small exports directly.
   */
  async createExport(req, res, next) {
    try {
      const tenantId = req.user?.tenant_id || req.tenant?.id;
      const userId = req.user?.id;

      if (!tenantId) {
        return error(res, { code: 'TENANT_REQUIRED', message: 'Tenant context is required for exports' }, 400);
      }

      const { entity, filters = {}, columns = null, force_async = false } = req.body;

      if (!entity) {
        return error(res, { code: 'INVALID_INPUT', message: 'Entity is required for export' }, 400);
      }

      const entityConfig = getEntityConfig(entity);
      if (!entityConfig) {
        return error(res, { code: 'INVALID_ENTITY', message: `Unknown export entity: '${entity}'` }, 400);
      }

      // Check entity-specific view permission if RBAC is enabled
      if (process.env.RBAC_ENABLED === 'true' && req.user && !req.user.isPlatformAdmin) {
        const userPerms = req.user.permissions || [];
        const required = entityConfig.requiredPermission;
        if (!userPerms.includes('*') && !userPerms.includes(required)) {
          return error(res, { code: 'FORBIDDEN', message: `Insufficient permissions to export ${entityConfig.label}` }, 403);
        }
      }

      const result = await exportJobService.requestExport({
        tenantId,
        userId,
        entity,
        filters,
        columns,
        forceAsync: force_async === true,
      });

      if (result.is_sync) {
        // Direct Synchronous File Download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.setHeader('Content-Length', result.buffer.length);
        return res.status(200).send(result.buffer);
      }

      // Async Export Queued
      return res.status(202).json({
        success: true,
        data: {
          job_id: result.job_id,
          status: result.status,
          total_estimated_rows: result.total_estimated_rows,
          message: result.message,
        },
        error: null,
      });
    } catch (err) {
      logger.error(`[AdminExportController] Error creating export: ${err.message}`);
      return error(res, { code: 'EXPORT_FAILED', message: err.message }, err.statusCode || 500);
    }
  }

  /**
   * GET /admin/exports
   * Paginated export history for the tenant.
   */
  async listExports(req, res, next) {
    try {
      const tenantId = req.user?.tenant_id || req.tenant?.id;
      if (!tenantId) {
        return error(res, { code: 'TENANT_REQUIRED', message: 'Tenant context is required' }, 400);
      }

      const { page, limit, status, entity } = req.query;
      const data = await exportJobService.listJobs(tenantId, { page, limit, status, entity });
      return success(res, data);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /admin/exports/:id
   * Get progress/status of a specific export job.
   */
  async getExportStatus(req, res, next) {
    try {
      const tenantId = req.user?.tenant_id || req.tenant?.id;
      const { id } = req.params;

      const job = await exportJobService.getJob(id, tenantId);
      return success(res, job);
    } catch (err) {
      return error(res, { code: 'NOT_FOUND', message: err.message }, err.statusCode || 404);
    }
  }

  /**
   * GET /admin/exports/:id/download
   * Authenticated file download or signed URL.
   */
  async downloadExport(req, res, next) {
    try {
      const tenantId = req.user?.tenant_id || req.tenant?.id;
      const { id } = req.params;

      const downloadInfo = await exportJobService.getDownloadInfo(id, tenantId);

      if (downloadInfo.downloadUrl) {
        return res.redirect(downloadInfo.downloadUrl);
      }

      if (downloadInfo.isDirectStream) {
        return res.download(downloadInfo.filePath, downloadInfo.filename);
      }

      return error(res, { code: 'DOWNLOAD_FAILED', message: 'Could not process download' }, 500);
    } catch (err) {
      return error(res, { code: 'DOWNLOAD_UNAVAILABLE', message: err.message }, err.statusCode || 400);
    }
  }
}

module.exports = new AdminExportController();
