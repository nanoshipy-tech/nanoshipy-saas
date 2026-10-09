'use strict';

const fs = require('fs');
const path = require('path');
const reportExportService = require('../services/reportExport.service');
const { success, error } = require('../utils/apiResponse');
const { BadRequestError, DateRangeTooLargeError, InvalidReportTypeError, ForbiddenError } = require('../utils/errors');
const config = require('../config/env');

const MAX_ANALYTICS_RANGE_DAYS = 366;
const REPORT_TYPES = ['orders_summary', 'shipments_summary', 'ndr_rto_summary', 'wallet_statement', 'courier_performance'];
const FORMATS = ['csv', 'pdf'];

function validateDates(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) {
    throw new BadRequestError('Both date_from and date_to are required.');
  }
  const from = new Date(dateFrom);
  const to = new Date(dateTo);

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    throw new BadRequestError('Invalid date formats. Please use YYYY-MM-DD.');
  }

  if (from > to) {
    throw new BadRequestError('date_from cannot be after date_to.');
  }

  const diffTime = Math.abs(to - from);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > MAX_ANALYTICS_RANGE_DAYS) {
    throw new DateRangeTooLargeError(`Date range exceeds limit of ${MAX_ANALYTICS_RANGE_DAYS} days.`);
  }
}

const exportReport = async (req, res, next) => {
  try {
    const { report_type, format, date_from, date_to } = req.body;

    if (!REPORT_TYPES.includes(report_type)) {
      throw new InvalidReportTypeError(`Invalid report_type. Must be one of: ${REPORT_TYPES.join(', ')}`);
    }

    if (!FORMATS.includes(format)) {
      throw new BadRequestError(`Invalid format. Must be one of: ${FORMATS.join(', ')}`);
    }

    validateDates(date_from, date_to);

    // Attempt immediate direct generation for instant download
    let directResult = null;
    try {
      directResult = await reportExportService.processExportJob(
        req.user.tenant_id,
        req.user.id,
        { report_type, format, date_from, date_to }
      );
    } catch (directErr) {
      logger.warn('[ReportExport] Direct synchronous generation error, fallback to queue:', directErr.message);
    }

    const jobInfo = await reportExportService.generateExportJob(
      req.user.tenant_id,
      req.user.id,
      { report_type, format, date_from, date_to }
    );

    // Auditing
    const auditService = require('../services/audit.service');
    await auditService.log({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: 'report_exported',
      entity_type: 'report',
      metadata: { report_type, date_range: `${date_from} to ${date_to}`, format },
      req
    });

    return res.status(200).json({
      success: true,
      data: {
        ...jobInfo,
        download_url: directResult?.downloadUrl || null,
        file_url: directResult?.fileUrl || null,
      },
      error: null
    });
  } catch (err) {
    next(err);
  }
};

const downloadReport = async (req, res, next) => {
  try {
    const { path: filePath, expires, tenant_id, signature } = req.query;

    if (!filePath || !expires || !tenant_id || !signature) {
      throw new BadRequestError('Missing signed URL parameters.');
    }

    // Verify cryptographic signature
    const isValid = reportExportService.verifySignature(filePath, expires, tenant_id, signature);
    if (!isValid) {
      throw new ForbiddenError('This download link is invalid or has expired.');
    }

    // Resolve path to local file
    const cleanPath = decodeURIComponent(filePath);
    // filePath is typically /uploads/reports/filename.csv
    const prefix = `/${config.storage.uploadDir}/`;
    if (!cleanPath.startsWith(prefix)) {
      throw new BadRequestError('Invalid file path prefix.');
    }

    const relativePath = cleanPath.substring(prefix.length);
    const absolutePath = path.join(__dirname, '..', '..', config.storage.uploadDir, relativePath);

    if (!fs.existsSync(absolutePath)) {
      throw new BadRequestError('Requested file does not exist on server.');
    }

    // Determine filename for user download
    const filename = path.basename(absolutePath);
    return res.download(absolutePath, filename);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  exportReport,
  downloadReport,
};
