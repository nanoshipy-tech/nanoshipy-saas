'use strict';

const adminOperationsReportService = require('../services/adminOperationsReport.service');
const { sendExportResponse } = require('../utils/adminExport.util');

/**
 * GET /api/v1/admin/reports/operations
 * Returns operational summary KPIs, district breakdown, KAM breakdown, and paginated rows.
 */
async function getOperationsReport(req, res, next) {
  try {
    const reportData = await adminOperationsReportService.getOperationsReport(
      req.query,
      req.platformAdmin
    );

    return res.status(200).json({
      success: true,
      data: reportData,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/reports/operations/export
 * Generates and streams CSV or XLSX spreadsheet directly.
 */
async function exportOperationsReport(req, res, next) {
  try {
    const { format = 'csv' } = req.query;
    const { data, columns, filename, sheetName } = await adminOperationsReportService.exportOperationsReport(
      req.query,
      req.platformAdmin
    );

    return sendExportResponse(res, {
      data,
      columns,
      format,
      filename,
      sheetName,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/reports/operations/filter-options
 * Provides dropdown filter options (KAMs, Couriers, Statuses).
 */
async function getFilterOptions(req, res, next) {
  try {
    const options = await adminOperationsReportService.getFilterOptions(req.platformAdmin);
    return res.status(200).json({
      success: true,
      data: options,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getOperationsReport,
  exportOperationsReport,
  getFilterOptions,
};
