'use strict';

const activityLogService = require('../services/activityLog.service');
const { success } = require('../utils/apiResponse');
const { PlatformAuditLog } = require('../models');
const logger = require('../utils/logger');

/**
 * GET /api/v1/platform/activity-log
 * Platform-wide audit log with search/filter/pagination.
 */
const listPlatformActivityLog = async (req, res, next) => {
  try {
    const {
      action,
      entity_type,
      target_tenant_id,
      admin_id,
      date_from,
      date_to,
      page = 1,
      limit = 50,
    } = req.query;

    const data = await activityLogService.searchPlatformActivityLog(
      {
        action,
        entityType: entity_type,
        targetTenantId: target_tenant_id,
        adminId: admin_id,
        dateFrom: date_from,
        dateTo: date_to,
      },
      { page: parseInt(page, 10) || 1, limit: parseInt(limit, 10) || 50 }
    );

    return success(res, data);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/platform/activity-log/tenant/:tenantId
 * Read-only drill-down into a specific tenant's audit_logs.
 * This action itself is logged to platform_audit_logs for meta-transparency.
 */
const getTenantActivityLog = async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    const {
      action,
      entity_type,
      date_from,
      date_to,
      page = 1,
      limit = 50,
    } = req.query;

    const data = await activityLogService.searchTenantActivityLog(
      tenantId,
      { action, entityType: entity_type, dateFrom: date_from, dateTo: date_to },
      { page: parseInt(page, 10) || 1, limit: parseInt(limit, 10) || 50 }
    );

    // Meta-audit: log that a platform admin viewed this tenant's activity log
    try {
      await PlatformAuditLog.create({
        platform_admin_id: req.platformAdmin.id,
        action: 'viewed_tenant_activity_log',
        target_tenant_id: tenantId,
        entity_type: 'audit_log',
        entity_id: null,
        metadata: { filters: { action, entity_type, date_from, date_to }, page, limit },
        ip_address: req.ip || req.headers['x-forwarded-for'],
      });
    } catch (logErr) {
      logger.error('[PlatformActivityLogController] Failed to write meta-audit log', { error: logErr.message });
    }

    return success(res, data);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/platform/activity-log/export
 * Export platform audit log as CSV.
 */
const exportPlatformActivityLog = async (req, res, next) => {
  try {
    const { action, entity_type, target_tenant_id, date_from, date_to } = req.body;

    const { csv, rowCount } = await activityLogService.exportPlatformActivityLog({
      action,
      entityType: entity_type,
      targetTenantId: target_tenant_id,
      dateFrom: date_from,
      dateTo: date_to,
    });

    const filename = `platform-activity-log-${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Export-Row-Count', String(rowCount));
    return res.send(csv);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listPlatformActivityLog,
  getTenantActivityLog,
  exportPlatformActivityLog,
};
