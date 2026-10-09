'use strict';

const activityLogService = require('../services/activityLog.service');
const { success } = require('../utils/apiResponse');

/**
 * GET /api/v1/activity-log
 * Returns the tenant's own audit log with search/filter/pagination.
 */
const listActivityLog = async (req, res, next) => {
  try {
    const {
      action,
      entity_type,
      user_id,
      date_from,
      date_to,
      page = 1,
      limit = 50,
    } = req.query;

    const data = await activityLogService.searchTenantActivityLog(
      req.user.tenant_id,
      { action, entityType: entity_type, userId: user_id, dateFrom: date_from, dateTo: date_to },
      { page: parseInt(page, 10) || 1, limit: parseInt(limit, 10) || 50 }
    );

    return success(res, data);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/activity-log/export
 * Export tenant activity log as a downloadable CSV file.
 */
const exportActivityLog = async (req, res, next) => {
  try {
    const { action, entity_type, date_from, date_to } = req.body;

    const { csv, rowCount } = await activityLogService.exportTenantActivityLog(
      req.user.tenant_id,
      { action, entityType: entity_type, dateFrom: date_from, dateTo: date_to }
    );

    const filename = `activity-log-${req.user.tenant_id}-${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Export-Row-Count', String(rowCount));
    return res.send(csv);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listActivityLog,
  exportActivityLog,
};
