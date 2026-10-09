'use strict';

const crypto = require('crypto');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fileUploadService = require('./fileUpload.service');
const config = require('../config/env');
const logger = require('../utils/logger');
const { Order, Shipment, NdrEvent, RtoRecord, WalletTransaction, User, Tenant } = require('../models');
const { Op } = require('sequelize');
const eventBus = require('../events/eventBus');

const { Queue } = require('bullmq');
const { connection } = require('../queues/connection');

// Initialize Queue for Report Export
const reportExportQueue = new Queue('report-export', {
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
 * Generate HMAC signature for securing download links.
 */
function generateSignature(filePath, expires, tenantId) {
  return crypto
    .createHmac('sha256', config.jwt.accessSecret)
    .update(`${filePath}:${expires}:${tenantId}`)
    .digest('hex');
}

/**
 * Verify HMAC signature.
 */
function verifySignature(filePath, expires, tenantId, signature) {
  if (parseInt(expires, 10) < Date.now()) {
    return false;
  }
  const expected = generateSignature(filePath, expires, tenantId);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * Trigger async report job in BullMQ.
 */
async function generateExportJob(tenantId, userId, params) {
  const jobId = crypto.randomUUID();
  await reportExportQueue.add(
    'generate-report',
    {
      jobId,
      tenantId,
      userId,
      params,
    },
    { jobId }
  );

  return {
    export_id: jobId,
    status: 'processing',
  };
}

/**
 * CSV formatter helper.
 */
function convertToCSV(data, headers) {
  const headerLine = headers.map((h) => `"${h.label}"`).join(',');
  const rowLines = data.map((row) =>
    headers
      .map((h) => {
        const val = row[h.key] === null || row[h.key] === undefined ? '' : row[h.key];
        return `"${val.toString().replace(/"/g, '""')}"`;
      })
      .join(',')
  );
  return [headerLine, ...rowLines].join('\n');
}

/**
 * Processes the export job (called from worker).
 */
async function processExportJob(tenantId, userId, params) {
  const { report_type, format, date_from, date_to } = params;
  const start = `${date_from} 00:00:00.000`;
  const end = `${date_to} 23:59:59.999`;
  const whereTenant = { tenant_id: tenantId, created_at: { [Op.between]: [start, end] } };

  logger.info(`[ReportExportService] Building export of type ${report_type} in ${format} format for tenant ${tenantId}`);

  let buffer;
  let mimeType;
  let fileExtension = format.toLowerCase();

  let data = [];
  let headers = [];

  // 1. Gather Data based on report type
  if (report_type === 'orders_summary') {
    headers = [
      { key: 'order_reference', label: 'Order Reference' },
      { key: 'customer_name', label: 'Customer Name' },
      { key: 'customer_phone', label: 'Customer Phone' },
      { key: 'customer_email', label: 'Customer Email' },
      { key: 'shipping_city', label: 'City' },
      { key: 'shipping_state', label: 'State' },
      { key: 'order_value', label: 'Order Value (INR)' },
      { key: 'payment_mode', label: 'Payment Mode' },
      { key: 'status', label: 'Status' },
      { key: 'created_at', label: 'Created At' },
    ];
    data = await Order.findAll({
      where: whereTenant,
      order: [['created_at', 'DESC']],
      raw: true,
    });
  } else if (report_type === 'shipments_summary') {
    headers = [
      { key: 'id', label: 'Shipment ID' },
      { key: 'awb_number', label: 'AWB Number' },
      { key: 'service_type', label: 'Service' },
      { key: 'selected_rate', label: 'Rate Charged (INR)' },
      { key: 'status', label: 'Status' },
      { key: 'created_at', label: 'Booked At' },
    ];
    data = await Shipment.findAll({
      where: whereTenant,
      order: [['created_at', 'DESC']],
      raw: true,
    });
  } else if (report_type === 'ndr_rto_summary') {
    // Return NDR events joined with basic details
    headers = [
      { key: 'shipment_id', label: 'Shipment ID' },
      { key: 'reason_code', label: 'Reason Code' },
      { key: 'raw_reason', label: 'Raw Reason' },
      { key: 'attempt_number', label: 'Attempt No' },
      { key: 'status', label: 'NDR Status' },
      { key: 'created_at', label: 'Occurred At' },
    ];
    data = await NdrEvent.findAll({
      where: whereTenant,
      order: [['created_at', 'DESC']],
      raw: true,
    });
  } else if (report_type === 'wallet_statement') {
    headers = [
      { key: 'type', label: 'Type' },
      { key: 'amount', label: 'Amount (INR)' },
      { key: 'balance_after', label: 'Balance After (INR)' },
      { key: 'reference_type', label: 'Reference' },
      { key: 'description', label: 'Description' },
      { key: 'created_at', label: 'Date' },
    ];
    // Wallet transactions are immutable and created_at only
    data = await WalletTransaction.findAll({
      where: { tenant_id: tenantId, created_at: { [Op.between]: [start, end] } },
      order: [['created_at', 'DESC']],
      raw: true,
    });
  } else if (report_type === 'courier_performance') {
    headers = [
      { key: 'courier_name', label: 'Courier Partner' },
      { key: 'shipments_count', label: 'Total Shipments' },
      { key: 'delivered_count', label: 'Delivered' },
      { key: 'ndr_count', label: 'NDR Events' },
      { key: 'rto_count', label: 'RTOs' },
      { key: 'delivery_success_rate', label: 'Success Rate (%)' },
      { key: 'ndr_rate', label: 'NDR Rate (%)' },
      { key: 'avg_delivery_time_hours', label: 'Avg Transit (Hours)' },
    ];
    const tenantAnalyticsService = require('./tenantAnalytics.service');
    data = await tenantAnalyticsService.getCourierPerformance(tenantId, date_from, date_to);
  }

  // 2. Format as CSV or PDF
  if (format === 'csv') {
    const csvContent = convertToCSV(data, headers);
    buffer = Buffer.from(csvContent, 'utf-8');
    mimeType = 'text/csv';
  } else {
    // Generate clean A4 Summary PDF
    const pdfDoc = await PDFDocument.create();
    const width = 595.27;
    const height = 841.89;
    const page = pdfDoc.addPage([width, height]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const drawText = (text, x, y, size = 10, isBold = false) => {
      page.drawText((text || '').toString(), {
        x,
        y: height - y,
        size,
        font: isBold ? fontBold : font,
        color: rgb(0.1, 0.1, 0.1),
      });
    };

    const drawLine = (x1, y1, x2, y2) => {
      page.drawLine({
        start: { x: x1, y: height - y1 },
        end: { x: x2, y: height - y2 },
        thickness: 1,
        color: rgb(0.8, 0.8, 0.8),
      });
    };

    // Header Title
    drawText('REPORTS & ANALYTICS STATEMENT', 40, 50, 16, true);
    drawText(`Generated on: ${new Date().toLocaleString('en-IN')}`, 40, 70, 8);
    drawText(`Report Type: ${report_type.toUpperCase().replace(/_/g, ' ')}`, 40, 85, 10, true);
    drawText(`Date Range: ${date_from} to ${date_to}`, 40, 100, 9);

    drawLine(40, 115, 555, 115);

    // KPI / Summary calculations
    drawText('SUMMARY PERFORMANCE METRICS', 40, 135, 11, true);
    drawText(`Total Records Found: ${data.length}`, 40, 155, 10);

    drawLine(40, 175, 555, 175);

    // Table Headers
    let currentY = 195;
    const visibleHeaders = headers.slice(0, 5); // Limit column width on PDF to first 5 columns
    let startX = 40;
    visibleHeaders.forEach((h) => {
      drawText(h.label, startX, currentY, 9, true);
      startX += 100;
    });

    drawLine(40, currentY + 10, 555, currentY + 10);
    currentY += 25;

    // Draw top 20 rows (PDF is summary only)
    const limitRows = data.slice(0, 20);
    limitRows.forEach((row) => {
      if (currentY > 800) return; // Prevent overflow
      startX = 40;
      visibleHeaders.forEach((h) => {
        const val = row[h.key] === null || row[h.key] === undefined ? '' : row[h.key];
        // Shorten long strings for fitting
        const shortVal = val.toString().substring(0, 18);
        drawText(shortVal, startX, currentY, 8);
        startX += 100;
      });
      currentY += 18;
    });

    if (data.length > 20) {
      drawText(`...and ${data.length - 20} more records (download CSV format for full datasets)`, 40, currentY + 10, 9, false);
    }

    const pdfBytes = await pdfDoc.save();
    buffer = Buffer.from(pdfBytes);
    mimeType = 'application/pdf';
  }

  // 3. Upload File
  const filename = `${report_type}-${Date.now()}.${fileExtension}`;
  const fileUrl = await fileUploadService.uploadFile(buffer, 'reports', filename, mimeType);

  // 4. Generate Expiring Download URL (7 days)
  const expiryDays = parseInt(process.env.REPORT_EXPORT_URL_EXPIRY_DAYS, 10) || 7;
  const expires = Date.now() + expiryDays * 24 * 60 * 60 * 1000;
  const signature = generateSignature(fileUrl, expires, tenantId);
  const downloadUrl = `${config.appUrl}/api/v1/reports/download?path=${encodeURIComponent(fileUrl)}&expires=${expires}&tenant_id=${tenantId}&signature=${signature}`;

  // 5. Notify the Tenant
  const user = await User.findByPk(userId);
  const tenant = await Tenant.findByPk(tenantId);
  const notificationPayload = {
    tenant_id: tenantId,
    user_id: userId,
    report_type,
    date_from,
    date_to,
    download_url: downloadUrl,
    customer_email: user?.email, // notification service routes using these fallbacks
  };

  logger.info(`[ReportExportService] Dispatching 'report.exported' notification for tenant ${tenantId}`);
  eventBus.emit('report.exported', notificationPayload);

  return {
    fileUrl,
    downloadUrl,
  };
}

module.exports = {
  reportExportQueue,
  generateExportJob,
  processExportJob,
  verifySignature,
};
