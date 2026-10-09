const { parse } = require('csv-parse/sync');
const xlsx = require('xlsx');

/**
 * Parse file buffer into JSON rows
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - File mime type
 * @param {string} originalName - Original file name
 * @returns {Array<object>} List of parsed rows (key-value objects)
 */
const parseImportFile = (buffer, mimeType, originalName) => {
  const ext = originalName.split('.').pop().toLowerCase();

  if (ext === 'csv' || mimeType === 'text/csv') {
    // Parse CSV
    const records = parse(buffer, {
      columns: true, // auto-detect headers
      skip_empty_lines: true,
      trim: true,
    });
    return records;
  } else if (ext === 'xlsx' || ext === 'xls') {
    // Parse Excel
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to JSON
    const records = xlsx.utils.sheet_to_json(worksheet, {
      defval: '', // fill empty cells with empty string
    });
    return records;
  } else {
    const error = new Error('Invalid file format. Only .csv, .xlsx, and .xls files are allowed.');
    error.code = 'IMPORT_FILE_FORMAT_ERROR';
    error.status = 422;
    throw error;
  }
};

module.exports = {
  parseImportFile,
};
