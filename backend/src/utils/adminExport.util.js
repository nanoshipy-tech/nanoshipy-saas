'use strict';

const xlsx = require('xlsx');

/**
 * Formats a single value for CSV output.
 */
function escapeCsvValue(val) {
  if (val === null || val === undefined) return '""';
  if (typeof val === 'object' && val instanceof Date) {
    return `"${val.toISOString()}"`;
  }
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Converts array of objects to RFC 4180 CSV string.
 * @param {Array<Object>} data
 * @param {Array<{ key: string, label: string }>} columns
 * @returns {string}
 */
function toCsv(data, columns) {
  const headerLine = columns.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');
  const rowLines = data.map(row => {
    return columns.map(c => escapeCsvValue(row[c.key])).join(',');
  });
  return [headerLine, ...rowLines].join('\r\n');
}

/**
 * Converts array of objects to XLSX Buffer.
 * @param {Array<Object>} data
 * @param {Array<{ key: string, label: string }>} columns
 * @param {string} sheetName
 * @returns {Buffer}
 */
function toXlsx(data, columns, sheetName = 'Data') {
  // Format data rows according to column labels
  const formattedRows = data.map(row => {
    const obj = {};
    columns.forEach(col => {
      obj[col.label] = row[col.key] !== undefined && row[col.key] !== null ? row[col.key] : '';
    });
    return obj;
  });

  const worksheet = xlsx.utils.json_to_sheet(formattedRows);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31));

  return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Generates an export buffer and mimeType.
 * @param {Object} options
 * @param {Array<Object>} options.data - Array of row objects
 * @param {Array<{ key: string, label: string }>} options.columns - Column definitions
 * @param {'csv'|'xlsx'} [options.format='csv']
 * @param {string} [options.sheetName='Export']
 * @returns {{ buffer: Buffer, mimeType: string, extension: string }}
 */
function generateExport({ data = [], columns = [], format = 'csv', sheetName = 'Export' }) {
  const normalizedFormat = (format || 'csv').toLowerCase() === 'xlsx' ? 'xlsx' : 'csv';

  if (normalizedFormat === 'xlsx') {
    const buffer = toXlsx(data, columns, sheetName);
    return {
      buffer,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
    };
  }

  const csvString = toCsv(data, columns);
  const buffer = Buffer.from(csvString, 'utf-8');
  return {
    buffer,
    mimeType: 'text/csv; charset=utf-8',
    extension: 'csv',
  };
}

/**
 * Express helper to send export directly to client response with proper headers.
 */
function sendExportResponse(res, { data, columns, format = 'csv', filename = 'export', sheetName }) {
  const { buffer, mimeType, extension } = generateExport({ data, columns, format, sheetName });
  const safeFilename = `${filename.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().split('T')[0]}.${extension}`;

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
  res.setHeader('Content-Length', buffer.length);
  return res.status(200).send(buffer);
}

module.exports = {
  toCsv,
  toXlsx,
  generateExport,
  sendExportResponse,
};
